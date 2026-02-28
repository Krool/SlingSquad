import type { TemplateFn } from '../types';

// ─── "Two Towers" — 2-level left tower, 3-level right tower ─────────────────
export const twoTowers: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const LX = 460;
  const span = 110;
  const pillarH = 60;
  const plankW = 140;

  // Left tower level 1
  const lv1y = groundY - pillarH / 2;
  b(LX, lv1y, 14, pillarH, 'WOOD');
  b(LX + span, lv1y, 14, pillarH, 'WOOD');
  const floor1 = groundY - pillarH - 6;
  b(LX + span / 2, floor1, plankW, 12, 'STONE');

  // Left tower level 2
  const lv2base = floor1 - 6;
  const lv2y = lv2base - pillarH / 2;
  b(LX, lv2y, 14, pillarH, 'WOOD');
  b(LX + span, lv2y, 14, pillarH, 'WOOD');
  const floor2 = lv2base - pillarH - 6;
  b(LX + span / 2, floor2, plankW, 12, 'STONE');
  b(LX + span / 2, floor2 - 20, 28, 28, 'STONE');

  // Right tower — 3 levels
  const RX = 780;
  b(RX, lv1y, 14, pillarH, 'WOOD');
  b(RX + span, lv1y, 14, pillarH, 'WOOD');
  const rFloor1 = groundY - pillarH - 6;
  b(RX + span / 2, rFloor1, plankW, 12, 'STONE');

  const rLv2base = rFloor1 - 6;
  const rLv2y = rLv2base - pillarH / 2;
  b(RX, rLv2y, 14, pillarH, 'WOOD');
  b(RX + span, rLv2y, 14, pillarH, 'WOOD');
  const rFloor2 = rLv2base - pillarH - 6;
  b(RX + span / 2, rFloor2, plankW, 12, 'STONE');

  const rLv3base = rFloor2 - 6;
  const rLv3y = rLv3base - 50 / 2;
  b(RX, rLv3y, 14, 50, 'WOOD');
  b(RX + span, rLv3y, 14, 50, 'WOOD');
  const rFloor3 = rLv3base - 50 - 6;
  b(RX + span / 2, rFloor3, plankW, 12, 'STONE');
  b(RX + span / 2, rFloor3 - 20, 28, 28, 'STONE');

  ctx.barrel(RX + span / 2, groundY - 18);
  ctx.barrel(LX + span / 2, groundY - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: LX + span / 2, y: floor1 - 6 - eR },
    { x: 620, y: groundY - eR },
    { x: RX + span / 2, y: rFloor1 - 6 - eR },
    { x: RX + span / 2, y: rFloor3 - 6 - 28 - eR },
  );
};

// ─── "Powder Keg" — tower with barrel-packed ground floor ───────────────────
export const powderKeg: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const TX = 620;
  const span = 120;
  const pillarH = 60;

  b(TX, groundY - pillarH / 2, 14, pillarH, 'WOOD');
  b(TX + span, groundY - pillarH / 2, 14, pillarH, 'WOOD');
  b(TX + span / 3, groundY - pillarH / 2, 14, pillarH, 'WOOD');
  b(TX + span * 2 / 3, groundY - pillarH / 2, 14, pillarH, 'WOOD');
  const floor1 = groundY - pillarH - 6;
  b(TX + span / 2, floor1, span + 30, 12, 'STONE');

  const lv2H = 45;
  b(TX + 15, floor1 - 6 - lv2H / 2, 14, lv2H, 'WOOD');
  b(TX + span - 15, floor1 - 6 - lv2H / 2, 14, lv2H, 'WOOD');
  const floor2 = floor1 - 6 - lv2H - 6;
  b(TX + span / 2, floor2, span + 10, 12, 'STONE');
  b(TX + span / 2, floor2 - 20, 28, 28, 'STONE');

  const SX = 850;
  b(SX, groundY - 40 / 2, 14, 40, 'WOOD');
  b(SX + 60, groundY - 40 / 2, 14, 40, 'WOOD');
  b(SX + 30, groundY - 40 - 6, 80, 12, 'WOOD');

  ctx.barrel(TX + span / 3, groundY - 18);
  ctx.barrel(TX + span / 2, groundY - 18);
  ctx.barrel(TX + span * 2 / 3, groundY - 18);
  ctx.barrel(TX + span / 2, floor1 - 6 - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: TX + span / 2, y: floor1 - 6 - eR },
    { x: TX + span / 2, y: floor2 - 6 - 28 - eR },
    { x: SX + 30, y: groundY - 40 - 6 - 6 - eR },
  );
};

