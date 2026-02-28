import Phaser from 'phaser';

// ── Parallax layer system (shared with MainMenuScene) ───────────────────────
export type ParallaxLayer = 'superBg' | 'bg' | 'mid' | 'fg' | 'superFg';

export const LAYER_CFG: Record<ParallaxLayer, { y: number; depth: number; alpha: number }> = {
  superBg: { y: 506, depth: 1, alpha: 0.30 },
  bg:      { y: 520, depth: 2, alpha: 0.50 },
  mid:     { y: 540, depth: 3, alpha: 1.00 },
  fg:      { y: 554, depth: 5, alpha: 0.80 },
  superFg: { y: 564, depth: 6, alpha: 0.60 },
};

export interface CampBuildingDef {
  x: number;
  layer: ParallaxLayer;
  name: string;
  desc: string;
  hitW: number;
  hitH: number;
  maxLevel: number;
  buildFn: (g: Phaser.GameObjects.Graphics, x: number, gy: number, count: number) => void;
}

export interface AlwaysVisibleBuildingDef {
  x: number;
  layer: ParallaxLayer;
  name: string;
  desc: string;
  hitW: number;
  hitH: number;
  buildFn: (g: Phaser.GameObjects.Graphics, x: number, gy: number) => void;
}

// ── Always-visible camp buildings (not upgrade-gated) ───────────────────────
export const CAMP_ALWAYS_VISIBLE: AlwaysVisibleBuildingDef[] = [
  // Watchtower — tall bg layer landmark
  {
    x: 850, layer: 'bg', name: 'Watchtower', desc: 'Keeps watch over the camp perimeter.',
    hitW: 40, hitH: 80,
    buildFn: (g, x, gy) => {
      // Base platform
      g.fillStyle(0x4a3a28, 1);
      g.fillRect(x - 16, gy - 6, 32, 6);
      // Main post
      g.fillStyle(0x5a4020, 1);
      g.fillRect(x - 4, gy - 60, 8, 54);
      // Wood grain
      g.lineStyle(1, 0x4a3418, 0.5);
      g.lineBetween(x - 1, gy - 58, x - 1, gy - 8);
      g.lineBetween(x + 2, gy - 50, x + 2, gy - 12);
      // Platform at top
      g.fillStyle(0x6b5030, 1);
      g.fillRect(x - 14, gy - 66, 28, 8);
      // Railing
      g.lineStyle(2, 0x5a4428, 0.9);
      g.lineBetween(x - 14, gy - 66, x - 14, gy - 78);
      g.lineBetween(x + 14, gy - 66, x + 14, gy - 78);
      g.lineBetween(x - 14, gy - 78, x + 14, gy - 78);
      // Peaked roof
      g.fillStyle(0x8b6914, 1);
      g.fillTriangle(x - 16, gy - 78, x, gy - 92, x + 16, gy - 78);
      // Shadow base
      g.fillStyle(0x000000, 0.15);
      g.fillEllipse(x, gy, 36, 8);
    },
  },
  // Well — fg layer
  {
    x: 640, layer: 'fg', name: 'Well', desc: 'Fresh water for weary heroes.',
    hitW: 44, hitH: 50,
    buildFn: (g, x, gy) => {
      // Shadow
      g.fillStyle(0x000000, 0.12);
      g.fillEllipse(x, gy, 44, 8);
      // Stone base (rounded)
      g.fillStyle(0x5a5a6a, 1);
      g.fillRoundedRect(x - 16, gy - 18, 32, 18, 4);
      g.lineStyle(1, 0x4a4a5a, 0.7);
      g.strokeRoundedRect(x - 16, gy - 18, 32, 18, 4);
      // Stone texture lines
      g.lineStyle(1, 0x4a4a58, 0.4);
      g.lineBetween(x - 14, gy - 10, x + 14, gy - 10);
      // Dark interior
      g.fillStyle(0x1a1a2a, 1);
      g.fillEllipse(x, gy - 18, 24, 6);
      // Wooden arch
      g.lineStyle(3, 0x6b5030, 0.9);
      g.beginPath();
      g.arc(x, gy - 18, 16, Math.PI, 0, false);
      g.strokePath();
      // Arch posts
      g.fillStyle(0x5a4020, 1);
      g.fillRect(x - 18, gy - 20, 4, 14);
      g.fillRect(x + 14, gy - 20, 4, 14);
      // Crossbar
      g.fillStyle(0x6b5030, 1);
      g.fillRect(x - 12, gy - 34, 24, 3);
      // Bucket (tiny)
      g.fillStyle(0x8b6914, 1);
      g.fillRect(x + 2, gy - 30, 6, 8);
      // Rope
      g.lineStyle(1, 0x8a8070, 0.6);
      g.lineBetween(x + 5, gy - 30, x + 5, gy - 34);
    },
  },
  // Weapon Rack — superFg layer
  {
    x: 360, layer: 'superFg', name: 'Weapon Rack', desc: 'Swords and axes, ready for battle.',
    hitW: 46, hitH: 50,
    buildFn: (g, x, gy) => {
      // Shadow
      g.fillStyle(0x000000, 0.12);
      g.fillEllipse(x, gy, 40, 6);
      // Frame posts
      g.fillStyle(0x5a4020, 1);
      g.fillRect(x - 18, gy - 40, 4, 40);
      g.fillRect(x + 14, gy - 40, 4, 40);
      // Crossbars
      g.fillStyle(0x6b5030, 1);
      g.fillRect(x - 18, gy - 40, 36, 3);
      g.fillRect(x - 18, gy - 24, 36, 3);
      // Sword (hanging)
      g.fillStyle(0x8a8a9a, 1);
      g.fillRect(x - 8, gy - 38, 3, 22);
      g.fillStyle(0x6b5030, 1);
      g.fillRect(x - 10, gy - 18, 7, 4);
      // Axe (hanging)
      g.fillStyle(0x7a7a8a, 1);
      g.fillRect(x + 6, gy - 38, 3, 20);
      g.fillStyle(0x6a6a7a, 1);
      g.fillTriangle(x + 4, gy - 34, x + 12, gy - 30, x + 4, gy - 26);
    },
  },
  // Hay Bales — superBg layer
  {
    x: 1100, layer: 'superBg', name: 'Hay Bales', desc: 'Soft bedding and spare fodder.',
    hitW: 50, hitH: 36,
    buildFn: (g, x, gy) => {
      // Shadow
      g.fillStyle(0x000000, 0.1);
      g.fillEllipse(x, gy, 50, 8);
      // Bottom bale
      g.fillStyle(0xb8a040, 1);
      g.fillRoundedRect(x - 20, gy - 16, 40, 16, 3);
      g.lineStyle(1, 0x9a8430, 0.5);
      g.strokeRoundedRect(x - 20, gy - 16, 40, 16, 3);
      // Straw lines
      g.lineStyle(1, 0xa89838, 0.4);
      g.lineBetween(x - 16, gy - 10, x + 16, gy - 10);
      g.lineBetween(x - 14, gy - 6, x + 14, gy - 6);
      // Top bale (offset)
      g.fillStyle(0xc8b048, 1);
      g.fillRoundedRect(x - 14, gy - 28, 30, 14, 3);
      g.lineStyle(1, 0xa89838, 0.5);
      g.strokeRoundedRect(x - 14, gy - 28, 30, 14, 3);
      // Straw wisps sticking out
      g.lineStyle(1, 0xd0c060, 0.6);
      g.lineBetween(x + 18, gy - 14, x + 24, gy - 18);
      g.lineBetween(x - 18, gy - 12, x - 22, gy - 16);
      g.lineBetween(x + 14, gy - 28, x + 18, gy - 34);
    },
  },
  // Tent — mid layer
  {
    x: 460, layer: 'mid', name: 'Tent', desc: 'A lean-to for resting between runs.',
    hitW: 50, hitH: 50,
    buildFn: (g, x, gy) => {
      // Shadow
      g.fillStyle(0x000000, 0.12);
      g.fillEllipse(x, gy, 50, 8);
      // Canvas (triangle lean-to)
      g.fillStyle(0x6a7a5a, 1);
      g.fillTriangle(x - 22, gy, x, gy - 40, x + 22, gy);
      // Canvas edge highlight
      g.lineStyle(1, 0x8a9a7a, 0.6);
      g.lineBetween(x - 22, gy, x, gy - 40);
      // Canvas shadow fold
      g.fillStyle(0x5a6a4a, 1);
      g.fillTriangle(x, gy - 40, x + 22, gy, x + 6, gy);
      // Support pole tip
      g.fillStyle(0x5a4020, 1);
      g.fillRect(x - 2, gy - 44, 4, 8);
      // Opening
      g.fillStyle(0x1a2a1a, 0.7);
      g.fillTriangle(x - 8, gy, x, gy - 18, x + 8, gy);
    },
  },
];

