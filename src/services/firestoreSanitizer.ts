import { isPhotoMissing } from '../utils/placeholderImage';

/**
 * firestoreSanitizer.ts
 * Utility functions to prepare objects for safe persistence in Firebase Firestore.
 * 1. Strips all `undefined` values (which crash Firestore setDoc/updateDoc).
 * 2. Ensures base64 photo payloads stay safely within Firestore's 1MB document limit.
 * 3. Strips unneeded placeholder SVGs so only genuine user-uploaded photos are stored.
 */

/**
 * Recursively removes undefined fields from an object so Firestore setDoc does not throw
 * "Unsupported field value: undefined".
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (typeof data !== 'object') {
    return data;
  }
  if (data instanceof Date) {
    return data.toISOString() as unknown as T;
  }
  if (Array.isArray(data)) {
    return data
      .filter(item => item !== undefined)
      .map(item => cleanForFirestore(item)) as unknown as T;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      clean[key] = cleanForFirestore(value);
    }
  }
  return clean as T;
}

/**
 * Ensures that a document being sent to Firestore does not exceed the 1MB (1,048,576 bytes) limit.
 * Deduplicates photo aliases (e.g. PHOTO_IDU_PCB vs iduPcbPhoto) which can multiply document size.
 * Strips placeholder images & corrupt legacy markers so Firestore only stores genuine photos.
 */
export function enforceFirestoreDocSizeLimit<T extends Record<string, any>>(docData: T): T {
  const sanitized = cleanForFirestore(docData);
  try {
    const copy: any = { ...sanitized };

    // Deduplicate photo alias pairs and filter corrupt placeholder markers
    if (copy.photos && typeof copy.photos === 'object') {
      const uniquePhotos: Record<string, any> = {};
      const seenValues = new Map<string, string>(); // value -> first key

      for (const [k, v] of Object.entries(copy.photos)) {
        // Strip corrupt placeholder markers, empty strings, and placeholder SVGs
        if (typeof v === 'string') {
          if (isPhotoMissing(v)) {
            continue;
          }

          // If this exact base64 data was already included under another key, omit duplicate alias
          if (v.startsWith('data:image/')) {
            if (seenValues.has(v)) {
              continue;
            }
            seenValues.set(v, k);
            uniquePhotos[k] = v;
          } else if (v.startsWith('http') || v.startsWith('blob:')) {
            uniquePhotos[k] = v;
          }
        } else if (v !== undefined && v !== null && v !== 'NA' && v !== '') {
          uniquePhotos[k] = v;
        }
      }
      copy.photos = uniquePhotos;
    }

    let raw = JSON.stringify(copy);
    if (raw.length <= 800000) {
      return copy as T;
    }

    console.warn(`[Firestore Sanitizer] Document payload (${Math.round(raw.length / 1024)} KB) exceeds safe threshold. Retaining cloud reference while individual photos are stored in server collection.`);
    // Keep photo existence markers so UI knows photos exist, while individual full photos live in server unit_photos collection
    if (copy.photos && typeof copy.photos === 'object') {
      const reducedPhotos: Record<string, any> = {};
      let currentLen = raw.length;
      
      for (const [k, v] of Object.entries(copy.photos)) {
        if (typeof v === 'string' && v.startsWith('data:image/')) {
          if (currentLen > 700000) {
            // Keep small URL or thumbnail/key reference
            reducedPhotos[k] = `server_photo://${copy.id || 'unit'}/${k}`;
            currentLen -= (v.length - 40);
          } else {
            reducedPhotos[k] = v;
          }
        } else {
          reducedPhotos[k] = v;
        }
      }
      copy.photos = reducedPhotos;
      copy._photosStoredInServerCollection = true;
    }

    return copy as T;
  } catch (err) {
    console.warn('[Firestore Sanitizer] Error checking doc size:', err);
    return sanitized;
  }
}
