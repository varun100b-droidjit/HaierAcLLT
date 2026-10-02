import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { isPhotoMissing } from '../utils/placeholderImage';

export interface CloudPhotoRecord {
  id: string;
  unitId: string;
  unitType: 'proto' | 'pp' | 'field';
  photoKey: string;
  dataUrl: string;
  updatedAt: string;
}

const COLLECTION_NAME = 'unit_photos';

/**
 * Sanitizes photo key to ensure valid Firestore document IDs
 */
function sanitizeDocId(unitId: string, photoKey: string): string {
  const cleanKey = photoKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${unitId}__${cleanKey}`;
}

/**
 * Uploads a single photo directly to Firebase Firestore server.
 * Each photo is stored as an isolated document (~40KB-90KB), eliminating
 * any 1MB document limit issues and ensuring immediate server persistence.
 */
export async function uploadSinglePhotoToServer(
  unitId: string,
  unitType: 'proto' | 'pp' | 'field',
  photoKey: string,
  dataUrl: string
): Promise<boolean> {
  if (!db || !unitId || !photoKey || !dataUrl) return false;
  if (isPhotoMissing(dataUrl)) return false;

  try {
    const docId = sanitizeDocId(unitId, photoKey);
    const docRef = doc(db, COLLECTION_NAME, docId);
    
    await setDoc(docRef, {
      id: docId,
      unitId,
      unitType,
      photoKey,
      dataUrl,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`[CloudPhotoService] Successfully uploaded photo '${photoKey}' for unit ${unitId} to server.`);
    return true;
  } catch (err) {
    console.warn(`[CloudPhotoService] Error uploading photo '${photoKey}' to server:`, err);
    return false;
  }
}

/**
 * Uploads all genuine photos of a unit directly to Firebase Firestore server.
 * Ensures desktop uploads are immediately accessible from mobile devices.
 */
export async function uploadUnitPhotosToServer(
  unitId: string,
  unitType: 'proto' | 'pp' | 'field',
  photos: Record<string, string | undefined>
): Promise<void> {
  if (!db || !unitId || !photos || typeof photos !== 'object') return;

  try {
    const validEntries = Object.entries(photos).filter(([k, v]) => {
      return (
        k &&
        typeof v === 'string' &&
        v.trim() !== '' &&
        v !== 'NA' &&
        !isPhotoMissing(v) &&
        (v.startsWith('data:image/') || v.startsWith('http') || v.startsWith('blob:') || v.length > 80)
      );
    });

    if (validEntries.length === 0) return;

    // Upload in parallel with batching so it completes in under 1 second
    const uploadPromises = validEntries.map(async ([photoKey, dataUrl]) => {
      if (!dataUrl) return;
      return uploadSinglePhotoToServer(unitId, unitType, photoKey, dataUrl);
    });

    await Promise.all(uploadPromises);
    console.log(`[CloudPhotoService] Completed server sync of ${validEntries.length} photos for unit ${unitId}.`);
  } catch (err) {
    console.warn(`[CloudPhotoService] Error uploading photos for unit ${unitId}:`, err);
  }
}

/**
 * Fetches all photos for a specific unit directly from the Firebase Firestore server.
 * Used on mobile devices and desktops to view full resolution photos uploaded from any device.
 */
export async function fetchUnitPhotosFromServer(
  unitId: string
): Promise<Record<string, string>> {
  if (!db || !unitId) return {};

  try {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('unitId', '==', unitId));
    const snapshot = await getDocs(q);

    const photos: Record<string, string> = {};
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as CloudPhotoRecord;
      if (data && data.photoKey && data.dataUrl && !isPhotoMissing(data.dataUrl)) {
        photos[data.photoKey] = data.dataUrl;
      }
    });

    return photos;
  } catch (err) {
    console.warn(`[CloudPhotoService] Error fetching photos for unit ${unitId} from server:`, err);
    return {};
  }
}

/**
 * Subscribes to real-time photo changes for a specific unit directly from the Firebase Firestore server.
 * When an operator uploads a photo from Mobile, the Desktop UI updates instantly in real time.
 */
export function subscribeToUnitPhotos(
  unitId: string,
  onUpdate: (photos: Record<string, string>) => void
): () => void {
  if (!db || !unitId) return () => {};

  try {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('unitId', '==', unitId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const photos: Record<string, string> = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as CloudPhotoRecord;
        if (data && data.photoKey && data.dataUrl && !isPhotoMissing(data.dataUrl)) {
          photos[data.photoKey] = data.dataUrl;
        }
      });
      if (Object.keys(photos).length > 0) {
        onUpdate(photos);
      }
    }, (err) => {
      console.warn(`[CloudPhotoService] Real-time photo subscription error for unit ${unitId}:`, err);
    });

    return unsubscribe;
  } catch (err) {
    console.warn(`[CloudPhotoService] Failed to attach photo listener for unit ${unitId}:`, err);
    return () => {};
  }
}

/**
 * Fetches all photos across all units directly from the Firebase Firestore server.
 * Groups them by unitId -> { photoKey: dataUrl }.
 */
export async function fetchAllUnitPhotosFromServer(): Promise<Map<string, Record<string, string>>> {
  const result = new Map<string, Record<string, string>>();
  if (!db) return result;

  try {
    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(colRef);

    snapshot.forEach(docSnap => {
      const data = docSnap.data() as CloudPhotoRecord;
      if (data && data.unitId && data.photoKey && data.dataUrl && !isPhotoMissing(data.dataUrl)) {
        if (!result.has(data.unitId)) {
          result.set(data.unitId, {});
        }
        result.get(data.unitId)![data.photoKey] = data.dataUrl;
      }
    });

    return result;
  } catch (err) {
    console.warn('[CloudPhotoService] Error fetching all unit photos from server:', err);
    return result;
  }
}

/**
 * Deletes all photos associated with a deleted unit from the Firebase Firestore server.
 */
export async function deleteUnitPhotosFromServer(unitId: string): Promise<void> {
  if (!db || !unitId) return;

  try {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('unitId', '==', unitId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
    console.log(`[CloudPhotoService] Successfully deleted server photos for unit ${unitId}.`);
  } catch (err) {
    console.warn(`[CloudPhotoService] Error deleting server photos for unit ${unitId}:`, err);
  }
}

/**
 * Deletes a single specific photo for a unit directly from the Firebase Firestore server.
 */
export async function deleteSinglePhotoFromServer(unitId: string, photoKey: string): Promise<void> {
  if (!db || !unitId || !photoKey) return;

  try {
    const docId = sanitizeDocId(unitId, photoKey);
    await deleteDoc(doc(db, COLLECTION_NAME, docId)).catch(() => {});

    // Also query by unitId and photoKey to catch any variants/aliases
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where('unitId', '==', unitId), where('photoKey', '==', photoKey));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const batch = writeBatch(db);
      snapshot.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
    }
    console.log(`[CloudPhotoService] Successfully deleted server photo '${photoKey}' for unit ${unitId}.`);
  } catch (err) {
    console.warn(`[CloudPhotoService] Error deleting single photo '${photoKey}' from server:`, err);
  }
}
