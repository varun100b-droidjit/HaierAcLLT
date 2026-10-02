/**
 * Audio Alarm Utility for Lab Testing Duration Completion
 * Uses standard Web Audio API for browser-compatible siren/alarm audio synthesis.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (e) {
    console.warn('Web Audio API unavailable:', e);
    return null;
  }
}

/**
 * Plays a loud, distinct lab warning alarm (double beep siren)
 */
export const playAlarmSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Beep 1 (High Pitch Siren)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.2); // E6

    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Beep 2 (Second Pulse)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(1046.5, now + 0.4); // C6
    osc2.frequency.exponentialRampToValueAtTime(1567.98, now + 0.6); // G6

    gain2.gain.setValueAtTime(0.4, now + 0.4);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.75);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.4);
    osc2.stop(now + 0.75);

    // Beep 3 (Third Pulse Alarm)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'square';
    osc3.frequency.setValueAtTime(1760, now + 0.8); // A6

    gain3.gain.setValueAtTime(0.45, now + 0.8);
    gain3.gain.exponentialRampToValueAtTime(0.01, now + 1.25);

    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.8);
    osc3.stop(now + 1.25);
  } catch (err) {
    console.error('Error playing alarm audio sound:', err);
  }
};

/**
 * Plays a pleasant positive chime for successful verification/pass actions
 */
export const playPassChime = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2); // G5
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {
    console.warn('Pass chime error:', e);
  }
};

export const audioAlarm = {
  playAlarmSound,
  playPassChime
};

