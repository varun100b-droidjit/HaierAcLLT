import React, { useState, useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';
import { 
  X, 
  CheckCircle2, 
  Clock, 
  Circle, 
  User, 
  Calendar, 
  MessageSquare,
  AlertTriangle,
  ArrowRightLeft,
  Send,
  Save,
  ArrowRight,
  ShieldCheck,
  Check,
  Share2,
  MessageCircle
} from 'lucide-react';
import { Unit } from '../../types';

interface TrackTimelineDialogProps {
  unit: Unit | null;
  isOpen: boolean;
  onClose: () => void;
  onAdvanceStage: (unitId: string, performerName: string, remarks: string, nextStageIdx?: number, customStatus?: any) => Promise<void>;
  onReworkUnit: (unitId: string, performerName: string, remarks: string) => Promise<void>;
}

export const TrackTimelineDialog: React.FC<TrackTimelineDialogProps> = ({
  unit,
  isOpen,
  onClose,
  onAdvanceStage,
  onReworkUnit,
}) => {
  // Ref for timeline capture
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);

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

  // Handle Share / Screenshot of Timeline (Steps 1 to 11)
  const handleShareTimeline = async () => {
    if (!timelineRef.current || !unit) return;
    setIsSharing(true);
    try {
      const node = timelineRef.current;
      const fullHeight = node.scrollHeight;
      const fullWidth = node.scrollWidth || node.offsetWidth;

      const dataUrl = await toPng(node, {
        backgroundColor: '#020617',
        cacheBust: true,
        pixelRatio: 2,
        height: fullHeight,
        width: fullWidth,
        style: {
          overflow: 'visible',
          maxHeight: 'none',
          height: `${fullHeight}px`,
          width: `${fullWidth}px`,
        },
      });

      const fileName = `Process_Timeline_Steps_1-11_${unit.modelName.replace(/\s+/g, '_')}_${unit.serialNumber}.png`;
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Process Timeline (Steps 1-11) - ${unit.modelName}`,
            text: `R&D Process Timeline History (Steps 1 to 11) for ${unit.modelName} (SN: ${unit.serialNumber})`,
          });
          return;
        } catch (shareErr) {
          console.log('Native web share dismissed or unsupported, falling back to PNG download:', shareErr);
        }
      }

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to capture timeline image:', err);
    } finally {
      setIsSharing(false);
    }
  };

  // Handle Dedicated WhatsApp Share
  const handleWhatsAppShare = async () => {
    if (!timelineRef.current || !unit) return;
    setIsSharing(true);
    try {
      const node = timelineRef.current;
      const fullHeight = node.scrollHeight;
      const fullWidth = node.scrollWidth || node.offsetWidth;

      // 1. Generate high-res image
      const dataUrl = await toPng(node, {
        backgroundColor: '#020617',
        cacheBust: true,
        pixelRatio: 2,
        height: fullHeight,
        width: fullWidth,
        style: {
          overflow: 'visible',
          maxHeight: 'none',
          height: `${fullHeight}px`,
          width: `${fullWidth}px`,
        },
      });

      const fileName = `Process_Timeline_${unit.modelName.replace(/\s+/g, '_')}_${unit.serialNumber}.png`;
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: 'image/png' });

      // Always download PNG to local device so user has the photo file
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // 2. Format detailed text for WhatsApp message
      let text = `📱 *R&D PROCESS TIMELINE HISTORY (Steps 1–11)*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `*Unit Model:* ${unit.modelName}\n`;
      text += `*Serial Number:* ${unit.serialNumber}\n`;
      text += `*Current Holder:* ${unit.currentHolder || 'Unassigned'}\n`;
      text += `*Status:* ${unit.status.toUpperCase()}\n`;
      text += `*Priority:* ${unit.priority || 'Normal'}\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `📋 *TIMELINE STEPS:* \n`;

      unit.timeline.forEach((st, idx) => {
        text += `\n*Step ${idx + 1}: ${st.stageName}*\n`;
        text += `• Person: ${st.personName || 'Pending'}\n`;
        text += `• Timestamp: ${st.date} ${st.time}\n`;
        if (st.remarks) text += `• Note: ${st.remarks}\n`;
      });

      text += `\n📎 _(Note: High-resolution timeline photo is downloaded to your device as ${fileName})_`;

      // 3. If native share API with file support exists (mobile browsers with WhatsApp), invoke it directly
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          // Share strictly only the photo file (no text) as requested: "Bhai only Photo Share ho Text nhi"
          await navigator.share({
            files: [file],
          });
          return;
        } catch (shareErr) {
          console.log('Native share cancelled/failed, redirecting to WhatsApp Web/App link...');
        }
      }

      // 4. Open WhatsApp directly via WhatsApp Web/App link
      const encodedText = encodeURIComponent(text);
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
      window.open(whatsappUrl, '_blank');
    } catch (err) {
      console.error('Failed WhatsApp share:', err);
    } finally {
      setIsSharing(false);
    }
  };

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
            unit.rdPerson || unit.bsrPerson || 'Requester',
            '',
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

  // Handler Step 5 (R&D Person -> ELT Person) -> Submit Button Click
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

  const currentStageIdx = unit.currentStageIndex || 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
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
        <div ref={timelineRef} className="p-5 space-y-5 overflow-y-auto flex-1 bg-slate-900">
          {/* UNIT SUMMARY CARD (INCLUDED IN PHOTO SHARE) */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-cyan-400 tracking-wider block">
                  R&D Unit Track Summary
                </span>
                <h2 className="text-base font-extrabold text-white mt-0.5">
                  {unit.modelName}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  SN: {unit.serialNumber}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-medium block">Current Holder</span>
                <span className="font-bold text-slate-200 truncate block mt-0.5">{unit.currentHolder || 'Unassigned'}</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-medium block">Workflow Status</span>
                <span className="font-bold text-emerald-400 truncate block mt-0.5 capitalize">{unit.status}</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-medium block">Priority</span>
                <span className="font-bold text-cyan-300 truncate block mt-0.5">{unit.priority || 'Normal'}</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-medium block">Transfer Date</span>
                <span className="font-bold text-slate-300 truncate block mt-0.5">{unit.transferDate || '--'}</span>
              </div>
            </div>
          </div>

          {/* VERTICAL TIMELINE HISTORY FLOWCHART (STEPS 1 - 11) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">
                Process Timeline History (Steps 1 – 11)
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                11 Stages
              </span>
            </div>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
              {unit.timeline.map((st, idx) => {
                const isCompleted = idx < currentStageIdx || (unit.status === 'received' && idx === currentStageIdx);
                const isCurrent = idx === currentStageIdx && unit.status !== 'received';
                const isReworkOrObs = (st.remarks?.includes('Observation') || st.remarks?.includes('NG')) && idx === 7;

                let statusBadgeText = isCompleted ? '✅ Completed' : (isCurrent && idx === 8) ? '🟢 Step 9: Rework Done' : (isCurrent && idx === 7) ? '🟢 Step 8: No Observation (Pass)' : isCurrent ? '🔵 Current Step' : '⚪ Pending';
                let statusBadgeClass = isCompleted ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                  (isCurrent && idx === 8) ? 'bg-emerald-950 text-emerald-300 border-emerald-800 font-bold animate-pulse' :
                  (isCurrent && idx === 7) ? 'bg-emerald-950 text-emerald-300 border-emerald-800 font-bold animate-pulse' :
                  isCurrent ? 'bg-blue-950 text-blue-300 border-blue-800 animate-pulse' :
                  'bg-slate-900 text-slate-500 border-slate-800';

                if (isReworkOrObs) {
                  statusBadgeText = '🔴 Observation / Rework';
                  statusBadgeClass = 'bg-rose-950 text-rose-300 border-rose-800';
                }

                const rawPersonName = (idx === 3 || st.department === 'AREA' || st.personName === 'Lab Area Supervisor' || st.personName === 'R&D Area Supervisor')
                  ? (unit.rdPerson || unit.bsrPerson || '')
                  : (st.personName || '');

                const genericPlaceholders = [
                  'BSR Person (Amit)',
                  'ELT Person (Raju)',
                  'R&D Person (Mukesh)',
                  'Requested By',
                  'R&D Person',
                  'ELT Person',
                  'OQC Inspector',
                  'OQC / R&D Specialist',
                  'BSR Transfer Officer',
                  'BSR Receiver',
                  'Lab Area Supervisor',
                  'R&D Area Supervisor',
                  'Unassigned'
                ];

                const hasFilledPersonName = rawPersonName.trim().length > 0 && 
                  !genericPlaceholders.includes(rawPersonName.trim()) && 
                  (isCompleted || isCurrent);

                return (
                  <div key={st.id || idx} className="relative group">
                    {/* Node Dot */}
                    <div
                      className={`absolute -left-[30px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-125 ${
                        isCompleted || (isCurrent && idx === 8)
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950'
                          : isReworkOrObs
                          ? 'bg-rose-500 text-white shadow-md shadow-rose-950'
                          : isCurrent
                          ? 'bg-blue-500 text-white ring-4 ring-blue-500/20'
                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}
                    >
                      {isCompleted || (isCurrent && idx === 8) ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isReworkOrObs ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : isCurrent ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        <Circle className="w-2.5 h-2.5 fill-current" />
                      )}
                    </div>

                    {/* Step Card */}
                    <div
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isCompleted
                          ? 'bg-slate-950/60 border-slate-800/80 text-slate-200'
                          : isReworkOrObs
                          ? 'bg-rose-950/20 border-rose-800 text-rose-100'
                          : (isCurrent && idx === 8)
                          ? 'bg-emerald-950/30 border-emerald-800/80 text-white shadow-lg shadow-emerald-950/40'
                          : isCurrent
                          ? 'bg-blue-950/30 border-blue-800/80 text-white shadow-lg shadow-blue-950/40'
                          : 'bg-slate-950/30 border-slate-800/40 text-slate-500'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-200">
                            {st.stageName}
                          </h4>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            st.department === 'BSR' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                            st.department === 'ELT' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' :
                            st.department === 'R&D' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
                            st.department === 'OQC' ? 'bg-teal-950 text-teal-300 border border-teal-800' :
                            'bg-slate-800 text-slate-300'
                          }`}>
                            {st.department}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${statusBadgeClass}`}>
                            {statusBadgeText}
                          </span>
                        </div>

                        {/* Date & Time */}
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <Calendar className="w-3 h-3" />
                          <span>{st.date}</span>
                          <span>{st.time}</span>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        {hasFilledPersonName && (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="text-slate-400 font-medium">Person Name:</span>
                            <span className="font-semibold text-slate-200 truncate">
                              {rawPersonName}
                            </span>
                          </div>
                        )}

                        {(() => {
                          if (idx !== 7) return null;

                          const remarksText = st.remarks || observationRemarks;

                          const cleaned = (remarksText || '')
                            .replace(/\[\d{2}[-/\.]\d{2}[-/\.]\d{4}\s+[^\]]+\]/g, '')
                            .replace(/\d{2}[-/\.]\d{2}[-/\.]\d{4}\s+\d{2}:\d{2}:\d{2}\s*(?:AM|PM)?/gi, '')
                            .replace(/Step \d+ Unit Status:\s*/gi, '')
                            .replace(/Step \d+ Status:\s*/gi, '')
                            .replace(/Verified OK by OQC.*$/gi, '')
                            .replace(/\[REWORK\]/gi, '')
                            .trim();

                          const hasObsText = isReworkOrObs && cleaned.length > 0;

                          if (hasObsText) {
                            return (
                              <div className="flex items-start gap-1.5 col-span-2 mt-1 p-2 rounded-lg bg-red-950/30 border border-red-900/50">
                                <MessageSquare className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                                <div className="text-xs">
                                  <span className="font-bold text-red-400 mr-1.5">Observation:</span>
                                  <span className="text-red-400 font-bold">{cleaned}</span>
                                </div>
                              </div>
                            );
                          }

                          if (isCompleted || (isCurrent && idx === 7)) {
                            return (
                              <div className="flex items-start gap-1.5 col-span-2 mt-1 p-2 rounded-lg bg-emerald-950/30 border border-emerald-900/50">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                <div className="text-xs font-bold text-emerald-400">
                                  <span>🟢 No Observation (Unit Passed)</span>
                                </div>
                              </div>
                            );
                          }

                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareTimeline}
              disabled={isSharing}
              className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-lg shadow-cyan-950/60 flex items-center gap-2 transform active:scale-95 transition-all cursor-pointer"
              title="Export & Share Full Timeline Image"
            >
              <Share2 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              <span>Share Image (PNG)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer"
          >
            Close Dialog
          </button>
        </div>
      </div>
    </div>
  );
};
