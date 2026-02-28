import type { TemplateFn } from '../types';

// ─── "Ice Fortress" — colonnade of ice pillars with flanking towers ────────
export const iceFortress: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const WX = 580;
  const colSpacing = 80;
  const pillarH = 80;

  for (let i = 0; i < 5; i++) {
    b(WX + i * colSpacing, groundY - pillarH / 2, 16, pillarH, 'ICE');
  }
  const colRight = WX + 4 * colSpacing;
  const plankW = colRight - WX + 40;
  const plankCX = WX + 2 * colSpacing;
  const row1Y = groundY - pillarH - 6;
  b(plankCX, row1Y, plankW, 14, 'ICE');

  const tier2H = 50;
  for (let i = 0; i < 5; i += 2) {
    b(WX + i * colSpacing, row1Y - 6 - tier2H / 2, 14, tier2H, 'WOOD');
  }
  const row2Y = row1Y - 6 - tier2H - 6;
  b(plankCX, row2Y, plankW * 0.6, 12, 'ICE');

  for (const tx of [WX - 110, colRight + 110]) {
    b(tx - 30, groundY - 65 / 2, 16, 65, 'ICE');
    b(tx + 30, groundY - 65 / 2, 16, 65, 'ICE');
    const tFloor = groundY - 65 - 6;
    b(tx, tFloor, 80, 12, 'STONE');
    b(tx, tFloor - 18, 28, 28, 'ICE');
  }

  ctx.barrel(WX + 2.5 * colSpacing, groundY - 18);
  ctx.barrel(WX + 1.5 * colSpacing, row1Y - 6 - 18);
  ctx.hazard('ICE_PATCH', WX + 2 * colSpacing, groundY - 5);

  const eR = 20;
  ctx.enemySlots.push(
    { x: WX - 110, y: groundY - 65 - 6 - 6 - eR },
    { x: WX + 1.5 * colSpacing, y: row1Y - 6 - eR },
    { x: WX + 2.5 * colSpacing, y: row1Y - 6 - eR },
    { x: colRight + 110, y: groundY - 65 - 6 - 6 - eR },
  );
};

// ─── "Frozen Cage" — 3-tier ice frame ──────────────────────────────────────
export const frozenCage: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const cx = 680;
  const cageW = 160;
  const frontL = cx - cageW / 2;
  const frontR = cx + cageW / 2;

  b(frontL, groundY - 50 / 2, 16, 50, 'ICE');
  b(frontR, groundY - 50 / 2, 16, 50, 'ICE');
  b(cx, groundY - 50 / 2, 14, 50, 'WOOD');
  const midY = groundY - 50 - 6;
  b(cx, midY, cageW + 30, 12, 'ICE');

  b(frontL, midY - 6 - 60 / 2, 14, 60, 'ICE');
  b(frontR, midY - 6 - 60 / 2, 14, 60, 'ICE');
  const upperY = midY - 6 - 60 - 6;
  b(cx, upperY, cageW + 30, 14, 'ICE');

  b(frontL, upperY - 6 - 40 / 2, 14, 40, 'ICE');
  b(frontR, upperY - 6 - 40 / 2, 14, 40, 'ICE');
  const capY = upperY - 6 - 40 - 6;
  b(cx, capY, cageW + 50, 14, 'ICE');
  b(cx - 40, capY - 18, 50, 24, 'ICE');
  b(cx + 40, capY - 18, 50, 24, 'ICE');

  ctx.barrel(frontL + 40, groundY - 18);
  ctx.barrel(frontR - 40, upperY - 6 - 18);
  ctx.hazard('ICE_PATCH', cx, midY - 6 - 5);

  const eR = 20;
  ctx.enemySlots.push(
    { x: cx, y: midY - 6 - eR },
    { x: cx, y: upperY - 6 - eR },
    { x: frontL + 50, y: groundY - eR },
    { x: frontR - 50, y: groundY - eR },
  );
};

