const SAVE_KEY = 'slingsquad_daily_v1';

export interface DailyScore {
  date: string;       // YYYY-MM-DD
  score: number;
  enemiesKilled: number;
  goldEarned: number;
  nodesCleared: number;
}

interface DailyData {
  bestScores: DailyScore[];  // last 7 days
}

let _data: DailyData | null = null;

function _ensure(): DailyData {
  if (!_data) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      _data = raw ? JSON.parse(raw) : { bestScores: [] };
    } catch {
      _data = { bestScores: [] };
    }
  }
  return _data!;
}

function _save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(_ensure()));
  } catch { /* storage unavailable */ }
}

/** Get today's date string for seeding */
export function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Generate a deterministic seed from a date string */
function getDailySeed(dateStr?: string): number {
  const s = dateStr ?? getTodayString();
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const chr = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Simple seeded PRNG (mulberry32) */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Get the daily challenge squad (fixed for the day) */
function getDailySquad(seed: number): string[] {
  const rng = seededRandom(seed);
  const allClasses = ['WARRIOR', 'RANGER', 'MAGE', 'PRIEST'];
  // Always use the 4 base classes for daily, shuffled
  const shuffled = [...allClasses];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Get the daily map (rotates between the 3 maps) */
function getDailyMapId(seed: number): string {
  const maps = ['goblin_wastes', 'frozen_peaks', 'infernal_keep'];
  return maps[seed % maps.length];
}

/** Record today's score. Keeps only the best per day. */
export function recordDailyScore(score: DailyScore): void {
  const d = _ensure();
  const existing = d.bestScores.find(s => s.date === score.date);
  if (existing) {
    if (score.score > existing.score) {
      Object.assign(existing, score);
    }
  } else {
    d.bestScores.unshift(score);
    if (d.bestScores.length > 7) d.bestScores.pop();
  }
  _save();
}

function getTodaysBestScore(): DailyScore | null {
  const today = getTodayString();
  return _ensure().bestScores.find(s => s.date === today) ?? null;
}

function getRecentScores(): DailyScore[] {
  return [..._ensure().bestScores];
}
