import { addNotification } from './unitStore';
import { idbSaveAll, idbGetAll, safeLocalStorageSet, restorePhotosFromIdb } from '../lib/indexedDbStorage';
import { 
  syncReportRoomToSupabase, 
  deleteReportRoomFromSupabase, 
  fetchReportRoomFromSupabase,
  broadcastLabRealtimeEvent,
  subscribeToLabRealtimeEvents 
} from '../lib/supabase';
import { db, collection, doc, setDoc, deleteDoc, getDocs, onSnapshot } from './firebase';
import { requireOnlineForSave } from './networkManager';
import { cleanForFirestore, enforceFirestoreDocSizeLimit } from './firestoreSanitizer';

export type ReportTagType = 'C Simulation' | 'C Experience';
export type ReportCategoryKey = 'cs-simulation' | 'cs-experience';

export interface SavedReport {
  id: string;
  reportType: ReportCategoryKey; // 'cs-simulation' | 'cs-experience'
  tag: ReportTagType; // 'C Simulation' | 'C Experience'
  title: string;
  reportNo: string;
  modelName: string;
  unitSource: 'proto' | 'pp';
  serialNo: string;
  station?: string;
  requestBy?: string;
  createdAt: string; // e.g. '2026-08-17 10:45'
  generatedDate: string; // e.g. '2026-08-17'
  specs: {
    coolingCapacity?: string;
    powerMode?: string;
    refrigerant?: string;
    iseer?: string;
    iduMotorSpec?: string;
    iduMotorPartCode?: string;
    iduMotorSupplier?: string;
    iduPcbPartCode?: string;
    iduPcbSupplier?: string;
    oduMotorSpec?: string;
    oduMotorPartCode?: string;
    oduMotorSupplier?: string;
    oduPcbPartCode?: string;
    oduPcbSupplier?: string;
    compressorSpec?: string;
    compressorPartCode?: string;
    compressorSupplier?: string;
    eevSpec?: string;
    eevPartCode?: string;
    eevSupplier?: string;
    sampleReceivedDate?: string;
    testCommencedDate?: string;
    testCompletedDate?: string;
    testConclusion?: string;
  };
  dataValuesMap: Record<string, string>;
  photos: Record<string, string>;
  templateName?: string;
  status: 'Generated' | 'Verified' | 'Archived';
  remarks?: string;
}

const STORAGE_KEY_REPORT_ROOM = 'llt_report_room_saved_reports_v1';
const DELETED_REPORTS_KEY = 'llt_deleted_reports_v1';

function getDeletedReportIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_REPORTS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markReportDeleted(id: string) {
  const set = getDeletedReportIds();
  set.add(id);
  try {
    localStorage.setItem(DELETED_REPORTS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

function unmarkReportDeleted(id: string) {
  const set = getDeletedReportIds();
  if (set.has(id)) {
    set.delete(id);
    try {
      localStorage.setItem(DELETED_REPORTS_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  }
}

const INITIAL_SAVED_REPORTS: SavedReport[] = [];

let savedReportsCache: SavedReport[] = loadLocalReports();
let listeners: ((reports: SavedReport[]) => void)[] = [];

// Asynchronously hydrate full fidelity photos from IndexedDB on startup
if (typeof window !== 'undefined') {
  idbGetAll<SavedReport>('saved_reports').then(idbReports => {
    if (idbReports && idbReports.length > 0) {
      savedReportsCache = restorePhotosFromIdb(savedReportsCache, idbReports);
      notifyListeners(savedReportsCache);
    }
  }).catch(err => {
    console.warn('[ReportRoom] IDB hydration note:', err);
  });
}

// Local Inter-Tab Broadcast Channel
const localReportBus = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('llt_reports_bus') 
  : null;

if (localReportBus) {
  localReportBus.onmessage = () => {
    savedReportsCache = loadLocalReports();
    notifyListeners(savedReportsCache);
  };
}

// Storage event listener
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY_REPORT_ROOM) {
      savedReportsCache = loadLocalReports();
      notifyListeners(savedReportsCache);
    }
  });
}

// Global Supabase Realtime event listener
subscribeToLabRealtimeEvents((event, payload) => {
  if (event === 'reports_change') {
    if (payload?.deletedId) {
      markReportDeleted(payload.deletedId);
      savedReportsCache = savedReportsCache.filter(r => r.id !== payload.deletedId);
      persistReports(savedReportsCache);
      notifyListeners(savedReportsCache);
    } else {
      initCloudAndLocalReports();
    }
  }
});

// Periodic background sync: push un-synced items to Firestore
if (typeof window !== 'undefined') {
  setInterval(() => {
    pushPendingReportsToFirestore();
  }, 15000);
}

/* ==========================================
   FIREBASE FIRESTORE SYNC HELPERS FOR REPORTS & REAL-TIME LISTENER
   ========================================== */

export async function syncReportRoomToFirestore(report: SavedReport) {
  if (!db || !report || report.id === 'rep-cs-101' || report.id === 'rep-ce-102') return;
  try {
    const sanitized = enforceFirestoreDocSizeLimit(cleanForFirestore(report));
    const docRef = doc(db, 'report_room', report.id);
    await setDoc(docRef, sanitized, { merge: true });
    if ((report as any)._pendingSync) {
      delete (report as any)._pendingSync;
      persistReports(savedReportsCache);
    }
    console.log('Successfully synced Report to Firebase Firestore:', report.id);
  } catch (e) {
    console.warn('Firestore Report sync note:', e);
  }
}

export async function deleteReportRoomFromFirestore(id: string) {
  if (!db) return;
  try {
    const docRef = doc(db, 'report_room', id);
    await deleteDoc(docRef);
    await deleteDoc(doc(db, 'saved_reports', id)).catch(() => {});
    await deleteDoc(doc(db, 'reports', id)).catch(() => {});
    console.log('Successfully deleted report from Firebase Firestore:', id);
  } catch (e) {
    console.warn('Firestore Report delete note:', e);
  }
}

export async function fetchReportRoomFromFirestore(): Promise<SavedReport[] | null> {
  if (!db) return null;
  try {
    const colRef = collection(db, 'report_room');
    const snap = await getDocs(colRef);
    if (snap.empty) return null;
    const list: SavedReport[] = [];
    snap.forEach(d => {
      const data = d.data() as SavedReport;
      if (data && data.id !== 'rep-cs-101' && data.id !== 'rep-ce-102') {
        list.push(data);
      }
    });
    return list;
  } catch (e) {
    console.warn('Firestore Report fetch note:', e);
    return null;
  }
}

/**
 * Merges incoming remote reports with the local cache non-destructively.
 */
function mergeReportsWithLocal(remoteReports: SavedReport[]): SavedReport[] {
  const deleted = getDeletedReportIds();
  const map = new Map<string, SavedReport>();

  // Add all existing local reports that are not explicitly deleted
  savedReportsCache.forEach(r => {
    if (r && r.id && !deleted.has(r.id)) {
      map.set(r.id, r);
    }
  });

  // Integrate remote reports
  remoteReports.forEach(rem => {
    if (!rem || !rem.id || deleted.has(rem.id)) return;
    const local = map.get(rem.id);
    if (!local) {
      map.set(rem.id, rem);
    } else {
      if ((local as any)._pendingSync) {
        return;
      }
      const remTime = new Date(rem.createdAt || 0).getTime();
      const localTime = new Date(local.createdAt || 0).getTime();
      if (remTime >= localTime) {
        map.set(rem.id, rem);
      }
    }
  });

  const merged = Array.from(map.values());
  merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return merged;
}

function pushPendingReportsToFirestore() {
  const deleted = getDeletedReportIds();
  savedReportsCache.forEach(r => {
    if (r && !deleted.has(r.id) && !r.id.startsWith('rep-cs-101') && !r.id.startsWith('rep-ce-102')) {
      if ((r as any)._pendingSync) {
        syncReportRoomToFirestore(r);
      }
    }
  });
}

// Attach Real-Time Firestore Listener for Live Multi-Device Sync
if (db) {
  try {
    const colRef = collection(db, 'report_room');
    onSnapshot(colRef, (snap: any) => {
      if (snap) {
        const list: SavedReport[] = [];
        snap.forEach((d: any) => {
          const data = d.data() as SavedReport;
          if (data && data.id !== 'rep-cs-101' && data.id !== 'rep-ce-102') {
            list.push(data);
          }
        });
        
        const merged = mergeReportsWithLocal(list);
        savedReportsCache = merged;
        persistReports(merged);
        notifyListeners(merged);
      }
    }, (err: any) => {
      console.warn('[ReportRoom] Real-time listener error:', err);
    });
  } catch (e) {
    console.warn('[ReportRoom] Could not set up real-time listener:', e);
  }
}

// Initialize Cloud and IndexedDB async sync
initCloudAndLocalReports();

async function initCloudAndLocalReports() {
  try {
    const firestoreReports = await fetchReportRoomFromFirestore();
    if (firestoreReports && firestoreReports.length > 0) {
      const cleanFs = firestoreReports.filter(r => r && r.id !== 'rep-cs-101' && r.id !== 'rep-ce-102');
      const merged = mergeReportsWithLocal(cleanFs);
      savedReportsCache = merged;
      persistReports(merged);
      notifyListeners(merged);
      pushPendingReportsToFirestore();
      return;
    }

    const remoteReports = await fetchReportRoomFromSupabase();
    if (remoteReports && remoteReports.length > 0) {
      const cleanRemote = remoteReports.filter(r => r && r.id !== 'rep-cs-101' && r.id !== 'rep-ce-102');
      const merged = mergeReportsWithLocal(cleanRemote);
      savedReportsCache = merged;
      persistReports(merged);
      notifyListeners(merged);
      cleanRemote.forEach((r: SavedReport) => syncReportRoomToFirestore(r));
    }
  } catch (err) {
    console.warn('[ReportRoom] Failed to load from remote:', err);
  }
}

function loadLocalReports(): SavedReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REPORT_ROOM);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((r: any) => r && r.id !== 'rep-cs-101' && r.id !== 'rep-ce-102');
        return filtered.map((r: any) => {
          if (!r || typeof r !== 'object') return r;
          if (r.photos && typeof r.photos === 'object') {
            const cleanPhotos: Record<string, string> = {};
            Object.entries(r.photos).forEach(([k, v]) => {
              if (typeof v === 'string' && !v.includes('stored_in_idb') && (v.startsWith('data:image/') || v.startsWith('http') || v.startsWith('blob:'))) {
                cleanPhotos[k] = v;
              }
            });
            return { ...r, photos: cleanPhotos };
          }
          return r;
        });
      }
    }
    return [];
  } catch (err) {
    return [];
  }
}

