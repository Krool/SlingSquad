import achievementsData from '@/data/achievements.json';
import { earnShards } from '@/systems/MetaState';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  category: string;
  shardReward: number;
}

const SAVE_KEY = 'slingsquad_achievements_v1';
const STATS_KEY = 'slingsquad_achievement_stats_v1';

// ── Persistent achievement state ───────────────────────────────────────────────
let _unlocked: Set<string> | null = null;
let _stats: Record<string, number> | null = null;

function _ensureUnlocked(): Set<string> {
  if (!_unlocked) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      _unlocked = raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      _unlocked = new Set();
    }
  }
  return _unlocked;
}

function _ensureStats(): Record<string, number> {
  if (!_stats) {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      _stats = raw ? JSON.parse(raw) : {};
    } catch {
      _stats = {};
    }
  }
  return _stats!;
}

function _saveUnlocked() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify([..._ensureUnlocked()]));
  } catch { /* storage unavailable */ }
}

function _saveStats() {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(_ensureStats()));
  } catch { /* storage unavailable */ }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function getAllAchievements(): AchievementDef[] {
  return achievementsData as AchievementDef[];
}

function isUnlocked(achievementId: string): boolean {
  return _ensureUnlocked().has(achievementId);
}

function getUnlockedIds(): string[] {
  return [..._ensureUnlocked()];
}

function getUnlockedCount(): number {
  return _ensureUnlocked().size;
}

/** Unlock an achievement. Returns true if newly unlocked (not already earned). */
export function unlock(achievementId: string): boolean {
  const set = _ensureUnlocked();
  if (set.has(achievementId)) return false;
  const def = getAllAchievements().find(a => a.id === achievementId);
  if (!def) return false;
  set.add(achievementId);
  _saveUnlocked();
  // Award shards
  if (def.shardReward > 0) earnShards(def.shardReward);
  return true;
}

/** Increment a tracked stat (e.g., 'bosses_killed', 'runs_completed'). Returns new value. */
export function incrementStat(key: string, amount = 1): number {
  const stats = _ensureStats();
  stats[key] = (stats[key] ?? 0) + amount;
  _saveStats();
  return stats[key];
}

export function getStat(key: string): number {
  return _ensureStats()[key] ?? 0;
}

// ── Auto-check achievements based on stats ─────────────────────────────────────

/** Call after significant game events to check for newly earned achievements. */
export function checkAchievements(context: {
  battlesWon?: number;
  blocksDestroyed?: number;
  rangerKill?: boolean;
  mapCleared?: string;
  relicCount?: number;
  curseCount?: number;
  combatKills?: number;
  battleTimeMs?: number;
  goldTotal?: number;
  squadSize?: number;
  barrelExplosions?: number;
}) {
  if (context.battlesWon && context.battlesWon >= 1) unlock('first_blood');
  if (context.blocksDestroyed && context.blocksDestroyed >= 10) unlock('wrecking_ball');
  if (context.rangerKill) unlock('sharpshooter');
  if (context.mapCleared === 'goblin_wastes') unlock('goblin_slayer');
  if (context.mapCleared === 'frozen_peaks') unlock('frost_conqueror');
  if (context.mapCleared === 'infernal_keep') unlock('infernal_victor');
  if (isUnlocked('goblin_slayer') && isUnlocked('frost_conqueror') && isUnlocked('infernal_victor')) {
    unlock('conqueror');
  }
  if (context.relicCount !== undefined && context.relicCount >= 10) unlock('collector');
  if (context.curseCount !== undefined && context.curseCount >= 3) unlock('cursed_run');
  if (context.combatKills !== undefined && context.combatKills === 0 && context.battlesWon) unlock('pacifist');
  if (context.battleTimeMs !== undefined && context.battleTimeMs < 8000) unlock('speedrun');
  if (context.goldTotal !== undefined && context.goldTotal >= 200) unlock('gold_hoarder');
  if (context.relicCount !== undefined && context.relicCount === 0 && context.battlesWon) unlock('no_relics');
  if (context.squadSize !== undefined && context.squadSize >= 6) unlock('full_squad');
  if (context.barrelExplosions !== undefined && context.barrelExplosions >= 3) unlock('chain_reaction');

  // Stat-based
  if (getStat('bosses_killed') >= 3) unlock('boss_rush');
  if (getStat('runs_completed') >= 10) unlock('ten_runs');
  if (getStat('forge_upgrades') >= 5) unlock('forge_master');
  if (getStat('events_visited') >= 10) unlock('event_explorer');
  if (getStat('total_gold') >= 500) unlock('wealthy');
}
