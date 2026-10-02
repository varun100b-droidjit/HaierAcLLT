import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, CheckCircle2, ShieldAlert } from 'lucide-react';

interface DeleteUnitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  unitType?: string; // e.g. 'Proto Unit', 'PP Unit', 'Field Unit'
  modelName: string;
  station?: string;
  serialNumber?: string;
}

export const DeleteUnitConfirmModal: React.FC<DeleteUnitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  unitType = 'Unit',
  modelName,
  station,
  serialNumber,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Failed to delete unit:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div 
        className="w-full max-w-md bg-slate-900 border-2 border-rose-900/60 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-rose-950/60 relative overflow-hidden text-white animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header with Close */}
        <div className="flex items-start justify-between gap-4 mb-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800 flex items-center justify-center shrink-0 shadow-inner">
              <Trash2 className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-bold block">
                {unitType} Delete Confirmation
              </span>
              <h3 className="text-lg font-black text-white leading-tight">
                Delete Unit Record?
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Body */}
        <div className="relative z-10 space-y-3.5 my-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            Are you sure you want to permanently delete this record from the database?
          </p>

          {/* Unit Summary Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono text-[11px]">Model:</span>
              <span className="font-bold text-white text-right max-w-[240px] truncate">{modelName}</span>
            </div>
            {station && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-mono text-[11px]">Station:</span>
                <span className="font-semibold text-cyan-300">{station}</span>
              </div>
            )}
            {serialNumber && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-mono text-[11px]">Serial / ID:</span>
                <span className="font-mono text-amber-300 text-right max-w-[240px] truncate">{serialNumber}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-rose-400/90 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>This action is immediate and cannot be undone.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-3 border-t border-slate-800/80 relative z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            disabled={isDeleting}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black text-white bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 border border-rose-500/60 shadow-lg shadow-rose-950/50 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Unit'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
