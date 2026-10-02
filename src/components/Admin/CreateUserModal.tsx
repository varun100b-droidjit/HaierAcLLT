import React, { useState } from 'react';
import { 
  X, 
  UserPlus, 
  User, 
  KeyRound, 
  ShieldCheck, 
  Activity, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Check, 
  RefreshCw 
} from 'lucide-react';
import { createNewUserByAdmin } from '../../services/authService';
import { AuthRole, UserAccountStatus } from '../../types';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userId: string) => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<AuthRole>('random');
  const [status, setStatus] = useState<UserAccountStatus>('active');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = name.trim();
    const cleanUserId = userId.trim().toUpperCase();

    if (!cleanName) {
      setErrorMessage("Please enter User Name.");
      return;
    }
    if (!cleanUserId) {
      setErrorMessage("Please enter User ID.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-check.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createNewUserByAdmin({
        name: cleanName,
        userId: cleanUserId,
        password: password,
        role: role,
        status: status,
      });

      // Reset form
      setName('');
      setUserId('');
      setPassword('');
      setConfirmPassword('');
      setRole('random');
      setStatus('active');
      
      onSuccess(cleanUserId);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to create user account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl transition-all my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-950/80 border border-cyan-800/80 rounded-xl">
              <UserPlus className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                Create New User Account
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Register Firebase Authentication credentials &amp; role authorization
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          
          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-800/80 rounded-xl flex items-start gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="font-medium">{errorMessage}</p>
            </div>
          )}

          {/* User Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>User Name</span>
            </label>
            <input
              type="text"
              placeholder="e.g. ABC Client or Ramesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* User ID */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>User ID (Unique Login ID)</span>
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-mono">
                UPPERCASE AUTO
              </span>
            </label>
            <input
              type="text"
              placeholder="e.g. CLIENT001, LABENG02"
              value={userId}
              onChange={(e) => setUserId(e.target.value.toUpperCase())}
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 uppercase transition-colors"
            />
          </div>

          {/* Role & Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Role */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AuthRole)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
              >
                <option value="random">Random (Restricted R&amp;D Only)</option>
                <option value="admin">Admin (Full System Access)</option>
              </select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UserAccountStatus)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
              >
                <option value="active">Active (Can Login)</option>
                <option value="disabled">Disabled (Login Blocked)</option>
              </select>
            </div>
          </div>

          {/* Password & Confirm Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Password</span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-type password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {/* Credentials Summary Box */}
          <div className="p-3 bg-slate-950/90 rounded-xl border border-cyan-900/40 text-[11px] text-slate-300 space-y-1">
            <p className="font-bold text-cyan-300">Credentials the user will receive:</p>
            <p className="font-mono text-xs">User ID: <strong className="text-white">{userId || 'CLIENT001'}</strong></p>
            <p className="font-mono text-xs">Password: <strong className="text-white">{password ? '••••••••' : 'Client@123'}</strong></p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-slate-900 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-md shadow-cyan-950/60 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-900" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3] text-slate-900" />
                  <span>Create User</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
