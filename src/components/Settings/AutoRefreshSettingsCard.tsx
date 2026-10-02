import React, { useState } from 'react';
import { 
  RefreshCw, 
  Clock, 
  Sliders, 
  CheckCircle2, 
  Pause, 
  Play, 
  ShieldCheck, 
  AlertCircle,
  Zap
} from 'lucide-react';
import { useAutoRefresh, FREQUENCY_OPTIONS } from '../../services/autoRefreshService';

export const AutoRefreshSettingsCard: React.FC = () => {
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
    setEnabled,
    setFrequency,
    syncNow
  } = useAutoRefresh();

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    setFrequency(val);
    setFeedbackMsg(`Refresh frequency set to ${e.target.options[e.target.selectedIndex].text}`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleManualSync = async () => {
    await syncNow();
    setFeedbackMsg('Cloud sync completed successfully');
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  return (
    <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
      {/* Header with Title and Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-cyan-950/80 border border-cyan-800/80 text-cyan-400 shadow-inner">
            <RefreshCw className={`w-6 h-6 ${isSyncing ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-wide">
                Auto-Refresh & Stage Sync
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-800">
                Real-Time
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
              Periodically refreshes live stage data, unit testing timers, and station records across R&D, Proto, PP, and Field modules.
            </p>
          </div>
        </div>

        {/* Master ON / OFF Toggle Switch */}
        <div className="flex items-center gap-3 bg-slate-950/80 p-2 rounded-2xl border border-slate-800 shrink-0 self-start sm:self-auto">
          <span className="text-xs font-bold text-slate-300">
            {enabled ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={toggle}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
              enabled ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Frequency Selector & Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Frequency Dropdown */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <label htmlFor="auto-refresh-frequency-select" className="text-xs font-extrabold text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Refresh Frequency</span>
            </label>
            <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800/60">
              Active: {FREQUENCY_OPTIONS.find(o => o.value === frequency)?.label || `${frequency}s`}
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            Select how often the application syncs background data with cloud storage:
          </p>

          <select
            id="auto-refresh-frequency-select"
            value={frequency}
            onChange={handleFrequencyChange}
            disabled={!enabled}
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {FREQUENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                {opt.label} — {opt.description}
              </option>
            ))}
          </select>
        </div>

        {/* Live Status & Quick Action Card */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between space-y-3">
          <div>
            <div className="text-xs font-extrabold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Current State</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Last: {lastSyncTime}</span>
            </div>

            <div className="mt-2.5">
              {!enabled ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-slate-600" />
                  <span>Auto-Refresh is currently disabled</span>
                </div>
              ) : isFormFilling ? (
                <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 font-semibold flex items-center gap-2 animate-pulse">
                  <Pause className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <div>PAUSED — {activeFormName || 'Form in progress'}</div>
                    <div className="text-[10px] text-amber-300/80 font-normal">
                      Will resume automatically as soon as the form is saved or updated.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span>Active & Monitoring</span>
                  </div>
                  <span className="font-mono text-cyan-300 font-extrabold bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                    Next in: {secondsLeft}s
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Sync Now Button */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Cloud Now'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Form Protection Mechanism Feature Callout */}
      <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-900/40 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-cyan-300 font-bold block mb-0.5">
            Automatic Form Protection:
          </strong>
          Whenever you or any user starts filling an Add/Edit Unit dialog, handoff form, or timeline update, the auto-refresh timer automatically <span className="text-amber-300 font-bold">PAUSES</span> to prevent form state resets. Once the form is <span className="text-emerald-300 font-bold">Saved or Updated</span>, auto-refresh automatically resumes.
        </div>
      </div>
    </div>
  );
};
