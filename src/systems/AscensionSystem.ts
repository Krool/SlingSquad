const SAVE_KEY = 'slingsquad_ascension_v1';

export interface AscensionData {
  unlockedLevel: number;            // highest ascension level reached
  highestCleared: Record<string, number>; // mapId → highest ascension cleared
}

let _data: AscensionData | null = null;

function _ensure(): AscensionData {
  if (!_data) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      _data = raw ? JSON.parse(raw) : { unlockedLevel: 0, highestCleared: {} };
    } catch {
      _data = { unlockedLevel: 0, highestCleared: {} };
    }
  }
  return _data!;
}

function _save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(_ensure()));
  } catch { /* storage unavailable */ }
}

export function getUnlockedAscension(): number {
  return _ensure().unlockedLevel;
}

export function getHighestCleared(mapId: string): number {
  return _ensure().highestCleared[mapId] ?? 0;
}

/** Called when a map is cleared. Unlocks next ascension if this was the highest. */
export function recordClear(mapId: string, ascensionLevel: number): void {
  const d = _ensure();
  const prev = d.highestCleared[mapId] ?? 0;
  if (ascensionLevel > prev) {
    d.highestCleared[mapId] = ascensionLevel;
  }
  // Unlock next ascension level (max 10) if all maps cleared at current level
  // For simplicity: beating any map at current ascension unlocks the next
  if (ascensionLevel >= d.unlockedLevel && d.unlockedLevel < 10) {
    d.unlockedLevel = ascensionLevel + 1;
  }
  _save();
}

/** Get modifiers for a given ascension level */
export interface AscensionModifiers {
  enemyHpMult: number;
  extraEnemies: number;
  shopCostMult: number;
  startWithCurse: boolean;
  enemyDamageMult: number;
  reducedGold: boolean;
  fewerHeroes: number;       // heroes to remove from starting squad
  bossHpMult: number;
  noFreeRelics: boolean;
}

export function getAscensionModifiers(level: number): AscensionModifiers {
  return {
    enemyHpMult:     1 + (level >= 1 ? 0.10 : 0),
    extraEnemies:    level >= 2 ? 1 : 0,
    shopCostMult:    1 + (level >= 3 ? 0.25 : 0),
    startWithCurse:  level >= 4,
    enemyDamageMult: 1 + (level >= 5 ? 0.15 : 0),
    reducedGold:     level >= 6,
    fewerHeroes:     level >= 7 ? 1 : 0,
    bossHpMult:      1 + (level >= 8 ? 0.50 : 0),
    noFreeRelics:    level >= 9,
  };
}
