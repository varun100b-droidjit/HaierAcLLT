/**
 * Standard Photo Field Mapping and Management Module
 * Maps UI Photo inputs to Word Report Picture Content Controls and handles storage/retrieval.
 */
import { PICTURE_NOT_AVAILABLE_IMAGE, isPhotoMissing } from './placeholderImage';

export type ReportSectionCategory = 'packaging' | 'idu' | 'odu' | 'refrigeration';

export interface PhotoSectionInfo {
  id: ReportSectionCategory;
  title: string;
  page: string;
  description: string;
}

export const REPORT_PHOTO_SECTIONS: Record<ReportSectionCategory, PhotoSectionInfo> = {
  packaging: {
    id: 'packaging',
    title: 'Packaging & Unboxing',
    page: 'Page 4: Top Section',
    description: 'Unit appearance, packaging integrity & carton markings'
  },
  idu: {
    id: 'idu',
    title: 'Indoor Unit (IDU) Assembly',
    page: 'Page 4: Bottom Section',
    description: 'Internal electronics, motor & indoor nameplate specification'
  },
  odu: {
    id: 'odu',
    title: 'Outdoor Unit (ODU) Assembly',
    page: 'Page 5: Top Section',
    description: 'Compressor compartment, outdoor PCB & rating plate'
  },
  refrigeration: {
    id: 'refrigeration',
    title: 'Refrigeration & Valve Circuit',
    page: 'Page 5: Bottom Section',
    description: 'Expansion valve, refrigerant piping & compressor assembly'
  }
};

export interface PhotoDefinition {
  id: string; // internal camelCase key
  photoKey: string; // Word Picture Content Control tag/alias (e.g. "PHOTO_Product_Packing")
  label: string; // UI Display label
  section: ReportSectionCategory; // Document section grouping
  documentPage: string; // Location in official DOCX report
  aliases: string[]; // Variations for fuzzy matching
}

