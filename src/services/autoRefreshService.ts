/**
 * Auto-Refresh & Real-Time Sync Service
 * Manages periodic background data synchronization across all unit modules (R&D, Proto, PP, Field).
 * Features automatic pausing while user is filling out any form, and automatic resume once the form is saved/updated.
 */

import { useState, useEffect } from 'react';
import { forceSyncRDUnits } from './unitStore';
import { forceSyncProtoUnits } from './protoUnitStore';
import { forceSyncPpUnits } from './ppUnitStore';
import { forceSyncFieldUnits } from './fieldUnitStore';

export interface AutoRefreshFrequencyOption {
  value: number; // seconds
  label: string; // display name e.g. "30s", "1m", "5m"
  description: string;
}

export const FREQUENCY_OPTIONS: AutoRefreshFrequencyOption[] = [
  { value: 15, label: '15s', description: 'Ultra Fast (15 Seconds)' },
  { value: 30, label: '30s', description: 'Standard (30 Seconds)' },
  { value: 60, label: '1m', description: 'Normal (1 Minute)' },
  { value: 300, label: '5m', description: 'Relaxed (5 Minutes)' },
];

const STORAGE_KEY_ENABLED = 'lltlab_autorefresh_enabled';
const STORAGE_KEY_FREQUENCY = 'lltlab_autorefresh_frequency';

export type AutoRefreshStatus = 'active' | 'paused_form' | 'disabled' | 'syncing';

export interface AutoRefreshState {
  enabled: boolean;
  frequency: number; // in seconds
  secondsLeft: number;
  status: AutoRefreshStatus;
  isFormFilling: boolean;
  activeFormName: string | null;
  lastSyncTime: string;
  isSyncing: boolean;
}

// In-memory state
let state: AutoRefreshState = {
  enabled: (() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ENABLED);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  })(),
  frequency: (() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FREQUENCY);
      const val = saved ? parseInt(saved, 10) : 30;
      return [15, 30, 60, 300].includes(val) ? val : 30;
    } catch {
      return 30;
    }
  })(),
  secondsLeft: 30,
  status: 'active',
  isFormFilling: false,
  activeFormName: null,
  lastSyncTime: 'Just now',
  isSyncing: false,
};

const listeners = new Set<(st: AutoRefreshState) => void>();

function notify() {
  // Recalculate status
  if (!state.enabled) {
    state.status = 'disabled';
  } else if (state.isSyncing) {
    state.status = 'syncing';
  } else if (state.isFormFilling) {
    state.status = 'paused_form';
  } else {
    state.status = 'active';
  }

  listeners.forEach(fn => fn({ ...state }));
}

let tickerTimer: any = null;
let formBlurTimeout: any = null;
let isInitialized = false;

/**
 * Execute actual data refresh
 */
