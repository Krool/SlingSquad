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
  buildFn: (g: Phaser.GameObjects.Graphics, x: number, gy: number, count: number) => void;
}

// ── Camp structures — each assigned to a parallax layer ─────────────────────
export const CAMP_STRUCTURES: Record<string, CampBuildingDef> = {
  // Super background — tall distant landmark
  launch_power: {
    x: 950, layer: 'superBg',
    buildFn: (g, x, gy, count) => {
      g.fillStyle(0x6b5030, 1);
      g.fillRect(x - 4, gy - 55, 8, 55);
      g.fillRect(x - 14, gy - 55, 6, 18);
      g.fillRect(x + 8, gy - 55, 6, 18);
      g.fillRect(x - 12, gy - 6, 24, 6);
      g.lineStyle(2, 0x8b6914, 0.8);
      g.lineBetween(x - 11, gy - 40, x - 2, gy - 28);
      g.lineBetween(x + 11, gy - 40, x + 2, gy - 28);
      if (count >= 2) { g.fillStyle(0xa0522d, 1); g.fillRect(x - 6, gy - 65, 12, 10); }
    },
  },
  // Background — medium distance buildings
  gold_gain: {
    x: 700, layer: 'bg',
    buildFn: (g, x, gy, count) => {
      g.fillStyle(0x6b5030, 1);
      g.fillRect(x - 28, gy - 8, 56, 8);
      g.fillRect(x - 26, gy - 40, 4, 32);
      g.fillRect(x + 22, gy - 40, 4, 32);
      g.fillStyle(0x27ae60, 0.8);
      g.fillRect(x - 30, gy - 48, 60, 10);
      if (count >= 2) { g.fillStyle(0xf1c40f, 0.8); g.fillCircle(x - 8, gy - 14, 4); g.fillCircle(x + 8, gy - 14, 4); }
    },
  },
  starting_relic: {
    x: 400, layer: 'bg',
    buildFn: (g, x, gy, count) => {
      g.fillStyle(0x5a5a6a, 1);
      g.fillRect(x - 14, gy - 30, 28, 30);
      g.fillRect(x - 20, gy - 6, 40, 6);
      g.fillStyle(0x8e44ad, 0.8);
      g.fillRect(x - 18, gy - 36, 36, 6);
      if (count >= 1) { g.fillStyle(0xc89ef0, 0.7); g.fillCircle(x, gy - 44, 5); }
    },
  },
  // Foreground — close structures
  hp_boost: {
    x: 500, layer: 'fg',
    buildFn: (g, x, gy, count) => {
      g.fillStyle(0x6b5030, 1);
      g.fillRect(x - 3, gy - 50, 6, 50);
      g.fillRect(x - 18, gy - 40, 36, 8);
      g.fillStyle(0x8a6842, 1);
      g.fillCircle(x, gy - 58, 10);
      if (count >= 2) { g.fillStyle(0x993333, 0.6); g.fillCircle(x, gy - 36, 6); }
      if (count >= 3) { g.fillStyle(0xcc4444, 0.7); g.fillCircle(x, gy - 36, 4); }
    },
  },
  starting_gold: {
    x: 820, layer: 'fg',
    buildFn: (g, x, gy, count) => {
      g.fillStyle(0x8b6914, 1);
      g.fillRect(x - 16, gy - 20, 32, 20);
      g.lineStyle(1, 0x5a4410, 1);
      g.strokeRect(x - 16, gy - 20, 32, 20);
      if (count >= 2) { g.fillStyle(0x9b7924, 1); g.fillRect(x - 10, gy - 36, 24, 16); g.strokeRect(x - 10, gy - 36, 24, 16); }
      if (count >= 3) { g.fillStyle(0xa88a34, 1); g.fillRect(x - 6, gy - 48, 18, 12); g.strokeRect(x - 6, gy - 48, 18, 12); }
    },
  },
  // Super foreground — nearest props
  damage_bonus: {
    x: 1060, layer: 'superFg',
    buildFn: (g, x, gy, count) => {
      g.fillStyle(0x5a5a6a, 1);
      g.fillRect(x - 20, gy - 24, 40, 24);
      g.lineStyle(1, 0x3a3a4a, 1);
      g.strokeRect(x - 20, gy - 24, 40, 24);
      g.fillStyle(0x7a7a8a, 1);
      g.fillRect(x - 10, gy - 32, 20, 8);
      if (count >= 2) { g.fillStyle(0xe67e22, 0.7); g.fillCircle(x + 16, gy - 30, 5); }
      if (count >= 3) { g.fillStyle(0xff4444, 0.5); g.fillCircle(x + 16, gy - 30, 8); }
    },
  },
};
