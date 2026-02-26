import { HERO_STATS, MAX_SQUAD_SIZE, type HeroClass } from '@/config/constants';
import type { MetaBonuses } from '@/systems/MetaState';
import { getAscensionModifiers } from '@/systems/AscensionSystem';

// ─── Node types ───────────────────────────────────────────────────────────────
export type NodeType = 'BATTLE' | 'ELITE' | 'REWARD' | 'SHOP' | 'BOSS' | 'EVENT' | 'FORGE';
export interface NodeDef {
  id: number;
  type: NodeType;
  name: string;
  x: number;           // position on overworld map canvas
  y: number;
  next: number[];      // edges to next node IDs
  enemies?: string[];  // EnemyClass[]
  gold?: number;       // gold awarded on win
  difficulty?: number; // 1–5, controls structure template
}

// ─── Relic definition (mirrors relics.json) ───────────────────────────────────
export interface RelicDef {
  id: string;
  name: string;
  desc: string;
  effect: string;
  value: number;
  cost?: number;       // gold cost in shop (undefined = free on REWARD node)
  rarity?: 'common' | 'uncommon' | 'rare';
  curse?: boolean;     // true = negative relic (curse)
}

// ─── Persistent hero data across battles ─────────────────────────────────────
export interface HeroRunData {
  heroClass: HeroClass;
  name: string;
  currentHp: number;  // persists between battles
  maxHp: number;
}

// ─── The run ─────────────────────────────────────────────────────────────────
export interface RunState {
  squad: HeroRunData[];
  gold: number;
  relics: RelicDef[];
  nodeMap: NodeDef[];
  currentNodeId: number;
  completedNodeIds: Set<number>;
  availableNodeIds: Set<number>; // unlocked for selection
  lockedNodeIds: Set<number>;   // paths not taken — permanently blocked
  currentMapId: string;          // which map this run is on
  ascensionLevel: number;        // 0 = off, 1-10 = active
  activeModifiers: string[];     // modifier IDs active for this run
  isDailyChallenge: boolean;     // true if started from daily challenge
  // Meta bonuses carried through the run for systems that need them
  metaGoldGainPct: number;
  metaDamagePct: number;
  metaLaunchPowerPct: number;
}

// ─── Module-level singleton ───────────────────────────────────────────────────
let _state: RunState | null = null;

export function getRunState(): RunState {
  if (!_state) throw new Error('RunState not initialized — call newRun() first');
  return _state;
}

export function hasRunState(): boolean {
  return _state !== null;
}

export function newRun(
  nodeMap: NodeDef[],
  heroClasses: HeroClass[],
  meta?: MetaBonuses,
  mapId = 'goblin_wastes',
  opts?: { ascensionLevel?: number; modifiers?: string[]; isDaily?: boolean },
): RunState {
  const heroNames: Record<HeroClass, string> = {
    WARRIOR: 'Sir Brom',
    RANGER: 'Sylva',
    MAGE: 'Aldric',
    PRIEST: 'Seraph',
    BARD: 'Lyric',
    ROGUE: 'Shade',
    PALADIN: 'Auriel',
    DRUID: 'Thorn',
  };

  let hpMult = 1 + (meta?.flatHpPct ?? 0);
  const modifiers = opts?.modifiers ?? [];
  const ascLevel = opts?.ascensionLevel ?? 0;
  const ascMods = getAscensionModifiers(ascLevel);

  // Glass Cannon modifier: halve HP, double damage
  let damageMult = meta?.damagePct ?? 0;
  if (modifiers.includes('glass_cannon')) {
    hpMult *= 0.5;
    damageMult = (1 + damageMult) * 2 - 1; // effectively 2x total
  }

  // Poverty modifier: no starting gold, but shop costs 50% less (stored for ShopScene)
  let startingGold = meta?.startingGold ?? 0;
  if (modifiers.includes('poverty')) {
    startingGold = 0;
  }

  _state = {
    squad: heroClasses.map(cls => {
      const baseHp = HERO_STATS[cls]?.hp ?? 80;
      const maxHp = Math.round(baseHp * hpMult);
      return {
        heroClass: cls,
        name: heroNames[cls as keyof typeof heroNames] ?? cls,
        currentHp: maxHp,
        maxHp,
      };
    }),
    gold: startingGold,
    relics: [], // starting relic (if purchased) injected by MainMenuScene after newRun()
    nodeMap,
    currentNodeId: nodeMap[0].id,
    completedNodeIds: new Set(),
    availableNodeIds: new Set([nodeMap[0].id]),
    lockedNodeIds: new Set(),
    currentMapId: mapId,
    ascensionLevel: ascLevel,
    activeModifiers: modifiers,
    isDailyChallenge: opts?.isDaily ?? false,
    metaGoldGainPct: meta?.goldGainPct ?? 0,
    metaDamagePct: damageMult,
    metaLaunchPowerPct: meta?.launchPowerPct ?? 0,
  };

  // Ascension: start with a random curse
  if (ascMods.startWithCurse) {
    try {
      // Dynamic import not available here; load curses inline
      const cursePool = [
        { id: 'fragile_bones', name: 'Fragile Bones', desc: 'Take +15% damage.', effect: 'DAMAGE_REDUCTION', value: -0.15, rarity: 'common' as const, curse: true },
        { id: 'heavy_pockets', name: 'Heavy Pockets', desc: 'Launch power -10%.', effect: 'LAUNCH_POWER_CURSE', value: 0.1, rarity: 'common' as const, curse: true },
        { id: 'slow_hands', name: 'Slow Hands', desc: 'Launch cooldown +0.3s.', effect: 'COOLDOWN_REDUCE', value: -300, rarity: 'common' as const, curse: true },
      ];
      const curse = cursePool[Math.floor(Math.random() * cursePool.length)];
      _state.relics.push(curse);
    } catch { /* */ }
  }

  saveRun();
  return _state;
}

