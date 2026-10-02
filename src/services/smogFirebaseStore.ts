import { db, collection, doc, setDoc, deleteDoc, getDocs, onSnapshot } from './firebase';

export interface LeakUnitRecordForFirebase {
  id: string;
  smogPerson: string;
  shift: 'A' | 'B' | string;
  modelName: string;
  serialNumbers: string[];
  passedSerials: string[];
  suspectCount: number;
  actualCount: number;
  date: string;
  month: string;
  time: string;
  createdAt: string;
  notes?: string;
  productionDate?: string;
  smogDate?: string;
  operatorUserId?: string;
  location?: string;
  qty?: number;
}

function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as any;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanFirestoreData(item)) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        cleaned[key] = cleanFirestoreData(val);
      }
    }
    return cleaned;
  }
  return obj;
}

/**
 * Saves or updates a Smog Leak Unit record in Firebase Firestore
 */
export async function syncSmogLeakUnitToFirebase(unit: LeakUnitRecordForFirebase): Promise<void> {
  if (!db || !unit || !unit.id) return;
  try {
    const docRef = doc(db, 'smog_leak_units', unit.id);
    const cleaned = cleanFirestoreData(unit);
    await setDoc(docRef, cleaned, { merge: true });
    console.log('[Firebase] Smog Leak Unit saved:', unit.id);
  } catch (err) {
    console.warn('[Firebase] Smog Leak Unit save note:', err);
  }
}

/**
 * Deletes a Smog Leak Unit record from Firebase Firestore
 */
export async function deleteSmogLeakUnitFromFirebase(id: string): Promise<void> {
  if (!db || !id) return;
  try {
    const docRef = doc(db, 'smog_leak_units', id);
    await deleteDoc(docRef);
    console.log('[Firebase] Smog Leak Unit deleted:', id);
  } catch (err) {
    console.warn('[Firebase] Smog Leak Unit delete note:', err);
  }
}

/**
 * Fetches all Smog Leak Unit records from Firebase Firestore
 */
export async function fetchSmogLeakUnitsFromFirebase(): Promise<LeakUnitRecordForFirebase[] | null> {
  if (!db) return null;
  try {
    const colRef = collection(db, 'smog_leak_units');
    const snap = await getDocs(colRef);
    if (snap.empty) return null;
    const list: LeakUnitRecordForFirebase[] = [];
    snap.forEach((d: any) => {
      const data = d.data() as LeakUnitRecordForFirebase;
      if (data && data.id) {
        list.push(data);
      }
    });
    // Sort descending by creation date
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return list;
  } catch (err) {
    console.warn('[Firebase] Smog Leak Units fetch note:', err);
    return null;
  }
}

/**
 * Attaches a real-time listener for multi-device Smog Leak Unit sync from Firebase Firestore
 */
export function subscribeSmogLeakUnitsFromFirebase(
  callback: (units: LeakUnitRecordForFirebase[]) => void
): () => void {
  if (!db) return () => {};
  try {
    const colRef = collection(db, 'smog_leak_units');
    const unsubscribe = onSnapshot(
      colRef,
      (snap: any) => {
        if (snap) {
          const list: LeakUnitRecordForFirebase[] = [];
          snap.forEach((d: any) => {
            const data = d.data() as LeakUnitRecordForFirebase;
            if (data && data.id) {
              list.push(data);
            }
          });
          if (list.length > 0) {
            list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            callback(list);
          }
        }
      },
      (err: any) => {
        console.warn('[Firebase] Smog Leak Units listener note:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('[Firebase] Could not attach Smog Leak Units listener:', err);
    return () => {};
  }
}
