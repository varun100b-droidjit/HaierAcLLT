import { ProtoUnit, ReportDetails } from '../types';
import { addLabNotification } from './unitStore';
import { formatShortDateTime, getMachineEndDateTime, getMachineStartDateTime } from '../utils/dateFormatter';
import { 
  syncProtoUnitToSupabase, 
  deleteProtoUnitFromSupabase, 
  fetchProtoUnitsFromSupabase,
  broadcastLabRealtimeEvent,
  subscribeToLabRealtimeEvents
} from '../lib/supabase';
import { db, collection, doc, setDoc, deleteDoc, getDocs, onSnapshot } from './firebase';
import { requireOnlineForSave } from './networkManager';
import { buildNormalizedPhotos } from '../utils/photoManager';
import { cleanForFirestore, enforceFirestoreDocSizeLimit } from './firestoreSanitizer';
import { safeLocalStorageSet, idbSaveAll, idbGetAll, restorePhotosFromIdb } from '../lib/indexedDbStorage';
import { isPhotoMissing } from '../utils/placeholderImage';
import { 
  uploadUnitPhotosToServer, 
  deleteUnitPhotosFromServer, 
  fetchAllUnitPhotosFromServer 
} from './cloudPhotoService';

const STORAGE_KEY_PROTO_UNITS = 'llt_proto_units_v1';
const DELETED_PROTO_UNITS_KEY = 'llt_deleted_proto_units_v1';

// Helper to track explicitly deleted unit IDs to prevent resurrection during sync
function getDeletedProtoUnitIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_PROTO_UNITS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markProtoUnitDeleted(id: string) {
  const set = getDeletedProtoUnitIds();
  set.add(id);
  try {
    localStorage.setItem(DELETED_PROTO_UNITS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

function unmarkProtoUnitDeleted(id: string) {
  const set = getDeletedProtoUnitIds();
  if (set.has(id)) {
    set.delete(id);
    try {
      localStorage.setItem(DELETED_PROTO_UNITS_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  }
}

// Helper to generate a random unique 5-digit string (e.g., "54321")
export function generate5DigitSerial(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

const INITIAL_PROTO_UNITS: ProtoUnit[] = [];

let protoUnitsCache: ProtoUnit[] = loadLocalProtoUnits();
const listeners: Set<() => void> = new Set();

// Asynchronously hydrate full fidelity photos from IndexedDB on startup
if (typeof window !== 'undefined') {
  idbGetAll<ProtoUnit>('proto_units').then(idbUnits => {
    if (idbUnits && idbUnits.length > 0) {
      protoUnitsCache = restorePhotosFromIdb(protoUnitsCache, idbUnits);
      notifyListeners();
    }
  }).catch(err => {
    console.warn('[ProtoStore] IDB hydration note:', err);
  });
}

// Local Inter-Tab Broadcast Channel
const localProtoBus = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('llt_proto_bus') 
  : null;

if (localProtoBus) {
  localProtoBus.onmessage = () => {
    const loaded = loadLocalProtoUnits();
    protoUnitsCache = restorePhotosFromIdb(loaded, protoUnitsCache);
    idbGetAll<ProtoUnit>('proto_units').then(idbUnits => {
      if (idbUnits && idbUnits.length > 0) {
        protoUnitsCache = restorePhotosFromIdb(protoUnitsCache, idbUnits);
        notifyListeners();
      }
    }).catch(() => {});
    notifyListeners();
  };
}

// Storage event listener
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY_PROTO_UNITS) {
      const loaded = loadLocalProtoUnits();
      protoUnitsCache = restorePhotosFromIdb(loaded, protoUnitsCache);
      idbGetAll<ProtoUnit>('proto_units').then(idbUnits => {
        if (idbUnits && idbUnits.length > 0) {
          protoUnitsCache = restorePhotosFromIdb(protoUnitsCache, idbUnits);
          notifyListeners();
        }
      }).catch(() => {});
      notifyListeners();
    }
  });
}

// Global Supabase Realtime event listener
subscribeToLabRealtimeEvents((event, payload) => {
  if (event === 'proto_units_change') {
    if (payload?.deletedId) {
      markProtoUnitDeleted(payload.deletedId);
      protoUnitsCache = protoUnitsCache.filter(u => u.id !== payload.deletedId);
      safeLocalStorageSet(STORAGE_KEY_PROTO_UNITS, protoUnitsCache);
      notifyListeners();
    } else {
      initDataSync();
    }
  }
});

// Periodic background sync: Poll cloud every 5 seconds for instant multi-device sync, and push pending units
if (typeof window !== 'undefined') {
  setInterval(() => {
    initDataSync();
    pushPendingLocalUnitsToFirestore();
  }, 5000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      initDataSync();
      setupFirestoreListener();
    }
  });

  window.addEventListener('focus', () => {
    initDataSync();
  });

  window.addEventListener('online', () => {
    initDataSync();
    setupFirestoreListener();
  });
}

