import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft,
  X, 
  FileText, 
  CheckCircle2, 
  Calendar, 
  Layers, 
  UploadCloud, 
  Share2, 
  Camera, 
  Loader2, 
  Plus, 
  Trash2, 
  Sparkles, 
  AlertCircle,
  Check,
  Lock,
  Unlock,
  RefreshCw,
  PlusCircle,
  ScanBarcode,
  CheckSquare,
  Edit2,
  Copy
} from 'lucide-react';
import { 
  saveSmogQtyRecord, 
  getSmogQtyRecords, 
  fetchSmogQtyRecordByDateAndShift,
  SmogQtyRecord 
} from '../../services/smogQtyStore';
import { audioAlarm } from '../../utils/audioAlarm';
import { useAuth } from '../../context/AuthContext';
import { getStoredAuthSession } from '../../services/authService';

interface SmogQtyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string | null;
  defaultShift?: 'A' | 'B' | 'all';
  onDateChange?: (date: string) => void;
  onShiftChange?: (shift: 'A' | 'B') => void;
  onSaved?: (record: SmogQtyRecord) => void;
  onOpenWhatsAppShare?: (data: { 
    date: string; 
    shift: 'A' | 'B'; 
    smogQty: number; 
    prQty?: number; 
    pendingQty?: number;
    inspectorName?: string;
    models?: LocalHsoModel[];
    autoRedirectWhatsApp?: boolean;
    notes?: string;
  }) => void;
  onOpenSuspectManagement?: () => void;
}

export interface LocalHsoModel {
  id: string;
  modelName: string;
  prQty: number;      // "Pr. Qty photo se lega"
  smogQty: number;    // "Smog Qty"
  pendingQty: number; // "Pending Qty = Pr. Qty - Smog Qty"
}

