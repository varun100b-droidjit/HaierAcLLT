import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  getDocs, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'megha';
  text: string;
  timestamp: string;
  dateTimeIso?: string;
  isAudioPlaying?: boolean;
}

const STORAGE_KEY_MEGHA_CHAT = 'llt_megha_ai_chat_records_v1';
const COLLECTION_NAME = 'megha_chat_records';

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-1',
  sender: 'megha',
  text: 'Namaste Indrajit! Main Megha hu, aapki R&D Female AI Assistant. Aap mujhse units ka status, overdue warning, ya unit holders ke baare me kuch bhi puch sakte hain. Humari sabhi voice aur chat conversation Firebase cloud store me surakshit save ho rahi hain.',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  dateTimeIso: new Date().toISOString()
};

type ChatChangeListener = (messages: ChatMessage[]) => void;
const listeners = new Set<ChatChangeListener>();

let cachedMessages: ChatMessage[] = loadLocalCache();
let isFirestoreInitialized = false;

function loadLocalCache(): ChatMessage[] {
  if (typeof window === 'undefined') return [DEFAULT_WELCOME_MESSAGE];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEGHA_CHAT);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('LocalStorage cache read error:', err);
  }
  return [DEFAULT_WELCOME_MESSAGE];
}

function updateLocalCache(messages: ChatMessage[]) {
  cachedMessages = messages;
  try {
    localStorage.setItem(STORAGE_KEY_MEGHA_CHAT, JSON.stringify(messages));
  } catch (err) {
    console.warn('LocalStorage cache write error:', err);
  }
  listeners.forEach(fn => fn(messages));
}

// Subscribe to real-time Firebase Firestore updates
function initFirestoreSync() {
  if (isFirestoreInitialized || typeof window === 'undefined') return;
  isFirestoreInitialized = true;

  try {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, orderBy('dateTimeIso', 'asc'));

    onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // If Firestore collection is empty, seed default welcome message
        saveMeghaChatMessageToFirestore(DEFAULT_WELCOME_MESSAGE);
        updateLocalCache([DEFAULT_WELCOME_MESSAGE]);
        return;
      }

      const remoteMsgs: ChatMessage[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        remoteMsgs.push({
          id: docSnap.id,
          sender: data.sender || 'megha',
          text: data.text || '',
          timestamp: data.timestamp || '',
          dateTimeIso: data.dateTimeIso || new Date().toISOString()
        });
      });

      updateLocalCache(remoteMsgs);
    }, (error) => {
      console.warn('Firestore subscription warning, using local cache:', error);
    });
  } catch (err) {
    console.error('Failed to init Firestore sync:', err);
  }
}

async function saveMeghaChatMessageToFirestore(msg: ChatMessage) {
  try {
    const docRef = doc(db, COLLECTION_NAME, msg.id);
    await setDoc(docRef, {
      id: msg.id,
      sender: msg.sender,
      text: msg.text,
      timestamp: msg.timestamp,
      dateTimeIso: msg.dateTimeIso || new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error saving message to Firebase Firestore:', err);
  }
}

export function getMeghaChatHistory(): ChatMessage[] {
  initFirestoreSync();
  return cachedMessages;
}

export function saveMeghaChatMessage(sender: 'user' | 'megha', text: string): ChatMessage {
  const now = new Date();
  const newMsg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    sender,
    text,
    timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    dateTimeIso: now.toISOString()
  };

  const updatedHistory = [...cachedMessages, newMsg];
  updateLocalCache(updatedHistory);

  // Async save to Firebase Firestore
  saveMeghaChatMessageToFirestore(newMsg);

  return newMsg;
}

export async function clearMeghaChatHistory(): Promise<ChatMessage[]> {
  const resetMsg: ChatMessage = {
    id: `welcome-${Date.now()}`,
    sender: 'megha',
    text: 'Chat history cleared. Main Megha hu, boliye main aapki kya madad kar sakti hu? All conversation records are stored in Firebase cloud store.',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    dateTimeIso: new Date().toISOString()
  };

  const resetHistory = [resetMsg];
  updateLocalCache(resetHistory);

  // Delete all previous documents in Firestore collection
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const snapshot = await getDocs(colRef);
    const batch = writeBatch(db);
    snapshot.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();

    // Save reset message to Firestore
    await saveMeghaChatMessageToFirestore(resetMsg);
  } catch (err) {
    console.error('Error clearing Firebase Firestore chat history:', err);
  }

  return resetHistory;
}

export function subscribeMeghaChat(listener: ChatChangeListener): () => void {
  initFirestoreSync();
  listeners.add(listener);
  // Send current cached state immediately
  listener(cachedMessages);
  return () => {
    listeners.delete(listener);
  };
}

export function downloadMeghaChatTranscript(): void {
  const messages = getMeghaChatHistory();
  if (messages.length === 0) return;

  const header = `=====================================================\nMEGHA AI ASSISTANT - FIREBASE CONVERSATION TRANSCRIPT\nFirebase Project: gen-lang-client-0378879755\nExported At: ${new Date().toLocaleString()}\nTotal Records: ${messages.length}\n=====================================================\n\n`;

  const body = messages.map((m, index) => {
    const senderLabel = m.sender === 'user' ? 'USER (Indrajit)' : 'MEGHA AI';
    const dateStr = m.dateTimeIso ? new Date(m.dateTimeIso).toLocaleString() : m.timestamp;
    return `[${index + 1}] ${senderLabel} (${dateStr}):\n${m.text}\n`;
  }).join('\n-----------------------------------------------------\n\n');

  const fullText = header + body;
  const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `megha_firebase_chat_records_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
