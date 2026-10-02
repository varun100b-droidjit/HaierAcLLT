import React from 'react';
import { Cpu, Box, Layers, AlertOctagon, CheckCircle2, Flame, PauseCircle, Clock } from 'lucide-react';
import { PpUnit } from '../../types';
import { getIduOduMatchingPairs } from '../../services/ppUnitStore';

interface IduOduMatchingSectionProps {
  units: PpUnit[];
}

export const IduOduMatchingSection: React.FC<IduOduMatchingSectionProps> = ({ units }) => {
  const allPairs = getIduOduMatchingPairs(units);
  const matchingPairs = allPairs.filter(p => Boolean(p.iduItem && p.oduItem));
  const unmatchedPairs = allPairs.filter(p => !p.iduItem || !p.oduItem);

  const pendingCount = matchingPairs.filter(p => p.isPending).length;
  const activeCount = matchingPairs.filter(p => !p.isPending).length;

  if (matchingPairs.length === 0 && unmatchedPairs.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center space-y-2">
        <Layers className="w-8 h-8 text-slate-500 mx-auto" />
        <h4 className="text-sm font-bold text-slate-300">No Matched Models Found</h4>
        <p className="text-xs text-slate-500">Register IDU and ODU models with matching numbers (e.g. HSI19 & HSO19) to create sets.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* BOTH Model Header Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300">BOTH Sets Status:</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-cyan-300">
            Total {matchingPairs.length} Sets
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800 text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Tested / Active: {activeCount}
          </span>
          <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 ${
            pendingCount > 0 
              ? 'bg-rose-950/90 border-rose-600 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.3)] animate-pulse' 
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}>
            <AlertOctagon className={`w-3.5 h-3.5 ${pendingCount > 0 ? 'text-rose-400' : 'text-slate-500'}`} />
            Pending: {pendingCount}
          </span>
        </div>
      </div>

      {/* List of BOTH Sets with Red Border for Pending */}
      <div className="space-y-3">
        {matchingPairs.map((pair) => {
          const iduModel = pair.iduModel || 'N/A';
          const iduVer = pair.iduItem?.version || 'V1.0';
          const iduQty = pair.iduQty || 1;
          const oduModel = pair.oduModel || 'N/A';
          const oduVer = pair.oduItem?.version || 'V1.0';
          const oduQty = pair.oduQty || 1;
          const isPending = pair.isPending;

          return (
            <div 
              key={pair.id}
              className={`p-4 sm:p-5 rounded-2xl transition-all relative overflow-hidden flex flex-col gap-3.5 ${
                isPending
                  ? 'border-2 border-rose-500 bg-gradient-to-r from-rose-950/25 via-slate-900 to-slate-900 shadow-[0_0_20px_rgba(244,63,94,0.35)] ring-1 ring-rose-500/40'
                  : 'border border-emerald-500/40 bg-slate-900/90 shadow-md hover:border-emerald-500/60'
              }`}
            >
              {/* Header Bar: Status Indicator Badge */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    Set Key: <span className="text-cyan-300 font-bold">{pair.commonKey || 'Common'}</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">•</span>
                  <span className="text-[11px] font-mono text-slate-300">
                    Matched Qty: <span className="font-bold text-white">{pair.matchedQty} Set{pair.matchedQty > 1 ? 's' : ''}</span>
                  </span>
                </div>

                {/* Status Badges */}
                {isPending ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-[0_0_12px_rgba(244,63,94,0.6)]">
                    <AlertOctagon className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Pending Testing</span>
                  </span>
                ) : pair.testingStatus === 'live' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-950 text-amber-300 border border-amber-500/60 shadow-sm">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>In Live Testing</span>
                  </span>
                ) : pair.testingStatus === 'stopped' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-orange-950 text-orange-300 border border-orange-500/60 shadow-sm">
                    <PauseCircle className="w-3.5 h-3.5 text-orange-400" />
                    <span>Testing Stopped</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-500/60 shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Testing Finished</span>
                  </span>
                )}
              </div>

              {/* IDU and ODU Model Boxes */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* IDU Details */}
                <div className="flex-1 bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">IDU Model</span>
                      <span className="text-xs font-mono font-black text-white truncate block">{iduModel}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] font-mono text-cyan-300 font-bold">
                      Qty: {iduQty}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] font-mono text-emerald-400 font-bold">
                      {iduVer}
                    </span>
                  </div>
                </div>

                <div className="text-slate-500 font-black text-center text-sm hidden md:block px-1">+</div>

                {/* ODU Details */}
                <div className="flex-1 bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Box className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">ODU Model</span>
                      <span className="text-xs font-mono font-black text-white truncate block">{oduModel}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] font-mono text-blue-300 font-bold">
                      Qty: {oduQty}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] font-mono text-emerald-400 font-bold">
                      {oduVer}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Note Footer */}
              {isPending ? (
                <div className="text-[11px] text-rose-400/90 font-medium flex items-center gap-1.5 pt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                  <span>This model set is pending testing — it has not been started in Unit Testing (Live, Stop, or Finished).</span>
                </div>
              ) : (
                <div className="text-[11px] text-emerald-400/90 font-medium flex items-center gap-1.5 pt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Matched with Unit Testing ({pair.testingStatus?.toUpperCase() || 'ACTIVE'}).</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unmatched Models Section (if any model is missing its IDU or ODU partner) */}
      {unmatchedPairs.length > 0 && (
        <div className="pt-4 space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-bold text-slate-400">
            <AlertOctagon className="w-4 h-4 text-amber-400" />
            <span>Unmatched Models ({unmatchedPairs.length}):</span>
            <span className="text-[11px] font-normal text-slate-500">Models registered without a compatible IDU or ODU partner</span>
          </div>

          <div className="space-y-2">
            {unmatchedPairs.map(pair => (
              <div 
                key={pair.id} 
                className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold">
                    {pair.commonKey}
                  </span>
                  <span className="font-bold text-white font-mono">
                    {pair.iduModel !== 'N/A (No Matching IDU)' ? pair.iduModel : pair.oduModel}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-amber-400/90">
                  {pair.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
