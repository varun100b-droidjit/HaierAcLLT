import { db, isFirebaseConfigured, collection, doc, setDoc, deleteDoc, getDocs, onSnapshot } from './firebase';
import { broadcastLabRealtimeEvent, subscribeToLabRealtimeEvents } from '../lib/supabase';

export interface ELTRecord {
  id: string; // recordId
  modelName: string;
  materialCode: string; // First 9 chars or Material Code
  serialNumber: string; // Full Barcode / Serial Number
  processType: 'ELT';
  status: 'Sent to ELT';
  eltDate: string; // e.g. "2026-09-09"
  eltTime: string; // e.g. "15:45:00"
  scannedByUserId?: string; // User ID who scanned (e.g. "ADMIN01")
  scannedByName?: string;   // Operator name
  createdAt: string; // ISO String
  timestamp?: number;
}

export interface BSRRecord {
  id: string; // recordId
  modelName: string;
  materialCode: string;
  serialNumber: string;
  processType: 'BSR Return';
  status: 'Returned from BSR';
  originalELTDateTime: string;
  bsrReturnDateTime: string;
  scannedByUserId?: string;  // Original ELT scanner User ID
  scannedByName?: string;    // Original ELT scanner Name
  returnedByUserId?: string; // BSR return operator User ID
  returnedByName?: string;   // BSR return operator Name
  createdAt: string;
  timestamp?: number;
}

const STORAGE_KEY_ELT_RECORDS = 'llt_elt_records_v1';
const STORAGE_KEY_BSR_RECORDS = 'llt_bsr_records_v1';

// Initial Demo Seed Records so tables have live data immediately
const INITIAL_ELT_RECORDS: ELTRecord[] = [
  {
    id: 'ELT-AADUU2000100HS9WNQK',
    modelName: 'HSO53-3NT-I',
    materialCode: 'AADUU2000',
    serialNumber: 'AADUU2000100HS9WNQK',
    processType: 'ELT',
    status: 'Sent to ELT',
    eltDate: new Date(Date.now() - 3600000 * 2).toISOString().slice(0, 10),
    eltTime: new Date(Date.now() - 3600000 * 2).toLocaleTimeString('en-GB'),
    scannedByUserId: 'ADMIN01',
    scannedByName: 'Admin',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    timestamp: Date.now() - 3600000 * 2
  },
  {
    id: 'ELT-AAEUU2000200HS8XYZK',
    modelName: 'HSO35-2NT-I',
    materialCode: 'AAEUU2000',
    serialNumber: 'AAEUU2000200HS8XYZK',
    processType: 'ELT',
    status: 'Sent to ELT',
    eltDate: new Date(Date.now() - 3600000 * 5).toISOString().slice(0, 10),
    eltTime: new Date(Date.now() - 3600000 * 5).toLocaleTimeString('en-GB'),
    scannedByUserId: 'ADMIN01',
    scannedByName: 'Admin',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    timestamp: Date.now() - 3600000 * 5
  }
];

const INITIAL_BSR_RECORDS: BSRRecord[] = [
  {
    id: 'BSR-AABUU1000300HS7RETK',
    modelName: 'HSO26-1NT-I',
    materialCode: 'AABUU1000',
    serialNumber: 'AABUU1000300HS7RETK',
    processType: 'BSR Return',
    status: 'Returned from BSR',
    originalELTDateTime: '2026-09-08 10:30:00',
    bsrReturnDateTime: '2026-09-08 16:45:00',
    scannedByUserId: 'ADMIN01',
    scannedByName: 'Admin',
    returnedByUserId: 'OPERATOR02',
    returnedByName: 'BSR Team',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    timestamp: Date.now() - 86400000
  }
];

function loadLocalELT(): ELTRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ELT_RECORDS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_ELT_RECORDS, JSON.stringify(INITIAL_ELT_RECORDS));
      return INITIAL_ELT_RECORDS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_ELT_RECORDS;
  } catch {
    return INITIAL_ELT_RECORDS;
  }
}

