import type { HeroClass } from '@/config/constants';

const SAVE_KEY = 'slingsquad_mastery_v1';

export interface HeroMastery {
  xp: number;
  level: number;
  runsPlayed: number;
  runsWon: number;
  highestAscensionWon: number;
  mvpCount: number;
}

const XP_THRESHOLDS = [0, 50, 150, 350, 700, 1200]; // cumulative XP thresholds for levels 0-5

/** Returns the cumulative XP threshold for a given level. Precomputed for 0-5, formula for 6+. */
function getThreshold(level: number): number {
  if (level < XP_THRESHOLDS.length) return XP_THRESHOLDS[level];
  // For levels 6+: threshold(N) = threshold(N-1) + 500 + 100*(N-5)
  let t = XP_THRESHOLDS[XP_THRESHOLDS.length - 1]; // level 5 = 1200
  for (let n = XP_THRESHOLDS.length; n <= level; n++) {
    t += 500 + 100 * (n - 5);
  }
  return t;
}

let _mastery: Record<string, HeroMastery> | null = null;

function _ensure(): Record<string, HeroMastery> {
  if (!_mastery) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      _mastery = raw ? JSON.parse(raw) : {};
    } catch {
      _mastery = {};
    }
    // Backfill missing fields from old saves (once on load)
    for (const key of Object.keys(_mastery!)) {
      const m = _mastery![key] as Partial<HeroMastery>;
      m.runsPlayed ??= 0;
      m.runsWon ??= 0;
      m.highestAscensionWon ??= -1;
      m.mvpCount ??= 0;
    }
  }
  return _mastery!;
}

function _save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(_ensure()));
  } catch { /* storage unavailable */ }
}

export function getMastery(heroClass: HeroClass): HeroMastery {
  const m = _ensure();
  if (!m[heroClass]) m[heroClass] = { xp: 0, level: 0, runsPlayed: 0, runsWon: 0, highestAscensionWon: -1, mvpCount: 0 };
  return m[heroClass];
}

export function addXP(heroClass: HeroClass, amount: number): void {
  const m = getMastery(heroClass);
  m.xp += amount;
  // Level up — no cap
  while (m.xp >= getThreshold(m.level + 1)) {
    m.level++;
  }
  _save();
}

export function getMasteryLevel(heroClass: HeroClass): number {
  return getMastery(heroClass).level;
}

export function getXPForNextLevel(heroClass: HeroClass): { current: number; needed: number } {
  const m = getMastery(heroClass);
  return { current: m.xp, needed: getThreshold(m.level + 1) };
}

export function getAllMasteries(): Record<string, HeroMastery> {
  return { ..._ensure() };
}

// ── Per-hero lifetime stat mutators ──────────────────────────────────────────

export function addRunPlayed(heroClass: HeroClass): void {
  const m = getMastery(heroClass);
  m.runsPlayed++;
  _save();
}

export function addRunWon(heroClass: HeroClass, ascensionLevel: number): void {
  const m = getMastery(heroClass);
  m.runsWon++;
  if (ascensionLevel > m.highestAscensionWon) m.highestAscensionWon = ascensionLevel;
  _save();
}

export function addMVP(heroClass: HeroClass): void {
  const m = getMastery(heroClass);
  m.mvpCount++;
  _save();
}
