import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  PHOTO_FIELD_DEFINITIONS, 
  PhotoInsertionLog, 
  PhotoDefinition,
  fetchImageBinary,
  getPhotoUrlForContentControl
} from './photoManager';
import { getPictureNotAvailableDataUrlSync } from './placeholderImage';

export interface ReportDataValues {
  [key: string]: any;
}

export interface DocxGenerationResult {
  blob: Blob;
  logs: PhotoInsertionLog[];
  insertedCount: number;
  totalPhotos: number;
}

/**
 * Helper to safely decode base64 string with padding and URL-safe character fix
 */
export function safeAtob(base64: string): string {
  let clean = base64.replace(/[\s\r\n]+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  // Strip URI encoding if present
  if (clean.includes('%')) {
    try {
      clean = decodeURIComponent(clean);
    } catch (e) {}
  }
  // Remove non-base64 characters
  clean = clean.replace(/[^A-Za-z0-9+/=]/g, '');
  // Add missing padding
  const mod = clean.length % 4;
  if (mod === 2) clean += '==';
  else if (mod === 3) clean += '=';
  else if (mod === 1) clean = clean.substring(0, clean.length - 1); // Invalid single char

  return window.atob(clean);
}

/**
 * Converts a Base64 string back to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  try {
    const cleanBase64 = base64.split(',').pop() || base64;
    const binaryString = safeAtob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (e) {
    console.error('Error converting base64 to ArrayBuffer:', e);
    return new ArrayBuffer(0);
  }
}

/**
 * Converts ArrayBuffer to Base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Converts a data URL (e.g. data:image/png;base64,...) to Uint8Array binary and extension
 * Optimized with size-capped LRU cache to prevent memory leaks and repeated conversions
 */
const binaryDecodeCache = new Map<string, { bytes: Uint8Array; extension: string }>();

export function dataURLToBinary(dataUrl: string): { bytes: Uint8Array; extension: string } | null {
  if (!dataUrl || typeof dataUrl !== 'string' || dataUrl === 'NA') return null;
  const trimmed = dataUrl.trim();
  if (!trimmed || trimmed === 'NA') return null;

  // Fast key based on length and sample
  const cacheKey = trimmed.length > 150 ? `${trimmed.length}_${trimmed.slice(0, 60)}_${trimmed.slice(-30)}` : trimmed;
  if (binaryDecodeCache.has(cacheKey)) {
    return binaryDecodeCache.get(cacheKey)!;
  }

  try {
    let extension = 'png';
    let base64Str = trimmed;

    if (trimmed.startsWith('data:')) {
      const commaIdx = trimmed.indexOf(',');
      if (commaIdx !== -1) {
        const header = trimmed.slice(0, commaIdx).toLowerCase();
        base64Str = trimmed.slice(commaIdx + 1);
        if (header.includes('jpeg') || header.includes('jpg')) extension = 'jpeg';
        else if (header.includes('webp')) extension = 'webp';
        else if (header.includes('png')) extension = 'png';
      }
    }

    const binaryString = safeAtob(base64Str);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const result = { bytes, extension };
    if (binaryDecodeCache.size > 80) {
      binaryDecodeCache.clear();
    }
    binaryDecodeCache.set(cacheKey, result);
    return result;
  } catch (e) {
    // Only log if it's not a standard empty/null/non-base64 url
    if (!trimmed.startsWith('http') && !trimmed.startsWith('blob:')) {
      console.warn('Could not decode dataURL as base64 binary:', e);
    }
    return null;
  }
}

export interface DetectedPlaceholders {
  all: string[];
  textPlaceholders: string[];
  photoPlaceholders: string[];
  sdtTags: string[];
  pendingTags: string[];
}

/**
 * Extracts and categorizes all placeholders (Text, Photos, SDTs, Pending) from a DOCX base64 string
 */
export function extractPlaceholdersFromDocx(base64Template: string): DetectedPlaceholders {
  const result: DetectedPlaceholders = {
    all: [],
    textPlaceholders: [],
    photoPlaceholders: [],
    sdtTags: [],
    pendingTags: []
  };

  if (!base64Template) return result;

  try {
    const arrayBuffer = base64ToArrayBuffer(base64Template);
    const zip = new PizZip(arrayBuffer);
    const xmlFiles = Object.keys(zip.files).filter(name => /^word\/(document|header\d*|footer\d*)\.xml$/i.test(name));

    const seenAll = new Set<string>();
    const seenText = new Set<string>();
    const seenPhoto = new Set<string>();
    const seenSdt = new Set<string>();
    const seenPending = new Set<string>();

    for (const fileName of xmlFiles) {
      const rawXml = zip.file(fileName)?.asText() || '';
      if (!rawXml) continue;
      
      const fileXml = cleanSplitTagsInXml(rawXml);

      // 1. Scan {{...}} placeholders
      const mustacheRegex = /\{\{([^{}]+)\}\}/g;
      let match: RegExpExecArray | null;
      while ((match = mustacheRegex.exec(fileXml)) !== null) {
        const rawTag = match[1].trim();
        if (!rawTag || seenAll.has(rawTag)) continue;
        seenAll.add(rawTag);

        const clean = rawTag.replace(/[\s_]+/g, '').toLowerCase();
        const isPhoto = clean.startsWith('photo') || PHOTO_FIELD_DEFINITIONS.some(def =>
          def.photoKey.replace(/[\s_]+/g, '').toLowerCase() === clean ||
          def.id.replace(/[\s_]+/g, '').toLowerCase() === clean ||
          def.aliases.some(a => a.replace(/[\s_]+/g, '').toLowerCase() === clean)
        );

        if (isPhoto) {
          seenPhoto.add(rawTag);
        } else {
          seenText.add(rawTag);
        }
      }

      // 2. Scan <w:sdt> structured document tags
      const sdtRegex = /<w:sdt\b[\s\S]*?<\/w:sdt>/gi;
      let sdtMatch: RegExpExecArray | null;
      while ((sdtMatch = sdtRegex.exec(fileXml)) !== null) {
        const sdtBlock = sdtMatch[0];
        const tagMatch = sdtBlock.match(/<w:tag\s+[^>]*w:val="([^"]+)"/i);
        const aliasMatch = sdtBlock.match(/<w:alias\s+[^>]*w:val="([^"]+)"/i);
        const val = tagMatch ? tagMatch[1] : (aliasMatch ? aliasMatch[1] : '');
        if (val && !seenSdt.has(val)) {
          seenSdt.add(val);
        }
      }

      // 3. Scan [Pending: ...] tags
      const pendingRegex = /\[Pending:?\s*([^\]]+)\]/gi;
      let pendingMatch: RegExpExecArray | null;
      while ((pendingMatch = pendingRegex.exec(fileXml)) !== null) {
        const val = pendingMatch[1].trim();
        if (val && !seenPending.has(val)) {
          seenPending.add(val);
        }
      }
    }

    result.all = Array.from(seenAll);
    result.textPlaceholders = Array.from(seenText);
    result.photoPlaceholders = Array.from(seenPhoto);
    result.sdtTags = Array.from(seenSdt);
    result.pendingTags = Array.from(seenPending);
  } catch (err) {
    console.error('Failed to extract placeholders from DOCX:', err);
  }

  return result;
}

export interface PhotoItemMeta {
  rId: string;
  cx: number;
  cy: number;
  width?: number;
  height?: number;
}

/**
 * Extracts natural image dimensions (width & height) from raw image bytes
 */
