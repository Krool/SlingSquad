// ─── Zone Visual Themes ──────────────────────────────────────────────────────
// Defines sky colors, ground colors, particle types, celestial bodies, and
// decorative background elements for each zone.

export interface ZoneTheme {
  // Sky gradient
  skyColor: number;
  skyLowerColor: number;  // lower sky / horizon band
  // Ground
  groundColor: number;
  grassColor: number;
  soilColor: number;
  // Hill
  hillGrassColor: number;
  // Celestial body
  celestial: 'crescent_moon' | 'pale_moon' | 'blood_moon';
  celestialColor: number;
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
    | 'campfire' | 'stake_fence' | 'aurora' | 'lava_flow' | 'smoke_column' | 'ice_sheen';
  x: number;
  y: number;
  scale?: number;
  color?: number;
}

// ─── Theme Definitions ──────────────────────────────────────────────────────

const goblinTheme: ZoneTheme = {
  skyColor: 0x1a1a3e,
  skyLowerColor: 0x2d1b35,
  groundColor: 0x2d5a1b,
  grassColor: 0x3d7a28,
  soilColor: 0x4a3010,
  hillGrassColor: 0x3d7a28,
  celestial: 'crescent_moon',
  celestialColor: 0xe8d5a3,
  particleType: 'firefly',
  particleColors: [0x88ff88, 0x66ee66, 0xaaff77],
  shootingStarColor: 0xccddff,
  bgElements: [
    { type: 'tree_silhouette', x: 100, y: 420, scale: 1.2, color: 0x0a0a15 },
    { type: 'tree_silhouette', x: 1100, y: 440, scale: 0.9, color: 0x0d0d18 },
    { type: 'tree_silhouette', x: 1200, y: 430, scale: 1.0, color: 0x0b0b16 },
    { type: 'stake_fence', x: 200, y: 510, color: 0x1a1008 },
    { type: 'campfire', x: 50, y: 600, color: 0xff8844 },
  ],
};

const frozenTheme: ZoneTheme = {
  skyColor: 0x0a1a2e,
  skyLowerColor: 0x1a2a40,
  groundColor: 0x8ba8c4,
  grassColor: 0x9bbbd8,
  soilColor: 0x5a7a90,
  hillGrassColor: 0x9bbbd8,
  celestial: 'pale_moon',
  celestialColor: 0xd8e8ff,
  particleType: 'snowflake',
  particleColors: [0xeeeeff, 0xddeeff, 0xffffff],
  shootingStarColor: 0xaaccff,
  bgElements: [
    { type: 'mountain_peak', x: 80, y: 300, scale: 1.5, color: 0x1a2a3a },
    { type: 'mountain_peak', x: 250, y: 340, scale: 1.1, color: 0x1e2e3e },
    { type: 'pine_silhouette', x: 1050, y: 440, scale: 0.8, color: 0x0a1520 },
    { type: 'pine_silhouette', x: 1150, y: 420, scale: 1.0, color: 0x0c1825 },
    { type: 'pine_silhouette', x: 1220, y: 445, scale: 0.7, color: 0x0b1622 },
    { type: 'aurora', x: 640, y: 100, scale: 1.0, color: 0x44ffaa },
    { type: 'ice_sheen', x: 640, y: 615, color: 0x88ccff },
  ],
};

const infernalTheme: ZoneTheme = {
  skyColor: 0x1a0808,
  skyLowerColor: 0x2a0a0a,
  groundColor: 0x1a0a05,
  grassColor: 0x3d2000,
  soilColor: 0x2a1005,
  hillGrassColor: 0x3d2000,
  celestial: 'blood_moon',
  celestialColor: 0x8B0000,
  particleType: 'ember',
  particleColors: [0xff8844, 0xff6622, 0xffaa33, 0xff4400],
  shootingStarColor: 0xff4444,
  bgElements: [
    { type: 'volcanic_peak', x: 100, y: 280, scale: 1.6, color: 0x1a0505 },
    { type: 'volcanic_peak', x: 300, y: 320, scale: 1.2, color: 0x1e0808 },
    { type: 'lava_flow', x: 1100, y: 500, scale: 1.0, color: 0xff4400 },
    { type: 'smoke_column', x: 120, y: 200, scale: 1.0, color: 0x333333 },
    { type: 'smoke_column', x: 1200, y: 250, scale: 0.8, color: 0x2a2a2a },
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
