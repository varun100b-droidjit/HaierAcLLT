import { Unit, ActivityLog, LabNotification, WORKFLOW_STAGES, TimelineStep, Department } from '../types';
import { db, isFirebaseConfigured, collection, doc, setDoc, getDocs, updateDoc, deleteDoc, onSnapshot } from './firebase';
import { 
  syncRDUnitToSupabase, 
  deleteRDUnitFromSupabase, 
  fetchRDUnitsFromSupabase,
  broadcastLabRealtimeEvent,
  subscribeToLabRealtimeEvents 
} from '../lib/supabase';
import { requireOnlineForSave } from './networkManager';
import { deleteUnitPhotosFromServer } from './cloudPhotoService';

const STORAGE_KEY_UNITS = 'llt_lab_units_v2';
const STORAGE_KEY_LOGS = 'llt_lab_activity_logs_v2';
const STORAGE_KEY_NOTIFS = 'llt_lab_notifications_v2';
const DELETED_RD_UNITS_KEY = 'llt_deleted_rd_units_v1';

export function markRDUnitDeleted(id: string) {
  try {
    const raw = localStorage.getItem(DELETED_RD_UNITS_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(DELETED_RD_UNITS_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.warn('Error marking RD unit as deleted:', e);
  }
}

export function getDeletedRDUnitIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_RD_UNITS_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return new Set(list);
  } catch {
    return new Set();
  }
}

export const MOCK_UNIT_IDS = new Set([
  'unit-101', 'unit-102', 'unit-103', 'unit-104', 'unit-105',
  'proto-101', 'proto-102',
  'pp-idu-19', 'pp-odu-19', 'pp-idu-18', 'pp-odu-18', 'pp-idu-24', 'pp-odu-24', 'pp-idu-30', 'pp-odu-36',
  'field-101', 'field-102', 'field-103',
  'rep-cs-101', 'rep-ce-102'
]);

export function isMockUnitId(id?: string): boolean {
  if (!id) return false;
  return (
    MOCK_UNIT_IDS.has(id) ||
    id === 'unit-101' || id === 'unit-102' || id === 'unit-103' || id === 'unit-104' || id === 'unit-105' ||
    id === 'proto-101' || id === 'proto-102' ||
    id.startsWith('pp-idu-') || id.startsWith('pp-odu-') ||
    id === 'field-101' || id === 'field-102' || id === 'field-103' ||
    id === 'rep-cs-101' || id === 'rep-ce-102'
  );
}

const INITIAL_UNITS: Unit[] = [];
const INITIAL_LOGS: ActivityLog[] = [];
const INITIAL_NOTIFS: LabNotification[] = [];

// Memory store state
let unitsCache: Unit[] = loadLocalUnits();
let logsCache: ActivityLog[] = loadLocalLogs();
let notifsCache: LabNotification[] = loadLocalNotifs();

const listeners: Set<() => void> = new Set();

// Local Inter-Tab Broadcast Channel
const localUnitBus = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('llt_units_bus') 
  : null;

if (localUnitBus) {
  localUnitBus.onmessage = () => {
    unitsCache = loadLocalUnits();
    notifyListeners();
  };
}

// Storage event listener
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY_UNITS) {
      unitsCache = loadLocalUnits();
      notifyListeners();
    }
  });
}

// Global Supabase Realtime event listener
subscribeToLabRealtimeEvents((event) => {
  if (event === 'rd_units_change') {
    initDataSync();
  }
});

// Periodic background sync check
if (typeof window !== 'undefined') {
  setInterval(() => {
    initDataSync();
  }, 6000);
}

/* ==========================================
   FIREBASE FIRESTORE SYNC HELPERS FOR RD UNITS
   ========================================== */

export async function syncRDUnitToFirestore(unit: Unit) {
  if (!db || !unit || isMockUnitId(unit.id)) return;
  try {
    const docRef = doc(db, 'rd_units', unit.id);
    await setDoc(docRef, { ...unit }, { merge: true });
    // Also update 'units' collection for legacy queries
    const legacyDocRef = doc(db, 'units', unit.id);
    await setDoc(legacyDocRef, { ...unit }, { merge: true });
    console.log('Successfully synced R&D Unit to Firebase Firestore:', unit.id);
  } catch (e) {
    console.warn('Firestore R&D Unit sync note:', e);
  }
}

