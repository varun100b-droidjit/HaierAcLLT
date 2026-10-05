// Smog Qty Entry Store & Synchronization Service with Firebase Firestore Persistence & Server Backup
import { db, collection, doc, setDoc, deleteDoc, getDoc, getDocs, onSnapshot, query, where } from './firebase';
import { cleanForFirestore } from './firestoreSanitizer';
import { saveSmogExtraMetrics } from './smogExtraStore';

export interface SmogModelQtyItem {
  modelName: string;
  prQty?: number;       // Production Qty (extracted from Photo or manual)
  smogQty?: number;     // Smog Qty (added via bottom input box after tapping model)
  pendingQty?: number;  // (prQty - smogQty)
  qty?: number;         // Backward compatibility fallback
}

export interface SmogQtyRecord {
  id: string;
  date: string;         // YYYY-MM-DD
  shift: 'A' | 'B';
  smogQty: number;      // Total Smog Qty
  prQty?: number;       // Total Production Qty (from photo)
  pendingQty?: number;  // Total Pending Qty (prQty - smogQty)
  models?: SmogModelQtyItem[];
  notes?: string;
  isClosed?: boolean;
  createdAt: string;
  updatedAt?: string;
}

const STORAGE_KEY_SMOG_QTY = 'llt_smog_qty_entries_v1';

export function getSmogQtyDocId(date: string, shift: 'A' | 'B' | string): string {
  const normShift: 'A' | 'B' = (shift === 'B' || shift === 'C') ? 'B' : 'A';
  const cleanDate = date ? date.trim() : new Date().toISOString().split('T')[0];
  return `sq_${cleanDate}_${normShift}`;
}

const localBus = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('llt_smog_qty_bus')
  : null;

let memoryRecords: SmogQtyRecord[] | null = null;
const listeners = new Set<(records: SmogQtyRecord[]) => void>();

function notifyListeners(records: SmogQtyRecord[]) {
  listeners.forEach((listener) => {
    try {
      listener(records);
    } catch (err) {
      console.error('Error notifying smog qty listener:', err);
    }
  });
}

/**
 * Smart merge function between local and remote records.
 * CRITICAL RULE: Local models must NEVER be wiped out by an empty or older remote record.
 */
