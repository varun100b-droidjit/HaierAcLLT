import { db, isFirebaseConfigured, collection, doc, setDoc, deleteDoc, getDocs, onSnapshot } from './firebase';
import { 
  broadcastLabRealtimeEvent, 
  subscribeToLabRealtimeEvents,
  fetchELTRecordsFromSupabase,
  syncELTRecordToSupabase,
  deleteELTRecordFromSupabase,
  fetchBSRRecordsFromSupabase,
  syncBSRRecordToSupabase,
  deleteBSRRecordFromSupabase
} from '../lib/supabase';

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
const DELETED_ELT_KEY = 'llt_deleted_elt_records_v1';
const DELETED_BSR_KEY = 'llt_deleted_bsr_records_v1';

// Tombstone Management to prevent resurrection of deleted In/Out records
export function getDeletedELTIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_ELT_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function markELTDeleted(id: string): void {
  if (!id) return;
  const set = getDeletedELTIds();
  set.add(id);
  try {
    localStorage.setItem(DELETED_ELT_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function unmarkELTDeleted(id: string): void {
  if (!id) return;
  const set = getDeletedELTIds();
  if (set.has(id)) {
    set.delete(id);
    try {
      localStorage.setItem(DELETED_ELT_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  }
}

export function getDeletedBSRIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_BSR_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function markBSRDeleted(id: string): void {
  if (!id) return;
  const set = getDeletedBSRIds();
  set.add(id);
  try {
    localStorage.setItem(DELETED_BSR_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function unmarkBSRDeleted(id: string): void {
  if (!id) return;
  const set = getDeletedBSRIds();
  if (set.has(id)) {
    set.delete(id);
    try {
      localStorage.setItem(DELETED_BSR_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  }
}

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
  const deletedSet = getDeletedELTIds();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ELT_RECORDS);
    if (!raw) {
      const filteredInitial = INITIAL_ELT_RECORDS.filter(r => !deletedSet.has(r.id));
      localStorage.setItem(STORAGE_KEY_ELT_RECORDS, JSON.stringify(filteredInitial));
      return filteredInitial;
    }
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : INITIAL_ELT_RECORDS;
    return list.filter(r => !deletedSet.has(r.id));
  } catch {
    return INITIAL_ELT_RECORDS.filter(r => !deletedSet.has(r.id));
  }
}

function loadLocalBSR(): BSRRecord[] {
  const deletedSet = getDeletedBSRIds();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BSR_RECORDS);
    if (!raw) {
      const filteredInitial = INITIAL_BSR_RECORDS.filter(r => !deletedSet.has(r.id));
      localStorage.setItem(STORAGE_KEY_BSR_RECORDS, JSON.stringify(filteredInitial));
      return filteredInitial;
    }
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : INITIAL_BSR_RECORDS;
    return list.filter(r => !deletedSet.has(r.id));
  } catch {
    return INITIAL_BSR_RECORDS.filter(r => !deletedSet.has(r.id));
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

function saveLocalELT(records: ELTRecord[], shouldBroadcast: boolean = true) {
  try {
    localStorage.setItem(STORAGE_KEY_ELT_RECORDS, JSON.stringify(records));
  } catch (e) {
    console.warn(e);
  }
  if (localELTBus) {
    try { localELTBus.postMessage({ type: 'elt_change', timestamp: Date.now() }); } catch {}
  }
  if (shouldBroadcast) {
    broadcastLabRealtimeEvent('elt_records_change', { timestamp: Date.now() });
  }
}

function saveLocalBSR(records: BSRRecord[], shouldBroadcast: boolean = true) {
  try {
    localStorage.setItem(STORAGE_KEY_BSR_RECORDS, JSON.stringify(records));
  } catch (e) {
    console.warn(e);
  }
  if (localELTBus) {
    try { localELTBus.postMessage({ type: 'bsr_change', timestamp: Date.now() }); } catch {}
  }
  if (shouldBroadcast) {
    broadcastLabRealtimeEvent('bsr_records_change', { timestamp: Date.now() });
  }
}

// Inter-Tab Broadcast Channel
const localELTBus = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('llt_elt_bsr_bus') 
  : null;

if (localELTBus) {
  localELTBus.onmessage = (ev) => {
    if (ev.data?.type === 'elt_change') {
      if (ev.data?.deletedId) {
        markELTDeleted(ev.data.deletedId);
        eltCache = eltCache.filter(r => r.id !== ev.data.deletedId);
        notifyELTListeners(eltCache);
      } else {
        eltCache = loadLocalELT();
        notifyELTListeners(eltCache);
      }
    } else if (ev.data?.type === 'bsr_change') {
      if (ev.data?.deletedId) {
        markBSRDeleted(ev.data.deletedId);
        bsrCache = bsrCache.filter(r => r.id !== ev.data.deletedId);
        notifyBSRListeners(bsrCache);
      } else {
        bsrCache = loadLocalBSR();
        notifyBSRListeners(bsrCache);
      }
    }
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY_ELT_RECORDS || e.key === DELETED_ELT_KEY) {
      eltCache = loadLocalELT();
      notifyELTListeners(eltCache);
    }
    if (e.key === STORAGE_KEY_BSR_RECORDS || e.key === DELETED_BSR_KEY) {
      bsrCache = loadLocalBSR();
      notifyBSRListeners(bsrCache);
    }
  });
}

// Node.js Server Sync Helpers
async function syncELTRecordToServer(record: ELTRecord): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/in-out/elt/sync?unmark=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || `Server responded with ${res.status}` };
    }
    const data = await res.json().catch(() => ({ success: true }));
    return { success: data.success !== false, error: data.error };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Server connection failed' };
  }
}

async function deleteELTRecordFromServer(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/in-out/elt/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || `Server responded with ${res.status}` };
    }
    const data = await res.json().catch(() => ({ success: true }));
    return { success: data.success !== false, error: data.error };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Server request failed' };
  }
}