function loadLocalBSR(): BSRRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BSR_RECORDS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_BSR_RECORDS, JSON.stringify(INITIAL_BSR_RECORDS));
      return INITIAL_BSR_RECORDS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_BSR_RECORDS;
  } catch {
    return INITIAL_BSR_RECORDS;
  }
}

let eltCache: ELTRecord[] = loadLocalELT();
let bsrCache: BSRRecord[] = loadLocalBSR();

let eltListeners: ((records: ELTRecord[]) => void)[] = [];
let bsrListeners: ((records: BSRRecord[]) => void)[] = [];

function notifyELTListeners(records: ELTRecord[]) {
  eltCache = records;
  eltListeners.forEach(cb => {
    try { cb(records); } catch (e) { console.error(e); }
  });
}

function notifyBSRListeners(records: BSRRecord[]) {
  bsrCache = records;
  bsrListeners.forEach(cb => {
    try { cb(records); } catch (e) { console.error(e); }
  });
}

function saveLocalELT(records: ELTRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY_ELT_RECORDS, JSON.stringify(records));
  } catch (e) {
    console.warn(e);
  }
  if (localELTBus) {
    try { localELTBus.postMessage({ type: 'elt_change', timestamp: Date.now() }); } catch {}
  }
  broadcastLabRealtimeEvent('elt_records_change', { timestamp: Date.now() });
}

function saveLocalBSR(records: BSRRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY_BSR_RECORDS, JSON.stringify(records));
  } catch (e) {
    console.warn(e);
  }
  if (localELTBus) {
    try { localELTBus.postMessage({ type: 'bsr_change', timestamp: Date.now() }); } catch {}
  }
  broadcastLabRealtimeEvent('bsr_records_change', { timestamp: Date.now() });
}

// Local Inter-Tab Broadcast Channel
const localELTBus = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('llt_elt_bsr_bus') 
  : null;

if (localELTBus) {
  localELTBus.onmessage = (ev) => {
    if (ev.data?.type === 'elt_change') {
      eltCache = loadLocalELT();
      notifyELTListeners(eltCache);
    } else if (ev.data?.type === 'bsr_change') {
      bsrCache = loadLocalBSR();
      notifyBSRListeners(bsrCache);
    }
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY_ELT_RECORDS) {
      eltCache = loadLocalELT();
      notifyELTListeners(eltCache);
    }
    if (e.key === STORAGE_KEY_BSR_RECORDS) {
      bsrCache = loadLocalBSR();
      notifyBSRListeners(bsrCache);
    }
  });
}

// Global Supabase Realtime event listeners
subscribeToLabRealtimeEvents((event) => {
  if (event === 'elt_records_change' || event === 'bsr_records_change') {
    initCloudAndLocalELTBSR();
  }
});

/* =========================================================================
   FIRESTORE REAL-TIME LISTENERS
   ========================================================================= */

let isFirestoreAttached = false;

export function initCloudAndLocalELTBSR() {
  if (typeof window === 'undefined') return;

  if (isFirebaseConfigured && db && !isFirestoreAttached) {
    try {
      // 1. ELT Records Live Listener
      const eltCol = collection(db, 'elt_records');
      onSnapshot(eltCol, (snap) => {
        if (!snap.empty) {
          const list: ELTRecord[] = [];
          snap.forEach(d => {
            const data = d.data() as ELTRecord;
            list.push({
              ...data,
              id: d.id || data.id,
              serialNumber: (data.serialNumber || '').trim().toUpperCase(),
              modelName: (data.modelName || '').trim()
            });
          });
          eltCache = list;
          saveLocalELT(list);
          notifyELTListeners(list);
        }
      }, (err) => {
        console.warn('elt_records onSnapshot notice:', err);
      });

      // 2. BSR Records Live Listener
      const bsrCol = collection(db, 'bsr_records');
      onSnapshot(bsrCol, (snap) => {
        if (!snap.empty) {
          const list: BSRRecord[] = [];
          snap.forEach(d => {
            const data = d.data() as BSRRecord;
            list.push({
              ...data,
              id: d.id || data.id,
              serialNumber: (data.serialNumber || '').trim().toUpperCase(),
              modelName: (data.modelName || '').trim()
            });
          });
          bsrCache = list;
          saveLocalBSR(list);
          notifyBSRListeners(list);
        }
      }, (err) => {
        console.warn('bsr_records onSnapshot notice:', err);
      });

      isFirestoreAttached = true;
    } catch (e) {
      console.warn('Error setting up ELT/BSR Firestore listener:', e);
    }
  }

  // Periodic fallback check
  if (isFirebaseConfigured && db) {
    getDocs(collection(db, 'elt_records')).then(snap => {
      if (!snap.empty) {
        const list: ELTRecord[] = [];
        snap.forEach(d => list.push({ ...(d.data() as ELTRecord), id: d.id }));
        eltCache = list;
        saveLocalELT(list);
        notifyELTListeners(list);
      }
    }).catch(() => {});

    getDocs(collection(db, 'bsr_records')).then(snap => {
      if (!snap.empty) {
        const list: BSRRecord[] = [];
        snap.forEach(d => list.push({ ...(d.data() as BSRRecord), id: d.id }));
        bsrCache = list;
        saveLocalBSR(list);
        notifyBSRListeners(list);
      }
    }).catch(() => {});
  }
}

