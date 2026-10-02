import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Cpu, 
  Tag, 
  Clock, 
  User, 
  FileText, 
  Settings, 
  ImageIcon, 
  Calendar, 
  Eye, 
  ArrowRightLeft,
  Plus,
  Trash2,
  Download
} from 'lucide-react';
import { ProtoUnit } from '../../types';
import { 
  formatShortDateTime, 
  getMachineEndDateTime, 
  getMachineStartDateTime, 
  getTestCompletedDate, 
  getTestCommencedDate 
} from '../../utils/dateFormatter';
import { 
  updateProtoUnitStatus, 
  addProtoUnitObservation, 
  deleteProtoUnitObservation,
  transferProtoUnitToLive
} from '../../services/protoUnitStore';
import { exportUnitToPDF } from '../../utils/pdfExport';
import { useIsShiftActiveNow } from '../../services/shiftStore';
import { PICTURE_NOT_AVAILABLE_SVG, isPhotoMissing } from '../../utils/placeholderImage';
import { PHOTO_FIELD_DEFINITIONS, getPhotoUrlForContentControl } from '../../utils/photoManager';
import { fetchUnitPhotosFromServer, subscribeToUnitPhotos } from '../../services/cloudPhotoService';

interface ProtoUnitDetailsDialogProps {
  unit: ProtoUnit | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged?: (newStatus?: 'live' | 'finished' | 'stopped') => void;
}