async function fetchELTRecordsFromServer(): Promise<{ records: ELTRecord[]; deletedIds?: string[] } | null> {
  try {
    const res = await fetch('/api/in-out/elt');
    if (!res.ok) return null;
    const json = await res.json();
    return {
      records: Array.isArray(json.records) ? json.records : [],
      deletedIds: Array.isArray(json.deletedIds) ? json.deletedIds : []
    };
  } catch {
    return null;
  }
}

async function syncBSRRecordToServer(record: BSRRecord): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/in-out/bsr/sync?unmark=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || `Server responded with ${res.status}` };
    }
    const data = await res.json().catch(() => ({ success: true }));
    return { success: data.success !== false, error: data.error };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Server connection failed' };
  }
}

async function deleteBSRRecordFromServer(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/in-out/bsr/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || `Server responded with ${res.status}` };
    }
    const data = await res.json().catch(() => ({ success: true }));
    return { success: data.success !== false, error: data.error };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Server request failed' };
  }
}

async function fetchBSRRecordsFromServer(): Promise<{ records: BSRRecord[]; deletedIds?: string[] } | null> {
  try {
    const res = await fetch('/api/in-out/bsr');
    if (!res.ok) return null;
    const json = await res.json();
    return {
      records: Array.isArray(json.records) ? json.records : [],
      deletedIds: Array.isArray(json.deletedIds) ? json.deletedIds : []
    };
  } catch {
    return null;
  }
}

// Debounced synchronization trigger to prevent redundant reload loops
let debounceSyncTimer: any = null;
function debouncedInitSync() {
  if (debounceSyncTimer) clearTimeout(debounceSyncTimer);
  debounceSyncTimer = setTimeout(() => {
    initCloudAndLocalELTBSR();
  }, 250);
}