// ─── "Domino Run" — 5 tall thin pillars + barrel chain ──────────────────────
export const dominoRun: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const startX = 460;
  const spacing = 90;
  const pillarH = 80;

  for (let i = 0; i < 5; i++) {
    const px = startX + i * spacing;
    b(px, groundY - pillarH / 2, 12, pillarH, 'WOOD');
    b(px, groundY - pillarH - 6 - 14, 28, 28, 'STONE');
    ctx.barrel(px + 20, groundY - 18);
  }

  const endX = startX + 5 * spacing;
  b(endX - 30, groundY - 50 / 2, 14, 50, 'WOOD');
  b(endX + 30, groundY - 50 / 2, 14, 50, 'WOOD');
  const shelterFloor = groundY - 50 - 6;
  b(endX, shelterFloor, 80, 12, 'STONE');
  b(endX, shelterFloor - 6 - 30 / 2, 14, 30, 'WOOD');
  b(endX, shelterFloor - 6 - 30 - 6, 60, 12, 'STONE');

  const eR = 20;
  ctx.enemySlots.push(
    { x: startX + 2 * spacing, y: groundY - eR },
    { x: endX, y: shelterFloor - 6 - eR },
    { x: endX, y: groundY - eR },
  );
};

// ─── New: "Goblin Hut" — simple A-frame hut ────────────────────────────────
export const goblinHut: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Main hut
  const HX = 600;
  const span = 100;
  b(HX, groundY - 55 / 2, 14, 55, 'WOOD');
  b(HX + span, groundY - 55 / 2, 14, 55, 'WOOD');
  const floor1 = groundY - 55 - 6;
  b(HX + span / 2, floor1, span + 20, 12, 'WOOD');

  // A-frame roof
  b(HX + span / 2 - 25, floor1 - 6 - 35 / 2, 12, 35, 'WOOD');
  b(HX + span / 2 + 25, floor1 - 6 - 35 / 2, 12, 35, 'WOOD');
  const peak = floor1 - 6 - 35 - 6;
  b(HX + span / 2, peak, 70, 10, 'WOOD');

  // Side lean-to
  const SX = 820;
  b(SX, groundY - 40 / 2, 14, 40, 'WOOD');
  b(SX + 50, groundY - 40 / 2, 14, 40, 'WOOD');
  b(SX + 25, groundY - 40 - 6, 70, 10, 'WOOD');

  ctx.barrel(HX + span / 2, groundY - 18);
  ctx.barrel(SX + 25, groundY - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: HX + span / 2, y: floor1 - 6 - eR },
    { x: SX + 25, y: groundY - 40 - 6 - 6 - eR },
    { x: 720, y: groundY - eR },
  );
};

// ─── New: "Lookout Post" — tall single watchtower + ground enemies ─────────
export const lookoutPost: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Tall watchtower
  const TX = 650;
  const span = 80;
  const pH1 = 70, pH2 = 55, pH3 = 40;

  b(TX, groundY - pH1 / 2, 14, pH1, 'WOOD');
  b(TX + span, groundY - pH1 / 2, 14, pH1, 'WOOD');
  const f1 = groundY - pH1 - 6;
  b(TX + span / 2, f1, span + 20, 12, 'STONE');

  b(TX + 10, f1 - 6 - pH2 / 2, 14, pH2, 'WOOD');
  b(TX + span - 10, f1 - 6 - pH2 / 2, 14, pH2, 'WOOD');
  const f2 = f1 - 6 - pH2 - 6;
  b(TX + span / 2, f2, span + 10, 12, 'STONE');

  b(TX + span / 2, f2 - 6 - pH3 / 2, 14, pH3, 'WOOD');
  const f3 = f2 - 6 - pH3 - 6;
  b(TX + span / 2, f3, 60, 10, 'WOOD');

  // Ground barricade
  b(500, groundY - 25 / 2, 60, 25, 'WOOD');
  b(880, groundY - 25 / 2, 60, 25, 'WOOD');

  ctx.barrel(TX + span / 2, groundY - 18);
  ctx.barrel(500, groundY - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: TX + span / 2, y: f1 - 6 - eR },
    { x: TX + span / 2, y: f3 - 6 - eR },
    { x: 500, y: groundY - 25 - eR },
    { x: 880, y: groundY - 25 - eR },
  );
};

