import type { HeroClass } from '@/config/constants';

export interface SkillDef {
  id: string;
  heroClass: HeroClass;
  tier: 1 | 2;
  slot: 'A' | 'B';
  name: string;
  desc: string;
  icon: string;
  effects: Record<string, number>;
}

// ─── All 32 skill definitions ─────────────────────────────────────────────────

const SKILLS: SkillDef[] = [
  // ── WARRIOR ─────────────────────────────────────────────────────────────────
  { id: 'warrior_t1a', heroClass: 'WARRIOR', tier: 1, slot: 'A',
    name: 'Siege Engine', desc: '+30% impact, +30 HP',
    icon: '\u2694', effects: { impactMultBonus: 0.3, maxHpBonus: 30 } },
  { id: 'warrior_t1b', heroClass: 'WARRIOR', tier: 1, slot: 'B',
    name: 'Berserker', desc: '+50% melee, 20% faster',
    icon: '\u2620', effects: { combatDamageMult: 0.5, combatSpeedMult: 0.8 } },
  { id: 'warrior_t2a', heroClass: 'WARRIOR', tier: 2, slot: 'A',
    name: 'Ironclad', desc: '20% damage reduction, +40 HP',
    icon: '\u25c8', effects: { damageReduction: 0.20, maxHpBonus: 40 } },
  { id: 'warrior_t2b', heroClass: 'WARRIOR', tier: 2, slot: 'B',
    name: 'Battering Ram', desc: 'Flatter arc, +50% impact',
    icon: '\u25cf', effects: { gravityScaleBonus: -0.15, impactMultBonus: 0.5 } },

  // ── RANGER ──────────────────────────────────────────────────────────────────
  { id: 'ranger_t1a', heroClass: 'RANGER', tier: 1, slot: 'A',
    name: 'Volley', desc: '+2 arrows on impact',
    icon: '\u219f', effects: { arrowCountBonus: 2 } },
  { id: 'ranger_t1b', heroClass: 'RANGER', tier: 1, slot: 'B',
    name: 'Sharpshooter', desc: '+50% melee, 20% faster',
    icon: '\u2726', effects: { combatDamageMult: 0.5, combatSpeedMult: 0.8 } },
  { id: 'ranger_t2a', heroClass: 'RANGER', tier: 2, slot: 'A',
    name: 'Sniper', desc: '+80% melee, -1 arrow',
    icon: '\u2316', effects: { combatDamageMult: 0.8, arrowCountBonus: -1 } },
  { id: 'ranger_t2b', heroClass: 'RANGER', tier: 2, slot: 'B',
    name: 'Skirmisher', desc: '+50% walk speed, +1 pierce',
    icon: '\u21c9', effects: { walkSpeedMult: 0.5, piercingBonus: 1 } },

  // ── MAGE ────────────────────────────────────────────────────────────────────
  { id: 'mage_t1a', heroClass: 'MAGE', tier: 1, slot: 'A',
    name: 'Cataclysm', desc: '+60px AoE radius',
    icon: '\u25ce', effects: { aoeRadiusBonus: 60 } },
  { id: 'mage_t1b', heroClass: 'MAGE', tier: 1, slot: 'B',
    name: 'Focused Blast', desc: '-30px AoE, +150% impact',
    icon: '\u2739', effects: { aoeRadiusBonus: -30, impactMultBonus: 1.5 } },
  { id: 'mage_t2a', heroClass: 'MAGE', tier: 2, slot: 'A',
    name: 'Chain Master', desc: '+2 chain targets',
    icon: '\u26a1', effects: { chainTargetBonus: 2 } },
  { id: 'mage_t2b', heroClass: 'MAGE', tier: 2, slot: 'B',
    name: 'Bombardier', desc: '+3 bomblets, +30% melee',
    icon: '\u2737', effects: { clusterCountBonus: 3, combatDamageMult: 0.3 } },

  // ── PRIEST ──────────────────────────────────────────────────────────────────
  { id: 'priest_t1a', heroClass: 'PRIEST', tier: 1, slot: 'A',
    name: 'Greater Heal', desc: '+15 heal, +40px radius',
    icon: '\u2665', effects: { healAmountBonus: 15, healRadiusBonus: 40 } },
  { id: 'priest_t1b', heroClass: 'PRIEST', tier: 1, slot: 'B',
    name: 'Battle Priest', desc: '+80% melee, +50% impact',
    icon: '\u2694', effects: { combatDamageMult: 0.8, impactMultBonus: 0.5 } },
  { id: 'priest_t2a', heroClass: 'PRIEST', tier: 2, slot: 'A',
    name: 'Sanctuary', desc: '15% damage reduction, +30px heal radius',
    icon: '\u25c8', effects: { damageReduction: 0.15, healRadiusBonus: 30 } },
  { id: 'priest_t2b', heroClass: 'PRIEST', tier: 2, slot: 'B',
    name: "Martyr's Gift", desc: '+25 heal, -30 HP',
    icon: '\u2721', effects: { healAmountBonus: 25, maxHpBonus: -30 } },

  // ── BARD ────────────────────────────────────────────────────────────────────
  { id: 'bard_t1a', heroClass: 'BARD', tier: 1, slot: 'A',
    name: 'Maestro', desc: '+2s charm, +30px radius',
    icon: '\u266a', effects: { charmDurationBonus: 2000, charmRadiusBonus: 30 } },
  { id: 'bard_t1b', heroClass: 'BARD', tier: 1, slot: 'B',
    name: 'War Drummer', desc: '+40% melee, +20 HP',
    icon: '\u2694', effects: { combatDamageMult: 0.4, maxHpBonus: 20 } },
  { id: 'bard_t2a', heroClass: 'BARD', tier: 2, slot: 'A',
    name: 'Hypnotist', desc: '+3s charm, +40px radius',
    icon: '\u2728', effects: { charmDurationBonus: 3000, charmRadiusBonus: 40 } },
  { id: 'bard_t2b', heroClass: 'BARD', tier: 2, slot: 'B',
    name: 'Anthem', desc: '+30 HP, +30% walk speed',
    icon: '\u266b', effects: { maxHpBonus: 30, walkSpeedMult: 0.3 } },

  // ── ROGUE ───────────────────────────────────────────────────────────────────
  { id: 'rogue_t1a', heroClass: 'ROGUE', tier: 1, slot: 'A',
    name: 'Assassin', desc: '+100% backstab, +30% melee',
    icon: '\u2620', effects: { backstabMult: 1.0, combatDamageMult: 0.3 } },
  { id: 'rogue_t1b', heroClass: 'ROGUE', tier: 1, slot: 'B',
    name: 'Shadow Step', desc: '+2 pierce, +40% walk speed',
    icon: '\u2727', effects: { piercingBonus: 2, walkSpeedMult: 0.4 } },
  { id: 'rogue_t2a', heroClass: 'ROGUE', tier: 2, slot: 'A',
    name: 'Lethal Precision', desc: '35% faster, +50% melee',
    icon: '\u2726', effects: { combatSpeedMult: 0.65, combatDamageMult: 0.5 } },
  { id: 'rogue_t2b', heroClass: 'ROGUE', tier: 2, slot: 'B',
    name: 'Ghost', desc: '25% damage reduction, +1 pierce',
    icon: '\u25c8', effects: { damageReduction: 0.25, piercingBonus: 1 } },

  // ── PALADIN ─────────────────────────────────────────────────────────────────
  { id: 'paladin_t1a', heroClass: 'PALADIN', tier: 1, slot: 'A',
    name: 'Fortress', desc: '+2 shield blocks, +30 HP',
    icon: '\u25a0', effects: { shieldWallBonus: 2, maxHpBonus: 30 } },
  { id: 'paladin_t1b', heroClass: 'PALADIN', tier: 1, slot: 'B',
    name: 'Crusader', desc: '+60% melee, +50% impact',
    icon: '\u2694', effects: { combatDamageMult: 0.6, impactMultBonus: 0.5 } },
  { id: 'paladin_t2a', heroClass: 'PALADIN', tier: 2, slot: 'A',
    name: 'Aegis', desc: '20% damage reduction, +20 HP',
    icon: '\u25c8', effects: { damageReduction: 0.20, maxHpBonus: 20 } },
  { id: 'paladin_t2b', heroClass: 'PALADIN', tier: 2, slot: 'B',
    name: 'Holy Smite', desc: '+100% impact, -1 shield block',
    icon: '\u2739', effects: { impactMultBonus: 1.0, shieldWallBonus: -1 } },

  // ── DRUID ───────────────────────────────────────────────────────────────────
  { id: 'druid_t1a', heroClass: 'DRUID', tier: 1, slot: 'A',
    name: 'Pack Alpha', desc: '+2 wolves, +5 wolf damage',
    icon: '\u25cf', effects: { wolfCountBonus: 2, wolfDamageBonus: 5 } },
  { id: 'druid_t1b', heroClass: 'DRUID', tier: 1, slot: 'B',
    name: 'Earthshaker', desc: '+80% impact, +40% melee',
    icon: '\u25a0', effects: { impactMultBonus: 0.8, combatDamageMult: 0.4 } },
  { id: 'druid_t2a', heroClass: 'DRUID', tier: 2, slot: 'A',
    name: 'Wild Swarm', desc: '+3 wolves, -3 wolf damage',
    icon: '\u25cf', effects: { wolfCountBonus: 3, wolfDamageBonus: -3 } },
  { id: 'druid_t2b', heroClass: 'DRUID', tier: 2, slot: 'B',
    name: 'Ancient Growth', desc: '+40 HP, 10% damage reduction',
    icon: '\u2618', effects: { maxHpBonus: 40, damageReduction: 0.10 } },
];

// ─── Public helpers ────────────────────────────────────────────────────────────

/** Get the two skill choices for a given class and tier. */
export function getSkillOptions(heroClass: HeroClass, tier: 1 | 2): [SkillDef, SkillDef] {
  const a = SKILLS.find(s => s.heroClass === heroClass && s.tier === tier && s.slot === 'A')!;
  const b = SKILLS.find(s => s.heroClass === heroClass && s.tier === tier && s.slot === 'B')!;
  return [a, b];
}

/** Look up a skill by its ID. */
export function getSkillById(id: string): SkillDef | undefined {
  return SKILLS.find(s => s.id === id);
}

/**
 * Merge a list of selected skill IDs into a single additive effect map.
 * Caller provides the selectedSkills array (from RunState's HeroRunData).
 */
export function mergeSkillEffects(selectedSkills: string[]): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const skillId of selectedSkills) {
    const skill = SKILLS.find(s => s.id === skillId);
    if (!skill) continue;
    for (const [key, val] of Object.entries(skill.effects)) {
      merged[key] = (merged[key] ?? 0) + val;
    }
  }
  return merged;
}

