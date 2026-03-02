import upgradesData from '@/data/upgrades.json';
import relicsData from '@/data/relics.json';
import type { RelicDef } from '@/systems/RunState';
import { isUnlocked as isAchievementUnlocked } from '@/systems/AchievementSystem';

// ─── Upgrade definition (mirrors upgrades.json) ───────────────────────────────
export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  building?: string;
  effect: string;
  value: number | string;
  heroClass?: string;
  maxStack: number;
  shardCost: number;
  hidden?: boolean;
}

// ─── Meta bonus bundle applied to each new run ────────────────────────────────
export interface MetaBonuses {
  startingGold: number;         // flat gold at run start
  flatHpPct: number;            // fraction added to each hero's max HP (e.g. 0.15)
  goldGainPct: number;          // fraction bonus to all gold earned (e.g. 0.25)
  damagePct: number;            // fraction bonus to all combat damage
  launchPowerPct: number;       // fraction bonus to launch power multiplier
  startingRelic: boolean;       // grant a random common relic at run start
  squadSizeBonus: number;       // extra squad slots beyond STARTER_SQUAD_SIZE
  unlockedHeroClasses: string[];// hero classes unlocked via meta upgrades
  reviveCooldownReduction: number; // nodes subtracted from revive cooldown
  forgeBonusPct: number;          // extra forge upgrade multiplier (e.g. 0.25 → 1.75x instead of 1.5x)
  curseResistancePct: number;     // chance to negate incoming curses (e.g. 0.25)
  bonusShardsPerRun: number;      // flat bonus shards at end of each run
}

// ─── Achievement gates for upgrades ──────────────────────────────────────────
const UPGRADE_ACHIEVEMENT_GATES: Record<string, string> = {
  damage_bonus:   'first_blood',     // Blood Pact requires First Blood
  starting_relic: 'collector',       // Fortunate Start requires Collector
  launch_power:   'wrecking_ball',   // Giant's Arm requires Wrecking Ball
  squad_size:     'conqueror',       // Extended Barracks requires Conqueror
  forge_bonus:    'forge_master',    // Master Smith requires Forge Master
};

/** Check if the achievement gate (if any) is satisfied for an upgrade. */
export function isUpgradeGateMet(upgradeId: string): boolean {
  const gate = UPGRADE_ACHIEVEMENT_GATES[upgradeId];
  if (!gate) return true; // no gate
  return isAchievementUnlocked(gate);
}

/** Get the achievement ID gating an upgrade, or null if none. */
export function getUpgradeGate(upgradeId: string): string | null {
  return UPGRADE_ACHIEVEMENT_GATES[upgradeId] ?? null;
}

// ─── Persistent meta state ────────────────────────────────────────────────────
interface MetaStateData {
  shards: number;
  purchases: Record<string, number>; // upgradeId → times purchased
}

const SAVE_KEY = 'slingsquad_meta_v1';

let _meta: MetaStateData | null = null;