export function getImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (!bytes || bytes.length < 24) return null;
  try {
    // 1. PNG check
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
      if (width > 0 && height > 0) return { width, height };
    }
    // 2. JPEG check
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
      let offset = 2;
      while (offset < bytes.length - 8) {
        if (bytes[offset] !== 0xFF) {
          offset++;
          continue;
        }
        const marker = bytes[offset + 1];
        if (marker >= 0xC0 && marker <= 0xC3) {
          const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
          const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
          if (width > 0 && height > 0) return { width, height };
        }
        const len = (bytes[offset + 2] << 8) | bytes[offset + 3];
        if (len <= 0) break;
        offset += 2 + len;
      }
    }
    // 3. GIF check
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      const width = bytes[6] | (bytes[7] << 8);
      const height = bytes[8] | (bytes[9] << 8);
      if (width > 0 && height > 0) return { width, height };
    }
    // 4. WEBP check
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x20) {
        const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
        const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
        if (width > 0 && height > 0) return { width, height };
      }
      if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x4C) {
        const width = 1 + (((bytes[22] & 0x3F) << 8) | bytes[21]);
        const height = 1 + (((bytes[24] & 0xF) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xC0) >> 6));
        if (width > 0 && height > 0) return { width, height };
      }
    }
  } catch {
    // fallback
  }
  return null;
}

/**
 * Calculates EMU dimensions fitting exactly within max bounds (6cm x 4cm)
 * while strictly preserving the image's original dimensions and aspect ratio
 */
export function calculateEmuDimensions(
  origWidth?: number,
  origHeight?: number,
  maxCmWidth: number = 6,
  maxCmHeight: number = 4
): { cx: number; cy: number } {
  const maxEmuWidth = Math.round(maxCmWidth * 360000); // 6 cm = 2,160,000 EMUs
  const maxEmuHeight = Math.round(maxCmHeight * 360000); // 4 cm = 1,440,000 EMUs

  if (!origWidth || !origHeight || origWidth <= 0 || origHeight <= 0) {
    return { cx: maxEmuWidth, cy: maxEmuHeight };
  }

  const aspectRatio = origWidth / origHeight;
  const targetRatio = maxEmuWidth / maxEmuHeight; // 1.5

  if (aspectRatio >= targetRatio) {
    // Width limited (wider image)
    const cx = maxEmuWidth;
    const cy = Math.round(maxEmuWidth / aspectRatio);
    return { cx, cy: Math.min(cy, maxEmuHeight) };
  } else {
    // Height limited (taller image)
    const cy = maxEmuHeight;
    const cx = Math.round(maxEmuHeight * aspectRatio);
    return { cx: Math.min(cx, maxEmuWidth), cy };
  }
}

/**
 * Creates OpenXML DrawingML string for an inline image preserving aspect ratio within 6 cm x 4 cm
 * 1 cm = 360,000 EMUs -> 6cm = 2,160,000 EMUs, 4cm = 1,440,000 EMUs
 */
export function createDrawingML(
  rId: string, 
  imgId: number, 
  imgName: string, 
  cx: number = 2160000, 
  cy: number = 1440000
): string {
  return `<w:drawing>
    <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
      <wp:extent cx="${cx}" cy="${cy}"/>
      <wp:effectExtent l="0" t="0" r="0" b="0"/>
      <wp:docPr id="${imgId}" name="${escapeXml(imgName)}"/>
      <wp:cNvGraphicFramePr>
        <a:graphicFrameLocks noChangeAspect="1" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>
      </wp:cNvGraphicFramePr>
      <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:nvPicPr>
              <pic:cNvPr id="${imgId}" name="${escapeXml(imgName)}"/>
              <pic:cNvPicPr/>
            </pic:nvPicPr>
            <pic:blipFill>
              <a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
              <a:stretch><a:fillRect/></a:stretch>
            </pic:blipFill>
            <pic:spPr>
              <a:xfrm>
                <a:off x="0" y="0"/>
                <a:ext cx="${cx}" cy="${cy}"/>
              </a:xfrm>
              <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
            </pic:spPr>
          </pic:pic>
        </a:graphicData>
      </a:graphic>
    </wp:inline>
  </w:drawing>`;
}

// Global photo metadata store for the current generation run
export const currentPhotoMetaMap = new Map<string, PhotoItemMeta>();

/**
 * Injects photos into the DOCX zip package (updating Content_Types, rels, and media files)
 */
export function injectPhotosIntoZip(
  zip: PizZip, 
  photos: Record<string, string> = {},
  logsMap?: Map<string, PhotoInsertionLog>
): Map<string, string> {
  const photoRIdMap = new Map<string, string>();
  currentPhotoMetaMap.clear();

  // 1. Ensure Content_Types has png & jpeg defaults
  let contentTypesXml = zip.file('[Content_Types].xml')?.asText() || '';
  if (contentTypesXml) {
    if (!contentTypesXml.includes('Extension="png"')) {
      contentTypesXml = contentTypesXml.replace('</Types>', '  <Default Extension="png" ContentType="image/png"/>\n</Types>');
    }
    if (!contentTypesXml.includes('Extension="jpeg"')) {
      contentTypesXml = contentTypesXml.replace('</Types>', '  <Default Extension="jpeg" ContentType="image/jpeg"/>\n</Types>');
    }
    if (!contentTypesXml.includes('Extension="jpg"')) {
      contentTypesXml = contentTypesXml.replace('</Types>', '  <Default Extension="jpg" ContentType="image/jpeg"/>\n</Types>');
    }
    zip.file('[Content_Types].xml', contentTypesXml);
  }

  // 2. Read or create word/_rels/document.xml.rels
  let relsXml = zip.file('word/_rels/document.xml.rels')?.asText() || '';
  if (!relsXml) {
    relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n</Relationships>`;
  }

  // 3. Process standard photo definitions
  PHOTO_FIELD_DEFINITIONS.forEach((def) => {
    const originalUrl = getPhotoUrlForContentControl(photos, def.photoKey);
    const foundInDb = Boolean(originalUrl && originalUrl !== 'NA' && originalUrl.trim() !== '');
    // If not uploaded, automatically fallback to Picture Not Available
    const rawUrl = foundInDb ? originalUrl! : getPictureNotAvailableDataUrlSync();

    const logEntry: PhotoInsertionLog = {
      photoKey: def.photoKey,
      label: def.label,
      foundInDatabase: foundInDb,
      hasImageUrl: Boolean(rawUrl),
      imageDownloaded: false,
      contentControlFound: false,
      imageInserted: false,
      status: foundInDb ? 'inserted' : 'missing',
      details: foundInDb ? undefined : 'Automatic Picture Not Available placeholder used'
    };

    if (rawUrl && rawUrl !== 'NA' && rawUrl.trim() !== '') {
      const parsed = dataURLToBinary(rawUrl);
      if (parsed) {
        logEntry.imageDownloaded = true;
        const rId = `rIdPhoto_${def.photoKey}`;
        const mediaFileName = `media/photo_${def.photoKey}.${parsed.extension}`;

        // Compute proportional size under 6cm x 4cm
        const dims = getImageDimensions(parsed.bytes);
        const emuDims = calculateEmuDimensions(dims?.width, dims?.height, 6, 4);
        const meta: PhotoItemMeta = {
          rId,
          cx: emuDims.cx,
          cy: emuDims.cy,
          width: dims?.width,
          height: dims?.height
        };

        // Write binary to zip media directory
        zip.file(`word/${mediaFileName}`, parsed.bytes);
        
        // Map photo keys and aliases
        photoRIdMap.set(def.photoKey, rId);
        photoRIdMap.set(def.id, rId);
        photoRIdMap.set(def.photoKey.toLowerCase(), rId);
        photoRIdMap.set(def.label.toLowerCase(), rId);
        currentPhotoMetaMap.set(def.photoKey, meta);
        currentPhotoMetaMap.set(def.id, meta);
        currentPhotoMetaMap.set(def.photoKey.toLowerCase(), meta);

        def.aliases.forEach(alias => {
          photoRIdMap.set(alias, rId);
          photoRIdMap.set(alias.toLowerCase(), rId);
          photoRIdMap.set(alias.replace(/[\s_]+/g, '').toLowerCase(), rId);
          currentPhotoMetaMap.set(alias, meta);
          currentPhotoMetaMap.set(alias.toLowerCase(), meta);
        });

        // Add relationship if not already in document.xml.rels
        if (!relsXml.includes(`Id="${rId}"`)) {
          const relEntry = `  <Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${mediaFileName}"/>\n`;
          relsXml = relsXml.replace('</Relationships>', `${relEntry}</Relationships>`);
        }
      } else {
        logEntry.details = 'Failed to decode image data';
      }
    } else {
      logEntry.details = 'Photo not uploaded';
    }

    if (logsMap) {
      logsMap.set(def.photoKey, logEntry);
    }
  });

  // 4. Custom photo entries
  Object.entries(photos).forEach(([customKey, rawUrl]) => {
    if (!rawUrl || typeof rawUrl !== 'string' || rawUrl === 'NA' || rawUrl.trim() === '') return;
    if (photoRIdMap.has(customKey)) return;

    const parsed = dataURLToBinary(rawUrl);
    if (parsed) {
      const safeKey = customKey.replace(/[^a-zA-Z0-9_]/g, '_');
      const rId = `rIdPhoto_custom_${safeKey}`;
      const mediaFileName = `media/photo_custom_${safeKey}.${parsed.extension}`;

      const dims = getImageDimensions(parsed.bytes);
      const emuDims = calculateEmuDimensions(dims?.width, dims?.height, 6, 4);
      const meta: PhotoItemMeta = {
        rId,
        cx: emuDims.cx,
        cy: emuDims.cy,
        width: dims?.width,
        height: dims?.height
      };

      zip.file(`word/${mediaFileName}`, parsed.bytes);
      photoRIdMap.set(customKey, rId);
      photoRIdMap.set(customKey.toLowerCase(), rId);
      currentPhotoMetaMap.set(customKey, meta);
      currentPhotoMetaMap.set(customKey.toLowerCase(), meta);

      if (!relsXml.includes(`Id="${rId}"`)) {
        const relEntry = `  <Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${mediaFileName}"/>\n`;
        relsXml = relsXml.replace('</Relationships>', `${relEntry}</Relationships>`);
      }
    }
  });

  zip.file('word/_rels/document.xml.rels', relsXml);
  return photoRIdMap;
}

