import React from 'react';
import { 
  AlertCircle, 
  ShieldAlert, 
  FileText, 
  Image as ImageIcon, 
  AlertTriangle
} from 'lucide-react';

export interface PlaceholderMappingItem {
  tag: string; // e.g. {{Report No}}, {{PHOTO_ODU_Compressor}}
  type: 'text' | 'photo';
  fieldName: string; // e.g. "Report Number", "ODU Compressor Photo"
  currentValue: string;
  isMapped: boolean;
  status: 'mapped' | 'missing' | 'unmatched';
}

interface MissingDataAlertProps {
  missingFields: string[];
  missingPhotos: string[];
  isTemplateMissing?: boolean;
  isUnitMissing?: boolean;
  detectedTextPlaceholders?: string[];
  detectedPhotoPlaceholders?: string[];
  dataValuesMap?: Record<string, string>;
  photosMap?: Record<string, string>;
}

export const MissingDataAlert: React.FC<MissingDataAlertProps> = ({
  missingFields,
  missingPhotos,
  isTemplateMissing,
  isUnitMissing,
  detectedTextPlaceholders = [],
  detectedPhotoPlaceholders = [],
  dataValuesMap = {},
  photosMap = {}
}) => {
  const totalMissingCount = (isTemplateMissing ? 1 : 0) + (isUnitMissing ? 1 : 0) + missingFields.length + missingPhotos.length;

  // Build mapping counts
  const { textMappedCount, textTotalCount, photoMappedCount, photoTotalCount } = React.useMemo(() => {
    let tMapped = 0;
    let tTotal = 0;

    if (detectedTextPlaceholders.length > 0) {
      tTotal = detectedTextPlaceholders.length;
      detectedTextPlaceholders.forEach(tag => {
        const cleanTag = tag.trim().replace(/^\{\{|\}\}$/g, '');
        const val = dataValuesMap[cleanTag] || dataValuesMap[cleanTag.replace(/[\s_]+/g, '_')] || dataValuesMap[cleanTag.replace(/_/g, ' ')] || '';
        if (val && val.trim() !== '' && val !== 'NA') tMapped++;
      });
    } else {
      const defaultTextKeys = [
        'Report No', 'Model_Name', 'Sample_Type', 'Sample_Code_IDU', 'Sample_CodeI_ODU',
        'Sample_Received', 'Test_Commenced', 'Test_Completed', 'Cooling_capacity', 'Refrigerant',
        'ISEER', 'IDU_Motor_Spec', 'IDU_Motor_Part_Code', 'IDU_Motor_Supplier',
        'IDU_PCB_Part_Code', 'IDU_PCB_Supplier', 'ODU_Motor_Spec', 'ODU_Motor_Part_Code',
        'ODU_Motor_Supplier', 'ODU_PCB_Part_Code', 'ODU_PCB_Supplier', 'Compressor_Spec',
        'Compressor_Part_Code', 'Compressor_Supplier', 'EEV_Spec', 'EEV_Part_Code',
        'IDU_Serial_Number', 'ODU_Serial_Number'
      ];
      tTotal = defaultTextKeys.length;
      defaultTextKeys.forEach(key => {
        const val = dataValuesMap[key] || dataValuesMap[key.replace(/_/g, ' ')] || '';
        if (val && val.trim() !== '' && val !== 'NA') tMapped++;
      });
    }

    const standardPhotoKeys = [
      'PHOTO_Product_Packing', 'PHOTO_Packing_Box', 'PHOTO_IDU_Motor', 'PHOTO_IDU_PCB',
      'PHOTO_IDU_Product_Name_Plate', 'PHOTO_Remote', 'PHOTO_ODU_Name_Plate', 'PHOTO_ODU_Motor',
      'PHOTO_ODU_PCB', 'PHOTO_Electronic_Expansion_Valve', 'PHOTO_ODU_Compressor'
    ];
    const pTotal = standardPhotoKeys.length;
    let pMapped = 0;
    standardPhotoKeys.forEach(k => {
      const val = photosMap[k] || photosMap[`{{${k}}}`] || '';
      if (val && val.trim() !== '' && val !== 'NA') pMapped++;
    });

    return {
      textMappedCount: tMapped,
      textTotalCount: tTotal,
      photoMappedCount: pMapped,
      photoTotalCount: pTotal
    };
  }, [detectedTextPlaceholders, detectedPhotoPlaceholders, dataValuesMap, photosMap]);

  return (
    <div className="space-y-3">
      {/* Status Cards Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Text Mapped */}
        <div className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
          textMappedCount === textTotalCount && textTotalCount > 0
            ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
            : 'bg-slate-900/80 border-slate-800 text-slate-200'
        }`}>
          <div className={`p-2 rounded-lg shrink-0 ${
            textMappedCount === textTotalCount && textTotalCount > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
          }`}>
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">✓ Text Fields</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base sm:text-lg font-black text-white font-mono">{textMappedCount}</span>
              <span className="text-xs text-slate-500 font-mono">/ {textTotalCount}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Photo Mapped */}
        <div className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
          photoMappedCount === photoTotalCount && photoTotalCount > 0
            ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
            : 'bg-slate-900/80 border-slate-800 text-slate-200'
        }`}>
          <div className={`p-2 rounded-lg shrink-0 ${
            photoMappedCount === photoTotalCount && photoTotalCount > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'
          }`}>
            <ImageIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">✓ Photos</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base sm:text-lg font-black text-white font-mono">{photoMappedCount}</span>
              <span className="text-xs text-slate-500 font-mono">/ {photoTotalCount}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Missing Data Warning */}
        <div className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
          missingFields.length > 0
            ? 'bg-amber-950/40 border-amber-800/80 text-amber-300'
            : 'bg-slate-900/80 border-slate-800 text-slate-400'
        }`}>
          <div className={`p-2 rounded-lg shrink-0 ${
            missingFields.length > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">⚠ Missing Data</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-base sm:text-lg font-black font-mono ${missingFields.length > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
                {missingFields.length}
              </span>
              <span className="text-xs text-slate-500">field{missingFields.length === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Missing Photo Warning */}
        <div className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
          missingPhotos.length > 0
            ? 'bg-amber-950/40 border-amber-800/80 text-amber-300'
            : 'bg-slate-900/80 border-slate-800 text-slate-400'
        }`}>
          <div className={`p-2 rounded-lg shrink-0 ${
            missingPhotos.length > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'
          }`}>
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">⚠ Missing Photo</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-base sm:text-lg font-black font-mono ${missingPhotos.length > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
                {missingPhotos.length}
              </span>
              <span className="text-xs text-slate-500">photo{missingPhotos.length === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Missing Items Alert Box if any */}
      {totalMissingCount > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/80 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-amber-400 font-extrabold">
            <ShieldAlert className="w-4 h-4" />
            <span>Validation: {totalMissingCount} item{totalMissingCount > 1 ? 's' : ''} pending</span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {isTemplateMissing && (
              <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800 text-[10px] font-bold">
                • Master DOCX Template Required
              </span>
            )}
            {isUnitMissing && (
              <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800 text-[10px] font-bold">
                • Unit Serial Number Required
              </span>
            )}
            {missingFields.map((f, i) => (
              <span key={`f-${i}`} className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800 text-[10px] font-medium">
                • Missing Field: {f}
              </span>
            ))}
            {missingPhotos.map((p, i) => (
              <span key={`p-${i}`} className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800 text-[10px] font-medium">
                • Missing Photo: {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
