import {
  isFirebaseAvailable, initFirebase, getFirebaseUid, getFirestoreDb,
} from '@/services/LeaderboardService';
import { getProfile } from '@/systems/PlayerProfile';

export interface ChatMessage {
  uid: string;
  name: string;
  avatarKey: string;
  message: string;
  timestamp: number;
}

const MAX_MESSAGE_LENGTH = 80;
const CHAT_COLLECTION = 'chat';
const CHAT_LIMIT = 20;
const COOLDOWN_MS = 5000; // 5 seconds between messages

let _unsubscribe: (() => void) | null = null;
let _lastSendTime = 0;
let _subGeneration = 0; // prevents leaked subscriptions on rapid re-entry

/** Subscribe to the latest chat messages in real-time. */
export async function subscribeToChat(
  onMessages: (messages: ChatMessage[]) => void,
): Promise<boolean> {
  // Unsubscribe any existing listener first
  unsubscribeFromChat();

  if (!isFirebaseAvailable()) return false;

  const gen = ++_subGeneration;

  let db = getFirestoreDb();
  if (!db) {
    const ok = await initFirebase();
    if (!ok) return false;
    db = getFirestoreDb();
    if (!db) return false;
  }

  // If unsubscribe was called while we were awaiting init, abort
  if (gen !== _subGeneration) return false;

  try {
    const { collection, query, orderBy, limit, onSnapshot } = await import('firebase/firestore');

    if (gen !== _subGeneration) return false;

    const q = query(
      collection(db, CHAT_COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(CHAT_LIMIT),
    );

    const unsub = onSnapshot(q, (snap: any) => {
      if (gen !== _subGeneration) { unsub(); return; }
      const messages: ChatMessage[] = snap.docs
        .map((d: any) => d.data() as ChatMessage)
        .reverse(); // oldest first for display
      onMessages(messages);
    }, (err: any) => {
      console.warn('Chat subscription error:', err);
    });

    // Only store if still the active generation
    if (gen === _subGeneration) {
      _unsubscribe = unsub;
    } else {
      unsub(); // stale — clean up immediately
    }

    return true;
  } catch (e) {
    console.warn('Chat subscribe failed:', e);
    return false;
  }
}

/** Stop listening to chat updates. */
export function unsubscribeFromChat(): void {
  _subGeneration++; // invalidate any in-flight subscriptions
  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
  }
}

/** Send a chat message. Returns true on success. */
export async function sendChatMessage(text: string): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return false;

  // Client-side rate limit
  const now = Date.now();
  if (now - _lastSendTime < COOLDOWN_MS) return false;

  let db = getFirestoreDb();
  if (!db) {
    const ok = await initFirebase();
    if (!ok) return false;
    db = getFirestoreDb();
    if (!db) return false;
  }

  const uid = getFirebaseUid();
  if (!uid) return false;

  const profile = getProfile();

  try {
    const { collection, addDoc } = await import('firebase/firestore');
    await addDoc(collection(db, CHAT_COLLECTION), {
      uid,
      name: profile.name,
      avatarKey: profile.avatarKey,
      message: trimmed,
      timestamp: now,
    });
    _lastSendTime = now;
    return true;
  } catch (e) {
    console.warn('Chat send failed:', e);
    return false;
  }
}