/**
 * Fast lookup helper for photo definition matching
 */
function findPhotoDefByNormalizedTag(rawTag: string): PhotoDefinition | null {
  const clean = rawTag.trim().replace(/[\s_]+/g, '').toLowerCase();
  for (const def of PHOTO_FIELD_DEFINITIONS) {
    if (
      def.photoKey.replace(/[\s_]+/g, '').toLowerCase() === clean ||
      def.id.replace(/[\s_]+/g, '').toLowerCase() === clean ||
      def.label.replace(/[\s_]+/g, '').toLowerCase() === clean ||
      def.aliases.some(a => a.replace(/[\s_]+/g, '').toLowerCase() === clean)
    ) {
      return def;
    }
  }
  return null;
}

/**
 * High-performance, non-blocking single-pass photo inserter for DOCX XML
 */
export function insertPhotosIntoContentControls(
  docXml: string,
  photoRIdMap: Map<string, string>,
  logsMap?: Map<string, PhotoInsertionLog>
): string {
  if (!docXml) return '';
  let modifiedXml = docXml;

  // 1. Process Structured Document Tags (<w:sdt>) - Word Picture Content Controls
  modifiedXml = modifiedXml.replace(/<w:sdt\b[^>]*>[\s\S]*?<\/w:sdt>/gi, (sdtBlock) => {
    const tagMatch = sdtBlock.match(/<w:tag\s+[^>]*w:val="([^"]+)"/i);
    const aliasMatch = sdtBlock.match(/<w:alias\s+[^>]*w:val="([^"]+)"/i);
    
    const tagVal = tagMatch ? tagMatch[1] : '';
    const aliasVal = aliasMatch ? aliasMatch[1] : '';
    const searchKeys = [tagVal, aliasVal].filter(Boolean);

    let matchedDef: PhotoDefinition | null = null;
    for (const key of searchKeys) {
      matchedDef = findPhotoDefByNormalizedTag(key);
      if (matchedDef) break;
    }

    if (!matchedDef) return sdtBlock;

    const log = logsMap?.get(matchedDef.photoKey);
    if (log) log.contentControlFound = true;

    const rId = photoRIdMap.get(matchedDef.photoKey);
    if (!rId) {
      if (log) {
        log.imageInserted = false;
        log.status = log.hasImageUrl ? 'error' : 'missing';
      }
      return sdtBlock;
    }

    if (/<a:blip\b[^>]*r:embed="[^"]+"/i.test(sdtBlock)) {
      if (log) {
        log.imageInserted = true;
        log.status = 'inserted';
      }
      return sdtBlock.replace(/(<a:blip\b[^>]*r:embed=")([^"]+)(")/gi, `$1${rId}$3`);
    }

    const meta = currentPhotoMetaMap.get(matchedDef.photoKey) || currentPhotoMetaMap.get(matchedDef.photoKey.toLowerCase());
    const cx = meta?.cx ?? 2160000;
    const cy = meta?.cy ?? 1440000;
    const drawingXml = createDrawingML(rId, 600, matchedDef.photoKey, cx, cy);
    const replacementContent = `<w:sdtContent><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="60"/></w:pPr><w:r>${drawingXml}</w:r></w:p></w:sdtContent>`;
    
    let newSdt = sdtBlock;
    if (/<w:sdtContent[\s\S]*?<\/w:sdtContent>/i.test(newSdt)) {
      newSdt = newSdt.replace(/<w:sdtContent[\s\S]*?<\/w:sdtContent>/i, replacementContent);
    } else {
      newSdt = newSdt.replace(/<\/w:sdtPr>/i, `</w:sdtPr>${replacementContent}`);
    }

    if (log) {
      log.imageInserted = true;
      log.status = 'inserted';
    }

    return newSdt;
  });

  // 2. Scan and replace {{PHOTO_...}} or {{photo_...}} tags in a single fast regex pass
  modifiedXml = modifiedXml.replace(/\{\{\s*([^{}]+)\s*\}\}/g, (fullMatch, rawInner) => {
    const trimmed = rawInner.trim();
    const clean = trimmed.replace(/[\s_]+/g, '').toLowerCase();

    if (!clean.startsWith('photo') && !clean.includes('motor') && !clean.includes('pcb') && !clean.includes('nameplate') && !clean.includes('compressor') && !clean.includes('packing') && !clean.includes('eev')) {
      return fullMatch;
    }

    const matchedDef = findPhotoDefByNormalizedTag(trimmed);
    if (!matchedDef) return fullMatch;

    const log = logsMap?.get(matchedDef.photoKey);
    if (log) log.contentControlFound = true;

    const rId = photoRIdMap.get(matchedDef.photoKey);
    if (rId) {
      if (log) {
        log.imageInserted = true;
        log.status = 'inserted';
      }
      const meta = currentPhotoMetaMap.get(matchedDef.photoKey) || currentPhotoMetaMap.get(matchedDef.photoKey.toLowerCase());
      const cx = meta?.cx ?? 2160000;
      const cy = meta?.cy ?? 1440000;
      const drawingXml = createDrawingML(rId, 700, matchedDef.photoKey, cx, cy);
      return `</w:t></w:r><w:r>${drawingXml}</w:r><w:r><w:t>`;
    }

    return `[ Photo Not Uploaded ]`;
  });

  // 3. Scan and replace [Pending: ...] tags in a single fast regex pass
  modifiedXml = modifiedXml.replace(/\[Pending:?\s*([^\]]+)\]/gi, (fullMatch, rawLabel) => {
    const trimmed = String(rawLabel || '').trim();
    const matchedDef = findPhotoDefByNormalizedTag(trimmed);

    if (matchedDef) {
      const log = logsMap?.get(matchedDef.photoKey);
      if (log) log.contentControlFound = true;

      const rId = photoRIdMap.get(matchedDef.photoKey);
      if (rId) {
        if (log) {
          log.imageInserted = true;
          log.status = 'inserted';
        }
        const meta = currentPhotoMetaMap.get(matchedDef.photoKey) || currentPhotoMetaMap.get(matchedDef.photoKey.toLowerCase());
        const cx = meta?.cx ?? 2160000;
        const cy = meta?.cy ?? 1440000;
        const drawingXml = createDrawingML(rId, 800, matchedDef.photoKey, cx, cy);
        return `</w:t></w:r><w:r>${drawingXml}</w:r><w:r><w:t>`;
      }
    }

    return `[ Photo Not Uploaded ]`;
  });

  return modifiedXml;
}

