import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Camera, 
  Trash2, 
  Eye, 
  RefreshCw, 
  RotateCw,
  CheckCircle2, 
  ImageIcon, 
  X, 
  ZoomIn,
  Sparkles,
  AlertCircle,
  Layers,
  FileCheck,
  FolderArchive,
  Grid3X3,
  SlidersHorizontal,
  Download,
  Tag,
  ChevronDown,
  ChevronUp,
  Cloud
} from 'lucide-react';
import { ProtoUnitPhotos } from '../../types';
import { deleteSinglePhotoFromServer } from '../../services/cloudPhotoService';
import { 
  PHOTO_FIELD_DEFINITIONS, 
  REPORT_PHOTO_SECTIONS, 
  ReportSectionCategory, 
  PhotoDefinition,
  findBestMatchingPhotoKey,
  calculatePhotoCoverageStats,
  getPhotosGroupedBySection
} from '../../utils/photoManager';
import { compressImageFile, CompressionResult } from '../../services/photoSettingsStore';
import { PICTURE_NOT_AVAILABLE_IMAGE, isPhotoMissing } from '../../utils/placeholderImage';

export interface PhotoFieldConfig {
  key: string;
  label: string;
  legacyKey?: string;
  description?: string;
  section: ReportSectionCategory;
  documentPage: string;
  suggestedFilename: string;
}

/**
 * Standardized filename generator based on parameter name
 */
export const getStandardizedFilename = (key: string, label: string): string => {
  const map: { [key: string]: string } = {
    PHOTO_Indoor_Unit: 'indoor_unit.jpg',
    PHOTO_Product_Packing: 'product_packing.jpg',
    PHOTO_Packing_Box: 'packing_box.jpg',
    PHOTO_IDU_Motor: 'idu_motor.jpg',
    PHOTO_IDU_PCB: 'idu_pcb.jpg',
    PHOTO_IDU_Product_Name_Plate: 'idu_nameplate.jpg',
    PHOTO_Remote: 'remote.jpg',
    PHOTO_ODU_Name_Plate: 'odu_nameplate.jpg',
    PHOTO_ODU_Motor: 'odu_motor.jpg',
    PHOTO_ODU_PCB: 'odu_pcb.jpg',
    PHOTO_Electronic_Expansion_Valve: 'electronic_expansion_valve.jpg',
    PHOTO_ODU_Compressor: 'odu_compressor.jpg',
  };
  return map[key] || `${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}.jpg`;
};

/**
 * Exact 11 Photo Upload Fields organized with section mappings
 */
export const PHOTO_UPLOAD_CONFIGS: PhotoFieldConfig[] = PHOTO_FIELD_DEFINITIONS.map(def => ({
  key: def.photoKey,
  legacyKey: def.id,
  label: def.label,
  description: def.documentPage + ' - ' + REPORT_PHOTO_SECTIONS[def.section].title,
  section: def.section,
  documentPage: def.documentPage,
  suggestedFilename: getStandardizedFilename(def.photoKey, def.label)
}));

