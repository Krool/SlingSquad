import type { TemplateFn } from '../types';

// ─── "Frost Throne" — massive ice palace with central throne room ──────────
export const frostThrone: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const span = 100;
  const pillarH = 70;

  const buildLevel = (cx: number, baseY: number, pH: number, plankW: number, mat: 'ICE' | 'WOOD') => {
    b(cx - span / 2, baseY - pH / 2, 14, pH, mat);
    b(cx + span / 2, baseY - pH / 2, 14, pH, mat);
    const floorY = baseY - pH - 6;
    b(cx, floorY, plankW, 12, 'STONE');
    return floorY;
  };

  // Left wing: 3-level ice tower
  const LX = 465;
  const lf1 = buildLevel(LX, groundY, pillarH, 140, 'ICE');
  const lf2 = buildLevel(LX, lf1 - 6, 55, 130, 'ICE');
  const lf3 = buildLevel(LX, lf2 - 6, 45, 100, 'ICE');
  b(LX, lf3 - 6 - 14, 28, 28, 'STONE');

  // Center grand hall: 4 levels
  const CX = 680;
  const hallSpan = 140;

  b(CX - hallSpan / 2, groundY - pillarH / 2, 16, pillarH, 'ICE');
  b(CX, groundY - pillarH / 2, 14, pillarH, 'WOOD');
  b(CX + hallSpan / 2, groundY - pillarH / 2, 16, pillarH, 'ICE');
  const cf1 = groundY - pillarH - 6;
  b(CX, cf1, hallSpan + 40, 14, 'STONE');

  const cPH2 = 60;
  b(CX - hallSpan / 2, cf1 - 6 - cPH2 / 2, 14, cPH2, 'ICE');
  b(CX + hallSpan / 2, cf1 - 6 - cPH2 / 2, 14, cPH2, 'ICE');
  const cf2 = cf1 - 6 - cPH2 - 6;
  b(CX, cf2, hallSpan + 40, 12, 'ICE');

  const cPH3 = 50;
  b(CX - span / 2, cf2 - 6 - cPH3 / 2, 14, cPH3, 'ICE');
  b(CX + span / 2, cf2 - 6 - cPH3 / 2, 14, cPH3, 'ICE');
  const cf3 = cf2 - 6 - cPH3 - 6;
  b(CX, cf3, 140, 12, 'STONE');

  // Throne on top
  const throneH = 40;
  b(CX, cf3 - 6 - throneH / 2, 14, throneH, 'ICE');
  const throneFloor = cf3 - 6 - throneH - 6;
  b(CX, throneFloor, 100, 12, 'STONE');
  b(CX - 30, throneFloor - 6 - 14, 50, 24, 'STONE');
  b(CX + 30, throneFloor - 6 - 14, 50, 24, 'STONE');

  // Right wing: 2-level ice tower
  const RX = 930;
  const rf1 = buildLevel(RX, groundY, pillarH, 130, 'ICE');
  const rf2 = buildLevel(RX, rf1 - 6, 55, 120, 'ICE');
  b(RX, rf2 - 6 - 14, 28, 28, 'STONE');

  // Connecting bridges
  const lBridgeX = (LX + 50 + CX - 70) / 2;
  b(lBridgeX, cf1, 80, 12, 'ICE');
  b(lBridgeX, groundY - pillarH / 2, 14, pillarH, 'ICE');

  const rBridgeX = (CX + 70 + RX - 50) / 2;
  b(rBridgeX, cf1, 80, 12, 'ICE');
  b(rBridgeX, groundY - pillarH / 2, 14, pillarH, 'ICE');

  ctx.barrel(LX, groundY - 18);
  ctx.barrel(CX - hallSpan / 4, groundY - 18);
  ctx.barrel(CX + 40, cf1 - 6 - 18);
  ctx.barrel(RX, groundY - 18);

  ctx.hazard('ICE_PATCH', CX - 50, groundY - 10);
  ctx.hazard('ICE_PATCH', CX + 50, groundY - 10);
  ctx.hazard('ICE_PATCH', lBridgeX, groundY - 10);

  const eR = 20;
  ctx.enemySlots.push(
    { x: LX, y: lf1 - 6 - eR },
    { x: LX, y: lf3 - 6 - 28 - eR },
    { x: CX, y: cf1 - 6 - eR },
    { x: CX, y: cf2 - 6 - eR },
    { x: CX, y: throneFloor - 6 - 24 - eR },
    { x: RX, y: rf1 - 6 - eR },
  );
};

