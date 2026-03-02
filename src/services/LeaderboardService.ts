import { FIREBASE_CONFIG } from '@/services/firebaseConfig';

export interface LeaderboardEntry {
  uid: string;
  name: string;
  avatarKey: string;
  score: number;
  ascension: number;
  floor: number;
  modifiers: string[];
  timestamp: number;
}

// ── Lazy-loaded Firebase instances ──────────────────────────────────────────
let _app: any = null;
let _db: any = null;
let _auth: any = null;
let _initPromise: Promise<boolean> | null = null;

/** Returns true if the Firebase config has been filled in. */
export function isFirebaseAvailable(): boolean {
  return !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}

/** Initialize Firebase app, auth, and Firestore. Returns true on success. */
export async function initFirebase(): Promise<boolean> {
  if (!isFirebaseAvailable()) return false;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const { initializeApp } = await import('firebase/app');
      const { getFirestore } = await import('firebase/firestore');
      const { getAuth, signInAnonymously } = await import('firebase/auth');

      _app = initializeApp(FIREBASE_CONFIG);
      _db = getFirestore(_app);
      _auth = getAuth(_app);

      await signInAnonymously(_auth);
      return true;
    } catch (e) {
      console.warn('Firebase init failed:', e);
      return false;
    }
  })();

  return _initPromise;
}

/** Get the current anonymous UID, or '' if not authenticated. */
export function getFirebaseUid(): string {
  return _auth?.currentUser?.uid ?? '';
}

/**
 * Submit (or update) a score in the leaderboard.
 * Only updates if the new score is higher than the existing one.
 */
export async function submitScore(profile: {
  uid: string; name: string; avatarKey: string;
  bestScore: number; bestAscension: number; bestModifiers: string[]; bestFloor: number;
}): Promise<boolean> {
  if (!_db || !profile.uid) return false;
  try {
    const { doc, getDoc, setDoc } = await import('firebase/firestore');
    const ref = doc(_db, 'leaderboard', profile.uid);
    const existing = await getDoc(ref);

    if (existing.exists() && existing.data().score >= profile.bestScore) {
      return false; // existing score is higher
    }

    await setDoc(ref, {
      uid: profile.uid,
      name: profile.name,
      avatarKey: profile.avatarKey,
      score: profile.bestScore,
      ascension: profile.bestAscension,
      floor: profile.bestFloor,
      modifiers: profile.bestModifiers,
      timestamp: Date.now(),
    });
    return true;
  } catch (e) {
    console.warn('Leaderboard submit failed:', e);
    return false;
  }
}

/** Fetch the top N scores from the leaderboard. */
export async function fetchTopScores(limit = 10): Promise<LeaderboardEntry[] | null> {
  if (!_db) {
    const ok = await initFirebase();
    if (!ok || !_db) return null;
  }
  try {
    const { collection, query, orderBy, limit: limitFn, getDocs } = await import('firebase/firestore');
    const q = query(collection(_db, 'leaderboard'), orderBy('score', 'desc'), limitFn(limit));
    const snap = await getDocs(q);
    return snap.docs.map((d: any) => d.data() as LeaderboardEntry);
  } catch (e) {
    console.warn('Leaderboard fetch failed:', e);
    return null;
  }
}

/** Fetch the player's rank (1-indexed). Returns null on failure. */
export async function fetchPlayerRank(uid: string): Promise<number | null> {
  if (!_db || !uid) return null;
  try {
    const { doc, getDoc, collection, query, where, getCountFromServer } = await import('firebase/firestore');
    const playerDoc = await getDoc(doc(_db, 'leaderboard', uid));
    if (!playerDoc.exists()) return null;

    const playerScore = playerDoc.data().score;
    const q = query(collection(_db, 'leaderboard'), where('score', '>', playerScore));
    const countSnap = await getCountFromServer(q);
    return countSnap.data().count + 1;
  } catch (e) {
    console.warn('Leaderboard rank fetch failed:', e);
    return null;
  }
}
