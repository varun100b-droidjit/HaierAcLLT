import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Calendar, 
  Clock, 
  FileText, 
  Plus, 
  Trash2, 
  Compass, 
  Download,
  Activity
} from 'lucide-react';
import { FieldUnit } from '../../types';
import { addFieldUnitObservation, deleteFieldUnitObservation } from '../../services/fieldUnitStore';
import { exportUnitToPDF } from '../../utils/pdfExport';

interface FieldUnitDetailsDialogProps {
  unit: FieldUnit | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged?: () => void;
}

export const FieldUnitDetailsDialog: React.FC<FieldUnitDetailsDialogProps> = ({
  unit,
  isOpen,
  onClose,
  onStatusChanged,
}) => {
  const [currentUnit, setCurrentUnit] = useState<FieldUnit | null>(unit);
  const [observationInput, setObservationInput] = useState('');

  useEffect(() => {
    setCurrentUnit(unit);
    setObservationInput('');
  }, [unit]);

  if (!isOpen || !currentUnit) return null;

  const handleAddObservation = () => {
    if (!observationInput.trim() || !currentUnit) return;
    const updated = addFieldUnitObservation(currentUnit.id, observationInput.trim());
    if (updated) {
      setCurrentUnit(updated);
      setObservationInput('');
      if (onStatusChanged) onStatusChanged();
    }
  };

  const handleDeleteObservation = (obsId: string) => {
    if (!currentUnit) return;
    const updated = deleteFieldUnitObservation(currentUnit.id, obsId);
    if (updated) {
      setCurrentUnit(updated);
      if (onStatusChanged) onStatusChanged();
    }
  };

  const observationsList = currentUnit.observations || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-950 to-emerald-950 border border-cyan-800/80 text-cyan-400 rounded-2xl">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-wide">{currentUnit.modelName}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  currentUnit.status === 'live'
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                    : currentUnit.status === 'stopped'
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                }`}>
                  {currentUnit.status === 'live' ? 'LIVE FIELD' : currentUnit.status === 'stopped' ? 'STOPPED' : 'PASSED'}
                </span>
              </div>
              <p className="text-xs font-mono text-cyan-400 mt-0.5 font-bold">{currentUnit.serialNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Key Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] text-slate-400 block font-medium flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-cyan-400" /> Station
              </span>
              <span className="font-bold text-cyan-300 text-sm">{currentUnit.station || 'Station 01'}</span>
            </div>

            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] text-slate-400 block font-medium flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-indigo-400" /> Request By
              </span>
              <span className="font-bold text-indigo-200 text-sm">{currentUnit.requestBy}</span>
            </div>

            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] text-slate-400 block font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Start Date/Time
              </span>
              <span className="font-bold text-slate-200 text-sm font-mono">{currentUnit.startDateTime}</span>
            </div>

            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] text-slate-400 block font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-purple-400" /> Required Hour
              </span>
              <span className="font-bold text-purple-200 text-sm font-mono">{currentUnit.requiredHour} Hours</span>
            </div>

            {(currentUnit.endDateTime || currentUnit.status === 'stopped' || currentUnit.status === 'finished') && (
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-1 sm:col-span-2">
                <span className="text-[10px] text-amber-400 block font-bold flex items-center gap-1 uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" /> End Date/Time
                </span>
                <span className="font-extrabold text-cyan-300 text-sm font-mono">
                  {currentUnit.endDateTime || 'Recorded on Status Change'}
                </span>
              </div>
            )}
          </div>

          {/* Remarks */}
          {currentUnit.remarks && (
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Remarks / Notes</span>
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

        {/* Footer Actions with strictly 2 buttons: Save PDF and Close */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              let targetUnit = currentUnit;
              if (observationInput.trim()) {
                const updated = addFieldUnitObservation(currentUnit.id, observationInput.trim());
                if (updated) {
                  targetUnit = updated;
                  setCurrentUnit(updated);
                  setObservationInput('');
                }
              }
              exportUnitToPDF({
                unit: targetUnit,
                title: 'Field Unit Deployment Report',
                unitType: 'Field Tested Unit',
                modelName: targetUnit.modelName,
                serialNumber: targetUnit.serialNumber,
                iduSerialNumber: targetUnit.iduSerialNumber,
                oduSerialNumber: targetUnit.oduSerialNumber,
                station: targetUnit.station || 'Station 01',
                status: targetUnit.status === 'live' ? 'LIVE FIELD' : targetUnit.status === 'stopped' ? 'STOPPED' : 'PASSED',
                requestBy: targetUnit.requestBy,
                requiredHour: `${targetUnit.requiredHour} Hours`,
                testCommenced: targetUnit.startDateTime,
                testCompleted: targetUnit.endDateTime || 'Testing Ongoing',
                createdAt: targetUnit.createdAt,
                updatedAt: targetUnit.updatedAt,
                remarks: targetUnit.remarks || 'Field testing performance monitored according to ambient test standards.',
                observations: targetUnit.observations || []
              });
            }}
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>Save PDF</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
