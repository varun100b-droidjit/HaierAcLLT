import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MinusCircle, 
  CheckSquare, 
  Square, 
  Check, 
  AlertTriangle, 
  Zap, 
  RefreshCw, 
  Layers, 
  ShieldAlert, 
  Sparkles, 
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowRight
} from 'lucide-react';
import { getProtoUnits, updateProtoUnit } from '../../services/protoUnitStore';
import { getPpUnits, updatePpUnit } from '../../services/ppUnitStore';
import { getFieldUnits, updateFieldUnit } from '../../services/fieldUnitStore';
import { ProtoUnit, PpUnit, FieldUnit } from '../../types';
import { audioAlarm } from '../../utils/audioAlarm';
import { addLabNotification } from '../../services/unitStore';

function formatToYYYYMMDDHHMM(d: Date): string {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const hr = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yr}-${mo}-${da} ${hr}:${mi}`;
}

export const LiveUnitHourReductionCard: React.FC = () => {
  // Section Select / Unselect States
  const [isProtoSelected, setIsProtoSelected] = useState<boolean>(true);
  const [isPpSelected, setIsPpSelected] = useState<boolean>(false);
  const [isFieldSelected, setIsFieldSelected] = useState<boolean>(false);

  // Hours input
  const [hoursInput, setHoursInput] = useState<string>('10');

  // Live units cache
  const [protoLiveUnits, setProtoLiveUnits] = useState<ProtoUnit[]>([]);
  const [ppLiveUnits, setPpLiveUnits] = useState<PpUnit[]>([]);
  const [fieldLiveUnits, setFieldLiveUnits] = useState<FieldUnit[]>([]);

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [showPreviewList, setShowPreviewList] = useState<boolean>(false);

  // Feedback banner
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    affectedCount?: number;
  } | null>(null);

  // Refresh live units from stores
  const refreshLiveUnits = () => {
    try {
      const allProto = getProtoUnits();
      const liveProto = allProto.filter(u => u.status === 'live');
      setProtoLiveUnits(liveProto);

      const allPp = getPpUnits();
      const livePp = allPp.filter(u => u.status === 'live');
      setPpLiveUnits(livePp);

      const allField = getFieldUnits();
      const liveField = allField.filter(u => u.status === 'live');
      setFieldLiveUnits(liveField);
    } catch (err) {
      console.warn('[LiveHoursCard] Error reading live units:', err);
    }
  };

  useEffect(() => {
    refreshLiveUnits();
    const interval = setInterval(refreshLiveUnits, 4000);
    return () => clearInterval(interval);
  }, []);

  // Quick preset helper
  const handleSelectPreset = (hrs: number) => {
    setHoursInput(String(hrs));
  };

  // Calculate total affected machines
  const totalSelectedLiveCount = 
    (isProtoSelected ? protoLiveUnits.length : 0) +
    (isPpSelected ? ppLiveUnits.length : 0) +
    (isFieldSelected ? fieldLiveUnits.length : 0);

  const deductNum = parseFloat(hoursInput) || 0;

  // Handle deduction execution
  const handleExecuteDeduction = async () => {
    if (deductNum <= 0) {
      setFeedback({
        type: 'error',
        message: 'Kripya 0 se zyada hours (e.g. 10) enter karein.'
      });
      return;
    }

    if (!isProtoSelected && !isPpSelected && !isFieldSelected) {
      setFeedback({
        type: 'error',
        message: 'Kripya kam se kam ek section (Proto, PP, ya Field) select karein.'
      });
      return;
    }

    if (totalSelectedLiveCount === 0) {
      setFeedback({
        type: 'error',
        message: 'Selected sections me koi bhi machine "Live" status me nahi hai.'
      });
      setConfirmModalOpen(false);
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    setConfirmModalOpen(false);

    try {
      let affectedProtoCount = 0;
      let affectedPpCount = 0;
      let affectedFieldCount = 0;
      const nowMs = Date.now();

      // 1. DEDUCT FROM PROTO LIVE UNITS
      if (isProtoSelected && protoLiveUnits.length > 0) {
        for (const unit of protoLiveUnits) {
          const currentDone = typeof unit.doneHour === 'number' ? unit.doneHour : (parseFloat(String(unit.doneHour || 0)) || 0);

          if (currentDone >= deductNum) {
            // Can be subtracted directly from doneHour
            const newDone = Math.max(0, currentDone - deductNum);
            updateProtoUnit(unit.id, { doneHour: newDone });
          } else {
            // doneHour is less than deductNum, consume doneHour and shift createdAt forward
            const remainingToDeduct = deductNum - currentDone;
            let createdMs = NaN;
            if (unit.createdAt) {
              createdMs = new Date(unit.createdAt.replace(' ', 'T')).getTime();
              if (isNaN(createdMs)) createdMs = new Date(unit.createdAt).getTime();
            }
            if (isNaN(createdMs)) createdMs = nowMs;

            const newCreatedMs = Math.min(nowMs, createdMs + remainingToDeduct * 3600 * 1000);
            const newCreatedAt = formatToYYYYMMDDHHMM(new Date(newCreatedMs));

            updateProtoUnit(unit.id, {
              doneHour: 0,
              createdAt: newCreatedAt
            });
          }
          affectedProtoCount++;
        }
      }

      // 2. DEDUCT FROM PP LIVE UNITS
      if (isPpSelected && ppLiveUnits.length > 0) {
        for (const unit of ppLiveUnits) {
          const currentDone = typeof unit.doneHour === 'number' ? unit.doneHour : (parseFloat(String(unit.doneHour || 0)) || 0);

          if (currentDone >= deductNum) {
            const newDone = Math.max(0, currentDone - deductNum);
            updatePpUnit(unit.id, { doneHour: newDone });
          } else {
            const remainingToDeduct = deductNum - currentDone;
            let createdMs = NaN;
            if (unit.createdAt) {
              createdMs = new Date(unit.createdAt.replace(' ', 'T')).getTime();
              if (isNaN(createdMs)) createdMs = new Date(unit.createdAt).getTime();
            }
            if (isNaN(createdMs)) createdMs = nowMs;

            const newCreatedMs = Math.min(nowMs, createdMs + remainingToDeduct * 3600 * 1000);
            const newCreatedAt = formatToYYYYMMDDHHMM(new Date(newCreatedMs));

            updatePpUnit(unit.id, {
              doneHour: 0,
              createdAt: newCreatedAt
            });
          }
          affectedPpCount++;
        }
      }

      // 3. DEDUCT FROM FIELD LIVE UNITS
      if (isFieldSelected && fieldLiveUnits.length > 0) {
        for (const unit of fieldLiveUnits) {
          const currentDone = typeof unit.doneHour === 'number' ? unit.doneHour : (parseFloat(String(unit.doneHour || 0)) || 0);

          if (currentDone >= deductNum) {
            const newDone = Math.max(0, currentDone - deductNum);
            updateFieldUnit(unit.id, { doneHour: newDone });
          } else {
            const remainingToDeduct = deductNum - currentDone;
            const startRaw = unit.startDateTime || unit.createdAt || '';
            let startMs = NaN;
            if (startRaw) {
              startMs = new Date(startRaw.replace(' ', 'T')).getTime();
              if (isNaN(startMs)) startMs = new Date(startRaw).getTime();
            }
            if (isNaN(startMs)) startMs = nowMs;

            const newStartMs = Math.min(nowMs, startMs + remainingToDeduct * 3600 * 1000);
            const newStartFormatted = formatToYYYYMMDDHHMM(new Date(newStartMs));

            updateFieldUnit(unit.id, {
              doneHour: 0,
              startDateTime: newStartFormatted,
              createdAt: newStartFormatted
            });
          }
          affectedFieldCount++;
        }
      }

      const totalAffected = affectedProtoCount + affectedPpCount + affectedFieldCount;

      // Log notification
      const partsSummary = [
        affectedProtoCount > 0 ? `Proto (${affectedProtoCount})` : null,
        affectedPpCount > 0 ? `PP (${affectedPpCount})` : null,
        affectedFieldCount > 0 ? `Field (${affectedFieldCount})` : null
      ].filter(Boolean).join(', ');

      addLabNotification(
        `Live Hours Adjusted: -${deductNum}h`,
        `Deducted ${deductNum} hours from ${totalAffected} live units across ${partsSummary}.`
      );

      // Auditory confirmation
      audioAlarm.playPassChime();

      setFeedback({
        type: 'success',
        message: `Successfully deducted ${deductNum} hours from ${totalAffected} live machines (${partsSummary})! All systems & cloud synced.`,
        affectedCount: totalAffected
      });

      // Refresh cache
      refreshLiveUnits();
    } catch (err: any) {
      console.error('Error during live hours deduction:', err);
      setFeedback({
        type: 'error',
        message: `Error updating live hours: ${err.message || 'Unknown error'}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-amber-950/80 border border-amber-800/80 text-amber-400 shadow-inner">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-wide">
                Live Machine Hours Adjustment (Hour Minus)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-950 text-amber-300 border border-amber-800">
                Live Units Only
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Proto, PP ya Field ke Live machines me se running hours minus (kam) karne ke liye section select karein aur hours enter karein.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={refreshLiveUnits}
          className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all cursor-pointer self-start sm:self-center"
          title="Refresh Live Units Count"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Step 1: Select / Unselect Sections (Proto, PP, Field) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>1. Select / Unselect Sections (Kisme se Hour Minus Karna Hai):</span>
          </label>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setIsProtoSelected(true);
                setIsPpSelected(true);
                setIsFieldSelected(true);
              }}
              className="text-[11px] text-cyan-400 hover:underline font-mono cursor-pointer"
            >
              Select All
            </button>
            <span className="text-slate-600">|</span>
            <button
              type="button"
              onClick={() => {
                setIsProtoSelected(false);
                setIsPpSelected(false);
                setIsFieldSelected(false);
              }}
              className="text-[11px] text-slate-400 hover:underline font-mono cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card 1: Proto */}
          <button
            type="button"
            onClick={() => setIsProtoSelected(prev => !prev)}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
              isProtoSelected
                ? 'bg-cyan-950/70 border-cyan-500/80 shadow-md shadow-cyan-950/40 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${isProtoSelected ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                {isProtoSelected ? <CheckSquare className="w-4 h-4 stroke-[2.5]" /> : <Square className="w-4 h-4" />}
              </div>
              <div>
                <span className="text-sm font-black block tracking-wide">Proto Section</span>
                <span className="text-[11px] font-mono text-cyan-300 block">
                  🟢 {protoLiveUnits.length} {protoLiveUnits.length === 1 ? 'Live Machine' : 'Live Machines'}
                </span>
              </div>
            </div>
            {isProtoSelected && (
              <span className="px-2 py-0.5 rounded-md bg-cyan-900/80 border border-cyan-700 text-cyan-200 text-[10px] font-mono font-bold">
                Selected
              </span>
            )}
          </button>

          {/* Card 2: PP */}
          <button
            type="button"
            onClick={() => setIsPpSelected(prev => !prev)}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
              isPpSelected
                ? 'bg-emerald-950/70 border-emerald-500/80 shadow-md shadow-emerald-950/40 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${isPpSelected ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                {isPpSelected ? <CheckSquare className="w-4 h-4 stroke-[2.5]" /> : <Square className="w-4 h-4" />}
              </div>
              <div>
                <span className="text-sm font-black block tracking-wide">PP Section</span>
                <span className="text-[11px] font-mono text-emerald-300 block">
                  🟢 {ppLiveUnits.length} {ppLiveUnits.length === 1 ? 'Live Machine' : 'Live Machines'}
                </span>
              </div>
            </div>
            {isPpSelected && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-900/80 border border-emerald-700 text-emerald-200 text-[10px] font-mono font-bold">
                Selected
              </span>
            )}
          </button>

          {/* Card 3: Field */}
          <button
            type="button"
            onClick={() => setIsFieldSelected(prev => !prev)}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
              isFieldSelected
                ? 'bg-indigo-950/70 border-indigo-500/80 shadow-md shadow-indigo-950/40 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${isFieldSelected ? 'bg-indigo-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                {isFieldSelected ? <CheckSquare className="w-4 h-4 stroke-[2.5]" /> : <Square className="w-4 h-4" />}
              </div>
              <div>
                <span className="text-sm font-black block tracking-wide">Field Section</span>
                <span className="text-[11px] font-mono text-indigo-300 block">
                  🟢 {fieldLiveUnits.length} {fieldLiveUnits.length === 1 ? 'Live Machine' : 'Live Machines'}
                </span>
              </div>
            </div>
            {isFieldSelected && (
              <span className="px-2 py-0.5 rounded-md bg-indigo-900/80 border border-indigo-700 text-indigo-200 text-[10px] font-mono font-bold">
                Selected
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Step 2: Hours Input Box */}
      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MinusCircle className="w-4 h-4 text-amber-400" />
            <span>2. Hours to Deduct (Kitne Hours Minus Karne Hain):</span>
          </span>
          <span className="text-[11px] font-mono text-slate-400">e.g. 10 Hours</span>
        </label>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <input
              type="number"
              min="1"
              step="1"
              value={hoursInput}
              onChange={(e) => setHoursInput(e.target.value)}
              placeholder="Enter hours to minus, e.g. 10"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl text-white font-mono font-bold text-base focus:outline-none transition-all placeholder:text-slate-600"
            />
            <span className="absolute right-4 top-3.5 text-xs font-mono font-bold text-slate-400 uppercase">
              Hours
            </span>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[1, 5, 10, 24, 48].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`py-2 px-3 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
                  hoursInput === String(preset)
                    ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                -{preset}h
              </button>
            ))}
          </div>
        </div>

        {/* Operational info hint */}
        <p className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            Jaise agar <strong>10</strong> daala aur Proto select hai, toh Proto ke sabhi <strong>Live</strong> machines ke done running hours me se 10 hours kam ho jayenge.
          </span>
        </p>
      </div>

      {/* Selected Machines Summary Strip */}
      <div className="p-3.5 px-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-slate-300 font-bold">
            Impact Summary:
          </span>
          <span className="text-amber-300 font-extrabold">
            {totalSelectedLiveCount} Active Live {totalSelectedLiveCount === 1 ? 'Machine' : 'Machines'}
          </span>
          <span className="text-slate-500">will be deducted by</span>
          <span className="text-rose-400 font-extrabold">-{deductNum}h</span>
        </div>

        {totalSelectedLiveCount > 0 && (
          <button
            type="button"
            onClick={() => setShowPreviewList(prev => !prev)}
            className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>{showPreviewList ? 'Hide Machine List' : 'View Machine List'}</span>
            {showPreviewList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Expandable Preview of Affected Machines */}
      {showPreviewList && totalSelectedLiveCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono max-h-60 overflow-y-auto">
          <span className="text-[10px] uppercase font-bold text-slate-400 block pb-1 border-b border-slate-800">
            Live Machines to be Updated ({totalSelectedLiveCount}):
          </span>
          <div className="space-y-1.5">
            {isProtoSelected && protoLiveUnits.map(u => (
              <div key={u.id} className="p-2 rounded-xl bg-slate-900 border border-cyan-900/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-bold">Proto</span>
                  <span className="text-white font-bold">{u.modelName}</span>
                  <span className="text-slate-400 text-[11px]">({u.station || 'St. 01'})</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span>Current: <strong className="text-emerald-400">{u.doneHour ?? 0}h</strong></span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <span className="text-amber-400 font-bold">Minus {deductNum}h</span>
                </div>
              </div>
            ))}

            {isPpSelected && ppLiveUnits.map(u => (
              <div key={u.id} className="p-2 rounded-xl bg-slate-900 border border-emerald-900/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">PP</span>
                  <span className="text-white font-bold">{u.modelName}</span>
                  <span className="text-slate-400 text-[11px]">({u.station || 'St. 01'})</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span>Current: <strong className="text-emerald-400">{u.doneHour ?? 0}h</strong></span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <span className="text-amber-400 font-bold">Minus {deductNum}h</span>
                </div>
              </div>
            ))}

            {isFieldSelected && fieldLiveUnits.map(u => (
              <div key={u.id} className="p-2 rounded-xl bg-slate-900 border border-indigo-900/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px] font-bold">Field</span>
                  <span className="text-white font-bold">{u.modelName}</span>
                  <span className="text-slate-400 text-[11px]">({u.station || 'St. 01'})</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span>Current: <strong className="text-emerald-400">{u.doneHour ?? 0}h</strong></span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <span className="text-amber-400 font-bold">Minus {deductNum}h</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 animate-in fade-in duration-200 ${
          feedback.type === 'success'
            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
            : 'bg-rose-950/80 border-rose-500 text-rose-200'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="font-mono font-bold flex-1">{feedback.message}</span>
        </div>
      )}

      {/* Step 3: Action Button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setConfirmModalOpen(true)}
          disabled={isProcessing || deductNum <= 0 || totalSelectedLiveCount === 0 || (!isProtoSelected && !isPpSelected && !isFieldSelected)}
          className="w-full py-3.5 px-5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 hover:from-amber-300 hover:to-orange-300 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-amber-950/50 flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
              <span>Deducting {deductNum} Hours from Live Machines...</span>
            </>
          ) : (
            <>
              <MinusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>
                Minus {deductNum} Hours from {totalSelectedLiveCount} Live {totalSelectedLiveCount === 1 ? 'Machine' : 'Machines'}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-950/80 border border-amber-800 text-amber-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">Confirm Hours Deduction</h4>
                <p className="text-xs text-slate-400">Are you sure you want to minus hours?</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
              <p className="text-slate-300 leading-relaxed">
                Aap <strong className="text-amber-400">{deductNum} Hours</strong> minus karne ja rahe hain:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
                {isProtoSelected && <li>Proto Live: <strong className="text-white">{protoLiveUnits.length} machines</strong></li>}
                {isPpSelected && <li>PP Live: <strong className="text-white">{ppLiveUnits.length} machines</strong></li>}
                {isFieldSelected && <li>Field Live: <strong className="text-white">{fieldLiveUnits.length} machines</strong></li>}
              </ul>
              <p className="text-[11px] text-amber-300/90 pt-1">
                Yeh action sabhi selected live machines ke running hours ko kam karke Firebase aur local storage me save karega.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDeduction}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Yes, Minus {deductNum}h</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
