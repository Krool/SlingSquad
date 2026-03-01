// ─── Game Dimensions ─────────────────────────────────────────────────────────
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// ─── Launch System ────────────────────────────────────────────────────────────
export const LAUNCH_COOLDOWN_MS = 1000;
export const SLING_X = 160;
export const SLING_Y = 510;
export const MAX_DRAG_DISTANCE = 190;
// Velocity = dist_px * MULTIPLIER → px/frame. No *60.
// At max drag (190px) 45°: ~14.8 px/frame, lands at ~x=1490 (structures stop it sooner)
// At max drag 70° steep arc: lands at ~x=957 (can clear tall structures and still reach far enemies)
// Structure templates keep rightmost enemies ≤ x≈950 for comfortable margin
export const LAUNCH_POWER_MULTIPLIER = 0.11;
export const TRAJECTORY_POINTS = 25; // dots to draw
export const TRAJECTORY_SIM_FRAMES = 220; // total frames to simulate per preview
export const TRAJECTORY_DOT_EVERY = 6;  // draw a dot every N simulated frames

// ─── Physics constants (must match main.ts gravity config) ────────────────────
// Matter.js: velocity_change = gravity.y * scale(0.001) * deltaTimeSquared
// deltaTimeSquared = (1000/60)² ≈ 277.9 → gravity.y=1.08 gives 0.3 px/step²
export const GRAVITY_PER_FRAME = 0.3;
export const HERO_FRICTION_AIR = 0.003; // low air drag = projectile travels far (matches Hero body)

// ─── Sling Interaction ───────────────────────────────────────────────────────
export const SLING_ACTIVATION_RADIUS = 130;

// ─── Anti-Stall Timer ─────────────────────────────────────────────────────────
export const STALL_TIMEOUT_MS = 10000;
export const STALL_WARN_MS = 5000;

// ─── Squad ────────────────────────────────────────────────────────────────────
export const STARTER_SQUAD_SIZE = 4;
export const MAX_SQUAD_SIZE = 6;

// ─── Combat vs Blocks ────────────────────────────────────────────────────────
// Melee combat damage is multiplied by this when hitting blocks (both heroes & enemies)
export const MELEE_BLOCK_DAMAGE_MULT = 4;

// ─── Physics Materials ────────────────────────────────────────────────────────
export const MATERIAL = {
  WOOD: {
    density: 0.0008,   // lighter → gets knocked further
    restitution: 0.05,
    friction: 0.4,
    frictionStatic: 2.0,  // prevents lateral sliding under load
    frictionAir: 0.01,
    slop: 0.01,           // tighter collision tolerance (default 0.05)
    hp: 55,
    label: 'WOOD',
  },
  STONE: {
    density: 0.003,    // heavier → stays put unless hit hard, crushes below
    restitution: 0.08,
    friction: 0.65,
    frictionStatic: 3.0,  // high static friction for heavy stone
    frictionAir: 0.008,
    slop: 0.01,
    hp: 130,
    label: 'STONE',
  },
  ICE: {
    density: 0.0012,    // between wood and stone
    restitution: 0.12,  // slightly bouncy — slippery surface
    friction: 0.05,     // very slippery!
    frictionStatic: 0.2,
    frictionAir: 0.008,
    slop: 0.01,
    hp: 40,             // fragile — shatters easily for cascade collapses
    label: 'ICE',
  },
  OBSIDIAN: {
    density: 0.004,     // heaviest — extremely tough
    restitution: 0.06,
    friction: 0.8,
    frictionStatic: 4.0, // very high — doesn't budge
    frictionAir: 0.006,
    slop: 0.01,
    hp: 180,            // toughest material — requires barrel combos or Mage AoE
    label: 'OBSIDIAN',
  },
} as const;
export type MaterialType = keyof typeof MATERIAL;

