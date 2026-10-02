import { useState, useEffect } from 'react';
import { addShiftActivityLog } from './unitStore';
import { db, doc, setDoc, getDoc, onSnapshot } from './firebase';
import { 
  broadcastLabRealtimeEvent, 
  subscribeToLabRealtimeEvents, 
  syncShiftToSupabase, 
  fetchShiftFromSupabase 
} from '../lib/supabase';
import { requireOnlineForSave } from './networkManager';

export type LabShift = 'GENERAL' | 'SHIFT_A' | 'SHIFT_AB' | 'SHIFT_ABC';

export interface ShiftInfo {
  id: LabShift;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  description: string;
  dailyHours: number;
  startMinute: number;
  endMinute: number;
}

export const LAB_SHIFTS: Record<LabShift, ShiftInfo> = {
  GENERAL: {
    id: 'GENERAL',
    name: 'General Shift',
    code: '09:00 - 17:30',
    startTime: '09:00',
    endTime: '17:30',
    description: 'General Shift: 09:00 AM to 05:30 PM (8.5 Hours/Day)',
    dailyHours: 8.5,
    startMinute: 9 * 60,        // 540
    endMinute: 17 * 60 + 30,    // 1050
  },
  SHIFT_A: {
    id: 'SHIFT_A',
    name: 'A Shift',
    code: '07:00 - 15:30',
    startTime: '07:00',
    endTime: '15:30',
    description: 'A Shift: 07:00 AM to 03:30 PM (8.5 Hours/Day)',
    dailyHours: 8.5,
    startMinute: 7 * 60,        // 420
    endMinute: 15 * 60 + 30,    // 930
  },
  SHIFT_AB: {
    id: 'SHIFT_AB',
    name: 'A+B Shift',
    code: '07:00 - 24:00',
    startTime: '07:00',
    endTime: '24:00',
    description: 'A+B Shift: 07:00 AM to 12:00 AM Midnight (17 Hours/Day)',
    dailyHours: 17,
    startMinute: 7 * 60,        // 420
    endMinute: 24 * 60,         // 1440
  },
  SHIFT_ABC: {
    id: 'SHIFT_ABC',
    name: 'A+B+C Shift',
    code: '07:00 - 07:00 (24h)',
    startTime: '07:00',
    endTime: '07:00',
    description: 'A+B+C Shift: 24 Hours Continuous Operation (07:00 AM to 07:00 AM Next Day)',
    dailyHours: 24,
    startMinute: 0,
    endMinute: 24 * 60,
  }
};

const STORAGE_KEY = 'llt_active_lab_shift';

let currentShift: LabShift = 'SHIFT_ABC';

// Load stored shift locally first for instant UI render
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && saved in LAB_SHIFTS && saved !== 'GENERAL') {
    currentShift = saved as LabShift;
  } else {
    currentShift = 'SHIFT_ABC';
    try { localStorage.setItem(STORAGE_KEY, 'SHIFT_ABC'); } catch {}
  }
}

type ShiftChangeListener = (shift: LabShift) => void;
const listeners = new Set<ShiftChangeListener>();

function notifyShiftListeners(shift: LabShift) {
  listeners.forEach(fn => {
    try { fn(shift); } catch (e) { console.warn(e); }
  });
}

// Local Inter-Tab BroadcastChannel
const localShiftBus = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('llt_shift_bus') 
  : null;

if (localShiftBus) {
  localShiftBus.onmessage = (event) => {
    if (event.data?.shift && event.data.shift in LAB_SHIFTS && event.data.shift !== currentShift) {
      currentShift = event.data.shift as LabShift;
      try { localStorage.setItem(STORAGE_KEY, currentShift); } catch {}
      notifyShiftListeners(currentShift);
    }
  };
}

// Inter-tab storage listener
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue && e.newValue in LAB_SHIFTS && e.newValue !== currentShift) {
      currentShift = e.newValue as LabShift;
      notifyShiftListeners(currentShift);
    }
  });
}

/* ==========================================
   REAL-TIME CLOUD SHIFT SYNCHRONIZATION
   ========================================== */

export async function syncShiftToFirestore(shift: LabShift, operatorName: string = 'Shift Manager') {
  if (!db) return;
  try {
    const shiftDocRef = doc(db, 'system_settings', 'active_shift');
    await setDoc(shiftDocRef, {
      shift,
      shiftName: LAB_SHIFTS[shift]?.name || shift,
      updatedBy: operatorName,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log('[ShiftStore] Synced active shift to Cloud Firestore:', shift);
  } catch (err) {
    console.warn('[ShiftStore] Failed to write shift to Firestore:', err);
  }
}

// Real-Time Supabase Broadcast Listener
subscribeToLabRealtimeEvents((event, payload) => {
  if (event === 'shift_change' && payload?.shift && payload.shift in LAB_SHIFTS) {
    const incomingShift = payload.shift as LabShift;
    if (incomingShift !== currentShift) {
      console.log('[ShiftStore] Real-time Supabase shift update received:', incomingShift);
      currentShift = incomingShift;
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(STORAGE_KEY, incomingShift); } catch {}
      }
      notifyShiftListeners(incomingShift);
    }
  }
});