// ─── "Icicle Gallery" — multi-level ice shelving ───────────────────────────
export const icicleGallery: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const CX = 660;
  const shelfW = 180;
  const levels = [
    { h: 55, barrels: 2 },
    { h: 50, barrels: 1 },
    { h: 45, barrels: 1 },
  ];

  let currentBase = groundY;
  const floors: number[] = [];

  for (let i = 0; i < levels.length; i++) {
    const { h, barrels: bCount } = levels[i];
    const w = shelfW - i * 30;

    b(CX - w / 2, currentBase - h / 2, 14, h, 'ICE');
    b(CX + w / 2, currentBase - h / 2, 14, h, 'ICE');
    if (i === 0) b(CX, currentBase - h / 2, 12, h, 'WOOD');

    const floorY = currentBase - h - 6;
    b(CX, floorY, w + 20, 12, i < 2 ? 'ICE' : 'STONE');
    floors.push(floorY);

    for (let j = 0; j < bCount; j++) {
      const bx = CX + (j - (bCount - 1) / 2) * 40;
      ctx.barrel(bx, currentBase - 18);
    }
    currentBase = floorY - 6;
  }

  b(CX, floors[2] - 6 - 14, 28, 28, 'ICE');
  ctx.hazard('ICE_PATCH', CX - 30, groundY - 5);
  ctx.hazard('ICE_PATCH', CX + 30, groundY - 5);

  const eR = 20;
  ctx.enemySlots.push(
    { x: CX, y: floors[0] - 6 - eR },
    { x: CX, y: floors[1] - 6 - eR },
    { x: CX, y: floors[2] - 6 - 28 - eR },
    { x: CX + 70, y: groundY - eR },
  );
};

// ─── "Twin Glaciers" — two fortified ice structures with bridge ────────────
export const twinGlaciers: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const LX = 490;
  const fortW = 100;
  b(LX, groundY - 45 / 2, 20, 45, 'ICE');
  b(LX + fortW, groundY - 45 / 2, 20, 45, 'ICE');
  const lBase = groundY - 45 - 6;
  b(LX + fortW / 2, lBase, fortW + 20, 12, 'ICE');

  b(LX + 15, lBase - 6 - 50 / 2, 14, 50, 'WOOD');
  b(LX + fortW - 15, lBase - 6 - 50 / 2, 14, 50, 'WOOD');
  const lf2 = lBase - 6 - 50 - 6;
  b(LX + fortW / 2, lf2, fortW + 10, 12, 'ICE');
  b(LX + fortW / 2, lf2 - 18, 28, 28, 'ICE');

  const RX = 740;
  b(RX, groundY - 55 / 2, 20, 55, 'ICE');
  b(RX + fortW, groundY - 55 / 2, 20, 55, 'ICE');
  const rBase = groundY - 55 - 6;
  b(RX + fortW / 2, rBase, fortW + 20, 12, 'ICE');

  b(RX + 15, rBase - 6 - 55 / 2, 14, 55, 'WOOD');
  b(RX + fortW - 15, rBase - 6 - 55 / 2, 14, 55, 'WOOD');
  const rf2 = rBase - 6 - 55 - 6;
  b(RX + fortW / 2, rf2, fortW + 10, 12, 'ICE');
  b(RX + fortW / 2, rf2 - 18, 28, 28, 'ICE');

  const bridgeCX = (LX + fortW + RX) / 2;
  b(bridgeCX, groundY - 50 / 2, 14, 50, 'ICE');
  b(bridgeCX, groundY - 50 - 6, 80, 10, 'ICE');

  ctx.barrel(LX + fortW / 2, groundY - 18);
  ctx.barrel(RX + fortW / 2, groundY - 18);
  ctx.hazard('ICE_PATCH', bridgeCX, groundY - 5);

  const eR = 20;
  ctx.enemySlots.push(
    { x: LX + fortW / 2, y: lBase - 6 - eR },
    { x: LX + fortW / 2, y: lf2 - 6 - 28 - eR },
    { x: RX + fortW / 2, y: rBase - 6 - eR },
    { x: RX + fortW / 2, y: rf2 - 6 - 28 - eR },
    { x: bridgeCX, y: groundY - 50 - 6 - 6 - eR },
  );
};

export const diff3Templates: TemplateFn[] = [
  iceFortress,
  frozenCage,
  icicleGallery,
  twinGlaciers,
];