/* ==========================================
   FIREBASE FIRESTORE SYNC HELPERS & REAL-TIME LISTENER
   ========================================== */

export async function syncProtoUnitToFirestore(unit: ProtoUnit) {
  if (!db || !unit || unit.id.startsWith('proto-101') || unit.id.startsWith('proto-102')) return;
  try {
    // 1. Direct Server Upload: upload each genuine photo to server unit_photos collection
    if (unit.photos && typeof unit.photos === 'object') {
      await uploadUnitPhotosToServer(unit.id, 'proto', unit.photos);
    }

    // 2. Persist main unit document safely without crashing 1MB limit
    const sanitized = enforceFirestoreDocSizeLimit(cleanForFirestore(unit));
    const docRef = doc(db, 'proto_units', unit.id);
    await setDoc(docRef, sanitized, { merge: true });
    // Remove local pending flag once successfully confirmed on Firestore
    if ((unit as any)._pendingSync) {
      delete (unit as any)._pendingSync;
      safeLocalStorageSet(STORAGE_KEY_PROTO_UNITS, protoUnitsCache);
    }
    console.log('Successfully synced Proto Unit to Firebase Firestore server:', unit.id);
  } catch (e) {
    console.warn('Firestore Proto Unit sync note:', e);
  }
}

export async function deleteProtoUnitFromFirestore(id: string) {
  if (!db) return;
  try {
    // Clean up photos from server collection
    await deleteUnitPhotosFromServer(id);
    const docRef = doc(db, 'proto_units', id);
    await deleteDoc(docRef);
  } catch (e) {
    console.warn('Firestore Proto Unit delete note:', e);
  }
}

export async function fetchProtoUnitsFromFirestore(): Promise<ProtoUnit[] | null> {
  if (!db) return null;
  try {
    const colRef = collection(db, 'proto_units');
    const snap = await getDocs(colRef);
    if (snap.empty) return null;

    // Direct Server Fetch: get all photos from Firestore server unit_photos collection
    let serverPhotosMap = new Map<string, Record<string, string>>();
    try {
      serverPhotosMap = await fetchAllUnitPhotosFromServer();
    } catch {}

    const list: ProtoUnit[] = [];
    snap.forEach(d => {
      const data = d.data() as ProtoUnit;
      if (data && data.id !== 'proto-101' && data.id !== 'proto-102') {
        // Merge cloud server photos so Mobile has 100% full photos
        const serverPhotos = serverPhotosMap.get(data.id);
        if (serverPhotos && Object.keys(serverPhotos).length > 0) {
          const mergedPhotos: Record<string, string> = { ...(data.photos || {}) };
          Object.entries(serverPhotos).forEach(([k, v]) => {
            if (v && !isPhotoMissing(v)) {
              mergedPhotos[k] = v;
            }
          });
          data.photos = mergedPhotos as any;
        }
        list.push(data);
      }
    });
    return list;
  } catch (e) {
    console.warn('Firestore Proto Unit fetch note:', e);
    return null;
  }
}

