import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, RefreshCw } from 'lucide-react';
import { AppUserAccount } from '../../types';
import { deleteUserAccount } from '../../services/authService';

interface DeleteConfirmModalProps {
  user: AppUserAccount | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const handleDelete = async () => {
    setError(null);
    setIsDeleting(true);
    try {
      await deleteUserAccount(user.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to delete user account.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-rose-900/60 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl transition-all my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-rose-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-950 border border-rose-800 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                Delete User?
              </h2>
              <p className="text-xs text-rose-300/80 font-medium">
                Permanent Access Revocation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-300 font-medium leading-relaxed">
            Are you sure you want to delete this user?
          </p>

          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">User Name:</span>
              <strong className="text-white">{user.name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">User ID:</span>
              <strong className="text-cyan-300">{user.userId}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Current Role:</span>
              <span className="uppercase text-amber-300 font-bold">{user.role}</span>
            </div>
          </div>

          <div className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300 leading-relaxed font-medium">
            ⚠️ <strong>This user will no longer be able to login.</strong> Even with their existing User ID and Password, login access will be immediately blocked and denied.
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-medium">{error}</p>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-950/60 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 text-white" />
                  <span>Delete User</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
