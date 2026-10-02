import React, { useState } from 'react';
import { CheckCircle2, Check, X } from 'lucide-react';

interface ConfirmPassUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  unitType?: string; // 'Proto Unit' | 'PP Unit' | 'Field Unit'
  modelName: string;
  station?: string;
  serialNumber?: string;
  elapsedHours?: number | string;
  requiredHours?: number | string;
}

export const ConfirmPassUnitModal: React.FC<ConfirmPassUnitModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  unitType = 'Unit',
  modelName,
  station,
  serialNumber,
  elapsedHours,
  requiredHours,
}) => {
  const [isPassing, setIsPassing] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsPassing(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Failed to pass unit:', err);
    } finally {
      setIsPassing(false);
    }
  };

  return (
    <div 
      id="confirm-pass-unit-modal-overlay"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        e.stopPropagation();
        if (!isPassing) onClose();
      }}
    >
      <div 
        id="confirm-pass-unit-modal-dialog"
        className="w-full max-w-md bg-slate-900 border-2 border-emerald-800/80 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-emerald-950/60 relative overflow-hidden text-white animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle emerald background glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header with Close */}
        <div className="flex items-start justify-between gap-4 mb-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950/90 border border-emerald-600/80 flex items-center justify-center shrink-0 shadow-inner">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
                {unitType} Pass Confirmation
              </span>
              <h3 className="text-lg font-black text-white leading-tight">
                Confirm Pass Unit?
              </h3>
            </div>
          </div>
          <button
            id="btn-close-pass-modal"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!isPassing) onClose();
            }}
            disabled={isPassing}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Details */}
        <div className="relative z-10 space-y-3.5 my-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            Are you sure you want to <strong className="text-emerald-300 font-bold">Pass</strong> this unit and mark its testing status as <strong className="text-white font-semibold">Finished</strong>?
          </p>

          {/* Unit Summary Card */}
          <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-emerald-900/40 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono text-[11px]">Model:</span>
              <span className="font-bold text-white text-right max-w-[240px] truncate" title={modelName}>
                {modelName}
              </span>
            </div>
            {station && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-mono text-[11px]">Station / Location:</span>
                <span className="font-semibold text-cyan-300 font-mono">{station}</span>
              </div>
            )}
            {serialNumber && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-mono text-[11px]">Serial / Ref:</span>
                <span className="font-semibold text-amber-300 font-mono">{serialNumber}</span>
              </div>
            )}
            {elapsedHours !== undefined && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                <span className="text-slate-400 font-mono text-[11px]">Test Duration:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {typeof elapsedHours === 'number' ? `${elapsedHours.toFixed(1)}h` : elapsedHours}
                  {requiredHours ? ` / ${requiredHours}h` : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons: Cancel and Confirm */}
        <div className="flex items-center gap-3 relative z-10 mt-6">
          <button
            id="btn-cancel-pass-unit"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            disabled={isPassing}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-all text-center cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-pass-unit"
            type="button"
            onClick={handleConfirm}
            disabled={isPassing}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] border border-emerald-400/30 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 cursor-pointer disabled:opacity-50"
          >
            {isPassing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4 stroke-[2.5]" />
            )}
            <span>Confirm</span>
          </button>
        </div>
      </div>
    </div>
  );
};