// ─── "Glacier Citadel" — 3 connected ice chambers, escalating difficulty ───
export const glacierCitadel: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const chamberW = 110;

  // Chamber 1 (left, ice)
  const C1X = 440;
  const c1H = 65;
  b(C1X, groundY - c1H / 2, 14, c1H, 'ICE');
  b(C1X + chamberW, groundY - c1H / 2, 14, c1H, 'ICE');
  b(C1X + chamberW / 2, groundY - c1H / 2, 14, c1H, 'ICE');
  const c1Floor = groundY - c1H - 6;
  b(C1X + chamberW / 2, c1Floor, chamberW + 30, 12, 'STONE');

  const c1pH2 = 45;
  b(C1X + 15, c1Floor - 6 - c1pH2 / 2, 14, c1pH2, 'ICE');
  b(C1X + chamberW - 15, c1Floor - 6 - c1pH2 / 2, 14, c1pH2, 'ICE');
  const c1Floor2 = c1Floor - 6 - c1pH2 - 6;
  b(C1X + chamberW / 2, c1Floor2, chamberW + 10, 12, 'ICE');

  // Ice bridge 1
  const bridge1X = C1X + chamberW + 35;
  const bridgeW = 50;
  b(bridge1X + bridgeW / 2, groundY - 50 / 2, 10, 50, 'ICE');
  b(bridge1X + bridgeW / 2, groundY - 50 - 6, bridgeW + 20, 12, 'ICE');
  ctx.barrel(bridge1X + bridgeW / 2, groundY - 18);

  // Chamber 2 (center, mixed)
  const C2X = bridge1X + bridgeW + 35;
  const c2H = 70;
  b(C2X, groundY - c2H / 2, 16, c2H, 'STONE');
  b(C2X + chamberW, groundY - c2H / 2, 16, c2H, 'STONE');
  b(C2X + chamberW / 2, groundY - c2H / 2, 14, c2H, 'ICE');
  const c2Floor = groundY - c2H - 6;
  b(C2X + chamberW / 2, c2Floor, chamberW + 30, 12, 'STONE');

  const c2pH2 = 50;
  b(C2X + 15, c2Floor - 6 - c2pH2 / 2, 14, c2pH2, 'ICE');
  b(C2X + chamberW - 15, c2Floor - 6 - c2pH2 / 2, 14, c2pH2, 'ICE');
  const c2Floor2 = c2Floor - 6 - c2pH2 - 6;
  b(C2X + chamberW / 2, c2Floor2, chamberW + 10, 12, 'STONE');

  // Ice bridge 2
  const bridge2X = C2X + chamberW + 35;
  b(bridge2X + bridgeW / 2, groundY - 55 / 2, 10, 55, 'ICE');
  b(bridge2X + bridgeW / 2, groundY - 55 - 6, bridgeW + 20, 12, 'ICE');
  ctx.barrel(bridge2X + bridgeW / 2, groundY - 18);

  // Chamber 3 (right, heavy — boss chamber)
  const C3X = bridge2X + bridgeW + 35;
  const c3H = 75;
  b(C3X, groundY - c3H / 2, 18, c3H, 'ICE');
  b(C3X + chamberW, groundY - c3H / 2, 18, c3H, 'ICE');
  const c3Floor = groundY - c3H - 6;
  b(C3X + chamberW / 2, c3Floor, chamberW + 40, 14, 'STONE');

  const c3pH2 = 55;
  b(C3X + 15, c3Floor - 6 - c3pH2 / 2, 14, c3pH2, 'ICE');
  b(C3X + chamberW - 15, c3Floor - 6 - c3pH2 / 2, 14, c3pH2, 'ICE');
  const c3Floor2 = c3Floor - 6 - c3pH2 - 6;
  b(C3X + chamberW / 2, c3Floor2, chamberW + 20, 14, 'STONE');
  b(C3X + chamberW / 2 - 25, c3Floor2 - 6 - 16, 40, 32, 'STONE');
  b(C3X + chamberW / 2 + 25, c3Floor2 - 6 - 16, 40, 32, 'STONE');

  ctx.barrel(C1X + chamberW / 2, groundY - 18);
  ctx.barrel(C2X + chamberW / 2, groundY - 18);
  ctx.barrel(C3X + chamberW / 2, c3Floor - 6 - 18);

  ctx.hazard('ICE_PATCH', C1X + chamberW / 2, groundY - 10);
  ctx.hazard('ICE_PATCH', C2X + chamberW / 2, groundY - 10);
  ctx.hazard('ICE_PATCH', C3X + chamberW / 2, groundY - 10);

  const eR = 20;
  ctx.enemySlots.push(
    { x: C1X + chamberW / 2, y: c1Floor - 6 - eR },
    { x: C1X + chamberW / 2, y: c1Floor2 - 6 - eR },
    { x: C2X + chamberW / 2, y: c2Floor - 6 - eR },
    { x: C2X + chamberW / 2, y: c2Floor2 - 6 - eR },
    { x: C3X + chamberW / 2, y: c3Floor - 6 - eR },
    { x: C3X + chamberW / 2, y: c3Floor2 - 6 - 32 - eR },
  );
};