/**
 * Merges incoming remote records with the local cache in a NON-DESTRUCTIVE manner.
 * Prioritizes remote records as the cloud source of truth, while preserving any
 * locally created units that are currently pending cloud upload.
 */
function mergeWithLocalCache(remoteUnits: ProtoUnit[]): ProtoUnit[] {
  const deleted = getDeletedProtoUnitIds();
  const map = new Map<string, ProtoUnit>();

  // 1. All valid remote units from Firestore / cloud
  remoteUnits.forEach(rem => {
    if (!rem || !rem.id || deleted.has(rem.id)) return;
    const local = protoUnitsCache.find(l => l.id === rem.id);
    // If local has valid photos and remote has missing/empty photos, preserve local photos
    if (local && local.photos && typeof local.photos === 'object') {
      const mergedPhotos: Record<string, string> = { ...(rem.photos || {}) };
      Object.entries(local.photos).forEach(([k, v]) => {
        if (typeof v === 'string' && !isPhotoMissing(v)) {
          if (isPhotoMissing(mergedPhotos[k])) {
            mergedPhotos[k] = v;
          }
        }
      });
      rem.photos = mergedPhotos;
    }
    map.set(rem.id, rem);
  });

  // 2. Preserve local units that have not yet reached the cloud or are marked pending sync
  protoUnitsCache.forEach(local => {
    if (local && local.id && !deleted.has(local.id)) {
      if (!map.has(local.id)) {
        map.set(local.id, local);
      } else {
        const remote = map.get(local.id)!;
        const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime();
        const remTime = new Date(remote.updatedAt || remote.createdAt || 0).getTime();
        if ((local as any)._pendingSync || localTime > remTime) {
          map.set(local.id, local);
        }
      }
    }
  });

  const merged = Array.from(map.values());
  merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return merged;
}

// Push any pending local units to Firestore if they aren't on the cloud yet
function pushPendingLocalUnitsToFirestore() {
  const deleted = getDeletedProtoUnitIds();
  protoUnitsCache.forEach(u => {
    if (u && !deleted.has(u.id) && !u.id.startsWith('proto-101') && !u.id.startsWith('proto-102')) {
      if ((u as any)._pendingSync) {
        syncProtoUnitToFirestore(u);
      }
    }
  });
}

// Attach Real-Time Firestore Listener for Live Multi-Device Sync with auto-reconnection
let unsubscribeFirestore: (() => void) | null = null;
let isSettingUpListener = false;

function setupFirestoreListener() {
  if (!db || isSettingUpListener) return;
  isSettingUpListener = true;
  try {
    if (unsubscribeFirestore) {
      try { unsubscribeFirestore(); } catch {}
      unsubscribeFirestore = null;
    }
    const colRef = collection(db, 'proto_units');
    unsubscribeFirestore = onSnapshot(colRef, async (snap: any) => {
      if (snap) {
        const list: ProtoUnit[] = [];
        snap.forEach((d: any) => {
          const data = d.data() as ProtoUnit;
          if (data && data.id !== 'proto-101' && data.id !== 'proto-102') {
            list.push(data);
          }
        });

        // Hydrate photos from cloud server collection
        try {
          const serverPhotosMap = await fetchAllUnitPhotosFromServer();
          list.forEach(u => {
            const serverPhotos = serverPhotosMap.get(u.id);
            if (serverPhotos && Object.keys(serverPhotos).length > 0) {
              const mergedPhotos: Record<string, string> = { ...(u.photos || {}) };
              Object.entries(serverPhotos).forEach(([k, v]) => {
                if (v && !isPhotoMissing(v)) {
                  mergedPhotos[k] = v;
                }
              });
              u.photos = mergedPhotos as any;
            }
          });
        } catch {}

        // Non-destructive merge preserves any freshly created local unit
        const merged = mergeWithLocalCache(list);
        protoUnitsCache = merged;
        safeLocalStorageSet(STORAGE_KEY_PROTO_UNITS, merged);
        idbSaveAll('proto_units', merged);
        notifyListeners();
      }
    }, (err: any) => {
      console.warn('[ProtoUnitStore] Real-time listener error, scheduling reconnect:', err);
      setTimeout(() => {
        isSettingUpListener = false;
        setupFirestoreListener();
      }, 3000);
    });
  } catch (e) {
    console.warn('[ProtoUnitStore] Could not set up real-time listener:', e);
    setTimeout(() => {
      isSettingUpListener = false;
      setupFirestoreListener();
    }, 5000);
  } finally {
    isSettingUpListener = false;
  }
}

