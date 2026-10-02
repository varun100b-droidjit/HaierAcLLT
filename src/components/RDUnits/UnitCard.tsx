import React, { useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  Activity, 
  Edit3, 
  Trash2, 
  Eye,
  FileText,
  CheckCircle2,
  ArrowRightLeft,
  Volume2,
  Bell,
  AlertTriangle
} from 'lucide-react';
import { Unit, WORKFLOW_STAGES } from '../../types';
import { playAlarmSound } from '../../utils/audioAlarm';
import { addNotification, calculateRemainingDays, isUnitOverdue } from '../../services/unitStore';

interface UnitCardProps {
  unit: Unit;
  onTrack: (unit: Unit) => void;
  onDetails: (unit: Unit) => void;
  onReceived: (unit: Unit) => void;
  onEdit?: (unit: Unit) => void;
  onDelete?: (unitId: string) => void;
}

export const UnitCard: React.FC<UnitCardProps> = ({
  unit,
  onTrack,
  onDetails,
  onReceived,
  onEdit,
  onDelete,
}) => {
  if (!unit) return null;

  const remainingDays = calculateRemainingDays(unit.requiredBy);
  const isOverdueUnit = isUnitOverdue(unit);

  // Countdown Badge Styling
  let countdownColorClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80';
  let countdownDotClass = 'bg-emerald-400';
  let countdownText = `${remainingDays} Days Left`;

  if (unit.status === 'received' || unit.status === 'completed') {
    countdownColorClass = 'bg-teal-950/80 text-teal-300 border-teal-700/80';
    countdownDotClass = 'bg-teal-400';
    countdownText = 'Target Met';
  } else if (isOverdueUnit) {
    countdownColorClass = 'bg-rose-950/80 text-rose-300 border-rose-700/80 animate-pulse';
    countdownDotClass = 'bg-rose-500';
    countdownText = remainingDays === 0 ? 'Due Today (R&D)' : `Overdue (${Math.abs(remainingDays)} Days in R&D)`;
  } else if (remainingDays <= 0) {
    countdownColorClass = 'bg-amber-950/80 text-amber-300 border-amber-700/80';
    countdownDotClass = 'bg-amber-400';
    countdownText = `Pending Stage Transfer (${Math.abs(remainingDays)} Days)`;
  } else if (remainingDays <= 5) {
    countdownColorClass = 'bg-amber-950/80 text-amber-300 border-amber-700/80';
    countdownDotClass = 'bg-amber-400';
    countdownText = `${remainingDays} ${remainingDays === 1 ? 'Day' : 'Days'} Remaining`;
  } else {
    countdownColorClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80';
    countdownDotClass = 'bg-emerald-400';
    countdownText = `${remainingDays} Days Remaining`;
  }

  // Calculate day (time) countdown progress
  const totalDurationDays = unit.dayDuration || 7;
  const elapsedDays = Math.max(0, totalDurationDays - Math.max(0, remainingDays));
  const timeProgressPercent = (unit.status === 'received' || unit.status === 'completed') 
    ? 100 
    : Math.min(100, Math.max(0, Math.round((elapsedDays / totalDurationDays) * 100)));

  // Check if testing duration is completed / due
  const isDurationCompleted = unit.status !== 'received' && unit.status !== 'completed' && remainingDays <= 0;

  // Dispatch lab notification when duration completes
  useEffect(() => {
    if (isDurationCompleted) {
      addNotification(
        '🚨 DURATION COMPLETED ALARM',
        `Testing duration completed for unit SN: ${unit.serialNumber} (${unit.modelName}). Target required date reached.`,
        'alert',
        unit.id
      );
    }
  }, [isDurationCompleted, unit.id, unit.serialNumber, unit.modelName]);

  // Stage info and current status
  const currentStageInfo = WORKFLOW_STAGES[unit.currentStageIndex] || WORKFLOW_STAGES[0];

  // Request by person name
  const requestedByPerson = unit.rdPerson || unit.bsrPerson || 'Person Name';

  return (
    <div className="group relative p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-cyan-800/80 shadow-lg hover:shadow-cyan-950/30 transition-all duration-200 flex flex-col justify-between">
      {/* Top Header: Model Name, Sr. No & Status */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            {/* Model Name */}
            <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
              {unit.modelName}
            </h3>

            {/* Sr. No underneath */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Sr. No:
              </span>
              <span className="inline-block px-2.5 py-0.5 text-xs font-mono font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-800 rounded-md">
                {unit.serialNumber}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Machine Current Status Badge */}
            <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
              unit.status === 'received' || unit.status === 'rework' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' :
              unit.status === 'pending_verification' ? 'bg-amber-950/80 text-amber-300 border-amber-800' :
              'bg-cyan-950/80 text-cyan-300 border-cyan-800'
            }`}>
              {unit.status === 'received' ? 'Received' : unit.status === 'rework' ? 'Step 9: Rework Done' : currentStageInfo.stageName}
            </span>
          </div>
        </div>

        {/* Countdown & Due Tag */}
        <div className="my-3 flex items-center justify-between gap-2 flex-wrap">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl border text-xs font-bold shadow-sm ${countdownColorClass}`}>
            <span className={`w-2 h-2 rounded-full ${countdownDotClass}`} />
            <Clock className="w-3.5 h-3.5" />
            <span>{countdownText}</span>
          </div>
        </div>

        {/* Duration Completed Alert Box */}
        {isDurationCompleted && (
          <div className="my-2.5 p-2.5 rounded-xl bg-rose-950/70 border border-rose-500/80 shadow-[0_0_18px_rgba(244,63,94,0.35)] flex items-center justify-between gap-2 animate-pulse">
            <div className="flex items-center gap-2 text-rose-200 text-xs font-bold font-mono">
              <Bell className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />
              <div>
                <div className="text-rose-300 font-extrabold uppercase text-[11px]">🚨 DURATION COMPLETED</div>
                <div className="text-[10px] text-rose-300/90 font-normal">Testing duration ended. Alarm active!</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => playAlarmSound()}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono font-black text-[11px] shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Alarm</span>
            </button>
          </div>
        )}

        {/* Essential Info Fields */}
        <div className="space-y-2 py-3 border-y border-slate-800/80 text-xs">
          {/* Transfer Date */}
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Transfer Date:
            </span>
            <span className="font-medium text-slate-200">{unit.transferDate}</span>
          </div>

          {/* Request by */}
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" /> Request by:
            </span>
            <span className="font-semibold text-indigo-200 truncate max-w-[150px]">
              {requestedByPerson}
            </span>
          </div>
        </div>

        {/* Day (Time) Countdown Progress Bar */}
        <div className="mt-3.5 mb-1 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400" /> Day (Time) Countdown
            </span>
            <span className="font-mono font-bold text-cyan-400">{remainingDays > 0 ? `${remainingDays}d / ${totalDurationDays}d` : 'Target Met'} ({timeProgressPercent}%)</span>
          </div>

          {/* Visual Day (Time) Bar */}
          <div className="w-full h-2.5 bg-slate-950 rounded-full border border-slate-800 overflow-hidden p-0.5">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-cyan-500 to-emerald-500 transition-all duration-500 shadow-sm shadow-cyan-500/50"
              style={{ width: `${timeProgressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Buttons: Track, Details, Received (Under Progress Bar as requested) */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-3 gap-2">
        {/* Track Button */}
        <button
          onClick={() => onTrack(unit)}
          className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl font-bold text-xs text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-400 hover:from-cyan-300 hover:to-blue-300 shadow-md shadow-cyan-950/40 transition-all active:scale-[0.97]"
          title="Machine Current Status"
        >
          <Eye className="w-3.5 h-3.5 shrink-0" />
          <span>Track</span>
        </button>

        {/* Details Button */}
        <button
          onClick={() => onDetails(unit)}
          className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl font-bold text-xs text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all active:scale-[0.97]"
          title="Machine Details"
        >
          <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>Details</span>
        </button>

        {/* Received Button (R&D Person to ELT Person Process) */}
        <button
          onClick={() => onReceived(unit)}
          className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 shadow-md shadow-indigo-950/40 transition-all active:scale-[0.97]"
          title="R&D Person -> ELT Person Process"
        >
          <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
          <span>Received</span>
        </button>
      </div>
    </div>
  );
};
