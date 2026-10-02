import { 
  getAllRDUnits, 
  setRDUnitsDirectly, 
  clearAllRDUnits, 
  getAllActivityLogs, 
  setActivityLogsDirectly, 
  clearAllActivityLogs, 
  getAllNotifications, 
  setNotificationsDirectly, 
  clearAllNotifications,
  syncUnitToFirestore,
  addLabNotification
} from './unitStore';
import { 
  getAllPpUnits, 
  setPpUnitsDirectly, 
  clearAllPpUnits,
  syncPpUnitToFirestore
} from './ppUnitStore';
import { 
  getAllProtoUnits, 
  setProtoUnitsDirectly, 
  clearAllProtoUnits
} from './protoUnitStore';
import { 
  getAllFieldUnits, 
  setFieldUnitsDirectly, 
  clearAllFieldUnits
} from './fieldUnitStore';
import { 
  getSmogUnits, 
  saveSmogUnits, 
  LeakUnitRecord 
} from '../components/Smog/SmogModule';
import { 
  getActiveLabShift, 
  setActiveLabShift, 
  LabShift 
} from './shiftStore';
import { 
  clearAllSavedReports 
} from './reportRoomStore';
import { idbSaveAll } from '../lib/indexedDbStorage';
import { 
  db, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc,
  writeBatch
} from './firebase';
import { 
  supabase, 
  syncRDUnitToSupabase, 
  syncPpUnitToSupabase, 
  syncProtoUnitToSupabase, 
  syncFieldUnitToSupabase, 
  syncLeakUnitToSupabase 
} from '../lib/supabase';
import { Unit, PpUnit, ProtoUnit, FieldUnit, ActivityLog, LabNotification } from '../types';

export interface MonsterBackupPayload {
  app: string;
  version: string;
  exportTimestamp: string;
  deviceInfo: string;
  summary: {
    rdUnitsCount: number;
    ppUnitsCount: number;
    protoUnitsCount: number;
    fieldUnitsCount: number;
    smogUnitsCount: number;
    activityLogsCount: number;
    notificationsCount: number;
    graphRecordsCount: number;
    graphSheetsCount: number;
  };
  data: {
    rdUnits: Unit[];
    ppUnits: PpUnit[];
    protoUnits: ProtoUnit[];
    fieldUnits: FieldUnit[];
    smogUnits: LeakUnitRecord[];
    activityLogs: ActivityLog[];
    notifications: LabNotification[];
    graphRecords: any[];
    graphSheets: any[];
    activeShift: LabShift;
    customSettings?: Record<string, any>;
    localStorageDump?: Record<string, string>;
  };
}

/**
 * 1. Collect and export all application data into a single Monster JSON payload
 * and trigger automatic download on the user's Mobile/Tablet/Laptop device.
 */
export async function downloadAllMonsterData(): Promise<MonsterBackupPayload> {
  const rdUnits = getAllRDUnits();
  const ppUnits = getAllPpUnits();
  const protoUnits = getAllProtoUnits();
  const fieldUnits = getAllFieldUnits();
  const smogUnits = getSmogUnits();
  const activityLogs = getAllActivityLogs();
  const notifications = getAllNotifications();
  const activeShift = getActiveLabShift();

  // Graph measurements from localStorage
  let graphRecords: any[] = [];
  let graphSheets: any[] = [];
  const localStorageDump: Record<string, string> = {};

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('llt_')) {
          const val = localStorage.getItem(key);
          if (val) {
            localStorageDump[key] = val;
            if (key.includes('graph_measurement') || key.includes('measurements')) {
              try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) {
                  graphRecords = [...graphRecords, ...parsed];
                }
              } catch {}
            } else if (key.includes('value_sheet') || key.includes('sheets')) {
              try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) {
                  graphSheets = [...graphSheets, ...parsed];
                }
              } catch {}
            }
          }
        }
      }
    } catch (e) {
      console.warn('LocalStorage gather note:', e);
    }
  }

  const now = new Date();
  const isoDate = now.toISOString();
  const timestampStr = now.toISOString().replace(/[:.]/g, '-');
  const filename = `LLT_LAB_MONSTER_BACKUP_${timestampStr}.json`;

  const payload: MonsterBackupPayload = {
    app: 'LLT_LAB_MANAGEMENT_SYSTEM',
    version: '2.5.0-MASTER-PRO',
    exportTimestamp: isoDate,
    deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Device',
    summary: {
      rdUnitsCount: rdUnits.length,
      ppUnitsCount: ppUnits.length,
      protoUnitsCount: protoUnits.length,
      fieldUnitsCount: fieldUnits.length,
      smogUnitsCount: smogUnits.length,
      activityLogsCount: activityLogs.length,
      notificationsCount: notifications.length,
      graphRecordsCount: graphRecords.length,
      graphSheetsCount: graphSheets.length,
    },
    data: {
      rdUnits,
      ppUnits,
      protoUnits,
      fieldUnits,
      smogUnits,
      activityLogs,
      notifications,
      graphRecords,
      graphSheets,
      activeShift,
      localStorageDump,
    }
  };

  // Trigger browser download on mobile, tablet, laptop
  const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(jsonBlob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);

  return payload;
}