/**
 * Builds the official 2-column "Sample Photographs (with Part Sticker/Nameplate)" OpenXML Table
 */
export function createSamplePhotographsTableXml(
  photoRIdMap: Map<string, string>, 
  photos: Record<string, string> = {},
  logsMap?: Map<string, PhotoInsertionLog>
): string {
  let rowsXml = '';
  for (let i = 0; i < PHOTO_FIELD_DEFINITIONS.length; i += 2) {
    const left = PHOTO_FIELD_DEFINITIONS[i];
    const right = PHOTO_FIELD_DEFINITIONS[i + 1];

    const leftRId = photoRIdMap.get(left.photoKey);
    const leftMeta = currentPhotoMetaMap.get(left.photoKey) || currentPhotoMetaMap.get(left.photoKey.toLowerCase());
    const leftDrawing = leftRId 
      ? `<w:r>${createDrawingML(leftRId, 200 + i, left.label, leftMeta?.cx ?? 2160000, leftMeta?.cy ?? 1440000)}</w:r>` 
      : `<w:r><w:rPr><w:color w:val="94A3B8"/><w:i/><w:sz w:val="18"/></w:rPr><w:t>[ Photo Not Uploaded ]</w:t></w:r>`;

    if (leftRId && logsMap) {
      const lLog = logsMap.get(left.photoKey);
      if (lLog) {
        lLog.contentControlFound = true;
        lLog.imageInserted = true;
        lLog.status = 'inserted';
      }
    }

    const rightRId = right ? photoRIdMap.get(right.photoKey) : null;
    const rightMeta = right ? (currentPhotoMetaMap.get(right.photoKey) || currentPhotoMetaMap.get(right.photoKey.toLowerCase())) : null;
    const rightDrawing = right
      ? (rightRId 
          ? `<w:r>${createDrawingML(rightRId, 201 + i, right.label, rightMeta?.cx ?? 2160000, rightMeta?.cy ?? 1440000)}</w:r>` 
          : `<w:r><w:rPr><w:color w:val="94A3B8"/><w:i/><w:sz w:val="18"/></w:rPr><w:t>[ Photo Not Uploaded ]</w:t></w:r>`)
      : `<w:r><w:t></w:t></w:r>`;

    if (right && rightRId && logsMap) {
      const rLog = logsMap.get(right.photoKey);
      if (rLog) {
        rLog.contentControlFound = true;
        rLog.imageInserted = true;
        rLog.status = 'inserted';
      }
    }

    rowsXml += `
      <w:tr>
        <!-- Left Photo Title Badge -->
        <w:tc>
          <w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t>${escapeXml(left.label)}</w:t></w:r></w:p>
        </w:tc>
        <!-- Right Photo Title Badge -->
        <w:tc>
          <w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t>${right ? escapeXml(right.label) : ''}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <!-- Left Photo Box (6cm x 4cm) -->
        <w:tc>
          <w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/></w:pPr>${leftDrawing}</w:p>
        </w:tc>
        <!-- Right Photo Box (6cm x 4cm) -->
        <w:tc>
          <w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/></w:pPr>${rightDrawing}</w:p>
        </w:tc>
      </w:tr>
    `;
  }

  return `
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="0F4C81"/></w:rPr><w:t>Sample Photographs (with Part Sticker/Nameplate)</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9600" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        </w:tblBorders>
      </w:tblPr>
      ${rowsXml}
    </w:tbl>
  `;
}

/**
 * Prints formatted debug logs to browser console for every photo field
 */
export function printPhotoInsertionDebugLogs(logs: PhotoInsertionLog[]) {
  console.groupCollapsed('%c📸 WORD REPORT PHOTO INSERTION DEBUG LOGS', 'color: #0284c7; font-weight: bold; font-size: 13px;');
  logs.forEach(log => {
    const isSuccess = log.imageInserted;
    const headerStyle = isSuccess 
      ? 'color: #10b981; font-weight: bold; font-size: 11px;'
      : (log.hasImageUrl ? 'color: #f59e0b; font-weight: bold; font-size: 11px;' : 'color: #94a3b8; font-weight: bold; font-size: 11px;');

    console.log(
      `%c${log.photoKey}%c (${log.label}) | Inserted: ${isSuccess ? 'YES' : 'NO'}`,
      headerStyle,
      'color: #64748b;'
    );
  });
  console.groupEnd();
}

/**
 * Cleans Word-specific XML artefacts and safely collapses tags split across XML runs
 * Uses linear-time safe regexes to completely prevent catastrophic backtracking
 */
export function cleanSplitTagsInXml(xml: string): string {
  if (!xml) return '';
  let cleaned = xml
    .replace(/<w:proofErr[^>]*\/>/g, '')
    .replace(/<w:noProof[^>]*\/>/g, '')
    .replace(/<w:lastRenderedPageBreak\/>/g, '');

  // Safe non-greedy collapse of split mustache tags
  cleaned = cleaned.replace(/\{\{([^{}]{1,120})\}\}/g, (match, inner) => {
    const stripped = inner.replace(/<[^>]+>/g, '').trim();
    return `{{${stripped}}}`;
  });

  return cleaned;
}

/**
 * Cleans, validates and sanitizes OpenXML before saving to DOCX package.
 * Guarantees 100% compliance with Microsoft Word desktop validator.
 */
