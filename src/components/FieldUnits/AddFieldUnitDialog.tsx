import React, { useState, useEffect } from 'react';
import { X, Plus, Cpu, Clock, Calendar, User, FileText, Activity, Save, Tag } from 'lucide-react';
import { addFieldUnit, updateFieldUnit, addFieldUnitObservation } from '../../services/fieldUnitStore';
import { ALL_STATIONS, getOccupiedStations } from '../../utils/stationManager';
import { FieldUnit } from '../../types';

interface AddFieldUnitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (status?: 'live' | 'stopped') => void;
  initialUnit?: FieldUnit | null;
}

export const AddFieldUnitDialog: React.FC<AddFieldUnitDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialUnit,
}) => {
  const [modelName, setModelName] = useState('');
  const [productType, setProductType] = useState<'IDU' | 'ODU' | 'BOTH'>('BOTH');
  const [iduSerialNumber, setIduSerialNumber] = useState('');
  const [oduSerialNumber, setOduSerialNumber] = useState('');
  const [observation, setObservation] = useState('');
  const [requestBy, setRequestBy] = useState('');
  const [station, setStation] = useState('Station 01');
  const [startDateTime, setStartDateTime] = useState(() => {
    const now = new Date();
    const isoStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
    return isoStr.slice(0, 16); // YYYY-MM-DDTHH:mm
  });
  const [requiredHour, setRequiredHour] = useState<number>(48);
  const [doneHour, setDoneHour] = useState<number>(0);
  const [remarks, setRemarks] = useState('');

  const occupiedSet = getOccupiedStations();

  useEffect(() => {
    if (isOpen) {
      if (initialUnit) {
        setModelName(initialUnit.modelName || '');
        setProductType(initialUnit.productType || 'BOTH');
        setIduSerialNumber(initialUnit.iduSerialNumber || '');
        setOduSerialNumber(initialUnit.oduSerialNumber || '');
        setRequestBy(initialUnit.requestBy || '');
        setStation(initialUnit.station || 'Station 01');
        if (initialUnit.startDateTime) {
          setStartDateTime(initialUnit.startDateTime.replace(' ', 'T').slice(0, 16));
        }
        setRequiredHour(initialUnit.requiredHour ?? 48);
        setDoneHour(initialUnit.doneHour ?? 0);
        setRemarks(initialUnit.remarks || '');
        setObservation('');
      } else {
        const occupied = getOccupiedStations();
        const firstAvailable = ALL_STATIONS.find(s => !occupied.has(s)) || ALL_STATIONS[0];
        setStation(firstAvailable);

        // Refresh startDateTime to exact current time when dialog opens
        const now = new Date();
        const isoStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setStartDateTime(isoStr);
        setModelName('');
        setProductType('BOTH');
        setIduSerialNumber('');
        setOduSerialNumber('');
        setObservation('');
        setRequestBy('');
        setRequiredHour(48);
        setDoneHour(0);
        setRemarks('');
      }
    }
  }, [isOpen, initialUnit]);

  if (!isOpen) return null;

  const saveUnit = (targetStatus: 'live' | 'stopped') => {
    if (!modelName.trim()) {
      alert('Please enter Model Name.');
      return;
    }

    if (productType === 'IDU' && !iduSerialNumber.trim()) {
      alert('Please enter IDU Serial Number.');
      return;
    }

    if (productType === 'ODU' && !oduSerialNumber.trim()) {
      alert('Please enter ODU Serial Number.');
      return;
    }

    if (productType === 'BOTH' && (!iduSerialNumber.trim() || !oduSerialNumber.trim())) {
      alert('Please enter both IDU and ODU Serial Numbers.');
      return;
    }

    // Build composite serial number string for easy display
    let serialDisplay = '';
    if (productType === 'IDU') {
      serialDisplay = `IDU: ${iduSerialNumber.trim()}`;
    } else if (productType === 'ODU') {
      serialDisplay = `ODU: ${oduSerialNumber.trim()}`;
    } else {
      serialDisplay = `IDU: ${iduSerialNumber.trim()} | ODU: ${oduSerialNumber.trim()}`;
    }

    // Format start date time display (e.g. 2026-07-30 14:30)
    const formattedStartDateTime = startDateTime.replace('T', ' ');

    if (initialUnit) {
      updateFieldUnit(initialUnit.id, {
        modelName: modelName.trim(),
        productType,
        iduSerialNumber: productType !== 'ODU' ? iduSerialNumber.trim() : undefined,
        oduSerialNumber: productType !== 'IDU' ? oduSerialNumber.trim() : undefined,
        serialNumber: serialDisplay,
        requestBy: requestBy.trim() || 'R&D Field Engineer',
        station: station.trim() || 'Station 01',
        startDateTime: formattedStartDateTime,
        requiredHour: Number(requiredHour) || 24,
        doneHour: Number(doneHour) || 0,
        status: targetStatus,
        remarks: remarks.trim()
      });

      if (observation.trim()) {
        addFieldUnitObservation(initialUnit.id, observation.trim());
      }
    } else {
      const newUnit = addFieldUnit({
        modelName: modelName.trim(),
        productType,
        iduSerialNumber: productType !== 'ODU' ? iduSerialNumber.trim() : undefined,
        oduSerialNumber: productType !== 'IDU' ? oduSerialNumber.trim() : undefined,
        serialNumber: serialDisplay,
        requestBy: requestBy.trim() || 'R&D Field Engineer',
        station: station.trim() || 'Station 01',
        startDateTime: formattedStartDateTime,
        requiredHour: Number(requiredHour) || 24,
        doneHour: Number(doneHour) || 0,
        status: targetStatus,
        remarks: remarks.trim()
      });

      // If observation text was entered, add initial observation
      if (observation.trim() && newUnit?.id) {
        addFieldUnitObservation(newUnit.id, observation.trim());
      }
    }

    // Reset form
    setModelName('');
    setProductType('BOTH');
    setIduSerialNumber('');
    setOduSerialNumber('');
    setObservation('');
    setRequestBy('');
    setStation('Station 01');
    setRequiredHour(48);
    setDoneHour(0);
    setRemarks('');

    onSuccess(targetStatus);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveUnit('live');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header (Pinned Top) */}
        <div className="flex-none p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-950 to-emerald-950 border border-cyan-800/80 text-cyan-400 rounded-2xl shadow-inner">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide">
                {initialUnit ? 'Edit Field Unit (Draft)' : 'Add Field Unit'}
              </h2>
              <p className="text-xs text-slate-400">
                {initialUnit ? 'Update draft field testing unit parameters' : 'Register new field testing unit into Live monitoring'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* 1. Model Name & 2. Product Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-slate-300 mb-1.5 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>1. Field Unit Model Name <span className="text-rose-400">*</span></span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. HSI19T-S2NB-F"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all font-semibold shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-300 mb-1.5 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-emerald-400" />
                <span>2. Product Type <span className="text-rose-400">*</span></span>
              </label>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value as 'IDU' | 'ODU' | 'BOTH')}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all font-semibold"
              >
                <option value="IDU">IDU (Indoor Unit)</option>
                <option value="ODU">ODU (Outdoor Unit)</option>
                <option value="BOTH">BOTH (IDU + ODU)</option>
              </select>
            </div>
          </div>

          {/* Conditional Serial Number Textboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
            {(productType === 'IDU' || productType === 'BOTH') && (
              <div>
                <label className="block text-xs font-bold text-cyan-300 mb-1.5">
                  IDU Serial Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IDU-88219-A"
                  value={iduSerialNumber}
                  onChange={(e) => setIduSerialNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                />
              </div>
            )}

            {(productType === 'ODU' || productType === 'BOTH') && (
              <div>
                <label className="block text-xs font-bold text-emerald-300 mb-1.5">
                  ODU Serial Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ODU-88219-B"
                  value={oduSerialNumber}
                  onChange={(e) => setOduSerialNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                />
              </div>
            )}
          </div>

          {/* 3. Observations Text Box & 4. Request By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-slate-300 mb-1.5 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                3. Observations
              </label>
              <input
                type="text"
                placeholder="Initial observation note..."
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-300 mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                4. Request By
              </label>
              <input
                type="text"
                placeholder="e.g. Suresh Verma"
                value={requestBy}
                onChange={(e) => setRequestBy(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {/* 5. Station & 6. Start Date/Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  5. Station (01 to 20) <span className="text-rose-400">*</span>
                </span>
              </label>
              <select
                value={station}
                onChange={(e) => setStation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-500 transition-colors"
              >
                {ALL_STATIONS.map((st) => {
                  const isOccupied = occupiedSet.has(st);
                  return (
                    <option
                      key={st}
                      value={st}
                      disabled={isOccupied}
                      className={isOccupied ? 'text-slate-500 bg-slate-950 font-normal' : 'text-slate-100 bg-slate-900 font-bold'}
                    >
                      {st} {isOccupied ? '🔴 (Occupied in Live)' : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                * Stations occupied in Live testing (Proto/Field) cannot be selected.
              </p>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-300 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                6. Start Date/Time
              </label>
              <input
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors font-mono"
              />
            </div>
          </div>

          {/* 7. Required Hour & Done Hour & 8. Remark */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-extrabold text-slate-300 mb-1.5 flex items-center gap-1 truncate">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  7. Required (h)
                </label>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  placeholder="e.g. 48"
                  value={requiredHour}
                  onChange={(e) => setRequiredHour(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors font-mono font-bold"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-extrabold text-slate-300 truncate">
                    Done (h)
                  </label>
                  <span className="text-[9px] font-mono font-bold text-amber-400">
                    Rem: {Math.max(0, (Number(requiredHour) || 0) - (Number(doneHour) || 0))}h
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  max={Number(requiredHour) || 5000}
                  placeholder="0"
                  value={doneHour}
                  onChange={(e) => setDoneHour(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-300 mb-1.5">
                8. Remark
              </label>
              <input
                type="text"
                placeholder="e.g. High temperature endurance test"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>
          </div>

          {/* Footer Submit & Draft Buttons (Pinned Bottom) */}
          <div className="flex-none px-6 py-4 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => saveUnit('stopped')}
              className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-amber-300 bg-amber-950/80 border border-amber-800/80 hover:bg-amber-900 shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-4 h-4 text-amber-400" />
              <span>Save Draft</span>
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-lg shadow-cyan-950/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{initialUnit ? 'Update & Start Live' : 'Submit'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