export async function deleteRDUnitFromFirestore(id: string) {
  if (!db) return;
  try {
    await deleteUnitPhotosFromServer(id);
    await deleteDoc(doc(db, 'rd_units', id));
    await deleteDoc(doc(db, 'units', id));
    console.log('Successfully deleted R&D Unit and photos from Firebase Firestore:', id);
  } catch (e) {
    console.warn('Firestore R&D Unit delete note:', e);
  }
}

export async function fetchRDUnitsFromFirestore(): Promise<Unit[] | null> {
  if (!db) return null;
  try {
    const deleted = getDeletedRDUnitIds();
    const colRef = collection(db, 'rd_units');
    const snap = await getDocs(colRef);
    if (snap.empty) {
      // Try legacy collection
      const legacySnap = await getDocs(collection(db, 'units'));
      if (legacySnap.empty) return null;
      const list: Unit[] = [];
      legacySnap.forEach(d => {
        const data = d.data() as Unit;
        if (data && !isMockUnitId(data.id) && !deleted.has(data.id)) list.push(data);
      });
      return list.length > 0 ? list : null;
    }
    const list: Unit[] = [];
    snap.forEach(d => {
      const data = d.data() as Unit;
      if (data && !isMockUnitId(data.id) && !deleted.has(data.id)) list.push(data);
    });
    return list.length > 0 ? list : null;
  } catch (e) {
    console.warn('Firestore R&D Unit fetch note:', e);
    return null;
  }
}

// Automatically fetch from Firestore / Supabase on init
initDataSync();

// Attach Real-Time Firestore Listener for Live Multi-Device Sync (Phone <-> Tablet <-> Desktop)
if (db) {
  try {
    const colRef = collection(db, 'rd_units');
    onSnapshot(colRef, (snap: any) => {
      if (snap) {
        const deleted = getDeletedRDUnitIds();
        const list: Unit[] = [];
        snap.forEach((d: any) => {
          const data = d.data() as Unit;
          if (data && !isMockUnitId(data.id) && !deleted.has(data.id)) {
            list.push(data);
          }
        });
        if (list.length > 0) {
          unitsCache = normalizeUnitTimelines(list);
          try { localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(unitsCache)); } catch {}
          notifyListeners();
        }
      }
    }, (err: any) => {
      console.warn('[UnitStore] Real-time rd_units listener error:', err);
    });
  } catch (e) {
    console.warn('[UnitStore] Could not set up real-time listener:', e);
  }
}

// Subscribe to cross-tab & multi-device realtime events
try {
  subscribeToLabRealtimeEvents((event, payload) => {
    if (event === 'rd_units_change') {
      if (payload?.deletedId) {
        markRDUnitDeleted(payload.deletedId);
        unitsCache = unitsCache.filter(u => u.id !== payload.deletedId);
        try { localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(unitsCache)); } catch {}
        notifyListeners();
      }
    }
  });
} catch (e) {
  console.warn('Realtime subscription notice:', e);
}

async function initDataSync() {
  try {
    // Try fetching from Firestore first
    const firestoreData = await fetchRDUnitsFromFirestore();
    if (firestoreData && firestoreData.length > 0) {
      unitsCache = normalizeUnitTimelines(firestoreData);
      try { localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(unitsCache)); } catch {}
      notifyListeners();
      return;
    }

    // Fallback to Supabase
    const remoteData = await fetchRDUnitsFromSupabase();
    if (remoteData && remoteData.length > 0) {
      unitsCache = normalizeUnitTimelines(remoteData);
      try { localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(unitsCache)); } catch {}
      notifyListeners();
      remoteData.forEach(u => syncRDUnitToFirestore(u));
    }
  } catch (e) {
    console.warn('RD Units Cloud sync note:', e);
  }
}