export const PHOTO_FIELD_DEFINITIONS: PhotoDefinition[] = [
  {
    id: 'indoorUnitPhoto',
    photoKey: 'PHOTO_Indoor_Unit',
    label: 'Indoor Unit',
    section: 'packaging',
    documentPage: 'Page 4',
    aliases: [
      'PHOTO_Indoor_Unit',
      'PHOTO_INDOOR_UNIT',
      'indoorUnitPhoto',
      'photo_indoorUnitPhoto',
      'Indoor Unit',
      'Indoor Unit Photo',
      'Indoor_Unit',
      'indoor_unit',
      'photo_indoor_unit',
      'iduUnitPhoto',
      'indoorPhoto',
      'PHOTO_IDU_Unit',
      'IDU Unit'
    ]
  },
  {
    id: 'productPhoto',
    photoKey: 'PHOTO_Product_Packing',
    label: 'Product Packing',
    section: 'packaging',
    documentPage: 'Page 4',
    aliases: [
      'PHOTO_Product_Packing',
      'PHOTO_PRODUCT_PACKING',
      'productPhoto',
      'photo_productPhoto',
      'Product Photo',
      'Product Packing',
      'Product Packing Box',
      'Product_Packing_Box',
      'product_packing_box',
      'photo_product_packing_box',
      'photo_productPacking',
      'Product_Packing',
      'PHOTO_Product_Packing_Box',
      'PHOTO_PRODUCT_PACKING_BOX'
    ]
  },
  {
    id: 'packingBoxPhoto',
    photoKey: 'PHOTO_Packing_Box',
    label: 'Packing Box',
    section: 'packaging',
    documentPage: 'Page 4',
    aliases: [
      'PHOTO_Packing_Box',
      'PHOTO_PACKING_BOX',
      'packingBoxPhoto',
      'photo_packingBoxPhoto',
      'Packing Box',
      'Bare Packing Box',
      'Bare_Packing_Box',
      'bare_packing_box',
      'Bare Packing Box (IDU&ODU)',
      'Bare Packing Box (IDU & ODU)',
      'Bare_Packing_Box_IDU_ODU',
      'PHOTO_Bare_Packing_Box',
      'photo_barePacking',
      'Bare Packing Box (IDU&ODU)'
    ]
  },
  {
    id: 'iduMotorPhoto',
    photoKey: 'PHOTO_IDU_Motor',
    label: 'IDU Motor',
    section: 'idu',
    documentPage: 'Page 4',
    aliases: [
      'PHOTO_IDU_Motor',
      'PHOTO_IDU_MOTOR',
      'iduMotorPhoto',
      'motorPhoto',
      'photo_motorPhoto',
      'photo_iduMotorPhoto',
      'IDU Motor',
      'IDU_Motor',
      'idu_motor',
      'photo_iduMotor',
      'IDU Motor Photo',
      'PHOTO_IDU_Motor_Spec'
    ]
  },
  {
    id: 'iduPcbPhoto',
    photoKey: 'PHOTO_IDU_PCB',
    label: 'IDU PCB',
    section: 'idu',
    documentPage: 'Page 4',
    aliases: [
      'PHOTO_IDU_PCB',
      'PHOTO_IDU_Pcb',
      'iduPcbPhoto',
      'photo_iduPcbPhoto',
      'IDU PCB',
      'IDU_PCB',
      'idu_pcb',
      'photo_iduPcb',
      'IDU PCB Photo',
      'IDU Inverter PCB'
    ]
  },
  {
    id: 'iduNameplatePhoto',
    photoKey: 'PHOTO_IDU_Product_Name_Plate',
    label: 'IDU Product Name Plate',
    section: 'idu',
    documentPage: 'Page 4',
    aliases: [
      'PHOTO_IDU_Product_Name_Plate',
      'PHOTO_IDU_PRODUCT_NAME_PLATE',
      'PHOTO_IDU_Name_Plate',
      'PHOTO_IDU_NAME_PLATE',
      'iduNameplatePhoto',
      'photo_iduNameplatePhoto',
      'IDU Nameplate',
      'IDU Product Nameplate',
      'IDU_Product_Nameplate',
      'IDU_Nameplate',
      'IDU_Product_Name_Plate',
      'idu_product_nameplate',
      'photo_iduNameplate'
    ]
  },
  {
    id: 'remotePhoto',
    photoKey: 'PHOTO_Remote',
    label: 'Remote',
    section: 'idu',
    documentPage: 'Page 4',
    aliases: [
      'PHOTO_Remote',
      'PHOTO_REMOTE',
      'remotePhoto',
      'stickerPhoto',
      'photo_stickerPhoto',
      'photo_remotePhoto',
      'Remote',
      'remote',
      'photo_remote',
      'Extra Sticker',
      'Sticker / Remote',
      'PHOTO_Sticker',
      'Remote Controller'
    ]
  },
  {
    id: 'oduNameplatePhoto',
    photoKey: 'PHOTO_ODU_Name_Plate',
    label: 'ODU Name Plate',
    section: 'odu',
    documentPage: 'Page 5',
    aliases: [
      'PHOTO_ODU_Name_Plate',
      'PHOTO_ODU_NAME_PLATE',
      'oduNameplatePhoto',
      'photo_oduNameplatePhoto',
      'ODU Nameplate',
      'ODU Product Nameplate',
      'ODU_Product_Nameplate',
      'ODU_Nameplate',
      'ODU_Product_Name_Plate',
      'odu_product_nameplate',
      'photo_oduNameplate'
    ]
  },
  {
    id: 'oduMotorPhoto',
    photoKey: 'PHOTO_ODU_Motor',
    label: 'ODU Motor',
    section: 'odu',
    documentPage: 'Page 5',
    aliases: [
      'PHOTO_ODU_Motor',
      'PHOTO_ODU_MOTOR',
      'oduMotorPhoto',
      'photo_oduMotorPhoto',
      'ODU Motor',
      'ODU_Motor',
      'odu_motor',
      'photo_oduMotor',
      'ODU Motor Photo',
      'ODU Fan Motor'
    ]
  },
  {
    id: 'oduPcbPhoto',
    photoKey: 'PHOTO_ODU_PCB',
    label: 'ODU PCB',
    section: 'odu',
    documentPage: 'Page 5',
    aliases: [
      'PHOTO_ODU_PCB',
      'PHOTO_ODU_Pcb',
      'oduPcbPhoto',
      'photo_oduPcbPhoto',
      'ODU PCB',
      'ODU_PCB',
      'odu_pcb',
      'photo_oduPcb',
      'ODU PCB Photo',
      'ODU Inverter PCB'
    ]
  },
  {
    id: 'oduEevPhoto',
    photoKey: 'PHOTO_Electronic_Expansion_Valve',
    label: 'Electronic Expansion Valve',
    section: 'refrigeration',
    documentPage: 'Page 5',
    aliases: [
      'PHOTO_Electronic_Expansion_Valve',
      'PHOTO_ELECTRONIC_EXPANSION_VALVE',
      'PHOTO_EEV',
      'PHOTO_Eev',
      'oduEevPhoto',
      'eevPhoto',
      'photo_eevPhoto',
      'photo_oduEevPhoto',
      'EEV',
      'ODU EEV',
      'ODU_EEV',
      'Electronic Expansion Valve',
      'Electronic_Expansion_Valve',
      'Electronic Expansion Valve (EEV)',
      'photo_eev'
    ]
  },
  {
    id: 'oduCompressorPhoto',
    photoKey: 'PHOTO_ODU_Compressor',
    label: 'ODU Compressor',
    section: 'refrigeration',
    documentPage: 'Page 5',
    aliases: [
      'PHOTO_ODU_Compressor',
      'PHOTO_ODU_COMPRESSOR',
      'PHOTO_Compressor',
      'PHOTO_COMPRESSOR',
      'oduCompressorPhoto',
      'compressorPhoto',
      'photo_compressorPhoto',
      'photo_oduCompressorPhoto',
      'Compressor',
      'compressor',
      'ODU Compressor',
      'ODU_Compressor',
      'Rotary Compressor',
      'photo_compressor'
    ]
  }
];