function notifyListeners(reports: SavedReport[]) {
  listeners.forEach(fn => {
    try {
      fn(reports);
    } catch (err) {
      console.error('Error notifying report room listener:', err);
    }
  });
}

function persistReports(reports: SavedReport[]) {
  savedReportsCache = reports;
  // 1. Safe localStorage save (automatically handles quota by stripping heavy base64 strings)
  safeLocalStorageSet(STORAGE_KEY_REPORT_ROOM, reports);
  // 2. Full high-capacity IndexedDB save (stores all high-res photos without 5MB quota limit)
  idbSaveAll('saved_reports', reports);
  // 3. Local tab bus
  if (localReportBus) {
    try { localReportBus.postMessage({ timestamp: Date.now() }); } catch {}
  }
  // 4. Global cross-device broadcast
  broadcastLabRealtimeEvent('reports_change', { timestamp: Date.now() });
}

export function getSavedReports(): SavedReport[] {
  return [...savedReportsCache];
}

export function clearAllSavedReports(): void {
  persistReports([]);
  notifyListeners([]);
}

export function setSavedReportsDirectly(reports: SavedReport[]): void {
  persistReports(reports);
  notifyListeners(reports);
}

export function saveReportToRoom(reportData: Omit<SavedReport, 'id' | 'createdAt'> & { id?: string }): SavedReport | null {
  if (!requireOnlineForSave(`Save Report (${reportData.reportNo || reportData.modelName})`)) {
    return null;
  }
  const current = getSavedReports();
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  
  const id = reportData.id || `rep-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Determine tag from reportType if not explicitly passed
  let tag: ReportTagType = reportData.tag;
  if (!tag) {
    tag = reportData.reportType === 'cs-experience' ? 'C Experience' : 'C Simulation';
  }

  const newReport: SavedReport = {
    ...reportData,
    id,
    tag,
    createdAt: dateStr,
    generatedDate: reportData.generatedDate || now.toISOString().split('T')[0],
  };
  (newReport as any)._pendingSync = true;
  unmarkReportDeleted(newReport.id);

  // Prepend new report to list
  const updated = [newReport, ...current.filter(r => r.id !== id)];
  persistReports(updated);

  // Sync to Supabase & Firestore
  syncReportRoomToSupabase(newReport);
  syncReportRoomToFirestore(newReport);

  // Trigger lab notification
  addNotification(
    `New ${tag} Saved to Report Room`,
    `Report #${newReport.reportNo} (${newReport.modelName}) has been archived in the Report Room under ${tag}.`,
    'success'
  );

  notifyListeners(updated);
  return newReport;
}

export function deleteSavedReport(id: string): boolean {
  if (!requireOnlineForSave(`Delete Report (${id})`)) {
    return false;
  }
  markReportDeleted(id);
  const current = getSavedReports();
  const deletedItem = current.find(r => r.id === id);
  const updated = current.filter(r => r.id !== id);
  
  persistReports(updated);
  broadcastLabRealtimeEvent('reports_change', { deletedId: id, timestamp: Date.now() });
  deleteReportRoomFromSupabase(id);
  deleteReportRoomFromFirestore(id);

  if (deletedItem) {
    addNotification(
      `Report Deleted`,
      `Report #${deletedItem.reportNo} (${deletedItem.modelName}) was removed from Report Room.`,
      'info'
    );
  }
  notifyListeners(updated);
  return true;
}

