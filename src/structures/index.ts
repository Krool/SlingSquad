import type { TemplateFn, ZoneId } from './types';
import { treasureTemplates } from './treasure';

// ─── Goblin Wastes ──────────────────────────────────────────────────────────
import { diff1Templates as gDiff1 } from './goblin/diff1';
import { diff2Templates as gDiff2 } from './goblin/diff2';
import { diff3Templates as gDiff3 } from './goblin/diff3';
import { diff4Templates as gDiff4 } from './goblin/diff4';
import { diff5Templates as gDiff5 } from './goblin/diff5';

// ─── Frozen Peaks ───────────────────────────────────────────────────────────
import { diff1Templates as fDiff1 } from './frozen/diff1';
import { diff2Templates as fDiff2 } from './frozen/diff2';
import { diff3Templates as fDiff3 } from './frozen/diff3';
import { diff4Templates as fDiff4 } from './frozen/diff4';
import { diff5Templates as fDiff5 } from './frozen/diff5';

// ─── Infernal Keep ──────────────────────────────────────────────────────────
import { diff2Templates as iDiff2 } from './infernal/diff2';
import { diff3Templates as iDiff3 } from './infernal/diff3';
import { diff4Templates as iDiff4 } from './infernal/diff4';
import { diff5Templates as iDiff5 } from './infernal/diff5';

// ─── Registry ───────────────────────────────────────────────────────────────
// Maps zone → difficulty → array of template functions.
// Difficulty is 1-indexed; missing entries fall back to nearest available.

const registry: Record<string, Record<number, TemplateFn[]>> = {
  goblin_wastes: {
    1: gDiff1,
    2: gDiff2,
    3: gDiff3,
    4: gDiff4,
    5: gDiff5,
  },
  frozen_peaks: {
    1: fDiff1,
    2: fDiff2,
    3: fDiff3,
    4: fDiff4,
    5: fDiff5,
  },
  infernal_keep: {
    // No diff 1 for infernal — act 3 starts harder
    2: iDiff2,
    3: iDiff3,
    4: iDiff4,
    5: iDiff5,
  },
};

/**
 * Pick a template for the given zone and difficulty.
 * If `seed` > 0, the selection is deterministic (same seed → same template).
 * Falls back to nearest difficulty if exact match unavailable.
 * Falls back to goblin_wastes if zone is unknown.
 */
export function pickTemplate(zone: string, difficulty: number, seed = 0): TemplateFn {
  const zoneTemplates = registry[zone] ?? registry['goblin_wastes'];

  // Try exact match first
  let templates = zoneTemplates[difficulty];

  // Fallback: search up then down
  if (!templates) {
    for (let d = difficulty; d >= 1; d--) {
      if (zoneTemplates[d]) { templates = zoneTemplates[d]; break; }
    }
    if (!templates) {
      for (let d = difficulty; d <= 5; d++) {
        if (zoneTemplates[d]) { templates = zoneTemplates[d]; break; }
      }
    }
  }

  // Final fallback
  if (!templates || templates.length === 0) {
    templates = registry['goblin_wastes'][1];
  }

  const idx = seed > 0
    ? seed % templates.length
    : Math.floor(Math.random() * templates.length);
  return templates[idx];
}

/**
 * Pick a treasure template (not difficulty-based).
 * If `seed` > 0, the selection is deterministic.
 */
export function pickTreasureTemplate(seed = 0): TemplateFn {
  const idx = seed > 0
    ? seed % treasureTemplates.length
    : Math.floor(Math.random() * treasureTemplates.length);
  return treasureTemplates[idx];
}

export type { TemplateFn, ZoneId };
