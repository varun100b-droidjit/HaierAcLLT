import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  User, 
  Eye, 
  Trash2, 
  PauseCircle,
  Play,
  Check,
  BarChart2,
  Boxes,
  Edit,
  RefreshCw
} from 'lucide-react';
import { PpUnit } from '../../types';
import { formatShortDateTime, getMachineEndDateTime, getMachineStartDateTime } from '../../utils/dateFormatter';
import { 
  getPpUnits, 
  subscribePpUnitStore, 
  updatePpUnitStatus, 
  deletePpUnit,
  isUnitTestingEntry,
  forceSyncPpUnits
} from '../../services/ppUnitStore';
import { AddPpUnitDialog } from './AddPpUnitDialog';
import { PpUnitDetailsDialog } from './PpUnitDetailsDialog';
import { PpUnitGraphModal } from './PpUnitGraphModal';
import { PassPpUnitModal } from './PassPpUnitModal';
import { DeleteUnitConfirmModal } from '../Common/DeleteUnitConfirmModal';
import { 
  formatHoursToHHMM 
} from '../../services/shiftStore';

interface PpUnitsModuleProps {
  onOpenAddModal?: () => void;
  defaultSection?: 'live' | 'stopped' | 'finished';
}

export const PpUnitsModule: React.FC<PpUnitsModuleProps> = ({
  onOpenAddModal,
  defaultSection = 'live',
}) => {
  const [activeSection, setActiveSection] = useState<'live' | 'stopped' | 'finished'>(defaultSection);
  const [ppUnits, setPpUnits] = useState<PpUnit[]>(getPpUnits());
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Sync activeSection if defaultSection prop changes
  useEffect(() => {
    if (defaultSection) {
      setActiveSection(defaultSection);
    }
  }, [defaultSection]);

  // Dialog States
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<PpUnit | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<PpUnit | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [graphUnit, setGraphUnit] = useState<PpUnit | null>(null);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [passUnit, setPassUnit] = useState<PpUnit | null>(null);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<PpUnit | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live timer tick every 1 sec for running mode actual live time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribePpUnitStore(() => {
      setPpUnits(getPpUnits());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleOpenAdd = () => {
    setEditingUnit(null);
    if (onOpenAddModal) {
      onOpenAddModal();
    } else {
      setIsAddDialogOpen(true);
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const handleEditUnit = (unit: PpUnit) => {
    setEditingUnit(unit);
    setIsAddDialogOpen(true);
  };

  const handleAddSuccess = (status?: 'live' | 'stopped' | 'finished') => {
    setActiveSection(status || 'live');
  };

  const handleStopUnit = (id: string) => {
    updatePpUnitStatus(id, 'stopped');
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const updated = await forceSyncPpUnits();
      setPpUnits(updated);
      setToastMessage(`Synced ${updated.length} PP Units with Cloud`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePassUnit = (unit: PpUnit) => {
    setPassUnit(unit);
    setIsPassModalOpen(true);
  };

  const handleResumeUnit = (id: string) => {
    updatePpUnitStatus(id, 'live');
  };

  const handlePromptDelete = (unit: PpUnit) => {
    setUnitToDelete(unit);
  };

  const handleConfirmDelete = () => {
    if (!unitToDelete) return;
    const deletedName = unitToDelete.modelName;
    deletePpUnit(unitToDelete.id);
    setToastMessage(`PP Unit "${deletedName}" deleted successfully`);
    setTimeout(() => setToastMessage(null), 3500);
    setUnitToDelete(null);
  };

  // Only actual Unit Testing runs (machines submitted via Add PP Unit form), NOT model registration items
  const actualTestingUnits = ppUnits.filter(isUnitTestingEntry);

  // Filter units based on section and search term
  const sectionUnits = actualTestingUnits.filter(u => u.status === activeSection);
  const filteredUnits = sectionUnits.filter(u => {
    const q = searchTerm.toLowerCase();
    return (
      u.modelName.toLowerCase().includes(q) ||
      (u.station && u.station.toLowerCase().includes(q)) ||
      (u.iduSerialNumber && u.iduSerialNumber.toLowerCase().includes(q)) ||
      (u.oduSerialNumber && u.oduSerialNumber.toLowerCase().includes(q)) ||
      (u.requestBy && u.requestBy.toLowerCase().includes(q)) ||
      (u.testPurpose && u.testPurpose.toLowerCase().includes(q))
    );
  });

  const liveCount = actualTestingUnits.filter(u => u.status === 'live').length;
  const stoppedCount = actualTestingUnits.filter(u => u.status === 'stopped').length;
  const finishedCount = actualTestingUnits.filter(u => u.status === 'finished').length;
  const isShiftActive = true; // PP Unit always runs continuously without shift pause

  return (
    <div className="space-y-6">

      {/* Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800">
        
        {/* Section Tabs (Live, Stop, Finished) */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/80 w-full sm:w-auto">
          <button
            onClick={() => setActiveSection('live')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSection === 'live'
                ? 'bg-gradient-to-r from-cyan-950 to-slate-900 text-cyan-300 border border-cyan-800 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full shrink-0 bg-emerald-400 animate-pulse" />
            <span>Live</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeSection === 'live' ? 'bg-cyan-900/80 text-cyan-200' : 'bg-slate-800 text-slate-400'
            }`}>
              {liveCount}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('stopped')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSection === 'stopped'
                ? 'bg-gradient-to-r from-amber-950 to-slate-900 text-amber-300 border border-amber-800 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <PauseCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Stop</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeSection === 'stopped' ? 'bg-amber-900/80 text-amber-200' : 'bg-slate-800 text-slate-400'
            }`}>
              {stoppedCount}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('finished')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSection === 'finished'
                ? 'bg-gradient-to-r from-cyan-950 to-slate-900 text-cyan-300 border border-cyan-800 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Finished</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeSection === 'finished' ? 'bg-cyan-900/80 text-cyan-200' : 'bg-slate-800 text-slate-400'
            }`}>
              {finishedCount}
            </span>
          </button>
        </div>

        {/* Search Bar & Add Button */}
        <div className="flex items-center gap-3 flex-1 justify-end">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search Model, Requester..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <button
            id="btn-pp-manual-sync"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 hover:text-white border border-slate-700 transition-all shrink-0 cursor-pointer disabled:opacity-50"
            title="Real-Time Sync with Cloud"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-extrabold text-xs text-slate-900 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-md shadow-cyan-950/50 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add PP Unit</span>
          </button>
        </div>

      </div>

      {/* PP Unit Cards List Grid */}
      {filteredUnits.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredUnits.map((unit) => {
            const reqHours = typeof unit.requiredHour === 'number' ? unit.requiredHour : parseFloat(unit.requiredHour) || 0;
            const initialDone = typeof unit.doneHour === 'number' ? unit.doneHour : parseFloat((unit as any).doneHour) || 0;
            
            let elapsedHours = initialDone;
            let pendingHours = Math.max(0, reqHours - initialDone);
            let progressPercent = reqHours > 0 ? Math.min(100, Math.round((initialDone / reqHours) * 100)) : 0;

            if (unit.status === 'finished') {
              elapsedHours = reqHours;
              pendingHours = 0;
              progressPercent = 100;
            } else {
              let createdMs = NaN;
              if (unit.createdAt) {
                createdMs = new Date(unit.createdAt.replace(' ', 'T')).getTime();
                if (isNaN(createdMs)) {
                  createdMs = new Date(unit.createdAt).getTime();
                }
              }
              const nowMs = currentTime;

              if (!isNaN(createdMs) && createdMs <= nowMs) {
                let endCalculatedMs = nowMs;
                if (unit.status === 'stopped') {
                  let updatedMs = NaN;
                  if (unit.updatedAt) {
                    updatedMs = new Date(unit.updatedAt.replace(' ', 'T')).getTime();
                    if (isNaN(updatedMs)) {
                      updatedMs = new Date(unit.updatedAt).getTime();
                    }
                  }
                  if (!isNaN(updatedMs) && updatedMs >= createdMs) {
                    endCalculatedMs = updatedMs;
                  }
                }

                const calculatedHours = Math.max(0, (endCalculatedMs - createdMs) / (1000 * 60 * 60));
                elapsedHours = Math.min(reqHours, initialDone + calculatedHours);
              } else {
                elapsedHours = Math.min(reqHours, initialDone);
              }

              pendingHours = Math.max(0, reqHours - elapsedHours);
              progressPercent = reqHours > 0 ? Math.min(100, Math.round((elapsedHours / reqHours) * 100)) : 0;
            }

            const doneHHMM = formatHoursToHHMM(elapsedHours);
            const pendingHHMM = formatHoursToHHMM(pendingHours);

            return (
              <div
                key={unit.id}
                className="group relative bg-slate-900 hover:bg-slate-900/90 border border-slate-800 hover:border-cyan-800/80 rounded-2xl p-5 shadow-lg transition-all flex flex-col justify-between gap-4"
              >
                {/* Header Card Content */}
                <div className="space-y-3.5">
                  {/* Top Row */}
                  <div className="flex items-center justify-between gap-4 w-full pb-1">
                    <span className="px-3 py-1.5 rounded-full text-xs font-black bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-1.5 shrink-0 shadow-sm">
                      📍 St. No: {unit.station ? unit.station.replace(/^Station\s*/i, '') : '01'}
                    </span>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-3 py-1.5 text-xs font-extrabold rounded-full border shadow-sm flex items-center gap-1.5 ${
                        unit.status === 'live' 
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800 animate-pulse' 
                          : unit.status === 'stopped'
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {unit.status === 'live' 
                          ? '🟢 Live' 
                          : unit.status === 'stopped' 
                          ? '⏸️ Stopped' 
                          : '✅ Finished'}
                      </span>

                      {unit.status === 'stopped' && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleEditUnit(unit)}
                            className="p-1.5 text-amber-300 hover:text-white bg-amber-950 border border-amber-800 hover:border-amber-600 hover:bg-amber-900 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                            title="Edit Draft Unit Form"
                          >
                            <Edit className="w-4 h-4 text-amber-400" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handlePromptDelete(unit);
                            }}
                            className="p-1.5 text-rose-300 hover:text-white bg-rose-950 border border-rose-800 hover:border-rose-600 hover:bg-rose-900 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                            title="Delete Card & Database Record"
                          >
                            <Trash2 className="w-4 h-4 text-rose-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Model Name & Badges */}
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {unit.unitType && (
                        <span className={`px-2 py-0.5 text-[10px] font-black rounded-md border ${
                          unit.unitType === 'IDU'
                            ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                            : unit.unitType === 'ODU'
                            ? 'bg-blue-950 text-blue-300 border-blue-800'
                            : 'bg-indigo-950 text-indigo-300 border-indigo-800'
                        }`}>
                          {unit.unitType}
                        </span>
                      )}
                      {unit.materialCode && (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-slate-950 text-slate-300 border border-slate-800">
                          {unit.materialCode}
                        </span>
                      )}
                      {unit.version && (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                          {unit.version}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-white group-hover:text-cyan-300 transition-colors leading-snug">
                      {unit.modelName}
                    </h3>
                  </div>

                  {/* Metadata Info Box */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                    <div className={`grid grid-cols-1 ${unit.status === 'live' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-x-6 gap-y-2.5 text-xs`}>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Start Date & Time</span>
                        <span className="font-mono text-[11px] font-bold text-slate-200 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                          {getMachineStartDateTime(unit)}
                        </span>
                      </div>

                      {unit.status !== 'live' && (
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">
                            {unit.status === 'finished' ? 'End Date & Time' : 'Stop Date & Time'}
                          </span>
                          {getMachineEndDateTime(unit) === '-' ? (
                            <span className="font-mono text-xs font-bold text-slate-400 block mt-0.5">
                              -
                            </span>
                          ) : (
                            <span className={`font-mono text-[11px] font-bold flex items-center gap-1 mt-0.5 ${
                              unit.status === 'finished' ? 'text-emerald-300' : 'text-amber-300'
                            }`}>
                              <Clock className={`w-3 h-3 shrink-0 ${
                                unit.status === 'finished' ? 'text-emerald-400' : 'text-amber-400'
                              }`} />
                              {getMachineEndDateTime(unit)}
                            </span>
                          )}
                        </div>
                      )}

                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Request By</span>
                        <span className="font-semibold text-indigo-300 flex items-center gap-1 truncate mt-0.5">
                          <User className="w-3 h-3 text-indigo-400 shrink-0" />
                          {unit.requestBy}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Done & Pending Hours */}
                  <div className="flex items-center justify-between gap-2 text-xs font-mono bg-slate-950/90 px-3.5 py-2 rounded-xl border border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <span>✅ Done:</span>
                      <span className="text-emerald-300 font-black">{doneHHMM}</span>
                    </div>
                    <div className="h-3 w-[1px] bg-slate-800" />
                    <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                      <span>⏳ Pending:</span>
                      <span className="text-amber-200 font-black">{pendingHHMM}</span>
                    </div>
                  </div>

                  {/* Required Hours & Progress Bar */}
                  <div className="space-y-2 bg-slate-950/90 p-3 rounded-xl border border-slate-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Required Hour: <strong className="text-amber-300 font-extrabold">{unit.requiredHour}h</strong>
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md border ${
                        unit.status === 'live'
                          ? isShiftActive
                            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80'
                            : 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                          : unit.status === 'stopped'
                          ? 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                          : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                      }`}>
                        {unit.status === 'finished' 
                          ? '100% Completed' 
                          : unit.status === 'stopped' 
                          ? `Stopped (${progressPercent}%)` 
                          : isShiftActive
                          ? `Running (${progressPercent}%)`
                          : `Paused (${progressPercent}%)`}
                      </span>
                    </div>

                    <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-2.5 overflow-hidden p-0.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          unit.status === 'live'
                            ? isShiftActive
                              ? 'bg-gradient-to-r from-cyan-500 to-emerald-400 animate-pulse'
                              : 'bg-gradient-to-r from-amber-500 to-amber-600'
                            : unit.status === 'stopped'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                </div>

                {/* Footer Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => {
                      setSelectedUnit(unit);
                      setIsDetailsOpen(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                    title="View Details"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>View</span>
                  </button>

                  {unit.status === 'finished' && (
                    <button
                      onClick={() => {
                        setGraphUnit(unit);
                        setIsGraphOpen(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-950/80 hover:bg-amber-900 border border-amber-800/80 transition-colors cursor-pointer"
                      title="View Performance Graph"
                    >
                      <BarChart2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Graph</span>
                    </button>
                  )}

                  {unit.status === 'live' ? (
                    <button
                      onClick={() => handleStopUnit(unit.id)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-xs font-bold text-amber-200 bg-amber-950/90 hover:bg-amber-900 border border-amber-800/80 transition-all shadow-sm cursor-pointer"
                      title="Stop Running Test"
                    >
                      <PauseCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Stop</span>
                    </button>
                  ) : unit.status === 'stopped' ? (
                    <>
                      <button
                        onClick={() => handleEditUnit(unit)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-xs font-bold text-amber-200 bg-amber-950/90 hover:bg-amber-900 border border-amber-800/80 transition-all shadow-sm cursor-pointer"
                        title="Edit Draft Unit Form"
                      >
                        <Edit className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleResumeUnit(unit.id)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-xs font-bold text-cyan-200 bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-800/80 transition-all shadow-sm cursor-pointer"
                        title="Resume to Live"
                      >
                        <Play className="w-3.5 h-3.5 text-cyan-400 shrink-0 fill-cyan-400" />
                        <span>Resume</span>
                      </button>
                    </>
                  ) : null}

                  {unit.status !== 'finished' && (
                    <button
                      id={`btn-pass-pp-${unit.id}`}
                      onClick={() => handlePassUnit(unit)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-xs font-bold text-emerald-200 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-800/80 transition-all shadow-sm cursor-pointer"
                      title="Pass Test & Move to Finished"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3] shrink-0" />
                      <span>Pass</span>
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
          <Cpu className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">
            No PP Units in {activeSection === 'live' ? 'Live' : activeSection === 'stopped' ? 'Stop' : 'Finished'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm 
              ? 'No matching PP units found for your search query.' 
              : activeSection === 'live'
                ? 'Click "Add PP Unit" above to enter a new PP unit test record.'
                : activeSection === 'stopped'
                ? 'Units will appear here when you click "Stop" on a running test.'
                : 'Completed test records will appear here when you click "Pass".'}
          </p>
          {!searchTerm && activeSection === 'live' && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 transition-colors mt-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add PP Unit Now</span>
            </button>
          )}
        </div>
      )}

      {/* Add Dialog */}
      <AddPpUnitDialog
        isOpen={isAddDialogOpen}
        initialUnit={editingUnit}
        onClose={() => {
          setIsAddDialogOpen(false);
          setEditingUnit(null);
        }}
        onSuccess={handleAddSuccess}
      />

      {/* Details Dialog */}
      <PpUnitDetailsDialog
        unit={selectedUnit}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedUnit(null);
        }}
        onStatusChanged={() => {
          setPpUnits(getPpUnits());
        }}
      />

      {/* Performance Graph Modal */}
      <PpUnitGraphModal
        unit={graphUnit}
        isOpen={isGraphOpen}
        onClose={() => {
          setIsGraphOpen(false);
          setGraphUnit(null);
        }}
      />

      {/* Pass Unit Modal Form */}
      <PassPpUnitModal
        unit={passUnit}
        isOpen={isPassModalOpen}
        onClose={() => {
          setIsPassModalOpen(false);
          setPassUnit(null);
        }}
        onSuccess={() => {
          setPpUnits(getPpUnits());
          setActiveSection('finished');
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteUnitConfirmModal
        isOpen={!!unitToDelete}
        onClose={() => setUnitToDelete(null)}
        onConfirm={handleConfirmDelete}
        unitType="PP Unit"
        modelName={unitToDelete?.modelName || ''}
        station={unitToDelete?.station}
        serialNumber={unitToDelete?.iduSerialNumber || unitToDelete?.oduSerialNumber}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-rose-600 text-white font-bold text-xs py-3 px-4 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-rose-400 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <Trash2 className="w-4 h-4 shrink-0 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};
