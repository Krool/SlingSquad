import { getRunState, hasRunState } from '@/systems/RunState';
import { addRunPlayed, addRunWon } from '@/systems/MasterySystem';
import { incrementStat } from '@/systems/AchievementSystem';
import { recordClear } from '@/systems/AscensionSystem';
import { calculateRunScore } from '@/systems/ScoreSystem';
import { updateBestScore, getProfile } from '@/systems/PlayerProfile';
import { isFirebaseAvailable, submitScore } from '@/services/LeaderboardService';

const SAVE_KEY = 'slingsquad_stats_v1';

export interface RunSummary {
  mapId: string;
  squad: string[];        // hero class names
  relicCount: number;
  nodesCleared: number;
  gold: number;
  victory: boolean;
  timestamp: number;
  floorsCompleted?: number; // multi-floor: how many floors cleared
  score?: number;           // calculated run score
  ascensionLevel?: number;
  modifiers?: string[];
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
  bestScore: number;
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
    bestScore: 0,
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

// ── Whole-run finalization (call once when a run truly ends) ─────────────────

let _runFinalized = false;

/** Reset the finalized guard (call when starting a new run). */
export function resetRunFinalized(): void { _runFinalized = false; }

export function finalizeRun(victory: boolean): void {
  if (_runFinalized || !hasRunState()) return;
  _runFinalized = true;
  const run = getRunState();

  // Calculate score
  const completedNodes = run.nodeMap.filter(n => run.completedNodeIds.has(n.id));
  const breakdown = calculateRunScore({
    completedNodes,
    victory,
    heroDeathsTotal: run.heroDeathsTotal ?? 0,
    ascensionLevel: run.ascensionLevel,
    modifiers: run.activeModifiers,
  });
  // Update best score in global stats and player profile
  const stats = _ensure();
  if (breakdown.final > (stats.bestScore ?? 0)) {
    stats.bestScore = breakdown.final;
    _save();
  }
  updateBestScore(breakdown.final, run.ascensionLevel, run.activeModifiers, run.currentFloor + 1);

  recordRunEnd({
    mapId: run.currentMapId,
    squad: run.squad.map(h => h.heroClass),
    relicCount: run.relics.length,
    nodesCleared: run.completedNodeIds.size,
    gold: run.gold,
    victory,
    timestamp: Date.now(),
    floorsCompleted: (run.completedFloors?.length ?? 0) + (victory ? 1 : 0),
    score: breakdown.final,
    ascensionLevel: run.ascensionLevel,
    modifiers: run.activeModifiers.length > 0 ? run.activeModifiers : undefined,
  });

  // Per-hero run stats
  for (const h of run.squad) {
    addRunPlayed(h.heroClass);
    if (victory) addRunWon(h.heroClass, run.ascensionLevel);
  }

  // Ascension unlock: record clear at this ascension level
  if (victory) {
    recordClear(run.currentMapId, run.ascensionLevel);
  }

  // Achievement stats (once per run, not per battle)
  incrementStat('runs_completed');
  incrementStat('total_gold', run.gold);

  // Attempt leaderboard submission (fire-and-forget)
  if (isFirebaseAvailable()) {
    const profile = getProfile();
    submitScore(profile).catch(() => { /* silent */ });
  }
}
