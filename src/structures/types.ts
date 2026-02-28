import type { MaterialType } from '@/config/constants';

// ─── Hazard Types ────────────────────────────────────────────────────────────
export type HazardType = 'SPIKE_TRAP' | 'ICE_PATCH' | 'LAVA_PIT' | 'FIRE_GEYSER';

// ─── Structure Context ──────────────────────────────────────────────────────
// Passed to every template function so templates don't need direct BattleScene access.
export interface StructureContext {
  groundY: number;  // 620 — top of flat ground
  /** Place a block at (x,y) with given width, height, and material */
  block(x: number, y: number, w: number, h: number, mat: MaterialType): void;
  /** Place a barrel at (x,y) */
  barrel(x: number, y: number): void;
  /** Place a hazard */
  hazard(type: HazardType, x: number, y: number, opts?: Record<string, number>): void;
  /** Enemy slot positions — template pushes {x,y} for each enemy location */
  enemySlots: Array<{ x: number; y: number }>;
}

// ─── Template Function ──────────────────────────────────────────────────────
export type TemplateFn = (ctx: StructureContext) => void;

// ─── Zone IDs (matches RunState.currentMapId) ───────────────────────────────
export type ZoneId = 'goblin_wastes' | 'frozen_peaks' | 'infernal_keep';