export async function forceSyncRDUnits(): Promise<Unit[]> {
  try {
    const firestoreData = await fetchRDUnitsFromFirestore();
    if (firestoreData && firestoreData.length > 0) {
      unitsCache = normalizeUnitTimelines(firestoreData);
      try { localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(unitsCache)); } catch {}
      notifyListeners();
      return unitsCache;
    }
    const remoteData = await fetchRDUnitsFromSupabase();
    if (remoteData && remoteData.length > 0) {
      unitsCache = normalizeUnitTimelines(remoteData);
      try { localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(unitsCache)); } catch {}
      notifyListeners();
      return unitsCache;
    }
  } catch (e) {
    console.warn('Error in forceSyncRDUnits:', e);
  }
  return unitsCache;
}

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export function subscribeUnitStore(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function saveLocalUnits(data: Unit[]) {
  unitsCache = data;
  try { localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(data)); } catch {}
  if (localUnitBus) {
    try { localUnitBus.postMessage({ timestamp: Date.now() }); } catch {}
  }
  broadcastLabRealtimeEvent('rd_units_change', { timestamp: Date.now() });
  notifyListeners();
}

function saveLocalLogs(data: ActivityLog[]) {
  logsCache = data;
  localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(data));
  notifyListeners();
}

function saveLocalNotifs(data: LabNotification[]) {
  notifsCache = data;
  localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(data));
  notifyListeners();
}

