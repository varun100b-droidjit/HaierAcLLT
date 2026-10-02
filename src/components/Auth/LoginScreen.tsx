import React, { useState } from 'react';
import { 
  FlaskConical, 
  Lock, 
  User, 
  ShieldCheck, 
  KeyRound, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ArrowRight,
  CheckCircle2,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AuthRole } from '../../types';

export const LoginScreen: React.FC = () => {
  const { login, authError, clearError } = useAuth();
  
  const [role, setRole] = useState<AuthRole>('admin');
  const [userId, setUserId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const cleanUserId = userId.trim();
    if (!cleanUserId) {
      setLocalError("Please enter your User ID.");
      return;
    }
    if (!password) {
      setLocalError("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(role, cleanUserId, password);
    } catch (err: any) {
      setLocalError(err?.message || "Failed to sign in. Please check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Subtle Background Glow Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-600/10 via-blue-600/10 to-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-cyan-900/10 rounded-full blur-2xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="relative w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/40 z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Brand Header */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/50 mb-3.5 ring-4 ring-cyan-950/60">
            <FlaskConical className="w-7 h-7 animate-pulse" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <h1 className="text-2xl font-black tracking-tight text-white font-mono">
              LLT LAB
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase text-cyan-300 bg-cyan-950 border border-cyan-800 rounded-full">
              AUTH
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Industrial Unit Lifecycle &amp; Laboratory Access
          </p>
        </div>

        {/* Error Alert Box */}
        {displayError && (
          <div className="mb-5 p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-2xl flex items-start gap-2.5 text-rose-300 text-xs animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed font-medium">
              {displayError}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Role Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Select Role</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                {role === 'admin' ? 'Full Access' : 'Restricted R&D Access'}
              </span>
            </label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as AuthRole);
                  setLocalError(null);
                }}
                className="w-full appearance-none px-3.5 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-colors cursor-pointer"
              >
                <option value="admin">Admin (Full System Access)</option>
                <option value="random">Random (R&D &amp; Transfer Only)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* User ID Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>User ID</span>
            </label>
            <input
              type="text"
              placeholder="e.g. ADMIN01 or CLIENT001"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setLocalError(null);
              }}
              required
              autoCapitalize="characters"
              className="w-full px-3.5 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-colors uppercase"
            />
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
              <span>Password</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLocalError(null);
                }}
                required
                className="w-full px-3.5 py-3 pr-10 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-slate-900 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-lg shadow-cyan-950/50 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                <span>Authenticating with Firebase...</span>
              </div>
            ) : (
              <>
                <Lock className="w-4 h-4 text-slate-900 stroke-[2.5]" />
                <span>Sign In to LLT Lab</span>
                <ArrowRight className="w-4 h-4 text-slate-900 ml-1" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer Info */}
      <p className="mt-6 text-center text-slate-500 text-[11px]">
        LLT LAB &bull; Industrial Unit Lifecycle Platform &bull; Firebase RBAC Protected
      </p>
    </div>
  );
};
