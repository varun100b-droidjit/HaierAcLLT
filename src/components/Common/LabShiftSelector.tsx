import React from 'react';
import { Clock, ShieldCheck, ChevronDown } from 'lucide-react';
import { useActiveLabShift, LAB_SHIFTS, LabShift } from '../../services/shiftStore';
import { addShiftActivityLog } from '../../services/unitStore';

interface LabShiftSelectorProps {
  compact?: boolean;
  className?: string;
}

export const LabShiftSelector: React.FC<LabShiftSelectorProps> = ({
  compact = false,
  className = ''
}) => {
  const [activeShift, setShift] = useActiveLabShift();

  const shiftsList: LabShift[] = ['GENERAL', 'SHIFT_A', 'SHIFT_AB', 'SHIFT_ABC'];

  const handleShiftChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setShift(e.target.value as LabShift);
  };

  if (compact) {
    return (
      <div className={`relative flex items-center gap-2 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 ${className}`}>
        <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
        <span className="text-xs font-mono font-bold text-slate-400 shrink-0 hidden sm:inline">Lab Shift:</span>
        <div className="relative flex items-center w-full">
          <select
            value={activeShift}
            onChange={handleShiftChange}
            className="w-full appearance-none bg-slate-900 text-cyan-300 border border-cyan-800/80 rounded-lg px-2.5 py-1 pr-7 text-xs font-bold font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {shiftsList.map((sId) => {
              const shift = LAB_SHIFTS[sId];
              return (
                <option key={sId} value={sId} className="bg-slate-950 text-slate-200 py-1 font-mono">
                  {shift.name} ({shift.code})
                </option>
              );
            })}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-cyan-400 absolute right-2 pointer-events-none" />
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-cyan-800/60 shadow-xl space-y-4 ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
              <span>Lab Operation Shift & Timing Config</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                ACTIVE: {LAB_SHIFTS[activeShift].name}
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Select active lab shift from dropdown menu to calculate Proto & Field unit elapsed operational hours.
            </p>
          </div>
        </div>

        {/* Dropdown Menu Box */}
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <div className="relative w-full md:w-72">
            <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">
              Select Shift Dropdown:
            </label>
            <div className="relative flex items-center">
              <select
                value={activeShift}
                onChange={handleShiftChange}
                className="w-full appearance-none bg-slate-950 text-white border-2 border-cyan-500/80 rounded-xl px-3.5 py-2 pr-9 text-xs font-black font-mono shadow-lg shadow-cyan-950/50 focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                {shiftsList.map((sId) => {
                  const shift = LAB_SHIFTS[sId];
                  return (
                    <option key={sId} value={sId} className="bg-slate-950 text-slate-100 py-1.5 font-mono font-bold">
                      {shift.name} • {shift.code} ({shift.dailyHours}h/day)
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-4 h-4 text-cyan-400 absolute right-3 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Selected Shift Details Bar */}
      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold">{LAB_SHIFTS[activeShift].description}</span>
        </div>

        <div className="flex items-center gap-2 font-mono font-bold text-cyan-300 bg-cyan-950 px-3 py-1 rounded-lg border border-cyan-800/80">
          <span>Operating Hours: {LAB_SHIFTS[activeShift].code}</span>
        </div>
      </div>
    </div>
  );
};