export interface PhotoInsertionLog {
  photoKey: string;
  label: string;
  foundInDatabase: boolean;
  hasImageUrl: boolean;
  imageDownloaded: boolean;
  contentControlFound: boolean;
  imageInserted: boolean;
  status: 'inserted' | 'missing' | 'error';
  details?: string;
}

/**
 * Builds normalized photos object and photoRecords array from any key-value photo input
 */
export function buildNormalizedPhotos(rawPhotos: Record<string, string | undefined> = {}) {
  const normalized: Record<string, string> = {};
  const photoRecords: { photoKey: string; photoUrl: string; label: string }[] = [];

  PHOTO_FIELD_DEFINITIONS.forEach(def => {
    // Look up by exact photoKey, by id, or by aliases
    let foundUrl = '';
    if (rawPhotos[def.photoKey] && typeof rawPhotos[def.photoKey] === 'string' && rawPhotos[def.photoKey].trim() !== '' && rawPhotos[def.photoKey] !== 'NA') {
      foundUrl = rawPhotos[def.photoKey]!.trim();
    } else if (rawPhotos[def.id] && typeof rawPhotos[def.id] === 'string' && rawPhotos[def.id].trim() !== '' && rawPhotos[def.id] !== 'NA') {
      foundUrl = rawPhotos[def.id]!.trim();
    } else {
      for (const alias of def.aliases) {
        if (rawPhotos[alias] && typeof rawPhotos[alias] === 'string' && rawPhotos[alias].trim() !== '' && rawPhotos[alias] !== 'NA') {
          foundUrl = rawPhotos[alias]!.trim();
          break;
        }
      }
    }

    if (foundUrl) {
      normalized[def.id] = foundUrl;
      normalized[def.photoKey] = foundUrl;
      photoRecords.push({
        photoKey: def.photoKey,
        photoUrl: foundUrl,
        label: def.label
      });
    }
  });

  return {
    photos: {
      ...rawPhotos,
      ...normalized,
    } as Record<string, string>,
    photoRecords
  };
}

/**
 * Retrieves the image URL from a photos object for a specific Picture Content Control key.
 * Always prioritizes genuine uploaded photos over placeholders.
 */