// Called after winning a node's battle
export function completeNode(nodeId: number) {
  const s = getRunState();
  s.completedNodeIds.add(nodeId);
  const node = s.nodeMap.find(n => n.id === nodeId)!;

  // Award gold (meta gold gain multiplier applied)
  if (node.gold) {
    const mult = 1 + (s.metaGoldGainPct ?? 0);
    s.gold += Math.round(node.gold * mult);
  }

  // Unlock next nodes
  for (const nextId of node.next) {
    s.availableNodeIds.add(nextId);
  }
  saveRun();
}

// Select which node to travel to — locks sibling branches permanently
export function selectNode(nodeId: number) {
  const s = getRunState();
  s.currentNodeId = nodeId;

  // For every parent that leads to this node, lock any sibling branches not chosen
  for (const parent of s.nodeMap) {
    if (parent.next.includes(nodeId) && parent.next.length > 1) {
      for (const sibId of parent.next) {
        if (sibId !== nodeId && !s.completedNodeIds.has(sibId)) {
          _lockSubtree(sibId, s);
        }
      }
    }
  }
  saveRun();
}

function _lockSubtree(nodeId: number, s: RunState) {
  if (s.lockedNodeIds.has(nodeId) || s.completedNodeIds.has(nodeId)) return;
  s.lockedNodeIds.add(nodeId);
  s.availableNodeIds.delete(nodeId);

  const node = s.nodeMap.find(n => n.id === nodeId);
  if (!node) return;
  for (const childId of node.next) {
    // Only lock child if no non-locked, non-dead-end parent can still reach it
    const hasActivePath = s.nodeMap.some(
      n => n.next.includes(childId) && !s.lockedNodeIds.has(n.id) && n.id !== nodeId,
    );
    if (!hasActivePath) _lockSubtree(childId, s);
  }
}

export function addRelic(relic: RelicDef) {
  getRunState().relics.push(relic);
  saveRun();
}

export function removeRelic(relicId: string): boolean {
  const s = getRunState();
  const idx = s.relics.findIndex(r => r.id === relicId);
  if (idx === -1) return false;
  s.relics.splice(idx, 1);
  saveRun();
  return true;
}

export function upgradeRelic(relicId: string, factor = 1.5): boolean {
  const s = getRunState();
  const relic = s.relics.find(r => r.id === relicId);
  if (!relic) return false;
  relic.value = Math.round(relic.value * factor * 100) / 100;
  relic.name = relic.name + ' +';
  saveRun();
  return true;
}

export function getCurses(): RelicDef[] {
  return getRunState().relics.filter(r => r.curse === true);
}

export function getNonCurseRelics(): RelicDef[] {
  return getRunState().relics.filter(r => !r.curse);
}

export function spendGold(amount: number): boolean {
  const s = getRunState();
  if (s.gold < amount) return false;
  s.gold -= amount;
  saveRun();
  return true;
}

