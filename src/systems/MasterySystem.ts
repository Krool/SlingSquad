import type { HeroClass } from '@/config/constants';

const SAVE_KEY = 'slingsquad_mastery_v1';

export interface HeroMastery {
  xp: number;
  level: number;
}

const XP_PER_LEVEL = [0, 50, 150, 350, 700, 1200]; // cumulative XP thresholds for levels 0-5

let _mastery: Record<string, HeroMastery> | null = null;

function _ensure(): Record<string, HeroMastery> {
  if (!_mastery) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      _mastery = raw ? JSON.parse(raw) : {};
    } catch {
      _mastery = {};
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
  if (!m[heroClass]) m[heroClass] = { xp: 0, level: 0 };
  return m[heroClass];
}

export function addXP(heroClass: HeroClass, amount: number): void {
  const m = getMastery(heroClass);
  m.xp += amount;
  // Level up
  while (m.level < 5 && m.xp >= XP_PER_LEVEL[m.level + 1]) {
    m.level++;
  }
  _save();
}

export function getMasteryLevel(heroClass: HeroClass): number {
  return getMastery(heroClass).level;
}

export function getXPForNextLevel(heroClass: HeroClass): { current: number; needed: number } {
  const m = getMastery(heroClass);
  if (m.level >= 5) return { current: m.xp, needed: m.xp }; // max
  return { current: m.xp, needed: XP_PER_LEVEL[m.level + 1] };
}

export function getAllMasteries(): Record<string, HeroMastery> {
  return { ..._ensure() };
}
