// ─── Zone Visual Themes ──────────────────────────────────────────────────────
// Defines sky colors, ground colors, particle types, celestial bodies, and
// decorative background elements for each zone.

export interface ZoneTheme {
  // Sky gradient
  skyColor: number;
  skyLowerColor: number;  // lower sky / horizon band
  skyGradient?: { color: number; stop: number }[];  // multi-stop sky (replaces 2-flat-band)
  // Horizon haze
  horizonHaze?: { color: number; yStart: number; yEnd: number; peakAlpha: number };
  // Ground
  groundColor: number;
  grassColor: number;
  soilColor: number;
  groundDetail?: {
    tufts: { color: number; count: number; height: number; width: number }[];
    cracks?: { color: number; glowColor: number; count: number };
  };
  // Hill
  hillGrassColor: number;
  // Celestial body
  celestial: 'crescent_moon' | 'pale_moon' | 'blood_moon';
  celestialColor: number;
  celestialGlow?: { color: number; radius: number; alpha: number; rays?: number };
  // Floating particle style
  particleType: 'firefly' | 'snowflake' | 'ember';
  particleColors: number[];
  // Shooting star color
  shootingStarColor: number;
  // Background decorative elements
  bgElements: BgElementDef[];
}

export interface BgElementDef {
  type: 'tree_silhouette' | 'mountain_peak' | 'volcanic_peak' | 'pine_silhouette'
    | 'campfire' | 'stake_fence' | 'aurora' | 'lava_flow' | 'smoke_column' | 'ice_sheen'
    | 'ridgeline' | 'treeline' | 'ruined_tower' | 'broken_wall' | 'ice_formation'
    | 'glacier_cliff' | 'jagged_crag' | 'ruined_citadel' | 'fog_wisp'
    | 'ground_mushroom' | 'snow_drift' | 'icicle_edge' | 'ash_cloud' | 'lava_crack';
  x: number;
  y: number;
  scale?: number;
  color?: number;
  alpha?: number;
  layer?: 'far' | 'mid' | 'near';
  width?: number;
}

// ─── Theme Definitions ──────────────────────────────────────────────────────

const goblinTheme: ZoneTheme = {
  skyColor: 0x1a1a3e,
  skyLowerColor: 0x2d1b35,
  skyGradient: [
    { color: 0x0d0d28, stop: 0 },      // deep navy zenith
    { color: 0x1a1a3e, stop: 0.35 },    // mid purple
    { color: 0x2d1b35, stop: 0.65 },    // warm purple
    { color: 0x3a2540, stop: 1.0 },     // purple-haze horizon
  ],
  horizonHaze: { color: 0x2a3520, yStart: 420, yEnd: 560, peakAlpha: 0.12 },
  groundColor: 0x2d5a1b,
  grassColor: 0x3d7a28,
  soilColor: 0x4a3010,
  groundDetail: {
    tufts: [
      { color: 0x3d7a28, count: 30, height: 8, width: 2 },
      { color: 0x1a3a0e, count: 15, height: 6, width: 2 },
    ],
  },
  hillGrassColor: 0x3d7a28,
  celestial: 'crescent_moon',
  celestialColor: 0xe8d5a3,
  celestialGlow: { color: 0xe8d5a3, radius: 55, alpha: 0.08 },
  particleType: 'firefly',
  particleColors: [0x88ff88, 0x66ee66, 0xaaff77],
  shootingStarColor: 0xccddff,
  bgElements: [
    // Far layer — distant ridgelines + ruined tower
    { type: 'ridgeline', x: 0, y: 360, width: 1280, scale: 1.0, color: 0x0d0d1a, alpha: 0.4, layer: 'far' },
    { type: 'ridgeline', x: 0, y: 400, width: 1280, scale: 0.8, color: 0x121220, alpha: 0.5, layer: 'far' },
    { type: 'ruined_tower', x: 950, y: 350, scale: 0.7, color: 0x0f0f1c, alpha: 0.35, layer: 'far' },
    // Mid layer — main silhouettes
    { type: 'tree_silhouette', x: 500, y: 440, scale: 0.8, color: 0x0d0d18 },
    { type: 'tree_silhouette', x: 1100, y: 440, scale: 0.9, color: 0x0d0d18 },
    { type: 'tree_silhouette', x: 1200, y: 430, scale: 1.0, color: 0x0b0b16 },
    { type: 'stake_fence', x: 200, y: 510, color: 0x1a1008 },
    { type: 'broken_wall', x: 750, y: 490, scale: 1.0, color: 0x1a1510, alpha: 0.5 },
    { type: 'fog_wisp', x: 300, y: 470, scale: 1.0, color: 0x334433, alpha: 0.1 },
    { type: 'fog_wisp', x: 900, y: 490, scale: 0.8, color: 0x334433, alpha: 0.08 },
    { type: 'campfire', x: 50, y: 600, color: 0xff8844 },
    { type: 'ground_mushroom', x: 620, y: 530, scale: 1.0, color: 0x664422 },
    { type: 'ground_mushroom', x: 1050, y: 540, scale: 0.7, color: 0x553318 },
    // Near layer — large framing trees
    { type: 'tree_silhouette', x: 30, y: 400, scale: 1.6, color: 0x060610, alpha: 0.7, layer: 'near' },
    { type: 'tree_silhouette', x: 1250, y: 410, scale: 1.4, color: 0x060610, alpha: 0.7, layer: 'near' },
  ],
};

