import { PpUnit } from '../types';
import { addLabNotification } from './unitStore';
import { formatShortDateTime, getMachineEndDateTime, getMachineStartDateTime } from '../utils/dateFormatter';
import { 
  syncPpUnitToSupabase, 
  deletePpUnitFromSupabase, 
  fetchPpUnitsFromSupabase,
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

const STORAGE_KEY_PP_UNITS = 'llt_pp_units_v1';
const DELETED_PP_UNITS_KEY = 'llt_deleted_pp_units_v1';

// Helper to track explicitly deleted unit IDs to prevent resurrection during sync
function getDeletedPpUnitIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_PP_UNITS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markPpUnitDeleted(id: string) {
  const set = getDeletedPpUnitIds();
  set.add(id);
  try {
    localStorage.setItem(DELETED_PP_UNITS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

function unmarkPpUnitDeleted(id: string) {
  const set = getDeletedPpUnitIds();
  if (set.has(id)) {
    set.delete(id);
    try {
      localStorage.setItem(DELETED_PP_UNITS_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  }
}

// Helper to generate a random unique 5-digit string (e.g., "54321")
export function generatePp5DigitSerial(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

const INITIAL_PP_UNITS: PpUnit[] = [];

let ppUnitsCache: PpUnit[] = loadLocalPpUnits();
const listeners: Set<() => void> = new Set();

// Asynchronously hydrate full fidelity photos from IndexedDB on startup
if (typeof window !== 'undefined') {
  idbGetAll<PpUnit>('pp_units').then(idbUnits => {
    if (idbUnits && idbUnits.length > 0) {
      ppUnitsCache = restorePhotosFromIdb(ppUnitsCache, idbUnits);
      notifyListeners();
    }
  }).catch(err => {
    console.warn('[PpStore] IDB hydration note:', err);
  });
}

// Local Inter-Tab Broadcast Channel
const localPpBus = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('llt_pp_bus') 
  : null;

if (localPpBus) {
  localPpBus.onmessage = () => {
    const loaded = loadLocalPpUnits();
    ppUnitsCache = restorePhotosFromIdb(loaded, ppUnitsCache);
    idbGetAll<PpUnit>('pp_units').then(idbUnits => {
      if (idbUnits && idbUnits.length > 0) {
        ppUnitsCache = restorePhotosFromIdb(ppUnitsCache, idbUnits);
        notifyListeners();
      }
    }).catch(() => {});
    notifyListeners();
  };
}

// Storage event listener
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY_PP_UNITS) {
      const loaded = loadLocalPpUnits();
      ppUnitsCache = restorePhotosFromIdb(loaded, ppUnitsCache);
      idbGetAll<PpUnit>('pp_units').then(idbUnits => {
        if (idbUnits && idbUnits.length > 0) {
          ppUnitsCache = restorePhotosFromIdb(ppUnitsCache, idbUnits);
          notifyListeners();
        }
      }).catch(() => {});
      notifyListeners();
    }
  });
}

// Global Supabase Realtime event listener
subscribeToLabRealtimeEvents((event, payload) => {
  if (event === 'pp_units_change') {
    if (payload?.deletedId) {
      markPpUnitDeleted(payload.deletedId);
      ppUnitsCache = ppUnitsCache.filter(u => u.id !== payload.deletedId);
      safeLocalStorageSet(STORAGE_KEY_PP_UNITS, ppUnitsCache);
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

export async function syncPpUnitToFirestore(unit: PpUnit) {
  if (!db || !unit || unit.id.startsWith('pp-idu-') || unit.id.startsWith('pp-odu-')) return;
  try {
    // 1. Direct Server Upload: upload each genuine photo to server unit_photos collection
    if (unit.photos && typeof unit.photos === 'object') {
      await uploadUnitPhotosToServer(unit.id, 'pp', unit.photos);
    }

    // 2. Persist main unit document safely without crashing 1MB limit
    const sanitized = enforceFirestoreDocSizeLimit(cleanForFirestore(unit));
    const docRef = doc(db, 'pp_units', unit.id);
    await setDoc(docRef, sanitized, { merge: true });
    if ((unit as any)._pendingSync) {
      delete (unit as any)._pendingSync;
      safeLocalStorageSet(STORAGE_KEY_PP_UNITS, ppUnitsCache);
    }
    console.log('Successfully synced PP Unit to Firebase Firestore server:', unit.id);
  } catch (e) {
    console.warn('Firestore PP Unit sync note:', e);
  }
}

export async function deletePpUnitFromFirestore(id: string) {
  if (!db) return;
  try {
    // Clean up photos from server collection
    await deleteUnitPhotosFromServer(id);
    const docRef = doc(db, 'pp_units', id);
    await deleteDoc(docRef);
  } catch (e) {
    console.warn('Firestore PP Unit delete note:', e);
  }
}

export async function fetchPpUnitsFromFirestore(): Promise<PpUnit[] | null> {
  if (!db) return null;
  try {
    const colRef = collection(db, 'pp_units');
    const snap = await getDocs(colRef);
    if (snap.empty) return null;

    // Direct Server Fetch: get all photos from Firestore server unit_photos collection
    let serverPhotosMap = new Map<string, Record<string, string>>();
    try {
      serverPhotosMap = await fetchAllUnitPhotosFromServer();
    } catch {}

    const list: PpUnit[] = [];
    snap.forEach(d => {
      const data = d.data() as PpUnit;
      if (data && !data.id.startsWith('pp-idu-') && !data.id.startsWith('pp-odu-')) {
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
    console.warn('Firestore PP Unit fetch note:', e);
    return null;
  }
}

/**
 * Merges incoming remote records with the local cache in a NON-DESTRUCTIVE manner.
 * Prioritizes remote records as the cloud source of truth, while preserving any
 * locally created units that are currently pending cloud upload.
 */
function mergeWithLocalCache(remoteUnits: PpUnit[]): PpUnit[] {
  const deleted = getDeletedPpUnitIds();
  const map = new Map<string, PpUnit>();

  // 1. All valid remote units from Firestore / cloud
  remoteUnits.forEach(rem => {
    if (!rem || !rem.id || deleted.has(rem.id)) return;
    const local = ppUnitsCache.find(l => l.id === rem.id);
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
  protoUnitsLoop:
  ppUnitsCache.forEach(local => {
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
  const deleted = getDeletedPpUnitIds();
  ppUnitsCache.forEach(u => {
    if (u && !deleted.has(u.id) && !u.id.startsWith('pp-idu-') && !u.id.startsWith('pp-odu-')) {
      if ((u as any)._pendingSync) {
        syncPpUnitToFirestore(u);
      }
    }
  });
}

// Attach Real-Time Firestore Listener for Live Multi-Device Sync with auto-reconnect
let unsubscribePpFirestore: (() => void) | null = null;
let isSettingUpPpListener = false;

function setupFirestoreListener() {
  if (!db || isSettingUpPpListener) return;
  isSettingUpPpListener = true;
  try {
    if (unsubscribePpFirestore) {
      try { unsubscribePpFirestore(); } catch {}
      unsubscribePpFirestore = null;
    }
    const colRef = collection(db, 'pp_units');
    unsubscribePpFirestore = onSnapshot(colRef, async (snap: any) => {
      if (snap) {
        const list: PpUnit[] = [];
        snap.forEach((d: any) => {
          const data = d.data() as PpUnit;
          if (data && !data.id.startsWith('pp-idu-') && !data.id.startsWith('pp-odu-')) {
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
        ppUnitsCache = merged;
        safeLocalStorageSet(STORAGE_KEY_PP_UNITS, merged);
        idbSaveAll('pp_units', merged);
        notifyListeners();
      }
    }, (err: any) => {
      console.warn('[PPUnitStore] Real-time listener error, scheduling reconnect:', err);
      setTimeout(() => {
        isSettingUpPpListener = false;
        setupFirestoreListener();
      }, 3000);
    });
  } catch (e) {
    console.warn('[PPUnitStore] Could not set up real-time listener:', e);
    setTimeout(() => {
      isSettingUpPpListener = false;
      setupFirestoreListener();
    }, 5000);
  } finally {
    isSettingUpPpListener = false;
  }
}

if (db) {
  setupFirestoreListener();
}

// Automatically fetch from Firestore / Supabase on init
initDataSync();

export async function forceSyncPpUnits(): Promise<PpUnit[]> {
  await initDataSync();
  return getPpUnits();
}

async function initDataSync() {
  try {
    // Try fetching from Firestore first
    const firestoreData = await fetchPpUnitsFromFirestore();
    if (firestoreData && firestoreData.length > 0) {
      const clean = firestoreData.filter(u => u && !u.id.startsWith('pp-idu-') && !u.id.startsWith('pp-odu-'));
      const merged = mergeWithLocalCache(clean);
      ppUnitsCache = merged;
      safeLocalStorageSet(STORAGE_KEY_PP_UNITS, merged);
      idbSaveAll('pp_units', merged);
      notifyListeners();
      pushPendingLocalUnitsToFirestore();
      return;
    }

    // Fallback to Supabase
    const remoteData = await fetchPpUnitsFromSupabase();
    if (remoteData && remoteData.length > 0) {
      const cleanRemote = remoteData.filter(u => u && !u.id.startsWith('pp-idu-') && !u.id.startsWith('pp-odu-'));
      const merged = mergeWithLocalCache(cleanRemote);
      ppUnitsCache = merged;
      safeLocalStorageSet(STORAGE_KEY_PP_UNITS, merged);
      idbSaveAll('pp_units', merged);
      notifyListeners();
      cleanRemote.forEach(u => syncPpUnitToFirestore(u));
    }
  } catch (e) {
    console.warn('Data sync note in PP Store:', e);
  }
}

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export function subscribePpUnitStore(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function saveLocalPpUnits(data: PpUnit[]) {
  const clean = (data || []).filter(u => u && !u.id.startsWith('pp-idu-') && !u.id.startsWith('pp-odu-'));
  ppUnitsCache = clean;
  // Always persist full data with all photos to IndexedDB
  idbSaveAll('pp_units', clean);
  // Persist clean copy to localStorage
  safeLocalStorageSet(STORAGE_KEY_PP_UNITS, clean);
  if (localPpBus) {
    try { localPpBus.postMessage({ timestamp: Date.now() }); } catch {}
  }
  broadcastLabRealtimeEvent('pp_units_change', { timestamp: Date.now() });
  notifyListeners();
}

function loadLocalPpUnits(): PpUnit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PP_UNITS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((u: any) => u && !u.id.startsWith('pp-idu-') && !u.id.startsWith('pp-odu-'));
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

export function getPpUnits(): PpUnit[] {
  return [...ppUnitsCache];
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

export function addPpUnit(unit: Omit<PpUnit, 'id' | 'createdAt' | 'updatedAt'> & { status?: 'live' | 'stopped' | 'finished' }): PpUnit | null {
  if (!requireOnlineForSave(`Add PP Unit: ${unit.modelName || 'New Unit'}`)) {
    return null;
  }
  const formattedDate = getFormattedNow();
  const sanitizedUnit = sanitizeStringFields(unit);

  const normalized = buildNormalizedPhotos(sanitizedUnit.photos || {});

  const newUnit: PpUnit = {
    ...sanitizedUnit,
    photos: normalized.photos,
    id: `pp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    status: sanitizedUnit.status || 'live',
    createdAt: formattedDate,
    updatedAt: formattedDate,
  };
  (newUnit as any)._pendingSync = true;
  unmarkPpUnitDeleted(newUnit.id);

  const updated = [newUnit, ...ppUnitsCache];
  saveLocalPpUnits(updated);

  // Sync to Supabase & Firebase Firestore
  syncPpUnitToSupabase(newUnit);
  syncPpUnitToFirestore(newUnit);

  addLabNotification(
    `PP Unit Added: ${newUnit.modelName}`,
    `Station: ${newUnit.station} | IDU: ${newUnit.iduSerialNumber || 'NA'}, ODU: ${newUnit.oduSerialNumber || 'NA'}`
  );

  return newUnit;
}

export function updatePpUnit(id: string, updates: Partial<PpUnit>): PpUnit | null {
  if (!requireOnlineForSave(`Update PP Unit (${id})`)) {
    return null;
  }
  const formattedDate = getFormattedNow();
  let targetUnit: PpUnit | null = null;
  const updated = ppUnitsCache.map(u => {
    if (u.id === id) {
      targetUnit = {
        ...u,
        ...updates,
        updatedAt: formattedDate,
      };
      return targetUnit;
    }
    return u;
  });
  saveLocalPpUnits(updated);

  if (targetUnit) {
    syncPpUnitToSupabase(targetUnit);
    syncPpUnitToFirestore(targetUnit);
  }
  return targetUnit;
}

export function togglePpUnitStatus(id: string, newStatus: 'live' | 'finished' | 'stopped'): PpUnit | null {
  if (!requireOnlineForSave(`Change PP Unit status to ${newStatus}`)) {
    return null;
  }
  const formattedDate = getFormattedNow();
  let targetUnit: PpUnit | null = null;
  const updated = ppUnitsCache.map(u => {
    if (u.id === id) {
      const isFinOrStopped = newStatus === 'finished' || newStatus === 'stopped';
      const resolvedEnd = isFinOrStopped ? formattedDate : u.endDateTime;
      const currentReport = u.reportDetails || {};

      targetUnit = {
        ...u,
        status: newStatus,
        updatedAt: formattedDate,
        ...(isFinOrStopped ? {
          endDateTime: resolvedEnd,
          completedAt: newStatus === 'finished' ? formattedDate : (u as any).completedAt,
          reportDetails: {
            ...currentReport,
            testCommenced: currentReport.testCommenced || getMachineStartDateTime(u),
            testCompleted: formattedDate,
          }
        } : {})
      };
      return targetUnit;
    }
    return u;
  });
  saveLocalPpUnits(updated);

  if (targetUnit) {
    syncPpUnitToSupabase(targetUnit);
    syncPpUnitToFirestore(targetUnit);
  }
  return targetUnit;
}

export function updatePpUnitStatus(id: string, status: 'live' | 'finished' | 'stopped', finalDoneHours?: number): void {
  if (!requireOnlineForSave(`Update PP Unit status to ${status}`)) {
    return;
  }
  const formattedDate = getFormattedNow();

  let targetUnit: PpUnit | null = null;
  const updated = ppUnitsCache.map(u => {
    if (u.id === id) {
      const isFinOrStopped = status === 'finished' || status === 'stopped';
      const resolvedEnd = isFinOrStopped ? formattedDate : '';
      const currentReport = u.reportDetails || {};

      targetUnit = {
        ...u,
        status,
        ...(typeof finalDoneHours === 'number' ? { doneHour: finalDoneHours } : {}),
        updatedAt: formattedDate,
        ...(isFinOrStopped ? {
          endDateTime: resolvedEnd,
          completedAt: status === 'finished' ? formattedDate : (u as any).completedAt,
          reportDetails: {
            ...currentReport,
            testCommenced: currentReport.testCommenced || getMachineStartDateTime(u),
            testCompleted: formattedDate,
          }
        } : {
          endDateTime: '',
          completedAt: undefined,
          reportDetails: {
            ...currentReport,
            testCompleted: '-',
          }
        })
      };
      return targetUnit;
    }
    return u;
  });
  saveLocalPpUnits(updated);

  if (targetUnit) {
    syncPpUnitToSupabase(targetUnit);
    syncPpUnitToFirestore(targetUnit);
  }
}

export function passPpUnitWithDetails(
  id: string, 
  startDate?: string, 
  endDate?: string, 
  calculatedHours?: number
): void {
  if (!requireOnlineForSave(`Pass PP Unit (${id})`)) {
    return;
  }
  const formattedNow = getFormattedNow();

  let targetUnit: PpUnit | null = null;
  const updated = ppUnitsCache.map(u => {
    if (u.id === id) {
      let finalHours = u.requiredHour;
      if (typeof calculatedHours === 'number' && calculatedHours > 0) {
        finalHours = calculatedHours;
      } else if (startDate && endDate) {
        const startMs = new Date(startDate.replace(' ', 'T')).getTime();
        const endMs = new Date(endDate.replace(' ', 'T')).getTime();
        if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
          const diffHours = (endMs - startMs) / (1000 * 60 * 60);
          finalHours = Number(diffHours.toFixed(1));
        }
      }

      targetUnit = {
        ...u,
        status: 'finished',
        requiredHour: finalHours,
        createdAt: startDate || u.createdAt,
        updatedAt: endDate || formattedNow,
      };
      return targetUnit;
    }
    return u;
  });
  saveLocalPpUnits(updated);

  if (targetUnit) {
    syncPpUnitToSupabase(targetUnit);
    syncPpUnitToFirestore(targetUnit);
  }
}

export function deletePpUnit(id: string): void {
  markPpUnitDeleted(id);
  const updated = ppUnitsCache.filter(u => u.id !== id);
  saveLocalPpUnits(updated);

  broadcastLabRealtimeEvent('pp_units_change', { deletedId: id, timestamp: Date.now() });

  // Delete from Supabase & Firestore asynchronously
  deletePpUnitFromSupabase(id).catch(err => console.warn('[PPUnitStore] Supabase delete note:', err));
  deletePpUnitFromFirestore(id).catch(err => console.warn('[PPUnitStore] Firestore delete note:', err));
}

export function addPpUnitObservation(id: string, text: string): PpUnit | null {
  const formattedDate = getFormattedNow();
  let updatedUnit: PpUnit | null = null;

  const updated = ppUnitsCache.map(u => {
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

  saveLocalPpUnits(updated);

  if (updatedUnit) {
    syncPpUnitToSupabase(updatedUnit);
    syncPpUnitToFirestore(updatedUnit);
  }

  return updatedUnit;
}

export function deletePpUnitObservation(id: string, obsId: string): PpUnit | null {
  const formattedDate = getFormattedNow();
  let updatedUnit: PpUnit | null = null;

  const updated = ppUnitsCache.map(u => {
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

  saveLocalPpUnits(updated);

  if (updatedUnit) {
    syncPpUnitToSupabase(updatedUnit);
    syncPpUnitToFirestore(updatedUnit);
  }

  return updatedUnit;
}

/* ==========================================
   PP UNIT DASHBOARD METRICS & MATCHING LOGIC
   ========================================== */

export function extractNumbersKey(str: string): string {
  if (!str) return '';
  const cleaned = str.split(':')[0];
  const matches = cleaned.match(/\d+/g);
  if (!matches || matches.length === 0) return '';
  return matches.join('-');
}

export function getSubseries(str: string): string {
  if (!str) return '';
  const cleaned = str.split(':')[0];
  const m = cleaned.match(/HS[IO](\d+)([A-Z]+)?/i);
  return m && m[2] ? m[2].toUpperCase() : '';
}

export function getCapacityNumber(str: string): string {
  if (!str) return '';
  const cleaned = str.split(':')[0];
  const m = cleaned.match(/HS[IO](\d+)/i);
  return m ? m[1] : '';
}

export function updatePpUnitQuantity(id: string, newQty: number): void {
  const formattedDate = getFormattedNow();
  let targetUnit: PpUnit | null = null;
  const updated = ppUnitsCache.map(u => {
    if (u.id === id) {
      targetUnit = {
        ...u,
        quantity: Math.max(0, newQty),
        updatedAt: formattedDate,
      };
      return targetUnit;
    }
    return u;
  });
  saveLocalPpUnits(updated);

  if (targetUnit) {
    syncPpUnitToSupabase(targetUnit);
    syncPpUnitToFirestore(targetUnit);
  }
}

export function isUnitTestingEntry(u: PpUnit): boolean {
  if (!u) return false;
  // If explicitly flagged
  if (u.entrySource === 'unit_testing') return true;
  if (u.entrySource === 'model_list' || u.isModelOnly === true) return false;

  // Check testPurpose for model registration keywords
  const purpose = (u.testPurpose || '').toLowerCase();
  if (
    purpose.includes('model registration') || 
    purpose.includes('master database') || 
    purpose.includes('idu model') || 
    purpose.includes('odu model')
  ) {
    return false;
  }

  // A genuine unit testing run submitted via AddPpUnitDialog has sampleType, reportDetails, namePlate, or partsInfo
  if (u.sampleType && u.sampleType.trim() !== '' && u.sampleType !== 'NA') {
    return true;
  }
  if (u.reportDetails && Object.keys(u.reportDetails).length > 0) {
    return true;
  }
  if (u.namePlate && Object.keys(u.namePlate).length > 0) {
    return true;
  }
  if (u.fourWaySwing && u.fourWaySwing !== 'NA') {
    return true;
  }
  if (u.rpm && u.rpm !== 'NA') {
    return true;
  }

  // Default fallback: if no testing form details exist, treat as model registration
  return false;
}

export function isModelListEntry(u: PpUnit): boolean {
  return !isUnitTestingEntry(u);
}

export interface MatchedPairResult {
  id: string;
  commonKey: string;
  iduModel: string;
  iduQty: number;
  oduModel: string;
  oduQty: number;
  matchedQty: number;
  balanceIduQty: number;
  balanceOduQty: number;
  status: 'Fully Matched' | 'Partially Matched' | 'IDU Available but ODU Not Available' | 'ODU Available but IDU Not Available' | 'Unmatched Models';
  iduItem?: PpUnit;
  oduItem?: PpUnit;
  // Unit Testing match status
  isPending: boolean;
  testingStatus: 'live' | 'stopped' | 'finished' | null;
  matchedTestingUnits: PpUnit[];
}

export function isModelMatchingSet(tu: PpUnit, iduItem?: PpUnit, oduItem?: PpUnit, commonKey?: string): boolean {
  if (!tu) return false;

  const normalize = (str?: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizeVer = (v?: string) => (v || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^v/, '');

  const iduName = (iduItem?.modelName || '').trim().toLowerCase();
  const oduName = (oduItem?.modelName || '').trim().toLowerCase();
  const testName = (tu.modelName || '').trim().toLowerCase();

  const iduNorm = normalize(iduItem?.modelName);
  const oduNorm = normalize(oduItem?.modelName);
  const testNorm = normalize(tu.modelName);

  const tuVer = normalizeVer(tu.version);
  const iduVer = normalizeVer(iduItem?.version);
  const oduVer = normalizeVer(oduItem?.version);

  // Version match helper:
  // If testing unit specifies a version (e.g. 10 or 20) and model specifies a version,
  // they must match so version 10 testing does not prematurely satisfy version 20.
  const isIduVersionCompatible = () => {
    if (!tuVer || !iduVer) return true;
    return tuVer === iduVer;
  };

  const isOduVersionCompatible = () => {
    if (!tuVer || !oduVer) return true;
    return tuVer === oduVer;
  };

  // 1. Direct text match or normalized substring match with version validation
  if (testNorm) {
    if (iduNorm && (testNorm === iduNorm || testNorm.includes(iduNorm) || iduNorm.includes(testNorm))) {
      if (isIduVersionCompatible()) return true;
    }
    if (oduNorm && (testNorm === oduNorm || testNorm.includes(oduNorm) || oduNorm.includes(testNorm))) {
      if (isOduVersionCompatible()) return true;
    }
    if (iduName && testName.includes(iduName) && isIduVersionCompatible()) return true;
    if (oduName && testName.includes(oduName) && isOduVersionCompatible()) return true;
  }

  // 2. Serial number match
  if (tu.iduSerialNumber && iduItem?.iduSerialNumber && tu.iduSerialNumber.trim() !== '' && tu.iduSerialNumber === iduItem.iduSerialNumber) {
    return true;
  }
  if (tu.oduSerialNumber && oduItem?.oduSerialNumber && tu.oduSerialNumber.trim() !== '' && tu.oduSerialNumber === oduItem.oduSerialNumber) {
    return true;
  }

  // 3. Material Code match
  if (tu.materialCode && tu.materialCode.trim() !== '' && tu.materialCode !== 'NA') {
    if (iduItem?.materialCode && tu.materialCode === iduItem.materialCode && isIduVersionCompatible()) return true;
    if (oduItem?.materialCode && tu.materialCode === oduItem.materialCode && isOduVersionCompatible()) return true;
  }

  // 4. Common key match if sufficiently descriptive
  if (commonKey && commonKey.length >= 4) {
    const keyNorm = normalize(commonKey);
    if (keyNorm && testNorm.includes(keyNorm)) {
      if (isIduVersionCompatible() || isOduVersionCompatible()) return true;
    }
  }

  return false;
}

export function getIduOduMatchingPairs(units?: PpUnit[]): MatchedPairResult[] {
  const allUnits = units && units.length > 0 ? units : ppUnitsCache;
  const rawModelUnits = allUnits.filter(isModelListEntry);
  const testingUnits = allUnits.filter(isUnitTestingEntry);

  // If models are registered, use models for pairing; otherwise fallback to all cached model entries or allUnits
  const modelUnits = rawModelUnits.length > 0 ? rawModelUnits : ppUnitsCache.filter(isModelListEntry);
  const unitsToMatch = modelUnits.length > 0 ? modelUnits : allUnits;

  const iduList: PpUnit[] = [];
  const oduList: PpUnit[] = [];

  unitsToMatch.forEach(u => {
    const isIdu = u.unitType === 'IDU' || Boolean(u.iduSerialNumber && !u.oduSerialNumber) || u.modelName.toUpperCase().includes('HSI') || u.modelName.toUpperCase().includes('IDU');
    const isOdu = u.unitType === 'ODU' || Boolean(u.oduSerialNumber && !u.iduSerialNumber) || u.modelName.toUpperCase().includes('HSO') || u.modelName.toUpperCase().includes('ODU');

    if (isIdu && !isOdu) {
      iduList.push(u);
    } else if (isOdu && !isIdu) {
      oduList.push(u);
    } else if (u.unitType === 'BOTH') {
      iduList.push(u);
      oduList.push(u);
    }
  });

  const normalizeVer = (v?: string) => (v || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^v/, '');
  const pairedOduIds = new Set<string>();
  const results: MatchedPairResult[] = [];

  // Pair each IDU with its compatible ODU
  // Common Model & Version Support:
  // - One ODU can pair with multiple IDU models to form distinct sets (e.g. HSO19-5NB-I with HSI19GHD-MAI5NB-I and HSI19GHD-PAI5NB-I).
  // - Different versions (e.g. Version 10 vs Version 20) are treated as distinct entities.
  iduList.forEach(idu => {
    const iduKey = extractNumbersKey(idu.modelName);
    const iduSub = getSubseries(idu.modelName);
    const iduCap = getCapacityNumber(idu.modelName);
    const iduVerClean = normalizeVer(idu.version);

    // 1. Exact numbers key match (e.g. 19-5 with 19-5, 14-3 with 14-3)
    let candidates = oduList.filter(o => extractNumbersKey(o.modelName) === iduKey);

    // 2. If no exact numbers key match, fallback to capacity match (e.g. 19 series)
    if (candidates.length === 0 && iduCap) {
      candidates = oduList.filter(o => getCapacityNumber(o.modelName) === iduCap);
    }

    let matchedOduList: PpUnit[] = [];

    if (candidates.length === 1) {
      matchedOduList = [candidates[0]];
    } else if (candidates.length > 1) {
      // Check if candidates have distinct versions (e.g. V10 and V20 of the same model)
      const versionGroups = new Map<string, PpUnit>();
      candidates.forEach(c => {
        const vKey = normalizeVer(c.version) || 'v10';
        if (!versionGroups.has(vKey)) {
          versionGroups.set(vKey, c);
        }
      });

      // If IDU has a matching version, pair specifically with that version
      if (iduVerClean && versionGroups.has(iduVerClean)) {
        matchedOduList = [versionGroups.get(iduVerClean)!];
      } else if (versionGroups.size > 1 && candidates.every(c => c.modelName.trim().toLowerCase() === candidates[0].modelName.trim().toLowerCase())) {
        // Same model with multiple registered versions (e.g. HSO14-3NB-I with V10 and V20)
        // Each version is an updated machine that forms its own testing set!
        matchedOduList = Array.from(versionGroups.values());
      } else {
        // Check subseries match (e.g. GHD with GHD)
        let subMatched = iduSub ? candidates.find(o => getSubseries(o.modelName) === iduSub) : null;
        matchedOduList = [subMatched || candidates[0]];
      }
    }

    const setKey = iduKey || iduCap || 'Set';

    if (matchedOduList.length > 0) {
      matchedOduList.forEach(matchedOdu => {
        pairedOduIds.add(matchedOdu.id);

        // Check if this set is matched in Unit Testing (Live, Stopped, Finished)
        const matchedTesting = testingUnits.filter(tu =>
          isModelMatchingSet(tu, idu, matchedOdu, setKey)
        );

        const isPending = matchedTesting.length === 0;
        const activeTestUnit = matchedTesting.find(tu => tu.status === 'live') ||
                               matchedTesting.find(tu => tu.status === 'stopped') ||
                               matchedTesting.find(tu => tu.status === 'finished') || null;

        results.push({
          id: `set-${idu.id}-${matchedOdu.id}`,
          commonKey: setKey,
          iduModel: idu.modelName,
          iduQty: typeof idu.quantity === 'number' ? Math.max(1, idu.quantity) : 1,
          oduModel: matchedOdu.modelName,
          oduQty: typeof matchedOdu.quantity === 'number' ? Math.max(1, matchedOdu.quantity) : 1,
          matchedQty: 1,
          balanceIduQty: 0,
          balanceOduQty: 0,
          status: 'Fully Matched',
          iduItem: idu,
          oduItem: matchedOdu,
          isPending,
          testingStatus: activeTestUnit?.status || null,
          matchedTestingUnits: matchedTesting,
        });
      });
    } else {
      // IDU without matching ODU
      results.push({
        id: `unmatched-idu-${idu.id}`,
        commonKey: setKey,
        iduModel: idu.modelName,
        iduQty: typeof idu.quantity === 'number' ? Math.max(1, idu.quantity) : 1,
        oduModel: 'N/A (No Matching ODU)',
        oduQty: 0,
        matchedQty: 0,
        balanceIduQty: typeof idu.quantity === 'number' ? Math.max(1, idu.quantity) : 1,
        balanceOduQty: 0,
        status: 'IDU Available but ODU Not Available',
        iduItem: idu,
        isPending: true,
        testingStatus: null,
        matchedTestingUnits: [],
      });
    }
  });

  // Check any ODU that wasn't paired with any IDU
  oduList.forEach(odu => {
    if (!pairedOduIds.has(odu.id)) {
      const oduKey = extractNumbersKey(odu.modelName);
      const oduCap = getCapacityNumber(odu.modelName);
      const setKey = oduKey || oduCap || 'Set';

      results.push({
        id: `unmatched-odu-${odu.id}`,
        commonKey: setKey,
        iduModel: 'N/A (No Matching IDU)',
        iduQty: 0,
        oduModel: odu.modelName,
        oduQty: typeof odu.quantity === 'number' ? Math.max(1, odu.quantity) : 1,
        matchedQty: 0,
        balanceIduQty: 0,
        balanceOduQty: typeof odu.quantity === 'number' ? Math.max(1, odu.quantity) : 1,
        status: 'ODU Available but IDU Not Available',
        oduItem: odu,
        isPending: true,
        testingStatus: null,
        matchedTestingUnits: [],
      });
    }
  });

  const priorityOrder: { [key in MatchedPairResult['status']]: number } = {
    'Fully Matched': 1,
    'Partially Matched': 2,
    'IDU Available but ODU Not Available': 3,
    'ODU Available but IDU Not Available': 4,
    'Unmatched Models': 5,
  };

  return results.sort((a, b) => priorityOrder[a.status] - priorityOrder[b.status]);
}

export interface PpUnitDashboardMetrics {
  iduQty: number;      // machines under Model List IDU
  oduQty: number;      // machines under Model List ODU
  bothQty: number;     // matched sets under Model List BOTH formed by IDU+ODU matching
  liveQty: number;     // units in Unit Testing with status === 'live'
  stoppedQty: number;  // units in Unit Testing with status === 'stopped'
  finishedQty: number; // units in Unit Testing with status === 'finished'
  pendingQty: number;  // BOTH sets that do NOT match any unit in Unit Testing (Live/Stop/Finished)
  pendingModels: MatchedPairResult[];
  matchedModels: MatchedPairResult[];
  bothPairs: MatchedPairResult[];
}

export function calculatePpUnitMetrics(units?: PpUnit[]): PpUnitDashboardMetrics {
  const allUnits = units && units.length > 0 ? units : ppUnitsCache;
  const modelUnits = allUnits.filter(isModelListEntry);
  const testingUnits = allUnits.filter(isUnitTestingEntry);

  const effectiveModels = modelUnits.length > 0 ? modelUnits : allUnits;

  // 1. IDU Qty: Total machine quantity under Model List IDU
  let iduQty = 0;
  effectiveModels.forEach(u => {
    const isIdu = u.unitType === 'IDU' || Boolean(u.iduSerialNumber && !u.oduSerialNumber) || u.modelName.toUpperCase().includes('HSI') || u.modelName.toUpperCase().includes('IDU');
    const isOdu = u.unitType === 'ODU' || Boolean(u.oduSerialNumber && !u.iduSerialNumber) || u.modelName.toUpperCase().includes('HSO') || u.modelName.toUpperCase().includes('ODU');
    if (isIdu && !isOdu) {
      iduQty += (typeof u.quantity === 'number' ? Math.max(1, u.quantity) : 1);
    } else if (u.unitType === 'BOTH') {
      iduQty += (typeof u.quantity === 'number' ? Math.max(1, u.quantity) : 1);
    }
  });

  // 2. ODU Qty: Total machine quantity under Model List ODU
  let oduQty = 0;
  effectiveModels.forEach(u => {
    const isIdu = u.unitType === 'IDU' || Boolean(u.iduSerialNumber && !u.oduSerialNumber) || u.modelName.toUpperCase().includes('HSI') || u.modelName.toUpperCase().includes('IDU');
    const isOdu = u.unitType === 'ODU' || Boolean(u.oduSerialNumber && !u.iduSerialNumber) || u.modelName.toUpperCase().includes('HSO') || u.modelName.toUpperCase().includes('ODU');
    if (isOdu && !isIdu) {
      oduQty += (typeof u.quantity === 'number' ? Math.max(1, u.quantity) : 1);
    } else if (u.unitType === 'BOTH') {
      oduQty += (typeof u.quantity === 'number' ? Math.max(1, u.quantity) : 1);
    }
  });

  // 3. BOTH Qty: Total sets in Model List BOTH (IDU + ODU matching pairs)
  const bothPairs = getIduOduMatchingPairs(allUnits);
  const bothSets = bothPairs.filter(p => Boolean(p.iduItem && p.oduItem));
  // Total sets in BOTH view is bothSets.length (matches the exact number of sets shown in BOTH tab)
  const bothQty = bothSets.length;

  // 4. Unit Testing Live, Stopped, Finished quantities (ONLY actual unit testing form submissions)
  const liveQty = testingUnits.filter(u => u.status === 'live').length;
  const stoppedQty = testingUnits.filter(u => u.status === 'stopped').length;
  const finishedQty = testingUnits.filter(u => u.status === 'finished').length;

  // 5. Pending Qty:
  // "menu ke PP Unit ke Model list me jo BOTH hai usme jitni bhi machine set wo match krega Unit Testing ke Live, Stop, Finished ab enme jo Set model Match kr raha hai BOTH se wo thik hai. Jo Match nhi kr raha wo Dashboard me Pending me Qty daal dena."
  const pendingModels = bothSets.filter(p => p.isPending);
  const matchedModels = bothSets.filter(p => !p.isPending);
  const pendingQty = pendingModels.length;

  return {
    iduQty,
    oduQty,
    bothQty,
    liveQty,
    stoppedQty,
    finishedQty,
    pendingQty,
    pendingModels,
    matchedModels,
    bothPairs,
  };
}

export function getAllPpUnits(): PpUnit[] {
  return [...ppUnitsCache];
}

export function setPpUnitsDirectly(units: PpUnit[]) {
  saveLocalPpUnits(units);
}

export function clearAllPpUnits() {
  saveLocalPpUnits([]);
}