// Global Realtime event listeners: Handles Supabase postgres_changes, Supabase Broadcast, and Server SSE events across all devices
subscribeToLabRealtimeEvents((event, payload) => {
  if (event === 'elt_records_change') {
    const deletedId = payload?.deletedId 
      || (payload?.action === 'delete' ? (payload?.recordId || payload?.id) : null)
      || (payload?.eventType === 'DELETE' ? (payload?.recordId || payload?.row?.id || payload?.old?.id) : null);
    
    if (deletedId) {
      console.log('[ELT Realtime DELETE Event Received]:', deletedId);
      markELTDeleted(deletedId);
      eltCache = eltCache.filter(r => r.id !== deletedId);
      saveLocalELT(eltCache, false);
      notifyELTListeners(eltCache);
    } else if (Array.isArray(payload?.deletedIds)) {
      payload.deletedIds.forEach((id: string) => markELTDeleted(id));
      const deletedSet = getDeletedELTIds();
      eltCache = eltCache.filter(r => !deletedSet.has(r.id));
      saveLocalELT(eltCache, false);
      notifyELTListeners(eltCache);
    } else {
      debouncedInitSync();
    }
  } else if (event === 'bsr_records_change') {
    const deletedId = payload?.deletedId 
      || (payload?.action === 'delete' ? (payload?.recordId || payload?.id) : null)
      || (payload?.eventType === 'DELETE' ? (payload?.recordId || payload?.row?.id || payload?.old?.id) : null);
    
    if (deletedId) {
      console.log('[BSR Realtime DELETE Event Received]:', deletedId);
      markBSRDeleted(deletedId);
      bsrCache = bsrCache.filter(r => r.id !== deletedId);
      saveLocalBSR(bsrCache, false);
      notifyBSRListeners(bsrCache);
    } else if (Array.isArray(payload?.deletedIds)) {
      payload.deletedIds.forEach((id: string) => markBSRDeleted(id));
      const deletedSet = getDeletedBSRIds();
      bsrCache = bsrCache.filter(r => !deletedSet.has(r.id));
      saveLocalBSR(bsrCache, false);
      notifyBSRListeners(bsrCache);
    } else {
      debouncedInitSync();
    }
  }
});

/* =========================================================================
   AUTHORITATIVE SERVER & DATABASE INITIALIZATION & RECONCILIATION
   ========================================================================= */

let isFirestoreAttached = false;
let isSyncingNow = false;

export async function initCloudAndLocalELTBSR() {
  if (typeof window === 'undefined' || isSyncingNow) return;
  isSyncingNow = true;

  try {
    // 1. Fetch Authoritative Data from Node.js Server first
    const [serverELTRes, serverBSRRes] = await Promise.all([
      fetchELTRecordsFromServer(),
      fetchBSRRecordsFromServer()
    ]);

    if (serverELTRes) {
      if (serverELTRes.deletedIds && serverELTRes.deletedIds.length > 0) {
        serverELTRes.deletedIds.forEach(id => markELTDeleted(id));
      }
      const currentDeletedELT = getDeletedELTIds();
      const cleanServerELT = (serverELTRes.records || []).filter(r => !currentDeletedELT.has(r.id));
      eltCache = cleanServerELT;
      saveLocalELT(cleanServerELT, false);
      notifyELTListeners(cleanServerELT);
    }

    if (serverBSRRes) {
      if (serverBSRRes.deletedIds && serverBSRRes.deletedIds.length > 0) {
        serverBSRRes.deletedIds.forEach(id => markBSRDeleted(id));
      }
      const currentDeletedBSR = getDeletedBSRIds();
      const cleanServerBSR = (serverBSRRes.records || []).filter(r => !currentDeletedBSR.has(r.id));
      bsrCache = cleanServerBSR;
      saveLocalBSR(cleanServerBSR, false);
      notifyBSRListeners(cleanServerBSR);
    }

    // 2. Fetch Authoritative Data from Supabase PostgreSQL if table exists
    try {
      const [eltFromSb, bsrFromSb] = await Promise.all([
        fetchELTRecordsFromSupabase(),
        fetchBSRRecordsFromSupabase()
      ]);

      if (eltFromSb !== null) {
        const currentDeleted = getDeletedELTIds();
        const clean = eltFromSb.filter(r => !currentDeleted.has(r.id));
        eltCache = clean;
        saveLocalELT(clean, false);
        notifyELTListeners(clean);
      }
      if (bsrFromSb !== null) {
        const currentDeleted = getDeletedBSRIds();
        const clean = bsrFromSb.filter(r => !currentDeleted.has(r.id));
        bsrCache = clean;
        saveLocalBSR(clean, false);
        notifyBSRListeners(clean);
      }
    } catch (sbErr) {
      console.warn('[ELTBSR] Supabase sync notice:', sbErr);
    }

    // 3. Firestore Live Listener and Fallback
    if (isFirebaseConfigured && db && !isFirestoreAttached) {
      try {
        const eltCol = collection(db, 'elt_records');
        onSnapshot(eltCol, (snap) => {
          const list: ELTRecord[] = [];
          if (!snap.empty) {
            snap.forEach(d => {
              const data = d.data() as ELTRecord;
              const docId = d.id || data.id;
              if (!getDeletedELTIds().has(docId)) {
                list.push({
                  ...data,
                  id: docId,
                  serialNumber: (data.serialNumber || '').trim().toUpperCase(),
                  modelName: (data.modelName || '').trim()
                });
              }
            });
          }
          eltCache = list;
          saveLocalELT(list, false);
          notifyELTListeners(list);
        }, (err) => {
          console.warn('elt_records onSnapshot notice:', err);
        });

        const bsrCol = collection(db, 'bsr_records');
        onSnapshot(bsrCol, (snap) => {
          const list: BSRRecord[] = [];
          if (!snap.empty) {
            snap.forEach(d => {
              const data = d.data() as BSRRecord;
              const docId = d.id || data.id;
              if (!getDeletedBSRIds().has(docId)) {
                list.push({
                  ...data,
                  id: docId,
                  serialNumber: (data.serialNumber || '').trim().toUpperCase(),
                  modelName: (data.modelName || '').trim()
                });
              }
            });
          }
          bsrCache = list;
          saveLocalBSR(list, false);
          notifyBSRListeners(list);
        }, (err) => {
          console.warn('bsr_records onSnapshot notice:', err);
        });

        isFirestoreAttached = true;
      } catch (e) {
        console.warn('Error setting up ELT/BSR Firestore listener:', e);
      }
    }
  } catch (err) {
    console.warn('[ELTBSR] initCloudAndLocalELTBSR error:', err);
  } finally {
    isSyncingNow = false;
  }
}