export function updateSavedReport(id: string, updates: Partial<SavedReport>): SavedReport | null {
  if (!requireOnlineForSave(`Update Report (${id})`)) {
    return null;
  }
  const current = getSavedReports();
  const idx = current.findIndex(r => r.id === id);
  if (idx === -1) return null;

  current[idx] = {
    ...current[idx],
    ...updates
  };

  persistReports(current);
  syncReportRoomToSupabase(current[idx]);
  syncReportRoomToFirestore(current[idx]);
  notifyListeners(current);
  return current[idx];
}

export function subscribeReportRoom(listener: (reports: SavedReport[]) => void): () => void {
  listeners.push(listener);
  // Immediate emit
  listener(getSavedReports());
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

export function getReportCounts(): { total: number; cSimulation: number; cExperience: number } {
  const all = getSavedReports();
  const cSimulation = all.filter(r => r.tag === 'C Simulation' || r.reportType === 'cs-simulation').length;
  const cExperience = all.filter(r => r.tag === 'C Experience' || r.reportType === 'cs-experience').length;
  return {
    total: all.length,
    cSimulation,
    cExperience
  };
}

/**
 * Strict Model-Level Check: Checks if a report for this model is currently present in Report Room.
 * As per specification: "Report Generate me koi ek model ka report generate ho gya to us model ka report
 * Dubara Generate nhi hoga jab tak Report Room me Us Model ka Report hai. Aur Haa jin Model ka Report
 * Generate nhi hua hai. Unka Report Generate hoga."
 */
export function findSavedReportByModelName(
  modelName: string,
  tag?: ReportTagType
): SavedReport | null {
  if (!modelName) return null;
  const cleanModel = modelName.trim().toLowerCase();
  if (!cleanModel || cleanModel === 'na' || cleanModel === 'all') return null;

  const all = getSavedReports();
  return all.find(r => {
    const matchTag = !tag || r.tag === tag || (tag === 'C Simulation' && r.reportType === 'cs-simulation') || (tag === 'C Experience' && r.reportType === 'cs-experience');
    if (!matchTag) return false;
    return r.modelName && r.modelName.trim().toLowerCase() === cleanModel;
  }) || null;
}

export function findSavedReportForUnit(
  unitOrIdentifier: { id?: string; serialNo?: string; iduSerialNumber?: string; oduSerialNumber?: string; modelName?: string } | string,
  tag?: ReportTagType
): SavedReport | null {
  const all = getSavedReports();
  if (typeof unitOrIdentifier === 'string') {
    const term = unitOrIdentifier.trim().toLowerCase();
    if (!term || term === 'na') return null;
    return all.find(r => {
      const matchTag = !tag || r.tag === tag || (tag === 'C Simulation' && r.reportType === 'cs-simulation') || (tag === 'C Experience' && r.reportType === 'cs-experience');
      if (!matchTag) return false;
      return (
        (r.modelName && r.modelName.trim().toLowerCase() === term) ||
        (r.serialNo && r.serialNo.trim().toLowerCase() === term) ||
        (r.reportNo && r.reportNo.trim().toLowerCase() === term) ||
        (r.id && r.id.toLowerCase() === term)
      );
    }) || null;
  }

  const { id, serialNo, iduSerialNumber, oduSerialNumber, modelName } = unitOrIdentifier;
  const cleanModel = (modelName || '').trim().toLowerCase();

  return all.find(r => {
    const matchTag = !tag || r.tag === tag || (tag === 'C Simulation' && r.reportType === 'cs-simulation') || (tag === 'C Experience' && r.reportType === 'cs-experience');
    if (!matchTag) return false;

    // Strict model match: If a report exists for this model in the Report Room
    if (cleanModel && cleanModel !== 'na' && r.modelName && r.modelName.trim().toLowerCase() === cleanModel) {
      return true;
    }

    // Check serial matches
    if (serialNo && r.serialNo && r.serialNo.toLowerCase() === serialNo.toLowerCase()) return true;
    if (iduSerialNumber && r.serialNo && r.serialNo.toLowerCase() === iduSerialNumber.toLowerCase()) return true;
    if (oduSerialNumber && r.serialNo && r.serialNo.toLowerCase() === oduSerialNumber.toLowerCase()) return true;
    if (id && (r.id === id || r.dataValuesMap?.unitId === id)) return true;

    return false;
  }) || null;
}
