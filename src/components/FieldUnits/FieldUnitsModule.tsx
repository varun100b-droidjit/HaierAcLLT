import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Eye, 
  Compass, 
  CheckCircle2, 
  Calendar, 
  Clock,
  Activity,
  PauseCircle,
  User,
  Trash2,
  Edit,
  RefreshCw
} from 'lucide-react';
import { FieldUnit } from '../../types';
import { formatShortDateTime, getMachineEndDateTime, getMachineStartDateTime } from '../../utils/dateFormatter';
import { 
  getFieldUnits, 
  subscribeFieldUnitStore, 
  updateFieldUnitStatus,
  deleteFieldUnit,
  forceSyncFieldUnits
} from '../../services/fieldUnitStore';
import { AddFieldUnitDialog } from './AddFieldUnitDialog';
import { FieldUnitDetailsDialog } from './FieldUnitDetailsDialog';
import { DeleteUnitConfirmModal } from '../Common/DeleteUnitConfirmModal';
import { ConfirmPassUnitModal } from '../Common/ConfirmPassUnitModal';
import { 
  calculateShiftElapsedExactHours, 
  formatHoursToHHMM, 
  useActiveLabShift, 
  useIsShiftActiveNow 
} from '../../services/shiftStore';

interface FieldUnitsModuleProps {
  onNavigateToDashboard?: (msg?: string) => void;
  defaultSection?: 'live' | 'stopped' | 'finished';
}