/** Recruit a new hero mid-run. Returns false if squad is full or class already present. */
export function recruitHero(heroClass: HeroClass): boolean {
  const s = getRunState();
  if (s.squad.length >= MAX_SQUAD_SIZE) return false;
  if (s.squad.some(h => h.heroClass === heroClass)) return false;
  const heroNames: Record<string, string> = {
    WARRIOR: 'Sir Brom', RANGER: 'Sylva', MAGE: 'Aldric',
    PRIEST: 'Seraph', BARD: 'Lyric', ROGUE: 'Shade',
    PALADIN: 'Auriel', DRUID: 'Thorn',
  };
  const baseHp = HERO_STATS[heroClass]?.hp ?? 80;
  s.squad.push({
    heroClass,
    name: heroNames[heroClass] ?? heroClass,
    currentHp: baseHp,
    maxHp: baseHp,
  });
  saveRun();
  return true;
}

/** Move a hero from fromIndex to toIndex in the squad launch order. */
export function reorderSquad(fromIndex: number, toIndex: number) {
  const s = getRunState();
  if (fromIndex < 0 || fromIndex >= s.squad.length) return;
  if (toIndex   < 0 || toIndex   >= s.squad.length) return;
  const [item] = s.squad.splice(fromIndex, 1);
  s.squad.splice(toIndex, 0, item);
  saveRun();
}

/** Persist hero HP after a victory.
 *  Survivors carry their current HP forward. Dead heroes revive at 25 % of maxHp.
 *  Also syncs maxHp so relic bonuses are reflected in the overworld party panel. */
export function syncSquadHp(heroes: Array<{ heroClass: HeroClass; hp: number; maxHp: number; state: string }>) {
  const s = getRunState();
  for (const h of heroes) {
    const entry = s.squad.find(e => e.heroClass === h.heroClass);
    if (!entry) continue;
    // Always update maxHp — may have been inflated by relics applied in buildSquad
    entry.maxHp = h.maxHp;
    if (h.state === 'dead') {
      entry.currentHp = Math.max(1, Math.round(h.maxHp * 0.25)); // revive at 25 %
    } else {
      entry.currentHp = Math.max(1, h.hp); // persist actual HP
    }
  }
  saveRun();
}


// ─── Persistence ──────────────────────────────────────────────────────────────

const SAVE_KEY = 'slingsquad_run_v1';

/** Serialize run state to localStorage (Sets → arrays) */
export function saveRun() {
  if (!_state) return;
  try {
    const data = {
      ..._state,
      completedNodeIds: [..._state.completedNodeIds],
      availableNodeIds: [..._state.availableNodeIds],
      lockedNodeIds:    [..._state.lockedNodeIds],
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* storage unavailable */ }
}

/** Restore run state from localStorage. Returns true if a save was found. */
export function loadRun(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    _state = {
      ...data,
      completedNodeIds:  new Set<number>(data.completedNodeIds as number[]),
      availableNodeIds:  new Set<number>(data.availableNodeIds as number[]),
      lockedNodeIds:     new Set<number>((data.lockedNodeIds ?? []) as number[]),
      currentMapId:      data.currentMapId       ?? 'goblin_wastes',
      ascensionLevel:    data.ascensionLevel     ?? 0,
      activeModifiers:   data.activeModifiers    ?? [],
      isDailyChallenge:  data.isDailyChallenge   ?? false,
      metaGoldGainPct:   data.metaGoldGainPct   ?? 0,
      metaDamagePct:     data.metaDamagePct      ?? 0,
      metaLaunchPowerPct: data.metaLaunchPowerPct ?? 0,
    };
    return true;
  } catch {
    return false;
  }
}