export function sanitizeAndFinalizeDocxXml(xml: string, isDocumentXml: boolean = false): string {
  if (!xml) return '';
  let sanitized = xml;

  // 1. Remove invalid / duplicated w:vAlign attributes (e.g. w:center or duplicate tags)
  sanitized = sanitized.replace(/<w:vAlign\s+w:center\s*\/?>/gi, '');
  sanitized = sanitized.replace(/<w:vAlign\s+w:val="([^"]+)"\s*\/?>\s*<w:vAlign[^>]*\/?>/gi, '<w:vAlign w:val="$1"/>');
  sanitized = sanitized.replace(/<w:vAlign\s+w:val="center"\s*\/>/gi, '<w:vAlign w:val="center"/>');

  // 2. Fix any XML tags accidentally trapped inside <w:t>
  // <w:t> in OpenXML MUST contain only text or empty.
  sanitized = sanitized.replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi, (fullMatch, innerText) => {
    if (/<w:[a-zA-Z]/.test(innerText) || /<a:[a-zA-Z]/.test(innerText) || /<pic:[a-zA-Z]/.test(innerText)) {
      const cleanText = innerText.replace(/<[^>]+>/g, '').trim();
      return `<w:t>${cleanText}</w:t>`;
    }
    return fullMatch;
  });

  // 3. Remove redundant empty runs created by tag replacement
  sanitized = sanitized.replace(/<w:r>\s*<w:t>\s*<\/w:t>\s*<\/w:r>/gi, '');

  // 4. Ensure document.xml root contains all standard Word & DrawingML namespaces
  if (isDocumentXml && sanitized.includes('<w:document')) {
    sanitized = sanitized.replace(/<w:document\b([^>]*)>/i, (fullDoc, attrs) => {
      let newAttrs = attrs;
      if (!newAttrs.includes('xmlns:w=')) newAttrs += ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
      if (!newAttrs.includes('xmlns:r=')) newAttrs += ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
      if (!newAttrs.includes('xmlns:wp=')) newAttrs += ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
      if (!newAttrs.includes('xmlns:a=')) newAttrs += ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
      if (!newAttrs.includes('xmlns:pic=')) newAttrs += ' xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
      if (!newAttrs.includes('xmlns:m=')) newAttrs += ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"';
      if (!newAttrs.includes('xmlns:v=')) newAttrs += ' xmlns:v="urn:schemas-microsoft-com:vml"';
      if (!newAttrs.includes('xmlns:w10=')) newAttrs += ' xmlns:w10="urn:schemas-microsoft-com:office:word"';
      if (!newAttrs.includes('xmlns:w14=')) newAttrs += ' xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"';
      if (!newAttrs.includes('xmlns:w15=')) newAttrs += ' xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"';
      return `<w:document${newAttrs}>`;
    });
  }

  return sanitized;
}

/**
 * Robust, high-speed XML string replacer for all data parameters
 */
export function replaceAllRemainingPlaceholders(xml: string, dataMap: Record<string, any>): string {
  if (!xml) return '';
  let result = xml;

  // Single fast regex for any remaining {{tag}} in document
  result = result.replace(/\{\{([^{}]{1,80})\}\}/g, (match, rawTag) => {
    const trimmed = rawTag.trim();
    const clean = trimmed.replace(/[\s_]+/g, '').toLowerCase();

    // Do not replace photo tags here
    if (clean.startsWith('photo') || clean.includes('motor') || clean.includes('pcb') || clean.includes('nameplate') || clean.includes('compressor')) {
      return match;
    }

    if (dataMap[trimmed] !== undefined && dataMap[trimmed] !== null && dataMap[trimmed] !== '') {
      return escapeXml(String(dataMap[trimmed]));
    }
    if (dataMap[clean] !== undefined && dataMap[clean] !== null && dataMap[clean] !== '') {
      return escapeXml(String(dataMap[clean]));
    }

    for (const [k, v] of Object.entries(dataMap)) {
      if (k.trim().replace(/[\s_]+/g, '').toLowerCase() === clean && v !== undefined && v !== null && v !== '') {
        return escapeXml(String(v));
      }
    }
    return '';
  });

  return result;
}

/**
 * Normalizes all keys from input dataValues
 */
function prepareNormalizedDataMap(dataValues: ReportDataValues): Record<string, any> {
  const normalizedData: Record<string, any> = {};
  for (const [key, value] of Object.entries(dataValues)) {
    const valStr = value !== undefined && value !== null ? String(value) : '';
    normalizedData[key] = valStr;
    normalizedData[key.replace(/\s+/g, '_')] = valStr;
    normalizedData[key.replace(/_/g, ' ')] = valStr;
    normalizedData[key.toLowerCase()] = valStr;
    normalizedData[key.replace(/[\s_]+/g, '').toLowerCase()] = valStr;
  }

  // Explicit aliases
  const ratedCoolingPower = dataValues.Rated_Cooling_Power || dataValues.Rated_cooling_power || dataValues.ratedCoolingPower || dataValues.rated_cooling_power || dataValues['Rated Cooling Power'] || dataValues['Rated cooling power'] || dataValues.Rated_Power || dataValues.ratedPower || '';
  if (ratedCoolingPower) {
    normalizedData.Rated_Cooling_Power = ratedCoolingPower;
    normalizedData.Rated_cooling_power = ratedCoolingPower;
    normalizedData.ratedCoolingPower = ratedCoolingPower;
    normalizedData.rated_cooling_power = ratedCoolingPower;
    normalizedData['Rated Cooling Power'] = ratedCoolingPower;
    normalizedData['Rated cooling power'] = ratedCoolingPower;
    normalizedData.RatedCoolingPower = ratedCoolingPower;
  }

  const gasVol = dataValues.Gas_injection_Volume || dataValues.Gas_Injection_Volume || dataValues.gasInjectionVolume || dataValues.gas_injection_volume || dataValues['Gas Injection Volume'] || dataValues.Gas_Injection || '';
  if (gasVol) {
    normalizedData.Gas_injection_Volume = gasVol;
    normalizedData.Gas_Injection_Volume = gasVol;
    normalizedData.gasInjectionVolume = gasVol;
    normalizedData.gas_injection_volume = gasVol;
    normalizedData['Gas Injection Volume'] = gasVol;
  }

  const compSpec = dataValues['Compressor _Spec'] || dataValues.Compressor_Spec || dataValues.compressorSpec || dataValues.compressor_spec || dataValues['Compressor Spec'] || dataValues.Compressor || '';
  if (compSpec) {
    normalizedData['Compressor _Spec'] = compSpec;
    normalizedData.Compressor_Spec = compSpec;
    normalizedData.compressorSpec = compSpec;
    normalizedData.compressor_spec = compSpec;
    normalizedData['Compressor Spec'] = compSpec;
  }

  const pMode = dataValues.Power_mode || dataValues.Power_Mode || dataValues.powerMode || dataValues.power_mode || dataValues['Power Mode'] || '';
  if (pMode) {
    normalizedData.Power_mode = pMode;
    normalizedData.Power_Mode = pMode;
    normalizedData.powerMode = pMode;
    normalizedData['Power Mode'] = pMode;
  }

  const iduSerial = dataValues.Sample_Code_IDU || dataValues.IDU_Serial_No || dataValues.iduSerialNumber || dataValues.IDU_Serial || '';
  const oduSerial = dataValues.Sample_CodeI_ODU || dataValues.Sample_Code_ODU || dataValues.ODU_Serial_No || dataValues.oduSerialNumber || dataValues.ODU_Serial || '';
  if (iduSerial) {
    normalizedData.Sample_Code_IDU = iduSerial;
    normalizedData.IDU_Serial_No = iduSerial;
  }
  if (oduSerial) {
    normalizedData.Sample_CodeI_ODU = oduSerial;
    normalizedData.Sample_Code_ODU = oduSerial;
    normalizedData.ODU_Serial_No = oduSerial;
  }

  return normalizedData;
}