// ── Camp structures — each assigned to a parallax layer ─────────────────────
export const CAMP_STRUCTURES: Record<string, CampBuildingDef> = {
  // Super background — tall distant landmark (Sling Tower)
  launch_power: {
    x: 950, layer: 'superBg',
    name: 'Sling Tower', desc: 'Increases launch power for all heroes.',
    hitW: 36, hitH: 70, maxLevel: 3,
    buildFn: (g, x, gy, count) => {
      // Shadow
      g.fillStyle(0x000000, 0.12);
      g.fillEllipse(x, gy, 30, 6);
      // Base
      g.fillStyle(0x4a3a28, 1);
      g.fillRect(x - 12, gy - 6, 24, 6);
      // Main post
      g.fillStyle(0x6b5030, 1);
      g.fillRect(x - 4, gy - 55, 8, 55);
      // Wood grain
      g.lineStyle(1, 0x5a4020, 0.4);
      g.lineBetween(x - 1, gy - 52, x - 1, gy - 8);
      // Fork arms
      g.fillRect(x - 14, gy - 55, 6, 18);
      g.fillRect(x + 8, gy - 55, 6, 18);
      // Highlight edges
      g.lineStyle(1, 0x8a7040, 0.3);
      g.lineBetween(x - 14, gy - 55, x - 14, gy - 37);
      g.lineBetween(x + 14, gy - 55, x + 14, gy - 37);
      // Elastic bands
      g.lineStyle(2, 0x8b6914, 0.8);
      g.lineBetween(x - 11, gy - 40, x - 2, gy - 28);
      g.lineBetween(x + 11, gy - 40, x + 2, gy - 28);
      if (count >= 2) {
        g.fillStyle(0xa0522d, 1);
        g.fillRect(x - 6, gy - 65, 12, 10);
        g.lineStyle(1, 0x8a4020, 0.5);
        g.strokeRect(x - 6, gy - 65, 12, 10);
      }
    },
  },
  // Background — Market Stall
  gold_gain: {
    x: 700, layer: 'bg',
    name: 'Market Stall', desc: 'Increases gold gain from battles.',
    hitW: 64, hitH: 54, maxLevel: 3,
    buildFn: (g, x, gy, count) => {
      // Shadow
      g.fillStyle(0x000000, 0.1);
      g.fillEllipse(x, gy, 60, 8);
      // Counter
      g.fillStyle(0x6b5030, 1);
      g.fillRect(x - 28, gy - 8, 56, 8);
      g.lineStyle(1, 0x5a4020, 0.5);
      g.lineBetween(x - 26, gy - 4, x + 26, gy - 4);
      // Posts
      g.fillRect(x - 26, gy - 40, 4, 32);
      g.fillRect(x + 22, gy - 40, 4, 32);
      // Wood grain on posts
      g.lineStyle(1, 0x5a4020, 0.3);
      g.lineBetween(x - 24, gy - 38, x - 24, gy - 10);
      g.lineBetween(x + 24, gy - 38, x + 24, gy - 10);
      // Awning
      g.fillStyle(0x27ae60, 0.8);
      g.fillRect(x - 30, gy - 48, 60, 10);
      g.lineStyle(1, 0x1e8e50, 0.5);
      g.lineBetween(x - 30, gy - 43, x + 30, gy - 43);
      // Highlight top edge
      g.lineStyle(1, 0x3abe70, 0.4);
      g.lineBetween(x - 30, gy - 48, x + 30, gy - 48);
      if (count >= 2) {
        g.fillStyle(0xf1c40f, 0.8);
        g.fillCircle(x - 8, gy - 14, 4);
        g.fillCircle(x + 8, gy - 14, 4);
        g.fillStyle(0xd4a810, 0.6);
        g.fillCircle(x, gy - 14, 3);
      }
    },
  },
  // Background — Altar
  starting_relic: {
    x: 400, layer: 'bg',
    name: 'Altar', desc: 'Begin each run with a random relic.',
    hitW: 44, hitH: 44, maxLevel: 1,
    buildFn: (g, x, gy, count) => {
      // Shadow
      g.fillStyle(0x000000, 0.1);
      g.fillEllipse(x, gy, 44, 6);
      // Stone block
      g.fillStyle(0x5a5a6a, 1);
      g.fillRect(x - 14, gy - 30, 28, 30);
      // Stone texture
      g.lineStyle(1, 0x4a4a5a, 0.4);
      g.lineBetween(x - 12, gy - 18, x + 12, gy - 18);
      g.lineBetween(x - 10, gy - 10, x + 10, gy - 10);
      // Base step
      g.fillRect(x - 20, gy - 6, 40, 6);
      g.lineStyle(1, 0x4a4a5a, 0.3);
      g.strokeRect(x - 20, gy - 6, 40, 6);
      // Purple top trim
      g.fillStyle(0x8e44ad, 0.8);
      g.fillRect(x - 18, gy - 36, 36, 6);
      // Highlight
      g.lineStyle(1, 0xa854cd, 0.4);
      g.lineBetween(x - 18, gy - 36, x + 18, gy - 36);
      if (count >= 1) {
        g.fillStyle(0xc89ef0, 0.7);
        g.fillCircle(x, gy - 44, 5);
        // Glow
        g.fillStyle(0xc89ef0, 0.15);
        g.fillCircle(x, gy - 44, 12);
      }
    },
  },
  // Foreground — Training Dummy
  hp_boost: {
    x: 500, layer: 'fg',
    name: 'Training Dummy', desc: 'Increases hero max HP.',
    hitW: 40, hitH: 64, maxLevel: 3,
    buildFn: (g, x, gy, count) => {
      // Shadow
      g.fillStyle(0x000000, 0.12);
      g.fillEllipse(x, gy, 30, 6);
      // Post
      g.fillStyle(0x6b5030, 1);
      g.fillRect(x - 3, gy - 50, 6, 50);
      // Wood grain
      g.lineStyle(1, 0x5a4020, 0.4);
      g.lineBetween(x, gy - 48, x, gy - 4);
      // Crossbar (arms)
      g.fillRect(x - 18, gy - 40, 36, 8);
      g.lineStyle(1, 0x5a4020, 0.3);
      g.lineBetween(x - 16, gy - 36, x + 16, gy - 36);
      // Head
      g.fillStyle(0x8a6842, 1);
      g.fillCircle(x, gy - 58, 10);
      g.lineStyle(1, 0x7a5832, 0.4);
      g.strokeCircle(x, gy - 58, 10);
      if (count >= 2) {
        g.fillStyle(0x993333, 0.6);
        g.fillCircle(x, gy - 36, 6);
      }
      if (count >= 3) {
        g.fillStyle(0xcc4444, 0.7);
        g.fillCircle(x, gy - 36, 4);
      }
    },
  },
  // Foreground — Supply Crates
  starting_gold: {
    x: 820, layer: 'fg',
    name: 'Supply Crates', desc: 'Start each run with bonus gold.',
    hitW: 40, hitH: 52, maxLevel: 3,
    buildFn: (g, x, gy, count) => {
      // Shadow
      g.fillStyle(0x000000, 0.12);
      g.fillEllipse(x, gy, 38, 6);
      // Bottom crate
      g.fillStyle(0x8b6914, 1);
      g.fillRect(x - 16, gy - 20, 32, 20);
      g.lineStyle(1, 0x5a4410, 1);
      g.strokeRect(x - 16, gy - 20, 32, 20);
      // Wood grain
      g.lineStyle(1, 0x7a5a10, 0.3);
      g.lineBetween(x - 14, gy - 12, x + 14, gy - 12);
      // Metal band
      g.lineStyle(1, 0x6a6a7a, 0.5);
      g.lineBetween(x - 16, gy - 16, x + 16, gy - 16);
      if (count >= 2) {
        g.fillStyle(0x9b7924, 1);
        g.fillRect(x - 10, gy - 36, 24, 16);
        g.lineStyle(1, 0x5a4410, 1);
        g.strokeRect(x - 10, gy - 36, 24, 16);
        g.lineStyle(1, 0x8a6a18, 0.3);
        g.lineBetween(x - 8, gy - 28, x + 12, gy - 28);
      }
      if (count >= 3) {
        g.fillStyle(0xa88a34, 1);
        g.fillRect(x - 6, gy - 48, 18, 12);
        g.lineStyle(1, 0x5a4410, 1);
        g.strokeRect(x - 6, gy - 48, 18, 12);
      }
    },
  },
  // Super foreground — Forge
  damage_bonus: {
    x: 1060, layer: 'superFg',
    name: 'Forge', desc: 'Increases damage dealt by all heroes.',
    hitW: 46, hitH: 40, maxLevel: 3,
    buildFn: (g, x, gy, count) => {
      // Shadow
      g.fillStyle(0x000000, 0.12);
      g.fillEllipse(x, gy, 44, 6);
      // Anvil base
      g.fillStyle(0x5a5a6a, 1);
      g.fillRect(x - 20, gy - 24, 40, 24);
      g.lineStyle(1, 0x3a3a4a, 1);
      g.strokeRect(x - 20, gy - 24, 40, 24);
      // Metal texture
      g.lineStyle(1, 0x4a4a5a, 0.3);
      g.lineBetween(x - 18, gy - 14, x + 18, gy - 14);
      // Anvil top
      g.fillStyle(0x7a7a8a, 1);
      g.fillRect(x - 10, gy - 32, 20, 8);
      g.lineStyle(1, 0x8a8a9a, 0.4);
      g.lineBetween(x - 10, gy - 32, x + 10, gy - 32);
      if (count >= 2) {
        g.fillStyle(0xe67e22, 0.7);
        g.fillCircle(x + 16, gy - 30, 5);
      }
      if (count >= 3) {
        g.fillStyle(0xff4444, 0.5);
        g.fillCircle(x + 16, gy - 30, 8);
        g.fillStyle(0xff6644, 0.3);
        g.fillCircle(x + 16, gy - 30, 12);
      }
    },
  },
};