/** Check if a saved run exists in localStorage (without loading it) */
export function hasSavedRun(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Wipe the saved run (called when starting a fresh run) */
export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

/** Apply all accumulated relic effects and return stat modifiers */
export interface RelicModifiers {
  cooldownReduceMs: number;
  flatHpBonus: number;
  mageAoeRadiusBonus: number;
  warriorImpactMult: number;
  rangerArrowBonus: number;
  priestHealRadiusBonus: number;
  priestHealBonus: number;
  flatCombatDamage: number;
  combatSpeedMult: number;
  maxDragBonus: number;
  metaDamagePct: number;
  // New relic effects
  goldOnWin: number;
  airFrictionReduce: number;
  damageReduction: number;
  thorns: number;
  critChance: number;
  impactDamageBonus: number;
  deathSaves: number;
  extraLaunches: number;
  goldOnKill: number;
  warriorKnockback: number;
  mageChainTargets: number;
  rangerPoisonDamage: number;
  priestResurrectPct: number;
  bardCharmBonus: number;
  stoneDamageBonus: number;
  lowHpDamageMult: number;
  // Curse-specific modifiers
  goldTaxPct: number;          // fraction of gold lost on win
  trajectoryReduce: number;    // dots to remove from trajectory preview
  launchPowerCurse: number;    // negative fraction to reduce launch power
}

export function getRelicModifiers(): RelicModifiers {
  const s = getRunState();
  const mods: RelicModifiers = {
    cooldownReduceMs: 0,
    flatHpBonus: 0,
    mageAoeRadiusBonus: 0,
    warriorImpactMult: 1.0,
    rangerArrowBonus: 0,
    priestHealRadiusBonus: 0,
    priestHealBonus: 0,
    flatCombatDamage: 0,
    combatSpeedMult: 1.0,
    maxDragBonus: 0,
    metaDamagePct: 0,
    goldOnWin: 0,
    airFrictionReduce: 0,
    damageReduction: 0,
    thorns: 0,
    critChance: 0,
    impactDamageBonus: 0,
    deathSaves: 0,
    extraLaunches: 0,
    goldOnKill: 0,
    warriorKnockback: 0,
    mageChainTargets: 0,
    rangerPoisonDamage: 0,
    priestResurrectPct: 0,
    bardCharmBonus: 0,
    stoneDamageBonus: 0,
    lowHpDamageMult: 0,
    goldTaxPct: 0,
    trajectoryReduce: 0,
    launchPowerCurse: 0,
  };
  for (const r of s.relics) {
    switch (r.effect) {
      case 'COOLDOWN_REDUCE':      mods.cooldownReduceMs       += r.value; break;
      case 'FLAT_HP':              mods.flatHpBonus            += r.value; break;
      case 'MAGE_AOE_RADIUS':      mods.mageAoeRadiusBonus     += r.value; break;
      case 'WARRIOR_IMPACT_BONUS': mods.warriorImpactMult      += r.value; break;
      case 'RANGER_ARROW_COUNT':   mods.rangerArrowBonus       += r.value; break;
      case 'PRIEST_HEAL_BONUS':
        mods.priestHealRadiusBonus += r.value;
        mods.priestHealBonus       += Math.round(r.value / 4);
        break;
      case 'FLAT_COMBAT_DAMAGE':   mods.flatCombatDamage       += r.value; break;
      case 'COMBAT_SPEED_MULT':    mods.combatSpeedMult        *= r.value; break;
      case 'MAX_DRAG_BONUS':       mods.maxDragBonus           += r.value; break;
      case 'GOLD_ON_WIN':          mods.goldOnWin              += r.value; break;
      case 'AIR_FRICTION_REDUCE':  mods.airFrictionReduce      += r.value; break;
      case 'DAMAGE_REDUCTION':     mods.damageReduction        += r.value; break;
      case 'THORNS':               mods.thorns                 += r.value; break;
      case 'CRIT_CHANCE':          mods.critChance             += r.value; break;
      case 'IMPACT_DAMAGE_BONUS':  mods.impactDamageBonus      += r.value; break;
      case 'DEATH_SAVE':           mods.deathSaves             += r.value; break;
      case 'EXTRA_LAUNCH':         mods.extraLaunches          += r.value; break;
      case 'GOLD_ON_KILL':         mods.goldOnKill             += r.value; break;
      case 'WARRIOR_KNOCKBACK':    mods.warriorKnockback       += r.value; break;
      case 'MAGE_CHAIN':           mods.mageChainTargets       += r.value; break;
      case 'RANGER_POISON':        mods.rangerPoisonDamage     += r.value; break;
      case 'PRIEST_RESURRECT':     mods.priestResurrectPct      = r.value; break;
      case 'BARD_CHARM_BONUS':     mods.bardCharmBonus         += r.value; break;
      case 'STONE_DAMAGE_BONUS':   mods.stoneDamageBonus       += r.value; break;
      case 'LOW_HP_DAMAGE':        mods.lowHpDamageMult         = r.value; break;
      // Curse-specific effects
      case 'GOLD_TAX_PCT':         mods.goldTaxPct             += r.value; break;
      case 'TRAJECTORY_REDUCE':    mods.trajectoryReduce       += r.value; break;
      case 'LAUNCH_POWER_CURSE':   mods.launchPowerCurse       += r.value; break;
    }
  }
  // Pass meta damage bonus through for CombatSystem to apply as a multiplier
  mods.metaDamagePct = s.metaDamagePct ?? 0;
  return mods;
}
