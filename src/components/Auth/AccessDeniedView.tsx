import React from 'react';
import { ShieldAlert, ArrowRight, Lock, Boxes } from 'lucide-react';

interface AccessDeniedViewProps {
  onRedirectToAllowed: () => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  onRedirectToAllowed,
}) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-6">
        
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-950/80 border border-rose-800/80 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-950/50">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-white">
            Access Denied
          </h2>
          <p className="text-sm text-slate-300 font-medium">
            You don&apos;t have permission to access this page.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your account is assigned the <strong className="text-amber-400">Random</strong> role with access restricted strictly to permitted R&amp;D Units and Transfer activities.
          </p>
        </div>

        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Lock className="w-4 h-4 text-slate-500" />
          <span>Admin Authorization Required</span>
        </div>

        <button
          type="button"
          onClick={onRedirectToAllowed}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-slate-900 bg-gradient-to-r from-cyan-400 to-blue-400 hover:from-cyan-300 hover:to-blue-300 shadow-lg shadow-cyan-950/50 transition-all cursor-pointer"
        >
          <Boxes className="w-4 h-4 text-slate-900" />
          <span>Return to Permitted R&amp;D Units</span>
          <ArrowRight className="w-4 h-4 text-slate-900" />
        </button>

      </div>
    </div>
  );
};