// ─── Hero Stats ───────────────────────────────────────────────────────────────
export const HERO_STATS = {
  WARRIOR: {
    hp: 120,
    mass: 3.5,
    impactDamageBonus: 1.4,    // multiplier for all blocks on impact
    impactMultiplier: 1.0,
    combatDamage: 18,
    combatRange: 80,
    combatSpeed: 500,           // ms between attacks
    walkSpeed: 0.7,             // px/frame while in combat
    color: 0xc0392b,
    radius: 24,
    gravityScale: 0.55,         // battering ram — flatter trajectory (45% gravity cancelled)
    label: 'Warrior',
  },
  RANGER: {
    hp: 80,
    mass: 2.0,
    arrowCount: 3,
    arrowDamage: 25,
    arrowSpeed: 900,
    impactMultiplier: 1.0,
    combatDamage: 12,
    combatRange: 240,
    combatSpeed: 600,
    walkSpeed: 1.4,
    color: 0x27ae60,
    radius: 20,
    splitCount: 2,              // 2 flanking arrow projectiles on launch (+ hero body = 3)
    splitSpreadDeg: 10,         // angle offset from main trajectory
    splitDamage: 20,            // damage per flanking arrow
    label: 'Ranger',
  },
  MAGE: {
    hp: 70,
    mass: 1.8,
    aoeRadius: 150,
    aoeDamage: 55,
    impactMultiplier: 3.0,
    combatDamage: 14,
    combatRange: 200,
    combatSpeed: 700,
    walkSpeed: 0.9,
    color: 0x8e44ad,
    radius: 20,
    clusterCount: 5,            // bomblets spawned on impact
    clusterDamage: 18,          // damage per bomblet hit
    label: 'Mage',
  },
  PRIEST: {
    hp: 90,
    mass: 1.8,
    healAmount: 25,
    healRadius: 120,
    combatDamage: 8,
    combatRange: 100,
    impactMultiplier: 0.5,
    combatSpeed: 800,
    walkSpeed: 0.6,
    color: 0xf39c12,
    radius: 20,
    label: 'Priest',
  },
  BARD: {
    hp: 75,
    mass: 2.0,
    charmRadius: 100,
    charmDurationMs: 3000,
    auraRadius: 100,
    auraSpeedBoost: 0.20,      // 20% faster attack speed for nearby allies
    impactMultiplier: 0.8,
    combatDamage: 6,
    combatRange: 120,
    combatSpeed: 700,
    walkSpeed: 0.8,
    color: 0x1abc9c,
    radius: 19,
    label: 'Bard',
  },
  ROGUE: {
    hp: 65,
    mass: 1.6,
    piercing: true,                // continues flying through first block hit
    combatDamage: 22,
    combatRange: 70,
    combatSpeed: 400,              // fast attacks
    walkSpeed: 1.8,
    impactMultiplier: 0.8,
    color: 0x2c3e50,
    radius: 18,
    label: 'Rogue',
  },
  PALADIN: {
    hp: 130,
    mass: 3.8,
    shieldWallBlocks: 3,           // spawns 3 temporary blocks on impact
    combatDamage: 14,
    combatRange: 80,
    combatSpeed: 600,
    walkSpeed: 0.5,
    impactMultiplier: 1.2,
    damageReduction: 0.25,         // takes 25% less combat damage
    color: 0xf1c40f,
    radius: 23,
    label: 'Paladin',
  },
  DRUID: {
    hp: 75,
    mass: 2.0,
    wolfCount: 2,                  // spawns 2 wolf minions on impact
    wolfDamage: 10,
    wolfHp: 30,
    combatDamage: 8,
    combatRange: 100,
    combatSpeed: 700,
    walkSpeed: 0.7,
    impactMultiplier: 1.0,
    color: 0x16a085,
    radius: 22,
    label: 'Druid',
  },
} as const;
export type HeroClass = keyof typeof HERO_STATS;

// ─── Hero Passives ──────────────────────────────────────────────────────────
export const HERO_PASSIVES: Record<string, { name: string; desc: string }> = {
  WARRIOR:  { name: 'Vanguard',           desc: 'First hero launched deals +25% impact damage.' },
  RANGER:   { name: 'Eagle Eye',          desc: 'Trajectory preview shows 30% more dots.' },
  MAGE:     { name: 'Arcane Instability', desc: 'Destroyed blocks near Mage have 20% chance to explode.' },
  PRIEST:   { name: 'Martyr',             desc: 'When Priest dies, heals all living heroes for 15.' },
  BARD:     { name: 'Encore',             desc: 'If Bard gets a kill, next hero launches with +15% power.' },
  ROGUE:    { name: 'Backstab',           desc: 'Deals 2x damage to enemies facing away.' },
  PALADIN:  { name: 'Divine Shield',      desc: 'Survives one lethal hit at 1 HP per battle.' },
  DRUID:    { name: 'Nature\'s Wrath',    desc: 'Wood blocks take +30% impact damage.' },
};