function mergeSmogRecords(localList: SmogQtyRecord[], remoteList: SmogQtyRecord[]): SmogQtyRecord[] {
  const recordMap = new Map<string, SmogQtyRecord>();

  // 1. Seed with local records
  for (const loc of localList) {
    if (!loc || !loc.date) continue;
    const normShift: 'A' | 'B' = ((loc.shift as string) === 'B' || (loc.shift as string) === 'C') ? 'B' : 'A';
    const key = `${loc.date}_${normShift}`;
    recordMap.set(key, { ...loc, shift: normShift });
  }

  // 2. Merge with remote records
  for (const rem of remoteList) {
    if (!rem || !rem.date) continue;
    const normShift: 'A' | 'B' = ((rem.shift as string) === 'B' || (rem.shift as string) === 'C') ? 'B' : 'A';
    const key = `${rem.date}_${normShift}`;
    const loc = recordMap.get(key);

    if (!loc) {
      recordMap.set(key, { ...rem, shift: normShift, id: rem.id || getSmogQtyDocId(rem.date, normShift) });
    } else {
      const locHasModels = Array.isArray(loc.models) && loc.models.length > 0;
      const remHasModels = Array.isArray(rem.models) && rem.models.length > 0;

      // Choose models: never downgrade from existing models to empty models
      let finalModels = loc.models || [];
      if (remHasModels && !locHasModels) {
        finalModels = rem.models || [];
      } else if (remHasModels && locHasModels) {
        // Both have models, prefer the one with more items or newer timestamp
        const locTime = new Date(loc.updatedAt || loc.createdAt || 0).getTime();
        const remTime = new Date(rem.updatedAt || rem.createdAt || 0).getTime();
        finalModels = (remTime > locTime && rem.models!.length >= loc.models!.length)
          ? rem.models!
          : loc.models!;
      }

      const totalPr = finalModels.reduce((s, m) => s + (Number(m.prQty ?? m.qty) || 0), 0);
      const totalSmog = loc.smogQty !== undefined ? loc.smogQty : (rem.smogQty || 0);
      const totalPending = Math.max(0, totalPr - totalSmog);

      const merged: SmogQtyRecord = {
        ...rem,
        ...loc,
        id: getSmogQtyDocId(loc.date, normShift),
        date: loc.date,
        shift: normShift,
        models: finalModels,
        prQty: totalPr > 0 ? totalPr : (loc.prQty || rem.prQty || 0),
        smogQty: totalSmog,
        pendingQty: totalPending,
        notes: loc.notes || rem.notes || '',
        isClosed: loc.isClosed || rem.isClosed || false,
        createdAt: loc.createdAt || rem.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      recordMap.set(key, merged);

      // If local had models that remote didn't, schedule background sync to cloud
      if (locHasModels && !remHasModels) {
        syncSmogQtyToFirestore(merged).catch(() => {});
      }
    }
  }

  const result = Array.from(recordMap.values());
  result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return result;
}

/* =========================================================================
   FIREBASE FIRESTORE & SERVER BACKUP SYNC HELPERS
   ========================================================================= */

export async function syncSmogQtyToFirestore(record: SmogQtyRecord): Promise<void> {
  if (!record || !record.date) return;
  const canonicalId = getSmogQtyDocId(record.date, record.shift);
  const normalizedShift: 'A' | 'B' = ((record.shift as string) === 'B' || (record.shift as string) === 'C') ? 'B' : 'A';

  const recordToSave: SmogQtyRecord = {
    ...record,
    id: canonicalId,
    shift: normalizedShift,
    updatedAt: new Date().toISOString()
  };

  // 1. Direct Persist to Firebase Firestore
  if (db) {
    try {
      const docRef = doc(db, 'smog_qty_records', canonicalId);
      const cleaned = cleanForFirestore(recordToSave);
      await setDoc(docRef, cleaned, { merge: true });
      console.log('[Firebase] Smog Qty record saved to Firestore:', canonicalId);
    } catch (err) {
      console.warn('[Firebase] Smog Qty record save note:', err);
    }
  }

  // 2. Server-side persistence fallback & backup
  try {
    await fetch('/api/smog/sync-qty-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recordToSave)
    }).catch(() => {});
  } catch {}
}

/**
 * Directly queries Firestore and server backup for a specific date and shift record.
 * Ensures complete models and quantities are loaded from the cloud.
 */
export async function fetchSmogQtyRecordByDateAndShift(
  date: string,
  shift: 'A' | 'B',
  forceServer: boolean = false
): Promise<SmogQtyRecord | null> {
  const normShift: 'A' | 'B' = (shift === 'B') ? 'B' : 'A';
  const canonicalId = getSmogQtyDocId(date, normShift);

  const current = getSmogQtyRecords();
  const found = current.find((r) => (r.id === canonicalId) || (r.date === date && r.shift === normShift));
  if (found && !forceServer && found.models && found.models.length > 0) {
    return found;
  }

  let serverDoc: SmogQtyRecord | null = null;

  // 1. Try direct doc lookup in Firestore by canonicalId
  if (db) {
    try {
      const docRef = doc(db, 'smog_qty_records', canonicalId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        serverDoc = snap.data() as SmogQtyRecord;
      }
    } catch (err) {
      console.warn('[Firebase] Direct doc lookup note:', err);
    }

    // Fallback: Query by date and shift
    if (!serverDoc) {
      try {
        const colRef = collection(db, 'smog_qty_records');
        const q = query(colRef, where('date', '==', date), where('shift', '==', normShift));
        const snap = await getDocs(q);
        if (!snap.empty) {
          serverDoc = snap.docs[0].data() as SmogQtyRecord;
        }
      } catch (err) {
        console.warn('[Firebase] Query smog qty record note:', err);
      }
    }
  }

  // 2. Fallback to Server Backup
  if (!serverDoc) {
    try {
      const resp = await fetch('/api/smog/qty-records');
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && Array.isArray(data.records)) {
          const matched = data.records.find((r: any) => r.date === date && r.shift === normShift);
          if (matched) {
            serverDoc = matched;
          }
        }
      }
    } catch {}
  }

  if (serverDoc) {
    // Smart merge so we never lose models
    const merged = mergeSmogRecords(current, [serverDoc]);
    memoryRecords = merged;
    try { localStorage.setItem(STORAGE_KEY_SMOG_QTY, JSON.stringify(merged)); } catch {}
    notifyListeners(merged);
    const updatedFound = merged.find(r => r.date === date && r.shift === normShift);
    return updatedFound || serverDoc;
  }

  return found || null;
}

