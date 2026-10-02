import { addNotification, calculateRemainingDays, isUnitOverdue } from '../services/unitStore';
import { Unit } from '../types';

export interface MobileToastNotification {
  id: string;
  title: string;
  body: string;
  type: 'alert' | 'success' | 'info';
  timestamp: number;
}

type ToastListener = (toast: MobileToastNotification) => void;
const toastListeners = new Set<ToastListener>();

export function subscribeMobileToasts(listener: ToastListener) {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

function triggerToastEvent(title: string, body: string, type: 'alert' | 'success' | 'info' = 'alert') {
  const toast: MobileToastNotification = {
    id: `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title,
    body,
    type,
    timestamp: Date.now()
  };
  toastListeners.forEach(fn => fn(toast));
}

// Play Web Audio beep tone for audible feedback on mobile/desktop
export function playMobileAlertSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    
    // First beep
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second beep
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.18); // D6
    gain2.gain.setValueAtTime(0.35, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.38);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.38);
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}

// Check browser notification support & permission state
export function getMobileNotificationPermissionState(): NotificationPermission | 'unsupported' {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

// Request Notification permission on device/browser
export async function requestMobileNotificationPermission(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  } catch (err) {
    console.warn('Notification permission request restricted by environment:', err);
  }

  return false;
}

// Track sent overdue notification keys in current session to prevent spamming duplicate popups
const sentOverdueNotifs = new Set<string>();

export function sendMobilePushNotification(title: string, body: string, notifTag?: string, type: 'alert' | 'success' | 'info' = 'alert') {
  // 1. Play alert sound tone (safely wrapped)
  try {
    playMobileAlertSound();
  } catch (e) {
    console.warn('Sound playback skipped:', e);
  }

  // 2. Trigger floating on-screen Toast
  try {
    triggerToastEvent(title, body, type);
  } catch (e) {
    console.warn('Toast trigger skipped:', e);
  }

  // 3. Trigger browser native mobile popup notification if granted
  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const notif = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: notifTag || `notif-${Date.now()}`,
        requireInteraction: true,
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    }
  } catch (e) {
    console.warn('Native mobile notification display not supported in current frame:', e);
  }
}

export function checkAndSendOverdueMobileNotifications(units: Unit[]) {
  try {
    const overdueUnits = units.filter(u => isUnitOverdue(u));

    if (overdueUnits.length === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];

    overdueUnits.forEach(u => {
      const notifKey = `${u.id || u.serialNumber}-${todayStr}`;
      if (!sentOverdueNotifs.has(notifKey)) {
        sentOverdueNotifs.add(notifKey);

        const days = Math.abs(calculateRemainingDays(u.requiredBy));
        const daysText = days === 0 ? 'Due Today' : `${days} Day(s) Overdue`;
        const title = `🚨 OVERDUE ALERT: ${u.modelName}`;
        const message = `Unit (${u.serialNumber}) testing is overdue! (${daysText}). Please take action.`;

        // Log in app lab notifications
        addNotification(title, message, 'alert', u.id);

        // Trigger Mobile / Desktop Push Notification, Sound, Vibration & Toast
        sendMobilePushNotification(title, message, `overdue-${u.serialNumber}`, 'alert');
      }
    });
  } catch (err) {
    console.warn('Overdue check notification error caught:', err);
  }
}