// ─── Enemy Stats ──────────────────────────────────────────────────────────────
export const ENEMY_STATS = {
  GRUNT: {
    hp: 80,
    combatDamage: 12,
    combatRange: 70,
    combatSpeed: 600,
    aggroRange: 200,
    color: 0xe74c3c,
    radius: 20,
    label: 'Grunt',
  },
  RANGED: {
    hp: 45,
    combatDamage: 10,
    combatRange: 280,
    combatSpeed: 1200,
    aggroRange: 350,
    projectileSpeed: 400,
    color: 0xe67e22,
    radius: 16,
    label: 'Archer',
  },
  SHIELD: {
    hp: 120,
    combatDamage: 8,
    combatRange: 70,
    combatSpeed: 700,
    aggroRange: 180,
    color: 0x3498db,
    radius: 22,
    label: 'Shieldwall',
    frontDamageReduction: 0.5, // takes 50% reduced impact from the front (left side)
  },
  BOMBER: {
    hp: 50,
    combatDamage: 8,
    combatRange: 40,
    combatSpeed: 800,
    aggroRange: 250,
    color: 0x9b59b6,
    radius: 16,
    label: 'Bomber',
    explosionRadius: 90,
    explosionDamage: 45,
    rushSpeed: 1.8,            // px/frame when rushing toward hero
  },
  HEALER: {
    hp: 40,
    combatDamage: 0,
    combatRange: 60,
    combatSpeed: 2000,         // heal tick interval
    aggroRange: 300,
    color: 0x2ecc71,
    radius: 16,
    label: 'Cleric',
    healAmount: 12,
    healRange: 150,
  },
  BOSS_GRUNT: {
    hp: 160,
    combatDamage: 18,
    combatRange: 80,
    combatSpeed: 550,
    aggroRange: 220,
    color: 0xc0392b,
    radius: 24,
    label: 'Warchief',
  },
  // ── Frozen Peaks enemies ──
  ICE_MAGE: {
    hp: 55,
    combatDamage: 12,
    combatRange: 250,
    combatSpeed: 1100,
    aggroRange: 320,
    color: 0x74b9ff,
    radius: 16,
    label: 'Frost Mage',
    projectileSpeed: 350,
    slowDuration: 2000,            // slows hero attack speed for 2s on hit
  },
  YETI: {
    hp: 180,
    combatDamage: 20,
    combatRange: 80,
    combatSpeed: 800,
    aggroRange: 160,
    color: 0xdfe6e9,
    radius: 26,
    label: 'Yeti',
  },
  FROST_ARCHER: {
    hp: 40,
    combatDamage: 14,
    combatRange: 300,
    combatSpeed: 1000,
    aggroRange: 380,
    projectileSpeed: 450,
    color: 0xa29bfe,
    radius: 16,
    label: 'Frost Archer',
  },
  // ── Infernal Keep enemies ──
  FIRE_IMP: {
    hp: 35,
    combatDamage: 6,
    combatRange: 40,
    combatSpeed: 600,
    aggroRange: 280,
    color: 0xfd79a8,
    radius: 14,
    label: 'Fire Imp',
    explosionRadius: 70,
    explosionDamage: 30,
    rushSpeed: 2.2,                // suicide rusher
  },
  DEMON_KNIGHT: {
    hp: 140,
    combatDamage: 16,
    combatRange: 75,
    combatSpeed: 550,
    aggroRange: 200,
    color: 0xd63031,
    radius: 22,
    label: 'Demon Knight',
    thornsReflect: 0.15,           // reflects 15% of damage taken back to attacker
  },
  INFERNAL_BOSS: {
    hp: 250,
    combatDamage: 22,
    combatRange: 90,
    combatSpeed: 500,
    aggroRange: 250,
    color: 0x6c5ce7,
    radius: 28,
    label: 'Infernal Lord',
  },
} as const;
export type EnemyClass = keyof typeof ENEMY_STATS;

// ─── Barrel ───────────────────────────────────────────────────────────────────
export const BARREL_EXPLOSION_RADIUS = 120;
export const BARREL_EXPLOSION_DAMAGE = 70;
export const BARREL_HP = 30;
export const BARREL_EXPLOSION_FORCE = 0.12;