function _ensure(): MetaStateData {
  if (!_meta) _meta = loadMeta() ?? { shards: 0, purchases: {} };
  return _meta;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getShards(): number {
  return _ensure().shards;
}

export function earnShards(amount: number): void {
  _ensure().shards += amount;
  saveMeta();
}

export function spendShards(amount: number): boolean {
  const m = _ensure();
  if (m.shards < amount) return false;
  m.shards -= amount;
  saveMeta();
  return true;
}

export function getPurchaseCount(upgradeId: string): number {
  return _ensure().purchases[upgradeId] ?? 0;
}

export function canPurchase(upgradeId: string): boolean {
  const upgrade = getAllUpgrades().find(u => u.id === upgradeId);
  if (!upgrade) return false;
  if (!isUpgradeGateMet(upgradeId)) return false;
  const count = getPurchaseCount(upgradeId);
  return count < upgrade.maxStack && getShards() >= upgrade.shardCost;
}

export function purchaseUpgrade(upgradeId: string): boolean {
  if (!canPurchase(upgradeId)) return false;
  const upgrade = getAllUpgrades().find(u => u.id === upgradeId);
  if (!upgrade) return false;
  const m = _ensure();
  m.shards -= upgrade.shardCost;
  m.purchases[upgradeId] = (m.purchases[upgradeId] ?? 0) + 1;
  saveMeta();
  return true;
}

/** Aggregate all purchased upgrades into a bonus bundle for newRun() */
export function getMetaBonuses(): MetaBonuses {
  const m = _ensure();
  const bonuses: MetaBonuses = {
    startingGold: 0,
    flatHpPct: 0,
    goldGainPct: 0,
    damagePct: 0,
    launchPowerPct: 0,
    startingRelic: false,
    squadSizeBonus: 0,
    unlockedHeroClasses: [],
    reviveCooldownReduction: 0,
    forgeBonusPct: 0,
    curseResistancePct: 0,
    bonusShardsPerRun: 0,
  };

  for (const upgrade of getAllUpgrades()) {
    const count = m.purchases[upgrade.id] ?? 0;
    if (count === 0) continue;
    switch (upgrade.effect) {
      case 'STARTING_GOLD':    bonuses.startingGold     += (upgrade.value as number) * count; break;
      case 'FLAT_HP_PCT':      bonuses.flatHpPct        += (upgrade.value as number) * count; break;
      case 'GOLD_GAIN_PCT':    bonuses.goldGainPct      += (upgrade.value as number) * count; break;
      case 'DAMAGE_PCT':       bonuses.damagePct        += (upgrade.value as number) * count; break;
      case 'LAUNCH_POWER_PCT': bonuses.launchPowerPct   += (upgrade.value as number) * count; break;
      case 'STARTING_RELIC':   bonuses.startingRelic     = true; break;
      case 'SQUAD_SIZE':       bonuses.squadSizeBonus   += (upgrade.value as number) * count; break;
      case 'REVIVE_COOLDOWN_BONUS': bonuses.reviveCooldownReduction += (upgrade.value as number) * count; break;
      case 'FORGE_BONUS':          bonuses.forgeBonusPct          += (upgrade.value as number) * count; break;
      case 'CURSE_RESISTANCE':     bonuses.curseResistancePct     += (upgrade.value as number) * count; break;
      case 'SHARD_MAGNET':         bonuses.bonusShardsPerRun      += (upgrade.value as number) * count; break;
      case 'UNLOCK_HERO': {
        const cls = upgrade.heroClass ?? (typeof upgrade.value === 'string' ? upgrade.value : '');
        if (cls) bonuses.unlockedHeroClasses.push(cls);
        break;
      }
    }
  }
  return bonuses;
}

export function getAllUpgrades(): UpgradeDef[] {
  return upgradesData.upgrades as UpgradeDef[];
}

/** Pick a random common relic from the pool (for STARTING_RELIC bonus) */
export function pickRandomCommonRelic(): RelicDef | null {
  const all = relicsData as RelicDef[];
  const commons = all.filter(r => r.rarity === 'common');
  if (commons.length === 0) return null;
  return commons[Math.floor(Math.random() * commons.length)];
}

// ─── Shard award formula ──────────────────────────────────────────────────────
/** Call at end of run to calculate how many shards were earned */
export function calcShardsEarned(data: {
  nodesCompleted: number;
  killedBoss: boolean;
  victory: boolean;   // completed the full run
  ascensionLevel?: number;
}): number {
  let shards = 0;
  shards += data.nodesCompleted;          // 1 shard per node cleared
  if (data.killedBoss) shards += 4;       // bonus for boss kill
  if (data.victory)    shards += 3;       // full run clear bonus
  // Ascension bonus: +10% per level
  const ascLevel = data.ascensionLevel ?? 0;
  if (ascLevel > 0) {
    shards = Math.floor(shards * (1 + ascLevel * 0.1));
  }
  return shards;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export function saveMeta(): void {
  if (!_meta) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(_meta));
  } catch { /* storage unavailable */ }
}

export function loadMeta(): MetaStateData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MetaStateData;
  } catch {
    return null;
  }
}

export function clearMeta(): void {
  _meta = null;
  localStorage.removeItem(SAVE_KEY);
}
