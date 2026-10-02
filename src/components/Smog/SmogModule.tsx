import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  Search, 
  Plus, 
  CheckCircle2, 
  Trash2, 
  X,
  UserCheck,
  Clock,
  Layers,
  Check,
  Copy,
  User,
  Eye,
  Database,
  CheckCircle,
  AlertCircle,
  ScanBarcode,
  Calendar,
  Filter,
  FileText,
  MapPin,
  Hash,
  Boxes,
  Hourglass,
  ArrowLeft
} from 'lucide-react';
import { UserProfile } from '../../types';
import { 
  syncLeakUnitToSupabase, 
  deleteLeakUnitFromSupabase, 
  fetchLeakUnitsFromSupabase,
  broadcastLabRealtimeEvent,
  subscribeToLabRealtimeEvents 
} from '../../lib/supabase';
import { SmogBarcodeScannerModal, getAutoSmogShift } from './SmogBarcodeScannerModal';
import { SmogUniqueCalendar } from './SmogUniqueCalendar';
import { SmogQtyFormModal } from './SmogQtyFormModal';
import { SmogWhatsAppReportModal } from './SmogWhatsAppReportModal';
import { 
  getSmogQtyRecords,
  fetchSmogQtyRecordsByDate,
  subscribeSmogQtyRecords, 
  SmogQtyRecord 
} from '../../services/smogQtyStore';
import { 
  getSmogExtraMetrics, 
  subscribeSmogExtraMetrics, 
  SmogExtraMetrics 
} from '../../services/smogExtraStore';
import { findModelByPrefix } from '../../services/modelMasterStore';
import { 
  syncSmogLeakUnitToFirebase, 
  deleteSmogLeakUnitFromFirebase, 
  fetchSmogLeakUnitsFromFirebase, 
  subscribeSmogLeakUnitsFromFirebase 
} from '../../services/smogFirebaseStore';

export interface LeakUnitRecord {
  id: string;
  smogPerson: string;
  shift: 'A' | 'B' | 'C' | string;
  modelName: string;
  serialNumbers: string[];
  passedSerials: string[]; // List of Sr. No. passed/verified
  suspectCount: number;    // Number of Sr. No. in form
  actualCount: number;     // Number of passed Sr. No.
  date: string;            // YYYY-MM-DD
  month: string;           // YYYY-MM
  time: string;            // HH:mm AM/PM
  createdAt: string;
  notes?: string;
  productionDate?: string;
  smogDate?: string;
  operatorUserId?: string;
  location?: string;
  qty?: number;
}

/**
 * Resolves shift ('A' or 'B') for any Smog machine record:
 * - Shift A: 07:00 AM to 07:00 PM (07:00 - 18:59)
 * - Shift B: 07:00 PM to 07:00 AM next day (19:00 - 06:59)
 */
export function resolveRecordShift(record: LeakUnitRecord): 'A' | 'B' {
  if (record.shift === 'A' || record.shift === 'B') {
    return record.shift;
  }
  // Check createdAt ISO timestamp if available
  if (record.createdAt) {
    const d = new Date(record.createdAt);
    if (!isNaN(d.getTime())) {
      const h = d.getHours();
      const m = d.getMinutes();
      const mins = h * 60 + m;
      return (mins >= 420 && mins < 1140) ? 'A' : 'B';
    }
  }
  // Parse time string (supports 12-hour AM/PM and 24-hour)
  if (record.time) {
    const isPM = /pm/i.test(record.time);
    const isAM = /am/i.test(record.time);
    const cleanTime = record.time.replace(/[^0-9:]/g, '');
    const parts = cleanTime.split(':');
    if (parts.length >= 2) {
      let h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) {
        if (isPM && h < 12) h += 12;
        if (isAM && h === 12) h = 0;
        const mins = h * 60 + m;
        return (mins >= 420 && mins < 1140) ? 'A' : 'B';
      }
    }
  }
  return 'A';
}

export interface ShiftModelSummary {
  modelName: string;
  location: string;
  leakQty: number;
  suspectCount: number;
  actualCount: number;
  records: LeakUnitRecord[];
  allSerials: string[];
}

export function getShiftModelSummaries(records: LeakUnitRecord[]): ShiftModelSummary[] {
  const map = new Map<string, ShiftModelSummary>();

  for (const record of records) {
    let resolvedModel = 'SAC-1.5T-INV-3S';
    if (record.serialNumbers && record.serialNumbers.length > 0) {
      for (const sn of record.serialNumbers) {
        if (sn) {
          const found = findModelByPrefix(sn);
          if (found?.modelName) {
            resolvedModel = found.modelName;
            break;
          }
        }
      }
    }
    if (resolvedModel === 'SAC-1.5T-INV-3S' && 
        record.modelName && 
        record.modelName.trim() && 
        record.modelName !== 'General Location' && 
        record.modelName !== 'General Smog Unit' &&
        record.modelName !== record.location) {
      resolvedModel = record.modelName.trim();
    }

    let resolvedLocation = 'General Location';
    if (record.location && record.location.trim()) {
      resolvedLocation = record.location.trim();
    } else if (record.modelName && (
      record.modelName.toLowerCase().includes('line') ||
      record.modelName.toLowerCase().includes('bed') ||
      record.modelName.toLowerCase().includes('station') ||
      record.modelName.toLowerCase().includes('b')
    )) {
      resolvedLocation = record.modelName.trim();
    }

    const key = `${resolvedModel}:::${resolvedLocation}`;
    const qty = record.qty ?? record.suspectCount ?? (record.serialNumbers?.length || 1);
    const existing = map.get(key);

    if (existing) {
      existing.leakQty += qty;
      existing.suspectCount += record.suspectCount;
      existing.actualCount += record.actualCount;
      existing.records.push(record);
      if (record.serialNumbers) {
        existing.allSerials.push(...record.serialNumbers);
      }
    } else {
      map.set(key, {
        modelName: resolvedModel,
        location: resolvedLocation,
        leakQty: qty,
        suspectCount: record.suspectCount,
        actualCount: record.actualCount,
        records: [record],
        allSerials: [...(record.serialNumbers || [])]
      });
    }
  }

  return Array.from(map.values());
}

// Backward compatibility export alias
export type SmogUnit = LeakUnitRecord;

const STORAGE_KEY_SMOG_UNITS = 'llt_smog_leak_units_v3';

// Local Inter-Tab Broadcast Channel
const localSmogBus = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('llt_smog_bus') 
  : null;

export function getSmogUnits(): LeakUnitRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SMOG_UNITS);
    if (!raw) {
      const initial: LeakUnitRecord[] = [];
      localStorage.setItem(STORAGE_KEY_SMOG_UNITS, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    const cleaned = (Array.isArray(parsed) ? parsed : [])
      .filter((item: any) => {
        return item && item.id && item.id !== 'leak-101' && item.id !== 'leak-102';
      })
      .map((item: any) => ({
        ...item,
        passedSerials: item.passedSerials || [],
        suspectCount: item.suspectCount || (item.serialNumbers ? item.serialNumbers.length : 0),
        actualCount: item.actualCount || (item.passedSerials ? item.passedSerials.length : 0)
      }));

    if (Array.isArray(parsed) && cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY_SMOG_UNITS, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (err) {
    console.error('Failed to parse smog leak units', err);
    return [];
  }
}

export function saveSmogUnits(units: LeakUnitRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SMOG_UNITS, JSON.stringify(units));
  } catch (e) {
    console.warn(e);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smog-units-updated'));
  }
  if (localSmogBus) {
    try { localSmogBus.postMessage({ timestamp: Date.now() }); } catch {}
  }
  broadcastLabRealtimeEvent('smog_units_change', { timestamp: Date.now() });
}