export interface PhotoUploadSectionProps {
  photos: Record<string, string | undefined>;
  onChange: (updatedPhotos: Record<string, string>) => void;
  unitId?: string;
  title?: string;
  subtitle?: string;
  readOnly?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

export const PhotoUploadSection: React.FC<PhotoUploadSectionProps> = ({
  photos,
  onChange,
  unitId,
  title = 'Inspection Photos',
  subtitle,
  readOnly = false,
  collapsible = false,
  defaultOpen = true,
  isOpen: controlledIsOpen,
  onToggleOpen,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(defaultOpen);
  const isExpanded = collapsible ? (controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen) : true;
  
  const handleToggle = () => {
    if (!collapsible) return;
    if (onToggleOpen) {
      onToggleOpen();
    } else {
      setInternalIsOpen(prev => !prev);
    }
  };

  const [activeTab, setActiveTab] = useState<'all' | ReportSectionCategory>('all');
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<{ url: string; label: string; key: string; section?: string; page?: string } | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState<{ [key: string]: string }>({});
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);

  // Hidden file inputs references
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const cameraInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const batchInputRef = useRef<HTMLInputElement | null>(null);

  // Helper to get photo URL from either exact key or legacy camelCase key
  const getPhotoValue = (config: PhotoFieldConfig): string => {
    let val = '';
    if (photos[config.key] && photos[config.key] !== 'NA' && photos[config.key]?.trim() !== '') {
      val = photos[config.key]!.trim();
    } else if (config.legacyKey && photos[config.legacyKey] && photos[config.legacyKey] !== 'NA' && photos[config.legacyKey]?.trim() !== '') {
      val = photos[config.legacyKey]!.trim();
    } else if (config.key === 'PHOTO_Electronic_Expansion_Valve') {
      if (photos.PHOTO_EEV && photos.PHOTO_EEV !== 'NA') val = photos.PHOTO_EEV;
      else if (photos.eevPhoto && photos.eevPhoto !== 'NA') val = photos.eevPhoto;
    } else if (config.key === 'PHOTO_ODU_Compressor') {
      if (photos.PHOTO_Compressor && photos.PHOTO_Compressor !== 'NA') val = photos.PHOTO_Compressor;
      else if (photos.compressorPhoto && photos.compressorPhoto !== 'NA') val = photos.compressorPhoto;
    } else if (config.key === 'PHOTO_IDU_Product_Name_Plate') {
      if (photos.PHOTO_IDU_Name_Plate && photos.PHOTO_IDU_Name_Plate !== 'NA') val = photos.PHOTO_IDU_Name_Plate;
    } else if (config.key === 'PHOTO_Remote') {
      if (photos.stickerPhoto && photos.stickerPhoto !== 'NA') val = photos.stickerPhoto;
    }

    // Ignore broken/corrupt placeholder strings and unuploaded placeholders
    if (isPhotoMissing(val)) {
      return '';
    }
    return val;
  };

  const processSingleFile = async (file: File): Promise<CompressionResult | null> => {
    if (!file) return null;
    if (!file.type.startsWith('image/') && !file.name.match(/\.(jpg|jpeg|png|webp|bmp|gif|heic|heif)$/i)) {
      return null;
    }

    try {
      const result = await compressImageFile(file);
      return result;
    } catch (err) {
      console.error('Error compressing image:', err);
      return null;
    }
  };

  const processFile = async (config: PhotoFieldConfig, file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.name.match(/\.(jpg|jpeg|png|webp|bmp|gif|heic|heif)$/i)) {
      alert(`Invalid format for ${config.label}. Please select an image file (JPG, PNG, WEBP, etc.).`);
      return;
    }

    const result = await processSingleFile(file);
    if (result && result.dataUrl) {
      savePhotoToState(config, result, file.name);
    }
  };

  const savePhotoToState = (config: PhotoFieldConfig, result: CompressionResult, originalFileName?: string) => {
    const dataUrl = result.dataUrl;
    const updated = { ...photos };
    // Save under exact Word key
    updated[config.key] = dataUrl;
    // Also save under legacy key for complete backward compatibility
    if (config.legacyKey) {
      updated[config.legacyKey] = dataUrl;
    }
    // Specific aliases
    if (config.key === 'PHOTO_Electronic_Expansion_Valve') {
      updated.PHOTO_EEV = dataUrl;
      updated.oduEevPhoto = dataUrl;
      updated.eevPhoto = dataUrl;
    }
    if (config.key === 'PHOTO_ODU_Compressor') {
      updated.PHOTO_Compressor = dataUrl;
      updated.oduCompressorPhoto = dataUrl;
      updated.compressorPhoto = dataUrl;
    }
    if (config.key === 'PHOTO_IDU_Product_Name_Plate') {
      updated.PHOTO_IDU_Name_Plate = dataUrl;
      updated.iduNameplatePhoto = dataUrl;
    }
    if (config.key === 'PHOTO_Remote') {
      updated.stickerPhoto = dataUrl;
      updated.remotePhoto = dataUrl;
    }

    onChange(updated);

    const standardName = config.suggestedFilename;
    const feedbackText = result.isCompressed && result.savedPercent > 0
      ? `"${standardName}" • ${result.originalSizeKB > 1024 ? (result.originalSizeKB / 1024).toFixed(1) + 'MB' : result.originalSizeKB + 'KB'} ➔ ${result.compressedSizeKB}KB (-${result.savedPercent}%)`
      : `Auto-renamed to "${standardName}" (${result.originalSizeKB} KB)`;

    setUploadFeedback(prev => ({
      ...prev,
      [config.key]: feedbackText
    }));

    setTimeout(() => {
      setUploadFeedback(prev => {
        const next = { ...prev };
        delete next[config.key];
        return next;
      });
    }, 5000);
  };

  // Direct download photo with standardized name (e.g. odu_compressor.jpg)
  const downloadSinglePhoto = (config: PhotoFieldConfig, url: string) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = config.suggestedFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download all uploaded photos as standardized filenames
  const downloadAllRenamedPhotos = () => {
    PHOTO_UPLOAD_CONFIGS.forEach((config, idx) => {
      const url = getPhotoValue(config);
      if (url) {
        setTimeout(() => {
          downloadSinglePhoto(config, url);
        }, idx * 250);
      }
    });
  };

