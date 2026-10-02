import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  X,
  ExternalLink,
  Layers,
  FileSpreadsheet,
  Cpu,
  Flame,
  FileText,
  Radio,
  Server,
  CloudCheck,
  ShieldAlert
} from 'lucide-react';
import {
  testAllSupabaseTables,
  TableTestResult,
  SUPABASE_SQL_SCHEMA
} from '../../lib/supabase';
import { syncAllLocalDataToSupabase, SyncAllSummary } from '../../services/supabaseSyncAll';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose
}) => {
  const [tableStatus, setTableStatus] = useState<Record<string, TableTestResult>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('');
  const [syncSummary, setSyncSummary] = useState<SyncAllSummary | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'sql' | 'guide'>('status');

  useEffect(() => {
    if (isOpen) {
      runDiagnostics();
    }
  }, [isOpen]);

  const runDiagnostics = async () => {
    setIsTesting(true);
    try {
      const res = await testAllSupabaseTables();
      setTableStatus(res.results);
    } catch (err) {
      console.error('Error running diagnostics:', err);
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    setSyncSummary(null);
    try {
      const summary = await syncAllLocalDataToSupabase((msg) => {
        setSyncStatusText(msg);
      });
      setSyncSummary(summary);
      await runDiagnostics();
    } catch (err) {
      console.error('Error running full sync:', err);
    } finally {
      setIsSyncing(false);
      setSyncStatusText('');
    }
  };

  if (!isOpen) return null;

  const tableMetadata: Record<string, { label: string; icon: any; color: string; desc: string }> = {
    proto_units: {
      label: 'Proto Units',
      icon: Cpu,
      color: 'text-cyan-400',
      desc: 'Engineering prototypes & sample runs'
    },
    pp_units: {
      label: 'PP Units',
      icon: Layers,
      color: 'text-emerald-400',
      desc: 'Pre-production test batches'
    },
    field_units: {
      label: 'Field Units',
      icon: Radio,
      color: 'text-indigo-400',
      desc: 'Field simulation & reliability testing'
    },
    rd_units: {
      label: 'R&D Units',
      icon: RefreshCw,
      color: 'text-purple-400',
      desc: 'R&D custody transfers & stages'
    },
    smog_leak_units: {
      label: 'Smog Leak Records',
      icon: Flame,
      color: 'text-rose-400',
      desc: 'Helium/Smog leak inspection history'
    },
    report_room_reports: {
      label: 'Report Room',
      icon: FileText,
      color: 'text-amber-400',
      desc: 'Customer simulation & experience reports'
    }
  };

  const allTablesOk = Object.values(tableStatus).length > 0 && Object.values(tableStatus).every((t) => t.exists);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold shadow-lg shadow-emerald-950">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">Supabase Cloud Database Manager</h2>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                    allTablesOk
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60'
                      : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                  }`}
                >
                  {allTablesOk ? 'All Tables Connected' : 'Setup Required'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Proto, PP, Field, R&D, Smog & Report Room Real-Time Cloud Sync
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('status')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'status'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Live Table Status
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sql')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'sql'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>Supabase SQL Script</span>
              <span className="text-[9px] bg-cyan-950 px-1.5 py-0.2 rounded text-cyan-300 font-mono">1-Click</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'guide'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Setup Guide (Hindi/Eng)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runDiagnostics}
              disabled={isTesting}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-cyan-400' : ''}`} />
              <span>Test Connection</span>
            </button>

            <button
              type="button"
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync All Data Now'}</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Ongoing Sync Status Banner */}
          {isSyncing && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/60 flex items-center gap-3 animate-pulse">
              <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
              <div>
                <p className="text-xs font-bold text-emerald-300">{syncStatusText || 'Syncing data with Supabase...'}</p>
                <p className="text-[10px] text-slate-400">Saving all local records to your Supabase tables</p>
              </div>
            </div>
          )}

          {/* Sync Result Summary Banner */}
          {syncSummary && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-sm font-black text-white">Data Sync Completed!</h4>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {syncSummary.totalSynced} Records Synced
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Proto</span>
                  <strong className="text-cyan-400 font-mono text-sm">{syncSummary.protoCount}</strong>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">PP</span>
                  <strong className="text-emerald-400 font-mono text-sm">{syncSummary.ppCount}</strong>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Field</span>
                  <strong className="text-indigo-400 font-mono text-sm">{syncSummary.fieldCount}</strong>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">R&D</span>
                  <strong className="text-purple-400 font-mono text-sm">{syncSummary.rdCount}</strong>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Smog</span>
                  <strong className="text-rose-400 font-mono text-sm">{syncSummary.smogCount}</strong>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Reports</span>
                  <strong className="text-amber-400 font-mono text-sm">{syncSummary.reportsCount}</strong>
                </div>
              </div>

              {syncSummary.errors.length > 0 && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 space-y-1">
                  <span className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Some tables had warnings:
                  </span>
                  <ul className="text-[10px] text-rose-200/80 list-disc list-inside space-y-0.5 font-mono">
                    {syncSummary.errors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: TABLE STATUS */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white">Database Tables Status</h3>
                  <p className="text-xs text-slate-400">
                    Live connection to Supabase database tables
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('sql')}
                  className="px-3 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800/60 text-xs font-bold hover:bg-cyan-900 transition-colors"
                >
                  View SQL Script →
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(tableMetadata).map(([tableName, meta]) => {
                  const status = tableStatus[tableName];
                  const Icon = meta.icon;
                  const isOk = status?.exists;

                  return (
                    <div
                      key={tableName}
                      className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 transition-all ${
                        isOk
                          ? 'bg-slate-900/90 border-emerald-800/50 hover:border-emerald-700'
                          : 'bg-slate-950 border-amber-900/50 hover:border-amber-700'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-2 rounded-lg bg-slate-950 border border-slate-800 ${meta.color} shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">{meta.label}</span>
                            <code className="text-[10px] text-slate-500 font-mono">({tableName})</code>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">{meta.desc}</p>
                          {status?.error && (
                            <p className="text-[10px] text-rose-400 font-mono mt-1 truncate">
                              Error: {status.error}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {isTesting ? (
                          <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" />
                        ) : isOk ? (
                          <div className="flex flex-col items-end">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Ready
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 mt-1">
                              {status?.count ?? 0} rows
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Missing
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveTab('sql')}
                              className="text-[10px] text-cyan-400 hover:underline mt-1 cursor-pointer font-bold"
                            >
                              Run SQL
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!allTablesOk && (
                <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/60 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200/90 leading-relaxed">
                    <strong className="text-white font-bold block mb-1">
                      Tables not created in Supabase yet?
                    </strong>
                    Data save hone ke liye Supabase me yeh 6 tables banni zaroori hain. Click karein{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('sql')}
                      className="text-cyan-300 font-bold underline cursor-pointer"
                    >
                      "Supabase SQL Script"
                    </button>{' '}
                    aur Supabase Dashboard ke SQL Editor me 1-click me run kar dein!
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SQL SCRIPT */}
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white">Complete Supabase SQL Script</h3>
                  <p className="text-xs text-slate-400">
                    Creates all 6 tables, JSONB columns, indexes, and Row Level Security policies
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopySql}
                  className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 ${
                    copiedSql
                      ? 'bg-emerald-600 text-white'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950'
                  }`}
                >
                  {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-cyan-200/90 font-mono overflow-x-auto max-h-96 leading-relaxed select-all">
                  {SUPABASE_SQL_SCHEMA}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: STEP BY STEP GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-4">
              <h3 className="text-sm font-extrabold text-white">
                Supabase Me Tables Banane Ka Simple Step-by-Step Tarika:
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-cyan-950 text-cyan-400 font-black flex items-center justify-center border border-cyan-800">
                    1
                  </div>
                  <h4 className="font-bold text-white">SQL Script Copy Karein</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Upar diye gaye <strong className="text-cyan-300">"Supabase SQL Script"</strong> tab par jakar <strong>"Copy SQL Script"</strong> button click karein.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-950 text-emerald-400 font-black flex items-center justify-center border border-emerald-800">
                    2
                  </div>
                  <h4 className="font-bold text-white">Supabase SQL Editor Kholein</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Apne Supabase Dashboard (<a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-emerald-400 underline inline-flex items-center gap-1">supabase.com <ExternalLink className="w-2.5 h-2.5" /></a>) me jakar left menu me <strong>"SQL Editor"</strong> par click karein aur <strong>"New Query"</strong> banayein.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-950 text-indigo-400 font-black flex items-center justify-center border border-indigo-800">
                    3
                  </div>
                  <h4 className="font-bold text-white">Paste aur RUN karein</h4>
                  <p className="text-slate-400 leading-relaxed">
                    Script paste karke <strong>"RUN"</strong> dabayein. Sabhi 6 tables turant ready ho jayengi aur app se sara data Supabase me save hone lagega!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            Current Supabase Project:{' '}
            <strong className="text-slate-200 font-mono">fcmkbyeffrlncrpdrdbb.supabase.co</strong>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