export const SmogQtyFormModal: React.FC<SmogQtyFormModalProps> = ({
  isOpen,
  onClose,
  defaultDate,
  defaultShift,
  onDateChange,
  onShiftChange,
  onSaved,
  onOpenWhatsAppShare,
  onOpenSuspectManagement
}) => {
  let authUser: any = null;
  try {
    const auth = useAuth();
    authUser = auth?.user;
  } catch {}
  const inspectorName = authUser?.name || getStoredAuthSession()?.name || 'Indrajit';
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState<string>(defaultDate || today);
  const [shift, setShift] = useState<'A' | 'B' | ''>(
    (defaultShift && (defaultShift === 'A' || defaultShift === 'B')) ? defaultShift : 'A'
  );
  const [notes, setNotes] = useState<string>('');
  const [hsoModels, setHsoModels] = useState<LocalHsoModel[]>([]);

  // Small PopUp for increasing/setting Smog Qty on model click
  // "Jaha Circle kiya gya hai waha Click krne per ek Chhota sa PopUp open hoga Us Model ka Smog Qty badhane ka"
  const [popupModel, setPopupModel] = useState<LocalHsoModel | null>(null);
  const [popupQtyInput, setPopupQtyInput] = useState<string>('');
  const [popupError, setPopupError] = useState<string | null>(null);
  const popupInputRef = useRef<HTMLInputElement>(null);

  // Inline model name editing
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editingModelName, setEditingModelName] = useState<string>('');

  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [closedRecord, setClosedRecord] = useState<SmogQtyRecord | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Copy full Operation Closed summary text to clipboard
  const handleCopyClosedReport = async () => {
    if (!closedRecord) return;
    const modelsList = (closedRecord.models && closedRecord.models.length > 0 ? closedRecord.models : hsoModels) || [];
    const modelsText = modelsList.map((m: any, i: number) => {
      const pr = Number(m.prQty ?? m.qty) || 0;
      const sm = Number(m.smogQty) || 0;
      const pend = m.pendingQty !== undefined ? Number(m.pendingQty) : Math.max(0, pr - sm);
      return `${i + 1}. ${m.modelName} | Pr: ${pr} | Smog: ${sm} | Pending: ${pend}`;
    }).join('\n');

    const summary = `*SMOG OPERATION REPORT (CLOSED)*
Date: ${closedRecord.date} (Shift ${closedRecord.shift})
Inspector: ${inspectorName}
Pr. Qty: ${closedRecord.prQty ?? closedRecord.smogQty}
Smog Qty: ${closedRecord.smogQty}
Pending Qty: ${closedRecord.pendingQty ?? 0}
Status: Operation Closed Successfully

*Models Breakdown:*
${modelsText || 'No models listed'}
${closedRecord.notes ? `\nRemarks: ${closedRecord.notes}` : ''}`.trim();

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(summary);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = summary;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (e) {
      console.error('Failed to copy to clipboard', e);
    }
  };

  // Date & Shift Confirmation Notification
  // "aur jab bhi Upload ya Click Photo ka Action hoga tab Date ke niche Ek Notification Aa jayega usme likha rahega aapne date aur Shift sahi Choose kiya hai. Side me yes ka Button rahega Us per Click krne per Photo Click Upload wala Active hoga ye Notification wala Activity tab hoga jab Kisi new date me pahla photo upload ya click hoga. Aur Shift Dusra Select ho raha hai to Notification wala process rahega esme bhi."
  const [confirmedDateShiftKey, setConfirmedDateShiftKey] = useState<string | null>(null);
  const [showDateShiftPrompt, setShowDateShiftPrompt] = useState<boolean>(false);
  const [pendingPhotoAction, setPendingPhotoAction] = useState<'camera' | 'upload' | null>(null);

  const currentDateShiftKey = `${date}_${shift}`;
  const isDateShiftConfirmed = Boolean(date && shift && confirmedDateShiftKey === currentDateShiftKey);
  const hasModels = hsoModels.length > 0;

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera is enabled strictly when Production Date AND Shift are selected
  const isCameraEnabled = Boolean(date && date.trim() !== '' && (shift === 'A' || shift === 'B'));
  const isPhotoActionDisabled = !isCameraEnabled || isScanning || hasModels;

  // Helper to persist current form state (Date, Shift, Models, Quantities, Notes) to Firebase Firestore & localStorage
  const persistSmogQtyState = (
    currentModels: LocalHsoModel[],
    overrideNotes?: string,
    isClosedState: boolean = false
  ) => {
    if (!date) return null;
    const normShift = (shift === 'B') ? 'B' : 'A';
    const totalPr = currentModels.reduce((sum, item) => sum + (Number(item.prQty) || 0), 0);
    const totalSmog = currentModels.reduce((sum, item) => sum + (Number(item.smogQty) || 0), 0);
    const totalPending = currentModels.reduce((sum, item) => sum + (Number(item.pendingQty) || 0), 0);

    const formattedModels = currentModels.map(m => ({
      modelName: m.modelName.trim().toUpperCase(),
      prQty: m.prQty,
      smogQty: m.smogQty,
      pendingQty: m.pendingQty,
      qty: m.smogQty
    }));

    const finalNotes = overrideNotes !== undefined ? overrideNotes : notes;

    const saved = saveSmogQtyRecord({
      date,
      shift: normShift,
      smogQty: totalSmog,
      prQty: totalPr,
      pendingQty: totalPending,
      models: formattedModels,
      notes: finalNotes && finalNotes.trim() ? finalNotes.trim() : undefined,
      isClosed: isClosedState
    });

    return saved;
  };

  // Load existing records if any when screen opens
  useEffect(() => {
    if (isOpen) {
      const initialDate = defaultDate || today;
      const initialShift: 'A' | 'B' = (defaultShift && defaultShift === 'B') ? 'B' : 'A';
      setDate(initialDate);
      setShift(initialShift);
      setNotes('');
      setError(null);
      setScanSuccessMessage(null);
      setPopupModel(null);
      setShowDateShiftPrompt(false);
      setPendingPhotoAction(null);

      // Check if there is already an existing record for this date & shift
      const allRecords = getSmogQtyRecords();
      const existing = allRecords.find(r => r.date === initialDate && r.shift === initialShift);
      if (existing && existing.models && existing.models.length > 0) {
        const loadedModels: LocalHsoModel[] = (existing.models || []).map((m: any, idx: number) => {
          const pr = Number(m.prQty ?? m.qty) || 0;
          const sm = Number(m.smogQty) || 0;
          const pend = m.pendingQty !== undefined ? Number(m.pendingQty) : Math.max(0, pr - sm);
          return {
            id: `hso-${idx}-${Date.now()}`,
            modelName: m.modelName,
            prQty: pr,
            smogQty: sm,
            pendingQty: pend
          };
        });
        setHsoModels(loadedModels);
        if (existing.notes) setNotes(existing.notes);
        if (existing.isClosed) {
          setClosedRecord(existing);
        } else {
          setClosedRecord(null);
        }
      } else {
        setHsoModels([]);
        setClosedRecord(null);
        // Query Firestore as server database fallback
        fetchSmogQtyRecordByDateAndShift(initialDate, initialShift, true).then((remote) => {
          if (remote && remote.models && remote.models.length > 0) {
            const loaded = (remote.models || []).map((m: any, idx: number) => {
              const pr = Number(m.prQty ?? m.qty) || 0;
              const sm = Number(m.smogQty) || 0;
              const pend = m.pendingQty !== undefined ? Number(m.pendingQty) : Math.max(0, pr - sm);
              return {
                id: `hso-${idx}-${Date.now()}`,
                modelName: m.modelName,
                prQty: pr,
                smogQty: sm,
                pendingQty: pend
              };
            });
            setHsoModels(loaded);
            if (remote.notes) setNotes(remote.notes);
            if (remote.isClosed) {
              setClosedRecord(remote);
            }
          }
        });
      }
    }
  }, [isOpen, defaultDate, defaultShift, today]);

  // When date or shift changes, refresh existing models if available
  const handleDateOrShiftChange = (newDate: string, newShift: 'A' | 'B' | '') => {
    setDate(newDate);
    setShift(newShift);
    setError(null);
    setScanSuccessMessage(null);
    setShowDateShiftPrompt(false);
    setPendingPhotoAction(null);

    if (newDate) onDateChange?.(newDate);
    if (newShift === 'A' || newShift === 'B') onShiftChange?.(newShift);

    if (newDate && (newShift === 'A' || newShift === 'B')) {
      const allRecords = getSmogQtyRecords();
      const existing = allRecords.find(r => r.date === newDate && r.shift === newShift);
      if (existing && existing.models && existing.models.length > 0) {
        const loadedModels: LocalHsoModel[] = (existing.models || []).map((m: any, idx: number) => {
          const pr = Number(m.prQty ?? m.qty) || 0;
          const sm = Number(m.smogQty) || 0;
          const pend = m.pendingQty !== undefined ? Number(m.pendingQty) : Math.max(0, pr - sm);
          return {
            id: `hso-${idx}-${Date.now()}`,
            modelName: m.modelName,
            prQty: pr,
            smogQty: sm,
            pendingQty: pend
          };
        });
        setHsoModels(loadedModels);
        if (existing.notes) setNotes(existing.notes);
        if (existing.isClosed) {
          setClosedRecord(existing);
        } else {
          setClosedRecord(null);
        }
      } else {
        setHsoModels([]);
        setNotes('');
        setClosedRecord(null);
        // Query Firestore as server database fallback
        fetchSmogQtyRecordByDateAndShift(newDate, newShift, true).then((remote) => {
          if (remote && remote.models && remote.models.length > 0) {
            const loaded = (remote.models || []).map((m: any, idx: number) => {
              const pr = Number(m.prQty ?? m.qty) || 0;
              const sm = Number(m.smogQty) || 0;
              const pend = m.pendingQty !== undefined ? Number(m.pendingQty) : Math.max(0, pr - sm);
              return {
                id: `hso-${idx}-${Date.now()}`,
                modelName: m.modelName,
                prQty: pr,
                smogQty: sm,
                pendingQty: pend
              };
            });
            setHsoModels(loaded);
            if (remote.notes) setNotes(remote.notes);
            if (remote.isClosed) {
              setClosedRecord(remote);
            }
          }
        });
      }
    }
  };

  // User initiates Photo capture or File upload
  const handleInitiatePhotoAction = (actionType: 'camera' | 'upload') => {
    // If models already exist, action is disabled
    if (hsoModels.length > 0) return;

    if (!isCameraEnabled) {
      setError('Please select Production Date and Shift first.');
      return;
    }

    // Check if current Date & Shift have been confirmed by user
    if (!isDateShiftConfirmed) {
      setShowDateShiftPrompt(true);
      return;
    }

    // Already confirmed: trigger camera or upload
    if (actionType === 'camera') {
      cameraInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };

  // Confirm Date & Shift - enables Click Photo & Upload without opening camera/gallery automatically
  const handleConfirmDateShift = () => {
    setConfirmedDateShiftKey(currentDateShiftKey);
    setShowDateShiftPrompt(false);
    audioAlarm.playPassChime();
    setPendingPhotoAction(null);
  };

  // Open the small popup when user clicks the Model Name or Qty
  const handleOpenModelPopup = (model: LocalHsoModel, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPopupModel(model);
    setPopupQtyInput('');
    setPopupError(null);
    setTimeout(() => {
      popupInputRef.current?.focus();
    }, 60);
  };

  // Close the popup
  const handleClosePopup = () => {
    setPopupModel(null);
    setPopupQtyInput('');
    setPopupError(null);
  };

  // Submit Smog Qty addition from the small popup
  const handlePopupSubmitAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!popupModel) return;

    const addVal = parseInt(popupQtyInput, 10);
    if (isNaN(addVal) || addVal <= 0) {
      setPopupError('Please enter a valid quantity greater than 0.');
      popupInputRef.current?.focus();
      return;
    }

    let updatedModelName = '';
    let updatedSmog = 0;
    let updatedPending = 0;

    const updated = hsoModels.map(m => {
      if (m.id === popupModel.id) {
        const currPr = Number(m.prQty) || 0;
        const newSmog = (Number(m.smogQty) || 0) + addVal;
        const newPending = Math.max(0, currPr - newSmog);
        updatedModelName = m.modelName;
        updatedSmog = newSmog;
        updatedPending = newPending;
        return {
          ...m,
          smogQty: newSmog,
          pendingQty: newPending
        };
      }
      return m;
    });

    setHsoModels(updated);
    // Instantly auto-save to Firebase Firestore & local storage
    persistSmogQtyState(updated, notes, false);

    audioAlarm.playPassChime();
    setScanSuccessMessage(
      `Updated ${updatedModelName}: +${addVal} Smog Qty added (Smog: ${updatedSmog} | Pending: ${updatedPending})`
    );
    handleClosePopup();
  };

  // Set exact Smog Qty from popup
  const handlePopupSubmitSetExact = () => {
    if (!popupModel) return;
    const exactVal = Math.max(0, parseInt(popupQtyInput, 10) || 0);

    const updated = hsoModels.map(m => {
      if (m.id === popupModel.id) {
        const currPr = Number(m.prQty) || 0;
        const newPending = Math.max(0, currPr - exactVal);
        return {
          ...m,
          smogQty: exactVal,
          pendingQty: newPending
        };
      }
      return m;
    });

    setHsoModels(updated);
    // Instantly auto-save to Firebase Firestore & local storage
    persistSmogQtyState(updated, notes, false);

    audioAlarm.playPassChime();
    setScanSuccessMessage(`Set ${popupModel.modelName} Smog Qty to ${exactVal}.`);
    handleClosePopup();
  };

  // Auto-calculated Totals
  const totalPrQty = hsoModels.reduce((sum, item) => sum + (Number(item.prQty) || 0), 0);
  const totalSmogQty = hsoModels.reduce((sum, item) => sum + (Number(item.smogQty) || 0), 0);
  const totalPendingQty = hsoModels.reduce((sum, item) => sum + (Number(item.pendingQty) || 0), 0);

  // Compress and optimize camera/gallery photos before sending to Gemini API
  // Prevents 413 Payload Too Large and speeds up extraction from 20s to <1s
  const compressImageForOcr = async (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => {
        resolve({ base64: '', mimeType: 'image/jpeg' });
      };
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => {
          resolve({ base64: reader.result as string, mimeType: file.type || 'image/jpeg' });
        };
        img.onload = () => {
          try {
            const MAX_DIM = 1600;
            let width = img.width;
            let height = img.height;
            if (width > MAX_DIM || height > MAX_DIM) {
              if (width > height) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              } else {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              return resolve({ base64: reader.result as string, mimeType: file.type || 'image/jpeg' });
            }
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve({ base64: dataUrl, mimeType: 'image/jpeg' });
          } catch {
            resolve({ base64: reader.result as string, mimeType: file.type || 'image/jpeg' });
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Parse model names and quantities from OCR raw text
  const parseModelsFromOcrText = (rawText: string): Array<{ modelName: string; qty: number; prQty: number }> => {
    const lines = rawText.split('\n');
    const results: Array<{ modelName: string; qty: number; prQty: number }> = [];
    const seenModels = new Set<string>();

    for (const line of lines) {
      let cleanLine = line.trim();
      if (!cleanLine) continue;
      // Strip leading list index like "1.", "1)", "[1]"
      cleanLine = cleanLine.replace(/^\s*\[?\d+\]?[\.\)\-\:\s]+\s*/, '');
      
      // Pattern looking for HSO or model code (e.g. HSO17-3NB-I:AC, HSO18, HS18...)
      const modelMatch = cleanLine.match(/(HSO[A-Z0-9_\-:]+)/i) || 
                         cleanLine.match(/([A-Z0-9]{3,}(?:-[A-Z0-9]+)+(:[A-Z0-9]+)?)/i);

      if (modelMatch) {
        const modelName = modelMatch[1].toUpperCase().replace(/[:\-_\.\s]+$/, '');
        if (modelName.length > 2 && !seenModels.has(modelName)) {
          seenModels.add(modelName);

          // Look for quantity in parentheses e.g. "(900)"
          const parenMatch = cleanLine.match(/\((\d{1,6})\)/);
          let qty = 0;
          if (parenMatch) {
            qty = parseInt(parenMatch[1], 10);
          } else {
            // Look for number following the model name
            const idx = cleanLine.indexOf(modelMatch[0]) + modelMatch[0].length;
            const afterModel = cleanLine.slice(idx);
            const numMatch = afterModel.match(/\b(\d{1,6})\b/);
            if (numMatch) {
              qty = parseInt(numMatch[1], 10);
            }
          }
          if (qty <= 0) qty = 100;
          results.push({ modelName, qty, prQty: qty });
        }
      }
    }
    return results;
  };

  // Handle Photo Capture / File Selection & AI OCR Extraction
  // "Pr. Qty photo se lega"
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isCameraEnabled) {
      setError('Please select Production Date and Shift first before using the Camera.');
      return;
    }

    setError(null);
    setScanSuccessMessage(null);
    setIsScanning(true);

    try {
      // 1. Compress image to max 1600px JPEG to avoid payload limits and speed up OCR
      const { base64: base64Data, mimeType } = await compressImageForOcr(file);
      if (!base64Data) {
        throw new Error('Could not read image file. Please try again.');
      }

      // 2. Clear inputs immediately (photo deleted as requested)
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';

      // 3. Attempt Server OCR Endpoint with safe JSON check (never crash on HTML/404)
      let extractedItems: Array<{ modelName: string; qty: number; prQty?: number }> = [];
      let serverErrorMsg: string | null = null;

      try {
        const response = await fetch('/api/smog/extract-hso-models', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType
          })
        });

        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          const data = await response.json();
          if (data && data.success && Array.isArray(data.items) && data.items.length > 0) {
            extractedItems = data.items;
          } else if (data?.note || data?.error) {
            serverErrorMsg = data.note || data.error;
          }
        } else {
          console.warn(`Server OCR endpoint returned HTTP ${response.status} (${contentType}). Using in-browser OCR fallback.`);
        }
      } catch (netErr) {
        console.warn('Server OCR fetch notice:', netErr);
      }

      // 4. In-Browser OCR Fallback (Runs seamlessly on Vercel, static hosts, or when server API is unavailable)
      if (extractedItems.length === 0) {
        try {
          const { createWorker } = await import('tesseract.js');
          const worker = await createWorker('eng');
          const ocrResult = await worker.recognize(base64Data);
          await worker.terminate();

          const ocrText = ocrResult?.data?.text || '';
          const localParsed = parseModelsFromOcrText(ocrText);
          if (localParsed.length > 0) {
            extractedItems = localParsed;
          }
        } catch (tessErr) {
          console.warn('In-browser Tesseract OCR notice:', tessErr);
        }
      }

      // 5. Populate models or display clean friendly notification
      if (extractedItems.length > 0) {
        const formatted: LocalHsoModel[] = extractedItems.map((it, idx) => {
          const p = Number(it.prQty ?? it.qty) || 0;
          return {
            id: `hso-${Date.now()}-${idx}`,
            modelName: it.modelName.trim().toUpperCase(),
            prQty: p,
            smogQty: 0,
            pendingQty: p
          };
        });

        setHsoModels(formatted);
        const scannedTotalPr = formatted.reduce((s, m) => s + m.prQty, 0);

        // Instantly save to Firebase Firestore & local storage
        persistSmogQtyState(formatted, notes, false);

        setScanSuccessMessage(
          `Extracted ${formatted.length} Models (${scannedTotalPr} Pr. Qty) & Saved to Server (Firebase). Photo deleted.`
        );
        audioAlarm.playPassChime();
      } else {
        setError(
          serverErrorMsg || 
          'Photo me se models recognize nahi ho sake. Kripya display/sheet ki clear photo lein ya "+ Add Model" se enter karein.'
        );
      }
    } catch (err: any) {
      console.error('Error during OCR extraction:', err);
      setError('Photo analyze karne me dikkat aayi. Kripya clear photo lein ya "+ Add Model" se manually enter karein.');
    } finally {
      setIsScanning(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // Add a manual row
  const handleAddManualRow = () => {
    const nextIdx = hsoModels.length + 1;
    const newId = `hso-manual-${Date.now()}-${nextIdx}`;
    const newRow: LocalHsoModel = {
      id: newId,
      modelName: `HSO${nextIdx > 9 ? nextIdx : '0' + nextIdx}-3NB-I:AC`,
      prQty: 100,
      smogQty: 0,
      pendingQty: 100
    };
    const updated = [...hsoModels, newRow];
    setHsoModels(updated);
    persistSmogQtyState(updated, notes, false);
    setError(null);
  };

  // Edit Model Pr. Qty inline
  const handleModelPrQtyChange = (index: number, val: string) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    const updated = [...hsoModels];
    const currentSmog = Number(updated[index].smogQty) || 0;
    updated[index] = { 
      ...updated[index], 
      prQty: num,
      pendingQty: Math.max(0, num - currentSmog)
    };
    setHsoModels(updated);
    persistSmogQtyState(updated, notes, false);
  };

  // Save inline edited model name
  const handleSaveModelName = (index: number) => {
    if (!editingModelName.trim()) {
      setEditingModelId(null);
      return;
    }
    const updated = [...hsoModels];
    updated[index] = {
      ...updated[index],
      modelName: editingModelName.trim().toUpperCase()
    };
    setHsoModels(updated);
    persistSmogQtyState(updated, notes, false);
    setEditingModelId(null);
  };

  // Remove a row
  const handleRemoveRow = (index: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = hsoModels.filter((_, i) => i !== index);
    setHsoModels(updated);
    persistSmogQtyState(updated, notes, false);
  };

  // Submit Operation Close
  const handleOperationClose = (e: React.FormEvent) => {
    e.preventDefault();

    if (!date) {
      setError('Please select a valid Production Date.');
      return;
    }

    if (shift !== 'A' && shift !== 'B') {
      setError('Please select Shift A or Shift B.');
      return;
    }

    if (hsoModels.length === 0) {
      setError('Please scan a photo or click "+ Add Model" to add at least one model.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const record = persistSmogQtyState(hsoModels, notes, true);

      if (record) {
        setClosedRecord(record);
        audioAlarm.playPassChime();
        if (onSaved) {
          onSaved(record);
        }

        // "Aur Eska Operation Close (Upload 50 Smog Qty) per Click krne se WhatsApp ke liye ek Photo Generate krega Jisme Shift Model Name With Pr.qty, Smog Qty, Pending Qty Inspector Name Profile se Uthayega aur Suspect Qty Model Wise Location bhi fir WhatsApp Per Redirect kr dega"
        if (onOpenWhatsAppShare) {
          onOpenWhatsAppShare({
            date: record.date,
            shift: record.shift,
            smogQty: record.smogQty,
            prQty: record.prQty,
            pendingQty: record.pendingQty,
            inspectorName: inspectorName,
            models: hsoModels,
            autoRedirectWhatsApp: true,
            notes: record.notes || (notes.trim() ? notes.trim() : undefined)
          });
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Error saving Smog Qty record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-y-auto animate-in fade-in duration-200 text-slate-100">
      {/* 1. TOP COMPACT HEADER (Clean: Date/Shift ticks removed as requested!) */}
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-md">
        {/* Left: Back Button & Screen Title */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setClosedRecord(null);
              onClose();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer active:scale-95"
            title="Return to Smog Main Screen"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Back</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
              closedRecord 
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
            }`}>
              {closedRecord ? <CheckCircle2 className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-extrabold text-white tracking-tight leading-tight">
                {closedRecord ? 'Smog Operation Closed' : 'Smog Production Qty Form'}
              </h1>
            </div>
          </div>
        </div>

        {/* Right: Only Close Button (Ticked header badges removed as requested) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setClosedRecord(null);
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Form"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. MAIN SCREEN CONTENT */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-3 sm:px-4 py-3 sm:py-4 space-y-3 pb-24">
        {/* View when Operation Close is Completed */}
        {closedRecord ? (
          <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
            {/* Success Banner */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/40 text-center space-y-2.5 shadow-lg">
              <div className="flex items-center justify-center gap-2.5 mx-auto">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                {/* Copy icon button right next to the Tick */}
                <button
                  type="button"
                  onClick={handleCopyClosedReport}
                  className="h-10 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 hover:border-cyan-500/60 text-cyan-400 hover:text-cyan-300 font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="Click to copy full Operation Closed summary"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                      <span className="text-emerald-400 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 stroke-[2.2]" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white">
                Operation Closed Successfully!
              </h2>
              <p className="text-xs text-emerald-300 font-mono">
                Smog Qty ({closedRecord.smogQty}) synchronized with Dashboard.
              </p>
            </div>

            {/* Closed Info Badges (Pr. Qty | Smog Qty | Pending Qty) */}
            <div className="grid grid-cols-4 gap-2 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-center font-mono">
              <div className="p-1">
                <span className="text-[9px] text-slate-400 block font-bold uppercase">Shift & Date</span>
                <span className="text-xs font-black text-white mt-0.5 block">{closedRecord.date} (Shift {closedRecord.shift})</span>
              </div>
              <div className="p-1 border-l border-slate-800">
                <span className="text-[9px] text-rose-400 block font-bold uppercase">Pr. Qty</span>
                <span className="text-xs sm:text-sm font-black text-rose-300 mt-0.5 block">{closedRecord.prQty ?? closedRecord.smogQty}</span>
              </div>
              <div className="p-1 border-l border-slate-800">
                <span className="text-[9px] text-amber-400 block font-bold uppercase">Smog Qty</span>
                <span className="text-xs sm:text-sm font-black text-amber-300 mt-0.5 block">{closedRecord.smogQty}</span>
              </div>
              <div className="p-1 border-l border-slate-800">
                <span className="text-[9px] text-slate-300 block font-bold uppercase">Pending Qty</span>
                <span className="text-xs sm:text-sm font-black text-slate-200 mt-0.5 block">{closedRecord.pendingQty ?? 0}</span>
              </div>
            </div>

            {/* HSO Models Breakdown in Closed View */}
            {closedRecord.models && closedRecord.models.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-200 font-mono flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Models ({closedRecord.models.length})</span>
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-rose-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      Pr: {closedRecord.prQty ?? closedRecord.smogQty}
                    </span>
                    <span className="text-amber-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      Smog: {closedRecord.smogQty}
                    </span>
                    <span className="text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      Pending: {closedRecord.pendingQty ?? 0}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 font-mono text-xs">
                  {closedRecord.models.map((m: any, i: number) => {
                    const pr = Number(m.prQty ?? m.qty) || 0;
                    const sm = Number(m.smogQty) || 0;
                    const pend = m.pendingQty !== undefined ? Number(m.pendingQty) : Math.max(0, pr - sm);
                    return (
                      <div key={i} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-bold text-[10px]">#{i + 1}</span>
                          <span className="text-cyan-300 font-bold">{m.modelName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-rose-400 font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                            Pr: {pr}
                          </span>
                          <span className="text-amber-400 font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                            Smog: {sm}
                          </span>
                          <span className="text-slate-300 font-black px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px]">
                            Pending: {pend}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons: WhatsApp, Back to Smog Main Screen & Re-open */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenWhatsAppShare) {
                    onOpenWhatsAppShare({
                      date: closedRecord.date,
                      shift: closedRecord.shift,
                      smogQty: closedRecord.smogQty,
                      prQty: closedRecord.prQty,
                      pendingQty: closedRecord.pendingQty,
                      inspectorName: inspectorName,
                      models: (closedRecord.models && closedRecord.models.length > 0 ? closedRecord.models : hsoModels) as any,
                      autoRedirectWhatsApp: false,
                      notes: closedRecord.notes || (notes.trim() ? notes.trim() : undefined)
                    });
                  }
                }}
                className="py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-cyan-400 hover:bg-cyan-300 active:scale-[0.98] transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Share on WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setClosedRecord(null);
                  onClose();
                }}
                className="py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-slate-800 hover:bg-slate-700 active:scale-[0.98] transition-all cursor-pointer border border-slate-700 hover:border-slate-600 flex items-center justify-center gap-2 shadow-sm"
                title="Back to Smog Main Screen"
              >
                <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Back to Smog Main Screen</span>
              </button>
            </div>

            <div className="flex justify-center pt-0.5">
              <button
                type="button"
                onClick={() => setClosedRecord(null)}
                className="py-1.5 px-3 rounded-lg text-xs font-mono font-bold text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-all cursor-pointer flex items-center gap-1.5"
                title="Edit or Re-open Record"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Edit / Re-open Record</span>
              </button>
            </div>
          </div>
        ) : (
          /* Normal Form Screen */
          <div className="space-y-3">
            {error && (
              <div className="p-3 rounded-xl bg-slate-900 border border-rose-500/40 text-rose-300 text-xs font-medium flex items-center gap-2 shadow-sm">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="flex-1">{error}</span>
                <button 
                  type="button" 
                  onClick={() => setError(null)}
                  className="text-slate-400 hover:text-white p-0.5 text-xs cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* ========================================================================= */}
            {/* CONTROL PANEL CARD (Date, Shift, Camera Status, Action Buttons) */}
            {/* ========================================================================= */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2.5">
              {/* Row 1: Date Input (Restored to original full size) */}
              <div className="bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => handleDateOrShiftChange(e.target.value, shift)}
                    className="bg-transparent text-xs sm:text-sm font-mono font-bold text-white focus:outline-none cursor-pointer w-full"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleDateOrShiftChange(today, shift)}
                  className="text-xs text-cyan-400 hover:underline font-mono font-bold cursor-pointer shrink-0"
                >
                  Today
                </button>
              </div>

              {/* Row 2: Shift Segmented Toggle */}
              <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleDateOrShiftChange(date, 'A')}
                  className={`flex-1 py-2 px-3 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    shift === 'A'
                      ? 'bg-slate-800 text-cyan-300 border border-cyan-500/50 font-black shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${shift === 'A' ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                  <span>Shift A (Day)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDateOrShiftChange(date, 'B')}
                  className={`flex-1 py-2 px-3 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    shift === 'B'
                      ? 'bg-slate-800 text-cyan-300 border border-cyan-500/50 font-black shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${shift === 'B' ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                  <span>Shift B (Night)</span>
                </button>
              </div>

              {/* Notification Banner when user attempts Photo Click / Upload before confirming Date & Shift */}
              {/* Notification Banner when Date & Shift confirmation is required (in English) */}
              {/* "aur Jo notification hai uska language English me kro aur yes per click krne per Click Photo Aur Upload Enabled hoga naki Direct Gallery Open hoga" */}
              {(!isDateShiftConfirmed && isCameraEnabled && !hasModels) && (
                <div className="p-2.5 sm:p-3 rounded-xl bg-slate-950 border border-cyan-500/70 shadow-lg flex items-center justify-between gap-3 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-start sm:items-center gap-2 min-w-0">
                    <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 sm:mt-0" />
                    <div className="text-xs font-mono text-cyan-200">
                      <p className="font-bold leading-tight">
                        Have you selected the correct Date (<span className="text-white font-black underline">{date}</span>) and Shift (<span className="text-white font-black underline">{shift === 'A' ? 'Shift A (Day)' : 'Shift B (Night)'}</span>)?
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmDateShift}
                    className="py-1.5 px-3.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 active:scale-95 text-slate-950 font-mono font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Yes</span>
                  </button>
                </div>
              )}

              {/* Status Indicator Badge (Yellow text hidden as requested) */}
              {!isCameraEnabled ? (
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center gap-1.5 text-center">
                  <span className="text-[11px] font-mono text-slate-400 font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Select Date & Shift to Unlock Camera</span>
                  </span>
                </div>
              ) : null}

              {/* Row 4: Action Buttons Row */}
              <div className="flex items-center gap-2 pt-0.5">
                {/* Click Photo Button */}
                <button
                  type="button"
                  onClick={() => handleInitiatePhotoAction('camera')}
                  disabled={isPhotoActionDisabled}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                    !isPhotoActionDisabled
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer active:scale-95 font-black'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
                  }`}
                  title={
                    hasModels
                      ? 'Photo already analyzed & models loaded. Delete models to re-click photo.'
                      : 'Click Photo to auto-load Pr. Qty from Excel photo'
                  }
                >
                  <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Click Photo (Pr. Qty)</span>
                </button>

                {/* Upload File Icon Button */}
                <button
                  type="button"
                  onClick={() => handleInitiatePhotoAction('upload')}
                  disabled={isPhotoActionDisabled}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-center transition-all ${
                    !isPhotoActionDisabled
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700 cursor-pointer active:scale-95'
                      : 'bg-slate-850 text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
                  }`}
                  title={
                    hasModels
                      ? 'Photo already analyzed & models loaded. Delete models to upload photo.'
                      : 'Upload image from file'
                  }
                >
                  <UploadCloud className="w-4 h-4" />
                </button>

                {/* Suspect Button (replaces Add Model as requested by arrow) */}
                <button
                  type="button"
                  onClick={() => {
                    // Ensure models state is persisted to Firebase & local storage before navigating away
                    if (hsoModels.length > 0) {
                      persistSmogQtyState(hsoModels, notes, false);
                    }
                    if (onOpenSuspectManagement) {
                      onOpenSuspectManagement();
                    } else {
                      onClose();
                    }
                  }}
                  className="py-2.5 px-3.5 rounded-xl text-xs font-mono font-bold text-cyan-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-cyan-500/50 hover:border-cyan-400 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
                  title="Open Smog - Leak Unit Management Screen"
                >
                  <ScanBarcode className="w-3.5 h-3.5 text-cyan-400 stroke-[2.5]" />
                  <span>Suspect</span>
                </button>
              </div>

              {/* Hidden file inputs for Camera and File selection */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={!isCameraEnabled || isScanning}
                onChange={handleFileChange}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={!isCameraEnabled || isScanning}
                onChange={handleFileChange}
              />

              {/* Scanning Active State */}
              {isScanning && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-cyan-500/50 flex items-center gap-2.5 animate-pulse">
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                  <span className="text-xs text-cyan-200 font-mono font-bold">
                    Analyzing photo with Gemini AI... Extracting Models & Pr. Qty, photo deleted immediately.
                  </span>
                </div>
              )}

              {/* Scan Success Message */}
              {scanSuccessMessage && !isScanning && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-between gap-2 text-cyan-300 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="font-bold">{scanSuccessMessage}</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setScanSuccessMessage(null)}
                    className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* CONDITIONAL DISPLAY: ONLY SHOW CARDVIEWS ONCE PHOTO ANALYSIS / DATA EXISTS */}
            {/* "jab photo Analysis kar ke Model Wise Quantities me data Aa jayega tab Ye Model Wise Quantities aur Pr., Smog Qty, Pending Qty Enka Cardview Show krega agar Model Wise Quantities koi data nhi hai to Hide rahega Cardview" */}
            {/* ========================================================================= */}
            {hsoModels.length > 0 && (
              <div className="space-y-3 animate-in fade-in duration-200">
                {/* 3 SUMMARY CARDS ROW (PR. QTY | SMOG QTY | PENDING QTY) */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  {/* CARD 1: PR. QTY */}
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-center shadow-sm">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                      <span className="text-[10px] font-mono font-black text-rose-400 uppercase tracking-wider">
                        PR. QTY
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-slate-100">
                      {totalPrQty}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                      From Photo
                    </div>
                  </div>

                  {/* CARD 2: SMOG QTY */}
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-center shadow-sm">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                      <span className="text-[10px] font-mono font-black text-amber-400 uppercase tracking-wider">
                        SMOG QTY
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-slate-100">
                      {totalSmogQty}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                      Inspected
                    </div>
                  </div>

                  {/* CARD 3: PENDING QTY (Pr - Smog) */}
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-center shadow-sm">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                      <span className="text-[10px] font-mono font-black text-cyan-300 uppercase tracking-wider">
                        PENDING QTY
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-slate-100">
                      {totalPendingQty}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                      Pr – Smog
                    </div>
                  </div>
                </div>

                {/* MODEL WISE QUANTITIES CARDVIEW TABLE */}
                <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2.5">
                  {/* Header: Title + count */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      <h2 className="text-xs sm:text-sm font-extrabold text-white">
                        Model Wise Quantities
                      </h2>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-mono font-bold border border-slate-700">
                        {hsoModels.length} {hsoModels.length === 1 ? 'Model' : 'Models'}
                      </span>
                    </div>
                  </div>

                  {/* Models List Table */}
                  <div className="space-y-2 border border-slate-800 rounded-xl p-2 bg-slate-950">
                    {/* Table Header: #  MODEL NAME  PR.  SMOG  PEND.  DEL */}
                    <div 
                      className="grid gap-1.5 px-2 py-1 items-center text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider"
                      style={{ gridTemplateColumns: '22px minmax(0, 1fr) 52px 46px 40px 28px' }}
                    >
                      <span className="text-center">#</span>
                      <span className="text-left">MODEL NAME</span>
                      <span className="text-center text-rose-400">PR.</span>
                      <span className="text-center text-amber-400">SMOG</span>
                      <span className="text-center text-slate-300">PEND.</span>
                      <span className="text-center">DEL</span>
                    </div>

                    {/* Rows */}
                    {hsoModels.map((item, index) => {
                      const isEditingName = editingModelId === item.id;

                      return (
                        <div
                          key={item.id}
                          className="grid gap-1.5 items-center p-1.5 sm:p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all"
                          style={{ gridTemplateColumns: '22px minmax(0, 1fr) 52px 46px 40px 28px' }}
                        >
                          {/* # Index */}
                          <div className="text-center">
                            <span className="text-[11px] font-mono font-bold text-slate-500">
                              {index + 1}
                            </span>
                          </div>

                          {/* MODEL NAME (CLICK TO OPEN POPUP TO ADD SMOG QTY) */}
                          <div className="min-w-0 pr-0.5">
                            {isEditingName ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editingModelName}
                                  onChange={(e) => setEditingModelName(e.target.value)}
                                  className="w-full bg-slate-950 px-1.5 py-1 border border-cyan-500 rounded text-[10px] font-mono text-cyan-300 font-bold focus:outline-none"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveModelName(index);
                                    if (e.key === 'Escape') setEditingModelId(null);
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveModelName(index)}
                                  className="p-1 rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400 cursor-pointer"
                                >
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 min-w-0 w-full">
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenModelPopup(item, e)}
                                  className="flex-1 text-left py-1 px-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/60 text-slate-200 hover:text-cyan-300 font-mono font-bold text-[10px] sm:text-[11px] leading-tight transition-all cursor-pointer break-all"
                                  title={`Click to open popup and increase Smog Qty for ${item.modelName}`}
                                >
                                  <span className="block leading-snug">{item.modelName}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingModelId(item.id);
                                    setEditingModelName(item.modelName);
                                  }}
                                  className="p-1 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                                  title="Edit model name"
                                >
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* PR. QTY (Editable inline or populated from photo) */}
                          <div className="text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              min="0"
                              value={item.prQty === 0 ? '' : item.prQty}
                              placeholder="0"
                              onChange={(e) => handleModelPrQtyChange(index, e.target.value)}
                              className="w-full px-1 py-1 bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-lg text-[11px] font-mono font-bold text-rose-300 text-center focus:outline-none"
                              title="Pr. Qty (From Photo or editable)"
                            />
                          </div>

                          {/* SMOG QTY (Clicking opens popup to increase) */}
                          <div className="text-center">
                            <button
                              type="button"
                              onClick={(e) => handleOpenModelPopup(item, e)}
                              className="w-full px-1 py-1 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/60 rounded-lg text-[11px] font-mono font-black text-amber-300 text-center transition-all cursor-pointer"
                              title="Click to increase Smog Qty"
                            >
                              {item.smogQty}
                            </button>
                          </div>

                          {/* PENDING QTY (Pr. Qty - Smog Qty) */}
                          <div className="text-center">
                            <span className="text-[11px] font-mono font-black text-slate-200">
                              {item.pendingQty}
                            </span>
                          </div>

                          {/* DELETE BUTTON */}
                          <div className="text-center">
                            <button
                              type="button"
                              onClick={(e) => handleRemoveRow(index, e)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Delete model row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Calculated Totals Strip at bottom of table */}
                    <div className="p-2 px-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-slate-300 flex items-center justify-between flex-wrap gap-2 mt-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="font-bold">Totals:</span>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono font-bold">
                        <span>
                          Pr: <strong className="text-rose-400">{totalPrQty}</strong>
                        </span>
                        <span className="text-slate-600">|</span>
                        <span>
                          Smog: <strong className="text-amber-400">{totalSmogQty}</strong>
                        </span>
                        <span className="text-slate-600">|</span>
                        <span>
                          Pending: <strong className="text-slate-100">{totalPendingQty}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* REMARKS / NOTES */}
            <div className="p-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider shrink-0">Notes:</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => {
                  const val = e.target.value;
                  setNotes(val);
                  if (hsoModels.length > 0) {
                    persistSmogQtyState(hsoModels, val, false);
                  }
                }}
                placeholder="Optional operational remarks..."
                className="flex-1 bg-transparent text-xs text-white placeholder:text-slate-600 focus:outline-none font-mono py-0.5"
              />
            </div>

            {/* OPERATION CLOSE ACTION BUTTON */}
            <div className="pt-1 space-y-1.5">
              <button
                type="button"
                onClick={handleOperationClose}
                disabled={isSubmitting || isScanning || hsoModels.length === 0}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider text-slate-950 bg-cyan-400 hover:bg-cyan-300 active:scale-[0.98] transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving & Closing Operation...</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4 stroke-[2.5]" />
                    <span>Operation Close (Upload {totalSmogQty} Smog Qty)</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-slate-500 font-mono">
                Saves Pr. Qty ({totalPrQty}), Smog Qty ({totalSmogQty}), and Pending Qty ({totalPendingQty}) to Dashboard.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* SMALL POPUP TO INCREASE MODEL'S SMOG QTY */}
      {/* "Jaha Circle kiya gya hai waha Click krne per ek Chhota sa PopUp open hoga Us Model ka Smog Qty badhane ka" */}
      {/* ========================================================================= */}
      {popupModel && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-4 sm:p-5 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Popup Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Add Smog Qty
                  </h3>
                  <p className="text-sm font-black font-mono text-cyan-300 truncate">
                    {popupModel.modelName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClosePopup}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error inside popup */}
            {popupError && (
              <div className="p-2 rounded-lg bg-slate-950 border border-rose-500/40 text-rose-300 text-xs font-mono">
                {popupError}
              </div>
            )}

            {/* Current Stats Mini Grid */}
            <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800 text-center font-mono text-xs">
              <div className="p-1">
                <span className="text-[9px] text-rose-400 block font-bold">Pr. Qty</span>
                <span className="text-xs font-black text-rose-300 mt-0.5 block">{popupModel.prQty}</span>
              </div>
              <div className="p-1 border-x border-slate-800">
                <span className="text-[9px] text-amber-400 block font-bold">Smog Qty</span>
                <span className="text-xs font-black text-amber-300 mt-0.5 block">{popupModel.smogQty}</span>
              </div>
              <div className="p-1">
                <span className="text-[9px] text-slate-300 block font-bold">Pending</span>
                <span className="text-xs font-black text-slate-100 mt-0.5 block">{popupModel.pendingQty}</span>
              </div>
            </div>

            {/* Quantity Input Field */}
            <form onSubmit={handlePopupSubmitAdd} className="space-y-3">
              <div>
                <label className="text-[11px] font-mono font-bold text-slate-300 block mb-1">
                  Qty Badhane Ke Liye Enter Karein:
                </label>
                <div className="relative">
                  <input
                    ref={popupInputRef}
                    type="number"
                    min="1"
                    value={popupQtyInput}
                    onChange={(e) => {
                      setPopupQtyInput(e.target.value);
                      setPopupError(null);
                    }}
                    placeholder="Enter quantity to add..."
                    className="w-full bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-700 text-sm font-mono font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                    autoFocus
                  />
                  {popupQtyInput && (
                    <button
                      type="button"
                      onClick={() => setPopupQtyInput('')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1 justify-between">
                {[5, 10, 25, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setPopupQtyInput(String(preset));
                      setPopupError(null);
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold border border-slate-700 cursor-pointer transition-all active:scale-95"
                  >
                    +{preset}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={!popupQtyInput}
                  className="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Add To Smog</span>
                </button>

                <button
                  type="button"
                  onClick={handlePopupSubmitSetExact}
                  disabled={!popupQtyInput}
                  className="py-2.5 px-3 rounded-xl font-bold text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Directly set exact Smog Qty to this value"
                >
                  Set Exact
                </button>
              </div>

              <div className="text-[10px] text-center text-slate-500 font-mono">
                Formula: Pending Qty = Pr. Qty – Smog Qty
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const SmogQtyFormScreen = SmogQtyFormModal;
