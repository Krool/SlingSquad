import type { TemplateFn } from '../types';
import { raisedPlatform, tunnel } from '../shared';

// ─── "The Citadel" — multi-wing palace (migrated boss template) ─────────────
export const theCitadel: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const span = 100;
  const pillarH = 70;

  const buildLevel = (cx: number, baseY: number, pH: number, plankW: number) => {
    b(cx - span / 2, baseY - pH / 2, 14, pH, 'WOOD');
    b(cx + span / 2, baseY - pH / 2, 14, pH, 'WOOD');
    const floorY = baseY - pH - 6;
    b(cx, floorY, plankW, 12, 'STONE');
    return floorY;
  };

  // Left wing: 3-level tower
  const LX = 482;
  const lf1 = buildLevel(LX, groundY, pillarH, 140);
  const lf2 = buildLevel(LX, lf1 - 6, 55, 140);
  const lf3 = buildLevel(LX, lf2 - 6, 45, 100);
  b(LX, lf3 - 20, 28, 28, 'STONE');

  // Center grand hall: 4 levels
  const CX = 680;
  const hallSpan = 140;

  b(CX - hallSpan / 2, groundY - pillarH / 2, 14, pillarH, 'WOOD');
  b(CX, groundY - pillarH / 2, 14, pillarH, 'WOOD');
  b(CX + hallSpan / 2, groundY - pillarH / 2, 14, pillarH, 'WOOD');
  const cf1 = groundY - pillarH - 6;
  b(CX, cf1, hallSpan + 40, 12, 'STONE');

  const cPH2 = 60;
  b(CX - hallSpan / 2, cf1 - 6 - cPH2 / 2, 14, cPH2, 'WOOD');
  b(CX + hallSpan / 2, cf1 - 6 - cPH2 / 2, 14, cPH2, 'WOOD');
  const cf2 = cf1 - 6 - cPH2 - 6;
  b(CX, cf2, hallSpan + 40, 12, 'STONE');

  const cPH3 = 50;
  b(CX - span / 2, cf2 - 6 - cPH3 / 2, 14, cPH3, 'WOOD');
  b(CX + span / 2, cf2 - 6 - cPH3 / 2, 14, cPH3, 'WOOD');
  const cf3 = cf2 - 6 - cPH3 - 6;
  b(CX, cf3, 140, 12, 'STONE');

  const throneH = 40;
  b(CX, cf3 - 6 - throneH / 2, 14, throneH, 'WOOD');
  const throneFloor = cf3 - 6 - throneH - 6;
  b(CX, throneFloor, 100, 12, 'STONE');
  b(CX - 30, throneFloor - 18, 50, 24, 'STONE');
  b(CX + 30, throneFloor - 18, 50, 24, 'STONE');

  // Right wing: 3-level tower
  const RX = 940;
  const rf1 = buildLevel(RX, groundY, pillarH, 140);
  const rf2 = buildLevel(RX, rf1 - 6, 55, 140);
  const rf3 = buildLevel(RX, rf2 - 6, 45, 100);
  b(RX, rf3 - 20, 28, 28, 'STONE');

  // Connecting bridges
  const lBridgeX = (LX + 70 + CX - 90) / 2;
  const lBridgeW = (CX - 90) - (LX + 70);
  b(lBridgeX, cf1, lBridgeW, 12, 'WOOD');
  b(lBridgeX, groundY - pillarH / 2, 14, pillarH, 'WOOD');

  const rBridgeX = (CX + 90 + RX - 70) / 2;
  const rBridgeW = (RX - 70) - (CX + 90);
  b(rBridgeX, cf1, rBridgeW, 12, 'WOOD');
  b(rBridgeX, groundY - pillarH / 2, 14, pillarH, 'WOOD');

  ctx.barrel(LX, groundY - 18);
  ctx.barrel(CX - hallSpan / 4, groundY - 18);
  ctx.barrel(RX, groundY - 18);
  ctx.barrel(CX + 40, cf1 - 6 - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: LX, y: lf1 - 6 - eR },
    { x: CX, y: cf1 - 6 - eR },
    { x: RX, y: rf1 - 6 - eR },
    { x: CX, y: cf2 - 6 - eR },
    { x: CX, y: throneFloor - 6 - 24 - eR },
    { x: lBridgeX, y: cf1 - 6 - eR },
  );

  // Coins (~30g)
  ctx.coin(430, 280, 4);                          // approach — arc path
  ctx.coin(CX, throneFloor - 30, 6);             // treasury — above throne cap stones
  ctx.coin(LX, lf3 - 30, 5);                     // structure — above left wing cap
  ctx.coin(RX, rf3 - 30, 5);                     // structure — above right wing cap
  ctx.coin(CX - hallSpan / 4, groundY - 18, 5);  // risky — near ground barrel
  ctx.coin(lBridgeX, cf1 - 20, 5);               // structure — above left bridge

  // Terrain — mound in center courtyard
  raisedPlatform(ctx, 700, groundY, 100, 18);
};