/**
 * Queries Firestore for all Smog Qty records for a specific date (both Shift A and B).
 */
export async function fetchSmogQtyRecordsByDate(date: string): Promise<SmogQtyRecord[]> {
  const current = getSmogQtyRecords();
  if (!date) return current;

  let remoteRecords: SmogQtyRecord[] = [];

  if (db) {
    try {
      const colRef = collection(db, 'smog_qty_records');
      const q = query(colRef, where('date', '==', date));
      const snap = await getDocs(q);
      if (!snap.empty) {
        snap.forEach((d: any) => {
          const data = d.data() as SmogQtyRecord;
          if (data && data.date) {
            remoteRecords.push(data);
          }
        });
      }
    } catch (err) {
      console.warn('[Firebase] fetchSmogQtyRecordsByDate note:', err);
    }
  }

  // Try server backup if empty
  if (remoteRecords.length === 0) {
    try {
      const resp = await fetch('/api/smog/qty-records');
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && Array.isArray(data.records)) {
          remoteRecords = data.records.filter((r: any) => r.date === date);
        }
      }
    } catch {}
  }

  if (remoteRecords.length > 0) {
    const merged = mergeSmogRecords(current, remoteRecords);
    memoryRecords = merged;
    try { localStorage.setItem(STORAGE_KEY_SMOG_QTY, JSON.stringify(merged)); } catch {}
    notifyListeners(merged);
    return merged.filter(r => r.date === date);
  }

  return current.filter((r) => r.date === date);
}

export async function deleteSmogQtyFromFirestore(id: string): Promise<void> {
  if (!db || !id) return;
  try {
    const docRef = doc(db, 'smog_qty_records', id);
    await deleteDoc(docRef);
    console.log('[Firebase] Smog Qty record deleted:', id);
  } catch (err) {
    console.warn('[Firebase] Smog Qty record delete note:', err);
  }
}

export async function fetchSmogQtyFromFirestore(): Promise<SmogQtyRecord[] | null> {
  let list: SmogQtyRecord[] = [];
  if (db) {
    try {
      const colRef = collection(db, 'smog_qty_records');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        snap.forEach((d: any) => {
          const data = d.data() as SmogQtyRecord;
          if (data && data.date) {
            list.push(data);
          }
        });
      }
    } catch (err) {
      console.warn('[Firebase] Smog Qty records fetch note:', err);
    }
  }

  // Server backup check
  try {
    const resp = await fetch('/api/smog/qty-records');
    if (resp.ok) {
      const data = await resp.json();
      if (data.success && Array.isArray(data.records) && data.records.length > 0) {
        list = mergeSmogRecords(list, data.records);
      }
    }
  } catch {}

  if (list.length === 0) return null;
  list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return list;
}

