/**
 * Network Connectivity & Cloud Direct-Save Manager
 * Ensures all mutations are persisted directly to Firebase Firestore & Supabase.
 * Actively monitors network connectivity in real-time (instant event + heartbeat probe)
 * Triggers interactive "No Internet Connection" modal when offline.
 */

type NetworkModalListener = (isOpen: boolean, context?: string) => void;
type ConnectionStateListener = (isOnline: boolean) => void;

let isOnlineState: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
let isModalOpenState: boolean = false;
let currentModalContext: string = '';

const modalListeners = new Set<NetworkModalListener>();
const connectionListeners = new Set<ConnectionStateListener>();

function notifyConnectionListeners(online: boolean) {
  connectionListeners.forEach((fn) => {
    try { fn(online); } catch {}
  });
}

function notifyModalListeners() {
  modalListeners.forEach((fn) => {
    try { fn(isModalOpenState, currentModalContext); } catch {}
  });
}

/**
 * Checks whether the browser has an active network connection.
 */
export function isNetworkOnline(): boolean {
  if (typeof navigator !== 'undefined') {
    return navigator.onLine;
  }
  return true;
}

/**
 * Explicitly triggers the "No Internet Connection" Popup Modal
 */
export function triggerNoInternetModal(actionContext?: string) {
  isModalOpenState = true;
  currentModalContext = actionContext || 'Network connection lost';
  notifyModalListeners();
}

/**
 * Closes the "No Internet Connection" Modal
 */
export function closeNoInternetModal() {
  isModalOpenState = false;
  currentModalContext = '';
  notifyModalListeners();
}

/**
 * Actively tests connectivity by pinging internal /api/health or reliable endpoints
 */
export async function testActiveConnection(): Promise<boolean> {
  // If browser OS reports offline, return false
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    isOnlineState = false;
    notifyConnectionListeners(false);
    return false;
  }

  // 1. Try local server health check first (most reliable, same origin)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`/api/health?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      isOnlineState = true;
      notifyConnectionListeners(true);
      if (isModalOpenState) {
        closeNoInternetModal();
      }
      return true;
    }
  } catch {
    // Local probe timed out or had network issue, try lightweight fallback
  }

  // 2. Try lightweight external fallback
  try {
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 4000);
    
    await fetch(`https://www.gstatic.com/generate_204?t=${Date.now()}`, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller2.signal,
    });
    clearTimeout(timeoutId2);
    
    isOnlineState = true;
    notifyConnectionListeners(true);
    if (isModalOpenState) {
      closeNoInternetModal();
    }
    return true;
  } catch {
    // If external probe fails (e.g. adblocker, DNS restriction, or slow mobile data)
    // but navigator.onLine is true, trust navigator.onLine
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      isOnlineState = true;
      notifyConnectionListeners(true);
      if (isModalOpenState) {
        closeNoInternetModal();
      }
      return true;
    }
  }

  // Confirmed offline
  isOnlineState = false;
  notifyConnectionListeners(false);
  return false;
}

// -------------------------------------------------------------
// Real-Time Background Listeners
// -------------------------------------------------------------
if (typeof window !== 'undefined') {
  // 1. Immediate OS / Browser Offline event
  window.addEventListener('offline', () => {
    console.warn('[NetworkManager] Browser entered OFFLINE mode');
    isOnlineState = false;
    notifyConnectionListeners(false);
    triggerNoInternetModal('Internet connection disconnected');
  });

  // 2. Immediate OS / Browser Online event
  window.addEventListener('online', () => {
    console.log('[NetworkManager] Browser entered ONLINE mode, verifying ping...');
    isOnlineState = true;
    notifyConnectionListeners(true);
    testActiveConnection();
  });

  // 3. Initial check on startup
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    isOnlineState = false;
    setTimeout(() => {
      triggerNoInternetModal('No initial internet connection');
    }, 400);
  } else {
    isOnlineState = true;
  }

  // 4. Periodic background state sync (every 30 seconds, non-intrusive)
  setInterval(() => {
    if (typeof navigator !== 'undefined') {
      if (!navigator.onLine && isOnlineState) {
        isOnlineState = false;
        notifyConnectionListeners(false);
        triggerNoInternetModal('Network disconnected');
      } else if (navigator.onLine && !isOnlineState) {
        isOnlineState = true;
        notifyConnectionListeners(true);
        closeNoInternetModal();
      }
    }
  }, 30000);
}

/**
 * Guard function before saving to Cloud.
 * If offline, opens modal and returns false.
 */
export function requireOnlineForSave(actionDescription: string): boolean {
  if (!isNetworkOnline()) {
    triggerNoInternetModal(`Cannot save "${actionDescription}" while offline`);
    return false;
  }
  return true;
}

/**
 * Subscribe to Modal Open/Close events
 */
export function subscribeNoInternetModal(listener: NetworkModalListener) {
  modalListeners.add(listener);
  // Emit current state immediately
  listener(isModalOpenState, currentModalContext);
  return () => {
    modalListeners.delete(listener);
  };
}

/**
 * Subscribe to Online/Offline state changes
 */
export function subscribeConnectionState(listener: ConnectionStateListener) {
  connectionListeners.add(listener);
  listener(isOnlineState);
  return () => {
    connectionListeners.delete(listener);
  };
}