if (db) {
  setupFirestoreListener();
}

// Automatically fetch from Firestore / Supabase on init
initDataSync();

export async function forceSyncProtoUnits(): Promise<ProtoUnit[]> {
  await initDataSync();
  return getProtoUnits();
}

async function initDataSync() {
  try {
    // Try fetching from Firestore first
    const firestoreData = await fetchProtoUnitsFromFirestore();
    if (firestoreData && firestoreData.length > 0) {
      const clean = firestoreData.filter(u => u && u.id !== 'proto-101' && u.id !== 'proto-102');
      const merged = mergeWithLocalCache(clean);
      protoUnitsCache = merged;
      safeLocalStorageSet(STORAGE_KEY_PROTO_UNITS, merged);
      idbSaveAll('proto_units', merged);
      notifyListeners();
      pushPendingLocalUnitsToFirestore();
      return;
    }

    // Fallback to Supabase
    const remoteData = await fetchProtoUnitsFromSupabase();
    if (remoteData && remoteData.length > 0) {
      const cleanRemote = remoteData.filter(u => u && u.id !== 'proto-101' && u.id !== 'proto-102');
      const merged = mergeWithLocalCache(cleanRemote);
      protoUnitsCache = merged;
      safeLocalStorageSet(STORAGE_KEY_PROTO_UNITS, merged);
      idbSaveAll('proto_units', merged);
      notifyListeners();
      cleanRemote.forEach(u => syncProtoUnitToFirestore(u));
    }
  } catch (e) {
    console.warn('Proto Units cloud sync note:', e);
  }
}

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export function subscribeProtoUnitStore(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function saveLocalProtoUnits(data: ProtoUnit[]) {
  const clean = (data || []).filter(u => u && u.id !== 'proto-101' && u.id !== 'proto-102');
  protoUnitsCache = clean;
  // Always persist full data with all photos to IndexedDB
  idbSaveAll('proto_units', clean);
  // Persist clean copy to localStorage
  safeLocalStorageSet(STORAGE_KEY_PROTO_UNITS, clean);
  if (localProtoBus) {
    try { localProtoBus.postMessage({ timestamp: Date.now() }); } catch {}
  }
  broadcastLabRealtimeEvent('proto_units_change', { timestamp: Date.now() });
  notifyListeners();
}

function loadLocalProtoUnits(): ProtoUnit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROTO_UNITS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((u: any) => u && u.id !== 'proto-101' && u.id !== 'proto-102');
        return filtered.map((u: any) => {
          if (!u || typeof u !== 'object') return u;

          // Clean legacy placeholder markers from photos object
          let photos = u.photos;
          if (u.photos && typeof u.photos === 'object') {
            const cleanPhotos: Record<string, string> = {};
            Object.entries(u.photos).forEach(([k, v]) => {
              if (typeof v === 'string' && !v.includes('stored_in_idb') && (v.startsWith('data:') || v.startsWith('http') || v.startsWith('blob:') || v.length > 80)) {
                cleanPhotos[k] = v;
              }
            });
            photos = cleanPhotos;
          }

          // Test Completed gets data strictly from Machine End Date & Time when completed
          const isCompleted = u.status === 'finished' || (Number(u.doneHour) >= 1045);
          const isStopped = u.status === 'stopped';
          const machineEnd = getMachineEndDateTime(u);
          const machineStart = getMachineStartDateTime(u);
          const existingReport = u.reportDetails || {};

          const resolvedTestCompleted = isCompleted && machineEnd && machineEnd !== '-'
            ? machineEnd
            : '-';

          return {
            ...u,
            photos,
            endDateTime: isCompleted ? (u.endDateTime || machineEnd) : (isStopped ? (u.endDateTime || '') : ''),
            reportDetails: {
              ...existingReport,
              testCommenced: existingReport.testCommenced || machineStart,
              testCompleted: resolvedTestCompleted,
            }
          };
        });
      }
    }
    return [];
  } catch (e) {
    return [];
  }
}

