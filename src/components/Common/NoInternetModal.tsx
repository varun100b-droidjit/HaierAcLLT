import React, { useState, useEffect } from 'react';
import { 
  WifiOff, 
  RefreshCw, 
  AlertTriangle, 
  X, 
  CloudOff, 
  CheckCircle2, 
  Database,
  ShieldAlert,
  Radio
} from 'lucide-react';
import { 
  subscribeNoInternetModal, 
  closeNoInternetModal, 
  testActiveConnection 
} from '../../services/networkManager';

export const NoInternetModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [actionContext, setActionContext] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeNoInternetModal((open, context) => {
      setIsOpen(open);
      if (context) setActionContext(context);
      setTestResult(null);
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const handleRetry = async () => {
    setIsChecking(true);
    setTestResult(null);
    try {
      const isOnline = await testActiveConnection();
      if (isOnline) {
        setTestResult('success');
        setTimeout(() => {
          setIsChecking(false);
          closeNoInternetModal();
        }, 800);
      } else {
        setTestResult('failed');
        setIsChecking(false);
      }
    } catch {
      setTestResult('failed');
      setIsChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border-2 border-rose-500/80 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-rose-950/60 relative overflow-hidden text-white">
        {/* Background glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-32 bg-rose-500/20 blur-3xl rounded-full pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={closeNoInternetModal}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon Header */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mb-3 shadow-lg shadow-rose-950/50 animate-pulse">
            <WifiOff className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-950/80 border border-rose-800 text-rose-300 text-[10px] font-black uppercase tracking-wider rounded-full mb-2">
            <Radio className="w-3 h-3 text-rose-400 animate-ping" />
            <span>Connection Offline</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            No Internet Connection
          </h2>
          <p className="text-xs text-rose-300/90 font-medium mt-1">
            Active internet connection is required to interact with the database.
          </p>
        </div>

        {/* Action Context Info */}
        {actionContext && (
          <div className="mb-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="overflow-hidden">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Interrupted Action</span>
              <span className="font-mono text-cyan-300 truncate block">{actionContext}</span>
            </div>
          </div>
        )}

        {/* Information Box: Direct Cloud Sync Notice */}
        <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/90 space-y-2.5 mb-5 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-bold text-white text-[13px]">
            <Database className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Direct Cloud Database Active</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            All data is saved directly to <strong className="text-cyan-300">Firebase Firestore</strong> and <strong className="text-emerald-300">Supabase</strong>. Adding, updating, or deleting units is paused until the connection is restored.
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/60 p-2 rounded-xl">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>Please check your Wi-Fi or Mobile Data connection and try again.</span>
          </div>
        </div>

        {/* Retry status alert */}
        {testResult === 'success' && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Internet connection restored! Resuming cloud sync...</span>
          </div>
        )}

        {testResult === 'failed' && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <CloudOff className="w-4 h-4 shrink-0 text-rose-400" />
            <span>Still offline. Please check your network and try again.</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            disabled={isChecking}
            onClick={handleRetry}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-slate-900 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 disabled:opacity-50 shadow-lg shadow-cyan-950/50 active:scale-[0.99] transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking Connection...' : 'Retry Connection'}</span>
          </button>

          <button
            type="button"
            onClick={closeNoInternetModal}
            className="w-full sm:w-auto px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
