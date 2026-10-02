import React, { useEffect, useState } from 'react';
import { Bell, Smartphone, X, Volume2 } from 'lucide-react';
import { subscribeMobileToasts, MobileToastNotification, playMobileAlertSound } from '../../utils/mobileNotification';

export const MobileToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<MobileToastNotification[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeMobileToasts((newToast) => {
      setToasts((prev) => [newToast, ...prev.slice(0, 2)]);

      // Auto dismiss after 6 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 6000);
    });

    return unsubscribe;
  }, []);

  const handleDismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-rose-950 border border-rose-500/80 shadow-[0_10px_30px_rgba(244,63,94,0.35)] flex items-start justify-between gap-3 animate-in slide-in-from-top-4 duration-300"
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-rose-900/80 text-rose-300 border border-rose-500/50 animate-bounce shrink-0">
              <Smartphone className="w-5 h-5 text-rose-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-mono font-black animate-pulse uppercase tracking-wider shrink-0">
                  📱 Mobile Alert
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(toast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <h5 className="text-xs font-black text-rose-100 mt-1 leading-snug break-words">
                {toast.title}
              </h5>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug break-words">
                {toast.body}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => playMobileAlertSound()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-900/30 transition-colors"
              title="Play Alert Sound"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleDismiss(toast.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