export function getPhotoUrlForContentControl(photos: any, searchKey: string): string | null {
  if (!photos || typeof photos !== 'object') return null;

  const cleanSearch = searchKey.trim().replace(/[\s_]+/g, '').toLowerCase();

  // Find corresponding definition
  const matchedDef = PHOTO_FIELD_DEFINITIONS.find(def =>
    def.photoKey.toLowerCase() === searchKey.toLowerCase() ||
    def.id.toLowerCase() === searchKey.toLowerCase() ||
    def.photoKey.replace(/[\s_]+/g, '').toLowerCase() === cleanSearch ||
    def.id.replace(/[\s_]+/g, '').toLowerCase() === cleanSearch ||
    def.aliases.some(a => a.toLowerCase() === searchKey.toLowerCase() || a.replace(/[\s_]+/g, '').toLowerCase() === cleanSearch)
  );

  // Collect candidate keys in order of preference
  const candidateKeys: string[] = [searchKey];
  if (matchedDef) {
    candidateKeys.push(matchedDef.photoKey, matchedDef.id, ...matchedDef.aliases, matchedDef.label);
  }

  // 1. First Pass: Check in photoRecords array for genuine photo
  if (Array.isArray(photos.photoRecords)) {
    const rec = photos.photoRecords.find(
      (r: any) => (r.photoKey === searchKey || r.photoKey?.toLowerCase() === searchKey.toLowerCase() || candidateKeys.includes(r.photoKey)) &&
        typeof r.photoUrl === 'string' && !isPhotoMissing(r.photoUrl)
    );
    if (rec && rec.photoUrl) {
      return rec.photoUrl.trim();
    }
  }

  // 2. Second Pass: Check candidate keys for a genuine non-placeholder photo
  for (const k of candidateKeys) {
    const val = photos[k];
    if (typeof val === 'string' && !isPhotoMissing(val)) {
      return val.trim();
    }
  }

  // 3. Third Pass: Check stripped/case-insensitive keys across entire photos object for genuine photo
  for (const [k, v] of Object.entries(photos)) {
    if (typeof v !== 'string' || isPhotoMissing(v)) continue;
    const cleanK = k.replace(/[\s_]+/g, '').toLowerCase();
    if (cleanK === cleanSearch || (matchedDef && (
      cleanK === matchedDef.photoKey.replace(/[\s_]+/g, '').toLowerCase() ||
      cleanK === matchedDef.id.replace(/[\s_]+/g, '').toLowerCase() ||
      matchedDef.aliases.some(a => a.replace(/[\s_]+/g, '').toLowerCase() === cleanK)
    ))) {
      return v.trim();
    }
  }

  // 4. Fourth Pass: If no genuine photo was found, check if a placeholder exists under candidate keys
  for (const k of candidateKeys) {
    const val = photos[k];
    if (typeof val === 'string' && val.trim() !== '' && val !== 'NA' && val !== 'null') {
      return val.trim();
    }
  }

  return null;
}

/**
 * Retrieves the image URL for a content control, automatically falling back to the 
 * "Picture Not Available" placeholder if the photo was not uploaded.
 */
export function getPhotoUrlWithPlaceholder(photos: any, searchKey: string): string {
  const url = getPhotoUrlForContentControl(photos, searchKey);
  if (!url || url === 'NA' || url.trim() === '') {
    return PICTURE_NOT_AVAILABLE_IMAGE;
  }
  return url.trim();
}

/**
 * Converts a data URL, blob URL, or remote image URL to binary Uint8Array
 */
export async function fetchImageBinary(imageUrl: string): Promise<{ bytes: Uint8Array; extension: string } | null> {
  if (!imageUrl || imageUrl === 'NA' || imageUrl.trim() === '') {
    return null;
  }

  const trimmed = imageUrl.trim();

  // Case 1: Base64 data URL
  if (trimmed.startsWith('data:image/')) {
    try {
      const commaIdx = trimmed.indexOf(',');
      if (commaIdx === -1) return null;

      const header = trimmed.slice(0, commaIdx).toLowerCase();
      let extension = 'jpeg';
      if (header.includes('png')) extension = 'png';
      else if (header.includes('webp')) extension = 'png';
      else if (header.includes('jpeg') || header.includes('jpg')) extension = 'jpeg';

      const base64Data = trimmed.slice(commaIdx + 1);
      let clean = base64Data.replace(/[\s\r\n]+/g, '').replace(/-/g, '+').replace(/_/g, '/');
      if (clean.includes('%')) {
        try { clean = decodeURIComponent(clean); } catch (e) {}
      }
      clean = clean.replace(/[^A-Za-z0-9+/=]/g, '');
      const mod = clean.length % 4;
      if (mod === 2) clean += '==';
      else if (mod === 3) clean += '=';
      else if (mod === 1) clean = clean.substring(0, clean.length - 1);

      const binaryString = atob(clean);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return { bytes, extension };
    } catch (e) {
      console.warn('Failed to parse base64 data URL:', e);
      return null;
    }
  }

  // Case 2: HTTP/HTTPS or Blob URL
  try {
    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    let extension = 'jpeg';
    if (blob.type.includes('png')) extension = 'png';
    else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) extension = 'jpeg';

    return { bytes: new Uint8Array(arrayBuffer), extension };
  } catch (err) {
    console.error('Failed to download image from URL:', trimmed, err);
    return null;
  }
}

/**
 * Returns photo definitions grouped by official document section
 */
