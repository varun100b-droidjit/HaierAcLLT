import { Unit } from '../types';
import { isUnitOverdue } from '../services/unitStore';
import { playAlarmSound } from './audioAlarm';
import { getActiveLabShift, setActiveLabShift, LAB_SHIFTS, LabShift } from '../services/shiftStore';
import { getProtoUnits, updateProtoUnitStatus } from '../services/protoUnitStore';
import { getFieldUnits, updateFieldUnitStatus } from '../services/fieldUnitStore';
import { saveMeghaChatMessage, getMeghaChatHistory } from '../services/meghaChatStore';
import { matchVoiceCommand, executeWhitelistedAction } from '../services/voiceCommandManager';

/**
 * Megha - Female AI Voice Utility
 * Handles Text-To-Speech (SpeechSynthesis), Voice Command Navigation, and AI responses.
 */

// Global state to track spoken alerts to prevent spamming
const announcedOverdueUnits = new Set<string>();

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'executing' | 'speaking';
type StatusListener = (status: VoiceStatus, transcript?: string) => void;
const statusListeners = new Set<StatusListener>();

let currentVoiceStatus: VoiceStatus = 'idle';

export const subscribeVoiceStatus = (listener: StatusListener) => {
  statusListeners.add(listener);
  listener(currentVoiceStatus);
  return () => {
    statusListeners.delete(listener);
  };
};

export const setVoiceStatus = (status: VoiceStatus, transcript?: string) => {
  currentVoiceStatus = status;
  statusListeners.forEach(l => l(status, transcript));
};

export const getVoiceStatus = (): VoiceStatus => currentVoiceStatus;

let activeRecognition: any = null;

let isVoiceModeActive = false;
let storedUnitsForVoice: Unit[] = [];
let storedOnTranscriptForVoice: ((text: string) => void) | undefined = undefined;

type ActiveListener = (active: boolean) => void;
const activeListeners = new Set<ActiveListener>();

export const subscribeVoiceActiveState = (listener: ActiveListener) => {
  activeListeners.add(listener);
  listener(isVoiceModeActive);
  return () => {
    activeListeners.delete(listener);
  };
};

export const setVoiceModeActive = (active: boolean, units?: Unit[]) => {
  isVoiceModeActive = active;
  activeListeners.forEach(l => l(active));
  if (active) {
    if (units) storedUnitsForVoice = units;
    startListening(storedUnitsForVoice, storedOnTranscriptForVoice);
  } else {
    stopListening();
  }
};

export const getVoiceModeActive = (): boolean => isVoiceModeActive;

export const isStopCommand = (query: string): boolean => {
  const q = query.toLowerCase().trim();
  return (
    q === 'stop' ||
    q === 'megha stop' ||
    q === 'stop megha' ||
    q === 'mega stop' ||
    q === 'stop mega' ||
    q === 'pause' ||
    q === 'megha pause' ||
    q === 'pause megha' ||
    q === 'band karo' ||
    q === 'megha band karo' ||
    q === 'ruk jao' ||
    q === 'megha ruk jao' ||
    q === 'bas karo' ||
    q.includes('stop listening') ||
    q.includes('megha stop') ||
    q.includes('stop megha') ||
    q.includes('megha band') ||
    q.includes('stop kar do')
  );
};

export const isWakeCommand = (query: string): boolean => {
  const q = query.toLowerCase().trim();
  return (
    q === 'megha' ||
    q === 'hey megha' ||
    q === 'suno megha' ||
    q === 'megha suno' ||
    q === 'hi megha' ||
    q === 'hello megha' ||
    q === 'mega' ||
    q === 'hey mega' ||
    q === 'start megha' ||
    q === 'megha bolo'
  );
};

/**
 * Starts listening to the user's voice input via Web Speech Recognition.
 * When transcript is finalized, Megha generates an AI response and speaks it.
 */