  // Batch Auto-Match Upload
  const handleBatchFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    let matchedCount = 0;
    const updated = { ...photos };
    const messages: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const matchedDef = findBestMatchingPhotoKey(file.name);
      if (matchedDef) {
        const result = await processSingleFile(file);
        if (result && result.dataUrl) {
          updated[matchedDef.photoKey] = result.dataUrl;
          if (matchedDef.id) updated[matchedDef.id] = result.dataUrl;
          matchedCount++;
          const sizeInfo = result.isCompressed && result.savedPercent > 0
            ? ` (${result.compressedSizeKB} KB, -${result.savedPercent}%)`
            : '';
          messages.push(`${file.name} ➔ ${matchedDef.label}${sizeInfo}`);
        }
      }
    }

    if (matchedCount > 0) {
      onChange(updated);
      setBatchFeedback(`Auto-mapped ${matchedCount} photos successfully: ${messages.slice(0, 2).join(', ')}${messages.length > 2 ? ` (+${messages.length - 2} more)` : ''}`);
      setTimeout(() => setBatchFeedback(null), 5000);
    } else {
      alert('Could not automatically determine target sections from filenames. Please upload photos directly into their respective boxes.');
    }
  };

  const handleFileSelect = (config: PhotoFieldConfig, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(config, file);
    }
    e.target.value = '';
  };

  const handleRemovePhoto = (config: PhotoFieldConfig) => {
    const updated = { ...photos };
    delete updated[config.key];
    if (config.legacyKey) {
      delete updated[config.legacyKey];
    }
    if (config.key === 'PHOTO_Electronic_Expansion_Valve') {
      delete updated.PHOTO_EEV;
      delete updated.oduEevPhoto;
      delete updated.eevPhoto;
    }
    if (config.key === 'PHOTO_ODU_Compressor') {
      delete updated.PHOTO_Compressor;
      delete updated.oduCompressorPhoto;
      delete updated.compressorPhoto;
    }
    if (config.key === 'PHOTO_IDU_Product_Name_Plate') {
      delete updated.PHOTO_IDU_Name_Plate;
      delete updated.iduNameplatePhoto;
    }
    if (config.key === 'PHOTO_Remote') {
      delete updated.stickerPhoto;
      delete updated.remotePhoto;
    }
    onChange(updated);

    // Delete isolated photo document from Firestore server if unitId is provided
    if (unitId) {
      deleteSinglePhotoFromServer(unitId, config.key).catch(err => {
        console.warn('Error deleting photo from server:', err);
      });
      if (config.legacyKey) {
        deleteSinglePhotoFromServer(unitId, config.legacyKey).catch(() => {});
      }
    }
  };

  const handleRotatePhoto = (config: PhotoFieldConfig) => {
    const currentUrl = getPhotoValue(config);
    if (!currentUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const rotatedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const updated = { ...photos, [config.key]: rotatedDataUrl };
      if (config.legacyKey) {
        updated[config.legacyKey] = rotatedDataUrl;
      }
      onChange(updated);
    };
    img.src = currentUrl;
  };

  // Drag and drop handlers
  const handleDragOver = (key: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKey(key);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKey(null);
  };

  const handleDrop = (config: PhotoFieldConfig, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKey(null);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(config, file);
    }
  };

  const coverage = calculatePhotoCoverageStats(photos);
  const filteredConfigs = activeTab === 'all' 
    ? PHOTO_UPLOAD_CONFIGS 
    : PHOTO_UPLOAD_CONFIGS.filter(cfg => cfg.section === activeTab);

  return (
    <div className="bg-slate-950/80 rounded-2xl border border-slate-800 shadow-xl overflow-hidden transition-all duration-300">
      {/* Header Banner with Dropdown / Undrop Accordion Toggle */}
      <div 
        onClick={collapsible ? handleToggle : undefined}
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 transition-colors ${
          collapsible ? 'cursor-pointer select-none bg-slate-900/40 hover:bg-slate-900/80' : 'bg-slate-900/40'
        } ${isExpanded ? 'border-b border-slate-800/80' : ''}`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 shrink-0">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                {title}
              </h3>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                coverage.uploaded > 0
                  ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}>
                {coverage.uploaded} / 11 Uploaded
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60" title="Photos are stored directly on the Cloud Server (Firestore), synced across Desktop & Mobile">
                <Cloud className="w-3 h-3 text-cyan-400" />
                <span>Direct Server Sync</span>
              </span>
              {collapsible && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isExpanded ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50' : 'bg-slate-800 text-slate-400'
                }`}>
                  {isExpanded ? 'Expanded (Opened)' : 'Collapsed (Click to Open)'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {subtitle || (
                isExpanded
                  ? '11 Standard Photographic Evidence fields for Report verification. Upload or drag-and-drop photos.'
                  : `${coverage.uploaded}/11 Photos Attached (${coverage.percentage}% Coverage) - Click Dropdown to Open & Upload Photos`
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons & Dropdown / Undrop Toggle */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
          {!readOnly && coverage.uploaded > 0 && (
            <button
              type="button"
              onClick={downloadAllRenamedPhotos}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-700/40 text-xs font-semibold flex items-center gap-1.5 shadow transition-all cursor-pointer"
              title="Download all uploaded photos renamed to their standard match names"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save Renamed</span> ({coverage.uploaded})
            </button>
          )}

          {collapsible && (
            <button
              type="button"
              onClick={handleToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isExpanded
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30'
              }`}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 text-purple-400" />
                  <span>Undrop (Close)</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  <span>Dropdown (Open Photos)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Accordion Body: Only rendered when Expanded */}
      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-5 animate-in fade-in-50 duration-200">
          {batchFeedback && (
            <div className="p-3 rounded-xl bg-purple-950/70 border border-purple-500/60 text-purple-200 text-xs flex items-center gap-2 animate-in fade-in">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
              <span>{batchFeedback}</span>
            </div>
          )}

      {/* Dynamic Document Section Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-b border-slate-800/80 scrollbar-thin">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            activeTab === 'all'
              ? 'bg-purple-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
          <span>All Photos</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30">{coverage.uploaded}/11</span>
        </button>

        {(Object.keys(REPORT_PHOTO_SECTIONS) as ReportSectionCategory[]).map(secKey => {
          const sec = REPORT_PHOTO_SECTIONS[secKey];
          const stats = coverage.sectionStats[secKey];
          const isComplete = stats.uploaded === stats.total;

          return (
            <button
              key={secKey}
              type="button"
              onClick={() => setActiveTab(secKey)}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                activeTab === secKey
                  ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>{sec.title}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isComplete ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-900 text-slate-300'
              }`}>
                {stats.uploaded}/{stats.total}
              </span>
            </button>
          );
        })}
      </div>

      {/* Section Description Bar when a specific tab is active */}
      {activeTab !== 'all' && (
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <div>
            <span className="font-bold text-cyan-300 mr-2">{REPORT_PHOTO_SECTIONS[activeTab].title}</span>
            <span className="text-slate-400">{REPORT_PHOTO_SECTIONS[activeTab].description}</span>
          </div>
          <span className="text-[11px] font-mono text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/60 shrink-0">
            {REPORT_PHOTO_SECTIONS[activeTab].page}
          </span>
        </div>
      )}

      {/* 2-Column Card Grid on Desktop, 1-Column on Mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredConfigs.map((config, index) => {
          const photoUrl = getPhotoValue(config);
          const isUploaded = Boolean(photoUrl);
          const isDragging = dragOverKey === config.key;
          const feedback = uploadFeedback[config.key];
          const globalIdx = PHOTO_UPLOAD_CONFIGS.findIndex(c => c.key === config.key);

          return (
            <div
              key={config.key}
              onDragOver={(e) => handleDragOver(config.key, e)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(config, e)}
              className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-3 ${
                isDragging
                  ? 'bg-purple-950/30 border-purple-500 ring-2 ring-purple-500/20'
                  : isUploaded
                    ? 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600'
                    : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300 flex items-center justify-center shrink-0">
                    {globalIdx + 1}
                  </span>
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-100">
                    {config.label}
                  </h4>
                </div>

                {/* Status Indicator */}
                <div>
                  {isUploaded ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Uploaded
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Auto Placeholder
                    </span>
                  )}
                </div>
              </div>

              {/* Hidden file inputs for manual selection and mobile camera */}
              <input
                ref={(el) => {
                  fileInputRefs.current[config.key] = el;
                }}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleFileSelect(config, e)}
              />
              <input
                ref={(el) => {
                  cameraInputRefs.current[config.key] = el;
                }}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileSelect(config, e)}
              />

              {/* Card Body: Preview or Upload Dropzone */}
              {isUploaded ? (
                <div className="space-y-2.5">
                  {/* Photo Preview Container (Fixed 6cm x 4cm proportional display) */}
                  <div className="relative group w-full h-36 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center">
                    <img
                      src={photoUrl}
                      alt={config.label}
                      className="w-full h-full object-contain p-1 transition-transform group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        if (!img.src.startsWith('data:image/svg+xml')) {
                          img.src = PICTURE_NOT_AVAILABLE_IMAGE;
                        }
                      }}
                    />

                    {/* Hover overlay with Quick Actions */}
                    <div className="absolute inset-0 bg-slate-950/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2 backdrop-blur-[2px]">
                      <button
                        type="button"
                        onClick={() => setPreviewModal({ 
                          url: photoUrl, 
                          label: config.label, 
                          key: config.key,
                          section: REPORT_PHOTO_SECTIONS[config.section].title,
                          page: config.documentPage
                        })}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-md"
                        title="View Full Resolution"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>

                      {!readOnly && (
                        <>
                          <button
                            type="button"
                            onClick={() => downloadSinglePhoto(config, photoUrl)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-md border border-amber-700/50"
                            title={`Download photo saved as "${config.suggestedFilename}"`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Save as {config.suggestedFilename}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRotatePhoto(config)}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-md"
                            title="Rotate Picture 90° Clockwise"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Rotate</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(config)}
                            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-md"
                            title="Remove Photo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions Row */}
                  {!readOnly && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRotatePhoto(config)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer"
                          title="Rotate Picture 90° Clockwise"
                        >
                          <RotateCw className="w-3 h-3 text-indigo-400" />
                          <span>Rotate</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => cameraInputRefs.current[config.key]?.click()}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer"
                          title="Take Photo with Camera"
                        >
                          <Camera className="w-3 h-3 text-purple-400" />
                          <span>Camera</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(config)}
                        className="px-2.5 py-1 bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 rounded-lg text-xs font-medium flex items-center gap-1 border border-rose-800/60 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3 text-rose-400" />
                        <span>Remove</span>
                      </button>
                    </div>
                  )}

                  {feedback && (
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1 animate-fade-in">
                      <CheckCircle2 className="w-3 h-3" />
                      {feedback}
                    </p>
                  )}
                </div>
              ) : (
                /* Auto-Applied Default: Picture Not Available Placeholder with Upload overlay */
                <div className="space-y-2.5">
                  <div
                    onClick={() => !readOnly && fileInputRefs.current[config.key]?.click()}
                    className={`relative group w-full h-36 bg-white rounded-lg border border-slate-700/80 overflow-hidden flex items-center justify-center transition-all ${
                      readOnly 
                        ? 'cursor-default opacity-90' 
                        : 'hover:border-cyan-500 hover:ring-2 hover:ring-cyan-500/20 cursor-pointer shadow-md'
                    }`}
                    title={readOnly ? 'Picture Not Available' : 'Click or Drag photo here to replace placeholder'}
                  >
                    <img
                      src={PICTURE_NOT_AVAILABLE_IMAGE}
                      alt="Picture Not Available"
                      className="w-full h-full object-contain p-1.5 transition-transform group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Hover overlay with Upload invitation */}
                    {!readOnly && (
                      <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2 backdrop-blur-[2px]">
                        <div className="p-2 rounded-full bg-cyan-600 text-white shadow-md">
                          <Upload className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-white">Click or Drag to Upload</span>
                        <span className="text-[10px] text-slate-300">Auto Default: Picture Not Available</span>
                      </div>
                    )}
                  </div>

                  {/* Upload Action Buttons */}
                  {!readOnly && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5 flex-1">
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[config.key]?.click()}
                          className="flex-1 py-1 px-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Photo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => cameraInputRefs.current[config.key]?.click()}
                          className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                          title="Open Camera on Mobile"
                        >
                          <Camera className="w-3.5 h-3.5 text-purple-400" />
                          <span>Camera</span>
                        </button>
                      </div>
                      <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded shrink-0">
                        Default
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  )}

      {/* Full Image Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-bold text-white">{previewModal.label}</h4>
                <span className="text-xs font-mono text-purple-400 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800">
                  {`{{${previewModal.key}}}`}
                </span>
                {previewModal.page && (
                  <span className="text-xs font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                    {previewModal.page}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Image View */}
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-950">
              <img
                src={previewModal.url}
                alt={previewModal.label}
                className="max-w-full max-h-[70vh] object-contain rounded-lg border border-slate-800"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-400">
              <span>Section: <strong className="text-slate-200">{previewModal.section || 'Lab Photographs'}</strong> (Standard 6 cm × 4 cm Fixed Aspect Ratio)</span>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