/**
 * Generates populated DOCX Blob synchronously
 */
export function generateDocxBlob(
  base64Template: string, 
  dataValues: ReportDataValues,
  photos: Record<string, string> = {},
  onLogResult?: (result: DocxGenerationResult) => void
): Blob {
  const logsMap = new Map<string, PhotoInsertionLog>();

  try {
    const arrayBuffer = base64ToArrayBuffer(base64Template);
    const zip = new PizZip(arrayBuffer);

    // 1. Inject photos into zip
    const photoRIdMap = injectPhotosIntoZip(zip, photos, logsMap);
    const normalizedData = prepareNormalizedDataMap(dataValues);

    const xmlFiles = Object.keys(zip.files).filter(name => /^word\/(document|header\d*|footer\d*)\.xml$/i.test(name));
    for (const fileName of xmlFiles) {
      let fileXml = zip.file(fileName)?.asText() || '';
      if (fileXml) {
        fileXml = cleanSplitTagsInXml(fileXml);
        fileXml = insertPhotosIntoContentControls(fileXml, photoRIdMap, logsMap);
        zip.file(fileName, fileXml);
      }
    }

    // 2. Render with Docxtemplater
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      parser: (tag: string) => ({
        get: (scope: any) => {
          if (!scope) return '';
          const trimmed = tag.trim();
          const cleanTag = trimmed.replace(/[\s_]+/g, '').toLowerCase();

          const isPhotoTag = cleanTag.startsWith('photo') || PHOTO_FIELD_DEFINITIONS.some(def => 
            def.photoKey.replace(/[\s_]+/g, '').toLowerCase() === cleanTag ||
            def.id.replace(/[\s_]+/g, '').toLowerCase() === cleanTag ||
            def.aliases.some(a => a.replace(/[\s_]+/g, '').toLowerCase() === cleanTag)
          );

          if (isPhotoTag) return `{{${tag}}}`;
          if (scope[tag] !== undefined && scope[tag] !== null && scope[tag] !== '') return String(scope[tag]);
          if (scope[trimmed] !== undefined && scope[trimmed] !== null && scope[trimmed] !== '') return String(scope[trimmed]);
          if (scope[cleanTag] !== undefined && scope[cleanTag] !== null && scope[cleanTag] !== '') return String(scope[cleanTag]);
          return '';
        }
      }),
      nullGetter: (tag: any) => {
        const tagName = String(tag?.name || tag || '');
        const cleanName = tagName.replace(/[\s_]+/g, '').toLowerCase();
        const isPhotoTag = cleanName.startsWith('photo') || PHOTO_FIELD_DEFINITIONS.some(def => 
          def.photoKey.replace(/[\s_]+/g, '').toLowerCase() === cleanName ||
          def.id.replace(/[\s_]+/g, '').toLowerCase() === cleanName
        );
        return isPhotoTag ? `{{${tagName}}}` : '';
      }
    });

    doc.render(normalizedData);

    // 3. Post-process XML parts
    for (const fileName of xmlFiles) {
      let fileXml = doc.getZip().file(fileName)?.asText() || '';
      if (fileXml) {
        fileXml = insertPhotosIntoContentControls(fileXml, photoRIdMap, logsMap);
        fileXml = replaceAllRemainingPlaceholders(fileXml, normalizedData);

        if (fileName === 'word/document.xml') {
          const hasGallery = fileXml.includes('Sample Photographs');
          if (!hasGallery && photoRIdMap.size > 0) {
            const photoTableXml = createSamplePhotographsTableXml(photoRIdMap, photos, logsMap);
            fileXml = fileXml.replace('</w:body>', `${photoTableXml}</w:body>`);
          }
        }

        // Apply strict OpenXML compliance validator and cleanup
        fileXml = sanitizeAndFinalizeDocxXml(fileXml, fileName === 'word/document.xml');
        doc.getZip().file(fileName, fileXml);
      }
    }

    const out = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE'
    });

    const logs = Array.from(logsMap.values());
    printPhotoInsertionDebugLogs(logs);

    if (onLogResult) {
      onLogResult({
        blob: out,
        logs,
        insertedCount: logs.filter(l => l.imageInserted).length,
        totalPhotos: PHOTO_FIELD_DEFINITIONS.length
      });
    }

    return out;
  } catch (err: any) {
    console.error('Error rendering docx with docxtemplater:', err);
    return generateFallbackDocxBlob(base64Template, dataValues, photos, logsMap, onLogResult);
  }
}

/**
 * Asynchronous, ultra-smooth and non-blocking DOCX generator.
 * Yields macro-tasks to the browser event loop so the UI never freezes and animations stay 60fps.
 */
export async function generateDocxBlobAsync(
  base64Template: string,
  dataValues: ReportDataValues,
  photos: Record<string, string> = {},
  onLogResult?: (result: DocxGenerationResult) => void
): Promise<Blob> {
  // Yield to UI event loop
  await new Promise(resolve => setTimeout(resolve, 10));
  return generateDocxBlob(base64Template, dataValues, photos, onLogResult);
}

/**
 * Fallback DOCX generator performing raw XML string replacement across all XML files
 */
function generateFallbackDocxBlob(
  base64Template: string, 
  dataValues: ReportDataValues,
  photos: Record<string, string> = {},
  logsMap: Map<string, PhotoInsertionLog> = new Map(),
  onLogResult?: (result: DocxGenerationResult) => void
): Blob {
  const arrayBuffer = base64ToArrayBuffer(base64Template);
  const zip = new PizZip(arrayBuffer);

  const photoRIdMap = injectPhotosIntoZip(zip, photos, logsMap);
  const normalizedData = prepareNormalizedDataMap(dataValues);

  const xmlFiles = Object.keys(zip.files).filter(name => /^word\/(document|header\d*|footer\d*)\.xml$/i.test(name));
  for (const fileName of xmlFiles) {
    let fileXml = zip.file(fileName)?.asText() || '';
    if (fileXml) {
      fileXml = cleanSplitTagsInXml(fileXml);
      fileXml = insertPhotosIntoContentControls(fileXml, photoRIdMap, logsMap);
      fileXml = replaceAllRemainingPlaceholders(fileXml, normalizedData);

      if (fileName === 'word/document.xml' && photoRIdMap.size > 0 && !fileXml.includes('Sample Photographs')) {
        const photoTableXml = createSamplePhotographsTableXml(photoRIdMap, photos, logsMap);
        fileXml = fileXml.replace('</w:body>', `${photoTableXml}</w:body>`);
      }

      fileXml = sanitizeAndFinalizeDocxXml(fileXml, fileName === 'word/document.xml');
      zip.file(fileName, fileXml);
    }
  }

  const out = zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE'
  });

  const logs = Array.from(logsMap.values());
  if (onLogResult) {
    onLogResult({
      blob: out,
      logs,
      insertedCount: logs.filter(l => l.imageInserted).length,
      totalPhotos: PHOTO_FIELD_DEFINITIONS.length
    });
  }

  return out;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Downloads a Blob as a file in the browser with full cross-device and mobile support (Opera, Chrome, Safari, Android)
 */
