// Store for Smog Extra Metrics (Pro. Qty and Smog Pending Qty)
export interface SmogExtraMetrics {
  proQty: number;
  smogPendingQty: number;
}

const STORAGE_KEY = 'llt_smog_extra_metrics_v1';

const localBus = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('llt_smog_extra_bus')
  : null;

let memoryMetrics: SmogExtraMetrics | null = null;
const listeners = new Set<(metrics: SmogExtraMetrics) => void>();

function notifyListeners(metrics: SmogExtraMetrics) {
  listeners.forEach((listener) => {
    try {
      listener(metrics);
    } catch (err) {
      console.error('Error in smog extra metrics listener:', err);
    }
  });
}

export function getSmogExtraMetrics(): SmogExtraMetrics {
  if (memoryMetrics !== null) {
    return memoryMetrics;
  }
  try {
    if (typeof window === 'undefined') {
      return { proQty: 0, smogPendingQty: 0 };
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memoryMetrics = { proQty: 0, smogPendingQty: 0 };
      return memoryMetrics;
    }
    const parsed = JSON.parse(raw);
    memoryMetrics = {
      proQty: Number(parsed.proQty) || 0,
      smogPendingQty: Number(parsed.smogPendingQty) || 0,
    };
    return memoryMetrics;
  } catch (err) {
    console.error('Failed to parse smog extra metrics', err);
    memoryMetrics = { proQty: 0, smogPendingQty: 0 };
    return memoryMetrics;
  }
}

export function saveSmogExtraMetrics(updates: Partial<SmogExtraMetrics>): SmogExtraMetrics {
  const current = getSmogExtraMetrics();
  const next: SmogExtraMetrics = {
    proQty: updates.proQty !== undefined ? Number(updates.proQty) || 0 : current.proQty,
    smogPendingQty: updates.smogPendingQty !== undefined ? Number(updates.smogPendingQty) || 0 : current.smogPendingQty,
  };

  memoryMetrics = next;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('smog-extra-updated', { detail: next }));
      if (localBus) {
        localBus.postMessage({ type: 'smog-extra-updated', payload: next });
      }
    }
  } catch (err) {
    console.error('Failed to persist smog extra metrics', err);
  }

  notifyListeners(next);
  return next;
}

export function subscribeSmogExtraMetrics(cb: (metrics: SmogExtraMetrics) => void): () => void {
  listeners.add(cb);
  cb(getSmogExtraMetrics());

  const handleCustom = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail) {
      memoryMetrics = detail;
      cb(detail);
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      memoryMetrics = null;
      cb(getSmogExtraMetrics());
    }
  };

  const handleBus = (e: MessageEvent) => {
    if (e.data && e.data.type === 'smog-extra-updated' && e.data.payload) {
      memoryMetrics = e.data.payload;
      cb(e.data.payload);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('smog-extra-updated', handleCustom);
    window.addEventListener('storage', handleStorage);
    if (localBus) {
      localBus.addEventListener('message', handleBus);
    }
  }

  return () => {
    listeners.delete(cb);
    if (typeof window !== 'undefined') {
      window.removeEventListener('smog-extra-updated', handleCustom);
      window.removeEventListener('storage', handleStorage);
      if (localBus) {
        localBus.removeEventListener('message', handleBus);
      }
    }
  };
}