export const ProtoUnitDetailsDialog: React.FC<ProtoUnitDetailsDialogProps> = ({
  unit,
  isOpen,
  onClose,
  onStatusChanged,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; label: string } | null>(null);
  const [currentUnit, setCurrentUnit] = useState<ProtoUnit | null>(unit);
  const [observationInput, setObservationInput] = useState('');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferHours, setTransferHours] = useState<string>('0');

  const isShiftActive = useIsShiftActiveNow();

  useEffect(() => {
    setCurrentUnit(unit);
    setObservationInput('');
    setIsTransferModalOpen(false);
    setTransferHours('0');

    if (unit?.id) {
      // 1. Asynchronously hydrate any full photos directly from cloud server
      fetchUnitPhotosFromServer(unit.id).then(serverPhotos => {
        if (serverPhotos && Object.keys(serverPhotos).length > 0) {
          setCurrentUnit(prev => {
            if (!prev || prev.id !== unit.id) return prev;
            const merged = { ...(prev.photos || {}) };
            let hasNew = false;
            Object.entries(serverPhotos).forEach(([k, v]) => {
              if (v && !isPhotoMissing(v) && (!merged[k] || isPhotoMissing(merged[k]))) {
                merged[k] = v;
                hasNew = true;
              }
            });
            return hasNew ? { ...prev, photos: merged as any } : prev;
          });
        }
      }).catch(() => {});

      // 2. Real-time subscription: If mobile uploads photos while dialog is open on desktop, update live!
      const unsubscribe = subscribeToUnitPhotos(unit.id, (realtimePhotos) => {
        setCurrentUnit(prev => {
          if (!prev || prev.id !== unit.id) return prev;
          const merged = { ...(prev.photos || {}) };
          let hasNew = false;
          Object.entries(realtimePhotos).forEach(([k, v]) => {
            if (v && !isPhotoMissing(v) && merged[k] !== v) {
              merged[k] = v;
              hasNew = true;
            }
          });
          return hasNew ? { ...prev, photos: merged as any } : prev;
        });
      });

      return () => {
        try { unsubscribe(); } catch {}
      };
    }
  }, [unit]);

  if (!isOpen || !currentUnit) return null;

  const handleToggleStatus = () => {
    const nextStatus = currentUnit.status === 'live' ? 'finished' : 'live';
    updateProtoUnitStatus(currentUnit.id, nextStatus);
    if (onStatusChanged) onStatusChanged(nextStatus);
    onClose();
  };

  const handleConfirmTransferToLive = () => {
    if (!currentUnit) return;
    const initialHours = Math.max(0, Math.min(1044, Number(transferHours) || 0));
    const transferred = transferProtoUnitToLive(currentUnit.id, initialHours);
    if (transferred) {
      setCurrentUnit(transferred);
      if (onStatusChanged) onStatusChanged('live');
      setIsTransferModalOpen(false);
      onClose();
    }
  };

  const handleAddObservation = () => {
    if (!observationInput.trim() || !currentUnit) return;
    const updated = addProtoUnitObservation(currentUnit.id, observationInput.trim());
    if (updated) {
      setCurrentUnit(updated);
      setObservationInput('');
      if (onStatusChanged) onStatusChanged();
    }
  };

  const handleDeleteObservation = (obsId: string) => {
    if (!currentUnit) return;
    const updated = deleteProtoUnitObservation(currentUnit.id, obsId);
    if (updated) {
      setCurrentUnit(updated);
      if (onStatusChanged) onStatusChanged();
    }
  };

  // Standardized 12-slot photo mapping with real data and fallback support
  const photoDefinitions = PHOTO_FIELD_DEFINITIONS.map(def => {
    const rawUrl = getPhotoUrlForContentControl(currentUnit.photos, def.photoKey);
    const isMissing = isPhotoMissing(rawUrl);
    return {
      def,
      label: def.label,
      key: def.photoKey,
      legacyKey: def.id,
      url: isMissing ? PICTURE_NOT_AVAILABLE_SVG : rawUrl!.trim(),
      isPlaceholder: isMissing
    };
  });

  const photoList = photoDefinitions;
  const uploadedCount = photoList.filter(p => !p.isPlaceholder).length;

  const observationsList = currentUnit.observations || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-cyan-950/50 to-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-extrabold text-white">{unit.modelName}</h2>
                {(unit.sampleType || unit.reportDetails?.sampleType) && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {unit.sampleType || unit.reportDetails?.sampleType}
                  </span>
                )}
                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                  unit.status === 'live' 
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800 animate-pulse' 
                    : unit.status === 'stopped'
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  {unit.status === 'live' ? '🟢 LIVE' : unit.status === 'stopped' ? '⏸️ STOPPED' : '✅ PASSED'}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                <span>Start Date & Time: <span className="text-slate-200 font-mono font-medium">{getMachineStartDateTime(unit)}</span></span>
                <span className="text-slate-600">•</span>
                <span>End Date & Time: <span className="text-emerald-300 font-mono font-bold">{getMachineEndDateTime(unit)}</span></span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Key Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Station</span>
              <span className="text-xs font-extrabold text-cyan-300">📍 {unit.station || 'Station 01'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">IDU Serial No</span>
              <span className="text-xs font-mono font-bold text-cyan-300">{unit.iduSerialNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">ODU Serial No</span>
              <span className="text-xs font-mono font-bold text-cyan-300">{unit.oduSerialNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Requested By</span>
              <span className="text-xs font-semibold text-indigo-300">{unit.requestBy}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Required / Done</span>
              <span className="text-xs font-bold text-amber-300">
                {unit.requiredHour}h <span className="text-slate-400 font-normal">/ {unit.doneHour || 0}h done</span>
              </span>
            </div>
          </div>

          {/* Test Purpose */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">Test Purpose</span>
            <p className="text-xs text-slate-200 leading-relaxed font-medium">{unit.testPurpose}</p>
          </div>

          {/* Report Details */}
          {unit.reportDetails && (unit.reportDetails.reportNo || unit.reportDetails.sampleType || unit.reportDetails.sampleReceived || unit.reportDetails.testCommenced || unit.reportDetails.testCompleted || unit.sampleType) && (
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Report Details</h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Report No</span>
                  <span className="text-cyan-300 font-mono font-bold">{unit.reportDetails.reportNo || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Sample Type</span>
                  <span className="text-emerald-300 font-semibold">{unit.sampleType || unit.reportDetails.sampleType || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Sample Received</span>
                  <span className="text-white font-medium">{unit.reportDetails.sampleReceived || unit.reportDetails.testCommenced || unit.createdAt?.slice(0, 10) || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Test Commenced</span>
                  <span className="text-cyan-300 font-medium font-mono">{getTestCommencedDate(unit)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Test Completed</span>
                  <span className="font-mono font-bold text-emerald-300">
                    {getTestCompletedDate(unit)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Name Plate Details */}
          {unit.namePlate && (unit.namePlate.coolingCapacity || unit.namePlate.ratedCoolingPower || unit.namePlate.ratedPower || unit.namePlate.mainProgramChecksumIdu || unit.namePlate.mainProgramChecksumOdu || unit.namePlate.gasInjectionVolume || unit.namePlate.powerMode || unit.namePlate.eeChecksumIdu || unit.namePlate.eeChecksumOdu || unit.namePlate.refrigerant || unit.namePlate.iseer) && (
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Settings className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Name Plate Details</h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Cooling Capacity</span>
                  <span className="text-white font-medium">{unit.namePlate.coolingCapacity || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Rated Cooling Power</span>
                  <span className="text-amber-300 font-bold">{unit.namePlate.ratedCoolingPower || unit.namePlate.ratedPower || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Main Program Checksum IDU</span>
                  <span className="text-emerald-300 font-mono font-bold">{unit.namePlate.mainProgramChecksumIdu || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Main Program Checksum ODU</span>
                  <span className="text-emerald-300 font-mono font-bold">{unit.namePlate.mainProgramChecksumOdu || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Gas Injection Volume</span>
                  <span className="text-white font-medium">{unit.namePlate.gasInjectionVolume || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Power Mode</span>
                  <span className="text-white font-medium">{unit.namePlate.powerMode || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">EE Checksum IDU</span>
                  <span className="text-emerald-300 font-mono font-bold">{unit.namePlate.eeChecksumIdu || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">EE Checksum ODU</span>
                  <span className="text-emerald-300 font-mono font-bold">{unit.namePlate.eeChecksumOdu || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Refrigerant</span>
                  <span className="text-white font-medium">{unit.namePlate.refrigerant || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">ISEER</span>
                  <span className="text-white font-medium">{unit.namePlate.iseer || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}

          {/* IDU Details */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Settings className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider">IDU Component Details</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">IDU Motor Spec</span>
                <span className="text-white font-medium">{unit.partsInfo?.iduMotorSpec || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">IDU Motor Part Code</span>
                <span className="text-cyan-300 font-mono font-bold">{unit.partsInfo?.iduMotorPartCode || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">IDU Motor Supplier</span>
                <span className="text-white font-medium">{unit.partsInfo?.iduMotorSupplier || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">IDU PCB Part Code</span>
                <span className="text-cyan-300 font-mono font-bold">{unit.partsInfo?.iduPcbPartCode || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">IDU PCB Supplier</span>
                <span className="text-white font-medium">{unit.partsInfo?.iduPcbSupplier || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* ODU Details */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Settings className="w-4 h-4 text-blue-400" />
              <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider">ODU Component Details</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">ODU Motor Spec</span>
                <span className="text-white font-medium">{unit.partsInfo?.oduMotorSpec || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">ODU Motor Part Code</span>
                <span className="text-cyan-300 font-mono font-bold">{unit.partsInfo?.oduMotorPartCode || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">ODU Motor Supplier</span>
                <span className="text-white font-medium">{unit.partsInfo?.oduMotorSupplier || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">ODU PCB Part Code</span>
                <span className="text-cyan-300 font-mono font-bold">{unit.partsInfo?.oduPcbPartCode || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">ODU PCB Supplier</span>
                <span className="text-white font-medium">{unit.partsInfo?.oduPcbSupplier || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Compressor Details */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Settings className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">Compressor Details</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Compressor Spec</span>
                <span className="text-white font-medium">{unit.partsInfo?.compressorSpec || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Compressor Part Code</span>
                <span className="text-cyan-300 font-mono font-bold">{unit.partsInfo?.compressorPartCode || unit.partsInfo?.oduCompressorPartCode || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Compressor Supplier</span>
                <span className="text-white font-medium">{unit.partsInfo?.compressorSupplier || unit.partsInfo?.oduCompressorSupplier || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* EEV Details */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Settings className="w-4 h-4 text-rose-400" />
              <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider">EEV Details</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">EEV Spec</span>
                <span className="text-white font-medium">{unit.partsInfo?.eevSpec || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">EEV Part Code</span>
                <span className="text-cyan-300 font-mono font-bold">{unit.partsInfo?.eevPartCode || unit.partsInfo?.oduEevPartCode || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">EEV Supplier</span>
                <span className="text-white font-medium">{unit.partsInfo?.eevSupplier || unit.partsInfo?.oduEevSupplier || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Unit Photos Gallery with Centered View */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider">Unit Photos Gallery (Fixed 6 cm × 4 cm Centered View)</h4>
              </div>
              
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  uploadedCount === 0 
                    ? 'bg-amber-950/70 border-amber-800/70 text-amber-300'
                    : 'bg-emerald-950/70 border-emerald-800/70 text-emerald-300'
                }`}>
                  {uploadedCount} / 12 Uploaded
                </span>
              </div>
            </div>

            {/* 12-Slot Standard Inspection Photos Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photoList.map((p, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setSelectedPhoto({ url: p.url, label: p.label })}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-2.5 flex flex-col items-center justify-between gap-2 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between w-full gap-1 min-w-0">
                    <span className="text-[11px] text-slate-200 font-semibold truncate flex-1" title={p.label}>
                      {p.label}
                    </span>
                    {p.isPlaceholder ? (
                      <span className="text-[9px] font-medium text-amber-300 bg-amber-950/70 border border-amber-800/70 px-1.5 py-0.5 rounded shrink-0">
                        No Photo
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium text-emerald-300 bg-emerald-950/70 border border-emerald-800/70 px-1.5 py-0.5 rounded shrink-0">
                        ✓ Uploaded
                      </span>
                    )}
                  </div>

                  {/* Thumbnail Container: fixed 4:3 ratio matching standard 6cm × 4cm */}
                  <div className={`w-full aspect-[4/3] rounded-lg border flex items-center justify-center overflow-hidden relative shadow-inner ${
                    p.isPlaceholder ? 'bg-white border-slate-300' : 'bg-slate-950 border-slate-800'
                  }`}>
                    <img 
                      src={p.url} 
                      alt={p.label} 
                      className="w-full h-full object-contain p-1 select-none" 
                      loading="lazy"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        if (!img.src.startsWith('data:image/svg+xml')) {
                          img.src = PICTURE_NOT_AVAILABLE_SVG;
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-5 h-5 text-cyan-400 drop-shadow" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Remarks */}
          {currentUnit.remarks && (
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Remarks</span>
              <p className="text-xs text-slate-300 leading-relaxed">{currentUnit.remarks}</p>
            </div>
          )}

          {/* Observation Textbox & Add Note Section */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                Observation Notes
              </span>
              {observationsList.length > 0 && (
                <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2.5 py-0.5 rounded-md border border-cyan-800/80">
                  {observationsList.length} {observationsList.length === 1 ? 'Note' : 'Notes'}
                </span>
              )}
            </div>

            {/* Input Box & Add Note Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                placeholder="Enter observation note here..."
                value={observationInput}
                onChange={(e) => setObservationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddObservation();
                  }
                }}
                className="flex-1 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={handleAddObservation}
                className="px-4 py-2.5 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all shrink-0 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add Note</span>
              </button>
            </div>

            {/* List of Observations */}
            {observationsList.length > 0 ? (
              <div className="space-y-2.5 mt-3 pt-3 border-t border-slate-800/80 max-h-52 overflow-y-auto pr-1">
                {observationsList.map((obs) => (
                  <div 
                    key={obs.id} 
                    className="bg-slate-900/90 border border-slate-800/90 p-3 rounded-xl flex items-start justify-between gap-3 text-xs shadow-sm"
                  >
                    <div className="space-y-1 flex-1">
                      <p className="text-slate-200 font-medium leading-relaxed">{obs.text}</p>
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                        {obs.timestamp}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteObservation(obs.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors shrink-0 cursor-pointer"
                      title="Delete Observation Note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic pt-1">
                No observation notes added yet. Type an observation above and click "Add Note".
              </p>
            )}
          </div>

        </div>

        {/* Footer Actions: Generate Report, Transfer to Live (if finished), and Close */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-950/90 border-t border-slate-800 gap-3">
          <div className="flex items-center gap-2.5 flex-1 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => {
                let targetUnit = currentUnit;
                if (observationInput.trim()) {
                  const updated = addProtoUnitObservation(currentUnit.id, observationInput.trim());
                  if (updated) {
                    targetUnit = updated;
                    setCurrentUnit(updated);
                    setObservationInput('');
                  }
                }
                exportUnitToPDF({
                  unit: targetUnit,
                  title: 'Proto Unit Inspection Report',
                  unitType: 'Proto Testing Unit',
                  modelName: targetUnit.modelName,
                  serialNumber: `IDU: ${targetUnit.iduSerialNumber} | ODU: ${targetUnit.oduSerialNumber}`,
                  iduSerialNumber: targetUnit.iduSerialNumber,
                  oduSerialNumber: targetUnit.oduSerialNumber,
                  station: targetUnit.station || 'Station 01',
                  status: targetUnit.status === 'live' ? 'LIVE TESTING' : targetUnit.status === 'stopped' ? 'STOPPED' : 'PASSED',
                  sampleType: targetUnit.sampleType || 'Proto Unit',
                  requestBy: targetUnit.requestBy,
                  testPurpose: targetUnit.testPurpose,
                  requiredHour: `${targetUnit.requiredHour} Hours`,
                  elapsedHours: `${targetUnit.doneHour || 0} Hours`,
                  pendingHours: `${Math.max(0, (targetUnit.requiredHour || 0) - (targetUnit.doneHour || 0))} Hours`,
                  testCommenced: getTestCommencedDate(targetUnit),
                  testCompleted: getTestCompletedDate(targetUnit),
                  endDateTime: targetUnit.endDateTime,
                  createdAt: targetUnit.createdAt,
                  updatedAt: targetUnit.updatedAt,
                  namePlate: targetUnit.namePlate,
                  partsInfo: targetUnit.partsInfo,
                  photos: targetUnit.photos,
                  remarks: targetUnit.remarks || 'Standard proto testing conducted without abnormal vibration or anomalies.',
                  observations: targetUnit.observations || []
                });
              }}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <FileText className="w-4 h-4 stroke-[2.5]" />
              <span>{currentUnit.status === 'finished' ? 'Generate Report' : 'Save PDF'}</span>
            </button>

            {/* Transfer to Live Symbol Button for Finished Units */}
            {currentUnit.status === 'finished' && (
              <button
                type="button"
                id="btn-transfer-proto-live"
                onClick={() => setIsTransferModalOpen(true)}
                className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl text-xs font-black text-amber-200 bg-amber-950/90 hover:bg-amber-900 border-2 border-amber-500/80 shadow-md hover:shadow-amber-950/70 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 group"
                title="Machine ko wapas Live Testing me Transfer karein"
              >
                <ArrowRightLeft className="w-4 h-4 text-amber-400 group-hover:rotate-180 transition-transform duration-300 stroke-[2.5]" />
                <span>Transfer to Live</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer text-center"
          >
            Close
          </button>
        </div>

      </div>

      {/* Transfer to Live Confirmation Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500/80 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-amber-950/80 relative text-white space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <ArrowRightLeft className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Transfer to Live Testing</h3>
                  <p className="text-xs text-amber-200/80 mt-0.5">
                    Machine ko wapas Live section me bhej rahe hain
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Model Name:</span>
                <span className="font-bold text-white">{currentUnit.modelName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Station:</span>
                <span className="font-mono text-cyan-300 font-bold">{currentUnit.station || 'Station 01'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Previous Completed Hours:</span>
                <span className="font-mono font-bold text-emerald-400">{currentUnit.doneHour ?? 1045} hrs</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Live Testing Start Hours (Done Hours)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="1044"
                  value={transferHours}
                  onChange={(e) => setTransferHours(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none"
                  placeholder="0"
                />
                <span className="text-xs font-bold text-slate-400">hrs</span>
              </div>
              <p className="text-[11px] text-slate-400">
                * Default <strong>0 hrs</strong> se shuru hoga taaki Machine nayi live testing 1045 hours tak run ho sake.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTransferToLive}
                className="px-5 py-2.5 rounded-xl text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 shadow-lg shadow-amber-950/60 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4 stroke-[2.5]" />
                <span>Confirm Transfer to Live</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image viewer modal rendered directly into document.body */}
      {selectedPhoto && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-md"
          onClick={() => setSelectedPhoto(null)}
        >
          <div 
            className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-bold text-white">{selectedPhoto.label}</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Close Viewer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center rounded-xl bg-slate-950 p-2 sm:p-4 border border-slate-800/80">
              <img 
                src={selectedPhoto.url} 
                alt={selectedPhoto.label} 
                className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-lg" 
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