// Run initial check
initCloudAndLocalELTBSR();

/* =========================================================================
   PUBLIC STORE METHODS
   ========================================================================= */

export function getELTRecords(): ELTRecord[] {
  return [...eltCache];
}

export function getBSRRecords(): BSRRecord[] {
  return [...bsrCache];
}

/**
 * Check if a Serial Number is currently in ELT Records
 */
export function findInELTRecords(serialNumber: string): ELTRecord | undefined {
  if (!serialNumber) return undefined;
  const clean = serialNumber.trim().toUpperCase();
  return eltCache.find(r => r.serialNumber.trim().toUpperCase() === clean);
}

/**
 * Send machines to ELT:
 * - Duplicate Serial Number protection
 * - Stores Model Name, Material Code / Model Prefix, Full Serial Number,
 *   Process Type: "ELT", Status: "Sent to ELT", Date, Time, Created Timestamp
 */
export async function sendMachinesToELT(
  machines: { modelName: string; materialCode: string; serialNumber: string }[],
  scannedBy?: { userId?: string; name?: string }
): Promise<{ success: boolean; addedCount: number; duplicates: string[] }> {
  if (!machines || machines.length === 0) {
    return { success: false, addedCount: 0, duplicates: [] };
  }

  const duplicates: string[] = [];
  const newRecords: ELTRecord[] = [];
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toLocaleTimeString('en-GB');
  const nowIso = now.toISOString();
  const timestamp = now.getTime();

  for (const m of machines) {
    const cleanSerial = m.serialNumber.trim().toUpperCase();
    const cleanModel = m.modelName.trim();
    const cleanPrefix = m.materialCode.trim().toUpperCase() || cleanSerial.slice(0, 9);

    // Check if already in current ELT cache or already in newRecords batch
    const exists = eltCache.some(r => r.serialNumber.trim().toUpperCase() === cleanSerial) ||
      newRecords.some(r => r.serialNumber.trim().toUpperCase() === cleanSerial);

    if (exists) {
      duplicates.push(cleanSerial);
      continue;
    }

    const docId = `ELT-${cleanSerial.replace(/[^A-Z0-9_-]/gi, '_')}`;
    const record: ELTRecord = {
      id: docId,
      modelName: cleanModel,
      materialCode: cleanPrefix,
      serialNumber: cleanSerial,
      processType: 'ELT',
      status: 'Sent to ELT',
      eltDate: dateStr,
      eltTime: timeStr,
      scannedByUserId: scannedBy?.userId || 'ADMIN01',
      scannedByName: scannedBy?.name || 'Admin',
      createdAt: nowIso,
      timestamp
    };

    newRecords.push(record);
  }

  if (newRecords.length === 0) {
    return { success: false, addedCount: 0, duplicates };
  }

  // 1. Update local cache
  const updatedELT = [...newRecords, ...eltCache];
  saveLocalELT(updatedELT);
  notifyELTListeners(updatedELT);

  // 2. Persist to Firestore
  if (isFirebaseConfigured && db) {
    for (const rec of newRecords) {
      try {
        await setDoc(doc(db, 'elt_records', rec.id), rec, { merge: true });
      } catch (e) {
        console.warn('Failed to write ELT record to Firestore:', e);
      }
    }
  }

  return { success: true, addedCount: newRecords.length, duplicates };
}

