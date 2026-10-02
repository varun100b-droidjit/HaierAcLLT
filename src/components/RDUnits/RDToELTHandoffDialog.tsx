import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Send, 
  Save,
  Clock
} from 'lucide-react';
import { Unit } from '../../types';

interface RDToELTHandoffDialogProps {
  unit: Unit | null;
  isOpen: boolean;
  onClose: () => void;
  onAdvanceStage: (unitId: string, performerName: string, remarks: string, nextStageIdx?: number, customStatus?: any) => Promise<void>;
  onReworkUnit: (unitId: string, performerName: string, remarks: string) => Promise<void>;
}

export const RDToELTHandoffDialog: React.FC<RDToELTHandoffDialogProps> = ({
  unit,
  isOpen,
  onClose,
  onAdvanceStage,
  onReworkUnit,
}) => {
  // Active step state: 1 to 11
  const [step, setStep] = useState<number>(1);

  // Form Inputs
  const [bsrPersonName, setBsrPersonName] = useState<string>('');
  const [eltPersonName, setEltPersonName] = useState<string>('');
  const [rdPersonName, setRdPersonName] = useState<string>('');
  const [oqcPersonName, setOqcPersonName] = useState<string>('');

  // Step 3 20-second countdown state
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(20);

  // Step 7/8 Observation path state
  const [selectedOption, setSelectedOption] = useState<'verified' | 'observation' | null>(null);
  const [showObservationBox, setShowObservationBox] = useState<boolean>(false);
  const [observationRemarks, setObservationRemarks] = useState<string>('');
  const [isObservationSaved, setIsObservationSaved] = useState<boolean>(false);
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastActivityTime, setLastActivityTime] = useState<string>('');

  // Helper to format timestamps DD-MM-YYYY HH:mm:ss AM/PM
  const getFormattedTimestamp = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const datePart = `${day}-${month}-${year}`;
    const timePart = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    return `${datePart} ${timePart}`;
  };

  // Sync state when modal opens or unit changes
  useEffect(() => {
    if (unit) {
      setBsrPersonName(unit.bsrPerson || '');
      setEltPersonName(unit.eltPerson || '');
      setRdPersonName(unit.rdPerson || '');
      setOqcPersonName(unit.oqcPerson || '');

      const currentStageIdx = unit.currentStageIndex || 0;
      let initialStep = Math.min(Math.max(1, currentStageIdx + 1), 11);
      if (initialStep === 4) initialStep = 5;
      if (initialStep === 6) initialStep = 7;
      setStep(initialStep);

      // Automatically start or complete 20s countdown if unit is at Step 3 (index 2)
      if (currentStageIdx === 2) {
        const createdMs = unit.createdAt ? new Date(unit.createdAt).getTime() : Date.now();
        const elapsedSec = Math.max(0, Math.floor((Date.now() - createdMs) / 1000));
        const remainingSec = Math.max(0, 20 - elapsedSec);

        if (remainingSec > 0) {
          setCountdown(remainingSec);
          setTimerActive(true);
        } else {
          setTimerActive(false);
          setStep(5);
          onAdvanceStage(
            unit.id,
            'R&D Area Supervisor',
            `[${getFormattedTimestamp()}] Step 4 Unit in R&D Area. Return process started automatically.`,
            3
          );
        }
      } else {
        setTimerActive(false);
      }

      // Check if observation exists
      const obsRemarks = unit.notes || unit.timeline?.[7]?.remarks || '';
      if (unit.status === 'rework' || obsRemarks.includes('Observation') || obsRemarks.includes('NG')) {
        setSelectedOption('observation');
        setIsObservationSaved(true);
        setShowObservationBox(false);
        setObservationRemarks(obsRemarks.replace(/^\[.*?\]\s*/, '').replace(/^\[REWORK\]\s*/, ''));
      } else {
        setSelectedOption(null);
        setIsObservationSaved(false);
        setShowObservationBox(false);
        setObservationRemarks('');
      }

      setLastActivityTime(getFormattedTimestamp());
    }
  }, [unit, isOpen]);

  // Handler Step 1: BSR Transfer
  const handleStep1Transfer = async () => {
    if (!unit) return;
    setIsSubmitting(true);
    const ts = getFormattedTimestamp();
    try {
      await onAdvanceStage(
        unit.id,
        bsrPersonName,
        '',
        1
      );
      setLastActivityTime(ts);
      setStep(2);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Step 2: ELT Transfer
  const handleStep2Transfer = async () => {
    if (!unit) return;
    setIsSubmitting(true);
    const ts = getFormattedTimestamp();
    try {
      await onAdvanceStage(
        unit.id,
        eltPersonName,
        '',
        2
      );
      setLastActivityTime(ts);
      setStep(3);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Step 3: R&D Person Received -> Start 20s countdown
  const handleStep3Received = async () => {
    if (!unit) return;
    setIsSubmitting(true);
    const ts = getFormattedTimestamp();
    try {
      await onAdvanceStage(
        unit.id,
        rdPersonName,
        '',
        2
      );
      setLastActivityTime(ts);
      setCountdown(20);
      setTimerActive(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Step 3 Auto Move to Step 4
  const handleStep3AutoMove = async () => {
    if (!unit) return;
    setIsSubmitting(true);
    const ts = getFormattedTimestamp();
    try {
      await onAdvanceStage(
        unit.id,
        unit.rdPerson || unit.bsrPerson || 'Requester',
        '',
        3
      );
      setLastActivityTime(ts);
      setStep(5);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle 20-second countdown for Step 3
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerActive && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (timerActive && countdown === 0) {
      setTimerActive(false);
      // Auto move to Step 4
      handleStep3AutoMove();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, countdown]);

  // Handler Step 4 -> Step 5 (Received Button Click)
  const handleStep4Proceed = async () => {
    if (!unit) return;
    setIsSubmitting(true);
    const ts = getFormattedTimestamp();
    try {
      await onAdvanceStage(
        unit.id,
        rdPersonName,
        '',
        4
      );
      setLastActivityTime(ts);
      setStep(5);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Step 5 (R&D Person -> ELT Person) -> Next Step Button Click
  const handleStep5NextStep = async () => {
    if (!unit) return;
    setIsSubmitting(true);
    const ts = getFormattedTimestamp();
    try {
      await onAdvanceStage(
        unit.id,
        eltPersonName,
        '',
        5
      );
      setLastActivityTime(ts);
      setStep(7);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Step 6 (ELT Person -> OQC Person) -> Submit Button Click
  const handleStep6Submit = async () => {
    if (!unit) return;
    setIsSubmitting(true);
    const ts = getFormattedTimestamp();
    try {
      await onAdvanceStage(
        unit.id,
        oqcPersonName,
        '',
        6
      );
      setLastActivityTime(ts);
      setStep(7);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Option A: Unit Pass selected
  const handleOptionAVerified = async () => {
    if (!unit) return;
    setSelectedOption('verified');
    setIsSubmitting(true);
    const ts = getFormattedTimestamp();
    try {
      await onAdvanceStage(
        unit.id,
        oqcPersonName,
        'Unit Verified & Passed',
        7
      );
      setLastActivityTime(ts);
      setStep(8);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Option B: Observation selected
  const handleOptionBObservation = () => {
    setSelectedOption('observation');
    setShowObservationBox(true);
    setIsObservationSaved(false);
  };

  // Save Observation Click: Saves note, flags Rework status, shows Rework Done button
  const handleSaveObservation = async () => {
    if (!unit) return;
    if (!observationRemarks.trim()) return;
    setIsSubmitting(true);
    const ts = getFormattedTimestamp();
    try {
      await onReworkUnit(
        unit.id,
        oqcPersonName,
        observationRemarks
      );
      await onAdvanceStage(
        unit.id,
        oqcPersonName,
        observationRemarks,
        7,
        'rework'
      );
      setLastActivityTime(ts);
      setIsObservationSaved(true);
      setShowObservationBox(false);
      setStep(8);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Rework Done Click -> Opens BSR Transfer Form
  const handleReworkDone = async () => {
    if (!unit) return;
    setIsSubmitting(true);
    const ts = getFormattedTimestamp();
    try {
      await onAdvanceStage(
        unit.id,
        oqcPersonName,
        '',
        8,
        'transferred'
      );
      setLastActivityTime(ts);
      setStep(10);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Unit Transfer to BSR Button Click -> Final Transfer Completed!
  const handleUnitTransferBSR = async () => {
    if (!unit) return;
    setIsSubmitting(true);
    const ts = getFormattedTimestamp();
    try {
      await onAdvanceStage(
        unit.id,
        bsrPersonName,
        '',
        10,
        'received'
      );
      setLastActivityTime(ts);
      setStep(11);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !unit) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-950 border border-indigo-800/80 flex items-center justify-center text-indigo-400">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                {unit.modelName}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-slate-400 font-medium">Sr. No:</span>
                <span className="text-xs font-mono font-bold text-cyan-300">
                  {unit.serialNumber}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Unit Details Box */}
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Serial Number:</span>
              <span className="font-mono font-bold text-cyan-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {unit.serialNumber}
              </span>
            </div>
          </div>

          {/* STEP 1: BSR Person (Amit) */}
          {step === 1 && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-cyan-400">Step 1: BSR Person</span>
                  <h3 className="text-sm font-bold text-white">Unit Verification & Forward Transfer</h3>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Status: Unit Verified
                </span>
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">BSR Person Name:</label>
                <input
                  type="text"
                  value={bsrPersonName}
                  onChange={(e) => setBsrPersonName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleStep1Transfer}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 shadow-md flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Verify Unit & Transfer to Step 2</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ELT Person (Raju) */}
          {step === 2 && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-indigo-400">Step 2: ELT Person</span>
                  <h3 className="text-sm font-bold text-white">Receive & Transfer to R&D</h3>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">ELT Person Name:</label>
                <input
                  type="text"
                  value={eltPersonName}
                  onChange={(e) => setEltPersonName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleStep2Transfer}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 shadow-md flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Received & Transfer to Step 3</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: R&D Person (Mukesh) + 20s Countdown Timer */}
          {step === 3 && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-bold text-purple-400">Step 3: R&D Person</span>
                  <h3 className="text-sm font-bold text-white">Receive & 20s Auto-Transfer to R&D Area</h3>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">R&D Person Name:</label>
                <input
                  type="text"
                  value={rdPersonName}
                  onChange={(e) => setRdPersonName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>

              {!timerActive ? (
                <div className="pt-2 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={handleStep3Received}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Received (Start 20s Timer)</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-purple-950/60 border border-purple-800 text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-purple-300">
                    <Clock className="w-5 h-5 animate-spin text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">Countdown Running</span>
                  </div>
                  <div className="text-3xl font-mono font-extrabold text-cyan-400">
                    00:{String(countdown).padStart(2, '0')}
                  </div>
                  <p className="text-[11px] text-purple-200">
                    Automatically moving to Step 4 (R&D Area) in {countdown} seconds...
                  </p>
                  <button
                    type="button"
                    onClick={handleStep3AutoMove}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300"
                  >
                    Skip Timer (Move Now)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: R&D Area */}
          {step === 4 && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-800 text-xs text-cyan-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-cyan-300 block">Status: Unit in R&D Area</span>
                  <span className="text-[11px]">Request By: {unit.rdPerson || unit.bsrPerson || 'Rahul Kumar'}</span>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Return Process Ready
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleStep4Proceed}
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-2xl text-xs font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-xl shadow-cyan-950/60 flex items-center gap-2 transform active:scale-95 transition-all"
                >
                  <ArrowRightLeft className="w-4 h-4 shrink-0" />
                  <span>Received (Start Return Process)</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: R&D Person -> ELT Person */}
          {step === 5 && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div>
                <span className="text-xs font-mono font-bold text-purple-400">Step 5: Return Handoff (Part 1)</span>
                <h3 className="text-sm font-bold text-white">R&D Person → ELT Person Transfer</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">R&D Person Name:</label>
                  <input
                    type="text"
                    value={rdPersonName}
                    onChange={(e) => setRdPersonName(e.target.value)}
                    placeholder="Enter R&D Person Name"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">ELT Person Name:</label>
                  <input
                    type="text"
                    value={eltPersonName}
                    onChange={(e) => setEltPersonName(e.target.value)}
                    placeholder="Enter ELT Person Name"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleStep5NextStep}
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-2xl text-xs font-extrabold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 shadow-lg shadow-purple-950/60 flex items-center gap-2 transform active:scale-95 transition-all"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}


          {/* STEP 7: OQC Unit Verification (Observation or Pass) */}
          {step === 7 && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div>
                <span className="text-xs font-mono font-bold text-teal-400">Step 7: OQC Inspection</span>
                <h3 className="text-sm font-bold text-white">OQC Unit Quality Verification</h3>
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">OQC Inspector Name:</label>
                <input
                  type="text"
                  value={oqcPersonName}
                  onChange={(e) => setOqcPersonName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-200 block">Select Verification Outcome:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleOptionBObservation}
                    disabled={isSubmitting}
                    className={`p-3.5 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                      showObservationBox
                        ? 'border-rose-500 bg-rose-950 text-white shadow-lg shadow-rose-950/50'
                        : 'border-rose-800/80 bg-rose-950/60 hover:bg-rose-900/80 text-rose-200'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>🔴 Observation</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOptionAVerified}
                    disabled={isSubmitting}
                    className="p-3.5 rounded-xl border border-emerald-800/80 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-200 text-xs font-extrabold flex items-center justify-center gap-2 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>🟢 Pass</span>
                  </button>
                </div>
              </div>

              {/* Text Box for Observation Note */}
              {showObservationBox && (
                <div className="p-4 rounded-2xl bg-slate-900 border border-rose-900/80 space-y-3 animate-in fade-in duration-200">
                  <span className="text-xs font-bold text-rose-300 block">Observation Details:</span>
                  <div>
                    <textarea
                      rows={3}
                      value={observationRemarks}
                      onChange={(e) => setObservationRemarks(e.target.value)}
                      placeholder="Enter observation / issue details here..."
                      className="w-full p-3 rounded-xl bg-slate-950 border border-rose-800 text-xs text-red-500 font-bold focus:outline-none focus:border-rose-500 placeholder:text-slate-500"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveObservation}
                      disabled={isSubmitting || !observationRemarks.trim()}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSubmitting ? 'Saving...' : 'Save Observation'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 8: Status Display after Decision (Rework or Pass) */}
          {step === 8 && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              {selectedOption === 'observation' || isObservationSaved || unit.status === 'rework' ? (
                /* Observation / Rework Branch */
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-rose-400">Status: Observation (Rework Pending)</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-900 text-rose-200 border border-rose-700">
                        🔴 REWORK
                      </span>
                    </div>
                    {observationRemarks && (
                      <p className="text-xs bg-slate-950/80 p-2.5 rounded-lg border border-red-900/60 text-red-400 font-bold">
                        <strong className="text-red-300 mr-1">Observation Note:</strong> {observationRemarks.replace(/\[\d{2}[-/\.]\d{2}[-/\.]\d{4}\s+[^\]]+\]/g, '').replace(/\d{2}[-/\.]\d{2}[-/\.]\d{4}\s+\d{2}:\d{2}:\d{2}\s*(?:AM|PM)?/gi, '').trim()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={handleReworkDone}
                      disabled={isSubmitting}
                      className="px-6 py-3 rounded-2xl text-xs font-extrabold text-slate-950 bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 shadow-xl shadow-amber-950/60 flex items-center gap-2 transform active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Rework Done</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Pass Branch */
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-emerald-400">Status: Unit Pass (No Observation)</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-900 text-emerald-200 border border-emerald-700">
                        🟢 NO OBSERVATION (PASS)
                      </span>
                    </div>
                    <p className="text-xs text-emerald-300 font-bold">
                      Unit verified and passed quality inspection by OQC ({oqcPersonName}). No observation recorded.
                    </p>
                  </div>

                  <div className="flex items-center justify-end pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setStep(10)}
                      disabled={isSubmitting}
                      className="px-6 py-3 rounded-2xl text-xs font-extrabold text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-xl shadow-emerald-950/60 flex items-center gap-2 transform active:scale-95 transition-all"
                    >
                      <span>Proceed to BSR Transfer</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 10: OQC Person -> BSR Person Transfer */}
          {(step === 10 || step === 9) && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-400">Step 10: Final Transfer</span>
                <h3 className="text-sm font-bold text-white">OQC Person → BSR Person Transfer</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">OQC Person Name:</label>
                  <input
                    type="text"
                    value={oqcPersonName}
                    onChange={(e) => setOqcPersonName(e.target.value)}
                    placeholder="Enter OQC Person Name"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">BSR Person Name:</label>
                  <input
                    type="text"
                    value={bsrPersonName}
                    onChange={(e) => setBsrPersonName(e.target.value)}
                    placeholder="Enter BSR Person Name"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleUnitTransferBSR}
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-2xl text-xs font-extrabold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 shadow-xl shadow-emerald-950/60 flex items-center gap-2 transform active:scale-95 transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>Unit Transfer BSR</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 11: Transfer Completed */}
          {step === 11 && (
            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700"
              >
                Close Workflow
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