export async function triggerGlobalRefresh(): Promise<void> {
  if (state.isSyncing || !state.enabled) return;
  if (state.isFormFilling) {
    // Cannot refresh while user is filling out a form
    return;
  }

  state.isSyncing = true;
  notify();

  try {
    await Promise.allSettled([
      forceSyncRDUnits(),
      forceSyncProtoUnits(),
      forceSyncPpUnits(),
      forceSyncFieldUnits(),
    ]);

    const now = new Date();
    state.lastSyncTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (err) {
    console.warn('[AutoRefresh] Background sync completed with notices:', err);
  } finally {
    state.isSyncing = false;
    state.secondsLeft = state.frequency;
    notify();
  }
}

/**
 * Start the second-by-second countdown ticker
 */
function startTicker() {
  if (tickerTimer) clearInterval(tickerTimer);

  tickerTimer = setInterval(() => {
    if (!state.enabled) {
      if (state.status !== 'disabled') notify();
      return;
    }

    if (state.isFormFilling) {
      if (state.status !== 'paused_form') notify();
      return; // Do not decrement countdown while filling form
    }

    if (state.secondsLeft > 1) {
      state.secondsLeft -= 1;
      notify();
    } else {
      state.secondsLeft = 0;
      triggerGlobalRefresh();
    }
  }, 1000);
}

/**
 * Pause auto-refresh explicitly when a form is being filled
 */
export function pauseAutoRefreshForForm(formIdentifier?: string) {
  if (formBlurTimeout) {
    clearTimeout(formBlurTimeout);
    formBlurTimeout = null;
  }
  state.isFormFilling = true;
  state.activeFormName = formIdentifier || 'Form in Progress';
  notify();
}

/**
 * Resume auto-refresh after form save, update, or cancel
 */
export function resumeAutoRefreshAfterSave() {
  if (formBlurTimeout) {
    clearTimeout(formBlurTimeout);
    formBlurTimeout = null;
  }
  state.isFormFilling = false;
  state.activeFormName = null;
  // Reset secondsLeft so the user gets a fresh countdown window after saving
  state.secondsLeft = state.frequency;
  notify();
}

/**
 * Toggle on/off state
 */
export function toggleAutoRefresh(): boolean {
  return setAutoRefreshEnabled(!state.enabled);
}

/**
 * Set enabled state
 */
export function setAutoRefreshEnabled(enabled: boolean): boolean {
  state.enabled = enabled;
  try {
    localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
  } catch {}

  if (enabled) {
    state.secondsLeft = state.frequency;
  }
  notify();
  return state.enabled;
}

/**
 * Change auto-refresh frequency (in seconds)
 */
export function setAutoRefreshFrequency(seconds: number) {
  const valid = [15, 30, 60, 300].includes(seconds) ? seconds : 30;
  state.frequency = valid;
  state.secondsLeft = valid;
  try {
    localStorage.setItem(STORAGE_KEY_FREQUENCY, String(valid));
  } catch {}
  notify();
}

/**
 * Get current snapshot of state
 */
export function getAutoRefreshState(): AutoRefreshState {
  return { ...state };
}

/**
 * Subscribe to state changes
 */
export function subscribeAutoRefresh(listener: (st: AutoRefreshState) => void): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Initialize automatic DOM listeners to pause during any form typing
 * and resume on form submit / modal close
 */
export function initAutoRefreshService() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // Initialize seconds left
  state.secondsLeft = state.frequency;

  // Global listeners for detecting form filling
  const handleFocusIn = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Check if target is an editable form element (ignore search inputs or quick view filters)
    const isInput = target.tagName === 'INPUT' && !['search', 'checkbox', 'radio'].includes((target as HTMLInputElement).type);
    const isTextarea = target.tagName === 'TEXTAREA';
    const isSelect = target.tagName === 'SELECT';

    // Or element is inside a dialog modal or form
    const insideForm = target.closest('form') || target.closest('[role="dialog"]') || target.closest('.modal-content');

    if ((isInput || isTextarea || isSelect) && insideForm) {
      if (formBlurTimeout) {
        clearTimeout(formBlurTimeout);
        formBlurTimeout = null;
      }
      const formEl = target.closest('form');
      const formTitle = target.closest('[role="dialog"]')?.querySelector('h2, h3')?.textContent || 'Editing Form';
      state.isFormFilling = true;
      state.activeFormName = formTitle.trim() || (formEl?.getAttribute('aria-label') || 'Active Form');
      notify();
    }
  };

  const handleFocusOut = (e: FocusEvent) => {
    // Wait briefly to see if user focuses another input in the same form
    if (formBlurTimeout) clearTimeout(formBlurTimeout);
    formBlurTimeout = setTimeout(() => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isStillEditing = activeEl && (
        (activeEl.tagName === 'INPUT' && !['search', 'checkbox', 'radio'].includes((activeEl as HTMLInputElement).type)) ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT'
      ) && Boolean(activeEl.closest('form') || activeEl.closest('[role="dialog"]'));

      if (!isStillEditing) {
        // Also check if any modal dialog with inputs is currently open
        const openModalWithInputs = document.querySelector('[role="dialog"] input:not([type="search"]), [role="dialog"] textarea');
        if (!openModalWithInputs) {
          state.isFormFilling = false;
          state.activeFormName = null;
          notify();
        }
      }
    }, 4000);
  };

  // When any form is submitted (saved or updated) -> Resume immediately!
  const handleSubmit = () => {
    resumeAutoRefreshAfterSave();
  };

  // When reset or escape pressed
  const handleReset = () => {
    resumeAutoRefreshAfterSave();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setTimeout(() => {
        const anyModal = document.querySelector('[role="dialog"]');
        if (!anyModal) {
          resumeAutoRefreshAfterSave();
        }
      }, 300);
    }
  };

  window.addEventListener('focusin', handleFocusIn);
  window.addEventListener('focusout', handleFocusOut);
  window.addEventListener('submit', handleSubmit, true);
  window.addEventListener('reset', handleReset, true);
  window.addEventListener('keydown', handleKeyDown);

  startTicker();
}

// Auto-run initialization on import in browser
if (typeof window !== 'undefined') {
  initAutoRefreshService();
}

/**
 * React Hook to consume auto-refresh state
 */
export function useAutoRefresh(): AutoRefreshState & {
  toggle: () => void;
  setEnabled: (val: boolean) => void;
  setFrequency: (sec: number) => void;
  syncNow: () => Promise<void>;
  pauseForForm: (name?: string) => void;
  resumeAfterSave: () => void;
} {
  const [current, setCurrent] = useState<AutoRefreshState>(() => getAutoRefreshState());

  useEffect(() => {
    return subscribeAutoRefresh((st) => setCurrent(st));
  }, []);

  return {
    ...current,
    toggle: () => toggleAutoRefresh(),
    setEnabled: (val: boolean) => setAutoRefreshEnabled(val),
    setFrequency: (sec: number) => setAutoRefreshFrequency(sec),
    syncNow: () => triggerGlobalRefresh(),
    pauseForForm: (name?: string) => pauseAutoRefreshForForm(name),
    resumeAfterSave: () => resumeAutoRefreshAfterSave(),
  };
}
