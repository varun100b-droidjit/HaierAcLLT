import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Sparkles, 
  CheckCircle2, 
  Sliders, 
  UploadCloud, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Check, 
  Image as ImageIcon,
  RefreshCw,
  Eye
} from 'lucide-react';
import { 
  getPhotoCompressionSettings, 
  savePhotoCompressionSettings, 
  subscribePhotoCompressionSettings, 
  compressImageFile, 
  PHOTO_QUALITY_PRESETS, 
  PhotoQualityPreset, 
  PhotoCompressionSettings,
  CompressionResult 
} from '../../services/photoSettingsStore';

export const PhotoQualityCard: React.FC = () => {
  const [settings, setSettings] = useState<PhotoCompressionSettings>(() => getPhotoCompressionSettings());
  const [testResult, setTestResult] = useState<CompressionResult & { fileName: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const testInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsubscribe = subscribePhotoCompressionSettings((updated) => {
      setSettings(updated);
    });
    return () => unsubscribe();
  }, []);

  const handleToggleSwitch = () => {
    const nextState = !settings.isCompressionEnabled;
    const updated = savePhotoCompressionSettings({ isCompressionEnabled: nextState });
    setSettings(updated);
  };

  const handleSelectPreset = (preset: PhotoQualityPreset) => {
    const updated = savePhotoCompressionSettings({ qualityPreset: preset });
    setSettings(updated);
  };

  const handleTestFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsTesting(true);
    try {
      const result = await compressImageFile(file, settings);
      setTestResult({
        ...result,
        fileName: file.name,
      });
    } catch (err) {
      console.error('Test compression error:', err);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-500/30 shadow-xl space-y-6">
      
      {/* Header with Icon and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-cyan-950/80 border border-cyan-600/50 text-cyan-400 shadow-lg shadow-cyan-950/50">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white">
                Photo Quality & Smart Compression
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-800">
                KB Reducer
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Form me 2MB se 4MB ki photo upload karte waqt uska size decrease hokar automatically KB me convert ho jayega aur photo bilkul clean aur sharp rahegi.
            </p>
          </div>
        </div>

        {/* Master Switch Button */}
        <div className="flex items-center gap-3 bg-slate-950/90 p-2.5 rounded-2xl border border-slate-800 shrink-0">
          <div className="text-right">
            <div className="text-xs font-mono font-extrabold text-slate-200">
              {settings.isCompressionEnabled ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Auto Compress: ON
                </span>
              ) : (
                <span className="text-amber-400">
                  Auto Compress: OFF
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {settings.isCompressionEnabled ? 'Convert 2-4MB ➔ KB' : 'Raw Original Size'}
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.isCompressionEnabled}
            onClick={handleToggleSwitch}
            className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-300 cursor-pointer shadow-inner ${
              settings.isCompressionEnabled 
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-950/80' 
                : 'bg-slate-800 border border-slate-700'
            }`}
          >
            <div
              className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${
                settings.isCompressionEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            >
              {settings.isCompressionEnabled ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-slate-400" />
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Main Status & Feature Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5">
          <Zap className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-slate-200">Zero-Lag Fast Upload</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Forms submit in 0.1s without waiting for heavy MB file uploads over slow network.
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-slate-200">Clean & Sharp Quality</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Serial numbers, barcode lines, nameplates, and PCB components remain 100% readable.
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-slate-200">Database Optimization</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Saves up to 92% cloud storage space in Firebase Firestore and Supabase.
            </div>
          </div>
        </div>
      </div>

      {/* Preset Quality Selector */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Select Compression Profile:</span>
          </div>
          <span className="text-[11px] font-mono text-cyan-400 font-bold">
            Target Size: {PHOTO_QUALITY_PRESETS[settings.qualityPreset].expectedSize}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(PHOTO_QUALITY_PRESETS) as PhotoQualityPreset[]).map((key) => {
            const preset = PHOTO_QUALITY_PRESETS[key];
            const isSelected = settings.qualityPreset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectPreset(key)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-950/60 border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.2)] ring-1 ring-cyan-500/50'
                    : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-950 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100">{preset.label}</span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {preset.desc}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-cyan-300">
                  <span>Target: {preset.expectedSize}</span>
                  <span>Max: {preset.maxDimension}px</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Interactive Compression Simulator / Tester */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-200">
            <Eye className="w-4 h-4 text-emerald-400" />
            <span>Test Live Photo Compression:</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Try uploading a 2MB - 4MB photo to test instant size reduction
          </span>
        </div>

        <input
          type="file"
          ref={testInputRef}
          onChange={handleTestFileChange}
          accept="image/*"
          className="hidden"
        />

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            type="button"
            onClick={() => testInputRef.current?.click()}
            disabled={isTesting}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-mono font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shrink-0"
          >
            {isTesting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Compressing Photo...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4 text-cyan-400" />
                <span>Select Photo to Test</span>
              </>
            )}
          </button>

          {testResult ? (
            <div className="flex-1 flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
              <div className="text-slate-400">
                Original: <strong className="text-rose-400">{testResult.originalSizeKB} KB ({(testResult.originalSizeKB / 1024).toFixed(2)} MB)</strong>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              <div className="text-slate-400">
                Reduced: <strong className="text-emerald-400">{testResult.compressedSizeKB} KB</strong>
              </div>
              <div className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-[10px]">
                {testResult.savedPercent}% Space Saved!
              </div>
              {testResult.dataUrl && (
                <div className="ml-auto flex items-center gap-2">
                  <img
                    src={testResult.dataUrl}
                    alt="Preview"
                    className="w-8 h-8 rounded-lg object-cover border border-slate-700"
                  />
                  <span className="text-[10px] text-emerald-400 font-bold">Clean & Sharp</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic">
              No test photo selected yet. Click button above to verify compression.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