// ─── Hazards ─────────────────────────────────────────────────────────────────
export const HAZARD = {
  SPIKE_TRAP: {
    damage: 20,         // contact damage to heroes
    width: 50,
    height: 20,
    destroyable: true,  // can be broken by impact
    hp: 40,
  },
  ICE_PATCH: {
    width: 80,
    height: 10,
    frictionOverride: 0.02,  // near-zero friction on overlap
  },
  LAVA_PIT: {
    damage: 8,          // DoT per tick
    tickMs: 500,        // damage tick interval
    width: 70,
    height: 16,
    radius: 40,         // damage area extends beyond visual
  },
  FIRE_GEYSER: {
    damage: 35,
    radius: 60,
    eruptIntervalMin: 3000,
    eruptIntervalMax: 4000,
    eruptDuration: 400,
    ventWidth: 24,
    ventHeight: 12,
  },
} as const;

// ─── Combat System ────────────────────────────────────────────────────────────
export const COMBAT_TICK_MS = 500;

// ── Combat Walking AI ────────────────────────────────────────────────────────
export const HERO_WALK_BLOCK_LOOKAHEAD = 55;
export const HERO_WALK_VERT_TOLERANCE = 45;
export const HERO_WALK_STUCK_BLOCK_MS = 3000;
export const HERO_WALK_STUCK_MOVE_THRESHOLD = 0.5;
export const HERO_WALK_STUCK_FLIP_MS = 1500;
export const NON_WARRIOR_BLOCK_RANGE_CAP = 140;

// ── Combat Modifiers ─────────────────────────────────────────────────────────
export const SLOW_SPEED_PENALTY = 1.5;
export const LOW_HP_THRESHOLD = 0.30;
export const POISON_TICK_MS = 1000;
export const POISON_TICK_COUNT = 2;  // repeat param = 2 means 3 ticks total

// ─── Impact System ───────────────────────────────────────────────────────────
export const IMPACT_FORCE_CAP = 70;
export const IMPACT_FORCE_FLOOR = 20;
export const IMPACT_FORCE_MULT = 0.4;
export const IMPACT_RADIUS_WARRIOR = 80;
export const IMPACT_RADIUS_RANGER = 70;
export const IMPACT_RADIUS_PRIEST = 90;
export const IMPACT_RADIUS_ROGUE = 60;
export const IMPACT_RADIUS_PALADIN = 80;
export const IMPACT_RADIUS_DRUID = 70;
export const CHAIN_LIGHTNING_DAMAGE_MULT = 0.5;
export const BLOCK_CRUSH_SPEED_THRESHOLD = 0.8;
export const BLOCK_CRUSH_RADIUS = 55;
export const BLOCK_CRUSH_DAMAGE = 40;

// ─── Hero Physics ────────────────────────────────────────────────────────────
export const HERO_RESTITUTION_RANGER = 0.72;
export const HERO_RESTITUTION_DEFAULT = 0.25;
export const HERO_COMBAT_FRICTION_AIR = 0.07;
export const HERO_COMBAT_FRICTION = 0.9;

// ─── UI ───────────────────────────────────────────────────────────────────────
export const PORTRAIT_SIZE = 64;
export const PORTRAIT_PADDING = 8;
export const HUD_BAR_HEIGHT = 80;

// ─── Camp / Main Menu ────────────────────────────────────────────────────────
export const CAMP_SHOOTING_STAR_MIN_INTERVAL = 4000;
export const CAMP_SHOOTING_STAR_MAX_INTERVAL = 10000;
export const CAMP_SHOOTING_STAR_COLOR = 0xccddff;

// ─── Hero Revive ────────────────────────────────────────────────────────────
export const REVIVE_COOLDOWN_NODES = 2;   // base nodes a dead hero must wait (1st death)
export const REVIVE_HP_PERCENT = 0.5;     // fraction of maxHp on revive

// ─── Hero Regen ─────────────────────────────────────────────────────────────
export const HERO_REGEN_PERCENT = 0.10;   // fraction of maxHp healed after every node

// ─── Multi-Floor Runs ────────────────────────────────────────────────────────
export const TOTAL_FLOORS_PER_RUN = 3;

// ─── Skill Tree ────────────────────────────────────────────────────────
export const SKILL_TIER1_BATTLES = 2;   // battles won to unlock tier 1
export const SKILL_TIER2_BATTLES = 5;   // battles won to unlock tier 2

// ─── Safe Area (dynamic island / notch buffer) ──────────────────────────
export const SAFE_AREA_LEFT = 50;
