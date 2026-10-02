import { db, isFirebaseConfigured, collection, doc, setDoc, getDocs, deleteDoc, onSnapshot } from './firebase';
import { broadcastLabRealtimeEvent, subscribeToLabRealtimeEvents } from '../lib/supabase';

export interface ModelRecord {
  id: string; // unique ID or normalized material code
  modelName: string;
  materialCode: string; // Typically first 9 characters or full material code
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY_MODEL_MASTER = 'llt_model_master_v1';

// Seed demo models so user's example works out-of-the-box
const INITIAL_MODELS: ModelRecord[] = [
  {
    id: 'AADUU2000',
    modelName: 'HSO53-3NT-I',
    materialCode: 'AADUU2000',
    createdAt: new Date().toISOString()
  },
  {
    id: 'AAEUU2000',
    modelName: 'HSO35-2NT-I',
    materialCode: 'AAEUU2000',
    createdAt: new Date().toISOString()
  },
  {
    id: 'AABUU1000',
    modelName: 'HSO26-1NT-I',
    materialCode: 'AABUU1000',
    createdAt: new Date().toISOString()
  },
  {
    id: 'AACUU1500',
    modelName: 'HSO70-4NT-I',
    materialCode: 'AACUU1500',
    createdAt: new Date().toISOString()
  },
  {
    id: 'AAFUU3000',
    modelName: 'HSU18-3NT-O',
    materialCode: 'AAFUU3000',
    createdAt: new Date().toISOString()
  }
];

function loadLocalModels(): ModelRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MODEL_MASTER);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_MODEL_MASTER, JSON.stringify(INITIAL_MODELS));
      return INITIAL_MODELS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_MODELS;
  } catch {
    return INITIAL_MODELS;
  }
}

function saveLocalModels(models: ModelRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY_MODEL_MASTER, JSON.stringify(models));
  } catch (e) {
    console.warn('Failed to save models to local storage:', e);
  }
  if (localModelBus) {
    try { localModelBus.postMessage({ timestamp: Date.now() }); } catch {}
  }
  broadcastLabRealtimeEvent('models_change', { timestamp: Date.now() });
}

let modelsCache: ModelRecord[] = loadLocalModels();
let listeners: ((models: ModelRecord[]) => void)[] = [];

function notifyListeners(models: ModelRecord[]) {
  modelsCache = models;
  listeners.forEach(cb => {
    try { cb(models); } catch (e) { console.error(e); }
  });
}

// Local Inter-Tab Broadcast Channel
const localModelBus = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('llt_model_master_bus') 
  : null;

if (localModelBus) {
  localModelBus.onmessage = () => {
    modelsCache = loadLocalModels();
    notifyListeners(modelsCache);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY_MODEL_MASTER) {
      modelsCache = loadLocalModels();
      notifyListeners(modelsCache);
    }
  });
}

// Real-time Supabase Event Listener
subscribeToLabRealtimeEvents((event) => {
  if (event === 'models_change') {
    initCloudAndLocalModels();
  }
});

/* =========================================================================
   FIRESTORE REAL-TIME SYNC
   ========================================================================= */

let isFirestoreListenerAttached = false;

export function initCloudAndLocalModels() {
  if (typeof window === 'undefined') return;

  if (isFirebaseConfigured && db && !isFirestoreListenerAttached) {
    try {
      const colRef = collection(db, 'model_master');
      onSnapshot(colRef, (snap) => {
        if (!snap.empty) {
          const cloudModels: ModelRecord[] = [];
          snap.forEach((d) => {
            const data = d.data() as ModelRecord;
            cloudModels.push({
              ...data,
              id: d.id || data.id,
              materialCode: (data.materialCode || d.id).trim().toUpperCase(),
              modelName: (data.modelName || '').trim()
            });
          });

          if (cloudModels.length > 0) {
            modelsCache = cloudModels;
            saveLocalModels(cloudModels);
            notifyListeners(cloudModels);
            return;
          }
        }
      }, (err) => {
        console.warn('model_master onSnapshot listener notice:', err);
      });
      isFirestoreListenerAttached = true;
    } catch (e) {
      console.warn('Error setting up model_master Firestore listener:', e);
    }
  }

  // Periodic fallback check
  if (isFirebaseConfigured && db) {
    getDocs(collection(db, 'model_master')).then(snap => {
      if (!snap.empty) {
        const cloudModels: ModelRecord[] = [];
        snap.forEach(d => {
          const data = d.data() as ModelRecord;
          cloudModels.push({
            ...data,
            id: d.id,
            materialCode: (data.materialCode || d.id).trim().toUpperCase(),
            modelName: (data.modelName || '').trim()
          });
        });
        if (cloudModels.length > 0) {
          modelsCache = cloudModels;
          saveLocalModels(cloudModels);
          notifyListeners(cloudModels);
        }
      }
    }).catch(err => {
      console.warn('Error fetching model_master from Firestore:', err);
    });
  }
}