// Periodic background synchronization every 4 seconds to guarantee multi-device alignment
if (typeof window !== 'undefined') {
  setInterval(() => {
    initCloudAndLocalELTBSR();
  }, 4000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      initCloudAndLocalELTBSR();
    }
  });

  window.addEventListener('online', () => {
    initCloudAndLocalELTBSR();
  });
}

// Initial load check
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

  // 1. Unmark any previous deletion tombstones for these newly added records
  for (const rec of newRecords) {
    unmarkELTDeleted(rec.id);
  }

  // 2. Update local cache
  const updatedELT = [...newRecords, ...eltCache];
  saveLocalELT(updatedELT, true);
  notifyELTListeners(updatedELT);

  // 3. Persist to Authoritative Server & Supabase
  let savedServerCount = 0;
  let serverErrorMessage = '';
  for (const rec of newRecords) {
    const srvRes = await syncELTRecordToServer(rec);
    if (srvRes.success) {
      savedServerCount++;
    } else {
      serverErrorMessage = srvRes.error || 'Server save failed';
    }
    syncELTRecordToSupabase(rec).catch(e => console.warn('[ELT] Supabase sync note:', e));
  }

  // If server save failed completely, rollback local cache and report error
  if (savedServerCount === 0 && newRecords.length > 0) {
    console.error('[sendMachinesToELT] Authoritative server save failed:', serverErrorMessage);
    const rolledBack = eltCache.filter(r => !newRecords.some(nr => nr.id === r.id));
    eltCache = rolledBack;
    saveLocalELT(rolledBack, false);
    notifyELTListeners(rolledBack);
    return {
      success: false,
      addedCount: 0,
      duplicates,
      error: serverErrorMessage || 'Failed to persist record to authoritative server'
    } as any;
  }

  // 4. Persist to Firestore if configured
  if (isFirebaseConfigured && db) {
    for (const rec of newRecords) {
      try {
        await setDoc(doc(db, 'elt_records', rec.id), rec, { merge: true });
      } catch (e) {
        console.warn('Failed to write ELT record to Firestore:', e);
      }
    }
  }

  // 5. Broadcast addition to all connected devices
  broadcastLabRealtimeEvent('elt_records_change', {
    action: 'add_machines',
    count: savedServerCount,
    timestamp: Date.now()
  });

  return { success: true, addedCount: savedServerCount, duplicates };
}