export function getPhotosGroupedBySection() {
  const groups: Record<ReportSectionCategory, { section: PhotoSectionInfo; items: PhotoDefinition[] }> = {
    packaging: { section: REPORT_PHOTO_SECTIONS.packaging, items: [] },
    idu: { section: REPORT_PHOTO_SECTIONS.idu, items: [] },
    odu: { section: REPORT_PHOTO_SECTIONS.odu, items: [] },
    refrigeration: { section: REPORT_PHOTO_SECTIONS.refrigeration, items: [] }
  };

  PHOTO_FIELD_DEFINITIONS.forEach(def => {
    if (groups[def.section]) {
      groups[def.section].items.push(def);
    }
  });

  return groups;
}

/**
 * Smart heuristic to match an uploaded image filename/label to the best matching DOCX photo key
 */
export function findBestMatchingPhotoKey(filenameOrLabel: string): PhotoDefinition | null {
  if (!filenameOrLabel || typeof filenameOrLabel !== 'string') return null;

  const normalized = filenameOrLabel.toLowerCase().replace(/[^a-z0-9]/g, ' ');

  // 1. Direct exact or substring alias matching
  for (const def of PHOTO_FIELD_DEFINITIONS) {
    const checkList = [def.photoKey, def.id, def.label, ...def.aliases];
    for (const item of checkList) {
      const normItem = item.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
      if (normItem && (normalized.includes(normItem) || normItem.includes(normalized))) {
        return def;
      }
    }
  }

  // 2. Keyword heuristic scoring
  const keywordsMap: { [key: string]: string[] } = {
    PHOTO_Indoor_Unit: ['indoor unit', 'indoor unit photo', 'idu unit', 'indoor ac', 'split idu', 'indoor unit appearance'],
    PHOTO_Product_Packing: ['product', 'box', 'outer', 'carton', 'packing box', 'packaging'],
    PHOTO_Packing_Box: ['bare', 'inner', 'inner box', 'bare packing', 'packing'],
    PHOTO_IDU_Motor: ['idu motor', 'blower motor', 'indoor motor', 'fan motor idu'],
    PHOTO_IDU_PCB: ['idu pcb', 'indoor pcb', 'display pcb', 'control board'],
    PHOTO_IDU_Product_Name_Plate: ['idu nameplate', 'idu plate', 'indoor sticker', 'idu rating'],
    PHOTO_Remote: ['remote', 'handset', 'controller', 'remote control'],
    PHOTO_ODU_Name_Plate: ['odu nameplate', 'odu plate', 'outdoor sticker', 'odu rating', 'metal plate'],
    PHOTO_ODU_Motor: ['odu motor', 'outdoor motor', 'condenser motor', 'fan motor odu'],
    PHOTO_ODU_PCB: ['odu pcb', 'outdoor pcb', 'inverter pcb', 'power pcb'],
    PHOTO_Electronic_Expansion_Valve: ['eev', 'expansion', 'valve', 'coil', 'electronic expansion valve'],
    PHOTO_ODU_Compressor: ['compressor', 'rotary', 'comp', 'gmcc', 'rechi', 'highly']
  };

  for (const [key, keywords] of Object.entries(keywordsMap)) {
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        const found = PHOTO_FIELD_DEFINITIONS.find(d => d.photoKey === key);
        if (found) return found;
      }
    }
  }

  return null;
}

/**
 * Calculates photo coverage stats across all 11 standardized placeholders
 */
export function calculatePhotoCoverageStats(photos: Record<string, string | undefined> = {}) {
  let mappedCount = 0;
  const sectionStats: Record<ReportSectionCategory, { total: number; uploaded: number }> = {
    packaging: { total: 0, uploaded: 0 },
    idu: { total: 0, uploaded: 0 },
    odu: { total: 0, uploaded: 0 },
    refrigeration: { total: 0, uploaded: 0 }
  };

  PHOTO_FIELD_DEFINITIONS.forEach(def => {
    sectionStats[def.section].total++;
    const url = getPhotoUrlForContentControl(photos, def.photoKey);
    if (url && url.trim() !== '' && url !== 'NA') {
      mappedCount++;
      sectionStats[def.section].uploaded++;
    }
  });

  return {
    total: PHOTO_FIELD_DEFINITIONS.length,
    uploaded: mappedCount,
    pending: PHOTO_FIELD_DEFINITIONS.length - mappedCount,
    percentage: Math.round((mappedCount / PHOTO_FIELD_DEFINITIONS.length) * 100),
    sectionStats
  };
}