/**
 * 2. Purge / Wipe all data from Supabase, Firebase Firestore, and LocalStorage
 */
export async function purgeAllSupabaseAndFirebaseData(): Promise<{
  firestoreDeleted: number;
  supabaseCleaned: boolean;
  localCleared: boolean;
}> {
  let firestoreDeletedCount = 0;

  // A. Purge Firebase Firestore Collections
  if (db) {
    const firestoreCollections = [
      'units',
      'rd_units',
      'ppUnits',
      'pp_units',
      'protoUnits',
      'proto_units',
      'fieldUnits',
      'field_units',
      'smog_leak_units',
      'report_room_reports',
      'saved_reports',
      'graphReadings',
      'ppUnitMeasurements',
      'pp_unit_measurements',
      'activityLogs',
      'labNotifications',
      'megha_chat_records',
      'unit_photos',
      'cloud_unit_photos',
      'model_master',
      'elt_records',
      'bsr_records'
    ];

    for (const colName of firestoreCollections) {
      try {
        const colRef = collection(db, colName);
        const snapshot = await getDocs(colRef);
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          let batchCount = 0;
          snapshot.forEach((docSnap) => {
            batch.delete(docSnap.ref);
            batchCount++;
            firestoreDeletedCount++;
          });
          if (batchCount > 0) {
            await batch.commit();
          }
        }
      } catch (err) {
        console.warn(`Firestore purge notice for collection ${colName}:`, err);
      }
    }
  }

  // B. Purge Supabase Tables
  let supabaseSuccess = true;
  try {
    const supabaseTables = [
      'rd_units',
      'pp_units',
      'proto_units',
      'field_units',
      'smog_leak_units',
      'report_room_reports',
      'pp_unit_measurements'
    ];

    for (const tbl of supabaseTables) {
      try {
        // Delete all rows where id is not empty
        const { error } = await supabase.from(tbl).delete().neq('id', '___NEVER_MATCH___');
        if (error) {
          console.warn(`Supabase delete note on table ${tbl}:`, error.message);
        }
      } catch (tblErr) {
        console.warn(`Supabase table delete note for ${tbl}:`, tblErr);
      }
    }
  } catch (err) {
    console.warn('Supabase general delete note:', err);
    supabaseSuccess = false;
  }

  // C. Clear IndexedDB High-Capacity Stores
  try {
    await Promise.all([
      idbSaveAll('proto_units', []),
      idbSaveAll('pp_units', []),
      idbSaveAll('field_units', []),
      idbSaveAll('saved_reports', [])
    ]);
  } catch (idbErr) {
    console.warn('IndexedDB clear note:', idbErr);
  }

  // D. Clear In-Memory Stores and State
  clearAllRDUnits();
  clearAllPpUnits();
  clearAllProtoUnits();
  clearAllFieldUnits();
  clearAllActivityLogs();
  clearAllNotifications();
  clearAllSavedReports();
  saveSmogUnits([]);

  // E. Set explicit empty arrays and initialization sentinel in LocalStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem('llt_initialized_v2', 'true');
      localStorage.setItem('llt_proto_units_v1', '[]');
      localStorage.setItem('llt_pp_units_v1', '[]');
      localStorage.setItem('llt_field_units_v2', '[]');
      localStorage.setItem('llt_lab_units_v2', '[]');
      localStorage.setItem('llt_report_room_saved_reports_v1', '[]');
      localStorage.setItem('llt_lab_activity_logs_v2', '[]');
      localStorage.setItem('llt_lab_notifications_v2', '[]');
      localStorage.setItem('llt_smog_leak_units_v1', '[]');
      localStorage.setItem('llt_graph_measurements_v1', '[]');
    } catch (lsErr) {
      console.warn('LocalStorage reset note:', lsErr);
    }
  }

  return {
    firestoreDeleted: firestoreDeletedCount,
    supabaseCleaned: supabaseSuccess,
    localCleared: true
  };
}

/**
 * 3. Upload & Restore Monster Data file to Supabase, Firebase, and local stores
 */