export function getProtoUnits(): ProtoUnit[] {
  return [...protoUnitsCache];
}

function getFormattedNow(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function sanitizeStringFields<T>(obj: T, parentKey = ''): T {
  if (parentKey === 'photos' || parentKey === 'photoRecords' || parentKey === 'photoUrl') {
    return obj;
  }
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    return (trimmed === '' ? 'NA' : trimmed) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeStringFields(item, parentKey)) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'photos' || key === 'photoRecords') {
        result[key] = value;
      } else if (typeof value === 'string') {
        const trimmed = value.trim();
        result[key] = (trimmed === '' ? 'NA' : trimmed);
      } else if (value !== null && typeof value === 'object') {
        result[key] = sanitizeStringFields(value, key);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return obj;
}

export function addProtoUnit(unit: Omit<ProtoUnit, 'id' | 'createdAt' | 'updatedAt'> & { status?: 'live' | 'stopped' | 'finished' }): ProtoUnit | null {
  if (!requireOnlineForSave(`Add Proto Unit: ${unit.modelName || 'New Unit'}`)) {
    return null;
  }
  const formattedDate = getFormattedNow();
  const sanitizedUnit = sanitizeStringFields(unit);

  const normalized = buildNormalizedPhotos(sanitizedUnit.photos || {});

  const numericDone = Number(sanitizedUnit.doneHour) || 0;
  const initialStatus: 'live' | 'stopped' | 'finished' = (numericDone >= 1045) 
    ? 'finished' 
    : (sanitizedUnit.status || 'live');

  // Compute end date time
  const req = Number(sanitizedUnit.requiredHour) || 1045;
  const pendingHours = Math.max(0, req - numericDone);
  const estCompDate = new Date(Date.now() + pendingHours * 3600 * 1000);
  const estEndStr = formatShortDateTime(estCompDate.toISOString());

  // End Date & Time value (whatever is in End Date & Time is automatically in Test Completed)
  const autoEndDateTime = initialStatus === 'finished'
    ? (sanitizedUnit.endDateTime || formattedDate)
    : (sanitizedUnit.endDateTime || sanitizedUnit.reportDetails?.testCompleted || estEndStr);

  const existingReport = sanitizedUnit.reportDetails || {};
  const syncedReport: ReportDetails = {
    ...existingReport,
    testCommenced: existingReport.testCommenced || formattedDate.slice(0, 10),
    testCompleted: autoEndDateTime, // End Date & Time and Test Completed are automatically identical
  };

  const newUnit: ProtoUnit = {
    ...sanitizedUnit,
    photos: normalized.photos,
    id: `proto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    status: initialStatus,
    createdAt: formattedDate,
    updatedAt: formattedDate,
    endDateTime: autoEndDateTime,
    ...(initialStatus === 'finished' ? { completedAt: autoEndDateTime } : {}),
    reportDetails: syncedReport,
  };
  (newUnit as any)._pendingSync = true;
  unmarkProtoUnitDeleted(newUnit.id);

  const updated = [newUnit, ...protoUnitsCache];
  saveLocalProtoUnits(updated);

  // Sync to Supabase & Firebase Firestore
  syncProtoUnitToSupabase(newUnit);
  syncProtoUnitToFirestore(newUnit);

  addLabNotification(
    `Proto Unit Added: ${newUnit.modelName}`,
    `Station: ${newUnit.station} | IDU: ${newUnit.iduSerialNumber || 'NA'}, ODU: ${newUnit.oduSerialNumber || 'NA'}`
  );

  return newUnit;
}

export function updateProtoUnitStatus(id: string, status: 'live' | 'finished' | 'stopped', doneHour?: number): void {
  if (!requireOnlineForSave(`Update Proto Unit status to ${status}`)) {
    return;
  }
  const formattedDate = getFormattedNow();
  const currentDateStr = formattedDate.slice(0, 10);

  let targetUnit: ProtoUnit | null = null;
  const updated = protoUnitsCache.map(u => {
    if (u.id === id) {
      const isFinishing = status === 'finished';
      const isStopping = status === 'stopped';
      const existingReport = u.reportDetails || {};
      
      const machineEndDateTime = isFinishing 
        ? formattedDate 
        : (isStopping ? formattedDate : '');

      const updatedReportDetails: ReportDetails = {
        ...existingReport,
        testCommenced: existingReport.testCommenced || getMachineStartDateTime(u),
        testCompleted: isFinishing 
          ? formattedDate 
          : (isStopping ? formattedDate : '-'),
      };

      targetUnit = {
        ...u,
        status,
        ...(typeof doneHour === 'number' ? { doneHour } : {}),
        updatedAt: formattedDate,
        ...(isFinishing ? { 
          completedAt: formattedDate,
          endDateTime: formattedDate,
          reportDetails: updatedReportDetails
        } : (isStopping ? {
          endDateTime: formattedDate,
          reportDetails: updatedReportDetails
        } : {
          endDateTime: '',
          completedAt: undefined,
          reportDetails: {
            ...existingReport,
            testCompleted: '-'
          }
        })),
      };
      return targetUnit;
    }
    return u;
  });
  saveLocalProtoUnits(updated);

  if (targetUnit) {
    syncProtoUnitToSupabase(targetUnit);
    syncProtoUnitToFirestore(targetUnit);
  }
}

export function transferProtoUnitToLive(id: string, initialDoneHour: number = 0): ProtoUnit | null {
  if (!requireOnlineForSave(`Transfer Proto Unit to Live`)) {
    return null;
  }
  const formattedDate = getFormattedNow();
  const currentDateStr = formattedDate.slice(0, 10);
  let transferredUnit: ProtoUnit | null = null;

  const updated = protoUnitsCache.map(u => {
    if (u.id === id) {
      transferredUnit = {
        ...u,
        status: 'live' as const,
        doneHour: initialDoneHour,
        createdAt: formattedDate,
        updatedAt: formattedDate,
        endDateTime: '',
        completedAt: undefined,
        reportDetails: {
          ...(u.reportDetails || {}),
          testCommenced: currentDateStr,
          testCompleted: '-', // Reset completion date to '-' since unit is in live testing
        }
      };
      return transferredUnit;
    }
    return u;
  });

  saveLocalProtoUnits(updated);

  if (transferredUnit) {
    syncProtoUnitToSupabase(transferredUnit);
    syncProtoUnitToFirestore(transferredUnit);
    addLabNotification(
      `Proto Unit Transferred to Live: ${(transferredUnit as ProtoUnit).modelName}`,
      `Station: ${(transferredUnit as ProtoUnit).station || 'Station 01'} | Resumed live testing from ${initialDoneHour}h`,
      'info'
    );
  }

  return transferredUnit;
}

export function updateProtoUnit(id: string, updates: Partial<ProtoUnit>): ProtoUnit | null {
  if (!requireOnlineForSave(`Update Proto Unit (${id})`)) {
    return null;
  }
  const formattedDate = getFormattedNow();
  let updatedUnit: ProtoUnit | null = null;

  const normalizedUpdates = { ...updates };
  if (updates.photos) {
    const norm = buildNormalizedPhotos(updates.photos);
    normalizedUpdates.photos = norm.photos;
  }

  const updated = protoUnitsCache.map(u => {
    if (u.id === id) {
      const merged = {
        ...u,
        ...normalizedUpdates,
        updatedAt: formattedDate,
      };

      // Auto-sync End Date & Time and Test Completed
      const autoEndDateTime = getMachineEndDateTime(merged);
      const existingReport = merged.reportDetails || {};
      const syncedTestCompleted = normalizedUpdates.reportDetails?.testCompleted || normalizedUpdates.endDateTime || (autoEndDateTime !== 'N/A' ? autoEndDateTime : '');

      updatedUnit = {
        ...merged,
        endDateTime: (syncedTestCompleted && syncedTestCompleted !== 'N/A') ? syncedTestCompleted : merged.endDateTime,
        reportDetails: {
          ...existingReport,
          testCommenced: existingReport.testCommenced || getMachineStartDateTime(merged),
          testCompleted: (syncedTestCompleted && syncedTestCompleted !== 'N/A') ? syncedTestCompleted : (existingReport.testCompleted || ''),
        }
      };
      return updatedUnit;
    }
    return u;
  });

  saveLocalProtoUnits(updated);

  if (updatedUnit) {
    syncProtoUnitToSupabase(updatedUnit);
    syncProtoUnitToFirestore(updatedUnit);
  }

  return updatedUnit;
}

export function deleteProtoUnit(id: string): void {
  markProtoUnitDeleted(id);
  const updated = protoUnitsCache.filter(u => u.id !== id);
  saveLocalProtoUnits(updated);

  broadcastLabRealtimeEvent('proto_units_change', { deletedId: id, timestamp: Date.now() });

  // Delete from Supabase & Firestore asynchronously
  deleteProtoUnitFromSupabase(id).catch(err => console.warn('[ProtoUnitStore] Supabase delete note:', err));
  deleteProtoUnitFromFirestore(id).catch(err => console.warn('[ProtoUnitStore] Firestore delete note:', err));
}

export function addProtoUnitObservation(id: string, text: string): ProtoUnit | null {
  if (!requireOnlineForSave(`Add Observation to Proto Unit (${id})`)) {
    return null;
  }
  const formattedDate = getFormattedNow();
  let updatedUnit: ProtoUnit | null = null;

  const updated = protoUnitsCache.map(u => {
    if (u.id === id) {
      const existingObs = u.observations || [];
      const newObs = {
        id: `obs-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        text: text.trim(),
        timestamp: formattedDate
      };
      updatedUnit = {
        ...u,
        observations: [newObs, ...existingObs],
        updatedAt: formattedDate
      };
      return updatedUnit;
    }
    return u;
  });

  saveLocalProtoUnits(updated);

  if (updatedUnit) {
    syncProtoUnitToSupabase(updatedUnit);
    syncProtoUnitToFirestore(updatedUnit);
  }

  return updatedUnit;
}

export function deleteProtoUnitObservation(id: string, obsId: string): ProtoUnit | null {
  if (!requireOnlineForSave(`Delete Observation on Proto Unit (${id})`)) {
    return null;
  }
  const formattedDate = getFormattedNow();
  let updatedUnit: ProtoUnit | null = null;

  const updated = protoUnitsCache.map(u => {
    if (u.id === id) {
      const existingObs = u.observations || [];
      updatedUnit = {
        ...u,
        observations: existingObs.filter(o => o.id !== obsId),
        updatedAt: formattedDate
      };
      return updatedUnit;
    }
    return u;
  });

  saveLocalProtoUnits(updated);

  if (updatedUnit) {
    syncProtoUnitToSupabase(updatedUnit);
    syncProtoUnitToFirestore(updatedUnit);
  }

  return updatedUnit;
}

export function getAllProtoUnits(): ProtoUnit[] {
  return [...protoUnitsCache];
}

export function setProtoUnitsDirectly(units: ProtoUnit[]) {
  saveLocalProtoUnits(units);
}

export function clearAllProtoUnits() {
  saveLocalProtoUnits([]);
}