// Attach Real-Time Firestore Listener for Instant Multi-Device Sync (Phone <-> Tablet <-> Desktop)
if (db) {
  try {
    const shiftDocRef = doc(db, 'system_settings', 'active_shift');
    
    // Initial fetch from Firestore
    getDoc(shiftDocRef).then((snap: any) => {
      if (snap && snap.exists()) {
        const data = snap.data();
        if (data && data.shift && data.shift in LAB_SHIFTS && data.shift !== currentShift) {
          currentShift = data.shift as LabShift;
          if (typeof window !== 'undefined') {
            try { localStorage.setItem(STORAGE_KEY, currentShift); } catch {}
          }
          notifyShiftListeners(currentShift);
        }
      }
    }).catch((e: any) => console.warn('[ShiftStore] Initial Firestore fetch note:', e));

    // Real-time listener: triggers whenever Phone or any other device changes shift
    onSnapshot(shiftDocRef, (snap: any) => {
      if (snap && snap.exists()) {
        const data = snap.data();
        if (data && data.shift && data.shift in LAB_SHIFTS) {
          const incomingShift = data.shift as LabShift;
          if (incomingShift !== currentShift) {
            console.log('[ShiftStore] Received real-time Cloud shift update:', incomingShift);
            currentShift = incomingShift;
            if (typeof window !== 'undefined') {
              try { localStorage.setItem(STORAGE_KEY, incomingShift); } catch {}
            }
            notifyShiftListeners(incomingShift);
          }
        }
      }
    }, (error: any) => {
      console.warn('[ShiftStore] Real-time snapshot listener error:', error);
    });
  } catch (err) {
    console.warn('[ShiftStore] Error setting up real-time listener:', err);
  }
}

// Initial fetch from Supabase
fetchShiftFromSupabase().then((res) => {
  if (res && res.shift && res.shift in LAB_SHIFTS && res.shift !== currentShift) {
    currentShift = res.shift as LabShift;
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, currentShift); } catch {}
    }
    notifyShiftListeners(currentShift);
  }
}).catch(() => {});

// Background Heartbeat Polling (every 4s) to ensure instant sync even if socket reconnection occurs
if (typeof window !== 'undefined') {
  setInterval(async () => {
    try {
      const sbShift = await fetchShiftFromSupabase();
      if (sbShift?.shift && sbShift.shift in LAB_SHIFTS && sbShift.shift !== currentShift) {
        currentShift = sbShift.shift as LabShift;
        try { localStorage.setItem(STORAGE_KEY, currentShift); } catch {}
        notifyShiftListeners(currentShift);
      }
    } catch {}
  }, 4000);
}

export function getActiveLabShift(): LabShift {
  return currentShift;
}

export function setActiveLabShift(shift: LabShift, operatorName: string = 'Shift Manager'): void {
  if (!(shift in LAB_SHIFTS)) return;
  if (!requireOnlineForSave(`Change Lab Shift to ${LAB_SHIFTS[shift]?.name || shift}`)) {
    return;
  }
  const oldShift = currentShift;
  currentShift = shift;
  if (typeof window !== 'undefined') {
    try { localStorage.setItem(STORAGE_KEY, shift); } catch {}
  }
  notifyShiftListeners(shift);

  // 1. Broadcast locally to all open browser tabs
  if (localShiftBus) {
    try { localShiftBus.postMessage({ shift, operatorName }); } catch {}
  }

  // 2. Broadcast globally via Supabase Realtime channel (Phone <-> Tablet <-> Desktop)
  broadcastLabRealtimeEvent('shift_change', { shift, operatorName, shiftName: LAB_SHIFTS[shift]?.name });

  // 3. Sync to Supabase PostgreSQL table
  syncShiftToSupabase(shift, LAB_SHIFTS[shift]?.name || shift, operatorName);

  // 4. Sync to Cloud Firestore document
  syncShiftToFirestore(shift, operatorName);

  if (oldShift !== shift) {
    const shiftDetails = LAB_SHIFTS[shift];
    addShiftActivityLog(
      `Lab Shift Switched to ${shiftDetails.name} (${shiftDetails.code})`,
      'shift_change',
      shiftDetails.name,
      operatorName
    );
  }
}