// Initialize immediately
initCloudAndLocalModels();

/* =========================================================================
   PUBLIC STORE METHODS
   ========================================================================= */

export function getAllModels(): ModelRecord[] {
  return [...modelsCache];
}

/**
 * Normalizes input and searches Model Master by 9-char Material Code / Model Prefix
 */
export function findModelByPrefix(rawBarcodeOrPrefix: string): ModelRecord | undefined {
  if (!rawBarcodeOrPrefix) return undefined;
  const clean = rawBarcodeOrPrefix.trim().toUpperCase();
  const prefix9 = clean.length >= 9 ? clean.slice(0, 9) : clean;

  // 1. Direct match on materialCode (first 9 chars or full)
  const match = modelsCache.find(m => {
    const code = m.materialCode.trim().toUpperCase();
    return code === prefix9 || code === clean || clean.startsWith(code) || (code.length >= 9 && prefix9.startsWith(code.slice(0, 9)));
  });

  return match;
}

/**
 * Adds or updates a model record in Firebase & local cache
 */
export async function saveOrUpdateModel(modelName: string, materialCode: string): Promise<ModelRecord> {
  const cleanName = modelName.trim();
  const cleanCode = materialCode.trim().toUpperCase();

  if (!cleanName || !cleanCode) {
    throw new Error('Both Model Name and Material Code are required.');
  }

  // First 9 or normalized ID
  const docId = cleanCode.replace(/[^A-Z0-9_-]/gi, '_');
  const now = new Date().toISOString();

  const record: ModelRecord = {
    id: docId,
    modelName: cleanName,
    materialCode: cleanCode,
    updatedAt: now,
    createdAt: now
  };

  // 1. Update local cache
  const existingIdx = modelsCache.findIndex(m => m.materialCode.toUpperCase() === cleanCode || m.id === docId);
  let updatedList: ModelRecord[];
  if (existingIdx >= 0) {
    updatedList = [...modelsCache];
    updatedList[existingIdx] = {
      ...updatedList[existingIdx],
      modelName: cleanName,
      materialCode: cleanCode,
      updatedAt: now
    };
  } else {
    updatedList = [record, ...modelsCache];
  }

  saveLocalModels(updatedList);
  notifyListeners(updatedList);

  // 2. Save to Firestore
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, 'model_master', docId), record, { merge: true });
    } catch (e) {
      console.warn('Failed to save model to Firestore:', e);
    }
  }

  return record;
}

/**
 * Bulk upload models from parsed Excel sheet. Updates existing if Material Code exists.
 */
export async function bulkUploadModels(
  items: { modelName: string; materialCode: string }[]
): Promise<{ added: number; updated: number; total: number }> {
  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();

  const listCopy = [...modelsCache];

  for (const item of items) {
    const cleanName = (item.modelName || '').trim();
    const cleanCode = (item.materialCode || '').trim().toUpperCase();
    if (!cleanName || !cleanCode) continue;

    const docId = cleanCode.replace(/[^A-Z0-9_-]/gi, '_');
    const existingIdx = listCopy.findIndex(m => m.materialCode.toUpperCase() === cleanCode || m.id === docId);

    if (existingIdx >= 0) {
      listCopy[existingIdx] = {
        ...listCopy[existingIdx],
        modelName: cleanName,
        materialCode: cleanCode,
        updatedAt: now
      };
      updated++;
    } else {
      listCopy.unshift({
        id: docId,
        modelName: cleanName,
        materialCode: cleanCode,
        createdAt: now,
        updatedAt: now
      });
      added++;
    }

    // Save to Firestore asynchronously
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'model_master', docId), {
          id: docId,
          modelName: cleanName,
          materialCode: cleanCode,
          updatedAt: now,
          createdAt: now
        }, { merge: true });
      } catch (e) {
        console.warn('Bulk upload save item error:', e);
      }
    }
  }

  saveLocalModels(listCopy);
  notifyListeners(listCopy);

  return { added, updated, total: added + updated };
}

/**
 * Delete a model from master list
 */
export async function deleteModel(id: string): Promise<void> {
  const updatedList = modelsCache.filter(m => m.id !== id && m.materialCode !== id);
  saveLocalModels(updatedList);
  notifyListeners(updatedList);

  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'model_master', id));
    } catch (e) {
      console.warn('Failed to delete model from Firestore:', e);
    }
  }
}

export function subscribeModelMaster(listener: (models: ModelRecord[]) => void): () => void {
  listeners.push(listener);
  listener(modelsCache);
  return () => {
    listeners = listeners.filter(cb => cb !== listener);
  };
}
