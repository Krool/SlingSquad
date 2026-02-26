const SAVE_KEY = 'slingsquad_stats_v1';

export interface RunSummary {
  mapId: string;
  squad: string[];        // hero class names
  relicCount: number;
  nodesCleared: number;
  gold: number;
  victory: boolean;
  timestamp: number;
}

export interface GlobalStats {
  totalRuns: number;
  totalWins: number;
  totalLosses: number;
  totalEnemiesKilled: number;
  totalBlocksDestroyed: number;
  totalGoldEarned: number;
  bestDamageInOneLaunch: number;
  fastestBattleMs: number;
  recentRuns: RunSummary[]; // last 10
}

let _stats: GlobalStats | null = null;

function _ensure(): GlobalStats {
  if (!_stats) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      _stats = raw ? JSON.parse(raw) : defaultStats();
    } catch {
      _stats = defaultStats();
    }
  }
  return _stats!;
}

function defaultStats(): GlobalStats {
  return {
    totalRuns: 0,
    totalWins: 0,
    totalLosses: 0,
    totalEnemiesKilled: 0,
    totalBlocksDestroyed: 0,
    totalGoldEarned: 0,
    bestDamageInOneLaunch: 0,
    fastestBattleMs: Infinity,
    recentRuns: [],
  };
}

function _save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(_ensure()));
  } catch { /* storage unavailable */ }
}

// ── Getters ────────────────────────────────────────────────────────────────────

export function getGlobalStats(): GlobalStats {
  return { ..._ensure() };
}

// ── Mutators ───────────────────────────────────────────────────────────────────

export function recordRunEnd(summary: RunSummary): void {
  const s = _ensure();
  s.totalRuns++;
  if (summary.victory) s.totalWins++;
  else s.totalLosses++;
  s.totalGoldEarned += summary.gold;
  s.recentRuns.unshift(summary);
  if (s.recentRuns.length > 10) s.recentRuns.pop();
  _save();
}

export function addEnemiesKilled(count: number): void {
  _ensure().totalEnemiesKilled += count;
  _save();
}

export function addBlocksDestroyed(count: number): void {
  _ensure().totalBlocksDestroyed += count;
  _save();
}

export function recordLaunchDamage(damage: number): void {
  const s = _ensure();
  if (damage > s.bestDamageInOneLaunch) {
    s.bestDamageInOneLaunch = damage;
    _save();
  }
}

export function recordBattleTime(ms: number): void {
  const s = _ensure();
  if (ms < s.fastestBattleMs) {
    s.fastestBattleMs = ms;
    _save();
  }
}