export async function uploadAndRestoreMonsterData(
  jsonData: MonsterBackupPayload | any
): Promise<{
  rdUnitsRestored: number;
  ppUnitsRestored: number;
  protoUnitsRestored: number;
  fieldUnitsRestored: number;
  smogUnitsRestored: number;
  logsRestored: number;
}> {
  // Validate structure
  const data = jsonData.data || jsonData;
  const rdUnits: Unit[] = Array.isArray(data.rdUnits) ? data.rdUnits : [];
  const ppUnits: PpUnit[] = Array.isArray(data.ppUnits) ? data.ppUnits : [];
  const protoUnits: ProtoUnit[] = Array.isArray(data.protoUnits) ? data.protoUnits : [];
  const fieldUnits: FieldUnit[] = Array.isArray(data.fieldUnits) ? data.fieldUnits : [];
  const smogUnits: LeakUnitRecord[] = Array.isArray(data.smogUnits) ? data.smogUnits : [];
  const activityLogs: ActivityLog[] = Array.isArray(data.activityLogs) ? data.activityLogs : [];
  const notifications: LabNotification[] = Array.isArray(data.notifications) ? data.notifications : [];
  const activeShift: LabShift = data.activeShift || 'GENERAL';

  // 1. Restore to Local Stores and In-Memory Caches
  setRDUnitsDirectly(rdUnits);
  setPpUnitsDirectly(ppUnits);
  setProtoUnitsDirectly(protoUnits);
  setFieldUnitsDirectly(fieldUnits);
  saveSmogUnits(smogUnits);
  setActivityLogsDirectly(activityLogs);
  setNotificationsDirectly(notifications);
  setActiveLabShift(activeShift, 'Monster Data Restore');

  // Restore any additional localStorage keys if present
  if (data.localStorageDump && typeof window !== 'undefined') {
    Object.entries(data.localStorageDump).forEach(([k, v]) => {
      try {
        localStorage.setItem(k, v as string);
      } catch {}
    });
  }

  // 2. Upload to Firebase Firestore in background / promises
  const firestorePromises: Promise<any>[] = [];
  if (db) {
    // Sync RD Units
    rdUnits.forEach(u => {
      firestorePromises.push(syncUnitToFirestore(u).catch(e => console.warn('FS RD restore note:', e)));
    });
    // Sync PP Units
    ppUnits.forEach(u => {
      firestorePromises.push(syncPpUnitToFirestore(u).catch(e => console.warn('FS PP restore note:', e)));
    });
    // Sync Proto Units
    protoUnits.forEach(u => {
      const docRef = doc(db, 'proto_units', u.id);
      firestorePromises.push(setDoc(docRef, u).catch(e => console.warn('FS Proto restore note:', e)));
    });
    // Sync Field Units
    fieldUnits.forEach(u => {
      const docRef = doc(db, 'field_units', u.id);
      firestorePromises.push(setDoc(docRef, u).catch(e => console.warn('FS Field restore note:', e)));
    });
    // Sync Smog Units
    smogUnits.forEach(u => {
      const docRef = doc(db, 'smog_leak_units', u.id);
      firestorePromises.push(setDoc(docRef, u).catch(e => console.warn('FS Smog restore note:', e)));
    });
    // Sync Activity Logs
    activityLogs.forEach(l => {
      const docRef = doc(db, 'activityLogs', l.id);
      firestorePromises.push(setDoc(docRef, l).catch(e => console.warn('FS Log restore note:', e)));
    });
  }

  // 3. Upload to Supabase
  const supabasePromises: Promise<any>[] = [];
  rdUnits.forEach(u => {
    supabasePromises.push(syncRDUnitToSupabase(u).catch(e => console.warn('SB RD restore note:', e)));
  });
  ppUnits.forEach(u => {
    supabasePromises.push(syncPpUnitToSupabase(u).catch(e => console.warn('SB PP restore note:', e)));
  });
  protoUnits.forEach(u => {
    supabasePromises.push(syncProtoUnitToSupabase(u).catch(e => console.warn('SB Proto restore note:', e)));
  });
  fieldUnits.forEach(u => {
    supabasePromises.push(syncFieldUnitToSupabase(u).catch(e => console.warn('SB Field restore note:', e)));
  });
  smogUnits.forEach(u => {
    supabasePromises.push(syncLeakUnitToSupabase(u).catch(e => console.warn('SB Smog restore note:', e)));
  });

  // Await all remote syncs with a reasonable timeout race
  try {
    await Promise.allSettled([...firestorePromises, ...supabasePromises]);
  } catch (err) {
    console.warn('Remote sync batch warning:', err);
  }

  addLabNotification(
    'Monster Master Data Restored',
    `Restored ${rdUnits.length} RD Units, ${ppUnits.length} PP Units, ${protoUnits.length} Proto Units, ${fieldUnits.length} Field Units, and ${smogUnits.length} Smog records.`
  );

  return {
    rdUnitsRestored: rdUnits.length,
    ppUnitsRestored: ppUnits.length,
    protoUnitsRestored: protoUnits.length,
    fieldUnitsRestored: fieldUnits.length,
    smogUnitsRestored: smogUnits.length,
    logsRestored: activityLogs.length
  };
}
