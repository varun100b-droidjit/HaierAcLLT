import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  UploadCloud, 
  FileJson, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  RefreshCw, 
  ArrowRight, 
  FileUp, 
  Check, 
  ExternalLink, 
  Archive, 
  Clock,
  Sparkles,
  ShieldCheck,
  CheckSquare,
  Square,
  X,
  FileCheck
} from 'lucide-react';
import { 
  getProtoUnits, 
  setProtoUnitsDirectly, 
  syncProtoUnitToFirestore, 
  fetchProtoUnitsFromServer 
} from '../../services/protoUnitStore';
import { ProtoUnit } from '../../types';
import { audioAlarm } from '../../utils/audioAlarm';
import { addLabNotification } from '../../services/unitStore';
import { broadcastLabRealtimeEvent } from '../../lib/supabase';
import { idbGetAll, idbSaveAll, restorePhotosFromIdb } from '../../lib/indexedDbStorage';

interface ProtoDataManagementCardProps {
  onNavigateToProtoUnits?: () => void;
}

interface ParsedBackupData {
  fileName: string;
  units: ProtoUnit[];
  metadata?: {
    exportedAt?: string;
    exportType?: string;
    version?: string;
    totalUnits?: number;
    liveCount?: number;
    finishedCount?: number;
    stoppedCount?: number;
  };
}

