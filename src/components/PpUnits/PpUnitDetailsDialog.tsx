import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Cpu, 
  Clock, 
  User, 
  FileText, 
  Settings, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  Plus, 
  Trash2,
  Zap,
  Box,
  Layers,
  ArrowRightLeft,
  Calendar,
  ImageIcon
} from 'lucide-react';
import { PpUnit } from '../../types';
import { updatePpUnit, togglePpUnitStatus } from '../../services/ppUnitStore';
import { exportUnitToPDF } from '../../utils/pdfExport';
import { formatShortDateTime, getMachineStartDateTime, getMachineEndDateTime, getTestCommencedDate, getTestCompletedDate } from '../../utils/dateFormatter';
import { formatHoursToHHMM } from '../../services/shiftStore';
import { PICTURE_NOT_AVAILABLE_SVG, isPhotoMissing } from '../../utils/placeholderImage';
import { PHOTO_FIELD_DEFINITIONS, getPhotoUrlForContentControl } from '../../utils/photoManager';
import { fetchUnitPhotosFromServer, subscribeToUnitPhotos } from '../../services/cloudPhotoService';

interface PpUnitDetailsDialogProps {
  unit: PpUnit | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateUnit?: (updatedUnit: PpUnit) => void;
  onStatusChanged?: () => void;
}

