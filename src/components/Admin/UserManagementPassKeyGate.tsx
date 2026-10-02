import React, { useState, useRef, useEffect } from 'react';
import { 
  Lock, 
  KeyRound, 
  ShieldAlert, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Delete
} from 'lucide-react';

interface UserManagementPassKeyGateProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

const REQUIRED_PASSKEY = '9090';

export const UserManagementPassKeyGate: React.FC<UserManagementPassKeyGateProps> = ({
  onSuccess,
  onCancel
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  const handleDigitChange = (index: number, val: string) => {
    setError(null);
    const cleaned = val.replace(/[^0-9]/g, '');

    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    // Single character
    const char = cleaned.slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);

    // Auto-advance
    if (index < 3) {
      inputRefs[index + 1].current?.focus();
    } else {
      // Check immediately when 4th digit entered
      const fullPin = next.join('');
      validatePin(fullPin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs[index - 1].current?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs[index - 1].current?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      inputRefs[index + 1].current?.focus();
    } else if (e.key === 'Enter') {
      validatePin(digits.join(''));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 4);
    if (!paste) return;

    const next = ['', '', '', ''];
    for (let i = 0; i < paste.length; i++) {
      next[i] = paste[i];
    }
    setDigits(next);

    if (paste.length === 4) {
      validatePin(paste);
    } else {
      inputRefs[Math.min(paste.length, 3)].current?.focus();
    }
  };

  const handleKeypadPress = (numStr: string) => {
    setError(null);
    // Find first empty index
    const emptyIndex = digits.findIndex(d => d === '');
    if (emptyIndex !== -1) {
      const next = [...digits];
      next[emptyIndex] = numStr;
      setDigits(next);
      if (emptyIndex < 3) {
        inputRefs[emptyIndex + 1].current?.focus();
      } else {
        validatePin(next.join(''));
      }
    }
  };

  const handleKeypadBackspace = () => {
    setError(null);
    // Find last filled index
    let lastFilled = -1;
    for (let i = 3; i >= 0; i--) {
      if (digits[i] !== '') {
        lastFilled = i;
        break;
      }
    }
    if (lastFilled !== -1) {
      const next = [...digits];
      next[lastFilled] = '';
      setDigits(next);
      inputRefs[lastFilled].current?.focus();
    }
  };

  const handleKeypadClear = () => {
    setDigits(['', '', '', '']);
    setError(null);
    inputRefs[0].current?.focus();
  };

  const validatePin = (enteredPin: string) => {
    if (enteredPin.length < 4) {
      setError('Please enter all 4 digits of the pass key.');
      return;
    }

    if (enteredPin === REQUIRED_PASSKEY) {
      setIsSuccess(true);
      setError(null);
      setTimeout(() => {
        onSuccess();
      }, 500);
    } else {
      setIsShaking(true);
      setError('Invalid Pass Key! Please enter the correct 4-digit security key.');
      setTimeout(() => {
        setIsShaking(false);
        setDigits(['', '', '', '']);
        inputRefs[0].current?.focus();
      }, 600);
    }
  };

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-4">
      <div 
        className={`w-full max-w-md bg-slate-900/95 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/40 relative overflow-hidden backdrop-blur-xl transition-all duration-300 ${
          isShaking ? 'animate-bounce border-rose-500/80' : ''
        }`}
      >
        {/* Top glow decoration */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-cyan-500/15 blur-3xl rounded-full pointer-events-none" />

        {/* Security Icon Badge */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-xl transition-all duration-300 ${
            isSuccess 
              ? 'bg-emerald-500 text-white shadow-emerald-950/60 scale-110' 
              : error 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-rose-950/60'
                : 'bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-cyan-950/60'
          }`}>
            {isSuccess ? (
              <CheckCircle2 className="w-8 h-8 animate-in zoom-in" />
            ) : error ? (
              <ShieldAlert className="w-8 h-8" />
            ) : (
              <KeyRound className="w-8 h-8 animate-pulse" />
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-[10px] font-black uppercase tracking-wider rounded-full mb-2">
            <Lock className="w-3 h-3 text-cyan-400" />
            <span>Pass Key Protected</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
            Security Verification
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xs">
            User Management access requires entering the 4-digit security pass key.
          </p>
        </div>

        {/* Error / Alert Message */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {isSuccess && (
          <div className="mb-5 p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/80 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Pass Key verified! Unlocking User Management...</span>
          </div>
        )}

        {/* 4 Digit PIN Inputs */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 my-6">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={inputRefs[index]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              disabled={isSuccess}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              className={`w-14 h-16 sm:w-16 sm:h-18 text-center text-2xl sm:text-3xl font-mono font-black rounded-2xl bg-slate-950 border transition-all duration-200 focus:outline-none ${
                digit 
                  ? 'border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-950/60' 
                  : 'border-slate-800 text-white focus:border-cyan-500/80 focus:bg-slate-900/90'
              } ${
                error ? 'border-rose-500/80 text-rose-400 bg-rose-950/20' : ''
              } ${
                isSuccess ? 'border-emerald-400 text-emerald-300 bg-emerald-950/30' : ''
              }`}
            />
          ))}
        </div>

        {/* Numeric Keypad for Mobile & Touch Screen */}
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 max-w-[280px] mx-auto mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              disabled={isSuccess}
              onClick={() => handleKeypadPress(num)}
              className="py-3 bg-slate-950/80 hover:bg-slate-800/80 active:bg-cyan-950 border border-slate-800 hover:border-slate-700 rounded-xl text-lg font-mono font-bold text-slate-200 active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            disabled={isSuccess}
            onClick={handleKeypadClear}
            className="py-3 bg-slate-950/80 hover:bg-slate-800/80 active:bg-rose-950 border border-slate-800 text-xs font-bold text-slate-400 hover:text-slate-200 rounded-xl active:scale-95 transition-all cursor-pointer"
          >
            C
          </button>
          <button
            type="button"
            disabled={isSuccess}
            onClick={() => handleKeypadPress('0')}
            className="py-3 bg-slate-950/80 hover:bg-slate-800/80 active:bg-cyan-950 border border-slate-800 hover:border-slate-700 rounded-xl text-lg font-mono font-bold text-slate-200 active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            0
          </button>
          <button
            type="button"
            disabled={isSuccess}
            onClick={handleKeypadBackspace}
            className="py-3 bg-slate-950/80 hover:bg-slate-800/80 active:bg-rose-950 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl active:scale-95 transition-all flex items-center justify-center cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            disabled={isSuccess || digits.join('').length < 4}
            onClick={() => validatePin(digits.join(''))}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm text-slate-900 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-cyan-950/50 active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>Unlock User Management</span>
            <ArrowRight className="w-4 h-4 text-slate-900 stroke-[2.5]" />
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
          )}
        </div>

        {/* Security footer */}
        <div className="mt-5 pt-3 border-t border-slate-800/60 text-center">
          <p className="text-[11px] text-slate-500 font-mono flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Authorized Personnel Only</span>
          </p>
        </div>
      </div>
    </div>
  );
};