// ─── "Ice Queen Lair" — massive ice throne with cascading ice platforms ────
export const iceQueenLair: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Front ice gate
  const GX = 440;
  b(GX, groundY - 85 / 2, 22, 85, 'ICE');
  b(GX + 60, groundY - 85 / 2, 22, 85, 'ICE');
  b(GX + 30, groundY - 85 - 6, 80, 14, 'ICE');

  // Main ice hall
  const HX = 550;
  const hallW = 200;
  b(HX, groundY - 75 / 2, 18, 75, 'ICE');
  b(HX + hallW, groundY - 75 / 2, 18, 75, 'ICE');
  b(HX + hallW / 3, groundY - 75 / 2, 14, 75, 'ICE');
  b(HX + hallW * 2 / 3, groundY - 75 / 2, 14, 75, 'WOOD');
  const hf1 = groundY - 75 - 6;
  b(HX + hallW / 2, hf1, hallW + 30, 14, 'STONE');

  // Upper levels
  b(HX + 20, hf1 - 6 - 55 / 2, 14, 55, 'ICE');
  b(HX + hallW - 20, hf1 - 6 - 55 / 2, 14, 55, 'ICE');
  b(HX + hallW / 2, hf1 - 6 - 55 / 2, 14, 55, 'ICE');
  const hf2 = hf1 - 6 - 55 - 6;
  b(HX + hallW / 2, hf2, hallW + 10, 12, 'ICE');

  // Throne platform with heavy stone
  const throneX = HX + hallW / 2;
  b(throneX - 35, hf2 - 6 - 45 / 2, 14, 45, 'ICE');
  b(throneX + 35, hf2 - 6 - 45 / 2, 14, 45, 'ICE');
  const tf = hf2 - 6 - 45 - 6;
  b(throneX, tf, 90, 12, 'STONE');
  b(throneX, tf - 6 - 16, 40, 28, 'STONE');

  // Rear icy tower
  const RX = 860;
  b(RX, groundY - 70 / 2, 14, 70, 'ICE');
  b(RX + 70, groundY - 70 / 2, 14, 70, 'ICE');
  const rf1 = groundY - 70 - 6;
  b(RX + 35, rf1, 90, 12, 'STONE');
  b(RX + 35, rf1 - 6 - 14, 28, 28, 'STONE');

  ctx.barrel(HX + hallW / 3, groundY - 18);
  ctx.barrel(HX + hallW * 2 / 3, groundY - 18);
  ctx.barrel(throneX, hf1 - 6 - 18);
  ctx.barrel(GX + 30, groundY - 18);

  ctx.hazard('ICE_PATCH', HX + hallW / 4, groundY - 10);
  ctx.hazard('ICE_PATCH', HX + hallW * 3 / 4, groundY - 10);
  ctx.hazard('ICE_PATCH', GX + 30, groundY - 10);

  const eR = 20;
  ctx.enemySlots.push(
    { x: GX + 30, y: groundY - 85 - 6 - 6 - eR },
    { x: HX + hallW / 3, y: hf1 - 6 - eR },
    { x: HX + hallW * 2 / 3, y: hf1 - 6 - eR },
    { x: throneX, y: hf2 - 6 - eR },
    { x: throneX, y: tf - 6 - 28 - eR },
    { x: RX + 35, y: rf1 - 6 - 28 - eR },
  );
};