/**
 * Return machine from ELT to BSR:
 * 1. Checks if scanned Serial Number is in ELT Record.
 * 2. If found, removes/deletes record from ELT Record.
 * 3. Saves to BSR Record with:
 *    - Model Name, Material Code / Model Prefix, Serial Number
 *    - Process Type: "BSR Return", Status: "Returned from BSR"
 *    - Original ELT Date & Time, BSR Return Date & Time, Timestamp
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

  // 1. Mark matchingELT.id as deleted from ELT and unmark BSR tombstone
  markELTDeleted(matchingELT.id);
  unmarkBSRDeleted(bsrDocId);

  // 2. Remove from ELT Cache
  const updatedELT = eltCache.filter(r => r.serialNumber.trim().toUpperCase() !== cleanSerial);
  saveLocalELT(updatedELT, false);
  notifyELTListeners(updatedELT);

  // 3. Add to BSR Cache
  const updatedBSR = [bsrRecord, ...bsrCache.filter(r => r.serialNumber.trim().toUpperCase() !== cleanSerial)];
  saveLocalBSR(updatedBSR, false);
  notifyBSRListeners(updatedBSR);

  // 4. Broadcast Realtime events across all devices
  broadcastLabRealtimeEvent('elt_records_change', {
    deletedId: matchingELT.id,
    action: 'transfer_to_bsr',
    timestamp: Date.now()
  });
  broadcastLabRealtimeEvent('bsr_records_change', {
    recordId: bsrDocId,
    action: 'return_from_elt',
    timestamp: Date.now()
  });

  // 5. Node.js Server Atomic Transfer
  try {
    await fetch('/api/in-out/transfer-to-bsr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bsrRecords: [bsrRecord],
        deletedEltIds: [matchingELT.id]
      })
    });
  } catch (e) {
    console.warn('[BSR] Server atomic transfer note:', e);
  }

  // 6. Supabase sync
  deleteELTRecordFromSupabase(matchingELT.id).catch(e => console.warn('[ELT] Supabase delete note:', e));
  syncBSRRecordToSupabase(bsrRecord).catch(e => console.warn('[BSR] Supabase sync note:', e));

  // 7. Atomically sync to Firestore
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'bsr_records', bsrDocId), bsrRecord, { merge: true });
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
    markELTDeleted(matchingELT.id);

    const originalELTDateTime = `${matchingELT.eltDate} ${matchingELT.eltTime}`;
    const bsrDocId = `BSR-${cleanSerial.replace(/[^A-Z0-9_-]/gi, '_')}`;
    unmarkBSRDeleted(bsrDocId);

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
  saveLocalELT(updatedELT, false);
  notifyELTListeners(updatedELT);

  // 2. Add to BSR Cache
  const updatedBSR = [
    ...newBSRRecords,
    ...bsrCache.filter(r => !cleanedSerials.includes(r.serialNumber.trim().toUpperCase()))
  ];
  saveLocalBSR(updatedBSR, false);
  notifyBSRListeners(updatedBSR);

  // 3. Node.js Server Atomic Transfer
  try {
    await fetch('/api/in-out/transfer-to-bsr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bsrRecords: newBSRRecords,
        deletedEltIds: deletedELTIds
      })
    });
  } catch (e) {
    console.warn('[BSR] Batch transfer server note:', e);
  }

  // 4. Realtime Broadcast & Supabase sync
  for (const eltId of deletedELTIds) {
    broadcastLabRealtimeEvent('elt_records_change', {
      deletedId: eltId,
      action: 'transfer_to_bsr',
      timestamp: Date.now()
    });
    deleteELTRecordFromSupabase(eltId).catch(e => console.warn(e));
  }

  for (const bsrRec of newBSRRecords) {
    syncBSRRecordToSupabase(bsrRec).catch(e => console.warn(e));
  }
  broadcastLabRealtimeEvent('bsr_records_change', {
    action: 'batch_transfer',
    count: newBSRRecords.length,
    timestamp: Date.now()
  });

  // 4. Atomically sync to Firestore
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
 * Delete a single ELT record manually.
 * Calls and awaits Supabase PostgreSQL, Node.js server, and Firestore deletions.
 * Rolls back local state and returns failure if the authoritative deletion fails.
 */
