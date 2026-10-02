import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Tag, 
  ArrowUpCircle, 
  History, 
  CheckCircle2, 
  Layers, 
  RefreshCw, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Terminal, 
  AlertCircle,
  FileCheck2
} from 'lucide-react';
import { 
  getAppVersionState, 
  subscribeAppVersion, 
  bumpAppVersion, 
  setCustomVersion, 
  resetAppVersionState,
  AppVersionState 
} from '../../services/versionService';

export const SystemVersionCard: React.FC = () => {
  const [versionState, setVersionState] = useState<AppVersionState>(() => getAppVersionState());
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);

  // Form states for custom version
  const [customVerInput, setCustomVerInput] = useState('');
  const [customTitleInput, setCustomTitleInput] = useState('');
  const [customDescInput, setCustomDescInput] = useState('');
  const [updateType, setUpdateType] = useState<'patch' | 'minor' | 'major'>('patch');

  useEffect(() => {
    const unsub = subscribeAppVersion((st) => {
      setVersionState(st);
    });
    return unsub;
  }, []);

  const handleQuickBump = (type: 'patch' | 'minor' | 'major') => {
    let title = '';
    let desc = '';
    if (type === 'patch') {
      title = 'Maintenance & Performance Optimization';
      desc = 'Applied lab workflow patches, UI enhancements, and security improvements.';
    } else if (type === 'minor') {
      title = 'Feature Enhancements & Module Update';
      desc = 'New tools, expanded data mapping, and improved testing protocols added.';
    } else {
      title = 'Major Lab Platform Upgrade';
      desc = 'Comprehensive architectural improvements and core system upgrade.';
    }

    const updated = bumpAppVersion(type, title, desc);
    triggerSuccess();
  };

  const handleSaveCustomUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customVerInput.trim()) {
      alert('Please enter a valid version number (e.g., 4.3.0).');
      return;
    }

    setCustomVersion(
      customVerInput.trim(),
      customTitleInput.trim() || `Release ${customVerInput.trim()}`,
      customDescInput.trim() || 'System update published from Settings Version Manager.',
      updateType
    );

    setIsUpdateModalOpen(false);
    setCustomVerInput('');
    setCustomTitleInput('');
    setCustomDescInput('');
    triggerSuccess();
  };

  const triggerSuccess = () => {
    setJustUpdated(true);
    setTimeout(() => setJustUpdated(false), 3000);
  };

  // Format last updated date
  const formattedDate = new Date(versionState.lastUpdated).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-500/30 shadow-2xl space-y-6 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 text-white shadow-lg shadow-cyan-950/60 border border-cyan-400/30">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                LLT Lab Application Version
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-cyan-950 text-cyan-300 border border-cyan-700/60 shadow-sm animate-pulse">
                {versionState.currentVersion}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                {versionState.channel} Release
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Last System Update: <strong className="text-slate-200">{formattedDate}</strong></span>
            </p>
          </div>
        </div>

        {/* Action Button: Publish New Update */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsUpdateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-cyan-950/50 cursor-pointer active:scale-95 transition-all"
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span>Update Version</span>
          </button>
        </div>
      </div>

      {/* Version Highlight Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Current Release</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-mono font-black text-cyan-400">{versionState.currentVersion}</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Live &amp; Active
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Build Number</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-mono font-black text-purple-400">#{versionState.buildNumber}</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Compiled Release</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Environment</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-sm font-bold text-white">Full-Stack Lab</span>
          </div>
          <span className="text-[10px] text-cyan-400 mt-1">Vite + React 19</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Auto Sync</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-sm font-bold text-emerald-400">Synchronized</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Storage &amp; Cloud</span>
        </div>
      </div>

      {/* Quick Increment Actions Banner */}
      <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-white">Quick Version Bump</h4>
          </div>
          <p className="text-[11px] text-slate-400">
            Click to increment the version number automatically whenever changes or lab updates are deployed.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <button
            type="button"
            onClick={() => handleQuickBump('patch')}
            className="flex-1 md:flex-none px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-cyan-500/30 text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
            title="Increment Patch Version (e.g. v4.2.5 -> v4.2.6)"
          >
            <span>+0.0.1 (Patch)</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickBump('minor')}
            className="flex-1 md:flex-none px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
            title="Increment Minor Version (e.g. v4.2.5 -> v4.3.0)"
          >
            <span>+0.1 (Minor)</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickBump('major')}
            className="flex-1 md:flex-none px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
            title="Increment Major Version (e.g. v4.2.5 -> v5.0.0)"
          >
            <span>+1.0 (Major)</span>
          </button>
        </div>
      </div>

      {justUpdated && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in zoom-in-95">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Application Version updated successfully to <strong className="text-white font-mono">{versionState.currentVersion}</strong> (Build #{versionState.buildNumber})!</span>
        </div>
      )}

      {/* Changelog & History Drawer */}
      <div className="pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white py-2 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span>Version History &amp; Release Notes ({versionState.history.length})</span>
          </div>
          {isHistoryExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {isHistoryExpanded && (
          <div className="mt-3 space-y-3 animate-in fade-in duration-200">
            {versionState.history.map((log, idx) => (
              <div 
                key={log.id || idx}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-cyan-400 text-xs">
                      {log.version}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {log.title}
                    </span>
                    {idx === 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="font-mono text-purple-400">Build #{log.buildNumber}</span>
                    <span>•</span>
                    <span>{log.releaseDate}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed pl-1">
                  {log.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Add Custom Version & Release Notes */}
      {isUpdateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border-2 border-cyan-500/50 shadow-2xl p-6 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Publish Application Update</h3>
                  <p className="text-xs text-slate-400">Update system release version and log notes</p>
                </div>
              </div>
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomUpdate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    New Version Number: <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customVerInput}
                    onChange={(e) => setCustomVerInput(e.target.value)}
                    placeholder="e.g. 4.3.0 or v4.3.0"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono font-bold focus:border-cyan-400 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500">Current version: {versionState.currentVersion}</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    Release Type:
                  </label>
                  <select
                    value={updateType}
                    onChange={(e) => setUpdateType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="patch">Patch (+0.0.1 Maintenance)</option>
                    <option value="minor">Minor (+0.1 Feature Update)</option>
                    <option value="major">Major (+1.0 Platform Release)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Update Title / Headline:
                </label>
                <input
                  type="text"
                  value={customTitleInput}
                  onChange={(e) => setCustomTitleInput(e.target.value)}
                  placeholder="e.g. Report Fast Generator & Layout Optimization"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Release Notes / Changes:
                </label>
                <textarea
                  rows={3}
                  value={customDescInput}
                  onChange={(e) => setCustomDescInput(e.target.value)}
                  placeholder="Describe what changes, bug fixes, or new features were implemented..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUpdateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-lg shadow-cyan-950/50 cursor-pointer active:scale-95"
                >
                  Save &amp; Update Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
