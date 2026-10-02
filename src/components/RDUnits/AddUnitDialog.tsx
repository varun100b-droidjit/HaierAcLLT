import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  ArrowDown, 
  Calendar, 
  Clock, 
  UserCheck, 
  Send,
  Layers,
  Sparkles,
  FlaskConical
} from 'lucide-react';
import { DynamicUnitRow } from '../../types';

interface AddUnitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    rows: DynamicUnitRow[],
    requiredBy: string,
    dayDuration: number,
    bsrPerson: string,
    eltPerson: string,
    rdPerson: string
  ) => Promise<void>;
}

const MODEL_PRESETS = [
  'LLT-V8 Micro-Sensor Array',
  'LLT-900 Thermal Processor',
  'LLT-200 Power Mod Gen-3',
  'LLT-Optic 50X Radar Module',
  'LLT-Cryo Subsystem Delta',
  'LLT-Bio-Core Spectrometer'
];

export const AddUnitDialog: React.FC<AddUnitDialogProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  // Helper for future date string (YYYY-MM-DD)
  const getFutureDateStr = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // State for multiple unit rows
  const [unitRows, setUnitRows] = useState<DynamicUnitRow[]>([
    {
      id: `row-${Date.now()}-1`,
      modelName: '',
      serialNumber: `SN-2026-${Math.floor(1000 + Math.random() * 9000)}`
    }
  ]);

  // Workflow & Timing fields
  const [dayDuration, setDayDuration] = useState<number>(7);
  const [requiredBy, setRequiredBy] = useState<string>(getFutureDateStr(7));

  // Transfer Workflow Personnel
  const [bsrPerson, setBsrPerson] = useState<string>('');
  const [eltPerson, setEltPerson] = useState<string>('');
  const [rdPerson, setRdPerson] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setUnitRows([
        {
          id: `row-${Date.now()}-1`,
          modelName: '',
          serialNumber: `SN-2026-${Math.floor(1000 + Math.random() * 9000)}`
        }
      ]);
      setBsrPerson('');
      setEltPerson('');
      setRdPerson('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Sync Day Duration to Required By Date
  const handleDurationChange = (val: number) => {
    const num = Math.max(1, val);
    setDayDuration(num);
    setRequiredBy(getFutureDateStr(num));
  };

  // Sync Required By Date to Day Duration
  const handleDateChange = (dateStr: string) => {
    setRequiredBy(dateStr);
    if (dateStr) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(dateStr);
      target.setHours(0, 0, 0, 0);
      const diffTime = target.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDayDuration(Math.max(1, diffDays));
    }
  };

  // Dynamic Row Actions
  const handleAddRow = () => {
    const newRow: DynamicUnitRow = {
      id: `row-${Date.now()}-${unitRows.length + 1}`,
      modelName: '',
      serialNumber: `SN-2026-${Math.floor(1000 + Math.random() * 9000)}`
    };
    setUnitRows([...unitRows, newRow]);
  };

  const handleDeleteRow = (id: string) => {
    if (unitRows.length <= 1) {
      alert("At least one unit row is required.");
      return;
    }
    setUnitRows(unitRows.filter(r => r.id !== id));
  };

  const handleRowChange = (id: string, field: 'modelName' | 'serialNumber', value: string) => {
    setUnitRows(unitRows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate rows
    for (let i = 0; i < unitRows.length; i++) {
      if (!unitRows[i].modelName.trim() || !unitRows[i].serialNumber.trim()) {
        alert(`Row ${i + 1} requires both Model Name and Serial Number.`);
        return;
      }
    }

    if (!bsrPerson.trim() || !eltPerson.trim() || !rdPerson.trim()) {
      alert("All workflow personnel (BSR, ELT, and R&D) must be assigned.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(
        unitRows,
        requiredBy,
        dayDuration,
        bsrPerson,
        eltPerson,
        rdPerson
      );
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      alert("Failed to record unit transfer. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800/80 text-cyan-400">
              <FlaskConical className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Add R&D Unit Transfer
              </h2>
              <p className="text-xs text-slate-400">
                Register multiple units into LLT Lab BSR → ELT → R&D transfer pipeline
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Multiple Unit Entry Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Multiple Unit Entry ({unitRows.length} {unitRows.length === 1 ? 'Unit' : 'Units'})
              </label>

              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/80 transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>(+) Add Row</span>
              </button>
            </div>

            {/* Dynamic Rows */}
            <div className="space-y-3">
              {unitRows.map((row, idx) => (
                <div
                  key={row.id}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
                >
                  <span className="text-xs font-mono font-bold text-slate-500 w-6 shrink-0 text-center hidden sm:block">
                    #{idx + 1}
                  </span>

                  {/* Model Name Input / Select */}
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 sm:hidden">
                      Model Name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        list={`presets-${row.id}`}
                        value={row.modelName}
                        onChange={(e) => handleRowChange(row.id, 'modelName', e.target.value)}
                        placeholder="Model Name (e.g. LLT-V8 Micro-Sensor)"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                        required
                      />
                      <datalist id={`presets-${row.id}`}>
                        {MODEL_PRESETS.map((preset) => (
                          <option key={preset} value={preset} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {/* Serial Number Input */}
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 sm:hidden">
                      Serial Number (Sr.No)
                    </label>
                    <input
                      type="text"
                      value={row.serialNumber}
                      onChange={(e) => handleRowChange(row.id, 'serialNumber', e.target.value)}
                      placeholder="Sr.No (e.g. SN-2026-9810)"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-cyan-300 font-mono text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                      required
                    />
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteRow(row.id)}
                    disabled={unitRows.length <= 1}
                    className={`p-2.5 rounded-xl text-rose-400 hover:text-white hover:bg-rose-950/60 border border-transparent hover:border-rose-900/60 transition-colors shrink-0 self-end sm:self-center ${
                      unitRows.length <= 1 ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                    title="Delete row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Timing Section: Required By & Day Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-cyan-400" />
                Required By (Target Date)
              </label>
              <input
                type="date"
                value={requiredBy}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-400" />
                Day Duration (Days)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={dayDuration}
                onChange={(e) => handleDurationChange(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-sm focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
          </div>

          {/* Transfer Workflow Section */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
              <UserCheck className="w-4 h-4" />
              Transfer Workflow Handoff
            </div>

            {/* Step 1: BSR Person */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>1. BSR Person (Origin Officer)</span>
                <span className="text-[10px] text-cyan-400 font-mono">BSR Dept</span>
              </label>
              <input
                type="text"
                value={bsrPerson}
                onChange={(e) => setBsrPerson(e.target.value)}
                placeholder="Name of BSR Personnel"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div className="flex justify-center text-cyan-500 my-1">
              <ArrowDown className="w-5 h-5 animate-bounce" />
            </div>

            {/* Step 2: ELT Person */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>2. ELT Person (Testing Specialist)</span>
                <span className="text-[10px] text-indigo-400 font-mono">ELT Dept</span>
              </label>
              <input
                type="text"
                value={eltPerson}
                onChange={(e) => setEltPerson(e.target.value)}
                placeholder="Name of ELT Personnel"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div className="flex justify-center text-cyan-500 my-1">
              <ArrowDown className="w-5 h-5 animate-bounce" />
            </div>

            {/* Step 3: R&D Person */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>3. R&D Person (Lead Engineer)</span>
                <span className="text-[10px] text-purple-400 font-mono">R&D Dept</span>
              </label>
              <input
                type="text"
                value={rdPerson}
                onChange={(e) => setRdPerson(e.target.value)}
                placeholder="Name of R&D Engineer"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
          </div>

          {/* Unit Transfer Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl font-bold text-base text-slate-950 bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 shadow-xl shadow-cyan-950/60 flex items-center justify-center gap-3 transform active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Recording Transfer in Firebase...</span>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Unit Transfer ({unitRows.length} {unitRows.length === 1 ? 'Unit' : 'Units'})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