export function subscribeSmogUnits(callback: (units: LeakUnitRecord[]) => void): () => void {
  const handler = () => {
    callback(getSmogUnits());
  };
  window.addEventListener('storage', handler);
  window.addEventListener('smog-units-updated', handler);
  if (localSmogBus) {
    localSmogBus.addEventListener('message', handler);
  }
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener('smog-units-updated', handler);
    if (localSmogBus) {
      localSmogBus.removeEventListener('message', handler);
    }
  };
}

interface SmogModuleProps {
  currentUser?: UserProfile;
  onNavigateToDashboard?: () => void;
  selectedShiftFilter?: 'all' | 'A' | 'B';
  onShiftFilterChange?: (shift: 'all' | 'A' | 'B') => void;
}

export const SmogModule: React.FC<SmogModuleProps> = ({ 
  currentUser,
  selectedShiftFilter = 'all',
  onShiftFilterChange,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [leakRecords, setLeakRecords] = useState<LeakUnitRecord[]>(getSmogUnits());
  const [searchQuery, setSearchQuery] = useState('');
  const [shiftFilter, setShiftFilter] = useState<'all' | 'A' | 'B'>(selectedShiftFilter);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [supabaseStatus, setSupabaseStatus] = useState<'connected' | 'syncing' | 'idle'>('idle');
  const [toastNotification, setToastNotification] = useState<string | null>(null);

  // Sync shiftFilter if selectedShiftFilter prop changes from Sidebar
  useEffect(() => {
    if (selectedShiftFilter && selectedShiftFilter !== shiftFilter) {
      setShiftFilter(selectedShiftFilter);
    }
  }, [selectedShiftFilter]);

  const handleSelectShiftFilter = (newShift: 'all' | 'A' | 'B') => {
    setShiftFilter(newShift);
    onShiftFilterChange?.(newShift);
  };

  // Add Leak Modal State
  const [isLeakModalOpen, setIsLeakModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSmogQtyModalOpen, setIsSmogQtyModalOpen] = useState(true);
  const [isWhatsAppReportOpen, setIsWhatsAppReportOpen] = useState(false);
  const [whatsAppReportParams, setWhatsAppReportParams] = useState<{
    date: string;
    shift: 'A' | 'B' | 'all';
    smogQty: number;
    prQty?: number;
    pendingQty?: number;
    inspectorName?: string;
    models?: any[];
    autoRedirectWhatsApp?: boolean;
    notes?: string;
  } | null>(null);
  const [smogQtyRecords, setSmogQtyRecords] = useState<SmogQtyRecord[]>(() => getSmogQtyRecords());
  const [extraMetrics, setExtraMetrics] = useState<SmogExtraMetrics>(() => getSmogExtraMetrics());

  // Listen for open-smog-form event from Menu/Sidebar
  useEffect(() => {
    const handleOpenForm = () => setIsSmogQtyModalOpen(true);
    window.addEventListener('open-smog-form', handleOpenForm);
    return () => window.removeEventListener('open-smog-form', handleOpenForm);
  }, []);

  // Fetch server records from Firebase whenever selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      fetchSmogQtyRecordsByDate(selectedDate).then((records) => {
        if (records && records.length > 0) {
          setSmogQtyRecords(getSmogQtyRecords());
        }
      });
    }
  }, [selectedDate]);

  // Subscribe to Smog Qty store changes
  useEffect(() => {
    const unsub = subscribeSmogQtyRecords((records) => {
      setSmogQtyRecords(records);
    });
    const unsubExtra = subscribeSmogExtraMetrics((metrics) => {
      setExtraMetrics(metrics);
    });
    return () => {
      unsub();
      unsubExtra();
    };
  }, []);
  
  // View Details Modal State
  const [selectedRecordForDetails, setSelectedRecordForDetails] = useState<LeakUnitRecord | null>(null);
  const [selectedShiftForDetails, setSelectedShiftForDetails] = useState<'A' | 'B' | null>(null);
  const [shiftDetailsSearch, setShiftDetailsSearch] = useState<string>('');

  // Form State
  const [smogPerson, setSmogPerson] = useState(currentUser?.name || 'Indrajit');
  const [shift, setShift] = useState<'A' | 'B'>('A');
  const [modelName, setModelName] = useState('SAC-1.5T-INV-3S');
  const [locationName, setLocationName] = useState('General Location');
  const [serialNumbers, setSerialNumbers] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync profile name when currentUser changes
  useEffect(() => {
    if (currentUser?.name) {
      setSmogPerson(currentUser.name);
    }
  }, [currentUser]);

  // Initial load, Firebase & Supabase sync, and Real-time listener
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setSupabaseStatus('syncing');
      try {
        // 1. Fetch from Firebase Firestore first
        const firestoreData = await fetchSmogLeakUnitsFromFirebase();
        if (firestoreData && firestoreData.length > 0) {
          if (isMounted) {
            setLeakRecords(firestoreData as LeakUnitRecord[]);
            try { localStorage.setItem(STORAGE_KEY_SMOG_UNITS, JSON.stringify(firestoreData)); } catch {}
            setSupabaseStatus('connected');
          }
          return;
        }

        // 2. Fallback to Supabase if Firestore has not yet been populated
        const remoteData = await fetchLeakUnitsFromSupabase();
        if (remoteData && remoteData.length > 0) {
          if (isMounted) {
            setLeakRecords(remoteData);
            try { localStorage.setItem(STORAGE_KEY_SMOG_UNITS, JSON.stringify(remoteData)); } catch {}
            setSupabaseStatus('connected');
          }
          // Seed records to Firebase Firestore
          for (const record of remoteData) {
            await syncSmogLeakUnitToFirebase(record);
          }
        } else {
          // 3. Sync existing local records to Firebase Firestore & Supabase
          const local = getSmogUnits();
          if (isMounted) {
            setLeakRecords(local);
          }
          for (const record of local) {
            await syncSmogLeakUnitToFirebase(record);
            await syncLeakUnitToSupabase(record);
          }
          if (isMounted) {
            setSupabaseStatus('connected');
          }
        }
      } catch (err) {
        console.warn('Smog leak units initial sync note:', err);
        if (isMounted) {
          setSupabaseStatus('connected');
        }
      }
    };

    loadData();

    // Attach real-time Firestore listener for multi-device sync
    const unsubFirebase = subscribeSmogLeakUnitsFromFirebase((firestoreRecords) => {
      if (isMounted && firestoreRecords && firestoreRecords.length > 0) {
        setLeakRecords(firestoreRecords as LeakUnitRecord[]);
        try { localStorage.setItem(STORAGE_KEY_SMOG_UNITS, JSON.stringify(firestoreRecords)); } catch {}
      }
    });

    // Listen to inter-tab changes
    if (localSmogBus) {
      localSmogBus.onmessage = () => {
        if (isMounted) {
          setLeakRecords(getSmogUnits());
        }
      };
    }

    // Subscribe to cross-device realtime broadcast
    const unsubscribe = subscribeToLabRealtimeEvents((event) => {
      if (event === 'smog_units_change') {
        loadData();
      }
    });

    // Periodic sync (every 8s)
    const interval = setInterval(() => {
      loadData();
    }, 8000);

    return () => {
      isMounted = false;
      unsubFirebase();
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Handlers for dynamic Serial Number textboxes (+)
  const handleAddSerialField = () => {
    setSerialNumbers(prev => [...prev, '']);
  };

  const handleRemoveSerialField = (index: number) => {
    if (serialNumbers.length <= 1) return;
    setSerialNumbers(prev => prev.filter((_, i) => i !== index));
  };

  const handleSerialChange = (index: number, value: string) => {
    setSerialNumbers(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  // Open Add Leak Modal handler
  const handleOpenLeakModal = () => {
    setSmogPerson(currentUser?.name || 'Indrajit');
    setShift('A');
    setModelName('');
    setSerialNumbers(['']);
    setNotes('');
    setIsLeakModalOpen(true);
  };

  // Save Leak Unit handler
  const handleSaveLeakUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName.trim()) {
      alert('Please enter Model Name.');
      return;
    }

    const validSerials = serialNumbers.map(s => s.trim()).filter(Boolean);
    if (validSerials.length === 0) {
      alert('Please enter at least one Serial Number (Sr. No.).');
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const monthStr = dateStr.substring(0, 7);
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newRecord: LeakUnitRecord = {
      id: `leak-${Date.now().toString().slice(-5)}`,
      smogPerson: smogPerson.trim() || currentUser?.name || 'Indrajit',
      shift,
      modelName: modelName.trim() || 'SAC-1.5T-INV-3S',
      serialNumbers: validSerials,
      passedSerials: [],
      suspectCount: validSerials.length,
      actualCount: 0,
      date: dateStr,
      month: monthStr,
      time: timeStr,
      createdAt: now.toISOString(),
      notes: notes.trim() || undefined,
      location: locationName.trim() || 'General Location',
      qty: validSerials.length
    };

    const updated = [newRecord, ...leakRecords];
    setLeakRecords(updated);
    saveSmogUnits(updated);

    // Sync to Firebase & Supabase
    setSupabaseStatus('syncing');
    await syncSmogLeakUnitToFirebase(newRecord);
    await syncLeakUnitToSupabase(newRecord);
    setSupabaseStatus('connected');

    setIsLeakModalOpen(false);
  };

  const handleDeleteRecord = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this Leak Unit record?')) {
      const updated = leakRecords.filter(r => r.id !== id);
      setLeakRecords(updated);
      saveSmogUnits(updated);
      if (selectedRecordForDetails?.id === id) {
        setSelectedRecordForDetails(null);
      }
      // Delete from Firebase & Supabase
      deleteSmogLeakUnitFromFirebase(id);
      deleteLeakUnitFromSupabase(id);
    }
  };

  // Toggle Pass/Unpass for a specific Serial Number
  const handleTogglePassSerial = async (recordId: string, srNo: string) => {
    const updatedRecords = leakRecords.map(record => {
      if (record.id !== recordId) return record;

      const isAlreadyPassed = record.passedSerials.includes(srNo);
      const newPassedSerials = isAlreadyPassed
        ? record.passedSerials.filter(s => s !== srNo)
        : [...record.passedSerials, srNo];

      const updatedRecord: LeakUnitRecord = {
        ...record,
        passedSerials: newPassedSerials,
        actualCount: newPassedSerials.length,
      };

      // Sync updated record to Firebase & Supabase
      syncSmogLeakUnitToFirebase(updatedRecord);
      syncLeakUnitToSupabase(updatedRecord);

      if (selectedRecordForDetails?.id === recordId) {
        setSelectedRecordForDetails(updatedRecord);
      }

      return updatedRecord;
    });

    setLeakRecords(updatedRecords);
    saveSmogUnits(updatedRecords);
  };

  const handleCopySerial = (serials: string[], recordId: string) => {
    navigator.clipboard.writeText(serials.join(', '));
    setCopiedId(recordId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Save units scanned from SmogBarcodeScannerModal
  const handleSaveScannedUnits = async (newRecords: LeakUnitRecord[]) => {
    const updated = [...newRecords, ...leakRecords];
    setLeakRecords(updated);
    saveSmogUnits(updated);

    // Auto-align view to the newly scanned units' Date & Shift
    if (newRecords.length > 0) {
      const savedDate = newRecords[0].productionDate || newRecords[0].date;
      const savedShift = resolveRecordShift(newRecords[0]);

      if (selectedDate && selectedDate !== savedDate) {
        setSelectedDate(savedDate);
      }
      if (shiftFilter !== 'all' && shiftFilter !== savedShift) {
        handleSelectShiftFilter(savedShift);
      }
    }

    // Sync each to Firebase & Supabase
    setSupabaseStatus('syncing');
    for (const rec of newRecords) {
      await syncSmogLeakUnitToFirebase(rec);
      await syncLeakUnitToSupabase(rec);
    }
    setSupabaseStatus('connected');

    const first = newRecords[0];
    setToastNotification(`✓ Added ${newRecords.length} Leak Unit(s) to Shift ${first?.shift || ''} [Date: ${first?.productionDate || first?.date || ''}]`);
    setTimeout(() => setToastNotification(null), 3500);
  };

  const handleDeleteShiftRecords = async (shiftToDelete: 'A' | 'B') => {
    const shiftRecords = filteredRecords.filter(r => resolveRecordShift(r) === shiftToDelete);
    if (shiftRecords.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete all ${shiftRecords.length} records scanned in Shift ${shiftToDelete}?`)) {
      return;
    }

    const idsToDelete = new Set(shiftRecords.map(r => r.id));
    const remaining = leakRecords.filter(r => !idsToDelete.has(r.id));
    setLeakRecords(remaining);
    saveSmogUnits(remaining);

    for (const rec of shiftRecords) {
      deleteSmogLeakUnitFromFirebase(rec.id).catch(console.warn);
      deleteLeakUnitFromSupabase(rec.id).catch(console.warn);
    }

    setToastNotification(`Deleted ${shiftRecords.length} Shift ${shiftToDelete} records`);
    setTimeout(() => setToastNotification(null), 3000);
  };

  const handleDeleteSingleMachineFromShift = async (recordId: string, serialNumber: string) => {
    const targetRecord = leakRecords.find(r => r.id === recordId);
    if (!targetRecord) return;

    if (!window.confirm(`Delete unit serial "${serialNumber}"?`)) return;

    let updatedRecords: LeakUnitRecord[];

    if (targetRecord.serialNumbers.length <= 1) {
      updatedRecords = leakRecords.filter(r => r.id !== recordId);
      deleteSmogLeakUnitFromFirebase(recordId).catch(console.warn);
      deleteLeakUnitFromSupabase(recordId).catch(console.warn);
    } else {
      const remainingSerials = targetRecord.serialNumbers.filter(s => s !== serialNumber);
      const remainingPassed = (targetRecord.passedSerials || []).filter(s => s !== serialNumber);
      const newSuspect = remainingSerials.length;
      const newActual = remainingPassed.length;

      const updatedRecord: LeakUnitRecord = {
        ...targetRecord,
        serialNumbers: remainingSerials,
        passedSerials: remainingPassed,
        suspectCount: newSuspect,
        actualCount: newActual,
        qty: newSuspect
      };

      updatedRecords = leakRecords.map(r => r.id === recordId ? updatedRecord : r);
      syncSmogLeakUnitToFirebase(updatedRecord).catch(console.warn);
      syncLeakUnitToSupabase(updatedRecord).catch(console.warn);
    }

    setLeakRecords(updatedRecords);
    saveSmogUnits(updatedRecords);
    setToastNotification(`Removed unit "${serialNumber}"`);
    setTimeout(() => setToastNotification(null), 2500);
  };

  const handleMarkAllPassForShift = async (shiftTarget: 'A' | 'B') => {
    const recordsInShift = filteredRecords.filter(r => resolveRecordShift(r) === shiftTarget);
    if (recordsInShift.length === 0) return;

    const shiftRecordIds = new Set(recordsInShift.map(r => r.id));
    const updatedRecords = leakRecords.map(r => {
      if (shiftRecordIds.has(r.id)) {
        return {
          ...r,
          passedSerials: [...r.serialNumbers],
          actualCount: r.serialNumbers.length
        };
      }
      return r;
    });

    setLeakRecords(updatedRecords);
    saveSmogUnits(updatedRecords);

    for (const r of updatedRecords.filter(rec => shiftRecordIds.has(rec.id))) {
      syncSmogLeakUnitToFirebase(r).catch(console.warn);
      syncLeakUnitToSupabase(r).catch(console.warn);
    }

    setToastNotification(`All units in Shift ${shiftTarget} marked as Passed`);
    setTimeout(() => setToastNotification(null), 3000);
  };

  // Filtered Records (includes Search, Shift, and Calendar Date)
  const filteredRecords = leakRecords.filter(record => {
    const matchSearch = searchQuery === '' ||
      record.modelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.smogPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.serialNumbers.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const recordShift = resolveRecordShift(record);
    const matchShift = shiftFilter === 'all' || recordShift === shiftFilter;

    const matchDate = !selectedDate || 
      record.date === selectedDate || 
      record.productionDate === selectedDate ||
      (Boolean(record.createdAt) && record.createdAt.startsWith(selectedDate));

    return matchSearch && matchShift && matchDate;
  });

  const todayCount = leakRecords.filter(r => r.date === todayStr || r.productionDate === todayStr).length;

  // Date-wise active records for Dashboard calculations
  const activeRecordsForMetrics = selectedDate
    ? leakRecords.filter(r => r.date === selectedDate || r.productionDate === selectedDate || (Boolean(r.createdAt) && r.createdAt.startsWith(selectedDate)))
    : leakRecords;

  const displayLeakCount = activeRecordsForMetrics.length;
  const displaySuspects = activeRecordsForMetrics.reduce((sum, r) => sum + r.suspectCount, 0);
  const displayActuals = activeRecordsForMetrics.reduce((sum, r) => sum + r.actualCount, 0);

  // Smog Qty, Pr. Qty, and Pending Qty aggregated from Form uploads for current selected Date & Shift
  const activeSmogQtyRecords = smogQtyRecords.filter(r => {
    if (selectedDate && r.date !== selectedDate) return false;
    if (shiftFilter !== 'all' && r.shift !== shiftFilter) return false;
    return true;
  });

  // Model Qty: "esme jo Model Qty hai uska Qty Model Wise Quantities me jitne rahte hai Model wahi rahege Qty esme bhi."
  // Count of models in Model Wise Quantities for the active date and shift
  const formModelsList = activeSmogQtyRecords.flatMap(r => r.models || []);
  const formModelCount = formModelsList.length;
  const modelQty = formModelCount > 0 
    ? formModelCount 
    : (activeRecordsForMetrics.length > 0 ? new Set(activeRecordsForMetrics.map(r => r.modelName?.trim())).size : 0);

  const currentSmogQty = activeSmogQtyRecords.reduce((sum, r) => sum + (Number(r.smogQty) || 0), 0);

  const currentPrQty = activeSmogQtyRecords.reduce((sum, r) => {
    if (r.prQty !== undefined && r.prQty > 0) return sum + Number(r.prQty);
    if (r.models && r.models.length > 0) {
      return sum + r.models.reduce((s, m) => s + (Number(m.prQty ?? m.qty) || 0), 0);
    }
    return sum + (extraMetrics.proQty || Number(r.smogQty) || 0);
  }, 0) || extraMetrics.proQty;

  const currentPendingQty = activeSmogQtyRecords.reduce((sum, r) => {
    if (r.pendingQty !== undefined) return sum + Number(r.pendingQty);
    return sum + Math.max(0, (r.prQty ?? 0) - (r.smogQty ?? 0));
  }, 0) || Math.max(0, currentPrQty - currentSmogQty);

  // Shift-wise counts for current active records (Date-filtered, auto-detected: Shift A = 7AM-7PM, Shift B = 7PM-7AM)
  const countShiftA = activeRecordsForMetrics.filter(r => resolveRecordShift(r) === 'A').length;
  const countShiftB = activeRecordsForMetrics.filter(r => resolveRecordShift(r) === 'B').length;

  const suspectsShiftA = activeRecordsForMetrics.filter(r => resolveRecordShift(r) === 'A').reduce((sum, r) => sum + r.suspectCount, 0);
  const suspectsShiftB = activeRecordsForMetrics.filter(r => resolveRecordShift(r) === 'B').reduce((sum, r) => sum + r.suspectCount, 0);

  const actualsShiftA = activeRecordsForMetrics.filter(r => resolveRecordShift(r) === 'A').reduce((sum, r) => sum + r.actualCount, 0);
  const actualsShiftB = activeRecordsForMetrics.filter(r => resolveRecordShift(r) === 'B').reduce((sum, r) => sum + r.actualCount, 0);

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-300">
      
      {/* TOAST NOTIFICATION */}
      {toastNotification && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-2xl bg-emerald-950 border border-emerald-500 text-emerald-300 text-xs font-mono font-bold shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastNotification}</span>
        </div>
      )}

      {/* COMPACT TOP BAR: Date Select, Back & Scanner Buttons */}
      <div className="py-2 px-2.5 sm:px-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl relative flex items-center justify-between gap-1.5 sm:gap-3">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-36 h-36 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* LEFT: Unique Calendar Date Picker */}
        <div className="flex items-center gap-1.5 shrink-0 z-10 min-w-0">
          <SmogUniqueCalendar
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(d)}
            records={leakRecords}
          />
        </div>

        {/* RIGHT: Back (returns to Model Wise Quantities) & Scanner Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 justify-end shrink-0 z-10">
          {/* Back Button: "Aur Form ko Back text kr do aur Es per Click krne per Wapas Model Wise Quantities es wale Screen per Aa jayega." */}
          <button
            type="button"
            onClick={() => setIsSmogQtyModalOpen(true)}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 shadow-md transform active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
            title="Back to Model Wise Quantities Screen"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-400 stroke-[2.5]" />
            <span className="tracking-wide">Back</span>
          </button>

          {/* Scanner Button */}
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl font-black text-xs text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-md shadow-cyan-950/60 transform active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
            title="Open ELT-style Barcode Scanner for Leak Units"
          >
            <ScanBarcode className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="tracking-wide">Scanner</span>
          </button>
        </div>
      </div>



      {/* SHIFT SELECTOR & SEARCH BAR */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/90 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider shrink-0">Shift:</label>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleSelectShiftFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                shiftFilter === 'all'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/50 font-black'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>All Shifts</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                shiftFilter === 'all' ? 'bg-slate-950/40 text-slate-950' : 'bg-slate-900 text-slate-300'
              }`}>
                {activeRecordsForMetrics.length}
              </span>
            </button>

            <button
              onClick={() => handleSelectShiftFilter('A')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                shiftFilter === 'A'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/50 font-black'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>Shift A</span>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">(7 AM – 7 PM)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                shiftFilter === 'A' ? 'bg-slate-950/40 text-slate-950' : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
              }`}>
                {countShiftA}
              </span>
            </button>

            <button
              onClick={() => handleSelectShiftFilter('B')}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                shiftFilter === 'B'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-950/50 font-black'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Shift B</span>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">(7 PM – 7 AM)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                shiftFilter === 'B' ? 'bg-slate-950/40 text-slate-950' : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}>
                {countShiftB}
              </span>
            </button>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Model, Sr. No., Person..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {/* ACTIVE SHIFT FILTER TAG */}
      {shiftFilter !== 'all' && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-900/70 border border-slate-800 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <span>Filtered to:</span>
            <span className={`px-2 py-0.5 rounded-md text-xs font-black ${
              shiftFilter === 'A' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
              'bg-amber-950 text-amber-300 border border-amber-800'
            }`}>
              Shift {shiftFilter} ({shiftFilter === 'A' ? '07:00 AM – 07:00 PM' : '07:00 PM – 07:00 AM Next Day'})
            </span>
            <span className="text-slate-400">
              {selectedDate ? `(${selectedDate})` : '(All Dates)'}
            </span>
          </div>
          <button
            onClick={() => handleSelectShiftFilter('all')}
            className="text-[11px] text-cyan-400 hover:underline cursor-pointer font-bold"
          >
            Show All Shifts ↩
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SHIFT A & SHIFT B CARDVIEWS CONTAINER */}
      {/* ========================================================================= */}
      {(() => {
        const shiftARecords = filteredRecords.filter(r => resolveRecordShift(r) === 'A');
        const shiftBRecords = filteredRecords.filter(r => resolveRecordShift(r) === 'B');

        const shiftASummaries = getShiftModelSummaries(shiftARecords);
        const shiftBSummaries = getShiftModelSummaries(shiftBRecords);

        const latestTimeA = shiftARecords[0]?.time;
        const latestProdA = shiftARecords[0]?.productionDate || shiftARecords[0]?.date || (selectedDate || todayStr);

        const latestTimeB = shiftBRecords[0]?.time;
        const latestProdB = shiftBRecords[0]?.productionDate || shiftBRecords[0]?.date || (selectedDate || todayStr);

        const totalSuspectA = shiftARecords.reduce((sum, r) => sum + r.suspectCount, 0);
        const totalActualA = shiftARecords.reduce((sum, r) => sum + r.actualCount, 0);

        const totalSuspectB = shiftBRecords.reduce((sum, r) => sum + r.suspectCount, 0);
        const totalActualB = shiftBRecords.reduce((sum, r) => sum + r.actualCount, 0);

        const shiftASmogRec = smogQtyRecords.find(r => r.date === (selectedDate || todayStr) && r.shift === 'A');
        const shiftAPr = shiftASmogRec?.prQty ?? shiftASmogRec?.smogQty ?? 0;
        const shiftASmog = shiftASmogRec?.smogQty ?? 0;
        const shiftAPending = shiftASmogRec?.pendingQty ?? Math.max(0, shiftAPr - shiftASmog);

        const shiftBSmogRec = smogQtyRecords.find(r => r.date === (selectedDate || todayStr) && r.shift === 'B');
        const shiftBPr = shiftBSmogRec?.prQty ?? shiftBSmogRec?.smogQty ?? 0;
        const shiftBSmog = shiftBSmogRec?.smogQty ?? 0;
        const shiftBPending = shiftBSmogRec?.pendingQty ?? Math.max(0, shiftBPr - shiftBSmog);

        const activeDateDisplay = selectedDate || todayStr;

        return (
          <div className="space-y-6">
            <div className={`grid gap-6 ${shiftFilter === 'all' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-2xl mx-auto'}`}>
              {/* ===================== SHIFT A CARDVIEW ===================== */}
              {(shiftFilter === 'all' || shiftFilter === 'A') && (
                <div 
                  id="cardview-shift-a"
                  className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl relative space-y-4 hover:border-cyan-500/50 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header Row: Shift Badge & Date/Time & Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-xl text-xs font-black font-mono border bg-cyan-950 text-cyan-300 border-cyan-800 shadow-sm shadow-cyan-950/40">
                          Shift A
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{activeDateDisplay} {latestTimeA ? `(${latestTimeA})` : '(07:00 AM – 07:00 PM)'}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setIsScannerOpen(true)}
                          className="p-1.5 rounded-lg text-cyan-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                          title="Scan machine in Shift A"
                        >
                          <ScanBarcode className="w-4 h-4" />
                        </button>
                        {shiftARecords.length > 0 && (
                          <button
                            onClick={() => handleDeleteShiftRecords('A')}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-all cursor-pointer"
                            title="Delete all Shift A records for this date"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 3-Column Table: Model Name | Location | Leak Qty */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-inner">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 gap-1 px-3.5 py-2 bg-slate-900/90 border-b border-slate-800 text-[10px] sm:text-[11px] font-mono font-bold text-slate-400">
                        <div className="col-span-5 text-left truncate">Model Name</div>
                        <div className="col-span-4 text-center truncate">Location</div>
                        <div className="col-span-3 text-right truncate">Leak Qty</div>
                      </div>

                      {/* Table Rows (All Machines Scanned in Shift A show underneath each other) */}
                      {shiftASummaries.length === 0 ? (
                        <div className="py-7 px-4 text-center space-y-2">
                          <Cloud className="w-6 h-6 text-slate-600 mx-auto" />
                          <p className="text-xs font-mono text-slate-400 font-bold">
                            No machines scanned yet today in Shift A.
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Scans between 07:00 AM and 07:00 PM will appear here automatically.
                          </p>
                          <button
                            onClick={() => setIsScannerOpen(true)}
                            className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-cyan-300 bg-cyan-950 border border-cyan-800 hover:bg-cyan-900 transition-all cursor-pointer"
                          >
                            <ScanBarcode className="w-3.5 h-3.5" />
                            <span>Scan Shift A Machine</span>
                          </button>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-900/60 max-h-56 overflow-y-auto">
                          {shiftASummaries.map((summary, idx) => (
                            <div
                              key={idx}
                              onClick={() => setSelectedShiftForDetails('A')}
                              className="grid grid-cols-12 gap-1 px-3.5 py-2.5 items-center bg-slate-950/60 hover:bg-slate-900/50 transition-colors cursor-pointer"
                              title="Click to view serial numbers"
                            >
                              <div className="col-span-5 text-left text-xs font-black text-white tracking-tight truncate flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                <span className="truncate">{summary.modelName}</span>
                              </div>
                              <div className="col-span-4 text-center text-xs font-bold text-slate-200 tracking-tight truncate flex items-center justify-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{summary.location}</span>
                              </div>
                              <div className="col-span-3 text-right text-xs font-mono font-black text-cyan-400">
                                {summary.leakQty}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Date Badge below Table */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10px] font-mono">
                      {latestProdA && (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                          Date: <strong className="text-white">{latestProdA}</strong>
                        </span>
                      )}
                      {shiftARecords.length > 0 && shiftARecords[0].smogPerson && (
                        <span className="px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 flex items-center gap-1">
                          <User className="w-3 h-3 text-cyan-400" />
                          <span className="truncate max-w-[120px]">{shiftARecords[0].smogPerson}</span>
                        </span>
                      )}
                    </div>

                    {/* SUSPECT & ACTUAL Metrics Display */}
                    <div className="grid grid-cols-2 gap-2 p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80">
                      <div className="text-center border-r border-slate-800">
                        <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider block font-bold">
                          Suspect
                        </span>
                        <span className="text-2xl font-black font-mono text-amber-300 mt-0.5 block">
                          {totalSuspectA}
                        </span>
                        <span className="text-[9px] text-slate-500 block font-mono">
                          Sr. No. in Form
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block font-bold">
                          Actual
                        </span>
                        <span className="text-2xl font-black font-mono text-emerald-400 mt-0.5 block">
                          {totalActualA}
                        </span>
                        <span className="text-[9px] text-slate-500 block font-mono">
                          Passed Sr. No.
                        </span>
                      </div>
                    </div>

                    {/* Shift A Pr. Qty (Red), Smog Qty (Yellow), Pending Qty Strip */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-center font-mono">
                      <div className="p-1">
                        <span className="text-[9px] text-rose-400 block font-bold uppercase">🔴 Pr. Qty</span>
                        <span className="text-sm font-black text-rose-300 mt-0.5 block">{shiftAPr}</span>
                      </div>
                      <div className="p-1 border-x border-slate-800">
                        <span className="text-[9px] text-amber-400 block font-bold uppercase">🟡 Smog Qty</span>
                        <span className="text-sm font-black text-amber-300 mt-0.5 block">{shiftASmog}</span>
                      </div>
                      <div className="p-1">
                        <span className="text-[9px] text-orange-400 block font-bold uppercase">Pending Qty</span>
                        <span className="text-sm font-black text-orange-300 mt-0.5 block">{shiftAPending}</span>
                      </div>
                    </div>
                  </div>

                  {/* View Details Button */}
                  <button
                    onClick={() => setSelectedShiftForDetails('A')}
                    className="w-full py-2.5 px-4 rounded-xl font-extrabold text-xs text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/80 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md mt-4"
                  >
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <span>View Details</span>
                  </button>
                </div>
              )}

              {/* ===================== SHIFT B CARDVIEW ===================== */}
              {(shiftFilter === 'all' || shiftFilter === 'B') && (
                <div 
                  id="cardview-shift-b"
                  className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl relative space-y-4 hover:border-amber-500/50 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header Row: Shift Badge & Date/Time & Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-xl text-xs font-black font-mono border bg-amber-950 text-amber-300 border-amber-800 shadow-sm shadow-amber-950/40">
                          Shift B
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{activeDateDisplay} {latestTimeB ? `(${latestTimeB})` : '(07:00 PM – 07:00 AM Next Day)'}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setIsScannerOpen(true)}
                          className="p-1.5 rounded-lg text-amber-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                          title="Scan machine in Shift B"
                        >
                          <ScanBarcode className="w-4 h-4" />
                        </button>
                        {shiftBRecords.length > 0 && (
                          <button
                            onClick={() => handleDeleteShiftRecords('B')}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-all cursor-pointer"
                            title="Delete all Shift B records for this date"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 3-Column Table: Model Name | Location | Leak Qty */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-inner">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 gap-1 px-3.5 py-2 bg-slate-900/90 border-b border-slate-800 text-[10px] sm:text-[11px] font-mono font-bold text-slate-400">
                        <div className="col-span-5 text-left truncate">Model Name</div>
                        <div className="col-span-4 text-center truncate">Location</div>
                        <div className="col-span-3 text-right truncate">Leak Qty</div>
                      </div>

                      {/* Table Rows (All Machines Scanned in Shift B show underneath each other) */}
                      {shiftBSummaries.length === 0 ? (
                        <div className="py-7 px-4 text-center space-y-2">
                          <Cloud className="w-6 h-6 text-slate-600 mx-auto" />
                          <p className="text-xs font-mono text-slate-400 font-bold">
                            No machines scanned yet today in Shift B.
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Scans between 07:00 PM and 07:00 AM will appear here automatically.
                          </p>
                          <button
                            onClick={() => setIsScannerOpen(true)}
                            className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-amber-300 bg-amber-950 border border-amber-800 hover:bg-amber-900 transition-all cursor-pointer"
                          >
                            <ScanBarcode className="w-3.5 h-3.5" />
                            <span>Scan Shift B Machine</span>
                          </button>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-900/60 max-h-56 overflow-y-auto">
                          {shiftBSummaries.map((summary, idx) => (
                            <div
                              key={idx}
                              onClick={() => setSelectedShiftForDetails('B')}
                              className="grid grid-cols-12 gap-1 px-3.5 py-2.5 items-center bg-slate-950/60 hover:bg-slate-900/50 transition-colors cursor-pointer"
                              title="Click to view serial numbers"
                            >
                              <div className="col-span-5 text-left text-xs font-black text-white tracking-tight truncate flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="truncate">{summary.modelName}</span>
                              </div>
                              <div className="col-span-4 text-center text-xs font-bold text-slate-200 tracking-tight truncate flex items-center justify-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{summary.location}</span>
                              </div>
                              <div className="col-span-3 text-right text-xs font-mono font-black text-amber-400">
                                {summary.leakQty}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Date Badge below Table */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10px] font-mono">
                      {latestProdB && (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                          Date: <strong className="text-white">{latestProdB}</strong>
                        </span>
                      )}
                      {shiftBRecords.length > 0 && shiftBRecords[0].smogPerson && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-300 flex items-center gap-1">
                          <User className="w-3 h-3 text-amber-400" />
                          <span className="truncate max-w-[120px]">{shiftBRecords[0].smogPerson}</span>
                        </span>
                      )}
                    </div>

                    {/* SUSPECT & ACTUAL Metrics Display */}
                    <div className="grid grid-cols-2 gap-2 p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80">
                      <div className="text-center border-r border-slate-800">
                        <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider block font-bold">
                          Suspect
                        </span>
                        <span className="text-2xl font-black font-mono text-amber-300 mt-0.5 block">
                          {totalSuspectB}
                        </span>
                        <span className="text-[9px] text-slate-500 block font-mono">
                          Sr. No. in Form
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block font-bold">
                          Actual
                        </span>
                        <span className="text-2xl font-black font-mono text-emerald-400 mt-0.5 block">
                          {totalActualB}
                        </span>
                        <span className="text-[9px] text-slate-500 block font-mono">
                          Passed Sr. No.
                        </span>
                      </div>
                    </div>

                    {/* Shift B Pr. Qty (Red), Smog Qty (Yellow), Pending Qty Strip */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-center font-mono">
                      <div className="p-1">
                        <span className="text-[9px] text-rose-400 block font-bold uppercase">🔴 Pr. Qty</span>
                        <span className="text-sm font-black text-rose-300 mt-0.5 block">{shiftBPr}</span>
                      </div>
                      <div className="p-1 border-x border-slate-800">
                        <span className="text-[9px] text-amber-400 block font-bold uppercase">🟡 Smog Qty</span>
                        <span className="text-sm font-black text-amber-300 mt-0.5 block">{shiftBSmog}</span>
                      </div>
                      <div className="p-1">
                        <span className="text-[9px] text-orange-400 block font-bold uppercase">Pending Qty</span>
                        <span className="text-sm font-black text-orange-300 mt-0.5 block">{shiftBPending}</span>
                      </div>
                    </div>
                  </div>

                  {/* View Details Button */}
                  <button
                    onClick={() => setSelectedShiftForDetails('B')}
                    className="w-full py-2.5 px-4 rounded-xl font-extrabold text-xs text-amber-300 bg-amber-950/80 hover:bg-amber-900 border border-amber-800/80 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md mt-4"
                  >
                    <Eye className="w-4 h-4 text-amber-400" />
                    <span>View Details</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* LEAK UNIT MODAL FORM (TRIGGERED BY "LEAK UNIT" BUTTON) */}
      {/* ========================================================================= */}
      {isLeakModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Title Bar */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-950 border border-cyan-800 text-cyan-400">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Add Leak Unit Entry</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Log new smog inspection record with shift and serial numbers.</p>
                </div>
              </div>
              <button
                onClick={() => setIsLeakModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLeakUnit} className="space-y-4 text-xs">
              {/* 1. SMOG PERSON (PROFILE AUTO-FILLED) */}
              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center justify-between">
                  <span>1. Smog Person *</span>
                  <span className="text-[10px] text-cyan-400 font-mono font-normal">Auto-filled from Profile</span>
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 absolute left-3 top-3 text-cyan-400" />
                  <input
                    type="text"
                    required
                    value={smogPerson}
                    onChange={(e) => setSmogPerson(e.target.value)}
                    placeholder="e.g. Indrajit"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* 2. SHIFT SELECTION (A, B) */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 flex items-center justify-between">
                  <span>2. Shift *</span>
                  <span className="text-[10px] text-slate-400 font-mono">Auto: A (7AM-7PM), B (7PM-7AM)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShift('A')}
                    className={`py-2.5 px-3 rounded-xl font-mono font-black text-xs transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer border ${
                      shift === 'A'
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-md shadow-cyan-950/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Shift A</span>
                      {shift === 'A' && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono font-normal">07:00 AM – 07:00 PM</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShift('B')}
                    className={`py-2.5 px-3 rounded-xl font-mono font-black text-xs transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer border ${
                      shift === 'B'
                        ? 'bg-amber-950 text-amber-300 border-amber-500 shadow-md shadow-amber-950/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Shift B</span>
                      {shift === 'B' && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono font-normal">07:00 PM – 07:00 AM</span>
                  </button>
                </div>
              </div>

              {/* 3. MODEL NAME & LOCATION NAME (2-Column Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    3. Model Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="e.g. SAC-1.5T-INV-3S"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    4. Location Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="e.g. Line 1, Test Bed 3"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* 5. DYNAMIC SERIAL NUMBER (SR. NO.) LIST WITH (+) BUTTON */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-300 font-bold">
                    5. Serial Numbers (Sr. No.) *
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSerialField}
                    className="flex items-center gap-1 text-[11px] font-mono font-bold text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 px-2.5 py-1 rounded-lg cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Sr. No.</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {serialNumbers.map((sr, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500 w-5">#{index + 1}</span>
                      <input
                        type="text"
                        required
                        value={sr}
                        onChange={(e) => handleSerialChange(index, e.target.value)}
                        placeholder={`e.g. A-2026-00${index + 1}`}
                        className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-400"
                      />
                      {serialNumbers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSerialField(index)}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                          title="Remove this Serial Number"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Remarks / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional inspection details..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Form Actions: Save Button */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsLeakModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl font-black text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-md shadow-cyan-950/60 cursor-pointer"
                >
                  Save Leak Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW DETAILS MODAL */}
      {/* ========================================================================= */}
      {selectedRecordForDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Title */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-950 border border-cyan-800 text-cyan-400">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-white">
                      {selectedRecordForDetails.modelName && 
                       selectedRecordForDetails.modelName !== 'General Location' && 
                       selectedRecordForDetails.modelName !== 'General Smog Unit'
                        ? selectedRecordForDetails.modelName
                        : 'SAC-1.5T-INV-3S'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-cyan-950 border border-cyan-800 text-[10px] font-mono font-bold text-cyan-300">
                      Leak Qty: {selectedRecordForDetails.qty ?? selectedRecordForDetails.suspectCount ?? (selectedRecordForDetails.serialNumbers?.length || 1)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-mono mt-0.5 flex items-center gap-2">
                    <span>Loc: <strong className="text-white">{selectedRecordForDetails.location || 'General Location'}</strong></span>
                    <span className="text-slate-500">•</span>
                    <span>Shift {selectedRecordForDetails.shift}</span>
                  </p>
                  {(selectedRecordForDetails.productionDate || selectedRecordForDetails.date) && (
                    <div className="flex items-center gap-2 pt-1 text-[10px] font-mono text-slate-400">
                      <span>Date: <strong className="text-white">{selectedRecordForDetails.productionDate || selectedRecordForDetails.date}</strong></span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedRecordForDetails(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Suspect vs Actual Summary Box */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-amber-400 uppercase font-bold block">Suspect Count</span>
                  <span className="text-2xl font-black font-mono text-amber-300 mt-0.5 block">
                    {selectedRecordForDetails.suspectCount}
                  </span>
                </div>
                <AlertCircle className="w-6 h-6 text-amber-400 opacity-80" />
              </div>

              <div className="flex items-center justify-between pl-3 border-l border-slate-800">
                <div>
                  <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold block">Actual (Passed)</span>
                  <span className="text-2xl font-black font-mono text-emerald-400 mt-0.5 block">
                    {selectedRecordForDetails.actualCount}
                  </span>
                </div>
                <CheckCircle className="w-6 h-6 text-emerald-400 opacity-80" />
              </div>
            </div>

            {/* All Model Sr. No. List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Serial Numbers (Sr. No.) Pass Verification
                </label>
                <button
                  onClick={() => handleCopySerial(selectedRecordForDetails.serialNumbers, selectedRecordForDetails.id)}
                  className="text-[11px] font-mono text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedId === selectedRecordForDetails.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied All!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Serials</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedRecordForDetails.serialNumbers.map((srNo, idx) => {
                  const isPassed = selectedRecordForDetails.passedSerials?.includes(srNo);
                  const matchedModel = findModelByPrefix(srNo)?.modelName || 
                    (selectedRecordForDetails.modelName && 
                     selectedRecordForDetails.modelName !== 'General Location' && 
                     selectedRecordForDetails.modelName !== 'General Smog Unit'
                      ? selectedRecordForDetails.modelName
                      : 'SAC-1.5T-INV-3S');

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isPassed
                          ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="text-xs font-mono font-bold text-slate-500 mt-0.5">#{idx + 1}</span>
                        <div className="min-w-0">
                          {/* Model Name (Above Sr. No. as requested) */}
                          <div className="text-[11px] font-mono font-extrabold text-cyan-400 truncate flex items-center gap-1">
                            <Layers className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span>{matchedModel}</span>
                          </div>
                          {/* Sr. No. (Where the orange line was drawn in photo) */}
                          <div className="text-sm font-mono font-extrabold text-white flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                              Sr. No:
                            </span>
                            <span className="text-slate-100">{srNo}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleTogglePassSerial(selectedRecordForDetails.id, srNo)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0 ${
                          isPassed
                            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-950/60'
                            : 'bg-slate-800 text-slate-300 hover:bg-emerald-900 hover:text-emerald-300 border border-slate-700'
                        }`}
                      >
                        {isPassed ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-slate-950" />
                            <span>Passed</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 text-slate-400" />
                            <span>Mark Pass</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedRecordForDetails.notes && (
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
                <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Remarks / Notes</span>
                <p className="text-slate-300 italic">{selectedRecordForDetails.notes}</p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end border-t border-slate-800">
              <button
                onClick={() => setSelectedRecordForDetails(null)}
                className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHIFT A / SHIFT B COMPREHENSIVE DETAILS MODAL */}
      {selectedShiftForDetails && (() => {
        const targetShift = selectedShiftForDetails;
        const shiftRecords = filteredRecords.filter(r => resolveRecordShift(r) === targetShift);
        const shiftTotalSuspect = shiftRecords.reduce((s, r) => s + r.suspectCount, 0);
        const shiftTotalPassed = shiftRecords.reduce((s, r) => s + r.actualCount, 0);

        // Flatten all scanned units with their record context
        interface FlattenedUnit {
          recordId: string;
          serialNumber: string;
          modelName: string;
          location: string;
          time: string;
          date: string;
          isPassed: boolean;
        }

        const flattenedUnits: FlattenedUnit[] = [];
        for (const rec of shiftRecords) {
          const recModel = (() => {
            if (rec.modelName && 
                rec.modelName.trim() && 
                rec.modelName !== 'General Location' && 
                rec.modelName !== 'General Smog Unit') {
              return rec.modelName;
            }
            return 'SAC-1.5T-INV-3S';
          })();

          const recLoc = rec.location || 'General Location';

          for (const sn of (rec.serialNumbers || [])) {
            const isPassed = (rec.passedSerials || []).includes(sn);
            flattenedUnits.push({
              recordId: rec.id,
              serialNumber: sn,
              modelName: recModel,
              location: recLoc,
              time: rec.time,
              date: rec.date,
              isPassed,
            });
          }
        }

        const filteredUnits = flattenedUnits.filter(u => {
          if (!shiftDetailsSearch) return true;
          const q = shiftDetailsSearch.toLowerCase();
          return u.serialNumber.toLowerCase().includes(q) || 
                 u.modelName.toLowerCase().includes(q) || 
                 u.location.toLowerCase().includes(q);
        });

        const allSerialsList = flattenedUnits.map(u => u.serialNumber);

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 space-y-5 shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-2xl border ${
                    targetShift === 'A'
                      ? 'bg-cyan-950 border-cyan-800 text-cyan-400'
                      : 'bg-amber-950 border-amber-800 text-amber-400'
                  }`}>
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-white">
                        Shift {targetShift} Machine Details
                      </h3>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                        targetShift === 'A'
                          ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                          : 'bg-amber-950 text-amber-300 border-amber-800'
                      }`}>
                        {targetShift === 'A' ? '07:00 AM – 07:00 PM' : '07:00 PM – 07:00 AM (Next Day)'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Date: <strong className="text-white">{selectedDate || todayStr}</strong> • Total Scans: <strong className="text-white">{flattenedUnits.length}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedShiftForDetails(null);
                    setShiftDetailsSearch('');
                  }}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Suspect vs Actual Summary Box */}
              <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-center border-r border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Total Units</span>
                  <span className="text-xl font-black font-mono text-white mt-0.5 block">
                    {flattenedUnits.length}
                  </span>
                </div>
                <div className="text-center border-r border-slate-800">
                  <span className="text-[10px] font-mono text-amber-400 uppercase font-bold block">Suspect</span>
                  <span className="text-xl font-black font-mono text-amber-300 mt-0.5 block">
                    {shiftTotalSuspect}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold block">Passed</span>
                  <span className="text-xl font-black font-mono text-emerald-400 mt-0.5 block">
                    {shiftTotalPassed}
                  </span>
                </div>
              </div>

              {/* Search and Action Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={shiftDetailsSearch}
                    onChange={(e) => setShiftDetailsSearch(e.target.value)}
                    placeholder="Search by Serial No. or Model..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMarkAllPassForShift(targetShift)}
                    className="px-3 py-2 rounded-xl text-xs font-mono font-bold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/80 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark All Passed</span>
                  </button>
                  <button
                    onClick={() => handleCopySerial(allSerialsList, `shift-${targetShift}`)}
                    className="px-3 py-2 rounded-xl text-xs font-mono font-bold text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/80 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy All</span>
                  </button>
                </div>
              </div>

              {/* Serial Units List */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filteredUnits.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950 rounded-2xl border border-dashed border-slate-800 space-y-1">
                    <p className="text-xs font-bold text-slate-400">No matching machine serial numbers found.</p>
                    <p className="text-[11px] text-slate-500 font-mono">Try clearing the search query or scan new machines.</p>
                  </div>
                ) : (
                  filteredUnits.map((unit, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-all"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black border ${
                            targetShift === 'A'
                              ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                              : 'bg-amber-950 text-amber-300 border-amber-800'
                          }`}>
                            {unit.modelName}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-[10px] font-mono text-slate-300 border border-slate-800 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {unit.location}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {unit.time}
                          </span>
                        </div>
                        <p className="text-sm font-mono font-black text-white tracking-wide truncate">
                          {unit.serialNumber}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => handleTogglePassSerial(unit.recordId, unit.serialNumber)}
                          className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
                            unit.isPassed
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700 hover:bg-emerald-900'
                              : 'bg-amber-950 text-amber-300 border-amber-700 hover:bg-amber-900'
                          }`}
                        >
                          {unit.isPassed ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Passed</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Mark Pass</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteSingleMachineFromShift(unit.recordId, unit.serialNumber)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition-all cursor-pointer"
                          title="Delete unit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Close Button */}
              <div className="border-t border-slate-800 pt-3 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedShiftForDetails(null);
                    setShiftDetailsSearch('');
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SMOG BARCODE SCANNER MODAL */}
      <SmogBarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSaveLeakUnits={handleSaveScannedUnits}
        defaultDate={selectedDate || new Date().toISOString().split('T')[0]}
        defaultShift={shiftFilter !== 'all' ? (shiftFilter as 'A' | 'B') : 'A'}
      />

      {/* SMOG QTY ENTRY POPUP MODAL */}
      <SmogQtyFormModal
        isOpen={isSmogQtyModalOpen}
        onClose={() => setIsSmogQtyModalOpen(false)}
        onOpenSuspectManagement={() => setIsSmogQtyModalOpen(false)}
        defaultDate={selectedDate || new Date().toISOString().split('T')[0]}
        defaultShift={shiftFilter !== 'all' ? shiftFilter : 'A'}
        onDateChange={(d) => setSelectedDate(d)}
        onShiftChange={(s) => handleSelectShiftFilter(s)}
        onSaved={(saved) => {
          setToastNotification(`Smog Qty (${saved.smogQty}) successfully uploaded for ${saved.date} (Shift ${saved.shift})`);
          setTimeout(() => setToastNotification(null), 4000);
        }}
        onOpenWhatsAppShare={(data) => {
          setWhatsAppReportParams({
            date: data.date,
            shift: data.shift,
            smogQty: data.smogQty,
            prQty: data.prQty,
            pendingQty: data.pendingQty,
            inspectorName: data.inspectorName,
            models: data.models,
            autoRedirectWhatsApp: data.autoRedirectWhatsApp,
            notes: data.notes
          });
          setIsWhatsAppReportOpen(true);
        }}
      />

      {/* SMOG WHATSAPP REPORT MODAL */}
      {isWhatsAppReportOpen && (
        <SmogWhatsAppReportModal
          isOpen={isWhatsAppReportOpen}
          onClose={() => setIsWhatsAppReportOpen(false)}
          productionDate={(() => {
            try {
              return localStorage.getItem('smog_scanner_production_date') || (whatsAppReportParams?.date || selectedDate || new Date().toISOString().split('T')[0]);
            } catch {
              return whatsAppReportParams?.date || selectedDate || new Date().toISOString().split('T')[0];
            }
          })()}
          shift={whatsAppReportParams?.shift || (shiftFilter === 'all' ? 'A' : shiftFilter)}
          smogQty={whatsAppReportParams?.smogQty ?? (currentSmogQty || 0)}
          prQty={whatsAppReportParams?.prQty ?? currentPrQty}
          pendingQty={whatsAppReportParams?.pendingQty ?? currentPendingQty}
          records={leakRecords}
          inspectorName={whatsAppReportParams?.inspectorName || smogPerson || currentUser?.name || 'Indrajit'}
          models={whatsAppReportParams?.models}
          autoRedirectWhatsApp={whatsAppReportParams?.autoRedirectWhatsApp}
          notes={whatsAppReportParams?.notes || (() => {
            try {
              const matched = smogQtyRecords.find(r => 
                r.date === (whatsAppReportParams?.date || selectedDate) && 
                (whatsAppReportParams?.shift === 'all' || r.shift === whatsAppReportParams?.shift)
              );
              return matched?.notes;
            } catch {
              return undefined;
            }
          })()}
        />
      )}
    </div>
  );
};