export async function deleteELTRecord(recordId: string): Promise<{ success: boolean; error?: string }> {
  if (!recordId) return { success: false, error: 'No record ID specified' };

  const backupCache = [...eltCache];

  // 1. Tentatively mark as deleted in tombstone set
  markELTDeleted(recordId);

  // 2. Remove immediately from local memory cache & localStorage
  const updated = eltCache.filter(r => r.id !== recordId);
  saveLocalELT(updated, false);
  notifyELTListeners(updated);

  // 3. Call and await Supabase PostgreSQL delete
  const sbResult = await deleteELTRecordFromSupabase(recordId);

  // 4. Call and await Node.js Server delete
  const serverResult = await deleteELTRecordFromServer(recordId);

  // 5. Call and await Firestore delete if configured
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'elt_records', recordId));
    } catch (e: any) {
      console.warn('[ELTStore] Firestore delete error:', e);
    }
  }

  // 6. Evaluate authoritative deletion outcome
  const isAuthoritativeSuccess = sbResult.success || serverResult.success;

  if (!isAuthoritativeSuccess) {
    // Both Supabase and server failed! Rollback local deletion
    console.error('[ELTStore] Authoritative delete failed. Reconciling and rolling back local state.');
    unmarkELTDeleted(recordId);
    eltCache = backupCache;
    saveLocalELT(backupCache, false);
    notifyELTListeners(backupCache);
    debouncedInitSync();
    return { 
      success: false, 
      error: serverResult.error || sbResult.error || 'Authoritative database deletion failed' 
    };
  }

  // 7. Authoritative deletion confirmed! Broadcast real-time DELETE event to all connected devices
  broadcastLabRealtimeEvent('elt_records_change', {
    deletedId: recordId,
    action: 'delete',
    timestamp: Date.now()
  });
  if (localELTBus) {
    try { localELTBus.postMessage({ type: 'elt_change', deletedId: recordId, timestamp: Date.now() }); } catch {}
  }

  return { success: true };
}

/**
 * Delete a single BSR record manually.
 * Calls and awaits Supabase PostgreSQL, Node.js server, and Firestore deletions.
 * Rolls back local state and returns failure if the authoritative deletion fails.
 */
export async function deleteBSRRecord(recordId: string): Promise<{ success: boolean; error?: string }> {
  if (!recordId) return { success: false, error: 'No record ID specified' };

  const backupCache = [...bsrCache];

  // 1. Tentatively mark as deleted in tombstone set
  markBSRDeleted(recordId);

  // 2. Remove immediately from local memory cache & localStorage
  const updated = bsrCache.filter(r => r.id !== recordId);
  saveLocalBSR(updated, false);
  notifyBSRListeners(updated);

  // 3. Call and await Supabase PostgreSQL delete
  const sbResult = await deleteBSRRecordFromSupabase(recordId);

  // 4. Call and await Node.js Server delete
  const serverResult = await deleteBSRRecordFromServer(recordId);

  // 5. Call and await Firestore delete if configured
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'bsr_records', recordId));
    } catch (e: any) {
      console.warn('[BSRStore] Firestore delete error:', e);
    }
  }

  // 6. Evaluate authoritative deletion outcome
  const isAuthoritativeSuccess = sbResult.success || serverResult.success;

  if (!isAuthoritativeSuccess) {
    // Both Supabase and server failed! Rollback local deletion
    console.error('[BSRStore] Authoritative delete failed. Reconciling and rolling back local state.');
    unmarkBSRDeleted(recordId);
    bsrCache = backupCache;
    saveLocalBSR(backupCache, false);
    notifyBSRListeners(backupCache);
    debouncedInitSync();
    return { 
      success: false, 
      error: serverResult.error || sbResult.error || 'Authoritative database deletion failed' 
    };
  }

  // 7. Authoritative deletion confirmed! Broadcast real-time DELETE event to all connected devices
  broadcastLabRealtimeEvent('bsr_records_change', {
    deletedId: recordId,
    action: 'delete',
    timestamp: Date.now()
  });
  if (localELTBus) {
    try { localELTBus.postMessage({ type: 'bsr_change', deletedId: recordId, timestamp: Date.now() }); } catch {}
  }

  return { success: true };
}

export function getELTRecords(): ELTRecord[] {
  return [...eltCache];
}

export function getBSRRecords(): BSRRecord[] {
  return [...bsrCache];
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
