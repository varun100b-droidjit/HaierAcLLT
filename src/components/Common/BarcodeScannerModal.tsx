import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ScanBarcode, 
  Send, 
  RotateCcw, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Camera, 
  CameraOff, 
  Sparkles,
  Layers,
  ArrowRight,
  RefreshCw,
  Search,
  Check,
  Upload,
  SwitchCamera,
  Image as ImageIcon,
  User
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { findModelByPrefix, getAllModels } from '../../services/modelMasterStore';
import { useAuth } from '../../context/AuthContext';
import { 
  sendMachinesToELT, 
  returnMachineToBSR, 
  returnMultipleMachinesToBSR,
  findInELTRecords, 
  ELTRecord, 
  BSRRecord 
} from '../../services/eltBsrStore';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessNavigate?: (tab: 'elt' | 'bsr') => void;
}

export type ScannerProcess = 'SEND_ELT' | 'RETURN_BSR';

export interface MachineEntryRow {
  id: string;
  serialNumber: string;
  modelName: string;
  materialCode: string;
  prefix: string;
  matchStatus: 'idle' | 'matched' | 'not_found';
  originalELTDateTime?: string;
  error?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onSuccessNavigate
}) => {
  const { user } = useAuth();
  const operatorUserId = user?.userId || 'ADMIN01';
  const operatorName = user?.name || 'Admin Operator';

  // Process Selector: Initial Screen
  const [selectedProcess, setSelectedProcess] = useState<ScannerProcess>('SEND_ELT');

  // Scanned Machines List
  const [machineRows, setMachineRows] = useState<MachineEntryRow[]>([]);
  const [manualSerialInput, setManualSerialInput] = useState<string>('');
  const [manualModelInput, setManualModelInput] = useState<string>('');
  const [activeRowId, setActiveRowId] = useState<string>('');
  const activeRowIdRef = useRef<string>('');
  useEffect(() => {
    activeRowIdRef.current = activeRowId;
  }, [activeRowId]);

  // Camera & Scanner state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [isFileScanning, setIsFileScanning] = useState<boolean>(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef<boolean>(false);
  const isScanningRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scannerContainerId = 'llt-barcode-reader-viewfinder';

  // Anti-freeze scan throttle & duplicate prevention refs
  const handleBarcodeScannedRef = useRef<(rawBarcode: string) => void>(() => {});
  const lastScannedBarcodeRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);
  const isProcessingScanRef = useRef<boolean>(false);
  const [scanFeedbackToast, setScanFeedbackToast] = useState<{ serial: string; model: string; isError?: boolean } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const selectedProcessRef = useRef<ScannerProcess>(selectedProcess);
  useEffect(() => {
    selectedProcessRef.current = selectedProcess;
  }, [selectedProcess]);

  // Active Scanned Input state (used for RETURN_BSR single scan)
  const [scannedSerial, setScannedSerial] = useState<string>('');
  const [detectedModelName, setDetectedModelName] = useState<string>('');
  const [detectedPrefix, setDetectedPrefix] = useState<string>('');
  const [modelMatchStatus, setModelMatchStatus] = useState<'idle' | 'matched' | 'not_found'>('idle');

  // SEND ELT Error / Submitting states
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isSubmittingELT, setIsSubmittingELT] = useState<boolean>(false);

  // RETURN BSR State
  const [bsrFoundRecord, setBsrFoundRecord] = useState<ELTRecord | null>(null);
  const [bsrValidationState, setBsrValidationState] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [bsrErrorMessage, setBsrErrorMessage] = useState<string>('');
  const [isSubmittingBSR, setIsSubmittingBSR] = useState<boolean>(false);

  // Success Toast Banner
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Sound feedback - reuse AudioContext instance to avoid hitting mobile browser limits
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playScanBeep = () => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }
      const audioCtx = audioCtxRef.current;
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 30, 40]);
      }
    } catch {
      // AudioContext safe fallback
    }
  };

  const playRejectBeep = () => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }
      const audioCtx = audioCtxRef.current;
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch {
      // AudioContext safe fallback
    }
  };

  // Helper to sanitize scanned barcode
  const sanitizeBarcode = (raw: string): string => {
    let clean = (raw || '').replace(/[\r\n\t]/g, '').trim().toUpperCase();
    // Strip AIM Symbology identifier prefix (e.g. ]C1, ]d2, ]Q3, ]e0) if emitted by scanner
    if (clean.startsWith(']') && clean.length > 3) {
      clean = clean.replace(/^\][A-Z0-9]{2}/, '');
    }
    // Strip common serial prefixes if attached
    if (clean.startsWith('SN:') || clean.startsWith('S/N:')) {
      clean = clean.replace(/^S\/?N:\s*/, '');
    }
    return clean.trim();
  };

  // Add scanned machine to list (matching Smog Scanner pattern)
  const addScannedMachine = (rawSerial: string, explicitModel?: string) => {
    if (!rawSerial) return;
    const cleanSerial = sanitizeBarcode(rawSerial);
    if (!cleanSerial) return;

    // RULE: Barcode MUST start with 'A'
    if (!cleanSerial.startsWith('A')) {
      playRejectBeep();
      setBatchError(`Invalid Barcode "${cleanSerial}": Only barcodes starting with 'A' are accepted.`);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setScanFeedbackToast({
        serial: cleanSerial,
        model: "Rejected: Must start with 'A'",
        isError: true
      });
      toastTimeoutRef.current = setTimeout(() => {
        setScanFeedbackToast(null);
      }, 3000);
      return;
    }

    const currentProcess = selectedProcessRef.current;

    let modelName = explicitModel?.trim() || '';
    let materialCode = '';
    let prefix = '';
    let matchStatus: 'idle' | 'matched' | 'not_found' = 'idle';
    let rowError: string | undefined = undefined;
    let originalELTDateTime: string | undefined = undefined;

    if (currentProcess === 'SEND_ELT') {
      const prefix9 = cleanSerial.length >= 9 ? cleanSerial.slice(0, 9) : cleanSerial;
      prefix = prefix9;
      materialCode = prefix9;
      const matched = findModelByPrefix(prefix9);

      if (matched && matched.modelName) {
        modelName = modelName || matched.modelName;
        materialCode = matched.materialCode || prefix9;
        matchStatus = 'matched';
      } else if (modelName) {
        matchStatus = 'matched';
      } else {
        matchStatus = 'not_found';
        rowError = `Prefix "${prefix9}" not in Model Sheet`;
      }

      if (findInELTRecords(cleanSerial)) {
        rowError = `Already in ELT Record!`;
      }
    } else {
      // RETURN BSR PROCESS: Check in ELT Records
      const existingInELT = findInELTRecords(cleanSerial);
      if (existingInELT) {
        modelName = existingInELT.modelName;
        materialCode = existingInELT.materialCode;
        prefix = existingInELT.materialCode;
        matchStatus = 'matched';
        originalELTDateTime = `${existingInELT.eltDate} ${existingInELT.eltTime}`;
      } else {
        matchStatus = 'not_found';
        rowError = 'Serial Number not found in ELT Record';
      }
    }

    // Check duplicate in current batch
    if (machineRows.some(r => sanitizeBarcode(r.serialNumber) === cleanSerial)) {
      setBatchError(`Machine ${cleanSerial} already scanned in this list.`);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setScanFeedbackToast({
        serial: cleanSerial,
        model: 'Duplicate in current list',
        isError: true
      });
      toastTimeoutRef.current = setTimeout(() => setScanFeedbackToast(null), 2500);
      return;
    }

    playScanBeep();
    setSuccessBanner(null);
    setBatchError(null);

    const newItem: MachineEntryRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      serialNumber: cleanSerial,
      modelName,
      materialCode,
      prefix,
      matchStatus,
      originalELTDateTime,
      error: rowError
    };

    setMachineRows(prev => [newItem, ...prev]);
    setManualSerialInput('');
    setManualModelInput('');

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setScanFeedbackToast({
      serial: cleanSerial,
      model: modelName || (currentProcess === 'SEND_ELT' ? 'ELT Unit' : 'BSR Return'),
      isError: Boolean(rowError)
    });
    toastTimeoutRef.current = setTimeout(() => {
      setScanFeedbackToast(null);
    }, 2500);
  };

  // Process Barcode Scanned (from camera, photo or gun)
  const handleBarcodeScanned = (rawBarcode: string) => {
    if (!rawBarcode) return;
    const cleanBarcode = sanitizeBarcode(rawBarcode);
    if (!cleanBarcode) return;

    if (!cleanBarcode.startsWith('A')) {
      playRejectBeep();
      setBatchError(`Invalid Barcode "${cleanBarcode}": Only barcodes starting with 'A' are accepted.`);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setScanFeedbackToast({
        serial: cleanBarcode,
        model: "Rejected: Must start with 'A'",
        isError: true
      });
      toastTimeoutRef.current = setTimeout(() => {
        setScanFeedbackToast(null);
      }, 3000);
      return;
    }

    const now = Date.now();

    // 1. Prevent duplicate spam of the exact same barcode while in camera view
    if (cleanBarcode === lastScannedBarcodeRef.current && now - lastScanTimeRef.current < 2000) {
      return;
    }

    // 2. Throttle: at least 500ms between any scans
    if (isProcessingScanRef.current || now - lastScanTimeRef.current < 500) {
      return;
    }

    isProcessingScanRef.current = true;
    lastScanTimeRef.current = now;
    lastScannedBarcodeRef.current = cleanBarcode;

    setTimeout(() => {
      isProcessingScanRef.current = false;
    }, 500);

    addScannedMachine(cleanBarcode);
  };

  // Keep ref synchronized on every render so camera callback always invokes latest handler
  handleBarcodeScannedRef.current = handleBarcodeScanned;
  useEffect(() => {
    handleBarcodeScannedRef.current = handleBarcodeScanned;
  });

  // Start Camera Function with multi-tier fallback for mobile browsers
  const startCamera = async (targetCameraId?: string) => {
    if (isStartingRef.current) return;

    const container = document.getElementById(scannerContainerId);
    if (!container) return;

    setCameraError(null);
    isStartingRef.current = true;

    try {
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning || isScanningRef.current) {
            await html5QrCodeRef.current.stop();
          }
        } catch {}
        try {
          await html5QrCodeRef.current.clear();
        } catch {}
        html5QrCodeRef.current = null;
      }

      // Re-verify container still mounted in DOM
      if (!document.getElementById(scannerContainerId)) {
        isStartingRef.current = false;
        return;
      }

      const formats = [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.PDF_417,
        Html5QrcodeSupportedFormats.AZTEC
      ];

      // Wide barcode scan area optimized for horizontal machine serials
      const qrConfig = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const w = Math.min(Math.floor(viewfinderWidth * 0.90), 380);
          const h = Math.min(Math.floor(viewfinderHeight * 0.70), 200);
          return { width: Math.max(w, 200), height: Math.max(h, 90) };
        }
      };

      // Detect available cameras on the device
      let cameraList: { id: string; label: string }[] = [];
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          cameraList = devices.map((d, i) => ({
            id: d.id,
            label: d.label || `Camera ${i + 1}`
          }));
          setAvailableCameras(cameraList);
        }
      } catch (camErr) {
        console.warn('Camera enumeration note:', camErr);
      }

      // Multi-fallback order:
      // 1. Specified target cameraId if requested
      // 2. { facingMode: 'environment' } (standard mobile rear camera)
      // 3. Rear / back camera ID if detected from enumeration
      // 4. { facingMode: 'user' } (front camera fallback)
      // 5. {} (any available camera stream)
      const attempts: any[] = [];
      if (targetCameraId) {
        attempts.push(targetCameraId);
      } else {
        attempts.push({ facingMode: 'environment' });
        if (cameraList.length > 0) {
          const backCam = cameraList.find(c => /back|rear|environment|main|standard/i.test(c.label)) || cameraList[0];
          attempts.push(backCam.id);
        }
        attempts.push({ facingMode: 'user' });
        attempts.push({});
      }

      let started = false;
      let lastErr: any = null;

      for (const config of attempts) {
        try {
          // Fresh instance per attempt to prevent broken state machine
          const scanner = new Html5Qrcode(scannerContainerId, {
            formatsToSupport: formats,
            verbose: false
          });
          html5QrCodeRef.current = scanner;

          await scanner.start(
            config,
            qrConfig,
            (decodedText) => {
              if (handleBarcodeScannedRef.current) {
                handleBarcodeScannedRef.current(decodedText);
              }
            },
            () => {
              // Frame decode in progress
            }
          );
          started = true;
          isScanningRef.current = true;
          setIsCameraActive(true);
          setCameraError(null);
          if (typeof config === 'string') {
            setActiveCameraId(config);
          }
          break;
        } catch (err) {
          lastErr = err;
          try {
            if (html5QrCodeRef.current) {
              await html5QrCodeRef.current.clear();
            }
          } catch {}
          html5QrCodeRef.current = null;
        }
      }

      if (!started) {
        throw lastErr || new Error("Could not initialize video stream");
      }
    } catch (err: any) {
      console.warn('Camera start error:', err);
      isScanningRef.current = false;
      setIsCameraActive(false);
      const errMsg = err?.message || String(err);
      if (err?.name === 'NotAllowedError' || errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('denied')) {
        setCameraError('Camera permission was blocked. Tap "Activate Camera" to grant access, or use "Snap Photo" below.');
      } else {
        setCameraError('Could not start live camera feed. Tap "Activate Camera" or use "Snap / Upload Photo" to read barcodes.');
      }
    } finally {
      isStartingRef.current = false;
    }
  };

  // Switch between available cameras (e.g. rear and front)
  const switchCamera = async () => {
    if (availableCameras.length < 2) return;
    const currentIndex = availableCameras.findIndex(c => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextCamera = availableCameras[nextIndex];
    if (nextCamera) {
      await stopCamera();
      await startCamera(nextCamera.id);
    }
  };

  // Stop Camera Function
  const stopCamera = async () => {
    isStartingRef.current = false;
    const scanner = html5QrCodeRef.current;
    if (scanner) {
      try {
        if (scanner.isScanning || isScanningRef.current) {
          await scanner.stop();
        }
      } catch (e) {
        console.warn('Camera stop warning:', e);
      }
      try {
        await scanner.clear();
      } catch (e) {
        // Safe to ignore
      }
      html5QrCodeRef.current = null;
    }
    isScanningRef.current = false;
    setIsCameraActive(false);
  };

  // Scan directly from photo or gallery upload (100% reliable fallback)
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFileScanning(true);
    setCameraError(null);

    try {
      let scanner = html5QrCodeRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.DATA_MATRIX
          ],
          verbose: false
        });
        html5QrCodeRef.current = scanner;
      }

      const decoded = await scanner.scanFile(file, false);
      if (decoded) {
        handleBarcodeScanned(decoded);
      }
    } catch (err: any) {
      console.warn("File scan error:", err);
      setCameraError("Could not decode barcode from this photo. Please ensure barcode is sharp and well lit, or type the code manually.");
    } finally {
      setIsFileScanning(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // Start scanner when modal opens and clean up when modal closes
  useEffect(() => {
    let isMounted = true;
    let timer: any = null;

    if (isOpen) {
      // Delay to ensure modal DOM container is fully painted
      timer = setTimeout(() => {
        if (isMounted) {
          startCamera();
        }
      }, 350);
    } else {
      stopCamera();
      resetForm();
    }

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      stopCamera();
    };
  }, [isOpen]);

  // Support Hardware Barcode Scanner Gun (USB / Bluetooth keystrokes followed by Enter)
  useEffect(() => {
    if (!isOpen) return;
    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is actively in an input field
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      const now = Date.now();
      // Rapid keystrokes (< 180ms) indicate hardware scanner gun input
      if (now - lastKeyTime > 180) {
        buffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.trim().length >= 3) {
          e.preventDefault();
          handleBarcodeScanned(buffer.trim());
          buffer = '';
        }
      } else if (e.key && e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const resetForm = () => {
    lastScannedBarcodeRef.current = '';
    isProcessingScanRef.current = false;
    setScanFeedbackToast(null);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setManualSerialInput('');
    setManualModelInput('');
    setScannedSerial('');
    setDetectedModelName('');
    setDetectedPrefix('');
    setModelMatchStatus('idle');
    setBatchError(null);
    setBsrValidationState('idle');
    setBsrErrorMessage('');
    setBsrFoundRecord(null);
    setSuccessBanner(null);
    setMachineRows([]);
    setActiveRowId('');
    activeRowIdRef.current = '';
  };

  // Clear all scanned machines in current session
  const handleClearAll = () => {
    lastScannedBarcodeRef.current = '';
    isProcessingScanRef.current = false;
    setScanFeedbackToast(null);
    setMachineRows([]);
    setBatchError(null);
  };

  // Remove individual machine row
  const handleDeleteRow = (id: string) => {
    lastScannedBarcodeRef.current = '';
    isProcessingScanRef.current = false;
    setMachineRows(prev => prev.filter(r => r.id !== id));
  };

  // SEND ELT: Submit all valid machines to Firebase
  const handleSendELT = async () => {
    setBatchError(null);

    const filledRows = machineRows.filter(r => r.serialNumber.trim().length > 0);
    if (filledRows.length === 0) {
      setBatchError('Please scan or enter at least one machine Series No.');
      return;
    }

    // RULE: Barcode MUST start with 'A'
    const nonA = filledRows.find(r => !r.serialNumber.trim().toUpperCase().startsWith('A'));
    if (nonA) {
      setBatchError(`Machine "${nonA.serialNumber}": Only barcodes starting with 'A' are accepted.`);
      return;
    }

    // Validate Model Sheet match
    const invalidModel = filledRows.find(r => r.matchStatus !== 'matched' || !r.modelName);
    if (invalidModel) {
      setBatchError(`Machine "${invalidModel.serialNumber}": Valid Model Name required from Model Sheet.`);
      return;
    }

    // Check duplicate serials in current batch
    const serials = filledRows.map(r => r.serialNumber.trim().toUpperCase());
    const duplicatesInBatch = serials.filter((item, index) => serials.indexOf(item) !== index);
    if (duplicatesInBatch.length > 0) {
      setBatchError(`Duplicate Serial Number in current list: ${duplicatesInBatch[0]}`);
      return;
    }

    // Check duplicate in Firebase ELT Records
    const alreadyInELT = filledRows.find(r => findInELTRecords(r.serialNumber.trim().toUpperCase()));
    if (alreadyInELT) {
      setBatchError(`Serial Number ${alreadyInELT.serialNumber} is already registered in ELT Record.`);
      return;
    }

    const machinesToSubmit = filledRows.map(r => ({
      modelName: r.modelName,
      materialCode: r.materialCode || r.serialNumber.trim().slice(0, 9),
      serialNumber: r.serialNumber.trim().toUpperCase()
    }));

    setIsSubmittingELT(true);
    try {
      const res = await sendMachinesToELT(machinesToSubmit, {
        userId: operatorUserId,
        name: operatorName
      });
      if (res.success) {
        setSuccessBanner(`Successfully sent ${res.addedCount} machine(s) to ELT Record.`);
        setMachineRows([]);
        setManualSerialInput('');
        setManualModelInput('');

        if (onSuccessNavigate) {
          setTimeout(() => {
            onSuccessNavigate('elt');
            onClose();
          }, 1200);
        }
      } else if (res.duplicates && res.duplicates.length > 0) {
        setBatchError(`Duplicate Serial Number(s) rejected: ${res.duplicates.join(', ')}`);
      } else {
        setBatchError('Failed to record machines in ELT.');
      }
    } catch (e: any) {
      setBatchError(e.message || 'An error occurred while saving to ELT.');
    } finally {
      setIsSubmittingELT(false);
    }
  };

  // RETURN BSR: Execute return and record transfer for all scanned machines
  const handleReturnBSR = async () => {
    setBatchError(null);

    const filledRows = machineRows.filter(r => r.serialNumber.trim().length > 0);
    if (filledRows.length === 0) {
      setBatchError('Please scan or enter at least one machine Series No. to return.');
      return;
    }

    // RULE: Barcode MUST start with 'A'
    const nonA = filledRows.find(r => !r.serialNumber.trim().toUpperCase().startsWith('A'));
    if (nonA) {
      setBatchError(`Machine "${nonA.serialNumber}": Only barcodes starting with 'A' are accepted.`);
      return;
    }

    // Validate that all machines exist in ELT Records
    const invalidRows = filledRows.filter(r => r.matchStatus !== 'matched' || !findInELTRecords(r.serialNumber.trim().toUpperCase()));
    if (invalidRows.length > 0) {
      setBatchError(`Machine "${invalidRows[0].serialNumber}" not found in ELT Record. Cannot return.`);
      return;
    }

    // Check duplicate serials in current batch
    const serials = filledRows.map(r => r.serialNumber.trim().toUpperCase());
    const duplicatesInBatch = serials.filter((item, index) => serials.indexOf(item) !== index);
    if (duplicatesInBatch.length > 0) {
      setBatchError(`Duplicate Serial Number in current list: ${duplicatesInBatch[0]}`);
      return;
    }

    setIsSubmittingBSR(true);
    try {
      const res = await returnMultipleMachinesToBSR(serials, {
        userId: operatorUserId,
        name: operatorName
      });
      if (res.success) {
        setSuccessBanner(`Successfully returned ${res.returnedCount} machine(s) to BSR.`);
        setMachineRows([]);
        setManualSerialInput('');
        setManualModelInput('');

        if (onSuccessNavigate) {
          setTimeout(() => {
            onSuccessNavigate('bsr');
            onClose();
          }, 1200);
        }
      } else {
        setBatchError(res.errors?.[0] || 'Failed to process BSR Return.');
      }
    } catch (e: any) {
      setBatchError(e.message || 'Error occurred during BSR return.');
    } finally {
      setIsSubmittingBSR(false);
    }
  };

  // Safe close handler ensuring camera hardware stream is detached
  const handleCloseModal = async () => {
    await stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-cyan-950/40 text-slate-100 overflow-hidden my-auto max-h-[84vh] flex flex-col">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-4 py-2.5 sm:px-5 sm:py-3 bg-slate-950/80 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-950/50">
              <ScanBarcode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide flex items-center gap-2 flex-wrap">
                Barcode / QR Scanner
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/80">
                  LLT Station
                </span>
                {operatorUserId && operatorUserId !== 'ADMIN01' && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 inline-flex items-center gap-1">
                    <User className="w-2.5 h-2.5 text-cyan-400" />
                    ID: <strong className="text-cyan-300 font-bold">{operatorUserId}</strong>
                  </span>
                )}
              </h2>
            </div>
          </div>

          <button
            onClick={handleCloseModal}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3 flex-1">
          
          {/* STEP 1: Process Selection Buttons (SEND ELT vs RETURN BSR) */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Select Workflow Process:
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedProcess('SEND_ELT');
                  resetForm();
                }}
                className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  selectedProcess === 'SEND_ELT'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-cyan-400 shadow-lg shadow-cyan-950/80 ring-2 ring-cyan-400/40'
                    : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
                }`}
              >
                <Send className="w-3.5 h-3.5 text-cyan-300" />
                <span>1. SEND ELT</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedProcess('RETURN_BSR');
                  resetForm();
                }}
                className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  selectedProcess === 'RETURN_BSR'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400 shadow-lg shadow-emerald-950/80 ring-2 ring-emerald-400/40'
                    : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-300" />
                <span>2. RETURN BSR</span>
              </button>
            </div>
          </div>

          {/* Success Banner Alert */}
          {successBanner && (
            <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/80 rounded-xl flex items-center gap-2 text-xs text-emerald-200 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{successBanner}</span>
            </div>
          )}

          {/* Real-Time Camera Viewfinder with Generous Scanning Area */}
          <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 flex flex-col items-center">
            <div className="relative w-full h-[185px] sm:h-[210px] min-h-[185px] sm:min-h-[210px] bg-black flex items-center justify-center overflow-hidden">
              {/* Dedicated Html5Qrcode host container */}
              <div 
                id={scannerContainerId} 
                className="w-full h-[185px] sm:h-[210px] min-h-[185px] sm:min-h-[210px] flex items-center justify-center overflow-hidden"
              />

              {/* Scanning visual overlay with laser */}
              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div className="w-[85%] max-w-[340px] h-24 sm:h-28 border-2 border-dashed border-cyan-400/90 rounded-xl relative overflow-hidden shadow-[0_0_25px_rgba(6,182,212,0.3)]">
                    <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent absolute top-0 animate-[bounce_2s_infinite]" />
                    <div className="absolute bottom-1 right-2 text-[9px] font-mono text-cyan-400 font-bold drop-shadow">
                      Point at Barcode (Starts with 'A')
                    </div>
                  </div>
                </div>
              )}

              {/* Instant Scan Feedback Banner over camera */}
              {scanFeedbackToast && (
                <div className={`absolute top-2.5 inset-x-3 z-20 flex items-center justify-between p-2 rounded-xl shadow-xl backdrop-blur-xs text-xs animate-in slide-in-from-top-2 duration-150 border ${
                  scanFeedbackToast.isError
                    ? 'bg-rose-950/95 border-rose-500 text-rose-200'
                    : 'bg-emerald-950/95 border-emerald-500 text-emerald-200'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      scanFeedbackToast.isError ? 'bg-rose-400' : 'bg-emerald-400 animate-ping'
                    }`} />
                    <div className="truncate">
                      <span className="font-mono font-black text-white">{scanFeedbackToast.serial}</span>
                      <span className={`ml-1.5 font-semibold ${
                        scanFeedbackToast.isError ? 'text-rose-300' : 'text-emerald-300'
                      }`}>
                        ({scanFeedbackToast.model})
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0 border ${
                    scanFeedbackToast.isError
                      ? 'bg-rose-900 text-rose-300 border-rose-700'
                      : 'bg-emerald-900 text-emerald-300 border-emerald-700'
                  }`}>
                    {scanFeedbackToast.isError ? 'Rejected ⚠️' : 'Scanned ✓'}
                  </span>
                </div>
              )}

              {/* Status & User-Action Overlay when camera is paused/inactive */}
              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-3 bg-slate-950/90 backdrop-blur-xs text-center z-10">
                  {isFileScanning ? (
                    <div className="flex flex-col items-center gap-2 text-cyan-400">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                      <span className="text-xs font-semibold">Decoding photo barcode...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400 mb-2 shadow-lg shadow-cyan-950/50">
                        <Camera className="w-4 h-4" />
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => startCamera()}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-950/50 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Activate Camera</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700 active:scale-95 transition-transform"
                        >
                          <Upload className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Snap Photo</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Hidden native camera capture input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileScan}
              className="hidden"
            />

            {/* Camera Controls Bar */}
            <div className="w-full px-2.5 py-1.5 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${isCameraActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="text-slate-400 text-[10px] truncate">
                  {isCameraActive ? 'Live Camera Active' : 'Camera Standby'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {availableCameras.length > 1 && (
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Switch Lens"
                  >
                    <SwitchCamera className="w-3 h-3 text-cyan-400" />
                    <span>Switch</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Take photo of barcode"
                >
                  <Upload className="w-3 h-3 text-cyan-400" />
                  <span>Snap</span>
                </button>

                <button
                  type="button"
                  onClick={() => (isCameraActive ? stopCamera() : startCamera())}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {isCameraActive ? (
                    <>
                      <CameraOff className="w-3 h-3 text-rose-400" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-3 h-3 text-cyan-400" />
                      <span>Start</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Camera Error / Permission Fallback Note */}
          {cameraError && (
            <div className="p-2.5 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{cameraError}</p>
                  <p className="text-[10px] text-amber-400/80 mt-0.5">
                    You can type the barcode into the textbox below or scan with a USB/Bluetooth scanner.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => startCamera()}
                className="shrink-0 px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* MANUAL / GUN SCANNER INPUT WITH PROMINENT MODEL NAME */}
          <div className="p-3 rounded-2xl bg-slate-950/95 border border-slate-800 space-y-2.5 shadow-inner">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              {/* Series No. Input */}
              <div className="sm:col-span-6">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Series No. (Barcode / Gun Input):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={manualSerialInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setManualSerialInput(val);
                      const clean = val.trim().toUpperCase();
                      if (clean.length >= 9) {
                        const matched = findModelByPrefix(clean.slice(0, 9));
                        if (matched?.modelName) {
                          setManualModelInput(matched.modelName);
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addScannedMachine(manualSerialInput, manualModelInput);
                      }
                    }}
                    placeholder="Scan with gun or type (e.g. A010834A0001)..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                  <ScanBarcode className="w-3.5 h-3.5 text-cyan-400 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Model Name Input (Always visible on all screens, auto-detected or selectable) */}
              <div className="sm:col-span-6">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Model Name:
                  </label>
                  {manualModelInput ? (
                    <span className="text-[9px] font-mono text-cyan-400 font-bold">Auto Matched</span>
                  ) : (
                    <span className="text-[9px] text-slate-500 font-mono">From Model Sheet</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      list="elt-modal-model-list"
                      value={manualModelInput}
                      onChange={(e) => setManualModelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addScannedMachine(manualSerialInput, manualModelInput);
                        }
                      }}
                      placeholder="Select or enter Model Name..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs font-bold text-cyan-300 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                    <datalist id="elt-modal-model-list">
                      {getAllModels().map((m, idx) => (
                        <option key={`${m.materialCode}-${idx}`} value={m.modelName}>
                          {m.modelName} ({m.materialCode})
                        </option>
                      ))}
                    </datalist>
                  </div>

                  <button
                    type="button"
                    onClick={() => addScannedMachine(manualSerialInput, manualModelInput)}
                    className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-950/50 transition-all cursor-pointer active:scale-95 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SCANNED MACHINES LIST (Matching Smog Scanner UI with prominent Sr. No. and Model display) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Scanned Machines ({machineRows.length} Units)</span>
              </h3>
              {machineRows.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[10px] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1 font-semibold"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear All
                </button>
              )}
            </div>

            {machineRows.length === 0 ? (
              <div className="p-5 text-center rounded-2xl bg-slate-950/50 border border-dashed border-slate-800 text-slate-500 text-xs">
                No machines scanned yet. Aim camera at machine barcode or enter Series No. above.
              </div>
            ) : (
              <div className="space-y-2 max-h-44 sm:max-h-52 overflow-y-auto pr-1">
                {machineRows.map((m, idx) => (
                  <div
                    key={m.id}
                    className={`p-2.5 sm:p-3 rounded-xl bg-slate-950 border transition-all flex items-center justify-between gap-3 text-xs ${
                      m.error
                        ? 'border-rose-800/80 bg-rose-950/20'
                        : selectedProcess === 'SEND_ELT'
                        ? 'border-cyan-900/60 hover:border-cyan-700/80'
                        : 'border-emerald-900/60 hover:border-emerald-700/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        {/* Prominent Sr. No. & Model Name display */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                              Sr. No:
                            </span>
                            <span className={`font-mono font-black text-sm tracking-wide ${
                              m.error
                                ? 'text-rose-300'
                                : selectedProcess === 'SEND_ELT'
                                ? 'text-cyan-300'
                                : 'text-emerald-300'
                            }`}>
                              {m.serialNumber}
                            </span>
                          </div>

                          {/* Prominent Model Name Badge */}
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-950/80 border border-cyan-800/80 text-xs font-bold text-cyan-300 shadow-sm">
                            <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Model:</span>
                            <span className="font-mono font-black text-white">{m.modelName || '—'}</span>
                          </div>

                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                            m.error
                              ? 'bg-rose-950 border-rose-800 text-rose-400'
                              : selectedProcess === 'SEND_ELT'
                              ? 'bg-cyan-950 border-cyan-800 text-cyan-400'
                              : 'bg-emerald-950 border-emerald-800 text-emerald-400'
                          }`}>
                            {m.error ? 'Error ⚠️' : selectedProcess === 'SEND_ELT' ? 'Ready to ELT' : 'Ready to BSR'}
                          </span>
                        </div>

                        {/* Prefix & ELT Information */}
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 flex-wrap">
                          {m.materialCode && (
                            <span className="font-mono text-[10px] text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                              Prefix: <strong className="text-slate-200">{m.materialCode}</strong>
                            </span>
                          )}
                          {m.originalELTDateTime && (
                            <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                              ELT: {m.originalELTDateTime}
                            </span>
                          )}
                        </div>

                        {m.error && (
                          <p className="text-[10px] text-rose-400 font-semibold mt-0.5">{m.error}</p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteRow(m.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Remove machine"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Batch Error Banner */}
          {batchError && (
            <div className="p-2.5 bg-rose-950/50 border border-rose-800/80 rounded-xl text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{batchError}</span>
            </div>
          )}

        </div>

        {/* Modal Bottom Action Footer */}
        <div className="p-3 sm:p-3.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleCloseModal}
            className="px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {selectedProcess === 'SEND_ELT' ? (
            <button
              type="button"
              disabled={isSubmittingELT || machineRows.filter(r => r.serialNumber.trim().length > 0 && !r.error).length === 0}
              onClick={handleSendELT}
              className="flex-1 sm:flex-initial px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
            >
              {isSubmittingELT ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Saving to ELT...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>
                    SEND ELT ({machineRows.filter(r => r.serialNumber.trim().length > 0 && !r.error).length} Unit{machineRows.filter(r => r.serialNumber.trim().length > 0 && !r.error).length === 1 ? '' : 's'})
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmittingBSR || machineRows.filter(r => r.serialNumber.trim().length > 0 && r.matchStatus === 'matched' && !r.error).length === 0}
              onClick={handleReturnBSR}
              className="flex-1 sm:flex-initial px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
            >
              {isSubmittingBSR ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Processing BSR Return...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>
                    BSR RETURN ({machineRows.filter(r => r.serialNumber.trim().length > 0 && r.matchStatus === 'matched' && !r.error).length} Unit{machineRows.filter(r => r.serialNumber.trim().length > 0 && r.matchStatus === 'matched' && !r.error).length === 1 ? '' : 's'})
                  </span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