// ─── New: "Lumber Pile" — stacked blocks prone to toppling ──────────────────
export const lumberPile: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Left stack — loosely piled wood
  const LX = 520;
  b(LX, groundY - 15, 80, 30, 'WOOD');
  b(LX - 10, groundY - 30 - 15, 60, 30, 'WOOD');
  b(LX + 5, groundY - 60 - 12, 50, 24, 'WOOD');
  b(LX, groundY - 84 - 10, 40, 20, 'WOOD');

  // Right stack — taller, balanced
  const RX = 750;
  b(RX, groundY - 15, 70, 30, 'WOOD');
  b(RX + 5, groundY - 30 - 15, 65, 30, 'WOOD');
  b(RX - 5, groundY - 60 - 15, 55, 30, 'WOOD');
  b(RX, groundY - 90 - 12, 45, 24, 'WOOD');
  b(RX, groundY - 114 - 10, 35, 20, 'WOOD');

  // Stone anchor
  b(630, groundY - 18, 28, 36, 'STONE');

  ctx.barrel(LX, groundY - 104 - 18);
  ctx.barrel(RX, groundY - 18);
  ctx.barrel(630, groundY - 54);

  const eR = 20;
  ctx.enemySlots.push(
    { x: 630, y: groundY - eR },
    { x: LX, y: groundY - 94 - eR },
    { x: RX, y: groundY - 124 - eR },
  );
};

// ─── New: "Palisade Line" — wooden wall with gaps and ground enemies ────────
export const palisadeLine: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Row of palisade stakes
  const startX = 480;
  const stakeSpacing = 50;
  const stakeH = 65;

  for (let i = 0; i < 7; i++) {
    const sx = startX + i * stakeSpacing;
    // Alternate heights for visual variety
    const h = stakeH + (i % 2) * 15;
    b(sx, groundY - h / 2, 16, h, 'WOOD');
  }

  // Connecting plank near top
  const plankY = groundY - stakeH + 5;
  b(startX + 3 * stakeSpacing, plankY, 340, 10, 'WOOD');

  // Stone weight on top of middle stake
  b(startX + 3 * stakeSpacing, groundY - stakeH - 6 - 14, 28, 28, 'STONE');

  // Small shelter behind wall
  const SX = startX + 7 * stakeSpacing + 40;
  b(SX, groundY - 45 / 2, 14, 45, 'WOOD');
  b(SX + 60, groundY - 45 / 2, 14, 45, 'WOOD');
  b(SX + 30, groundY - 45 - 6, 80, 10, 'WOOD');

  ctx.barrel(startX + 1.5 * stakeSpacing, groundY - 18);
  ctx.barrel(startX + 4.5 * stakeSpacing, groundY - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: startX + 2 * stakeSpacing, y: groundY - eR },
    { x: startX + 5 * stakeSpacing, y: groundY - eR },
    { x: SX + 30, y: groundY - 45 - 6 - 6 - eR },
    { x: startX + 3 * stakeSpacing, y: groundY - stakeH - 6 - 28 - eR },
  );
};

// ─── New: "Barrel Depot" — lots of barrels, flimsy supports ─────────────────
export const barrelDepot: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Central storage frame
  const CX = 640;
  const span = 140;
  b(CX - span / 2, groundY - 50 / 2, 14, 50, 'WOOD');
  b(CX + span / 2, groundY - 50 / 2, 14, 50, 'WOOD');
  b(CX, groundY - 50 / 2, 10, 50, 'WOOD');
  const shelf = groundY - 50 - 6;
  b(CX, shelf, span + 20, 10, 'WOOD');

  // Upper shelf
  b(CX - 30, shelf - 6 - 35 / 2, 10, 35, 'WOOD');
  b(CX + 30, shelf - 6 - 35 / 2, 10, 35, 'WOOD');
  const shelf2 = shelf - 6 - 35 - 6;
  b(CX, shelf2, 80, 10, 'WOOD');

  // Side hut
  const SX = 870;
  b(SX, groundY - 40 / 2, 14, 40, 'WOOD');
  b(SX + 55, groundY - 40 / 2, 14, 40, 'WOOD');
  b(SX + 27, groundY - 40 - 6, 75, 10, 'WOOD');

  // LOTS of barrels
  ctx.barrel(CX - span / 4, groundY - 18);
  ctx.barrel(CX + span / 4, groundY - 18);
  ctx.barrel(CX - 20, shelf - 6 - 18);
  ctx.barrel(CX + 20, shelf - 6 - 18);
  ctx.barrel(CX, shelf2 - 6 - 18);
  ctx.barrel(SX + 27, groundY - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: CX, y: groundY - eR },
    { x: CX, y: shelf - 6 - eR },
    { x: SX + 27, y: groundY - 40 - 6 - 6 - eR },
  );
};

export const diff1Templates: TemplateFn[] = [
  twoTowers,
  powderKeg,
  dominoRun,
  goblinHut,
  lookoutPost,
  lumberPile,
  palisadeLine,
  barrelDepot,
];
