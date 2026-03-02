import {
  SCORE_NODE_BATTLE, SCORE_NODE_ELITE, SCORE_NODE_BOSS, SCORE_NODE_OTHER,
  SCORE_VICTORY_BONUS, SCORE_DEATH_PENALTY,
  SCORE_ASCENSION_MULT_PER_LEVEL, SCORE_MODIFIER_MULTS,
} from '@/config/constants';
import type { NodeDef } from '@/systems/RunState';

export interface ScoreBreakdown {
  nodePoints: number;
  victoryBonus: number;
  deathPenalty: number;
  base: number;
  ascensionMult: number;
  modifierMult: number;
  final: number;
}

const NODE_SCORE: Record<string, number> = {
  BATTLE: SCORE_NODE_BATTLE,
  ELITE:  SCORE_NODE_ELITE,
  BOSS:   SCORE_NODE_BOSS,
};

export function calculateRunScore(opts: {
  completedNodes: NodeDef[];
  victory: boolean;
  heroDeathsTotal: number;
  ascensionLevel: number;
  modifiers: string[];
}): ScoreBreakdown {
  const nodePoints = opts.completedNodes.reduce(
    (sum, n) => sum + (NODE_SCORE[n.type] ?? SCORE_NODE_OTHER), 0,
  );
  const victoryBonus = opts.victory ? SCORE_VICTORY_BONUS : 0;
  const deathPenalty = opts.heroDeathsTotal * SCORE_DEATH_PENALTY;
  const base = Math.max(0, nodePoints + victoryBonus - deathPenalty);

  const ascensionMult = 1 + opts.ascensionLevel * SCORE_ASCENSION_MULT_PER_LEVEL;
  const modifierMult = opts.modifiers.reduce(
    (prod, m) => prod * (SCORE_MODIFIER_MULTS[m] ?? 1), 1,
  );

  const final = Math.round(base * ascensionMult * modifierMult);

  return { nodePoints, victoryBonus, deathPenalty, base, ascensionMult, modifierMult, final };
}