const frozenTheme: ZoneTheme = {
  skyColor: 0x0a1a2e,
  skyLowerColor: 0x1a2a40,
  skyGradient: [
    { color: 0x050e1a, stop: 0 },      // black-blue zenith
    { color: 0x0a1a2e, stop: 0.3 },    // deep blue
    { color: 0x1a2a40, stop: 0.6 },    // cold steel
    { color: 0x2a3a55, stop: 1.0 },    // pale icy glow
  ],
  horizonHaze: { color: 0xaabbcc, yStart: 400, yEnd: 540, peakAlpha: 0.15 },
  groundColor: 0x8ba8c4,
  grassColor: 0x9bbbd8,
  soilColor: 0x5a7a90,
  groundDetail: {
    tufts: [
      { color: 0xc8dae8, count: 25, height: 5, width: 3 },   // snow bumps
      { color: 0x88aacc, count: 10, height: 3, width: 2 },    // ice chips
    ],
  },
  hillGrassColor: 0x9bbbd8,
  celestial: 'pale_moon',
  celestialColor: 0xd8e8ff,
  celestialGlow: { color: 0xd8e8ff, radius: 60, alpha: 0.12, rays: 12 },
  particleType: 'snowflake',
  particleColors: [0xeeeeff, 0xddeeff, 0xffffff],
  shootingStarColor: 0xaaccff,
  bgElements: [
    // Far layer — distant ridgelines
    { type: 'ridgeline', x: 0, y: 320, width: 1280, scale: 1.2, color: 0x0a1520, alpha: 0.35, layer: 'far' },
    { type: 'ridgeline', x: 0, y: 370, width: 1280, scale: 0.9, color: 0x0f1a28, alpha: 0.45, layer: 'far' },
    // Mid layer
    { type: 'mountain_peak', x: 80, y: 300, scale: 1.5, color: 0x1a2a3a },
    { type: 'mountain_peak', x: 250, y: 340, scale: 1.1, color: 0x1e2e3e },
    { type: 'glacier_cliff', x: 400, y: 420, scale: 1.0, color: 0x1a2838, alpha: 0.5 },
    { type: 'ice_formation', x: 550, y: 470, scale: 0.9, color: 0x4488aa, alpha: 0.4 },
    { type: 'pine_silhouette', x: 1050, y: 440, scale: 0.8, color: 0x0a1520 },
    { type: 'pine_silhouette', x: 1150, y: 420, scale: 1.0, color: 0x0c1825 },
    { type: 'pine_silhouette', x: 1220, y: 445, scale: 0.7, color: 0x0b1622 },
    { type: 'aurora', x: 640, y: 80, scale: 1.0, color: 0x44ffaa },
    { type: 'snow_drift', x: 0, y: 540, width: 1280, color: 0xbbccdd, alpha: 0.15 },
    { type: 'icicle_edge', x: 0, y: 520, width: 1280, color: 0x88aacc, alpha: 0.2 },
    { type: 'ice_sheen', x: 640, y: 615, color: 0x88ccff },
    // Near layer — foreground framing
    { type: 'pine_silhouette', x: 20, y: 390, scale: 1.8, color: 0x06101a, alpha: 0.7, layer: 'near' },
    { type: 'ice_formation', x: 1230, y: 450, scale: 1.3, color: 0x3a6688, alpha: 0.5, layer: 'near' },
  ],
};