// Attach Real-Time Firestore listener for cross-device live updates
if (db) {
  try {
    const colRef = collection(db, 'smog_qty_records');
    onSnapshot(colRef, (snap: any) => {
      if (snap) {
        const remoteList: SmogQtyRecord[] = [];
        snap.forEach((d: any) => {
          const data = d.data() as SmogQtyRecord;
          if (data && data.date) {
            remoteList.push(data);
          }
        });
        if (remoteList.length > 0) {
          const currentLocal = getSmogQtyRecords();
          const merged = mergeSmogRecords(currentLocal, remoteList);
          memoryRecords = merged;
          try { localStorage.setItem(STORAGE_KEY_SMOG_QTY, JSON.stringify(merged)); } catch {}
          notifyListeners(merged);
        }
      }
    }, (err: any) => {
      console.warn('[Firebase] Smog Qty real-time listener note:', err);
    });
  } catch (err) {
    console.warn('[Firebase] Could not attach Smog Qty listener:', err);
  }
}

// Initial sync with Firebase Firestore on boot
async function initSmogQtyFirestoreSync() {
  try {
    const remote = await fetchSmogQtyFromFirestore();
    const local = getSmogQtyRecords();
    if (remote && remote.length > 0) {
      const merged = mergeSmogRecords(local, remote);
      memoryRecords = merged;
      try { localStorage.setItem(STORAGE_KEY_SMOG_QTY, JSON.stringify(merged)); } catch {}
      notifyListeners(merged);
    } else if (local && local.length > 0) {
      // If Firestore is currently empty, push existing local records to Firestore
      for (const rec of local) {
        await syncSmogQtyToFirestore(rec);
      }
    }
  } catch (err) {
    console.warn('[Firebase] Smog Qty initial sync note:', err);
  }
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    initSmogQtyFirestoreSync();
  }, 100);
}