// ─── "The Gauntlet" — 3 connected chambers (migrated boss template) ─────────
export const theGauntlet: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const chamberW = 110;

  // Chamber 1 (left, wood)
  const C1X = 440;
  const c1H = 65;
  b(C1X, groundY - c1H / 2, 14, c1H, 'WOOD');
  b(C1X + chamberW, groundY - c1H / 2, 14, c1H, 'WOOD');
  b(C1X + chamberW / 2, groundY - c1H / 2, 14, c1H, 'WOOD');
  const c1Floor = groundY - c1H - 6;
  b(C1X + chamberW / 2, c1Floor, chamberW + 30, 12, 'STONE');

  const c1pH2 = 45;
  b(C1X + 15, c1Floor - 6 - c1pH2 / 2, 14, c1pH2, 'WOOD');
  b(C1X + chamberW - 15, c1Floor - 6 - c1pH2 / 2, 14, c1pH2, 'WOOD');
  const c1Floor2 = c1Floor - 6 - c1pH2 - 6;
  b(C1X + chamberW / 2, c1Floor2, chamberW + 10, 12, 'STONE');

  // Bridge 1
  const bridge1X = C1X + chamberW + 35;
  const bridgeW = 50;
  b(bridge1X + bridgeW / 2, groundY - 50 / 2, 14, 50, 'WOOD');
  b(bridge1X + bridgeW / 2, groundY - 50 - 6, bridgeW + 20, 12, 'WOOD');
  ctx.barrel(bridge1X + bridgeW / 2, groundY - 18);

  // Chamber 2 (center, mixed)
  const C2X = bridge1X + bridgeW + 35;
  const c2H = 70;
  b(C2X, groundY - c2H / 2, 16, c2H, 'STONE');
  b(C2X + chamberW, groundY - c2H / 2, 16, c2H, 'STONE');
  b(C2X + chamberW / 2, groundY - c2H / 2, 14, c2H, 'WOOD');
  const c2Floor = groundY - c2H - 6;
  b(C2X + chamberW / 2, c2Floor, chamberW + 30, 12, 'STONE');

  const c2pH2 = 50;
  b(C2X + 15, c2Floor - 6 - c2pH2 / 2, 14, c2pH2, 'WOOD');
  b(C2X + chamberW - 15, c2Floor - 6 - c2pH2 / 2, 14, c2pH2, 'WOOD');
  const c2Floor2 = c2Floor - 6 - c2pH2 - 6;
  b(C2X + chamberW / 2, c2Floor2, chamberW + 10, 12, 'STONE');

  // Bridge 2
  const bridge2X = C2X + chamberW + 35;
  b(bridge2X + bridgeW / 2, groundY - 55 / 2, 14, 55, 'WOOD');
  b(bridge2X + bridgeW / 2, groundY - 55 - 6, bridgeW + 20, 12, 'WOOD');
  ctx.barrel(bridge2X + bridgeW / 2, groundY - 18);

  // Chamber 3 (right, heavy stone — boss chamber)
  const C3X = bridge2X + bridgeW + 35;
  const c3H = 75;
  b(C3X, groundY - c3H / 2, 18, c3H, 'STONE');
  b(C3X + chamberW, groundY - c3H / 2, 18, c3H, 'STONE');
  const c3Floor = groundY - c3H - 6;
  b(C3X + chamberW / 2, c3Floor, chamberW + 40, 14, 'STONE');

  const c3pH2 = 55;
  b(C3X + 15, c3Floor - 6 - c3pH2 / 2, 16, c3pH2, 'STONE');
  b(C3X + chamberW - 15, c3Floor - 6 - c3pH2 / 2, 16, c3pH2, 'STONE');
  const c3Floor2 = c3Floor - 6 - c3pH2 - 6;
  b(C3X + chamberW / 2, c3Floor2, chamberW + 20, 14, 'STONE');
  b(C3X + chamberW / 2 - 25, c3Floor2 - 6 - 16, 40, 32, 'STONE');
  b(C3X + chamberW / 2 + 25, c3Floor2 - 6 - 16, 40, 32, 'STONE');

  ctx.barrel(C1X + chamberW / 2, groundY - 18);
  ctx.barrel(C2X + chamberW / 2, groundY - 18);
  ctx.barrel(C3X + chamberW / 2, c3Floor - 6 - 18);

  // Spike traps between chambers
  ctx.hazard('SPIKE_TRAP', bridge1X + bridgeW / 2, groundY - 5);
  ctx.hazard('SPIKE_TRAP', bridge2X + bridgeW / 2, groundY - 5);

  const eR = 20;
  ctx.enemySlots.push(
    { x: C1X + chamberW / 2, y: c1Floor - 6 - eR },
    { x: C2X + chamberW / 2, y: c2Floor - 6 - eR },
    { x: C2X + chamberW / 2, y: c2Floor2 - 6 - eR },
    { x: C3X + chamberW / 2, y: c3Floor - 6 - eR },
    { x: C3X + chamberW / 2, y: c3Floor2 - 6 - 32 - eR },
    { x: C1X + chamberW / 2, y: c1Floor2 - 6 - eR },
  );

  // Coins (~30g)
  ctx.coin(430, 300, 4);                                     // approach — arc path
  ctx.coin(C1X + chamberW / 2, c1Floor2 - 20, 5);           // structure — above chamber 1 top
  ctx.coin(C2X + chamberW / 2, c2Floor2 - 20, 5);           // structure — above chamber 2 top
  ctx.coin(C3X + chamberW / 2, c3Floor2 - 6 - 40, 6);       // treasury — above boss chamber cap
  ctx.coin(bridge1X + bridgeW / 2, groundY - 18, 5);        // risky — near bridge 1 barrel + spike
  ctx.coin(C3X + chamberW / 2, c3Floor - 6 - 18, 5);        // risky — near boss barrel
};