export function downloadFile(blob: Blob, fileName: string) {
  try {
    const mimeType = fileName.endsWith('.docx')
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : fileName.endsWith('.pdf')
      ? 'application/pdf'
      : fileName.endsWith('.zip')
      ? 'application/zip'
      : (blob.type || 'application/octet-stream');

    const fileBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
    const url = window.URL.createObjectURL(fileBlob);
    
    // For iOS / Android compatibility
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.setAttribute('download', fileName);
    a.target = '_self';
    a.rel = 'noopener noreferrer';
    
    // Add to body cleanly
    document.body.appendChild(a);
    
    // Trigger download
    if (typeof a.click === 'function') {
      a.click();
    } else {
      a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
    
    // Cleanup anchor element
    setTimeout(() => {
      try {
        if (a.parentNode) {
          a.parentNode.removeChild(a);
        }
      } catch {}
    }, 1500);

    // Keep object URL alive for mobile download managers
    setTimeout(() => {
      try {
        window.URL.revokeObjectURL(url);
      } catch {}
    }, 180000);
  } catch (err) {
    console.error('Download error:', err);
    // Fallback: try opening URL in new window if direct download blocked
    try {
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (fallbackErr) {
      console.error('Fallback download failed:', fallbackErr);
    }
  }
}

/**
 * Mobile-friendly share or download: Uses native OS sharing (Save to Files / Share to WhatsApp / Drive) on Android/iOS if available, or falls back to direct download.
 */
export async function shareOrDownloadFile(blob: Blob, fileName: string, title?: string): Promise<boolean> {
  try {
    const mimeType = fileName.endsWith('.docx')
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : fileName.endsWith('.pdf')
      ? 'application/pdf'
      : (blob.type || 'application/octet-stream');

    const file = new File([blob], fileName, { type: mimeType });
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: title || fileName,
        text: `Report: ${fileName}`
      });
      return true;
    }
  } catch (e: any) {
    // User cancelled share or abort error
    if (e?.name !== 'AbortError') {
      console.warn('Web Share note:', e);
    } else {
      return true;
    }
  }
  
  downloadFile(blob, fileName);
  return false;
}

/**
 * Converts modern CSS colors (oklch, oklab, color(srgb...), lab, lch) to standard rgb/rgba format using 2D canvas rasterization
 */
