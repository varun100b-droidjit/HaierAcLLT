import React from 'react';
import { 
  RefreshCw, 
  Play, 
  Pause, 
  Clock, 
  CheckCircle2, 
  Edit3,
  Sliders
} from 'lucide-react';
import { useAutoRefresh, FREQUENCY_OPTIONS } from '../../services/autoRefreshService';

interface SidebarAutoRefreshControlProps {
  onOpenSettings?: () => void;
}

export const SidebarAutoRefreshControl: React.FC<SidebarAutoRefreshControlProps> = ({
  onOpenSettings
}) => {
  const {
    enabled,
    frequency,
    secondsLeft,
    status,
    isFormFilling,
    activeFormName,
    lastSyncTime,
    isSyncing,
    toggle,
    syncNow
  } = useAutoRefresh();

  const currentOption = FREQUENCY_OPTIONS.find(o => o.value === frequency) || FREQUENCY_OPTIONS[1];

  return (
    <div className="mt-2.5 mb-1 px-1">
      <div className={`p-3 rounded-2xl border transition-all duration-300 ${
        !enabled 
          ? 'bg-slate-950/70 border-slate-800 text-slate-400'
          : isFormFilling
            ? 'bg-amber-950/30 border-amber-800/60 text-amber-300 shadow-sm shadow-amber-950/30'
            : 'bg-gradient-to-b from-slate-900/90 to-slate-950 border-cyan-900/40 text-slate-200 shadow-sm shadow-cyan-950/20'
      }`}>
        
        {/* Header with Title and ON/OFF Toggle Switch */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
              !enabled
                ? 'bg-slate-800 text-slate-400'
                : isFormFilling
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-cyan-500/20 text-cyan-400'
            }`}>
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-200 block tracking-wide">
                Auto-Refresh
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Every {currentOption.label}
              </span>
            </div>
          </div>

          {/* ON / OFF Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={toggle}
            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
              enabled ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
            title={enabled ? 'Click to Turn Off Auto-Refresh' : 'Click to Turn On Auto-Refresh'}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* State Display & Actions */}
        {enabled ? (
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1.5">
            {/* Status Indicator */}
            {isFormFilling ? (
              <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-amber-950/60 border border-amber-800/80 text-[11px] text-amber-200 animate-in fade-in">
                <Pause className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-tight">
                  <div className="font-bold flex items-center gap-1">
                    <span>PAUSED</span>
                    <span className="text-[9px] px-1 bg-amber-900/80 rounded font-normal">Form Active</span>
                  </div>
                  <div className="text-[9px] text-amber-300/80 mt-0.5">
                    Resumes automatically after Save or Update.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-emerald-400 font-bold">Active</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-cyan-300 font-semibold">{secondsLeft}s left</span>
                </div>

                <button
                  type="button"
                  onClick={() => syncNow()}
                  disabled={isSyncing}
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/80 border border-cyan-900/60 transition-all cursor-pointer disabled:opacity-50"
                  title="Manual Refresh Now"
                >
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>
            )}

            {/* Quick frequency link / Last sync footer */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
              <span>Last: {lastSyncTime}</span>
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="hover:text-cyan-400 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Change frequency in Settings"
                >
                  <Sliders className="w-2.5 h-2.5" />
                  <span>{currentOption.label} freq</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-semibold">Disabled (Manual Only)</span>
            <button
              type="button"
              onClick={() => syncNow()}
              disabled={isSyncing}
              className="px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition-all cursor-pointer"
            >
              {isSyncing ? 'Syncing...' : 'Sync Once'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
