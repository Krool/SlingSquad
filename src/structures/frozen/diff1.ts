import type { TemplateFn } from '../types';
import { raisedPlatform } from '../shared';

// ─── "Ice Pillars" — simple frozen pillars with ice shelves ─────────────────
export const icePillars: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const LX = 480;
  const span = 100;
  const pillarH = 60;

  b(LX, groundY - pillarH / 2, 14, pillarH, 'ICE');
  b(LX + span, groundY - pillarH / 2, 14, pillarH, 'ICE');
  const floor1 = groundY - pillarH - 6;
  b(LX + span / 2, floor1, span + 20, 12, 'ICE');

  b(LX + span / 2, floor1 - 6 - 40 / 2, 14, 40, 'ICE');
  const floor2 = floor1 - 6 - 40 - 6;
  b(LX + span / 2, floor2, 70, 10, 'ICE');
  b(LX + span / 2, floor2 - 18, 28, 28, 'STONE');

  const RX = 760;
  b(RX, groundY - 55 / 2, 14, 55, 'ICE');
  b(RX + 80, groundY - 55 / 2, 14, 55, 'ICE');
  const rf1 = groundY - 55 - 6;
  b(RX + 40, rf1, 100, 12, 'ICE');

  ctx.barrel(LX + span / 2, groundY - 18);
  ctx.barrel(RX + 40, groundY - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: LX + span / 2, y: floor1 - 6 - eR },
    { x: RX + 40, y: rf1 - 6 - eR },
    { x: 640, y: groundY - eR },
  );

  // Coins (~14g total)
  ctx.coin(460, 300, 2);                          // approach — arc path
  ctx.coin(LX + span / 2, floor2 - 30, 3);       // structure — above top block
  ctx.coin(RX + 40, rf1 - 30, 3);                // structure — above right platform
  ctx.coin(640, groundY - 18, 2);                 // ground — between structures
  ctx.coin(LX + span / 2, groundY - 18, 4);      // risky — near left barrel
};

// ─── "Frozen Outpost" — wooden hut with ice walls ──────────────────────────
export const frozenOutpost: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const HX = 560;
  const span = 110;

  b(HX - 30, groundY - 50 / 2, 22, 50, 'ICE');
  b(HX + span + 30, groundY - 50 / 2, 22, 50, 'ICE');

  b(HX, groundY - 55 / 2, 14, 55, 'WOOD');
  b(HX + span, groundY - 55 / 2, 14, 55, 'WOOD');
  const floor1 = groundY - 55 - 6;
  b(HX + span / 2, floor1, span + 20, 12, 'WOOD');

  b(HX + span / 2 - 25, floor1 - 6 - 35 / 2, 12, 35, 'WOOD');
  b(HX + span / 2 + 25, floor1 - 6 - 35 / 2, 12, 35, 'WOOD');
  const peak = floor1 - 6 - 35 - 6;
  b(HX + span / 2, peak, 70, 10, 'WOOD');

  const SX = 800;
  b(SX, groundY - 40 / 2, 14, 40, 'ICE');
  b(SX + 50, groundY - 40 / 2, 14, 40, 'ICE');
  b(SX + 25, groundY - 40 - 6, 70, 10, 'ICE');

  ctx.barrel(HX + span / 2, groundY - 18);
  ctx.hazard('ICE_PATCH', 700, groundY - 5);

  const eR = 20;
  ctx.enemySlots.push(
    { x: HX + span / 2, y: floor1 - 6 - eR },
    { x: SX + 25, y: groundY - 40 - 6 - 6 - eR },
    { x: 700, y: groundY - eR },
  );

  // Coins (~14g total)
  ctx.coin(480, 320, 2);                          // approach — arc path
  ctx.coin(HX + span / 2, peak - 18, 3);         // structure — above hut roof
  ctx.coin(SX + 25, groundY - 60, 3);            // structure — near side platform
  ctx.coin(700, groundY - 18, 2);                 // ground — near ice patch
  ctx.coin(HX + span / 2, groundY - 18, 4);      // risky — near barrel inside hut
};