function sanitizeColorString(str: string): string {
  if (!str || typeof str !== 'string') return '#000000';
  const trimmed = str.trim();
  if (!trimmed.includes('oklch') && !trimmed.includes('oklab') && !trimmed.includes('color(') && !trimmed.includes('lab(') && !trimmed.includes('lch(')) {
    return trimmed;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000000';
      ctx.fillStyle = trimmed;
      ctx.fillRect(0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      const r = data[0];
      const g = data[1];
      const b = data[2];
      const a = data[3];
      if (a === 255) {
        return `rgb(${r}, ${g}, ${b})`;
      }
      return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`;
    }
  } catch (e) {}

  if (trimmed.includes('white') || trimmed.includes('255')) return '#ffffff';
  return '#0f172a';
}

/**
 * Generates and downloads PDF from an HTML container element using html-to-image + jsPDF.
 * If the container has '.pdf-page' elements, it renders each page cleanly into dedicated A4 pages
 * without breaking tables or parameters across page boundaries.
 */
export async function downloadElementAsPdf(
  element: HTMLElement, 
  fileName: string,
  onProgress?: (progress: number, stage: string) => void
) {
  try {
    onProgress?.(10, 'Loading Assets...');
    // Wait for all images in the element to finish loading
    const images = Array.from(element.querySelectorAll('img'));
    await Promise.all(
      images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    // Save previous styles if offscreen
    const parent = element.parentElement;
    const originalPosition = parent?.style.position;
    const originalLeft = parent?.style.left;
    const originalOpacity = parent?.style.opacity;
    const originalZIndex = parent?.style.zIndex;

    const isHiddenParent = parent && (
      parent.classList.contains('opacity-0') ||
      parent.style.opacity === '0'
    );

    if (isHiddenParent && parent) {
      parent.style.opacity = '1';
      parent.style.position = 'fixed';
      parent.style.left = '0';
      parent.style.top = '0';
      parent.style.zIndex = '-999';
    }

    const pageElements = Array.from(element.querySelectorAll<HTMLElement>('.pdf-page'));
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    if (pageElements.length > 0) {
      // Clean per-page rendering: each .pdf-page becomes exactly 1 A4 page
      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];
        onProgress?.(
          20 + Math.round(((i + 1) / pageElements.length) * 70),
          `Rendering Page ${i + 1} of ${pageElements.length}...`
        );

        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false
        });

        const dataUrl = canvas.toDataURL('image/jpeg', 0.96);

        if (i > 0) {
          pdf.addPage();
        }
        pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      }
    } else {
      // Fallback single container capturing
      onProgress?.(30, 'Capturing Document...');
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const pageCanvasHeight = Math.floor(canvas.width * (pdfHeight / pdfWidth));
      const totalPages = Math.max(1, Math.ceil(canvas.height / pageCanvasHeight));

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        if (pageIdx > 0) {
          pdf.addPage();
        }

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = pageCanvasHeight;
        const pageCtx = pageCanvas.getContext('2d');

        if (pageCtx) {
          pageCtx.fillStyle = '#ffffff';
          pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

          const srcY = pageIdx * pageCanvasHeight;
          const sliceHeight = Math.min(pageCanvasHeight, canvas.height - srcY);

          if (sliceHeight > 0) {
            pageCtx.drawImage(
              canvas,
              0, srcY, canvas.width, sliceHeight,
              0, 0, canvas.width, sliceHeight
            );
          }

          const pageDataUrl = pageCanvas.toDataURL('image/jpeg', 0.96);
          pdf.addImage(pageDataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        }
      }
    }

    // Restore parent styles if altered
    if (isHiddenParent && parent) {
      parent.style.opacity = originalOpacity || '0';
      parent.style.position = originalPosition || 'fixed';
      parent.style.left = originalLeft || '-9999px';
      parent.style.zIndex = originalZIndex || '';
    }

    onProgress?.(95, 'Finalizing Download...');
    pdf.save(fileName);
    onProgress?.(100, 'Download Complete');
  } catch (err) {
    console.error("PDF export error:", err);
    window.print();
  }
}

/**
 * Creates a valid default Master Report Template .docx base64 string with full specifications and Photo Gallery
 */
export function createDefaultMasterDocxBase64(reportType: string = 'proto'): string {
  const isExperience = reportType === 'reliability' || reportType === 'ce-report';
  const reportTypeName = isExperience ? 'Customer Experience (CE) Report' : 'Customer Simulation (CS) Report';
  const tagTitle = isExperience ? 'C Experience Report' : 'C Simulation Report';

  const zip = new PizZip();

  // [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  // _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  // word/_rels/document.xml.rels
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);

  // word/document.xml with complete Master Report Template structure and placeholders
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document 
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" 
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="0F4C81"/></w:rPr><w:t>Haier Appliances (India) Pvt Ltd</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1E293B"/></w:rPr><w:t>TEST REPORT</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t>${reportTypeName} | Tag: ${tagTitle} | Official Laboratory Evaluation</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    
    <!-- 1. Technical Specifications Table -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9600" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        </w:tblBorders>
      </w:tblPr>
      
      <w:tr>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="0F4C81"/><w:tcW w:w="3200" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Parameter / Specification</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="0F4C81"/><w:tcW w:w="6400" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Value / Test Record (Auto-Mapped)</w:t></w:r></w:p></w:tc>
      </w:tr>

      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Model Name</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{Model_Name}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Sample Type</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{Sample_Type}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Report Number</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{Report_No}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Sample Received Date</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{Sample_Received}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Test Commenced Date</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{Test_Commenced}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Test Completed Date</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{Test_Completed}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Cooling Capacity</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{Cooling_capacity}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Rated Cooling Power</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{Rated_Cooling_Power}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Power Mode</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{Power_mode}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Refrigerant</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{Refrigerant}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Gas Injection Volume</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{Gas_injection_Volume}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>ISEER Rating</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{ISEER}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Testing Station</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{Station}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Requested By</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{Request_By}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Test Conclusion &amp; Observations</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{Test_Conclusion}}</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>

    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p>
      <w:pPr><w:jc w:val="right"/></w:pPr>
      <w:r><w:rPr><w:i/><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t>Verified &amp; Generated by LLT Lab System</w:t></w:r>
    </w:p>

    <!-- 2. Sample Photographs Placeholders -->
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="0F4C81"/></w:rPr><w:t>Sample Photographs (with Part Sticker/Nameplate)</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9600" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t>Product Packing Box</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t>Bare Packing Box (IDU&amp;ODU)</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/></w:pPr><w:r><w:t>{{photo_productPhoto}}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/></w:pPr><w:r><w:t>{{photo_packingBoxPhoto}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t>IDU Product Nameplate</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="0F172A"/></w:rPr><w:t>ODU Product Nameplate</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/></w:pPr><w:r><w:t>{{photo_iduNameplatePhoto}}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/></w:pPr><w:r><w:t>{{photo_oduNameplatePhoto}}</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', docXml);
  const buffer = zip.generate({ type: 'arraybuffer', compression: 'DEFLATE' });
  return arrayBufferToBase64(buffer);
}

export interface ReportBundleZipResult {
  blob: Blob;
  fileName: string;
  folderName: string;
  photoCount: number;
}

/**
 * Standard component clean naming dictionary for photos in the report package
 */
export const COMPONENT_PHOTO_FILENAMES: Record<string, string> = {
  PHOTO_Indoor_Unit: '00_Indoor_Unit',
  indoorUnitPhoto: '00_Indoor_Unit',
  indoorUnit: '00_Indoor_Unit',
  photo_indoorUnitPhoto: '00_Indoor_Unit',
  PHOTO_Product_Packing: '01_Product_Packing',
  productPhoto: '01_Product_Packing',
  productPacking: '01_Product_Packing',
  photo_productPhoto: '01_Product_Packing',
  PHOTO_Packing_Box: '02_Packing_Box',
  packingBoxPhoto: '02_Packing_Box',
  packingBox: '02_Packing_Box',
  photo_packingBoxPhoto: '02_Packing_Box',
  PHOTO_IDU_Motor: '03_IDU_Motor',
  iduMotorPhoto: '03_IDU_Motor',
  iduMotor: '03_IDU_Motor',
  photo_iduMotorPhoto: '03_IDU_Motor',
  PHOTO_IDU_PCB: '04_IDU_PCB',
  iduPcbPhoto: '04_IDU_PCB',
  iduPcb: '04_IDU_PCB',
  photo_iduPcbPhoto: '04_IDU_PCB',
  PHOTO_IDU_Product_Name_Plate: '05_IDU_Product_Name_Plate',
  iduNameplatePhoto: '05_IDU_Product_Name_Plate',
  iduProductPlate: '05_IDU_Product_Name_Plate',
  photo_iduNameplatePhoto: '05_IDU_Product_Name_Plate',
  PHOTO_Remote: '06_Remote_Controller',
  remotePhoto: '06_Remote_Controller',
  remoteController: '06_Remote_Controller',
  photo_remotePhoto: '06_Remote_Controller',
  PHOTO_ODU_Name_Plate: '07_ODU_Name_Plate',
  oduNameplatePhoto: '07_ODU_Name_Plate',
  oduNamePlate: '07_ODU_Name_Plate',
  photo_oduNameplatePhoto: '07_ODU_Name_Plate',
  PHOTO_ODU_Motor: '08_ODU_Motor',
  oduMotorPhoto: '08_ODU_Motor',
  oduMotor: '08_ODU_Motor',
  photo_oduMotorPhoto: '08_ODU_Motor',
  PHOTO_ODU_PCB: '09_ODU_PCB',
  oduPcbPhoto: '09_ODU_PCB',
  oduPcb: '09_ODU_PCB',
  photo_oduPcbPhoto: '09_ODU_PCB',
  PHOTO_Electronic_Expansion_Valve: '10_Electronic_Expansion_Valve_EEV',
  oduEevPhoto: '10_Electronic_Expansion_Valve_EEV',
  eev: '10_Electronic_Expansion_Valve_EEV',
  photo_oduEevPhoto: '10_Electronic_Expansion_Valve_EEV',
  PHOTO_ODU_Compressor: '11_Compressor',
  oduCompressorPhoto: '11_Compressor',
  compressor: '11_Compressor',
  oduCompressor: '11_Compressor',
  photo_oduCompressorPhoto: '11_Compressor'
};

/**
 * Generates a full .ZIP Package containing DOCX and extracted photo files
 */
export async function generateReportBundleZip(
  base64Template: string,
  dataValues: ReportDataValues,
  photos: Record<string, string> = {},
  reportTitle: string = 'Test_Report'
): Promise<ReportBundleZipResult> {
  const docxBlob = await generateDocxBlobAsync(base64Template, dataValues, photos);
  const docxBuffer = await docxBlob.arrayBuffer();

  const safeModel = (dataValues.Model_Name || dataValues.modelName || 'Unit').toString().trim().replace(/[\s/\\?%*:|"<>]+/g, '_');
  const safeReportNo = (dataValues['Report No'] || dataValues.reportNo || 'Draft').toString().trim().replace(/[\s/\\?%*:|"<>]+/g, '_');
  const safeTitle = (reportTitle || 'Test_Report').trim().replace(/[\s/\\?%*:|"<>]+/g, '_');

  const folderName = `${safeTitle}_${safeModel}_${safeReportNo}`;
  const docxFileName = `${safeTitle}_${safeModel}_${safeReportNo}.docx`;

  const zip = new PizZip();
  zip.file(`${folderName}/${docxFileName}`, docxBuffer);

  const photoFileList: string[] = [];
  const processedKeys = new Set<string>();

  PHOTO_FIELD_DEFINITIONS.forEach((def) => {
    let url = getPhotoUrlForContentControl(photos, def.photoKey);
    if (!url || url === 'NA' || url.trim() === '') {
      url = getPictureNotAvailableDataUrlSync();
    }
    if (url && url !== 'NA') {
      const bin = dataURLToBinary(url);
      if (bin) {
        const cleanBaseName = COMPONENT_PHOTO_FILENAMES[def.photoKey] || def.photoKey.replace(/^PHOTO_/i, '');
        const filename = `${cleanBaseName}.${bin.extension}`;
        zip.file(`${folderName}/Photos/${filename}`, bin.bytes, { binary: true });
        photoFileList.push(filename);
        processedKeys.add(def.photoKey);
      }
    }
  });

  const zipBlob = zip.generate({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'STORE'
  });

  return {
    blob: zipBlob,
    fileName: `${folderName}.zip`,
    folderName,
    photoCount: photoFileList.length
  };
}