// ─── "Goblin Throne" — massive goblin king lair ─────────────────────────────
export const goblinThrone: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Front gate
  const GX = 440;
  b(GX, groundY - 80 / 2, 22, 80, 'STONE');
  b(GX + 60, groundY - 80 / 2, 22, 80, 'STONE');
  b(GX + 30, groundY - 80 - 6, 80, 14, 'STONE');

  // Main hall
  const HX = 560;
  const hallW = 200;
  b(HX, groundY - 70 / 2, 16, 70, 'STONE');
  b(HX + hallW, groundY - 70 / 2, 16, 70, 'STONE');
  b(HX + hallW / 3, groundY - 70 / 2, 14, 70, 'WOOD');
  b(HX + hallW * 2 / 3, groundY - 70 / 2, 14, 70, 'WOOD');
  const hf1 = groundY - 70 - 6;
  b(HX + hallW / 2, hf1, hallW + 30, 14, 'STONE');

  // Upper levels
  b(HX + 20, hf1 - 6 - 55 / 2, 14, 55, 'WOOD');
  b(HX + hallW - 20, hf1 - 6 - 55 / 2, 14, 55, 'WOOD');
  b(HX + hallW / 2, hf1 - 6 - 55 / 2, 14, 55, 'WOOD');
  const hf2 = hf1 - 6 - 55 - 6;
  b(HX + hallW / 2, hf2, hallW + 10, 12, 'STONE');

  // Throne platform
  const throneX = HX + hallW / 2;
  b(throneX - 30, hf2 - 6 - 40 / 2, 14, 40, 'WOOD');
  b(throneX + 30, hf2 - 6 - 40 / 2, 14, 40, 'WOOD');
  const tf = hf2 - 6 - 40 - 6;
  b(throneX, tf, 80, 12, 'STONE');
  b(throneX, tf - 18, 36, 28, 'STONE');

  // Rear tower
  const RX = 870;
  b(RX, groundY - 65 / 2, 14, 65, 'WOOD');
  b(RX + 70, groundY - 65 / 2, 14, 65, 'WOOD');
  const rf1 = groundY - 65 - 6;
  b(RX + 35, rf1, 90, 12, 'STONE');
  b(RX + 35, rf1 - 6 - 14, 28, 28, 'STONE');

  ctx.barrel(HX + hallW / 3, groundY - 18);
  ctx.barrel(HX + hallW * 2 / 3, groundY - 18);
  ctx.barrel(throneX, hf1 - 6 - 18);
  ctx.barrel(GX + 30, groundY - 18);
  ctx.barrel(RX + 35, groundY - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: HX + hallW / 3, y: hf1 - 6 - eR },
    { x: HX + hallW * 2 / 3, y: hf1 - 6 - eR },
    { x: throneX, y: hf2 - 6 - eR },
    { x: throneX, y: tf - 6 - 28 - eR },
    { x: RX + 35, y: rf1 - 6 - 28 - eR },
    { x: GX + 30, y: groundY - 80 - 6 - 6 - eR },
  );

  // Coins (~32g)
  ctx.coin(430, 290, 4);                          // approach — arc path
  ctx.coin(throneX, tf - 30, 6);                  // treasury — above throne platform
  ctx.coin(GX + 30, groundY - 80 - 20, 5);       // structure — above gate
  ctx.coin(HX + hallW / 2, hf2 - 20, 5);         // structure — above upper hall
  ctx.coin(HX + hallW / 3, groundY - 18, 6);     // risky — near hall barrel
  ctx.coin(RX + 35, groundY - 18, 6);            // risky — near rear tower barrel

  // Terrain — stepped approach to throne hall
  raisedPlatform(ctx, 600, groundY, 140, 24);
  // Terrain — front gate tunnel
  tunnel(ctx, 480, 560, groundY, 50, 'WOOD', 'STONE');
};