export const PpUnitDetailsDialog: React.FC<PpUnitDetailsDialogProps> = ({
  unit,
  isOpen,
  onClose,
  onUpdateUnit,
  onStatusChanged,
}) => {
  const [currentUnit, setCurrentUnit] = useState<PpUnit | null>(unit);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; label: string } | null>(null);
  const [observationInput, setObservationInput] = useState('');

  // Keep internal state synced when prop changes and hydrate server photos
  useEffect(() => {
    setCurrentUnit(unit);

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

  const reqHours = typeof currentUnit.requiredHour === 'number' 
    ? currentUnit.requiredHour 
    : parseFloat(currentUnit.requiredHour) || 0;

  // Calculate elapsed and pending hours
  let elapsedHours = 0;
  let pendingHours = reqHours;

  if (currentUnit.status === 'finished') {
    elapsedHours = reqHours;
    pendingHours = 0;
  } else {
    let createdMs = NaN;
    if (currentUnit.createdAt) {
      createdMs = new Date(currentUnit.createdAt.replace(' ', 'T')).getTime();
      if (isNaN(createdMs)) {
        createdMs = new Date(currentUnit.createdAt).getTime();
      }
    }
    const nowMs = Date.now();

    if (!isNaN(createdMs) && createdMs <= nowMs) {
      let endCalculatedMs = nowMs;
      if (currentUnit.status === 'stopped' && currentUnit.updatedAt) {
        let updatedMs = new Date(currentUnit.updatedAt.replace(' ', 'T')).getTime();
        if (isNaN(updatedMs)) {
          updatedMs = new Date(currentUnit.updatedAt).getTime();
        }
        if (!isNaN(updatedMs) && updatedMs >= createdMs) {
          endCalculatedMs = updatedMs;
        }
      }

      const calculatedHours = Math.max(0, (endCalculatedMs - createdMs) / (1000 * 60 * 60));
      elapsedHours = Math.min(reqHours, calculatedHours);
    }
    pendingHours = Math.max(0, reqHours - elapsedHours);
  }

  const doneHHMM = formatHoursToHHMM(elapsedHours);
  const pendingHHMM = formatHoursToHHMM(pendingHours);

  const handleToggleStatus = () => {
    const nextStatus = currentUnit.status === 'live' ? 'finished' : 'live';
    const updated = togglePpUnitStatus(currentUnit.id, nextStatus);
    if (updated) {
      setCurrentUnit(updated);
      if (onUpdateUnit) onUpdateUnit(updated);
    }
  };

  const handleAddObservation = () => {
    if (!observationInput.trim()) return;
    const newObs = {
      id: Date.now().toString(),
      text: observationInput.trim(),
      timestamp: new Date().toLocaleString(),
    };
    const updatedObservations = [...(currentUnit.observations || []), newObs];
    const updated = updatePpUnit(currentUnit.id, { observations: updatedObservations });
    if (updated) {
      setCurrentUnit(updated);
      if (onUpdateUnit) onUpdateUnit(updated);
    }
    setObservationInput('');
  };

  const handleDeleteObservation = (id: string) => {
    const updatedObservations = (currentUnit.observations || []).filter(o => o.id !== id);
    const updated = updatePpUnit(currentUnit.id, { observations: updatedObservations });
    if (updated) {
      setCurrentUnit(updated);
      if (onUpdateUnit) onUpdateUnit(updated);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex-none flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-cyan-950/50 to-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-white">{currentUnit.modelName}</h2>
                {(currentUnit.sampleType || currentUnit.reportDetails?.sampleType) && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {currentUnit.sampleType || currentUnit.reportDetails?.sampleType}
                  </span>
                )}
                {currentUnit.unitType && (
                  <span className={`px-2 py-0.5 text-[10px] font-black rounded-md border ${
                    currentUnit.unitType === 'IDU'
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                      : currentUnit.unitType === 'ODU'
                      ? 'bg-blue-950 text-blue-300 border-blue-800'
                      : 'bg-indigo-950 text-indigo-300 border-indigo-800'
                  }`}>
                    {currentUnit.unitType}
                  </span>
                )}
                {currentUnit.materialCode && (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-slate-950 text-slate-300 border border-slate-800">
                    {currentUnit.materialCode}
                  </span>
                )}
                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                  currentUnit.status === 'live' 
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800 animate-pulse' 
                    : currentUnit.status === 'stopped'
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  {currentUnit.status === 'live' ? '🟢 LIVE' : currentUnit.status === 'stopped' ? '⏸️ STOPPED' : '✅ PASSED'}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                <span>Start Date & Time: <span className="text-slate-200 font-mono font-medium">{getMachineStartDateTime(currentUnit)}</span></span>
                <span className="text-slate-600">•</span>
                <span>End Date & Time: <span className="text-emerald-300 font-mono font-bold">{getMachineEndDateTime(currentUnit)}</span></span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Key Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Testing Station</span>
              <span className="text-xs font-extrabold text-cyan-300">📍 {currentUnit.station || 'Station 01'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">IDU Serial No</span>
              <span className="text-xs font-mono font-bold text-cyan-300">{currentUnit.iduSerialNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">ODU Serial No</span>
              <span className="text-xs font-mono font-bold text-cyan-300">{currentUnit.oduSerialNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Requested By</span>
              <span className="text-xs font-semibold text-indigo-300">{currentUnit.requestBy}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Required Duration</span>
              <span className="text-xs font-mono font-bold text-amber-300">{currentUnit.requiredHour} Hours</span>
            </div>
          </div>

          {/* Running Hours Progress Pill */}
          <div className="flex items-center justify-between gap-4 bg-slate-950/90 px-4 py-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-300 font-bold">Testing Progress:</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="text-emerald-400 font-bold">
                Done: <strong className="text-emerald-300">{doneHHMM}</strong>
              </div>
              <div className="text-slate-600">|</div>
              <div className="text-amber-300 font-bold">
                Pending: <strong className="text-amber-200">{pendingHHMM}</strong>
              </div>
            </div>
          </div>

          {/* Test Purpose */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">Test Purpose</span>
            <p className="text-xs text-slate-200 leading-relaxed font-medium">{currentUnit.testPurpose || 'Standard PP Trial Unit Verification'}</p>
          </div>

          {/* Report Details */}
          {currentUnit.reportDetails && (currentUnit.reportDetails.reportNo || currentUnit.reportDetails.sampleType || currentUnit.reportDetails.sampleReceived || currentUnit.reportDetails.testCommenced || currentUnit.reportDetails.testCompleted || currentUnit.sampleType) && (
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Report & Timeline Details</h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Report No</span>
                  <span className="text-cyan-300 font-mono font-bold">{currentUnit.reportDetails.reportNo || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Sample Type</span>
                  <span className="text-emerald-300 font-semibold">{currentUnit.sampleType || currentUnit.reportDetails.sampleType || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Sample Received</span>
                  <span className="text-white font-medium">{currentUnit.reportDetails.sampleReceived || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Test Commenced</span>
                  <span className="text-cyan-300 font-medium font-mono">{getTestCommencedDate(currentUnit)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Test Completed</span>
                  <span className="text-emerald-300 font-mono font-bold">{getTestCompletedDate(currentUnit)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Name Plate & Technical Specs */}
          {currentUnit.namePlate && (
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Settings className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Nameplate & Technical Specifications</h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {currentUnit.namePlate.coolingCapacity && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Cooling Capacity</span>
                    <span className="text-white font-mono font-bold">{currentUnit.namePlate.coolingCapacity}</span>
                  </div>
                )}
                {(currentUnit.namePlate.ratedCoolingPower || currentUnit.namePlate.ratedPower) && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Rated Cooling Power</span>
                    <span className="text-amber-300 font-mono font-bold">{currentUnit.namePlate.ratedCoolingPower || currentUnit.namePlate.ratedPower}</span>
                  </div>
                )}
                {currentUnit.namePlate.ratedPower && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Rated Power</span>
                    <span className="text-white font-mono font-bold">{currentUnit.namePlate.ratedPower}</span>
                  </div>
                )}
                {currentUnit.namePlate.ratedCurrent && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Rated Current</span>
                    <span className="text-white font-mono font-bold">{currentUnit.namePlate.ratedCurrent}</span>
                  </div>
                )}
                {currentUnit.namePlate.voltage && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Voltage</span>
                    <span className="text-white font-mono font-bold">{currentUnit.namePlate.voltage}</span>
                  </div>
                )}
                {currentUnit.namePlate.iseer && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">ISEER</span>
                    <span className="text-white font-bold">{currentUnit.namePlate.iseer}</span>
                  </div>
                )}
                {currentUnit.namePlate.gasQty && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Gas Qty</span>
                    <span className="text-white font-mono font-bold">{currentUnit.namePlate.gasQty}</span>
                  </div>
                )}
                {currentUnit.namePlate.refrigerant && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Refrigerant</span>
                    <span className="text-white font-medium">{currentUnit.namePlate.refrigerant}</span>
                  </div>
                )}
                {currentUnit.namePlate.powerMode && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Power Mode</span>
                    <span className="text-white font-medium">{currentUnit.namePlate.powerMode}</span>
                  </div>
                )}
                {currentUnit.namePlate.mainProgramChecksumIdu && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Main Program Checksum IDU</span>
                    <span className="text-emerald-300 font-mono font-bold">{currentUnit.namePlate.mainProgramChecksumIdu}</span>
                  </div>
                )}
                {currentUnit.namePlate.mainProgramChecksumOdu && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">Main Program Checksum ODU</span>
                    <span className="text-emerald-300 font-mono font-bold">{currentUnit.namePlate.mainProgramChecksumOdu}</span>
                  </div>
                )}
                {currentUnit.namePlate.eeChecksumIdu && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">EE Checksum IDU</span>
                    <span className="text-emerald-300 font-mono font-bold">{currentUnit.namePlate.eeChecksumIdu}</span>
                  </div>
                )}
                {currentUnit.namePlate.eeChecksumOdu && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">EE Checksum ODU</span>
                    <span className="text-emerald-300 font-mono font-bold">{currentUnit.namePlate.eeChecksumOdu}</span>
                  </div>
                )}
                {(currentUnit.namePlate.fourWaySwing || currentUnit.fourWaySwing || currentUnit.partsInfo?.fourWaySwing) && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">4 Way Swing</span>
                    <span className="text-cyan-300 font-semibold">{currentUnit.namePlate.fourWaySwing || currentUnit.fourWaySwing || currentUnit.partsInfo?.fourWaySwing}</span>
                  </div>
                )}
                {(currentUnit.namePlate.rpm || currentUnit.rpm || currentUnit.partsInfo?.rpm || currentUnit.partsInfo?.iduRpm) && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">RPM</span>
                    <span className="text-emerald-300 font-mono font-bold">{currentUnit.namePlate.rpm || currentUnit.rpm || currentUnit.partsInfo?.rpm || currentUnit.partsInfo?.iduRpm}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* IDU Component Details */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Settings className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider">IDU Component Details</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">IDU Motor Spec</span>
                <span className="text-white font-medium">{currentUnit.partsInfo?.iduMotorSpec || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">IDU Motor Part Code</span>
                <span className="text-cyan-300 font-mono font-bold">{currentUnit.partsInfo?.iduMotorPartCode || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">IDU Motor Supplier</span>
                <span className="text-white font-medium">{currentUnit.partsInfo?.iduMotorSupplier || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">IDU PCB Part Code</span>
                <span className="text-cyan-300 font-mono font-bold">{currentUnit.partsInfo?.iduPcbPartCode || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">IDU PCB Supplier</span>
                <span className="text-white font-medium">{currentUnit.partsInfo?.iduPcbSupplier || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* ODU Component Details */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Settings className="w-4 h-4 text-blue-400" />
              <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider">ODU Component Details</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">ODU Motor Spec</span>
                <span className="text-white font-medium">{currentUnit.partsInfo?.oduMotorSpec || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">ODU Motor Part Code</span>
                <span className="text-cyan-300 font-mono font-bold">{currentUnit.partsInfo?.oduMotorPartCode || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">ODU Motor Supplier</span>
                <span className="text-white font-medium">{currentUnit.partsInfo?.oduMotorSupplier || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">ODU PCB Part Code</span>
                <span className="text-cyan-300 font-mono font-bold">{currentUnit.partsInfo?.oduPcbPartCode || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">ODU PCB Supplier</span>
                <span className="text-white font-medium">{currentUnit.partsInfo?.oduPcbSupplier || 'N/A'}</span>
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
                <span className="text-white font-medium">{currentUnit.partsInfo?.compressorSpec || currentUnit.partsInfo?.oduCompressorSpec || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Compressor Part Code</span>
                <span className="text-cyan-300 font-mono font-bold">{currentUnit.partsInfo?.compressorPartCode || currentUnit.partsInfo?.oduCompressorPartCode || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Compressor Supplier</span>
                <span className="text-white font-medium">{currentUnit.partsInfo?.compressorSupplier || currentUnit.partsInfo?.oduCompressorSupplier || 'N/A'}</span>
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
                <span className="text-white font-medium">{currentUnit.partsInfo?.eevSpec || currentUnit.partsInfo?.oduEevSpec || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">EEV Part Code</span>
                <span className="text-cyan-300 font-mono font-bold">{currentUnit.partsInfo?.eevPartCode || currentUnit.partsInfo?.oduEevPartCode || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">EEV Supplier</span>
                <span className="text-white font-medium">{currentUnit.partsInfo?.eevSupplier || currentUnit.partsInfo?.oduEevSupplier || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Unit Photos Gallery with Centered View */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Unit Photos Gallery (Fixed 6 cm × 4 cm Centered View)</h4>
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

          {/* Observation Notes & Logs */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
              Observation Notes & Quality Records
            </span>

            {/* Input to add observation note */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type testing observation note..."
                value={observationInput}
                onChange={(e) => setObservationInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddObservation()}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleAddObservation}
                className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add Note</span>
              </button>
            </div>

            {/* Existing Notes List */}
            {observationsList.length > 0 ? (
              <div className="space-y-2 mt-2">
                {observationsList.map((obs) => (
                  <div key={obs.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-200 font-medium">{obs.text}</p>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">{obs.timestamp}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteObservation(obs.id)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">No custom observation notes added yet.</p>
            )}
          </div>

          {/* Remarks */}
          {currentUnit.remarks && (
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Remarks</span>
              <p className="text-xs text-slate-300 font-medium">{currentUnit.remarks}</p>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="flex-none px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => {
              exportUnitToPDF({
                unit: currentUnit,
                title: 'PP Unit Inspection Report',
                unitType: 'PP Testing Unit',
                modelName: currentUnit.modelName,
                serialNumber: `IDU: ${currentUnit.iduSerialNumber} | ODU: ${currentUnit.oduSerialNumber}`,
                iduSerialNumber: currentUnit.iduSerialNumber,
                oduSerialNumber: currentUnit.oduSerialNumber,
                station: currentUnit.station || 'Station 01',
                status: currentUnit.status === 'finished' ? 'PASSED' : currentUnit.status === 'live' ? 'LIVE TESTING' : 'STOPPED',
                sampleType: currentUnit.sampleType || currentUnit.reportDetails?.sampleType || 'PP Unit',
                materialCode: currentUnit.materialCode,
                version: currentUnit.version,
                quantity: currentUnit.quantity,
                requestBy: currentUnit.requestBy,
                testPurpose: currentUnit.testPurpose || 'Standard PP Trial Unit Verification',
                requiredHour: `${currentUnit.requiredHour} Hours`,
                elapsedHours: doneHHMM,
                pendingHours: pendingHHMM,
                testCommenced: currentUnit.reportDetails?.testCommenced || currentUnit.createdAt,
                testCompleted: currentUnit.reportDetails?.testCompleted || currentUnit.endDateTime || currentUnit.completedAt || 'In Progress',
                endDateTime: currentUnit.endDateTime,
                createdAt: currentUnit.createdAt,
                updatedAt: currentUnit.updatedAt,
                namePlate: currentUnit.namePlate,
                partsInfo: currentUnit.partsInfo,
                photos: currentUnit.photos,
                remarks: currentUnit.remarks || 'PP sample passed inspection standards.',
                observations: currentUnit.observations || []
              });
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-800/80 hover:bg-cyan-900 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Download PDF Report</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleStatus}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                currentUnit.status === 'live'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900'
                  : 'bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Mark as {currentUnit.status === 'live' ? 'Finished (Pass)' : 'Live'}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>

      {/* Photo View Modal rendered directly into document.body */}
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