// ─── "Frozen Gauntlet" — multi-wall ice defense with cascading hazards ─────
export const frozenGauntlet: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // 3 progressively thicker ice walls
  const walls = [
    { x: 460, h: 60, w: 18 },
    { x: 590, h: 70, w: 22 },
    { x: 730, h: 80, w: 26 },
  ];

  for (const wall of walls) {
    b(wall.x, groundY - wall.h / 2, wall.w, wall.h, 'ICE');
    b(wall.x, groundY - wall.h - 6 - 14, 28, 28, 'STONE');
  }

  // Structures between walls
  // Between wall 1 and 2 — ice platform with enemy
  b(525, groundY - 50 / 2, 12, 50, 'ICE');
  b(525, groundY - 50 - 6, 60, 10, 'ICE');

  // Between wall 2 and 3 — taller ice structure
  b(660, groundY - 60 / 2, 12, 60, 'ICE');
  b(660, groundY - 60 - 6, 70, 12, 'STONE');

  // Final compound behind last wall — heavily fortified
  const FX = 820;
  b(FX, groundY - 75 / 2, 18, 75, 'ICE');
  b(FX + 110, groundY - 75 / 2, 18, 75, 'ICE');
  const ff1 = groundY - 75 - 6;
  b(FX + 55, ff1, 140, 14, 'STONE');
  b(FX + 55, ff1 - 6 - 55 / 2, 14, 55, 'ICE');
  const ff2 = ff1 - 6 - 55 - 6;
  b(FX + 55, ff2, 80, 12, 'STONE');
  b(FX + 55, ff2 - 6 - 14, 36, 28, 'STONE');

  ctx.barrel(525, groundY - 18);
  ctx.barrel(660, groundY - 18);
  ctx.barrel(FX + 55, groundY - 18);
  ctx.barrel(FX + 55, ff1 - 6 - 18);

  ctx.hazard('ICE_PATCH', 490, groundY - 10);
  ctx.hazard('ICE_PATCH', 625, groundY - 10);
  ctx.hazard('ICE_PATCH', FX + 55, groundY - 10);

  const eR = 20;
  ctx.enemySlots.push(
    { x: 525, y: groundY - 50 - 6 - 6 - eR },
    { x: 660, y: groundY - 60 - 6 - 6 - eR },
    { x: FX + 55, y: ff1 - 6 - eR },
    { x: FX + 55, y: ff2 - 6 - 28 - eR },
    { x: 460, y: groundY - 60 - 6 - 28 - eR },
    { x: 730, y: groundY - 80 - 6 - 28 - eR },
  );
};

export const diff5Templates: TemplateFn[] = [
  frostThrone,
  glacierCitadel,
  iceQueenLair,
  frozenGauntlet,
];