export function subscribeLabShift(listener: ShiftChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useActiveLabShift(): [LabShift, (shift: LabShift) => void] {
  const [shift, setShift] = useState<LabShift>(currentShift);

  useEffect(() => {
    setShift(currentShift);
    const unsubscribe = subscribeLabShift((newShift) => {
      setShift(newShift);
    });
    return unsubscribe;
  }, []);

  return [shift, setActiveLabShift];
}

/**
 * Calculates operational elapsed hours between start and end timestamps
 * based on selected Lab Shift schedule.
 */
export function calculateShiftElapsedHours(
  startMs: number, 
  endMs: number = Date.now(), 
  shiftId: LabShift = currentShift
): number {
  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) return 0;

  const shift = LAB_SHIFTS[shiftId] || LAB_SHIFTS.GENERAL;

  // A+B+C is full 24/7 continuous operation
  if (shiftId === 'SHIFT_ABC') {
    return Math.round(((endMs - startMs) / (1000 * 60 * 60)) * 10) / 10;
  }

  let totalMs = 0;

  const startDate = new Date(startMs);
  const endDate = new Date(endMs);

  // Set startOfDay for loop
  const curDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const lastDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  while (curDay.getTime() <= lastDay.getTime()) {
    const dayStartMs = curDay.getTime();
    const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;

    // Shift window on this day
    const shiftStartMs = dayStartMs + shift.startMinute * 60 * 1000;
    const shiftEndMs = dayStartMs + shift.endMinute * 60 * 1000;

    // Unit active window on this day
    const unitStartMs = Math.max(startMs, dayStartMs);
    const unitEndMs = Math.min(endMs, dayEndMs);

    if (unitStartMs < unitEndMs) {
      const overlapStart = Math.max(unitStartMs, shiftStartMs);
      const overlapEnd = Math.min(unitEndMs, shiftEndMs);

      if (overlapStart < overlapEnd) {
        totalMs += (overlapEnd - overlapStart);
      }
    }

    // Move to next day
    curDay.setDate(curDay.getDate() + 1);
  }

  const hours = totalMs / (1000 * 60 * 60);
  return Math.round(hours * 10) / 10;
}

/**
 * Calculates exact operational elapsed hours without 1-decimal rounding
 */
export function calculateShiftElapsedExactHours(
  startMs: number, 
  endMs: number = Date.now(), 
  shiftId: LabShift = currentShift
): number {
  if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) return 0;

  const shift = LAB_SHIFTS[shiftId] || LAB_SHIFTS.GENERAL;

  if (shiftId === 'SHIFT_ABC') {
    return (endMs - startMs) / (1000 * 60 * 60);
  }

  let totalMs = 0;
  const startDate = new Date(startMs);
  const endDate = new Date(endMs);

  const curDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const lastDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  while (curDay.getTime() <= lastDay.getTime()) {
    const dayStartMs = curDay.getTime();
    const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;

    const shiftStartMs = dayStartMs + shift.startMinute * 60 * 1000;
    const shiftEndMs = dayStartMs + shift.endMinute * 60 * 1000;

    const unitStartMs = Math.max(startMs, dayStartMs);
    const unitEndMs = Math.min(endMs, dayEndMs);

    if (unitStartMs < unitEndMs) {
      const overlapStart = Math.max(unitStartMs, shiftStartMs);
      const overlapEnd = Math.min(unitEndMs, shiftEndMs);

      if (overlapStart < overlapEnd) {
        totalMs += (overlapEnd - overlapStart);
      }
    }

    curDay.setDate(curDay.getDate() + 1);
  }

  return totalMs / (1000 * 60 * 60);
}

/**
 * Formats decimal hours into HH:MM string format (e.g. 24.4 -> "24:24", 1.5 -> "01:30")
 */
export function formatHoursToHHMM(decimalHours: number): string {
  if (isNaN(decimalHours) || decimalHours <= 0) return '00:00';
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}`;
}

/**
 * Checks if the lab shift is currently active at the present moment.
 */
export function isShiftActiveNow(shiftId: LabShift = currentShift): boolean {
  const shift = LAB_SHIFTS[shiftId] || LAB_SHIFTS.GENERAL;
  if (shift.id === 'SHIFT_ABC') return true; // 24-hour continuous operation

  const now = new Date();
  const currentMinute = now.getHours() * 60 + now.getMinutes();

  if (shift.startMinute <= shift.endMinute) {
    return currentMinute >= shift.startMinute && currentMinute < shift.endMinute;
  } else {
    // Overnight shift
    return currentMinute >= shift.startMinute || currentMinute < shift.endMinute;
  }
}

/**
 * Hook that returns true if the current active shift is operational right now.
 * Automatically re-checks every 10 seconds.
 */
export function useIsShiftActiveNow(): boolean {
  const [activeShift] = useActiveLabShift();
  const [isActive, setIsActive] = useState<boolean>(() => isShiftActiveNow(activeShift));

  useEffect(() => {
    const check = () => {
      setIsActive(isShiftActiveNow(activeShift));
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [activeShift]);

  return isActive;
}