function normalizeUnitTimelines(units: Unit[]): Unit[] {
  if (!Array.isArray(units)) return INITIAL_UNITS;
  return units.filter((u): u is Unit => Boolean(u && typeof u === 'object')).map(u => {
    let currentStageIndex = typeof u.currentStageIndex === 'number' ? u.currentStageIndex : 0;
    let currentHolder = u.currentHolder || 'Unassigned';

    // Automatically correct units created at Stage 0 (BSR) when ELT and R&D persons were assigned in the form
    if (currentStageIndex === 0) {
      if (u.rdPerson && u.rdPerson.trim()) {
        currentStageIndex = 2; // Step 3: R&D Person
        currentHolder = u.rdPerson;
      } else if (u.eltPerson && u.eltPerson.trim()) {
        currentStageIndex = 1; // Step 2: ELT Person
        currentHolder = u.eltPerson;
      }
    }

    // Automatically transition from Step 3 (R&D Person, index 2) to Step 4 (R&D Area, index 3) after 20 seconds
    if (currentStageIndex === 2) {
      const createdMs = u.createdAt ? new Date(u.createdAt).getTime() : Date.now();
      if (!isNaN(createdMs) && (Date.now() - createdMs >= 20000)) {
        currentStageIndex = 3; // Step 4: R&D Area
        currentHolder = u.rdPerson || u.bsrPerson || 'Requester';
      }
    }

    let timeline = u.timeline || [];
    const normalizedTimeline = WORKFLOW_STAGES.map((stage, idx) => {
      const existingStep = timeline[idx];
      let stepPerson = existingStep?.personName;

      if (!stepPerson || stepPerson === stage.defaultRole || stepPerson === 'Unassigned' || stepPerson === 'Lab Area Supervisor' || stepPerson === 'R&D Area Supervisor') {
        if (stage.department === 'BSR' && u.bsrPerson) stepPerson = u.bsrPerson;
        else if (stage.department === 'ELT' && u.eltPerson) stepPerson = u.eltPerson;
        else if (stage.department === 'R&D' && u.rdPerson) stepPerson = u.rdPerson;
        else if (stage.department === 'OQC' && u.oqcPerson) stepPerson = u.oqcPerson;
        else if (stage.department === 'AREA') stepPerson = u.rdPerson || u.bsrPerson || 'Requester';
        else stepPerson = stage.defaultRole;
      }

      let stepStatus: 'completed' | 'current' | 'pending' = 'pending';
      if (idx < currentStageIndex) {
        stepStatus = 'completed';
      } else if (idx === currentStageIndex) {
        stepStatus = (u.status === 'received' || u.status === 'completed') ? 'completed' : 'current';
      }

      let stepStageName = stage.stageName;

      let stepRemarks = existingStep?.remarks || '';
      if (stepRemarks.startsWith('Awaiting') || stepRemarks.includes('Currently active at Step 1') || stepRemarks.includes('Stage Step')) {
        stepRemarks = '';
      }

      const now = new Date();
      const dateStr = u.transferDate ? u.transferDate.split(' ')[0] : now.toISOString().split('T')[0];
      const timeStr = u.transferDate ? u.transferDate.split(' ').slice(1).join(' ') : now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return {
        id: existingStep?.id || `step-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        stageIndex: idx,
        stageName: stepStageName,
        department: stage.department,
        personName: stepPerson,
        date: existingStep?.date && existingStep.date !== '--' ? existingStep.date : (idx <= currentStageIndex ? dateStr : '--'),
        time: existingStep?.time && existingStep.time !== '--' ? existingStep.time : (idx <= currentStageIndex ? timeStr : '--'),
        remarks: stepRemarks,
        status: stepStatus
      };
    });

    return {
      ...u,
      currentStageIndex,
      currentHolder,
      timeline: normalizedTimeline
    };
  });
}

function loadLocalUnits(): Unit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_UNITS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter((u: any) => u && !isMockUnitId(u.id));
        return normalizeUnitTimelines(clean);
      }
    }
    return [];
  } catch (e) {
    return [];
  }
}

function loadLocalLogs(): ActivityLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((l: any) => l && !isMockUnitId(l.unitId));
    }
    return [];
  } catch (e) {
    return [];
  }
}

function loadLocalNotifs(): LabNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((n: any) => n && !isMockUnitId(n.unitId));
    }
    return [];
  } catch (e) {
    return [];
  }
}

// Helpers for timeline generation
export function createInitialTimeline(bsrPerson: string, eltPerson: string, rdPerson: string, activeStageIdx: number = 0): TimelineStep[] {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return WORKFLOW_STAGES.map((stage, idx) => {
    let person = 'Unassigned';
    if (stage.department === 'BSR') person = bsrPerson || 'BSR Officer';
    else if (stage.department === 'ELT') person = eltPerson || 'ELT Officer';
    else if (stage.department === 'R&D') person = rdPerson || 'R&D Lead';
    else if (stage.department === 'OQC') person = 'OQC Quality Inspector';
    else if (stage.department === 'AREA') person = rdPerson || bsrPerson || 'Requester';

    let stepStatus: 'completed' | 'current' | 'pending' = 'pending';
    if (idx < activeStageIdx) stepStatus = 'completed';
    else if (idx === activeStageIdx) stepStatus = 'current';

    let stepRemarks = '';
    if (idx === 7) { // Step 8 (0-indexed 7)
      if (stepStatus === 'completed') stepRemarks = 'Unit Verification Passed';
      else if (stepStatus === 'current') stepRemarks = 'Unit Verification Pending';
    }

    return {
      id: `step-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      stageIndex: idx,
      stageName: stage.stageName,
      department: stage.department,
      personName: person,
      date: idx <= activeStageIdx ? dateStr : '--',
      time: idx <= activeStageIdx ? timeStr : '--',
      remarks: stepRemarks,
      status: stepStatus
    };
  });
}

function getFutureDateStr(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

// API functions
export function getUnits(): Unit[] {
  return normalizeUnitTimelines(unitsCache);
}

export function getActivityLogs(): ActivityLog[] {
  return [...logsCache];
}

export function addShiftActivityLog(
  action: string,
  type: 'shift_start' | 'shift_off' | 'shift_change',
  shiftName: string = 'Lab Shift',
  performedBy: string = 'Shift Manager'
): ActivityLog {
  const now = new Date();
  const timeFormatted = `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const newLog: ActivityLog = {
    id: `log-shift-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    unitId: 'LAB-SHIFT',
    modelName: 'Lab Shift Management',
    serialNumber: shiftName,
    action: action,
    performedBy: performedBy,
    timestamp: timeFormatted,
    stageName: 'Shift Schedule',
    type: type
  };
  logsCache = [newLog, ...logsCache];
  saveLocalLogs(logsCache);
  notifyListeners();
  return newLog;
}

export function getNotifications(): LabNotification[] {
  return [...notifsCache];
}

export function addLabNotification(
  title: string,
  message: string,
  type: 'info' | 'warning' | 'alert' = 'info'
): LabNotification {
  const newNotif: LabNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title,
    message,
    timestamp: 'Just now',
    read: false,
    type
  };
  notifsCache = [newNotif, ...notifsCache];
  saveLocalNotifs(notifsCache);
  return newNotif;
}

export async function addMultipleUnits(
  unitRows: { modelName: string; serialNumber: string }[],
  requiredBy: string,
  dayDuration: number,
  bsrPerson: string,
  eltPerson: string,
  rdPerson: string
): Promise<Unit[]> {
  const now = new Date();
  const transferDateFormatted = `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  
  let initialStageIdx = 0;
  let holder = bsrPerson || 'BSR Person';
  if (rdPerson && rdPerson.trim()) {
    initialStageIdx = 2; // Step 3: R&D Person
    holder = rdPerson;
  } else if (eltPerson && eltPerson.trim()) {
    initialStageIdx = 1; // Step 2: ELT Person
    holder = eltPerson;
  }

  const newUnits: Unit[] = unitRows.map((row) => {
    const unitId = `unit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const initialTimeline = createInitialTimeline(bsrPerson, eltPerson, rdPerson, initialStageIdx);

    return {
      id: unitId,
      modelName: row.modelName || 'LLT Standard Module',
      serialNumber: row.serialNumber || `SN-${Math.floor(100000 + Math.random() * 900000)}`,
      requiredBy: requiredBy || getFutureDateStr(dayDuration || 7),
      dayDuration: Number(dayDuration) || 7,
      transferDate: transferDateFormatted,
      bsrPerson,
      eltPerson,
      rdPerson,
      currentHolder: holder,
      currentStageIndex: initialStageIdx,
      status: 'transferred',
      timeline: initialTimeline,
      priority: 'Normal',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  });

  const updatedUnits = [...newUnits, ...unitsCache];
  saveLocalUnits(updatedUnits);

  // Log activity
  const newLogs: ActivityLog[] = newUnits.map(u => ({
    id: `log-${Date.now()}-${Math.random()}`,
    unitId: u.id,
    modelName: u.modelName,
    serialNumber: u.serialNumber,
    action: `Unit Transferred to R&D Workflow by ${bsrPerson}`,
    performedBy: bsrPerson,
    timestamp: transferDateFormatted,
    stageName: 'BSR Person',
    type: 'transfer' as const
  }));

  saveLocalLogs([...newLogs, ...logsCache]);

  // Add Notification
  const newNotif: LabNotification = {
    id: `notif-${Date.now()}`,
    title: `${newUnits.length} Unit(s) Transferred`,
    message: `${newUnits.map(u => u.serialNumber).join(', ')} assigned from BSR to ELT/R&D.`,
    timestamp: 'Just now',
    read: false,
    type: 'info'
  };
  saveLocalNotifs([newNotif, ...notifsCache]);

  // Sync to Supabase & Firestore
  for (const u of newUnits) {
    syncRDUnitToSupabase(u);
    syncRDUnitToFirestore(u);
  }

  return newUnits;
}