const infernalTheme: ZoneTheme = {
  skyColor: 0x1a0808,
  skyLowerColor: 0x2a0a0a,
  skyGradient: [
    { color: 0x0a0505, stop: 0 },      // smoky black zenith
    { color: 0x1a0808, stop: 0.3 },    // dark red
    { color: 0x3a0c0c, stop: 0.6 },    // crimson
    { color: 0x4a1a08, stop: 1.0 },    // orange-red ember glow
  ],
  horizonHaze: { color: 0xcc6622, yStart: 400, yEnd: 550, peakAlpha: 0.15 },
  groundColor: 0x1a0a05,
  grassColor: 0x3d2000,
  soilColor: 0x2a1005,
  groundDetail: {
    tufts: [
      { color: 0x2a1505, count: 15, height: 5, width: 2 },   // char fragments
      { color: 0x1a0a05, count: 8, height: 3, width: 3 },     // ash
    ],
    cracks: { color: 0xff6600, glowColor: 0xff4400, count: 6 },
  },
  hillGrassColor: 0x3d2000,
  celestial: 'blood_moon',
  celestialColor: 0x8B0000,
  celestialGlow: { color: 0x8B0000, radius: 55, alpha: 0.1, rays: 8 },
  particleType: 'ember',
  particleColors: [0xff8844, 0xff6622, 0xffaa33, 0xff4400],
  shootingStarColor: 0xff4444,
  bgElements: [
    // Far layer — distant ridgeline + ruined citadel
    { type: 'ridgeline', x: 0, y: 340, width: 1280, scale: 1.0, color: 0x0f0505, alpha: 0.4, layer: 'far' },
    { type: 'ruined_citadel', x: 850, y: 320, scale: 0.8, color: 0x120606, alpha: 0.35, layer: 'far' },
    // Mid layer
    { type: 'volcanic_peak', x: 100, y: 280, scale: 1.6, color: 0x1a0505 },
    { type: 'volcanic_peak', x: 300, y: 320, scale: 1.2, color: 0x1e0808 },
    { type: 'lava_flow', x: 1100, y: 500, scale: 1.0, color: 0xff4400 },
    { type: 'smoke_column', x: 120, y: 200, scale: 1.0, color: 0x333333 },
    { type: 'smoke_column', x: 1200, y: 250, scale: 0.8, color: 0x2a2a2a },
    { type: 'ash_cloud', x: 500, y: 180, scale: 1.0, color: 0x2a2020, alpha: 0.12 },
    { type: 'ash_cloud', x: 800, y: 150, scale: 0.8, color: 0x2a2020, alpha: 0.1 },
    { type: 'lava_crack', x: 650, y: 540, width: 120, color: 0xff6600, alpha: 0.4 },
    { type: 'lava_crack', x: 1000, y: 550, width: 80, color: 0xff5500, alpha: 0.35 },
    // Near layer — foreground crags
    { type: 'jagged_crag', x: 30, y: 430, scale: 1.4, color: 0x0a0303, alpha: 0.7, layer: 'near' },
    { type: 'jagged_crag', x: 1240, y: 440, scale: 1.2, color: 0x0a0303, alpha: 0.65, layer: 'near' },
  ],
};

const themes: Record<string, ZoneTheme> = {
  goblin_wastes: goblinTheme,
  frozen_peaks: frozenTheme,
  infernal_keep: infernalTheme,
};

/**
 * Get the zone theme for a given map ID.
 * Falls back to goblin_wastes for unknown zones.
 */
export function getZoneTheme(mapId: string): ZoneTheme {
  return themes[mapId] ?? themes['goblin_wastes'];
}