export const startListening = (
  units: Unit[],
  onTranscript?: (text: string) => void,
  onError?: (err: string) => void
) => {
  if (typeof window === 'undefined') return;
  unlockAudio();
  isVoiceModeActive = true;
  if (units && units.length > 0) storedUnitsForVoice = units;
  storedOnTranscriptForVoice = onTranscript;
  setVoiceStatus('listening');

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setVoiceStatus('idle');
    if (onError) onError('Speech recognition is not supported in this browser.');
    return;
  }

  if (activeRecognition) {
    try { activeRecognition.stop(); } catch (e) {}
  }

  try {
    const recognition = new SpeechRecognition();
    activeRecognition = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'hi-IN'; // Default to Hindi / Hinglish

    recognition.onstart = () => {
      setVoiceStatus('listening');
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const displayTranscript = finalTranscript || interimTranscript;
      if (displayTranscript) {
        setVoiceStatus('listening', displayTranscript);
      }

      if (finalTranscript) {
        // Step 1: Processing
        setVoiceStatus('processing', finalTranscript);

        // Voice Stop Command Check
        if (isStopCommand(finalTranscript)) {
          const stopReply = "Ji Indrajit, Megha voice pause kar diya hai.";
          saveMeghaChatMessage('user', finalTranscript);
          saveMeghaChatMessage('megha', stopReply);
          stopListening();
          speakMegha(stopReply, () => {
            setVoiceStatus('idle');
          });
          return;
        }

        saveMeghaChatMessage('user', finalTranscript);
        if (onTranscript) onTranscript(finalTranscript);

        // Step 2: Whitelisted Command Matching
        const cmdMatch = matchVoiceCommand(finalTranscript);

        if (cmdMatch.matched) {
          setVoiceStatus('executing', finalTranscript);
          const reply = cmdMatch.isHindi ? cmdMatch.responseHi : cmdMatch.responseEn;
          saveMeghaChatMessage('megha', reply);

          // Safely execute whitelisted action
          executeWhitelistedAction(cmdMatch, registeredUIHandlers.navigateToTab);

          // Speak feedback & stop listening automatically
          speakMegha(reply, () => {
            stopListening();
            setVoiceStatus('idle');
          });
          return;
        }

        // Check if transcript looks like an invalid/unmatched voice command attempt
        const normLower = finalTranscript.toLowerCase();
        const isAttemptedCommand = normLower.includes('open') || normLower.includes('kholo') || normLower.includes('scroll') || normLower.includes('go to') || normLower.includes('back');

        if (isAttemptedCommand) {
          setVoiceStatus('executing', finalTranscript);
          const reply = cmdMatch.isHindi
            ? "Mujhe ye command samajh nahi aaya. Kripya dubara try karein."
            : "I didn't understand that command. Please try again.";

          saveMeghaChatMessage('megha', reply);
          speakMegha(reply, () => {
            stopListening();
            setVoiceStatus('idle');
          });
          return;
        }

        // Step 3: AI Assistant Question Fallback
        getMeghaAIResponseAsync(finalTranscript, storedUnitsForVoice).then((reply) => {
          saveMeghaChatMessage('megha', reply);
          speakMegha(reply, () => {
            stopListening();
            setVoiceStatus('idle');
          });
        }).catch(() => {
          const fallback = getMeghaAIResponse(finalTranscript, storedUnitsForVoice);
          saveMeghaChatMessage('megha', fallback);
          speakMegha(fallback, () => {
            stopListening();
            setVoiceStatus('idle');
          });
        });
      }
    };

    recognition.onerror = (event: any) => {
      const errType = event?.error || 'unknown';
      console.warn('Speech recognition error:', errType);
      
      // If mic permission blocked, disallowed, or unsupported, stop active listening cleanly
      if (errType === 'not-allowed' || errType === 'service-not-allowed' || errType === 'audio-capture') {
        isVoiceModeActive = false;
        activeRecognition = null;
        setVoiceStatus('idle');
        if (onError) onError(errType);
        return;
      }

      setVoiceStatus('idle');
      if (onError) onError(errType);
    };

    recognition.onend = () => {
      activeRecognition = null;
      if (currentVoiceStatus === 'listening') {
        setVoiceStatus('idle');
      }
    };

    try {
      recognition.start();
    } catch (startErr) {
      console.warn('Speech recognition start failed safely:', startErr);
      setVoiceStatus('idle');
    }
  } catch (err) {
    console.warn('Failed to initialize speech recognition:', err);
    setVoiceStatus('idle');
  }
};

export const stopListening = () => {
  isVoiceModeActive = false;
  if (activeRecognition) {
    try { activeRecognition.stop(); } catch (e) {}
    activeRecognition = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }
  setVoiceStatus('idle');
};

/**
  * Unlocks browser audio context and speech synthesis engine on user interaction
  */
export const unlockAudio = (): void => {
  if (typeof window === 'undefined') return;
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const dummyCtx = new AudioCtx();
      if (dummyCtx.state === 'suspended') {
        dummyCtx.resume();
      }
    }
  } catch (e) {
    console.warn('Audio unlock warning:', e);
  }
};

/**
  * Find best available Female Voice for Megha (Hindi/Indian English preferred, fallback to natural female voice)
  */
export const getMeghaVoice = (): SpeechSynthesisVoice | null => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  unlockAudio();
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Try Hindi female voices (e.g., Google Hi-IN, Swara, etc.)
  let voice = voices.find(v => 
    (v.lang.toLowerCase().includes('hi')) && 
    (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('swara') || v.name.includes('Google') || v.name.includes('Hindi'))
  );
  if (voice) return voice;

  // 2. Try Hindi voice (any)
  voice = voices.find(v => v.lang.toLowerCase().includes('hi'));
  if (voice) return voice;

  // 3. Try Indian English female voices
  voice = voices.find(v => 
    (v.lang.toLowerCase().includes('en-in') || v.lang.toLowerCase().includes('en_in')) && 
    (v.name.toLowerCase().includes('female') || v.name.includes('Google') || v.name.includes('Neerja') || v.name.includes('Heera'))
  );
  if (voice) return voice;

  // 4. Try any female voice in English (Google, Zira, Samantha, Victoria, etc.)
  voice = voices.find(v => 
    v.name.toLowerCase().includes('female') || 
    v.name.toLowerCase().includes('zira') || 
    v.name.toLowerCase().includes('samantha') || 
    v.name.toLowerCase().includes('victoria') ||
    v.name.toLowerCase().includes('google uk english female') ||
    v.name.toLowerCase().includes('google us english')
  );
  if (voice) return voice;

  // 5. Default to first voice available
  return voices[0] || null;
};

