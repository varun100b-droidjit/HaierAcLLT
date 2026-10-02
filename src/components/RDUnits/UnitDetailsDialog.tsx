import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileText, 
  Calendar, 
  Clock, 
  User, 
  Tag, 
  Hash, 
  AlertCircle, 
  MessageSquare,
  CheckCircle2,
  Activity,
  Plus,
  Trash2,
  Download,
  AlertTriangle,
  CalendarPlus
} from 'lucide-react';
import { Unit, WORKFLOW_STAGES } from '../../types';
import { addUnitObservation, deleteUnitObservation, extendUnitRequiredDate, calculateRemainingDays, isUnitOverdue } from '../../services/unitStore';
import { exportUnitToPDF } from '../../utils/pdfExport';

interface UnitDetailsDialogProps {
  unit: Unit | null;
  isOpen: boolean;
  onClose: () => void;
}

export const UnitDetailsDialog: React.FC<UnitDetailsDialogProps> = ({
  unit,
  isOpen,
  onClose,
}) => {
  const [currentUnit, setCurrentUnit] = useState<Unit | null>(unit);
  const [observationInput, setObservationInput] = useState('');
  const [daysToAdd, setDaysToAdd] = useState<number | string>(1);

  useEffect(() => {
    setCurrentUnit(unit);
  }, [unit]);

  useEffect(() => {
    if (unit?.id) {
      setObservationInput('');
      setDaysToAdd(1);
    }
  }, [unit?.id]);

  if (!isOpen || !currentUnit) return null;

  const remainingDays = calculateRemainingDays(currentUnit.requiredBy);
  const isOverdue = isUnitOverdue(currentUnit);

  const handleApplyExtension = () => {
    const numDays = Math.max(1, parseInt(String(daysToAdd), 10) || 1);
    if (!currentUnit || numDays <= 0) return;
    const updated = extendUnitRequiredDate(currentUnit.id, numDays);
    if (updated) {
      setCurrentUnit(updated);
    }
  };

  const handleAddObservation = () => {
    if (!observationInput.trim() || !currentUnit) return;
    const updated = addUnitObservation(currentUnit.id, observationInput.trim());
    if (updated) {
      setCurrentUnit(updated);
      setObservationInput('');
    }
  };

  const handleDeleteObservation = (obsId: string) => {
    if (!currentUnit) return;
    const updated = deleteUnitObservation(currentUnit.id, obsId);
    if (updated) {
      setCurrentUnit(updated);
    }
  };

  const stageInfo = WORKFLOW_STAGES[currentUnit.currentStageIndex] || WORKFLOW_STAGES[0];
  const observationsList = currentUnit.observations || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-6">
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-cyan-400 tracking-wider">
                Machine Full Specification
              </span>
              <h2 className="text-lg font-extrabold text-white">
                Machine Details
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body with specified details */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Key Identification Header */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono text-slate-400 uppercase">Model Name</div>
              <div className="text-base font-bold text-cyan-300">{currentUnit.modelName}</div>
            </div>
            <div className="sm:text-right">
              <div className="text-[11px] font-mono text-slate-400 uppercase">Serial Number</div>
              <div className="text-sm font-mono font-bold text-white bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 inline-block mt-0.5">
                {currentUnit.serialNumber}
              </div>
            </div>
          </div>

          {/* Overdue Day Increase Box (Only visible when Unit is Overdue) */}
          {isOverdue && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/90 via-slate-900 to-rose-950/90 border border-rose-500/80 shadow-lg shadow-rose-950/40 space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-rose-300">Unit Overdue Alert!</h4>
                    <p className="text-[11px] text-slate-300">Target timeline ended. Select days to increase & click Apply.</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800">
                  OVERDUE
                </span>
              </div>

              {/* Day Increase Input & Apply Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs text-slate-300 font-semibold whitespace-nowrap flex items-center gap-1">
                    <CalendarPlus className="w-3.5 h-3.5 text-amber-400" /> Increase Days:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={daysToAdd}
                    onChange={(e) => setDaysToAdd(e.target.value)}
                    onBlur={() => {
                      if (!daysToAdd || parseInt(String(daysToAdd), 10) < 1) {
                        setDaysToAdd(1);
                      }
                    }}
                    className="w-24 bg-slate-900 border border-rose-500/50 focus:border-rose-400 rounded-xl px-3 py-1.5 text-xs text-center text-white font-bold focus:outline-none"
                    placeholder="1"
                  />
                  <span className="text-xs text-slate-400">Days</span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1 flex-wrap">
                  {[1, 2, 5, 7, 10, 15, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDaysToAdd(d)}
                      className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                        Number(daysToAdd) === d 
                          ? 'bg-amber-400 text-slate-950' 
                          : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      +{d}d
                    </button>
                  ))}
                </div>

                {/* Apply Button */}
                <button
                  type="button"
                  onClick={handleApplyExtension}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all shrink-0 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Apply</span>
                </button>
              </div>
            </div>
          )}

          {/* Grid of Details: Required by, Transfer Date, Duration, Request by */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Required By */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
              <div className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-amber-400" /> Required By:
              </div>
              <div className="text-sm font-bold text-white">{currentUnit.requiredBy}</div>
            </div>

            {/* Transfer Date */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
              <div className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Transfer Date:
              </div>
              <div className="text-sm font-semibold text-slate-200">{currentUnit.transferDate}</div>
            </div>

            {/* Duration */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
              <div className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-indigo-400" /> Duration:
              </div>
              <div className="text-sm font-bold text-indigo-300">{currentUnit.dayDuration} Days</div>
            </div>

            {/* Request by / Personnel */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
              <div className="text-slate-400 flex items-center gap-1.5 font-medium">
                <User className="w-3.5 h-3.5 text-teal-400" /> Request By:
              </div>
              <div className="text-sm font-semibold text-teal-200">
                {currentUnit.rdPerson || currentUnit.bsrPerson || 'R&D Person'}
              </div>
            </div>
          </div>

          {/* Current Stage */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <span className="text-slate-400">Current Stage ({currentUnit.currentStageIndex + 1}/10):</span>
            </div>
            <span className="font-bold text-cyan-300 bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
              {stageInfo.stageName} ({stageInfo.department})
            </span>
          </div>

          {/* Remark / Notes */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div className="text-slate-400 flex items-center gap-1.5 text-xs font-semibold">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" /> Remarks / Notes:
            </div>
            <p className="text-xs text-slate-200 bg-slate-900 p-3 rounded-xl border border-slate-800 leading-relaxed italic">
              {currentUnit.notes || 'No custom remarks provided for this machine.'}
            </p>
          </div>

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

        {/* Footer with strictly 2 buttons: Save PDF and Close */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              let targetUnit = currentUnit;
              if (observationInput.trim()) {
                const updated = addUnitObservation(currentUnit.id, observationInput.trim());
                if (updated) {
                  targetUnit = updated;
                  setCurrentUnit(updated);
                  setObservationInput('');
                }
              }
              exportUnitToPDF({
                unit: targetUnit,
                title: 'R&D Transfer Unit Report',
                unitType: 'R&D Machine Unit',
                modelName: targetUnit.modelName,
                serialNumber: targetUnit.serialNumber,
                status: `${stageInfo.stageName} (${stageInfo.department})`,
                requestBy: targetUnit.rdPerson || targetUnit.bsrPerson || 'R&D Lead',
                testPurpose: `R&D Stage Testing: ${stageInfo.stageName} under ${stageInfo.department}`,
                requiredHour: `${targetUnit.dayDuration * 24} Hours (${targetUnit.dayDuration} Days)`,
                testCommenced: targetUnit.transferDate || targetUnit.createdAt,
                testCompleted: targetUnit.requiredBy,
                createdAt: targetUnit.createdAt,
                updatedAt: targetUnit.updatedAt,
                timeline: targetUnit.timeline || [],
                remarks: targetUnit.notes || 'R&D machine transfer stage completed as scheduled.',
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
