import React, { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, ShieldAlert, X, Eye, EyeOff, KeyRound } from 'lucide-react';

interface SettingsPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SettingsPasswordModal: React.FC<SettingsPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setShowPassword(false);
      // Auto focus input when modal opens
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPin = password.trim();

    if (cleanPin === '9090') {
      setError(null);
      onSuccess();
    } else {
      setError('Galat Password! (Incorrect Code). Kripya authorized password enter karein.');
      setPassword('');
      inputRef.current?.focus();
    }
  };

  const handleQuickKeypad = (num: string) => {
    if (password.length < 6) {
      const next = password + num;
      setPassword(next);
      setError(null);
      if (next === '9090') {
        setTimeout(() => {
          onSuccess();
        }, 120);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div 
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Settings Locked</span>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-amber-500/30">
                  PIN Protected
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Menu Settings open karne ke liye Password dalein
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="text-center py-2">
            <div className="inline-flex p-3 rounded-2xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-400 mb-2.5 shadow-inner">
              <KeyRound className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-200">
              Enter 4-Digit Password
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              System Settings access karne ke liye security code enter karein
            </p>
          </div>

          {/* Password Input Box */}
          <div className="space-y-1.5">
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={8}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Password (PIN)"
                className="w-full text-center tracking-[0.35em] text-lg font-mono font-extrabold px-4 py-3 bg-slate-950/90 border border-slate-700 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                title={showPassword ? "Hide" : "Show"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium px-1 animate-in fade-in">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Quick Number Pad */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((btn) => (
              <button
                key={btn}
                type="button"
                onClick={() => {
                  if (btn === 'C') {
                    setPassword('');
                    setError(null);
                  } else if (btn === '⌫') {
                    setPassword(prev => prev.slice(0, -1));
                    setError(null);
                  } else {
                    handleQuickKeypad(btn);
                  }
                }}
                className={`py-2.5 rounded-xl font-mono text-sm font-bold transition-all active:scale-95 cursor-pointer ${
                  btn === 'C'
                    ? 'bg-slate-800/80 hover:bg-slate-700 text-rose-400 border border-slate-700/60'
                    : btn === '⌫'
                    ? 'bg-slate-800/80 hover:bg-slate-700 text-amber-400 border border-slate-700/60'
                    : 'bg-slate-950/70 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {btn}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-950/60 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Unlock Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