/**
 * Decodes and plays base64 audio returned by Gemini TTS API or Audio element.
 * Returns true if audio played successfully, false if playback failed.
 */
export const playRealGirlAudio = async (base64Audio: string, mimeType: string = 'audio/wav'): Promise<boolean> => {
  setVoiceStatus('speaking');
  return new Promise((resolve) => {
    let completed = false;
    const finish = (success: boolean) => {
      if (!completed) {
        completed = true;
        if (!success) setVoiceStatus('idle');
        resolve(success);
      }
    };

    try {
      const audioUrl = `data:${mimeType.split(';')[0]};base64,${base64Audio}`;
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setVoiceStatus('idle');
        finish(true);
      };

      audio.onerror = () => {
        playPcmWebAudio(base64Audio)
          .then(() => {
            setVoiceStatus('idle');
            finish(true);
          })
          .catch(() => finish(false));
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.warn('HTML5 Audio play failed, attempting Web Audio API decoding:', e);
          playPcmWebAudio(base64Audio)
            .then(() => {
              setVoiceStatus('idle');
              finish(true);
            })
            .catch(() => finish(false));
        });
      }
    } catch (err) {
      console.error('Error playing real girl audio:', err);
      finish(false);
    }
  });
};

/**
 * Web Audio API decoder for raw PCM audio (Int16 to Float32 conversion)
 */
const playPcmWebAudio = async (base64Audio: string, sampleRate: number = 24000): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return reject(new Error('No AudioContext'));

      const audioCtx = new AudioCtx({ sampleRate });
      if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch (e) {}
      }

      // Convert Int16 PCM samples to Float32 Array
      const numSamples = Math.floor(bytes.byteLength / 2);
      const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, numSamples);
      const audioBuffer = audioCtx.createBuffer(1, numSamples, sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      for (let i = 0; i < numSamples; i++) {
        channelData[i] = int16Array[i] / 32768.0;
      }

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => {
        audioCtx.close().catch(() => {});
        resolve();
      };
      source.start(0);
    } catch (e) {
      console.warn('PCM Web Audio playback failed:', e);
      reject(e);
    }
  });
};

/**
 * Fallback to Browser SpeechSynthesis with Chrome unfreeze fixes and female pitch tuning
 */
const speakBrowserSpeechSynthesis = (text: string, onEnd?: () => void): void => {
  setVoiceStatus('speaking');

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis is not supported in this browser.');
    setVoiceStatus('idle');
    if (onEnd) onEnd();
    return;
  }

  try {
    // Unfreeze Chrome SpeechSynthesis queue
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    const cleanText = text.replace(/[*_~#`]/g, '').trim();
    if (!cleanText) {
      setVoiceStatus('idle');
      if (onEnd) onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voice = getMeghaVoice();

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'hi-IN';
    }

    utterance.pitch = 1.1; // Natural female tone
    utterance.rate = 1.0;
    utterance.volume = 1.0;

    let hasFinished = false;
    const handleFinish = () => {
      if (!hasFinished) {
        hasFinished = true;
        setVoiceStatus('idle');
        if (onEnd) onEnd();
      }
    };

    utterance.onend = () => handleFinish();
    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis utterance error:', e);
      handleFinish();
    };

    // Chrome workaround: keep resuming speech if paused during playback
    const resumeInterval = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.resume();
        } else {
          clearInterval(resumeInterval);
        }
      } else {
        clearInterval(resumeInterval);
      }
    }, 1500);

    const safetyTimeout = setTimeout(() => {
      clearInterval(resumeInterval);
      handleFinish();
    }, Math.max(3500, cleanText.length * 140));

    // Small timeout ensures speechSynthesis.cancel() completes before new utterance starts
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
      window.speechSynthesis.resume();
    }, 50);

  } catch (err) {
    console.error('Error in speakBrowserSpeechSynthesis:', err);
    setVoiceStatus('idle');
    if (onEnd) onEnd();
  }
};

/**
 * Speaks text using Megha's Real Female AI Voice (Gemini 3.1 Flash TTS 'Kore' with Web Speech fallback)
 */
export const speakMegha = async (text: string, onEnd?: () => void): Promise<void> => {
  unlockAudio();

  // 1. Try Gemini Real Girl AI Voice API Endpoint (/api/tts)
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: 'Kore' }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.audio) {
        const success = await playRealGirlAudio(data.audio, data.mimeType || 'audio/wav');
        if (success) {
          if (onEnd) onEnd();
          return;
        }
      }
    }
  } catch (err) {
    console.warn('Server TTS API call failed, using browser speech fallback:', err);
  }

  // 2. Guaranteed Fallback to Browser SpeechSynthesis Engine
  speakBrowserSpeechSynthesis(text, onEnd);
};

/**
 * Triggers the automatic overdue voice alarm (Disabled per user request)
 */
export const playMeghaOverdueAlarm = (overdueUnits: Unit[], force: boolean = false): void => {
  // Voice notification for overdue units removed per request
  return;
};

/**
 * Stops any active Megha voice speech
 */
export const stopMeghaVoice = (): void => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

let lastMentionedUnit: Unit | null = null;