// ─── "Siege Breaker" — multi-wall defense ──────────────────────────────────
export const siegeBreaker: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // 3 progressively thicker walls
  const walls = [
    { x: 460, h: 60, w: 18, mat: 'WOOD' as const },
    { x: 600, h: 70, w: 22, mat: 'STONE' as const },
    { x: 750, h: 80, w: 26, mat: 'STONE' as const },
  ];

  for (const wall of walls) {
    b(wall.x, groundY - wall.h / 2, wall.w, wall.h, wall.mat);
    b(wall.x, groundY - wall.h - 6 - 14, 28, 28, 'STONE');
  }

  // Structures between walls
  // Between wall 1 and 2
  b(530, groundY - 50 / 2, 14, 50, 'WOOD');
  b(530, groundY - 50 - 6, 60, 10, 'WOOD');

  // Between wall 2 and 3
  b(670, groundY - 55 / 2, 14, 55, 'WOOD');
  b(670, groundY - 55 - 6, 70, 12, 'STONE');

  // Final compound behind last wall
  const FX = 830;
  b(FX, groundY - 70 / 2, 16, 70, 'STONE');
  b(FX + 100, groundY - 70 / 2, 16, 70, 'STONE');
  const ff1 = groundY - 70 - 6;
  b(FX + 50, ff1, 130, 14, 'STONE');
  b(FX + 50, ff1 - 6 - 50 / 2, 14, 50, 'WOOD');
  const ff2 = ff1 - 6 - 50 - 6;
  b(FX + 50, ff2, 80, 12, 'STONE');
  b(FX + 50, ff2 - 18, 36, 28, 'STONE');

  ctx.barrel(530, groundY - 18);
  ctx.barrel(670, groundY - 18);
  ctx.barrel(FX + 50, groundY - 18);
  ctx.barrel(FX + 50, ff1 - 6 - 18);

  ctx.hazard('SPIKE_TRAP', 500, groundY - 10);
  ctx.hazard('SPIKE_TRAP', 640, groundY - 10);

  const eR = 20;
  ctx.enemySlots.push(
    { x: 530, y: groundY - 50 - 6 - 6 - eR },
    { x: 670, y: groundY - 55 - 6 - 6 - eR },
    { x: FX + 50, y: ff1 - 6 - eR },
    { x: FX + 50, y: ff2 - 6 - 28 - eR },
    { x: 460, y: groundY - 60 - 6 - 28 - eR },
    { x: 750, y: groundY - 80 - 6 - 28 - eR },
  );

  // Coins (~30g)
  ctx.coin(430, 300, 4);                          // approach — arc path
  ctx.coin(FX + 50, ff2 - 30, 6);                // treasury — above final compound cap
  ctx.coin(530, groundY - 50 - 18, 5);           // structure — above first structure
  ctx.coin(670, groundY - 55 - 18, 5);           // structure — above second structure
  ctx.coin(530, groundY - 18, 5);                // risky — near barrel + spike trap
  ctx.coin(FX + 50, ff1 - 6 - 18, 5);            // risky — near compound barrel
};

export const diff5Templates: TemplateFn[] = [
  theCitadel,
  theGauntlet,
  goblinThrone,
  siegeBreaker,
];