/**
 * Return machine from ELT to BSR:
 * 1. Checks if scanned Serial Number is in ELT Record.
 * 2. If found, removes/deletes record from ELT Record.
 * 3. Saves to BSR Record with:
 *    - Model Name, Material Code / Model Prefix, Serial Number
 *    - Process Type: "BSR Return", Status: "Returned from BSR"
 *    - Original ELT Date & Time, BSR Return Date & Time, Firebase Timestamp
 */
export async function returnMachineToBSR(
  serialNumber: string,
  returnedBy?: { userId?: string; name?: string }
): Promise<{ success: boolean; bsrRecord?: BSRRecord; error?: string }> {
  if (!serialNumber) {
    return { success: false, error: 'Serial Number is required.' };
  }

  const cleanSerial = serialNumber.trim().toUpperCase();
  const matchingELT = eltCache.find(r => r.serialNumber.trim().toUpperCase() === cleanSerial);

  if (!matchingELT) {
    return {
      success: false,
      error: 'Serial Number not found in ELT Record'
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const timestamp = now.getTime();
  const bsrDateTime = `${now.toISOString().slice(0, 10)} ${now.toLocaleTimeString('en-GB')}`;
  const originalELTDateTime = `${matchingELT.eltDate} ${matchingELT.eltTime}`;

  const bsrDocId = `BSR-${cleanSerial.replace(/[^A-Z0-9_-]/gi, '_')}`;

  const bsrRecord: BSRRecord = {
    id: bsrDocId,
    modelName: matchingELT.modelName,
    materialCode: matchingELT.materialCode,
    serialNumber: cleanSerial,
    processType: 'BSR Return',
    status: 'Returned from BSR',
    originalELTDateTime,
    bsrReturnDateTime: bsrDateTime,
    scannedByUserId: matchingELT.scannedByUserId || 'ADMIN01',
    scannedByName: matchingELT.scannedByName || 'Admin',
    returnedByUserId: returnedBy?.userId || 'ADMIN01',
    returnedByName: returnedBy?.name || 'Admin',
    createdAt: nowIso,
    timestamp
  };

  // 1. Remove from ELT Cache
  const updatedELT = eltCache.filter(r => r.serialNumber.trim().toUpperCase() !== cleanSerial);
  saveLocalELT(updatedELT);
  notifyELTListeners(updatedELT);

  // 2. Add to BSR Cache
  const updatedBSR = [bsrRecord, ...bsrCache.filter(r => r.serialNumber.trim().toUpperCase() !== cleanSerial)];
  saveLocalBSR(updatedBSR);
  notifyBSRListeners(updatedBSR);

  // 3. Atomically sync to Firestore (Delete from elt_records, Write to bsr_records)
  if (isFirebaseConfigured && db) {
    try {
      // Write BSR first so data is never lost
      await setDoc(doc(db, 'bsr_records', bsrDocId), bsrRecord, { merge: true });
      // Then remove from ELT
      await deleteDoc(doc(db, 'elt_records', matchingELT.id));
    } catch (e) {
      console.warn('Failed to execute BSR transfer in Firestore:', e);
    }
  }

  return { success: true, bsrRecord };
}

/**
 * Return multiple machines from ELT to BSR in a single batch
 */
export async function returnMultipleMachinesToBSR(
  serialNumbers: string[],
  returnedBy?: { userId?: string; name?: string }
): Promise<{ success: boolean; returnedCount: number; notFound: string[]; errors: string[] }> {
  if (!serialNumbers || serialNumbers.length === 0) {
    return { success: false, returnedCount: 0, notFound: [], errors: ['No serial numbers provided'] };
  }

  const notFound: string[] = [];
  const errors: string[] = [];
  const newBSRRecords: BSRRecord[] = [];
  const deletedELTIds: string[] = [];
  const cleanedSerials: string[] = [];

  const now = new Date();
  const nowIso = now.toISOString();
  const timestamp = now.getTime();
  const bsrDateTime = `${now.toISOString().slice(0, 10)} ${now.toLocaleTimeString('en-GB')}`;

  for (const s of serialNumbers) {
    const cleanSerial = s.trim().toUpperCase();
    if (!cleanSerial) continue;

    const matchingELT = eltCache.find(r => r.serialNumber.trim().toUpperCase() === cleanSerial);
    if (!matchingELT) {
      notFound.push(cleanSerial);
      continue;
    }

    cleanedSerials.push(cleanSerial);
    deletedELTIds.push(matchingELT.id);

    const originalELTDateTime = `${matchingELT.eltDate} ${matchingELT.eltTime}`;
    const bsrDocId = `BSR-${cleanSerial.replace(/[^A-Z0-9_-]/gi, '_')}`;

    const bsrRecord: BSRRecord = {
      id: bsrDocId,
      modelName: matchingELT.modelName,
      materialCode: matchingELT.materialCode,
      serialNumber: cleanSerial,
      processType: 'BSR Return',
      status: 'Returned from BSR',
      originalELTDateTime,
      bsrReturnDateTime: bsrDateTime,
      scannedByUserId: matchingELT.scannedByUserId || 'ADMIN01',
      scannedByName: matchingELT.scannedByName || 'Admin',
      returnedByUserId: returnedBy?.userId || 'ADMIN01',
      returnedByName: returnedBy?.name || 'Admin',
      createdAt: nowIso,
      timestamp
    };

    newBSRRecords.push(bsrRecord);
  }

  if (newBSRRecords.length === 0) {
    return { success: false, returnedCount: 0, notFound, errors };
  }

  // 1. Remove from ELT Cache
  const updatedELT = eltCache.filter(r => !cleanedSerials.includes(r.serialNumber.trim().toUpperCase()));
  saveLocalELT(updatedELT);
  notifyELTListeners(updatedELT);

  // 2. Add to BSR Cache
  const updatedBSR = [
    ...newBSRRecords,
    ...bsrCache.filter(r => !cleanedSerials.includes(r.serialNumber.trim().toUpperCase()))
  ];
  saveLocalBSR(updatedBSR);
  notifyBSRListeners(updatedBSR);

  // 3. Atomically sync to Firestore
  if (isFirebaseConfigured && db) {
    for (const bsrRec of newBSRRecords) {
      try {
        await setDoc(doc(db, 'bsr_records', bsrRec.id), bsrRec, { merge: true });
      } catch (e: any) {
        errors.push(`Failed to save ${bsrRec.serialNumber} to BSR: ${e.message}`);
      }
    }

    for (const eltId of deletedELTIds) {
      try {
        await deleteDoc(doc(db, 'elt_records', eltId));
      } catch (e: any) {
        errors.push(`Failed to remove ELT record ${eltId}: ${e.message}`);
      }
    }
  }

  return { success: true, returnedCount: newBSRRecords.length, notFound, errors };
}

/**
 * Delete a single ELT record manually
 */
export async function deleteELTRecord(recordId: string): Promise<void> {
  const updated = eltCache.filter(r => r.id !== recordId);
  saveLocalELT(updated);
  notifyELTListeners(updated);

  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'elt_records', recordId));
    } catch (e) {
      console.warn(e);
    }
  }
}

/**
 * Delete a single BSR record manually
 */
export async function deleteBSRRecord(recordId: string): Promise<void> {
  const updated = bsrCache.filter(r => r.id !== recordId);
  saveLocalBSR(updated);
  notifyBSRListeners(updated);

  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'bsr_records', recordId));
    } catch (e) {
      console.warn(e);
    }
  }
}

export function subscribeELTRecords(cb: (records: ELTRecord[]) => void): () => void {
  eltListeners.push(cb);
  cb(eltCache);
  return () => {
    eltListeners = eltListeners.filter(l => l !== cb);
  };
}

export function subscribeBSRRecords(cb: (records: BSRRecord[]) => void): () => void {
  bsrListeners.push(cb);
  cb(bsrCache);
  return () => {
    bsrListeners = bsrListeners.filter(l => l !== cb);
  };
}