export async function advanceUnitStage(
  unitId: string, 
  performerName: string, 
  remarks: string, 
  nextStageIdx?: number,
  overrideStatus?: Unit['status']
) {
  if (!requireOnlineForSave(`Advance Stage for Unit (${unitId})`)) {
    return;
  }
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Time 30 seconds later for Stage 9 (Unit Verify)
  const time30SecLater = new Date(now.getTime() + 30000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const updatedUnits = unitsCache.map(u => {
    if (u.id !== unitId) return u;

    const currentIdx = u.currentStageIndex;
    const targetIdx = typeof nextStageIdx === 'number' ? nextStageIdx : Math.min(currentIdx + 1, WORKFLOW_STAGES.length - 1);
    
    const isFinalStage = targetIdx === WORKFLOW_STAGES.length - 1;
    const newStatus: Unit['status'] = overrideStatus || (isFinalStage ? 'received' : u.status === 'rework' && !overrideStatus ? 'rework' : 'transferred');

    // Update timeline steps
    const updatedTimeline = WORKFLOW_STAGES.map((stage, idx) => {
      const existingStep = u.timeline[idx];
      let stepStatus: 'completed' | 'current' | 'pending' = 'pending';
      if (idx < targetIdx) {
        stepStatus = 'completed';
      } else if (idx === targetIdx) {
        stepStatus = isFinalStage ? 'completed' : 'current';
      }

      let stepPerson = existingStep?.personName || performerName || stage.defaultRole;

      // Keep OQC person name synchronized for all OQC stages
      if (stage.department === 'OQC') {
        const activeOqcPerson = (performerName && (idx === targetIdx || targetIdx >= 7)) ? performerName : (u.oqcPerson || performerName);
        if (activeOqcPerson) {
          stepPerson = activeOqcPerson;
        }
      } else if (performerName && idx === targetIdx) {
        stepPerson = performerName;
      }

      let stepDate = (idx === targetIdx) ? dateStr : (existingStep?.date && existingStep.date !== '--' ? existingStep.date : dateStr);
      let stepTime = (idx === targetIdx) ? timeStr : (existingStep?.time && existingStep.time !== '--' ? existingStep.time : timeStr);

      let stepRemarks = existingStep?.remarks || '';
      if (idx === targetIdx) {
        stepRemarks = remarks || '';
      }

      return {
        id: existingStep?.id || `step-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        stageIndex: idx,
        stageName: stage.stageName,
        department: stage.department,
        personName: stepPerson,
        date: idx <= targetIdx ? stepDate : '--',
        time: idx <= targetIdx ? stepTime : '--',
        remarks: stepRemarks,
        status: stepStatus
      };
    });

    const newHolder = performerName || WORKFLOW_STAGES[targetIdx].stageName;

    return {
      ...u,
      oqcPerson: (targetIdx >= 7 && performerName) ? performerName : u.oqcPerson,
      currentStageIndex: targetIdx,
      currentHolder: newHolder,
      status: newStatus,
      timeline: updatedTimeline,
      updatedAt: now.toISOString()
    };
  });

  saveLocalUnits(updatedUnits);

  const targetUnit = updatedUnits.find(u => u && u.id === unitId);
  if (targetUnit) {
    const stageName = WORKFLOW_STAGES[targetUnit.currentStageIndex]?.stageName || 'Transfer Completed';
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      unitId,
      modelName: targetUnit.modelName,
      serialNumber: targetUnit.serialNumber,
      action: targetUnit.status === 'received' ? 'Unit Workflow Completed & Received' : `Advanced to Stage: ${stageName}`,
      performedBy: performerName || 'System',
      timestamp: `${dateStr} ${timeStr}`,
      stageName,
      type: targetUnit.status === 'received' ? 'received' : 'stage_update'
    };
    saveLocalLogs([newLog, ...logsCache]);

    // Sync to Supabase & Firestore
    syncRDUnitToSupabase(targetUnit);
    syncRDUnitToFirestore(targetUnit);
  }
}

export async function reworkUnit(unitId: string, performerName: string, remarks: string) {
  if (!requireOnlineForSave(`Flag Unit (${unitId}) for Rework`)) {
    return;
  }
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const updatedUnits = unitsCache.map(u => {
    if (u.id !== unitId) return u;
    
    // Set status to rework
    const updatedTimeline = u.timeline.map((step, idx) => {
      if (idx === u.currentStageIndex) {
        return {
          ...step,
          remarks: `[REWORK REQUESTED] ${remarks || 'Issues identified during validation.'}`
        };
      }
      return step;
    });

    return {
      ...u,
      status: 'rework' as const,
      timeline: updatedTimeline,
      notes: `[REWORK] ${remarks}`,
      updatedAt: now.toISOString()
    };
  });

  saveLocalUnits(updatedUnits);

  const targetUnit = updatedUnits.find(u => u && u.id === unitId);
  if (targetUnit) {
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      unitId,
      modelName: targetUnit.modelName,
      serialNumber: targetUnit.serialNumber,
      action: `Flagged for Rework: ${remarks}`,
      performedBy: performerName || 'Quality Specialist',
      timestamp: `${dateStr} ${timeStr}`,
      stageName: WORKFLOW_STAGES[targetUnit.currentStageIndex]?.stageName || 'Completed',
      type: 'rework'
    };
    saveLocalLogs([newLog, ...logsCache]);

    // Sync to Supabase & Firestore
    syncRDUnitToSupabase(targetUnit);
    syncRDUnitToFirestore(targetUnit);
  }
}

export async function updateUnitDetails(unitId: string, partial: Partial<Unit>) {
  if (!requireOnlineForSave(`Update Unit (${unitId})`)) {
    return;
  }
  let updatedTarget: Unit | null = null;
  const updatedUnits = unitsCache.map(u => {
    if (u.id !== unitId) return u;
    updatedTarget = {
      ...u,
      ...partial,
      updatedAt: new Date().toISOString()
    };
    return updatedTarget;
  });
  saveLocalUnits(updatedUnits);

  if (updatedTarget) {
    syncRDUnitToSupabase(updatedTarget);
    syncRDUnitToFirestore(updatedTarget);
  }
}

export async function deleteUnit(unitId: string) {
  if (!requireOnlineForSave(`Delete Unit (${unitId})`)) {
    return;
  }
  markRDUnitDeleted(unitId);
  const target = unitsCache.find(u => u.id === unitId);
  const updatedUnits = unitsCache.filter(u => u.id !== unitId);
  saveLocalUnits(updatedUnits);

  if (target) {
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      unitId,
      modelName: target.modelName,
      serialNumber: target.serialNumber,
      action: `Deleted Unit from Lab System`,
      performedBy: 'Authorized User',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      type: 'delete'
    };
    saveLocalLogs([newLog, ...logsCache]);
  }

  // Broadcast deletion across all connected tabs / devices
  try {
    broadcastLabRealtimeEvent('rd_units_change', { deletedId: unitId, timestamp: Date.now() });
  } catch (e) {
    console.warn('Realtime broadcast notice:', e);
  }

  // Delete from Supabase & Firestore (including cloud photos)
  deleteRDUnitFromSupabase(unitId);
  deleteRDUnitFromFirestore(unitId);
}

export function markNotificationAsRead(id: string) {
  const updated = notifsCache.map(n => n.id === id ? { ...n, read: true } : n);
  saveLocalNotifs(updated);
}

export function addNotification(title: string, message: string, type: 'info' | 'warning' | 'success' | 'alert' = 'alert', unitId?: string) {
  const existing = notifsCache.find(n => n.title === title && n.message === message);
  if (existing) return;
  const newNotif: LabNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    title,
    message,
    timestamp: 'Just now',
    read: false,
    type,
    unitId
  };
  saveLocalNotifs([newNotif, ...notifsCache]);
}

export function clearNotifications() {
  saveLocalNotifs([]);
}

export function resetToDemoData() {
  saveLocalUnits(INITIAL_UNITS);
  saveLocalLogs(INITIAL_LOGS);
  saveLocalNotifs(INITIAL_NOTIFS);
}

export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const cleanStr = dateStr.trim().split(' ')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const d = new Date(year, month, day);
      d.setHours(0, 0, 0, 0);
      return d;
    }
  }
  const fallback = new Date(dateStr);
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

export function calculateRemainingDays(requiredByDateStr: string): number {
  if (!requiredByDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseLocalDate(requiredByDateStr);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Checks if a unit is currently at R&D Person or in R&D Area stage (Stage 2: R&D Person, Stage 3: R&D Area, Stage 4: R&D Person Return).
 */
export function isUnitInRDAreaOrPerson(unit: Unit): boolean {
  if (!unit) return false;
  const idx = unit.currentStageIndex ?? 0;
  const stage = WORKFLOW_STAGES[idx];
  if (stage && (stage.department === 'R&D' || stage.department === 'AREA')) {
    return true;
  }
  return idx === 2 || idx === 3 || idx === 4;
}

/**
 * Checks if a unit is overdue AND currently in R&D Person / R&D Area stage.
 */
export function isUnitOverdue(unit: Unit): boolean {
  if (!unit) return false;
  if (unit.status === 'received' || unit.status === 'completed' || (unit.currentStageIndex ?? 0) >= 10) {
    return false;
  }
  const days = calculateRemainingDays(unit.requiredBy);
  return days <= 0 && isUnitInRDAreaOrPerson(unit);
}

export function extendUnitRequiredDate(id: string, additionalDays: number): Unit | null {
  if (additionalDays <= 0) return null;
  const now = new Date();
  const dateStr = `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  let updatedUnit: Unit | null = null;

  const updatedUnits = unitsCache.map(u => {
    if (u.id === id) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let targetDate = new Date();
      if (u.requiredBy) {
        const existingTarget = parseLocalDate(u.requiredBy);
        if (existingTarget > today) {
          targetDate = existingTarget;
        } else {
          targetDate = today;
        }
      } else {
        targetDate = today;
      }

      targetDate.setDate(targetDate.getDate() + additionalDays);
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');
      const newRequiredByStr = `${year}-${month}-${day}`;
      const newDuration = (u.dayDuration || 0) + additionalDays;

      const existingObs = u.observations || [];
      const newObs = {
        id: `obs-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        text: `📅 Timeline extended (+${additionalDays} Days) - New Target Date: ${newRequiredByStr}`,
        timestamp: dateStr
      };

      updatedUnit = {
        ...u,
        requiredBy: newRequiredByStr,
        dayDuration: newDuration,
        observations: [newObs, ...existingObs],
        updatedAt: now.toISOString()
      };
      return updatedUnit;
    }
    return u;
  });

  saveLocalUnits(updatedUnits);

  if (updatedUnit) {
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      unitId: id,
      modelName: updatedUnit.modelName,
      serialNumber: updatedUnit.serialNumber,
      action: `Required Date extended by +${additionalDays} days (New Target: ${updatedUnit.requiredBy})`,
      performedBy: 'Lab Manager',
      timestamp: dateStr,
      stageName: WORKFLOW_STAGES[updatedUnit.currentStageIndex]?.stageName || 'RD Unit',
      type: 'stage_update'
    };
    saveLocalLogs([newLog, ...logsCache]);

    const newNotif: LabNotification = {
      id: `notif-${Date.now()}`,
      title: `Timeline Extended (+${additionalDays} Days)`,
      message: `Unit ${updatedUnit.modelName} (SN: ${updatedUnit.serialNumber}) target date extended to ${updatedUnit.requiredBy}.`,
      timestamp: 'Just now',
      read: false,
      type: 'info'
    };
    saveLocalNotifs([newNotif, ...notifsCache]);

    syncRDUnitToSupabase(updatedUnit);

    if (isFirebaseConfigured && db) {
      try {
        setDoc(doc(db, 'units', updatedUnit.id), updatedUnit);
      } catch (e) {
        console.error(e);
      }
    }
  }

  return updatedUnit;
}

export function addUnitObservation(id: string, text: string): Unit | null {
  const now = new Date();
  const dateStr = `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  let updatedUnit: Unit | null = null;

  const updatedUnits = unitsCache.map(u => {
    if (u.id === id) {
      const existingObs = u.observations || [];
      const newObs = {
        id: `obs-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        text: text.trim(),
        timestamp: dateStr
      };
      updatedUnit = {
        ...u,
        observations: [newObs, ...existingObs],
        updatedAt: now.toISOString()
      };
      return updatedUnit;
    }
    return u;
  });

  saveLocalUnits(updatedUnits);

  if (updatedUnit) {
    syncRDUnitToSupabase(updatedUnit);
    syncRDUnitToFirestore(updatedUnit);
  }

  return updatedUnit;
}

export function deleteUnitObservation(id: string, obsId: string): Unit | null {
  let updatedUnit: Unit | null = null;
  const updatedUnits = unitsCache.map(u => {
    if (u.id === id) {
      const existingObs = u.observations || [];
      updatedUnit = {
        ...u,
        observations: existingObs.filter(o => o.id !== obsId),
        updatedAt: new Date().toISOString()
      };
      return updatedUnit;
    }
    return u;
  });

  saveLocalUnits(updatedUnits);

  if (updatedUnit) {
    syncRDUnitToSupabase(updatedUnit);
    syncRDUnitToFirestore(updatedUnit);
  }

  return updatedUnit;
}

export function getAllRDUnits(): Unit[] {
  return [...unitsCache];
}

export function syncUnitToFirestore(unit: Unit) {
  if (!db) return Promise.resolve();
  try {
    const docRef = doc(db, 'units', unit.id);
    return setDoc(docRef, unit);
  } catch (err) {
    console.warn('Firestore RD sync notice:', err);
    return Promise.resolve();
  }
}

export function setRDUnitsDirectly(units: Unit[]) {
  saveLocalUnits(units);
}


export function clearAllRDUnits() {
  saveLocalUnits([]);
}

export function getAllActivityLogs(): ActivityLog[] {
  return [...logsCache];
}

export function setActivityLogsDirectly(logs: ActivityLog[]) {
  saveLocalLogs(logs);
}

export function clearAllActivityLogs() {
  saveLocalLogs([]);
}

export function getAllNotifications(): LabNotification[] {
  return [...notifsCache];
}

export function setNotificationsDirectly(notifs: LabNotification[]) {
  saveLocalNotifs(notifs);
}

export function clearAllNotifications() {
  saveLocalNotifs([]);
}