export interface MeghaUIHandlers {
  navigateToTab?: (tab: string) => void;
  scroll?: (direction: 'down' | 'up' | 'top' | 'bottom') => void;
  openAddUnitModal?: () => void;
  openAddProtoModal?: () => void;
  closeModals?: () => void;
  toggleTheme?: () => void;
  trackUnitBySerial?: (serialNumber: string) => void;
  clickPrimaryViewBtn?: () => void;
}

let registeredUIHandlers: MeghaUIHandlers = {};

export const registerMeghaUIHandlers = (handlers: MeghaUIHandlers) => {
  registeredUIHandlers = { ...registeredUIHandlers, ...handlers };
};

export const executeMeghaUIAction = (actionType: string, param?: string) => {
  if (typeof window === 'undefined') return;

  if (actionType === 'navigate' && param) {
    registeredUIHandlers.navigateToTab?.(param);
  } else if (actionType === 'scroll' && param) {
    if (param === 'down') {
      window.scrollBy({ top: 500, behavior: 'smooth' });
    } else if (param === 'up') {
      window.scrollBy({ top: -500, behavior: 'smooth' });
    } else if (param === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (param === 'bottom') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  } else if (actionType === 'open_add_unit') {
    registeredUIHandlers.openAddUnitModal?.();
  } else if (actionType === 'open_add_proto') {
    registeredUIHandlers.openAddProtoModal?.();
  } else if (actionType === 'close_modal') {
    registeredUIHandlers.closeModals?.();
  } else if (actionType === 'toggle_theme') {
    registeredUIHandlers.toggleTheme?.();
  } else if (actionType === 'click_view') {
    if (param) {
      registeredUIHandlers.trackUnitBySerial?.(param);
    } else {
      registeredUIHandlers.clickPrimaryViewBtn?.();
    }
  }
};

/**
 * Generates smart Hinglish response for interactive voice conversations with Megha
 */
export const getMeghaAIResponse = (userQuery: string, units: Unit[]): string => {
  const rawQ = userQuery.toLowerCase().trim();
  let cleanStr = rawQ.replace(/^(hey|hi|hello|ok|suno|bolo)?\s*(megha|mega|miga|meghna|मेघा|मेगा|मेध|मेघ)\b,?\s*/i, '').trim();
  const q = cleanStr || rawQ;

  // Wake Words & Greetings Check - ONLY if query is literally just "hi", "hello", "megha", "namaste", "suno"
  const pureWakeWords = [
    'megha', 'mega', 'miga', 'meghna', 'मेघा', 'मेगा',
    'suno', 'bolo', 'hi', 'hello', 'namaste', 'kaise ho', 'who are you',
    'kon ho', 'megha suno', 'suno megha', 'megha bolo', 'hey megha',
    'hi megha', 'hello megha', 'ok megha', 'megha ji', 'mega suno',
    'suno mega', 'mega bolo', 'hey mega', 'hi mega', 'suno na'
  ];

  const hasContentWord = q.includes('proto') || q.includes('field') || q.includes('rd') || q.includes('r&d') ||
    q.includes('unit') || q.includes('screen') || q.includes('open') || q.includes('scroll') ||
    q.includes('view') || q.includes('shift') || q.includes('status') || q.includes('detail') ||
    q.includes('list') || q.includes('report') || q.includes('kaam') || q.includes('batao') ||
    q.includes('kya') || q.includes('kitne') || q.includes('kaun') || q.includes('live') ||
    q.includes('machine') || q.includes('serial') || q.includes('holder') || q.includes('overdue');

  const isJustWakeWord = !hasContentWord && (
    pureWakeWords.includes(rawQ) || pureWakeWords.includes(q) || q === '' ||
    /^(hey|hi|hello|ok|suno)?\s*(megha|mega|miga|meghna|मेघा|मेगा)\s*(suno|bolo|ji|hai)?$/i.test(rawQ)
  );

  if (isJustWakeWord) {
    return `Ji Indrajit, boliye! Main Megha hu. Aap R&D, Proto, ya Field testing ka status puch sakte hain, ya koi screen kholne ko bol sakte hain.`;
  }

  // Helper for overdue calculation
  const calculateDaysRemaining = (reqDateStr: string): number => {
    if (!reqDateStr) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(reqDateStr);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const liveUnits = units.filter(u => u.status !== 'received' && u.status !== 'completed' && (u.currentStageIndex ?? 0) < 10);
  const overdueUnits = liveUnits.filter(u => isUnitOverdue(u));
  const reworkUnits = liveUnits.filter(u => u.status === 'rework');

  // 1. Navigation & Screen Switching Voice Triggers
  if (q.includes('proto') && (q.includes('open') || q.includes('kholo') || q.includes('screen') || q.includes('dekho') || q.includes('page') || q.includes('show'))) {
    executeMeghaUIAction('navigate', 'proto-units');
    return `Ji Indrajit, Proto Units Screen open kar diya hai.`;
  }
  if (q.includes('dashboard') || q.includes('main screen') || q.includes('home screen') || q.includes('first screen')) {
    executeMeghaUIAction('navigate', 'dashboard');
    return `Ji Indrajit, Dashboard open kar diya hai.`;
  }
  if ((q.includes('r&d') || q.includes('rd') || q.includes('r and d')) && (q.includes('open') || q.includes('kholo') || q.includes('screen') || q.includes('page'))) {
    executeMeghaUIAction('navigate', 'rd-units');
    return `Ji Indrajit, R&D Units Screen open kar diya hai.`;
  }
  if (q.includes('field') && (q.includes('open') || q.includes('kholo') || q.includes('screen') || q.includes('page'))) {
    executeMeghaUIAction('navigate', 'field-units');
    return `Ji Indrajit, Field Units Screen open kar diya hai.`;
  }
  if (q.includes('smog') && (q.includes('open') || q.includes('kholo') || q.includes('screen') || q.includes('section'))) {
    executeMeghaUIAction('navigate', 'smog');
    return `Ji Indrajit, Smog Section open kar diya hai.`;
  }
  if ((q.includes('report room') || q.includes('report archive') || q.includes('saved report')) && (q.includes('open') || q.includes('kholo') || q.includes('screen') || q.includes('room'))) {
    executeMeghaUIAction('navigate', 'report-room');
    return `Ji Indrajit, Report Room open kar diya hai jahan aapke saved C Simulation aur C Experience reports hain.`;
  }
  if ((q.includes('report') || q.includes('generate report') || q.includes('cs report') || q.includes('ce report')) && (q.includes('open') || q.includes('kholo') || q.includes('screen'))) {
    executeMeghaUIAction('navigate', 'reports');
    return `Ji Indrajit, Generate Report Screen open kar diya hai.`;
  }
  if ((q.includes('export') || q.includes('excel') || q.includes('download')) && (q.includes('open') || q.includes('kholo') || q.includes('screen'))) {
    executeMeghaUIAction('navigate', 'export-data');
    return `Ji Indrajit, Export Data Screen open kar diya hai.`;
  }
  if (q.includes('setting') && (q.includes('open') || q.includes('kholo') || q.includes('screen'))) {
    executeMeghaUIAction('navigate', 'settings');
    return `Ji Indrajit, Settings Screen open kar diya hai.`;
  }
  if ((q.includes('chat') || q.includes('ai support') || q.includes('support')) && (q.includes('open') || q.includes('kholo') || q.includes('screen'))) {
    executeMeghaUIAction('navigate', 'ai-support');
    return `Ji Indrajit, AI Support Screen open kar diya hai.`;
  }

  // 2. Page Scrolling Commands
  if (q.includes('scroll down') || q.includes('niche scroll') || q.includes('niche jao') || q.includes('down scroll')) {
    executeMeghaUIAction('scroll', 'down');
    return `Ji Indrajit, page niche scroll kar diya hai.`;
  }
  if (q.includes('scroll up') || q.includes('upar scroll') || q.includes('upar jao') || q.includes('up scroll')) {
    executeMeghaUIAction('scroll', 'up');
    return `Ji Indrajit, page upar scroll kar diya hai.`;
  }
  if (q.includes('top par') || q.includes('top scroll') || q.includes('sabse upar')) {
    executeMeghaUIAction('scroll', 'top');
    return `Ji Indrajit, page ke top par scroll kar diya hai.`;
  }
  if (q.includes('bottom par') || q.includes('sabse niche')) {
    executeMeghaUIAction('scroll', 'bottom');
    return `Ji Indrajit, page ke bottom par scroll kar diya hai.`;
  }

  // 3. UI Buttons, Modals & Theme Commands
  if (q.includes('view button') || q.includes('click view') || q.includes('track button') || q.includes('details dekho') || q.includes('timeline view') || q.includes('view kro') || q.includes('view karo')) {
    if (lastMentionedUnit) {
      executeMeghaUIAction('click_view', lastMentionedUnit.serialNumber || lastMentionedUnit.id);
      return `Ji Indrajit, Machine Serial ${lastMentionedUnit.serialNumber} ka View Track Timeline open kar diya hai.`;
    }
    executeMeghaUIAction('click_view');
    return `Ji Indrajit, View details button click karke open kar diya hai.`;
  }
  if ((q.includes('add unit') || q.includes('naya unit') || q.includes('new unit')) && !q.includes('proto')) {
    executeMeghaUIAction('open_add_unit');
    return `Ji Indrajit, Add Unit Modal open kar diya hai.`;
  }
  if ((q.includes('add unit') || q.includes('naya unit') || q.includes('new unit')) && q.includes('proto')) {
    executeMeghaUIAction('open_add_proto');
    return `Ji Indrajit, Add Proto Unit Modal open kar diya hai.`;
  }
  if (q.includes('close modal') || q.includes('dialog band') || q.includes('modal close') || q.includes('dialog close') || q.includes('band karo')) {
    executeMeghaUIAction('close_modal');
    return `Ji Indrajit, modal dialog band kar diya hai.`;
  }
  if (q.includes('theme change') || q.includes('dark mode') || q.includes('light mode') || q.includes('theme badlo')) {
    executeMeghaUIAction('toggle_theme');
    return `Ji Indrajit, Theme change kar diya hai.`;
  }

  // 4. Search Query: Machine Serial Number or Last Digits (e.g., 86566, 12345, serial no)
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 3) {
    const foundBySerial = units.find(u => u.serialNumber && u.serialNumber.replace(/\D/g, '').includes(digits));
    if (foundBySerial) {
      lastMentionedUnit = foundBySerial;
      return `Indrajit, Machine Serial Number ${foundBySerial.serialNumber} (Model ${foundBySerial.modelName}) Stage ${foundBySerial.currentStageIndex + 1} par hai. Current Holder: ${foundBySerial.currentHolder || foundBySerial.bsrPerson || 'Lab'}. Status: ${foundBySerial.status}.`;
    }
  }

  // Follow-up query checking for date or holder if a unit was recently discussed
  if (q.includes('date') || q.includes('tarikh') || q.includes('diya gya') || q.includes('diya gaya') || q.includes('kab') || q.includes('transfer')) {
    if (lastMentionedUnit) {
      const u = lastMentionedUnit;
      const dateInfo = u.transferDate || u.createdAt || u.requiredBy || 'record me date available nahi hai';
      return `Indrajit, Machine Serial Number ${u.serialNumber} (${u.modelName}) ki Date: ${dateInfo} hai. Current Holder: ${u.currentHolder || u.bsrPerson || 'Lab'}.`;
    }
  }

  // Search Query: Person Name or Requester Name (e.g. Indrajit, Ramesh, BSR/ELT person)
  const matchingPersonUnits = units.filter(u => {
    const p = q.toLowerCase();
    return (
      (u.bsrPerson && u.bsrPerson.toLowerCase().includes(p)) ||
      (u.eltPerson && u.eltPerson.toLowerCase().includes(p)) ||
      (u.rdPerson && u.rdPerson.toLowerCase().includes(p)) ||
      (u.currentHolder && u.currentHolder.toLowerCase().includes(p))
    );
  });
  if (matchingPersonUnits.length > 0 && !q.includes('proto') && !q.includes('field')) {
    lastMentionedUnit = matchingPersonUnits[0];
    const unitList = matchingPersonUnits.map(u => `${u.modelName} (Serial ${u.serialNumber})`).slice(0, 3).join(', ');
    return `Indrajit, is person ke total ${matchingPersonUnits.length} R&D units hain: ${unitList}.`;
  }

  // Query: Proto Units
  if (q.includes('proto')) {
    const protoUnits = getProtoUnits();
    if (protoUnits.length === 0) {
      return `Indrajit, filhal lab me koi Proto unit added nahi hai.`;
    }
    const liveProto = protoUnits.filter(p => p.status === 'live');
    const stoppedProto = protoUnits.filter(p => p.status === 'stopped');
    const finishedProto = protoUnits.filter(p => p.status === 'finished');

    let summary = `Indrajit, total ${protoUnits.length} Proto units hain: ${liveProto.length} Live testing me, ${stoppedProto.length} Stopped, ${finishedProto.length} Finished.`;
    if (liveProto.length > 0) {
      summary += ` Live models: ${liveProto.map(p => `${p.modelName} (Station ${p.station})`).join(', ')}.`;
    }
    return summary;
  }

  // Query: Field Units
  if (q.includes('field')) {
    const fieldUnits = getFieldUnits();
    if (fieldUnits.length === 0) {
      return `Indrajit, filhal lab me koi Field unit added nahi hai.`;
    }
    const liveField = fieldUnits.filter(f => f.status === 'live');
    const stoppedField = fieldUnits.filter(f => f.status === 'stopped');
    const finishedField = fieldUnits.filter(f => f.status === 'finished');

    let summary = `Indrajit, total ${fieldUnits.length} Field units hain: ${liveField.length} Live testing me, ${stoppedField.length} Stopped, ${finishedField.length} Finished.`;
    if (liveField.length > 0) {
      summary += ` Live models: ${liveField.map(f => `${f.modelName} (Station ${f.station})`).join(', ')}.`;
    }
    return summary;
  }

  // Query: Shift Change Command
  if (q.includes('shift')) {
    if (q.includes('general')) {
      setActiveLabShift('GENERAL');
      return `Ji Indrajit, Lab Shift ko General Shift me set kar diya hai (09:00 AM se 05:30 PM).`;
    }
    if (q.includes('a+b+c') || q.includes('abc') || q.includes('24') || q.includes('agledin')) {
      setActiveLabShift('SHIFT_ABC');
      return `Ji Indrajit, Lab Shift ko A+B+C 24 hour continuous operation shift me set kar diya hai.`;
    }
    if (q.includes('a+b') || q.includes('ab') || q.includes('a and b')) {
      setActiveLabShift('SHIFT_AB');
      return `Ji Indrajit, Lab Shift ko A+B Shift me set kar diya hai (07:00 AM se 12:00 AM Midnight).`;
    }
    if (q.includes('shift a') || q.includes('a shift') || q.includes('shift 07')) {
      setActiveLabShift('SHIFT_A');
      return `Ji Indrajit, Lab Shift ko Shift A me set kar diya hai (07:00 AM se 03:30 PM).`;
    }
    return `Indrajit, filhal active Lab Shift hai: ${getActiveLabShift()}. Aap Shift A, Shift A+B, Shift A+B+C ya General Shift set karne ko bol sakte hain.`;
  }

  // Query: Overdue Units
  if (q.includes('overdue') || q.includes('delay') || q.includes('late') || q.includes('time out')) {
    if (overdueUnits.length === 0) {
      return `Indrajit, koi R&D unit overdue nahi hai. Sabhi on time hain.`;
    }
    const names = overdueUnits.map(u => u.modelName).join(', ');
    return `Hi Indrajit, R&D Unit ${names} overdue hain. Please Take Action.`;
  }

  // Query: Rework / Observation Units
  if (q.includes('rework') || q.includes('observation') || q.includes('ng') || q.includes('defect') || q.includes('fault')) {
    if (reworkUnits.length === 0) {
      return `Indrajit, koi bhi unit rework me nahi hai. Quality clear hai.`;
    }
    const names = reworkUnits.map(u => u.modelName).join(', ');
    return `Indrajit, ${reworkUnits.length} unit rework me hain: ${names}.`;
  }

  // Query: R&D Units or General Unit Status / Count / List
  if (q.includes('r&d') || q.includes('rd') || q.includes('unit') || q.includes('count') || q.includes('total') || q.includes('status') || q.includes('testing') || q.includes('kaam') || q.includes('live')) {
    if (liveUnits.length === 0) {
      return `Indrajit, total ${units.length} R&D units me se koi live unit abhi active nahi hai.`;
    }
    const modelNames = liveUnits.map(u => u.modelName).slice(0, 4).join(', ');
    return `Indrajit, total ${units.length} R&D units hain: ${liveUnits.length} Live testing me, ${overdueUnits.length} Overdue, aur ${reworkUnits.length} Rework me. Active models: ${modelNames}.`;
  }

  // Query: Holder info
  if (q.includes('holder') || q.includes('kiske paas') || q.includes('where is') || q.includes('location')) {
    const activeHolders = Array.from(new Set(liveUnits.map(u => u.currentHolder).filter(Boolean)));
    return `R&D Units filhal in holders ke paas hain: ${activeHolders.join(', ')}.`;
  }

  // Common General Knowledge & Conversational Fallbacks
  if (q.includes('kya kar rahi ho') || q.includes('kya kar rahe ho') || q.includes('kya kar rahi h')) {
    return `Main aapki baatein sun rahi hu aur aapki madad karne ke liye bilkul taiyaar hu, Indrajit!`;
  }
  if (q.includes('kya haal hai') || q.includes('kaise ho') || q.includes('kasi ho') || q.includes('kaisa hai')) {
    return `Main bilkul badhiya hu, Indrajit! Aap kaise hain? Aaj main aapki kya madad kar sakti hu?`;
  }
  if (q.includes('kya chal raha hai') || q.includes('kya naya hai') || q.includes('kya ho raha hai')) {
    return `Sab kuch badhiya chal raha hai! Aap bataiye, aaj kya kaam karna hai?`;
  }
  if (q.includes('who are you') || q.includes('kaun ho') || q.includes('kon ho') || q.includes('tumhara naam') || q.includes('tera naam')) {
    return `Main Megha hu, aapki AI Voice Assistant! Main general questions ke jawab dene ke sath-sath lab units tracking aur screen control bhi kar sakti hu.`;
  }
  if (q.includes('kya kar sakti ho') || q.includes('kya kaam karti ho') || q.includes('tumhari capabilities')) {
    return `Main general questions, science, history, jokes ke jawab de sakti hu, machine serial numbers search kar sakti hu, shift change kar sakti hu, aur website ki screens open kar sakti hu!`;
  }
  if (q.includes('joke') || q.includes('chutkula') || q.includes('kuch mazedaar')) {
    return `Ek mazedaar baat: Jab kisi programmer ko nind nahi aati, toh woh bugs count karte hain, sheep nahi!`;
  }
  if (q.includes('mausam') || q.includes('weather')) {
    return `Mausam to hamesha badalta rehta hai, par main hamesha aapke sawaalon ka jawab dene ke liye taiyaar hu!`;
  }
  if (q.includes('time') || q.includes('samay') || q.includes('kitne baje')) {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `Indrajit, abhi time hua hai ${timeStr}.`;
  }
  if (q.includes('date') || q.includes('aaj konsi tarikh') || q.includes('aaj ka din')) {
    const dateStr = new Date().toLocaleDateString('hi-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    return `Indrajit, aaj ki date hai ${dateStr}.`;
  }
  if (q.includes('thank') || q.includes('dhanyawad') || q.includes('shukriya')) {
    return `Aapka bahut bahut dhanyawad, Indrajit! Mujhe aapki madad karke hamesha khushi hoti hai.`;
  }
  if (q.includes('pradhan mantri') || q.includes('prime minister')) {
    return `Bharat ke Pradhan Mantri Shri Narendra Modi hain.`;
  }
  if (q.includes('rashtrapati') || q.includes('president of india')) {
    return `Bharat ki Rashtrapati Smt. Droupadi Murmu hain.`;
  }
  if (q.includes('rajdhani') || q.includes('capital of india')) {
    return `Bharat ki rajdhani New Delhi hai.`;
  }

  // Smart General Question Fallback (Does not spam lab count unless explicitly asked)
  if (q.includes('kya') || q.includes('kaise') || q.includes('kyun') || q.includes('kab') || q.includes('kahan') || q.includes('kaun') || q.includes('why') || q.includes('what') || q.includes('how') || q.includes('tell me')) {
    return `Aapne achha sawaal poocha hai, Indrajit. Main aapke is general question ko samajh rahi hu! Aap lab units, machine tracking, ya kisi bhi general topic ke baare me mujhse pooch sakte hain.`;
  }

  // Default Unit Summary Response (Only when user asks generally about lab status or overall summary)
  const protoCount = getProtoUnits().length;
  const fieldCount = getFieldUnits().length;
  const activeModels = liveUnits.map(u => u.modelName).slice(0, 3).join(', ');
  
  return `Indrajit, Lab me total ${units.length} R&D units (${liveUnits.length} Live, ${overdueUnits.length} Overdue), ${protoCount} Proto units, aur ${fieldCount} Field units hain. Active R&D models: ${activeModels || 'N/A'}. Aap kisi specific machine serial number, shift change, ya screen open karne ke baare me bata sakte hain.`;
};

/**
 * Asynchronous AI response builder that queries server-side Gemini AI
 * to answer both Lab queries and General Knowledge / AI questions in Hindi/Hinglish.
 */
export const getMeghaAIResponseAsync = async (userQuery: string, units: Unit[]): Promise<string> => {
  try {
    const liveUnits = units.filter(u => u.status !== 'received' && u.status !== 'completed' && (u.currentStageIndex ?? 0) < 10);
    const overdueUnits = units.filter(u => isUnitOverdue(u));
    const protoUnits = getProtoUnits();
    const fieldUnits = getFieldUnits();

    const labContext = {
      activeShift: getActiveLabShift(),
      rdUnitsSummary: {
        total: units.length,
        liveCount: liveUnits.length,
        overdueCount: overdueUnits.length,
        allUnits: units.map(u => ({
          id: u.id,
          modelName: u.modelName,
          serialNumber: u.serialNumber,
          transferDate: u.transferDate,
          createdAt: u.createdAt,
          requiredBy: u.requiredBy,
          bsrPerson: u.bsrPerson,
          eltPerson: u.eltPerson,
          rdPerson: u.rdPerson,
          oqcPerson: u.oqcPerson,
          currentHolder: u.currentHolder,
          currentStageIndex: u.currentStageIndex,
          status: u.status,
          timeline: u.timeline?.map(t => `${t.stageName} (${t.personName}, ${t.date} ${t.time})`)
        })),
      },
      protoUnitsSummary: {
        total: protoUnits.length,
        liveCount: protoUnits.filter(p => p.status === 'live').length,
        units: protoUnits.map(p => ({ id: p.id, modelName: p.modelName, serialNumber: (p as any).serialNumber || p.id, station: p.station, status: p.status, requiredHour: p.requiredHour })),
      },
      fieldUnitsSummary: {
        total: fieldUnits.length,
        liveCount: fieldUnits.filter(f => f.status === 'live').length,
        units: fieldUnits.map(f => ({ id: f.id, modelName: f.modelName, serialNumber: (f as any).serialNumber || f.id, station: f.station, status: f.status, requiredHour: f.requiredHour })),
      }
    };

    // Get recent chat history to provide full conversational memory
    const historyMsgs = getMeghaChatHistory();
    const chatHistory = historyMsgs.slice(-8).map(m => ({
      sender: m.sender === 'user' ? 'User (Indrajit)' : 'Megha AI',
      text: m.text
    }));

    const res = await fetch('/api/megha-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: userQuery,
        labContext,
        chatHistory,
      }),
    });

    if (res.ok) {
      const data = await res.json();

      // Execute shift change if requested
      if (data && data.changeShift) {
        if (['GENERAL', 'SHIFT_A', 'SHIFT_AB', 'SHIFT_ABC'].includes(data.changeShift)) {
          setActiveLabShift(data.changeShift as LabShift);
        }
      }

      // Execute Proto unit action if requested
      if (data && data.protoAction && data.protoAction.id && data.protoAction.status) {
        updateProtoUnitStatus(data.protoAction.id, data.protoAction.status);
      }

      // Execute Field unit action if requested
      if (data && data.fieldAction && data.fieldAction.id && data.fieldAction.status) {
        updateFieldUnitStatus(data.fieldAction.id, data.fieldAction.status);
      }

      // Execute navigation tab change if requested
      if (data && data.navigateTab) {
        executeMeghaUIAction('navigate', data.navigateTab);
      }

      // Execute UI action if requested
      if (data && data.uiAction) {
        if (data.uiAction.startsWith('scroll_')) {
          const dir = data.uiAction.replace('scroll_', '');
          executeMeghaUIAction('scroll', dir);
        } else if (data.uiAction === 'open_add_unit') {
          executeMeghaUIAction('open_add_unit');
        } else if (data.uiAction === 'open_add_proto') {
          executeMeghaUIAction('open_add_proto');
        } else if (data.uiAction === 'close_modal') {
          executeMeghaUIAction('close_modal');
        } else if (data.uiAction === 'toggle_theme') {
          executeMeghaUIAction('toggle_theme');
        } else if (data.uiAction === 'click_view') {
          executeMeghaUIAction('click_view');
        }
      }

      if (data && data.stopListening) {
        setVoiceModeActive(false);
      }

      if (data && data.reply) {
        return data.reply;
      }
    }
  } catch (err) {
    console.warn('Server Megha AI fetch failed, using local rule fallback:', err);
  }

  return getMeghaAIResponse(userQuery, units);
};
