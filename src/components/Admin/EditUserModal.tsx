import React, { useState, useEffect } from 'react';
import { 
  X, 
  UserCheck, 
  User, 
  ShieldCheck, 
  Activity, 
  AlertCircle, 
  Check, 
  RefreshCw 
} from 'lucide-react';
import { updateUserAccount } from '../../services/authService';
import { AppUserAccount, AuthRole, UserAccountStatus } from '../../types';

interface EditUserModalProps {
  user: AppUserAccount | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState<AuthRole>('random');
  const [status, setStatus] = useState<UserAccountStatus>('active');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setRole(user.role);
      setStatus(user.status);
      setErrorMessage(null);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMessage("Please enter User Name.");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateUserAccount(user.id, {
        name: cleanName,
        role: role,
        status: status,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update user profile.");
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
            <div className="p-2.5 bg-blue-950/80 border border-blue-800/80 rounded-xl">
              <UserCheck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                Edit User Account
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                User ID: <strong className="text-cyan-300 font-mono">{user.userId}</strong>
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
              <span>User Full Name</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Authorization Role</span>
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
            <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Account Status</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as UserAccountStatus)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
            >
              <option value="active">Active (Can Login)</option>
              <option value="disabled">Disabled (Login Blocked)</option>
              <option value="deleted">Deleted (Access Revoked)</option>
            </select>
          </div>

          {/* Notice */}
          <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
            Changes saved here will sync to Firebase Cloud Firestore and will immediately update the user&apos;s permissions.
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
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-slate-900 bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 hover:from-blue-300 hover:to-teal-300 shadow-md shadow-blue-950/60 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-900" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3] text-slate-900" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
