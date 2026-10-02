import { isPhotoMissing } from '../utils/placeholderImage';

/**
 * IndexedDB Storage Helper for High-Capacity Client-Side Storage
 * Handles large items like high-resolution base64 images and reports without 5MB localStorage quota limitations.
 */

const DB_NAME = 'llt_lab_storage_v1';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getIndexedDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const storeNames = ['saved_reports', 'proto_units', 'pp_units', 'field_units'];
      storeNames.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      });
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      console.warn('[IndexedDB] Failed to open database:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

export async function idbSaveAll<T extends { id: string; photos?: any }>(storeName: string, items: T[]): Promise<void> {
  try {
    const db = await getIndexedDb();
    
    // Non-destructively preserve high-res photos already present in IDB
    let finalItems = items;
    if (storeName === 'proto_units' || storeName === 'pp_units' || storeName === 'field_units') {
      try {
        const existing = await idbGetAll<T>(storeName);
        if (existing && existing.length > 0) {
          finalItems = restorePhotosFromIdb(items, existing);
        }
      } catch (mergeErr) {
        console.warn(`[IndexedDB] Non-destructive merge note for ${storeName}:`, mergeErr);
      }
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      finalItems.forEach((item) => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] Error saving to ${storeName}:`, err);
  }
}

export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  try {
    const db = await getIndexedDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] Error reading from ${storeName}:`, err);
    return [];
  }
}

/**
 * Safely stores an array in localStorage.
 * If quota is exceeded, saves metadata without writing corrupt fake image strings.
 * IndexedDB continues to store the 100% full quality records with all photos.
 */
export function safeLocalStorageSet(key: string, data: any[]): boolean {
  try {
    const raw = JSON.stringify(data);
    localStorage.setItem(key, raw);
    return true;
  } catch (err) {
    console.warn(`[Storage] LocalStorage quota exceeded for ${key}. Falling back to metadata while IndexedDB preserves photos.`);
    try {
      // Save metadata without corrupting photos with broken dummy data: URLs
      const lightweight = data.map((item) => {
        if (!item || typeof item !== 'object') return item;
        const copy = { ...item };
        if (copy.photos && typeof copy.photos === 'object') {
          const strippedPhotos: Record<string, string> = {};
          Object.entries(copy.photos).forEach(([pKey, pVal]) => {
            if (typeof pVal === 'string') {
              // Strip missing or placeholder images
              if (isPhotoMissing(pVal)) {
                return;
              }
              // Keep small identifiers/keys, omit large strings if over quota
              if (pVal.startsWith('data:image/') && pVal.length > 500) {
                // Omit large base64 from lightweight copy so IndexedDB holds full version
                return;
              } else {
                strippedPhotos[pKey] = pVal;
              }
            }
          });
          copy.photos = strippedPhotos;
        }
        return copy;
      });

      localStorage.setItem(key, JSON.stringify(lightweight));
      return true;
    } catch (fallbackErr) {
      console.warn(`[Storage] Could not write lightweight metadata to localStorage for ${key}:`, fallbackErr);
      return false;
    }
  }
}

/**
 * Merges loaded items with high-fidelity records from IndexedDB so full photos
 * are always restored into memory if localStorage was trimmed.
 */
export function restorePhotosFromIdb<T extends { id: string; photos?: any }>(
  currentItems: T[],
  idbItems: T[]
): T[] {
  if (!idbItems || idbItems.length === 0) return currentItems || [];
  const idbMap = new Map<string, T>();
  idbItems.forEach(item => {
    if (item && item.id) idbMap.set(item.id, item);
  });

  const processedIds = new Set<string>();
  const result: T[] = (currentItems || []).map(item => {
    if (!item || !item.id) return item;
    processedIds.add(item.id);
    const idbRecord = idbMap.get(item.id);
    if (!idbRecord || !idbRecord.photos) return item;

    // Check if idbRecord has real photos that current item lacks
    const mergedPhotos: Record<string, string> = { ...(item.photos || {}) };
    let hasAdditions = false;

    Object.entries(idbRecord.photos).forEach(([k, v]) => {
      if (typeof v === 'string' && !isPhotoMissing(v)) {
        const currentVal = mergedPhotos[k];
        if (isPhotoMissing(currentVal)) {
          mergedPhotos[k] = v;
          hasAdditions = true;
        }
      }
    });

    if (hasAdditions) {
      return {
        ...item,
        photos: mergedPhotos
      };
    }
    return item;
  });

  // Preserve any items from IDB that were missing entirely
  idbItems.forEach(item => {
    if (item && item.id && !processedIds.has(item.id)) {
      result.push(item);
      processedIds.add(item.id);
    }
  });

  return result;
}