export function getSmogQtyRecords(): SmogQtyRecord[] {
  if (memoryRecords) {
    return memoryRecords;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SMOG_QTY);
    if (!raw) {
      const today = new Date().toISOString().split('T')[0];
      const initial: SmogQtyRecord[] = [
        {
          id: getSmogQtyDocId(today, 'A'),
          date: today,
          shift: 'A',
          smogQty: 0,
          prQty: 0,
          pendingQty: 0,
          models: [],
          notes: '',
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem(STORAGE_KEY_SMOG_QTY, JSON.stringify(initial));
      memoryRecords = initial;
      return initial;
    }
    const parsed = JSON.parse(raw);
    memoryRecords = Array.isArray(parsed) ? parsed : [];
    return memoryRecords;
  } catch (err) {
    console.error('Error loading smog qty records from localStorage:', err);
    memoryRecords = [];
    return [];
  }
}

export function saveSmogQtyRecord(data: {
  date: string;
  shift: 'A' | 'B' | string;
  smogQty: number;
  prQty?: number;
  pendingQty?: number;
  models?: SmogModelQtyItem[];
  notes?: string;
  isClosed?: boolean;
}): SmogQtyRecord {
  const current = getSmogQtyRecords();
  const today = new Date().toISOString().split('T')[0];
  const targetDate = data.date ? data.date.trim() : today;
  const normalizedShift: 'A' | 'B' = (data.shift === 'B' || data.shift === 'C') ? 'B' : 'A';
  const canonicalId = getSmogQtyDocId(targetDate, normalizedShift);

  // Calculate prQty and pendingQty from models if not explicitly provided
  let calculatedPrQty = data.prQty;
  if (calculatedPrQty === undefined && data.models && data.models.length > 0) {
    calculatedPrQty = data.models.reduce((sum, m) => sum + (Number(m.prQty ?? m.qty) || 0), 0);
  }
  const finalPrQty = calculatedPrQty !== undefined ? calculatedPrQty : data.smogQty;
  const finalSmogQty = Number(data.smogQty) || 0;
  const finalPendingQty = data.pendingQty !== undefined 
    ? Number(data.pendingQty) 
    : Math.max(0, finalPrQty - finalSmogQty);

  // Check if an entry already exists for this exact date and shift
  const existingIdx = current.findIndex(
    (r) => r.id === canonicalId || (r.date === targetDate && r.shift === normalizedShift)
  );

  let updatedList: SmogQtyRecord[];
  let savedRecord: SmogQtyRecord;

  if (existingIdx >= 0) {
    const existing = current[existingIdx];
    savedRecord = {
      ...existing,
      id: canonicalId,
      date: targetDate,
      shift: normalizedShift,
      smogQty: finalSmogQty,
      prQty: finalPrQty,
      pendingQty: finalPendingQty,
      models: data.models !== undefined ? data.models : (existing.models || []),
      notes: data.notes !== undefined ? data.notes : (existing.notes || ''),
      isClosed: data.isClosed !== undefined ? data.isClosed : existing.isClosed,
      updatedAt: new Date().toISOString()
    };
    updatedList = [...current];
    updatedList[existingIdx] = savedRecord;
  } else {
    savedRecord = {
      id: canonicalId,
      date: targetDate,
      shift: normalizedShift,
      smogQty: finalSmogQty,
      prQty: finalPrQty,
      pendingQty: finalPendingQty,
      models: data.models || [],
      notes: data.notes || '',
      isClosed: data.isClosed !== undefined ? data.isClosed : false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    updatedList = [savedRecord, ...current];
  }

  // Save synchronously to LocalStorage
  try {
    localStorage.setItem(STORAGE_KEY_SMOG_QTY, JSON.stringify(updatedList));
    memoryRecords = updatedList;
  } catch (err) {
    console.error('Error saving smog qty record to localStorage:', err);
  }

  notifyListeners(updatedList);
  if (localBus) {
    localBus.postMessage({ type: 'SMOG_QTY_UPDATED', payload: updatedList });
  }

  // Persist to Firebase Firestore & Server Backup
  syncSmogQtyToFirestore(savedRecord).catch((err) => {
    console.warn('[Firebase] Background Smog Qty sync note:', err);
  });

  // Sync with extra metrics store for Dashboard/SmogModule metrics
  try {
    saveSmogExtraMetrics({ proQty: finalPrQty, smogPendingQty: finalPendingQty });
  } catch {}

  return savedRecord;
}

export function deleteSmogQtyRecord(id: string): void {
  const current = getSmogQtyRecords();
  const filtered = current.filter((r) => r.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY_SMOG_QTY, JSON.stringify(filtered));
    memoryRecords = filtered;
  } catch (err) {
    console.error('Error deleting smog qty record:', err);
  }

  notifyListeners(filtered);
  if (localBus) {
    localBus.postMessage({ type: 'SMOG_QTY_UPDATED', payload: filtered });
  }

  // Delete from Firebase Firestore
  deleteSmogQtyFromFirestore(id).catch((err) => {
    console.warn('[Firebase] Background Smog Qty delete note:', err);
  });
}

export function getSmogQtySum(date?: string | null, shift?: 'all' | 'A' | 'B'): number {
  const records = getSmogQtyRecords();
  return records
    .filter((r) => {
      if (date && r.date !== date) return false;
      if (shift && shift !== 'all' && r.shift !== shift) return false;
      return true;
    })
    .reduce((acc, r) => acc + (Number(r.smogQty) || 0), 0);
}

export function subscribeSmogQtyRecords(cb: (records: SmogQtyRecord[]) => void): () => void {
  listeners.add(cb);
  cb(getSmogQtyRecords());

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY_SMOG_QTY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        memoryRecords = parsed;
        notifyListeners(parsed);
      } catch (err) {
        console.error('Error parsing smog qty storage event:', err);
      }
    }
  };

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'SMOG_QTY_UPDATED' && Array.isArray(e.data.payload)) {
      memoryRecords = e.data.payload;
      notifyListeners(e.data.payload);
    }
  };

  window.addEventListener('storage', handleStorage);
  if (localBus) {
    localBus.addEventListener('message', handleBroadcast);
  }

  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', handleStorage);
    if (localBus) {
      localBus.removeEventListener('message', handleBroadcast);
    }
  };
}