export const FieldUnitsModule: React.FC<FieldUnitsModuleProps> = ({ 
  onNavigateToDashboard,
  defaultSection = 'live',
}) => {
  const [fieldUnits, setFieldUnits] = useState<FieldUnit[]>(getFieldUnits());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'live' | 'stopped' | 'finished'>(defaultSection);
  const [activeShift] = useActiveLabShift();
  const isShiftActive = true; // Continuous operation
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Sync activeTab if defaultSection prop changes
  useEffect(() => {
    if (defaultSection) {
      setActiveTab(defaultSection);
    }
  }, [defaultSection]);

  // Live ticker for running mode time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<FieldUnit | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<FieldUnit | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<FieldUnit | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleEdit = (unit: FieldUnit) => {
    setEditingUnit(unit);
    setIsAddModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingUnit(null);
    setIsAddModalOpen(true);
  };

  useEffect(() => {
    const unsubscribe = subscribeFieldUnitStore(() => {
      setFieldUnits(getFieldUnits());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const [unitToPass, setUnitToPass] = useState<{ unit: FieldUnit; elapsedHours: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleStop = (id: string, currentElapsedHours?: number) => {
    updateFieldUnitStatus(id, 'stopped', currentElapsedHours);
  };

  const handlePromptPass = (unit: FieldUnit, currentElapsedHours?: number) => {
    setUnitToPass({ unit, elapsedHours: currentElapsedHours ?? 0 });
  };

  const handleConfirmPass = () => {
    if (!unitToPass) return;
    const { unit, elapsedHours } = unitToPass;
    updateFieldUnitStatus(unit.id, 'finished', elapsedHours);
    setToastMessage(`Field Unit "${unit.modelName}" passed successfully!`);
    setTimeout(() => setToastMessage(null), 3500);
    setUnitToPass(null);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const updated = await forceSyncFieldUnits();
      setFieldUnits(updated);
      setToastMessage(`Synced ${updated.length} Field Units with Cloud`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePass = (id: string, currentElapsedHours?: number) => {
    updateFieldUnitStatus(id, 'finished', currentElapsedHours);
  };

  const handleResume = (id: string) => {
    updateFieldUnitStatus(id, 'live');
  };

  const handlePromptDelete = (unit: FieldUnit) => {
    setUnitToDelete(unit);
  };

  const handleConfirmDelete = () => {
    if (!unitToDelete) return;
    const deletedName = unitToDelete.modelName;
    deleteFieldUnit(unitToDelete.id);
    setToastMessage(`Field Unit "${deletedName}" deleted successfully`);
    setTimeout(() => setToastMessage(null), 3500);
    setUnitToDelete(null);
  };

  const liveCount = fieldUnits.filter(u => u.status === 'live').length;
  const stoppedCount = fieldUnits.filter(u => u.status === 'stopped').length;
  const finishedCount = fieldUnits.filter(u => u.status === 'finished').length;

  const filteredUnits = fieldUnits.filter(unit => {
    const matchesSearch = 
      unit.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unit.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unit.station.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unit.requestBy.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch && unit.status === activeTab;
  });

  const calculateProgress = (unit: FieldUnit) => {
    const requiredHour = typeof unit.requiredHour === 'number' ? unit.requiredHour : parseFloat((unit as any).requiredHour) || 0;
    const initialDone = typeof unit.doneHour === 'number' ? unit.doneHour : parseFloat((unit as any).doneHour) || 0;

    if (!unit.startDateTime || !requiredHour) {
      const el = Math.min(requiredHour || 0, initialDone);
      const pending = Math.max(0, (requiredHour || 0) - el);
      return { 
        percent: requiredHour > 0 ? Math.min(100, Math.round((el / requiredHour) * 100)) : 0, 
        elapsedHours: el, 
        elapsedHHMM: formatHoursToHHMM(el),
        pendingHours: pending,
        pendingHHMM: formatHoursToHHMM(pending)
      };
    }

    const dateFormatted = unit.startDateTime.includes('T') ? unit.startDateTime : unit.startDateTime.replace(' ', 'T');
    const startDate = new Date(dateFormatted);
    if (isNaN(startDate.getTime())) {
      const el = Math.min(requiredHour, initialDone);
      const pending = Math.max(0, requiredHour - el);
      return { 
        percent: requiredHour > 0 ? Math.min(100, Math.round((el / requiredHour) * 100)) : 0, 
        elapsedHours: el, 
        elapsedHHMM: formatHoursToHHMM(el),
        pendingHours: pending,
        pendingHHMM: formatHoursToHHMM(pending)
      };
    }

    if (unit.status === 'finished') {
      if (typeof unit.doneHour === 'number' && unit.doneHour >= 0) {
        const el = Math.min(requiredHour, unit.doneHour);
        const pending = Math.max(0, requiredHour - el);
        return {
          percent: requiredHour > 0 ? Math.min(100, Math.round((el / requiredHour) * 100)) : 0,
          elapsedHours: el,
          elapsedHHMM: formatHoursToHHMM(el),
          pendingHours: pending,
          pendingHHMM: formatHoursToHHMM(pending)
        };
      }
      let endMs = currentTime;
      if (unit.endDateTime) {
        const endFormatted = unit.endDateTime.includes('T') ? unit.endDateTime : unit.endDateTime.replace(' ', 'T');
        const endDate = new Date(endFormatted);
        if (!isNaN(endDate.getTime()) && endDate.getTime() >= startDate.getTime()) {
          endMs = endDate.getTime();
        }
      } else if (unit.updatedAt) {
        const upFormatted = unit.updatedAt.includes('T') ? unit.updatedAt : unit.updatedAt.replace(' ', 'T');
        const upDate = new Date(upFormatted);
        if (!isNaN(upDate.getTime()) && upDate.getTime() >= startDate.getTime()) {
          endMs = upDate.getTime();
        }
      }
      const shiftHours = calculateShiftElapsedExactHours(startDate.getTime(), endMs, activeShift);
      const elapsedHours = Math.min(requiredHour, initialDone + shiftHours);
      const pendingHours = Math.max(0, requiredHour - elapsedHours);
      const percent = requiredHour > 0 ? Math.min(100, Math.round((elapsedHours / requiredHour) * 100)) : 0;
      return {
        percent,
        elapsedHours,
        elapsedHHMM: formatHoursToHHMM(elapsedHours),
        pendingHours,
        pendingHHMM: formatHoursToHHMM(pendingHours)
      };
    }

    if (unit.status === 'stopped') {
      if (typeof unit.doneHour === 'number' && unit.doneHour >= 0) {
        const el = Math.min(requiredHour, unit.doneHour);
        const pending = Math.max(0, requiredHour - el);
        return {
          percent: requiredHour > 0 ? Math.min(100, Math.round((el / requiredHour) * 100)) : 0,
          elapsedHours: el,
          elapsedHHMM: formatHoursToHHMM(el),
          pendingHours: pending,
          pendingHHMM: formatHoursToHHMM(pending)
        };
      }
      let endMs = currentTime;
      if (unit.endDateTime) {
        const endFormatted = unit.endDateTime.includes('T') ? unit.endDateTime : unit.endDateTime.replace(' ', 'T');
        const endDate = new Date(endFormatted);
        if (!isNaN(endDate.getTime()) && endDate.getTime() >= startDate.getTime()) {
          endMs = endDate.getTime();
        }
      } else if (unit.updatedAt) {
        const upFormatted = unit.updatedAt.includes('T') ? unit.updatedAt : unit.updatedAt.replace(' ', 'T');
        const upDate = new Date(upFormatted);
        if (!isNaN(upDate.getTime()) && upDate.getTime() >= startDate.getTime()) {
          endMs = upDate.getTime();
        }
      }
      const shiftHours = calculateShiftElapsedExactHours(startDate.getTime(), endMs, activeShift);
      const elapsedHours = Math.min(requiredHour, initialDone + shiftHours);
      const pendingHours = Math.max(0, requiredHour - elapsedHours);
      const percent = requiredHour > 0 ? Math.min(100, Math.round((elapsedHours / requiredHour) * 100)) : 0;
      return {
        percent,
        elapsedHours,
        elapsedHHMM: formatHoursToHHMM(elapsedHours),
        pendingHours,
        pendingHHMM: formatHoursToHHMM(pendingHours)
      };
    }

    const nowTime = currentTime;
    if (nowTime <= startDate.getTime()) {
      const el = Math.min(requiredHour, initialDone);
      const pending = Math.max(0, requiredHour - el);
      return { 
        percent: requiredHour > 0 ? Math.min(100, Math.round((el / requiredHour) * 100)) : 0, 
        elapsedHours: el, 
        elapsedHHMM: formatHoursToHHMM(el),
        pendingHours: pending,
        pendingHHMM: formatHoursToHHMM(pending)
      };
    }

    const shiftHours = calculateShiftElapsedExactHours(startDate.getTime(), nowTime, activeShift);
    const elapsedHours = Math.min(requiredHour, initialDone + shiftHours);
    const pendingHours = Math.max(0, requiredHour - elapsedHours);
    const percent = requiredHour > 0 ? Math.min(100, Math.round((elapsedHours / requiredHour) * 100)) : 0;
    const elapsedHHMM = formatHoursToHHMM(elapsedHours);
    const pendingHHMM = formatHoursToHHMM(pendingHours);

    return { percent, elapsedHours, elapsedHHMM, pendingHours, pendingHHMM };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-2xl border border-slate-800 shadow-xl">
        
        {/* Section Tabs (Strictly 3 buttons: Live, Stop, Finished) */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/80 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('live')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'live'
                ? 'bg-gradient-to-r from-cyan-950 to-slate-900 text-cyan-300 border border-cyan-800 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span>Live</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'live' ? 'bg-cyan-900/80 text-cyan-200' : 'bg-slate-800 text-slate-400'
            }`}>
              {liveCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('stopped')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'stopped'
                ? 'bg-gradient-to-r from-amber-950 to-slate-900 text-amber-300 border border-amber-800 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <PauseCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Stop</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'stopped' ? 'bg-amber-900/80 text-amber-200' : 'bg-slate-800 text-slate-400'
            }`}>
              {stoppedCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('finished')}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'finished'
                ? 'bg-gradient-to-r from-emerald-950 to-slate-900 text-emerald-300 border border-emerald-800 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Finished</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'finished' ? 'bg-emerald-900/80 text-emerald-200' : 'bg-slate-800 text-slate-400'
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
              placeholder="Search Model, Station, Request By..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <button
            id="btn-field-manual-sync"
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
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-extrabold text-xs text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-md shadow-cyan-950/50 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Field Unit</span>
          </button>
        </div>

      </div>

      {/* Cardview Grid */}
      {filteredUnits.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredUnits.map((unit) => {
            const { percent, elapsedHours, elapsedHHMM, pendingHours, pendingHHMM } = calculateProgress(unit);

            return (
              <div
                key={unit.id}
                className="bg-slate-900 border border-slate-800/90 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-all shadow-xl flex flex-col justify-between group relative overflow-hidden"
              >
                <div className="space-y-3.5">
                  {/* Station & Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-slate-950 text-cyan-300 border border-cyan-800/80 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{unit.station || 'Station 01'}</span>
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full border flex items-center gap-1 ${
                        unit.status === 'live'
                          ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                          : unit.status === 'stopped'
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}>
                        {unit.status === 'live' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                            <span>LIVE</span>
                          </>
                        ) : unit.status === 'stopped' ? (
                          <span>⏸ STOPPED ({percent}%)</span>
                        ) : (
                          <span>✓ PASSED ({percent}%)</span>
                        )}
                      </span>


                      {unit.status === 'stopped' && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleEdit(unit)}
                            className="p-1.5 text-amber-300 hover:text-white bg-amber-950 border border-amber-800 hover:border-amber-600 hover:bg-amber-900 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer flex items-center justify-center"
                            title="Edit Draft Field Unit"
                          >
                            <Edit className="w-3.5 h-3.5 text-amber-400" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handlePromptDelete(unit);
                            }}
                            className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 hover:border-rose-600 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer flex items-center justify-center"
                            title="Delete Card & Database Record"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Model Name & Request By */}
                  <div className="space-y-1.5">
                    <h3 className="text-base font-black text-white group-hover:text-cyan-300 transition-colors">
                      {unit.modelName}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-semibold bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800/60 w-fit">
                      <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Request By: <strong className="text-white font-extrabold">{unit.requestBy}</strong></span>
                    </div>
                  </div>

                  {/* Start Date/Time & Required Hour & End Date/Time */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Start Date & Time</span>
                      <span className="font-mono text-[11px] font-bold text-slate-200 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-cyan-400 shrink-0" />
                        {getMachineStartDateTime(unit)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Req. Hours</span>
                      <span className="font-mono text-[11px] font-bold text-indigo-300 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
                        {unit.requiredHour} Hours
                      </span>
                    </div>

                    {(unit.status === 'finished' || unit.status === 'stopped' || unit.endDateTime) && (
                      <div className="col-span-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-400 shrink-0" />
                          {unit.status === 'finished' ? 'End Date & Time' : 'Stop Date & Time'}
                        </span>
                        <span className={`font-mono text-[11px] font-extrabold px-2 py-0.5 rounded-lg border border-slate-800 ${
                          unit.status === 'finished' ? 'text-emerald-300 bg-emerald-950/40' : 'text-amber-300 bg-amber-950/40'
                        }`}>
                          {getMachineEndDateTime(unit)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Separate Horizontal Row for Done & Pending Hours */}
                  <div className="flex items-center justify-between gap-2 text-xs font-mono bg-slate-950/90 px-3.5 py-2 rounded-xl border border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <span>✅ Done:</span>
                      <span className="text-emerald-300 font-black">{elapsedHHMM}</span>
                    </div>
                    <div className="h-3 w-[1px] bg-slate-800" />
                    <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                      <span>⏳ Pending:</span>
                      <span className="text-amber-200 font-black">{pendingHHMM}</span>
                    </div>
                  </div>

                  {/* Time Progress Bar */}
                  <div className="space-y-1.5 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                    <div className="flex justify-between items-center text-[11px] font-bold">
                      <span className="text-slate-400 flex items-center gap-1">
                        <span>Time Progress</span>
                      </span>
                      <span className="text-cyan-300 font-mono font-extrabold">{percent}%</span>
                    </div>

                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/50">
                      <div
                        className="h-full transition-all duration-500 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40"
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-emerald-400 font-bold">Done: {elapsedHHMM}</span>
                      <span className="text-amber-400 font-bold">Pending: {pendingHHMM}</span>
                      <span className="text-slate-400">Target: {unit.requiredHour} hrs</span>
                    </div>
                  </div>

                </div>

                {/* Card Action Buttons: Stop, Pass, View */}
                <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                  
                  {unit.status === 'live' && (
                    <button
                      onClick={() => handleStop(unit.id, elapsedHours)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-extrabold text-amber-300 bg-amber-950/90 hover:bg-amber-900 border border-amber-800/80 transition-all cursor-pointer active:scale-95 shadow-sm"
                      title="Stop Field Test"
                    >
                      <PauseCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Stop</span>
                    </button>
                  )}

                  {unit.status === 'stopped' && (
                    <>
                      <button
                        onClick={() => handleEdit(unit)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-extrabold text-amber-300 bg-amber-950/90 hover:bg-amber-900 border border-amber-800/80 transition-all cursor-pointer active:scale-95 shadow-sm"
                        title="Edit Draft Field Unit"
                      >
                        <Edit className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleResume(unit.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-extrabold text-cyan-300 bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-800/80 transition-all cursor-pointer active:scale-95 shadow-sm"
                        title="Resume Field Test"
                      >
                        <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>Resume</span>
                      </button>
                    </>
                  )}

                  {unit.status !== 'finished' && (
                    <button
                      id={`btn-pass-field-${unit.id}`}
                      onClick={() => handlePromptPass(unit, elapsedHours)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-extrabold text-emerald-300 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-800/80 transition-all cursor-pointer active:scale-95 shadow-sm"
                      title="Pass Field Test"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Pass</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedUnit(unit)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
                    title="View Field Unit Details"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span>View</span>
                  </button>

                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto">
            <Compass className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-200">No Field Units Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm ? `No units match your search "${searchTerm}".` : 'No field units in this status section yet.'}
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add First Field Unit
          </button>
        </div>
      )}

      {/* Add Modal */}
      <AddFieldUnitDialog
        isOpen={isAddModalOpen}
        initialUnit={editingUnit}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingUnit(null);
        }}
        onSuccess={(status) => {
          setFieldUnits(getFieldUnits());
          setActiveTab(status === 'stopped' ? 'stopped' : 'live');
        }}
      />

      {/* Details Modal */}
      <FieldUnitDetailsDialog
        unit={selectedUnit}
        isOpen={Boolean(selectedUnit)}
        onClose={() => setSelectedUnit(null)}
        onStatusChanged={() => setFieldUnits(getFieldUnits())}
      />

      {/* Pass Confirmation Modal */}
      {unitToPass && (
        <ConfirmPassUnitModal
          isOpen={!!unitToPass}
          onClose={() => setUnitToPass(null)}
          onConfirm={handleConfirmPass}
          unitType="Field Unit"
          modelName={unitToPass.unit.modelName}
          station={unitToPass.unit.station}
          serialNumber={unitToPass.unit.serialNumber}
          elapsedHours={unitToPass.elapsedHours}
          requiredHours={unitToPass.unit.requiredHour}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteUnitConfirmModal
        isOpen={!!unitToDelete}
        onClose={() => setUnitToDelete(null)}
        onConfirm={handleConfirmDelete}
        unitType="Field Unit"
        modelName={unitToDelete?.modelName || ''}
        station={unitToDelete?.station}
        serialNumber={unitToDelete?.serialNumber}
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