function formatNowForFilename(): string {
  const now = new Date();
  const yr = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const da = String(now.getDate()).padStart(2, '0');
  const hr = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${yr}-${mo}-${da}_${hr}-${mi}`;
}

function formatNowReadable(): string {
  const now = new Date();
  const yr = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const da = String(now.getDate()).padStart(2, '0');
  const hr = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const sc = String(now.getSeconds()).padStart(2, '0');
  return `${yr}-${mo}-${da} ${hr}:${mi}:${sc}`;
}

export const ProtoDataManagementCard: React.FC<ProtoDataManagementCardProps> = ({
  onNavigateToProtoUnits
}) => {
  const [protoUnits, setProtoUnits] = useState<ProtoUnit[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportScope, setExportScope] = useState<'all' | 'live_finished' | 'live' | 'finished'>('all');

  // Import flow state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parsedBackup, setParsedBackup] = useState<ParsedBackupData | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isRestoring, setIsRestoring] = useState(false);

  // Feedback notifications
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    count?: number;
  } | null>(null);

  // Refresh proto units cache
  const refreshUnits = async () => {
    setIsRefreshing(true);
    try {
      let units = getProtoUnits();
      if (units.length === 0) {
        const serverUnits = await fetchProtoUnitsFromServer();
        if (serverUnits && serverUnits.length > 0) {
          units = serverUnits;
        }
      }
      setProtoUnits(units);
    } catch (err) {
      console.warn('[ProtoDataCard] Error refreshing proto units:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshUnits();
    const interval = setInterval(refreshUnits, 4000);
    return () => clearInterval(interval);
  }, []);

  // Compute live, finished, stopped stats
  const liveUnits = protoUnits.filter(u => u.status === 'live');
  const finishedUnits = protoUnits.filter(u => u.status === 'finished');
  const stoppedUnits = protoUnits.filter(u => u.status === 'stopped');

  // Handle Export
  const handleExportData = async () => {
    setIsExporting(true);
    setFeedback(null);

    try {
      let allUnits = getProtoUnits();
      if (allUnits.length === 0) {
        const s = await fetchProtoUnitsFromServer();
        if (s && s.length > 0) allUnits = s;
      }

      if (allUnits.length === 0) {
        setFeedback({
          type: 'error',
          message: 'Export karne ke liye koi bhi Proto unit database me uplabdh nahi hai.'
        });
        setIsExporting(false);
        return;
      }

      // Restore full high-fidelity photos from IndexedDB if stored there
      try {
        const idbUnits = await idbGetAll<ProtoUnit>('proto_units');
        if (idbUnits && idbUnits.length > 0) {
          allUnits = restorePhotosFromIdb(allUnits, idbUnits);
        }
      } catch (idbErr) {
        console.warn('[ProtoDataCard] IDB photo hydration note:', idbErr);
      }

      // Filter units according to selected scope
      let filteredUnits: ProtoUnit[] = [];
      if (exportScope === 'all') {
        filteredUnits = allUnits;
      } else if (exportScope === 'live_finished') {
        filteredUnits = allUnits.filter(u => u.status === 'live' || u.status === 'finished');
      } else if (exportScope === 'live') {
        filteredUnits = allUnits.filter(u => u.status === 'live');
      } else if (exportScope === 'finished') {
        filteredUnits = allUnits.filter(u => u.status === 'finished');
      }

      if (filteredUnits.length === 0) {
        setFeedback({
          type: 'error',
          message: `Chuni gayi category (${exportScope}) me koi bhi Proto machine nahi mili.`
        });
        setIsExporting(false);
        return;
      }

      const liveCount = filteredUnits.filter(u => u.status === 'live').length;
      const finishedCount = filteredUnits.filter(u => u.status === 'finished').length;
      const stoppedCount = filteredUnits.filter(u => u.status === 'stopped').length;

      const payload = {
        exportType: 'llt_proto_units_backup',
        version: '2.0',
        exportedAt: formatNowReadable(),
        scope: exportScope,
        summary: {
          totalUnits: filteredUnits.length,
          liveCount,
          finishedCount,
          stoppedCount
        },
        units: filteredUnits
      };

      const jsonString = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `proto_machines_backup_${exportScope}_${formatNowForFilename()}.json`;
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      audioAlarm.playPassChime();

      setFeedback({
        type: 'success',
        message: `Safalta se ${filteredUnits.length} Proto Machines (${liveCount} Live, ${finishedCount} Finished) export ho gaye! File: ${filename}`,
        count: filteredUnits.length
      });

      addLabNotification(
        `Proto Data Exported: ${filteredUnits.length} Units`,
        `Exported ${liveCount} Live, ${finishedCount} Finished Proto machines to ${filename}.`
      );
    } catch (err: any) {
      console.error('Error exporting proto data:', err);
      setFeedback({
        type: 'error',
        message: `Export failed: ${err.message || 'Unknown error'}`
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Trigger File Input
  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Handle File Selection & Parse
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    setFeedback(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          throw new Error('Selected file is empty.');
        }

        const parsed = JSON.parse(text);
        let extractedUnits: ProtoUnit[] = [];
        let meta: any = {};

        if (Array.isArray(parsed)) {
          extractedUnits = parsed;
        } else if (parsed && Array.isArray(parsed.units)) {
          extractedUnits = parsed.units;
          meta = parsed.summary || {
            exportedAt: parsed.exportedAt,
            exportType: parsed.exportType,
            version: parsed.version
          };
        } else if (parsed && parsed.protoUnits && Array.isArray(parsed.protoUnits)) {
          // Compatibility with monster backup format
          extractedUnits = parsed.protoUnits;
          meta = { exportedAt: parsed.exportTimestamp, version: parsed.version };
        } else {
          throw new Error('File me Proto units ka valid array nahi mila.');
        }

        // Validate that items look like Proto units
        const validUnits = extractedUnits.filter((u: any) => {
          return u && typeof u === 'object' && (u.modelName || u.id);
        }).map((u: any) => {
          // Normalize unit if needed
          return {
            ...u,
            id: u.id || `proto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            modelName: u.modelName || 'Proto Unit',
            status: (['live', 'finished', 'stopped'].includes(u.status) ? u.status : 'live') as 'live' | 'finished' | 'stopped',
            partsInfo: u.partsInfo || {},
            photos: u.photos || {},
            requiredHour: Number(u.requiredHour) || 1045,
            doneHour: typeof u.doneHour === 'number' ? u.doneHour : (parseFloat(String(u.doneHour || 0)) || 0),
            station: u.station || 'Station 01',
            iduSerialNumber: u.iduSerialNumber || 'NA',
            oduSerialNumber: u.oduSerialNumber || 'NA',
            requestBy: u.requestBy || 'Indrajit',
            testPurpose: u.testPurpose || 'Product reliability testing and long run 1045 hour',
            createdAt: u.createdAt || formatNowReadable().slice(0, 16),
            updatedAt: u.updatedAt || formatNowReadable().slice(0, 16)
          } as ProtoUnit;
        });

        if (validUnits.length === 0) {
          throw new Error('File me koi valid Proto machine records nahi mile.');
        }

        setParsedBackup({
          fileName: file.name,
          units: validUnits,
          metadata: {
            ...meta,
            totalUnits: validUnits.length,
            liveCount: validUnits.filter(u => u.status === 'live').length,
            finishedCount: validUnits.filter(u => u.status === 'finished').length,
            stoppedCount: validUnits.filter(u => u.status === 'stopped').length
          }
        });
      } catch (err: any) {
        console.error('File parsing error:', err);
        setFeedback({
          type: 'error',
          message: `Invalid file format: ${err.message || 'JSON parse failed'}`
        });
      } finally {
        setIsParsingFile(false);
      }
    };

    reader.onerror = () => {
      setIsParsingFile(false);
      setFeedback({
        type: 'error',
        message: 'File read karne me error aayi.'
      });
    };

    reader.readAsText(file);
  };

  // Execute Restore into Proto
  const handleExecuteRestore = async () => {
    if (!parsedBackup || parsedBackup.units.length === 0) return;

    setIsRestoring(true);
    setFeedback(null);

    try {
      const incoming = parsedBackup.units;
      let finalUnits: ProtoUnit[] = [];

      if (importMode === 'replace') {
        // Complete replacement
        finalUnits = incoming;
      } else {
        // Smart Merge: update existing by ID, append new ones
        const current = getProtoUnits();
        const map = new Map<string, ProtoUnit>(current.map(u => [u.id, u]));
        incoming.forEach(u => {
          map.set(u.id, u);
        });
        finalUnits = Array.from(map.values());
      }

      // Sort by createdAt descending
      finalUnits.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      // 1. Direct Store Update (Saves to state, localStorage, IDB)
      setProtoUnitsDirectly(finalUnits);

      // 2. Persist to IDB
      try {
        await idbSaveAll('proto_units', finalUnits);
      } catch {}

      // 3. Persist to server backend file for multi-browser sync
      try {
        await fetch('/api/units/proto/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalUnits)
        });
      } catch (serverErr) {
        console.warn('Server sync error on import:', serverErr);
      }

      // 4. Firestore Background Sync (fire-and-forget)
      try {
        incoming.forEach(u => syncProtoUnitToFirestore(u));
      } catch (fsErr) {
        console.warn('Firestore sync note on import:', fsErr);
      }

      // 5. Broadcast Realtime event to other browsers/tabs
      broadcastLabRealtimeEvent('proto_units_change', { timestamp: Date.now() });

      const restoredLive = incoming.filter(u => u.status === 'live').length;
      const restoredFinished = incoming.filter(u => u.status === 'finished').length;

      audioAlarm.playPassChime();

      setFeedback({
        type: 'success',
        message: `Safalta se ${incoming.length} Proto Machines (${restoredLive} Live, ${restoredFinished} Finished) Proto Units me restore ho gaye! Vapas pehle ki tarah dikh rahe hain.`,
        count: incoming.length
      });

      addLabNotification(
        `Proto Data Restored: ${incoming.length} Units`,
        `Restored ${restoredLive} Live, ${restoredFinished} Finished units from ${parsedBackup.fileName}.`
      );

      // Close modal
      setParsedBackup(null);

      // Refresh local view
      refreshUnits();
    } catch (err: any) {
      console.error('Error executing proto restore:', err);
      setFeedback({
        type: 'error',
        message: `Restore failed: ${err.message || 'Unknown error'}`
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleNavigateProto = () => {
    if (onNavigateToProtoUnits) {
      onNavigateToProtoUnits();
    } else {
      window.dispatchEvent(new CustomEvent('navigate_tab', { detail: 'proto-units' }));
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
      {/* Hidden File Input for Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-cyan-950/80 border border-cyan-800/80 text-cyan-400 shadow-inner">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-wide">
                Proto Units Data Backup & Restore (Export / Import)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-800">
                Live & Finished
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Proto ke Live aur Finished machines ka complete data (photos, running hours, parts & reports) JSON me export karein aur usi data ko import karke wapas Proto me restore karein.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={refreshUnits}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all cursor-pointer"
            title="Refresh Proto Count"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          {onNavigateToProtoUnits && (
            <button
              type="button"
              onClick={handleNavigateProto}
              className="px-3 py-2 rounded-xl bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Proto Screen</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Real-time Status Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-cyan-900/50 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>🟢 Live Machines</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <div className="mt-2 text-2xl font-black text-cyan-300 font-mono">
            {liveUnits.length}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-900/50 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>🏁 Finished</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-300 font-mono">
            {finishedUnits.length}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950 border border-amber-900/50 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>⏹️ Stopped</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-300 font-mono">
            {stoppedUnits.length}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>📦 Total Proto</span>
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">
            {protoUnits.length}
          </div>
        </div>
      </div>

      {/* Dual Action Cards: Export & Import */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CARD 1: EXPORT PROTO DATA */}
        <div className="p-5 rounded-2xl bg-slate-950/90 border border-cyan-500/40 hover:border-cyan-500/70 transition-all flex flex-col justify-between space-y-4 shadow-lg group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-cyan-400 font-black text-sm">
                <Download className="w-5 h-5 stroke-[2.5]" />
                <span>1. Export Proto Data (Download)</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-mono font-bold">
                JSON File
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Proto ke sabhi Live aur Finished machines ka complete data (photo attachments, component parts info, nameplate, test commenced & completed dates, running done hours) ek single backup file me download karein.
            </p>

            {/* Scope Selection */}
            <div className="pt-1 space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 block uppercase tracking-wider">
                Select Scope:
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setExportScope('all')}
                  className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                    exportScope === 'all'
                      ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span>All ({protoUnits.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope('live_finished')}
                  className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                    exportScope === 'live_finished'
                      ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span>Live + Finished ({liveUnits.length + finishedUnits.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope('live')}
                  className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                    exportScope === 'live'
                      ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span>Live Only ({liveUnits.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope('finished')}
                  className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                    exportScope === 'finished'
                      ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span>Finished Only ({finishedUnits.length})</span>
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportData}
            disabled={isExporting || protoUnits.length === 0}
            className="w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-black text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-500 hover:from-cyan-300 hover:to-teal-300 transition-all shadow-md shadow-cyan-950/50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Exporting Proto Data...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Export Proto Data (Download JSON)</span>
              </>
            )}
          </button>
        </div>

        {/* CARD 2: IMPORT PROTO DATA */}
        <div className="p-5 rounded-2xl bg-slate-950/90 border border-emerald-500/40 hover:border-emerald-500/70 transition-all flex flex-col justify-between space-y-4 shadow-lg group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-emerald-400 font-black text-sm">
                <FileUp className="w-5 h-5 stroke-[2.5]" />
                <span>2. Import Proto Data (Restore)</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold">
                Auto Sync
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Export kiye gaye backup file ko upload karein. Sabhi Live aur Finished machines turant wapas Proto Units me restore ho jayenge aur har browser me live dikhenge.
            </p>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>100% Full Fidelity Restoration:</span>
              </div>
              <p className="text-slate-400 pl-5">
                Saare photos, running done hours, stations, component parts aur report details jaisa pehle tha waisa hi restore ho jayega.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTriggerFileInput}
            disabled={isParsingFile}
            className="w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-black text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-md shadow-emerald-950/50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-40"
          >
            {isParsingFile ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Reading Backup File...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                <span>Choose & Import Proto File (.json)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
          feedback.type === 'success'
            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
            : 'bg-rose-950/80 border-rose-500 text-rose-200'
        }`}>
          <div className="flex items-center gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="font-mono font-bold">{feedback.message}</span>
          </div>

          <div className="flex items-center gap-2">
            {feedback.type === 'success' && onNavigateToProtoUnits && (
              <button
                type="button"
                onClick={handleNavigateProto}
                className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 text-xs font-black hover:bg-emerald-400 transition-all cursor-pointer flex items-center gap-1 shrink-0"
              >
                <span>View in Proto</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Import Confirmation & Preview Modal */}
      {parsedBackup && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-950/80 border border-emerald-800 text-emerald-400">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">Restore Proto Units</h4>
                  <p className="text-xs text-slate-400 font-mono">
                    File: <strong className="text-cyan-300">{parsedBackup.fileName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setParsedBackup(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-950 border border-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary Strip */}
            <div className="grid grid-cols-3 gap-2.5 text-center font-mono text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Total Found</span>
                <span className="text-base font-black text-white">{parsedBackup.units.length}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-cyan-900/60">
                <span className="text-[10px] text-cyan-400 block">Live Machines</span>
                <span className="text-base font-black text-cyan-300">
                  {parsedBackup.units.filter(u => u.status === 'live').length}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-900/60">
                <span className="text-[10px] text-emerald-400 block">Finished</span>
                <span className="text-base font-black text-emerald-300">
                  {parsedBackup.units.filter(u => u.status === 'finished').length}
                </span>
              </div>
            </div>

            {/* Import Mode Options */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Choose Import Mode:
              </label>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setImportMode('merge')}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                    importMode === 'merge'
                      ? 'bg-cyan-950/80 border-cyan-500 text-white font-bold shadow-md shadow-cyan-950/30'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CheckSquare className="w-4 h-4 text-cyan-400" />
                    <span className="font-black text-xs">Smart Merge (Recommended)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-normal">
                    Existing machines ko update karega aur naye machines ko add karega.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                    importMode === 'replace'
                      ? 'bg-rose-950/80 border-rose-500 text-white font-bold shadow-md shadow-rose-950/30'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Square className="w-4 h-4 text-rose-400" />
                    <span className="font-black text-xs">Clean Replace All</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-normal">
                    Current Proto data ko hata kar is file ke data se replace karega.
                  </p>
                </button>
              </div>
            </div>

            {/* Preview of Units in File */}
            <div className="flex-1 min-h-[140px] max-h-56 overflow-y-auto space-y-1.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono">
              <span className="text-[10px] uppercase font-bold text-slate-400 block pb-1 border-b border-slate-800">
                Machines Preview in this Backup:
              </span>
              {parsedBackup.units.map((u, idx) => (
                <div key={u.id || idx} className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      u.status === 'live'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        : u.status === 'finished'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      {u.status.toUpperCase()}
                    </span>
                    <span className="text-white font-bold">{u.modelName}</span>
                    <span className="text-slate-400 text-[11px]">({u.station || 'St. 01'})</span>
                  </div>
                  <div className="text-slate-300 font-bold">
                    <span>{u.doneHour ?? 0}h / {u.requiredHour}h</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setParsedBackup(null)}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Restoring Proto Machines...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Confirm & Restore ({parsedBackup.units.length} Units)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
