const SAVE_KEY = 'slingsquad_ascension_v1';

// ─── 10 Ascension Levels (cumulative) ─────────────────────────────────────────
export const ASCENSION_LEVELS: { level: number; name: string; desc: string }[] = [
  { level: 1,  name: 'Hardened',    desc: 'Enemy HP +20%' },
  { level: 2,  name: 'Reinforced',  desc: '+1 enemy per battle' },
  { level: 3,  name: 'Inflation',   desc: 'Shop costs +30%' },
  { level: 4,  name: 'Cursed',      desc: 'Start with a random curse' },
  { level: 5,  name: 'Brutal',      desc: 'Enemy damage +25%' },
  { level: 6,  name: 'Scarcity',    desc: 'Gold from all sources -50%' },
  { level: 7,  name: 'Undermanned', desc: '-1 hero in squad' },
  { level: 8,  name: 'Warlord',     desc: 'Boss HP +50%, Elite HP +25%' },
  { level: 9,  name: 'No Charity',  desc: 'REWARD nodes become shops' },
  { level: 10, name: 'Nightmare',   desc: 'Enemies attack 20% faster, start with 2 curses' },
];

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
  // Unlock next ascension level (max 10) if beaten at current unlocked level
  if (ascensionLevel >= d.unlockedLevel && d.unlockedLevel < 10) {
    d.unlockedLevel = ascensionLevel + 1;
  }
  _save();
}

// ─── Modifiers ────────────────────────────────────────────────────────────────

export interface AscensionModifiers {
  enemyHpMult: number;
  extraEnemies: number;
  shopCostMult: number;
  startCurseCount: number;       // 0, 1, or 2
  enemyDamageMult: number;
  reducedGold: boolean;
  fewerHeroes: number;           // heroes to remove from starting squad
  bossHpMult: number;
  eliteHpMult: number;
  noFreeRelics: boolean;
  enemyAttackSpeedMult: number;  // <1 = faster (multiplied against combatSpeed)
}

/** Get modifiers for a given ascension level. All effects are cumulative. */
export function getAscensionModifiers(level: number): AscensionModifiers {
  // Enemy HP: +20% at lv1, growing +5% per additional level
  const enemyHpMult = level >= 1 ? 1 + 0.20 + (level - 1) * 0.05 : 1;

  // Enemy damage: +25% at lv5, growing +5% per additional level
  const enemyDamageMult = level >= 5 ? 1 + 0.25 + (level - 5) * 0.05 : 1;

  // Boss/Elite HP: at lv8 bosses get extra +50%, elites get extra +25%
  // Below lv8, both use the base enemyHpMult
  const bossHpMult = level >= 8 ? enemyHpMult + 0.50 : enemyHpMult;
  const eliteHpMult = level >= 8 ? enemyHpMult + 0.25 : enemyHpMult;

  // Curses: 1 at lv4, 2 at lv10
  const startCurseCount = level >= 10 ? 2 : level >= 4 ? 1 : 0;

  return {
    enemyHpMult,
    extraEnemies:          level >= 2 ? 1 : 0,
    shopCostMult:          1 + (level >= 3 ? 0.30 : 0),
    startCurseCount,
    enemyDamageMult,
    reducedGold:           level >= 6,
    fewerHeroes:           level >= 7 ? 1 : 0,
    bossHpMult,
    eliteHpMult,
    noFreeRelics:          level >= 9,
    enemyAttackSpeedMult:  level >= 10 ? 0.80 : 1.0,
  };
}

/** Shard multiplier: +10% per ascension level */
export function getAscensionShardMult(level: number): number {
  return 1 + level * 0.1;
}
