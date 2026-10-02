import React, { useState, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  Database, 
  RotateCcw, 
  ShieldCheck, 
  Check, 
  Layers, 
  FlaskConical,
  HardDrive,
  Download,
  UploadCloud,
  Trash2,
  Lock,
  KeyRound,
  AlertTriangle,
  FileCheck2,
  RefreshCw,
  X,
  Smartphone,
  Laptop,
  CheckCircle2,
  ArrowDownToLine,
  FileUp,
  Server
} from 'lucide-react';
import { isFirebaseConfigured } from '../../services/firebase';
import { resetToDemoData } from '../../services/unitStore';
import { LabShiftSelector } from '../Common/LabShiftSelector';
import { SystemVersionCard } from './SystemVersionCard';
import { ModelSheetManagementCard } from './ModelSheetManagementCard';
import { PhotoQualityCard } from './PhotoQualityCard';
import { AutoRefreshSettingsCard } from './AutoRefreshSettingsCard';
import { 
  downloadAllMonsterData, 
  purgeAllSupabaseAndFirebaseData, 
  uploadAndRestoreMonsterData,
  MonsterBackupPayload 
} from '../../services/monsterDataService';

interface SettingsModuleProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSupabaseModal?: () => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  theme,
  onToggleTheme,
  onOpenSupabaseModal
}) => {
  // Monster Data Backup & Purge States
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isProcessingPurge, setIsProcessingPurge] = useState(false);
  const [purgeProgressStep, setPurgeProgressStep] = useState<string>('');
  const [purgeSuccessModal, setPurgeSuccessModal] = useState<{
    open: boolean;
    downloadedFile: string;
    itemsDeleted: number;
  } | null>(null);

  // Monster Data Upload States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingMonster, setIsUploadingMonster] = useState(false);
  const [uploadProgressStep, setUploadProgressStep] = useState<string>('');
  const [uploadSuccessModal, setUploadSuccessModal] = useState<{
    open: boolean;
    summary: {
      rdUnits: number;
      ppUnits: number;
      protoUnits: number;
      fieldUnits: number;
      smogUnits: number;
      logs: number;
    };
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleResetData = () => {
    if (window.confirm("Are you sure you want to reset LLT Lab dataset to default demo units?")) {
      resetToDemoData();
      alert("LLT Lab data has been reset to default sample units.");
      window.location.reload();
    }
  };

  // 1. Open PIN Modal for Purge & Download
  const handleOpenPinModal = () => {
    setEnteredPin('');
    setPinError('');
    setIsPinModalOpen(true);
  };

  // 2. Authorize PIN and execute Download -> Purge
  const handleAuthorizeAndPurge = async () => {
    if (enteredPin !== '0000') {
      setPinError('Invalid Security PIN. Please enter the correct 4-digit authorization code.');
      return;
    }

    setPinError('');
    setIsProcessingPurge(true);

    try {
      // Step 1: Download all data to device
      setPurgeProgressStep('1. Gathering & downloading all laboratory data to your device...');
      const backupPayload = await downloadAllMonsterData();
      await new Promise(r => setTimeout(r, 900));

      // Step 2: Delete from Firebase & Supabase & Local
      setPurgeProgressStep('2. Purging all collections from Supabase & Firebase Firestore...');
      const purgeResult = await purgeAllSupabaseAndFirebaseData();
      await new Promise(r => setTimeout(r, 800));

      setPurgeProgressStep('3. Finalizing wipeout and refreshing stores...');
      await new Promise(r => setTimeout(r, 500));

      setIsProcessingPurge(false);
      setIsPinModalOpen(false);

      const totalItems = (backupPayload.summary.rdUnitsCount || 0) +
        (backupPayload.summary.ppUnitsCount || 0) +
        (backupPayload.summary.protoUnitsCount || 0) +
        (backupPayload.summary.fieldUnitsCount || 0) +
        (backupPayload.summary.smogUnitsCount || 0);

      setPurgeSuccessModal({
        open: true,
        downloadedFile: `LLT_LAB_MONSTER_BACKUP_${new Date().toISOString().slice(0, 10)}.json`,
        itemsDeleted: totalItems
      });
    } catch (err: any) {
      console.error('Purge error:', err);
      setPinError(err?.message || 'Download & Purge failed. Please try again.');
      setIsProcessingPurge(false);
    }
  };

  // 3. Trigger File Upload Picker
  const handleTriggerUpload = () => {
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // 4. Process Uploaded Monster Data File
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMonster(true);
    setUploadError(null);
    setUploadProgressStep('Reading and parsing Monster Data JSON file...');

    try {
      const fileText = await file.text();
      let parsedData: any;
      try {
        parsedData = JSON.parse(fileText);
      } catch (parseErr) {
        throw new Error('Invalid JSON file format. Please upload a valid LLT Lab Monster Data Backup JSON file.');
      }

      setUploadProgressStep('Uploading & Syncing records to Supabase & Firebase Firestore...');
      const result = await uploadAndRestoreMonsterData(parsedData);
      await new Promise(r => setTimeout(r, 800));

      setUploadProgressStep('Updating live website view...');
      await new Promise(r => setTimeout(r, 400));

      setIsUploadingMonster(false);
      setUploadSuccessModal({
        open: true,
        summary: {
          rdUnits: result.rdUnitsRestored,
          ppUnits: result.ppUnitsRestored,
          protoUnits: result.protoUnitsRestored,
          fieldUnits: result.fieldUnitsRestored,
          smogUnits: result.smogUnitsRestored,
          logs: result.logsRestored
        }
      });
    } catch (err: any) {
      console.error('Monster data restore error:', err);
      setIsUploadingMonster(false);
      setUploadError(err?.message || 'Failed to upload monster data. Please verify file integrity.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300 pb-12">
      {/* Hidden File Input for Monster Data Upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".json,application/json" 
        className="hidden" 
      />

      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-cyan-950 border border-cyan-800 text-cyan-400">
            <SettingsIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              LLT Lab System Settings
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Configure personnel defaults, master data backup, Supabase/Firebase sync, and laboratory shift schedules.
            </p>
          </div>
        </div>
      </div>

      {/* Master Monster Data Management Section */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border-2 border-cyan-500/30 shadow-2xl space-y-6 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-cyan-950/80 border border-cyan-700/60 text-cyan-400">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight">
                  Master Monster Data Center
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Full Backup & Restore
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Download complete laboratory dataset locally and purge cloud databases, or re-upload backup to restore all systems.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 self-start sm:self-auto">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <Laptop className="w-4 h-4 text-cyan-400" />
            <span>Mobile / Tablet / PC Compatible</span>
          </div>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Button 1: Download & Purge All Data */}
          <div className="p-5 rounded-2xl bg-slate-950/90 border border-rose-500/30 hover:border-rose-500/60 transition-all flex flex-col justify-between space-y-4 shadow-lg group">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-rose-400 font-black text-sm">
                  <ArrowDownToLine className="w-5 h-5" />
                  <span>Download & Purge Data</span>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-800/80">
                  <Lock className="w-3 h-3" /> PIN Protected
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                First, all laboratory data (R&D, PP, Proto, Field, Smog, Logs) will be exported and downloaded to your Mobile / Tablet / Laptop as a <strong className="text-slate-200">JSON backup file</strong>, and then completely purged from Supabase and Firebase.
              </p>
            </div>

            <button
              onClick={handleOpenPinModal}
              id="btn-download-purge-master-data"
              className="w-full py-3 px-4 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-rose-600 via-rose-700 to-red-700 hover:from-rose-500 hover:to-red-600 transition-all shadow-md shadow-rose-950/50 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>Delete With Backup</span>
            </button>
          </div>

          {/* Button 2: Upload Monster Data */}
          <div className="p-5 rounded-2xl bg-slate-950/90 border border-emerald-500/30 hover:border-emerald-500/60 transition-all flex flex-col justify-between space-y-4 shadow-lg group">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-emerald-400 font-black text-sm">
                  <FileUp className="w-5 h-5" />
                  <span>Upload Monster Data</span>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                  <Server className="w-3 h-3" /> Auto Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Upload a previously downloaded backup JSON file to restore all records to <strong className="text-emerald-300">Supabase & Firebase</strong>. All units and logs will instantly reappear across the entire platform.
              </p>
            </div>

            <button
              onClick={handleTriggerUpload}
              id="btn-upload-monster-data"
              disabled={isUploadingMonster}
              className="w-full py-3 px-4 rounded-xl text-xs font-extrabold text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 transition-all shadow-md shadow-emerald-950/50 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
            >
              {isUploadingMonster ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Uploading Monster Data...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 text-slate-950" />
                  <span>Upload Monster Data File</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Upload Error Banner if any */}
        {uploadError && (
          <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="flex-1">{uploadError}</div>
            <button onClick={() => setUploadError(null)} className="p-1 text-rose-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Lab Operation Shift Config */}
      <LabShiftSelector compact={false} />

      {/* Supabase Cloud Database & Tables Manager */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  Supabase Cloud Database & SQL Setup
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800">
                  PostgreSQL
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage cloud tables for Proto, PP, Field, R&D, Smog & Report Room. Test connectivity and run SQL setup queries.
              </p>
            </div>
          </div>

          {onOpenSupabaseModal && (
            <button
              type="button"
              onClick={onOpenSupabaseModal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <Database className="w-4 h-4" />
              <span>Open Supabase Manager</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
          <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Proto Table</span>
            <span className="text-cyan-400 font-mono text-xs font-bold">proto_units</span>
          </div>
          <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block">PP Table</span>
            <span className="text-emerald-400 font-mono text-xs font-bold">pp_units</span>
          </div>
          <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Field Table</span>
            <span className="text-indigo-400 font-mono text-xs font-bold">field_units</span>
          </div>
          <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block">R&D Table</span>
            <span className="text-purple-400 font-mono text-xs font-bold">rd_units</span>
          </div>
          <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Smog Table</span>
            <span className="text-rose-400 font-mono text-xs font-bold">smog_leak_units</span>
          </div>
          <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Reports Table</span>
            <span className="text-amber-400 font-mono text-xs font-bold">report_room</span>
          </div>
        </div>
      </div>

      {/* Database & Firebase Integration Info */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Database className="w-5 h-5 text-cyan-400" />
            Firebase Firestore Status
          </h3>

          <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Connection Engine:</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isFirebaseConfigured ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
              }`}>
                {isFirebaseConfigured ? 'Firebase Active' : 'Local Persistent Engine'}
              </span>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed">
              {isFirebaseConfigured ? (
                <span>Live synchronized with Cloud Firestore database. All unit additions, stage progressions, and activity logs sync in real time.</span>
              ) : (
                <span>Running in zero-lag reactive storage mode with browser persistence (`localStorage` & `IndexedDB`). Fully functional out-of-the-box.</span>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Data Management Actions
          </h4>

          <button
            onClick={handleResetData}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset to Demo Laboratory Dataset</span>
          </button>
        </div>
      </div>

      {/* Auto-Refresh & Real-Time Sync Settings CardView */}
      <AutoRefreshSettingsCard />

      {/* Photo Quality & Size Compression CardView */}
      <PhotoQualityCard />

      {/* Model Sheet Management CardView (Excel Upload & Manual Prefix Entry) */}
      <ModelSheetManagementCard />

      {/* Application Version & Update Management (Bottom of Settings) */}
      <SystemVersionCard />

      {/* =========================================================================
          SECURITY 4-DIGIT PIN CONFIRMATION MODAL FOR DOWNLOAD & PURGE
          ========================================================================= */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border-2 border-rose-500/50 shadow-2xl p-6 space-y-5 relative">
            {!isProcessingPurge && (
              <button
                onClick={() => setIsPinModalOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-950 text-rose-400 border border-rose-800">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  Security Authorization
                </h3>
                <p className="text-xs text-rose-400 font-semibold">
                  Purge & Download Confirmation
                </p>
              </div>
            </div>

            {isProcessingPurge ? (
              <div className="py-6 space-y-4 text-center">
                <RefreshCw className="w-10 h-10 animate-spin text-rose-400 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">
                    Processing Master Backup & Wipeout
                  </p>
                  <p className="text-xs text-slate-300 animate-pulse">
                    {purgeProgressStep || 'Please wait...'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    All system records will be downloaded to your device before being wiped from cloud databases. Please enter the <strong className="text-rose-400 font-black">4-Digit Security PIN</strong> to proceed:
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    Enter 4-Digit Security Code:
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={enteredPin}
                    onChange={(e) => {
                      setEnteredPin(e.target.value);
                      if (pinError) setPinError('');
                    }}
                    placeholder="••••"
                    autoFocus
                    className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest rounded-xl bg-slate-950 border-2 border-rose-500/50 text-rose-300 focus:outline-none focus:border-rose-400 placeholder:text-slate-600"
                  />
                  {pinError && (
                    <p className="text-xs font-semibold text-rose-400 flex items-center gap-1.5 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {pinError}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPinModalOpen(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAuthorizeAndPurge}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirm & Download</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          PURGE SUCCESS MODAL
          ========================================================================= */}
      {purgeSuccessModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border-2 border-emerald-500/50 shadow-2xl p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-white">
                Data Downloaded & Purged!
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Your laboratory backup file has been saved to your device, and the Supabase and Firebase cloud databases have been cleaned.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Downloaded Backup:</span>
                <span className="font-mono text-emerald-400 truncate max-w-[180px]">{purgeSuccessModal.downloadedFile}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Purged Records:</span>
                <span className="font-bold text-rose-400">{purgeSuccessModal.itemsDeleted} units/logs</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Supabase & Firebase:</span>
                <span className="font-bold text-emerald-400">Purged Clean (0 units)</span>
              </div>
            </div>

            <button
              onClick={() => setPurgeSuccessModal(null)}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors"
            >
              OK, Got It
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          UPLOAD SUCCESS MODAL
          ========================================================================= */}
      {uploadSuccessModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border-2 border-cyan-500/50 shadow-2xl p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-cyan-950 border border-cyan-600 text-cyan-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-white">
                Monster Data Restored Successfully!
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                All units, smog records, and activity logs have been uploaded to Supabase & Firebase and are now live across all laboratory modules.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>R&D Units Restored:</span>
                <span className="font-bold text-cyan-400">{uploadSuccessModal.summary.rdUnits}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>PP Units Restored:</span>
                <span className="font-bold text-cyan-400">{uploadSuccessModal.summary.ppUnits}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Proto Units Restored:</span>
                <span className="font-bold text-cyan-400">{uploadSuccessModal.summary.protoUnits}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Field Units Restored:</span>
                <span className="font-bold text-cyan-400">{uploadSuccessModal.summary.fieldUnits}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Smog Leak Records:</span>
                <span className="font-bold text-cyan-400">{uploadSuccessModal.summary.smogUnits}</span>
              </div>
            </div>

            <button
              onClick={() => setUploadSuccessModal(null)}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors"
            >
              Done & View Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