// ─── "Glacier Shelf" — stacked ice blocks prone to toppling ────────────────
export const glacierShelf: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const CX = 620;

  b(CX, groundY - 18, 70, 36, 'ICE');
  b(CX - 5, groundY - 36 - 4 - 15, 60, 30, 'ICE');
  b(CX + 5, groundY - 66 - 4 - 12, 50, 24, 'ICE');
  b(CX, groundY - 90 - 4 - 10, 40, 20, 'ICE');

  const RX = 800;
  b(RX, groundY - 60 / 2, 14, 60, 'WOOD');
  b(RX + 70, groundY - 60 / 2, 14, 60, 'WOOD');
  const rf = groundY - 60 - 6;
  b(RX + 35, rf, 90, 12, 'STONE');
  b(RX + 35, rf - 18, 28, 28, 'ICE');

  ctx.barrel(CX, groundY - 110 - 18);
  ctx.barrel(RX + 35, groundY - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: CX, y: groundY - 104 - eR },
    { x: RX + 35, y: rf - 6 - eR },
    { x: 720, y: groundY - eR },
  );

  // Coins (~13g total)
  ctx.coin(500, 280, 2);                          // approach — arc path
  ctx.coin(CX, groundY - 140, 3);                // structure — above glacier stack
  ctx.coin(RX + 35, rf - 30, 3);                 // structure — above right platform
  ctx.coin(CX, groundY - 128, 2);                // risky — near barrel on glacier top
  ctx.coin(RX + 35, groundY - 18, 3);            // risky — near right barrel
};

// ─── "Snow Fort" — low ice walls with wood supports ────────────────────────
export const snowFort: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const startX = 480;
  const wallSpacing = 55;
  const wallH = 55;

  for (let i = 0; i < 6; i++) {
    const wx = startX + i * wallSpacing;
    const h = wallH + (i % 2) * 12;
    b(wx, groundY - h / 2, 18, h, 'ICE');
  }

  const plankY = groundY - wallH + 5;
  b(startX + 2.5 * wallSpacing, plankY, 280, 10, 'WOOD');

  const SX = startX + 6 * wallSpacing + 30;
  b(SX, groundY - 45 / 2, 14, 45, 'WOOD');
  b(SX + 55, groundY - 45 / 2, 14, 45, 'WOOD');
  b(SX + 27, groundY - 45 - 6, 75, 10, 'ICE');

  ctx.barrel(startX + 1.5 * wallSpacing, groundY - 18);
  ctx.barrel(startX + 4.5 * wallSpacing, groundY - 18);
  ctx.hazard('ICE_PATCH', startX + 3 * wallSpacing, groundY - 5);

  const eR = 20;
  ctx.enemySlots.push(
    { x: startX + 2 * wallSpacing, y: groundY - eR },
    { x: startX + 4 * wallSpacing, y: groundY - eR },
    { x: SX + 27, y: groundY - 45 - 6 - 6 - eR },
  );

  // Coins (~14g total)
  ctx.coin(450, 300, 2);                                      // approach — arc path
  ctx.coin(startX + 2.5 * wallSpacing, plankY - 18, 3);      // structure — above long plank
  ctx.coin(SX + 27, groundY - 60, 3);                        // structure — near side platform
  ctx.coin(startX + 3 * wallSpacing, groundY - 18, 2);       // ground — near ice patch
  ctx.coin(startX + 1.5 * wallSpacing, groundY - 18, 4);     // risky — near left barrel

  // Terrain — snowdrift mound near fort
  raisedPlatform(ctx, 700, groundY, 110, 18);
};

export const diff1Templates: TemplateFn[] = [
  icePillars,
  frozenOutpost,
  glacierShelf,
  snowFort,
];
