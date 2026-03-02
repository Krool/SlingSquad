import type { TemplateFn } from '../types';
import { raisedPlatform, tunnel, treasuryRoom, capBlock } from '../shared';

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

// ─── "The Grand Stockade" — massive palisade + courtyard + grand hall + treasury (~68 blocks) ──
export const grandStockade: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // ── Front Palisade: 2 STONE gateposts + lintel ──
  const GX = 420;
  const gateH = 90;
  b(GX, groundY - gateH / 2, 20, gateH, 'STONE');       // left gatepost
  b(GX + 70, groundY - gateH / 2, 20, gateH, 'STONE');  // right gatepost
  b(GX + 35, groundY - gateH - 6, 90, 14, 'STONE');      // lintel
  capBlock(ctx, GX, groundY - gateH - 6, 'STONE', 24);   // left battlement
  capBlock(ctx, GX + 70, groundY - gateH - 6, 'STONE', 24); // right battlement

  // ── Left Watchtower (2 levels) ──
  const LTX = 380;
  const ltSpan = 60;
  // Level 1
  b(LTX - ltSpan / 2, groundY - 70 / 2, 14, 70, 'WOOD');
  b(LTX + ltSpan / 2, groundY - 70 / 2, 14, 70, 'WOOD');
  const ltf1 = groundY - 70 - 6;
  b(LTX, ltf1, ltSpan + 20, 12, 'STONE');
  // Level 2
  b(LTX - 20, ltf1 - 6 - 50 / 2, 14, 50, 'WOOD');
  b(LTX + 20, ltf1 - 6 - 50 / 2, 14, 50, 'WOOD');
  const ltf2 = ltf1 - 6 - 50 - 6;
  b(LTX, ltf2, ltSpan + 10, 12, 'STONE');
  capBlock(ctx, LTX, ltf2, 'STONE', 24);

  // ── Right Watchtower (2 levels, taller) ──
  const RTX = 530;
  // Level 1
  b(RTX - ltSpan / 2, groundY - 75 / 2, 14, 75, 'WOOD');
  b(RTX + ltSpan / 2, groundY - 75 / 2, 14, 75, 'WOOD');
  const rtf1 = groundY - 75 - 6;
  b(RTX, rtf1, ltSpan + 20, 12, 'STONE');
  // Level 2
  b(RTX - 20, rtf1 - 6 - 55 / 2, 14, 55, 'WOOD');
  b(RTX + 20, rtf1 - 6 - 55 / 2, 14, 55, 'WOOD');
  const rtf2 = rtf1 - 6 - 55 - 6;
  b(RTX, rtf2, ltSpan + 10, 12, 'STONE');
  capBlock(ctx, RTX, rtf2, 'STONE', 24);

  // ── Courtyard: 2 small barracks ──
  const BX1 = 570;
  b(BX1, groundY - 50 / 2, 14, 50, 'WOOD');
  b(BX1 + 60, groundY - 50 / 2, 14, 50, 'WOOD');
  const bk1f = groundY - 50 - 6;
  b(BX1 + 30, bk1f, 80, 10, 'WOOD');

  const BX2 = 640;
  b(BX2, groundY - 55 / 2, 14, 55, 'WOOD');
  b(BX2 + 60, groundY - 55 / 2, 14, 55, 'WOOD');
  const bk2f = groundY - 55 - 6;
  b(BX2 + 30, bk2f, 80, 10, 'WOOD');

  // ── Grand Hall (centerpiece): 4 levels ──
  const HX = 720;
  const hallSpan = 160;
  // Level 1 — 6 pillars (wide STONE base)
  b(HX - hallSpan / 2, groundY - 80 / 2, 18, 80, 'STONE');
  b(HX - hallSpan / 4, groundY - 80 / 2, 14, 80, 'WOOD');
  b(HX, groundY - 80 / 2, 14, 80, 'WOOD');
  b(HX + hallSpan / 4, groundY - 80 / 2, 14, 80, 'WOOD');
  b(HX + hallSpan / 2, groundY - 80 / 2, 18, 80, 'STONE');
  b(HX + hallSpan / 6, groundY - 80 / 2, 14, 80, 'WOOD');
  const hf1 = groundY - 80 - 6;
  b(HX, hf1, hallSpan + 40, 14, 'STONE');
  // Level 2 — narrower
  b(HX - hallSpan / 3, hf1 - 6 - 65 / 2, 14, 65, 'WOOD');
  b(HX, hf1 - 6 - 65 / 2, 14, 65, 'WOOD');
  b(HX + hallSpan / 3, hf1 - 6 - 65 / 2, 14, 65, 'WOOD');
  const hf2 = hf1 - 6 - 65 - 6;
  b(HX, hf2, hallSpan + 20, 12, 'STONE');
  // Level 3 — narrower still
  b(HX - 40, hf2 - 6 - 55 / 2, 14, 55, 'WOOD');
  b(HX + 40, hf2 - 6 - 55 / 2, 14, 55, 'WOOD');
  const hf3 = hf2 - 6 - 55 - 6;
  b(HX, hf3, 120, 12, 'STONE');
  // Level 4 — throne platform
  b(HX, hf3 - 6 - 40 / 2, 14, 40, 'WOOD');
  const throneF = hf3 - 6 - 40 - 6;
  b(HX, throneF, 80, 12, 'STONE');
  b(HX - 25, throneF - 6 - 14, 40, 24, 'STONE');
  b(HX + 25, throneF - 6 - 14, 40, 24, 'STONE');

  // ── Rear Treasury Tower (3 levels, STONE) ──
  const TX = 940;
  const tSpan = 70;
  // Level 1
  b(TX - tSpan / 2, groundY - 70 / 2, 16, 70, 'STONE');
  b(TX + tSpan / 2, groundY - 70 / 2, 16, 70, 'STONE');
  const tf1 = groundY - 70 - 6;
  b(TX, tf1, tSpan + 20, 12, 'STONE');
  // Level 2
  b(TX - 25, tf1 - 6 - 55 / 2, 14, 55, 'WOOD');
  b(TX + 25, tf1 - 6 - 55 / 2, 14, 55, 'WOOD');
  const tf2 = tf1 - 6 - 55 - 6;
  b(TX, tf2, tSpan + 10, 12, 'STONE');
  // Level 3
  b(TX, tf2 - 6 - 40 / 2, 14, 40, 'WOOD');
  const tf3 = tf2 - 6 - 40 - 6;
  b(TX, tf3, 50, 12, 'STONE');
  capBlock(ctx, TX, tf3, 'STONE', 24);

  // Treasury room inside rear tower base
  treasuryRoom(ctx, TX, groundY, 60, 50, 'WOOD', 6);

  // ── WOOD bridges connecting watchtowers to hall ──
  b((RTX + HX - hallSpan / 2) / 2, rtf1, 70, 10, 'WOOD');   // right tower → hall
  b((LTX + GX) / 2, ltf1, 50, 10, 'WOOD');                   // left tower → gate

  // ── Raised platform in courtyard ──
  raisedPlatform(ctx, 620, groundY, 100, 20);

  // ── Barrels (7) ──
  ctx.barrel(GX + 35, groundY - 18);          // under gate
  ctx.barrel(BX1 + 30, groundY - 18);         // barracks 1
  ctx.barrel(BX2 + 30, groundY - 18);         // barracks 2
  ctx.barrel(HX - hallSpan / 4, groundY - 18); // hall ground left
  ctx.barrel(HX + hallSpan / 4, hf1 - 6 - 18); // hall level 1
  ctx.barrel(TX, groundY - 18);               // treasury ground
  ctx.barrel(HX, hf2 - 6 - 18);              // hall level 2

  // ── Spike traps (3) ──
  ctx.hazard('SPIKE_TRAP', BX1 + 30, groundY - 5);
  ctx.hazard('SPIKE_TRAP', HX - 60, groundY - 5);
  ctx.hazard('SPIKE_TRAP', TX - 50, groundY - 5);

  // ── Enemy Slots (10) ──
  ctx.enemySlots.push(
    { x: LTX, y: ltf2 - 6 - 24 - eR },            // left watchtower top
    { x: RTX, y: rtf1 - 6 - eR },                  // right watchtower level 1
    { x: BX1 + 30, y: bk1f - 6 - eR },             // barracks 1
    { x: BX2 + 30, y: bk2f - 6 - eR },             // barracks 2
    { x: HX - hallSpan / 3, y: hf1 - 6 - eR },     // hall level 1 left
    { x: HX + hallSpan / 3, y: hf1 - 6 - eR },     // hall level 1 right
    { x: HX, y: hf2 - 6 - eR },                    // hall level 2
    { x: HX, y: throneF - 6 - 24 - eR },           // throne (boss)
    { x: TX, y: tf1 - 6 - eR },                    // treasury level 1
    { x: TX, y: tf3 - 6 - 24 - eR },               // treasury top
  );

  // ── Coins (~45g) ──
  ctx.coin(400, 260, 4);                            // approach — arc path
  ctx.coin(HX, throneF - 40, 7);                   // treasury — throne platform
  ctx.coin(TX, tf3 - 30, 6);                       // treasury — rear tower pinnacle
  ctx.coin(LTX, ltf2 - 30, 5);                     // structure — left watchtower top
  ctx.coin(RTX, rtf2 - 30, 5);                     // structure — right watchtower top
  ctx.coin(HX, hf3 - 20, 5);                       // structure — hall level 3
  ctx.coin(GX + 35, groundY - 18, 4);              // risky — near gate barrel
  ctx.coin(BX2 + 30, groundY - 18, 4);             // risky — near barracks barrel
  ctx.coin(HX - hallSpan / 4, groundY - 18, 5);    // risky — near hall barrel
};

// ─── "The War Machine" — siege tower + flanking bunkers + walkways (~71 blocks) ──
export const warMachine: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // ── Approach Ramp ──
  const RMP = 410;
  b(RMP, groundY - 35 / 2, 50, 35, 'STONE');
  b(RMP + 40, groundY - 25 / 2, 40, 25, 'STONE');
  capBlock(ctx, RMP, groundY - 35, 'STONE', 20);

  // ── Left Bunker (2 levels, wide) ──
  const LBX = 480;
  const bunkerW = 110;
  // Level 1 — 3 pillars
  b(LBX, groundY - 75 / 2, 16, 75, 'STONE');
  b(LBX + bunkerW / 2, groundY - 75 / 2, 14, 75, 'WOOD');
  b(LBX + bunkerW, groundY - 75 / 2, 16, 75, 'STONE');
  const lbf1 = groundY - 75 - 6;
  b(LBX + bunkerW / 2, lbf1, bunkerW + 30, 14, 'STONE');
  // Level 2
  b(LBX + 15, lbf1 - 6 - 55 / 2, 14, 55, 'WOOD');
  b(LBX + bunkerW - 15, lbf1 - 6 - 55 / 2, 14, 55, 'WOOD');
  const lbf2 = lbf1 - 6 - 55 - 6;
  b(LBX + bunkerW / 2, lbf2, bunkerW + 10, 12, 'STONE');
  // Battlements
  capBlock(ctx, LBX + 20, lbf2, 'STONE', 22);
  capBlock(ctx, LBX + bunkerW - 20, lbf2, 'STONE', 22);

  // ── Central Siege Tower (5 levels — the showpiece, reaches y≈260) ──
  const CTX = 700;
  const towerSpan = 100;
  // Level 1 — heavy STONE base
  b(CTX - towerSpan / 2, groundY - 80 / 2, 18, 80, 'STONE');
  b(CTX, groundY - 80 / 2, 14, 80, 'STONE');
  b(CTX + towerSpan / 2, groundY - 80 / 2, 18, 80, 'STONE');
  const tf1 = groundY - 80 - 6;
  b(CTX, tf1, towerSpan + 30, 14, 'STONE');
  // Level 2
  b(CTX - towerSpan / 2 + 5, tf1 - 6 - 65 / 2, 14, 65, 'WOOD');
  b(CTX + towerSpan / 2 - 5, tf1 - 6 - 65 / 2, 14, 65, 'WOOD');
  b(CTX, tf1 - 6 - 65 / 2, 14, 65, 'WOOD');
  const tf2 = tf1 - 6 - 65 - 6;
  b(CTX, tf2, towerSpan + 20, 12, 'STONE');
  // Level 3
  b(CTX - 35, tf2 - 6 - 55 / 2, 14, 55, 'WOOD');
  b(CTX + 35, tf2 - 6 - 55 / 2, 14, 55, 'WOOD');
  const tf3 = tf2 - 6 - 55 - 6;
  b(CTX, tf3, towerSpan + 10, 12, 'STONE');
  // Level 4
  b(CTX - 25, tf3 - 6 - 45 / 2, 14, 45, 'WOOD');
  b(CTX + 25, tf3 - 6 - 45 / 2, 14, 45, 'WOOD');
  const tf4 = tf3 - 6 - 45 - 6;
  b(CTX, tf4, 80, 12, 'STONE');
  // Level 5 — pinnacle
  b(CTX, tf4 - 6 - 35 / 2, 14, 35, 'WOOD');
  const tf5 = tf4 - 6 - 35 - 6;
  b(CTX, tf5, 60, 12, 'STONE');
  b(CTX - 18, tf5 - 6 - 14, 28, 24, 'STONE');
  b(CTX + 18, tf5 - 6 - 14, 28, 24, 'STONE');

  // ── Right Bunker (2 levels, slightly taller) ──
  const RBX = 850;
  // Level 1
  b(RBX, groundY - 80 / 2, 16, 80, 'STONE');
  b(RBX + bunkerW / 2, groundY - 80 / 2, 14, 80, 'WOOD');
  b(RBX + bunkerW, groundY - 80 / 2, 16, 80, 'STONE');
  const rbf1 = groundY - 80 - 6;
  b(RBX + bunkerW / 2, rbf1, bunkerW + 30, 14, 'STONE');
  // Level 2
  b(RBX + 15, rbf1 - 6 - 60 / 2, 14, 60, 'WOOD');
  b(RBX + bunkerW - 15, rbf1 - 6 - 60 / 2, 14, 60, 'WOOD');
  const rbf2 = rbf1 - 6 - 60 - 6;
  b(RBX + bunkerW / 2, rbf2, bunkerW + 10, 12, 'STONE');
  // Battlements
  capBlock(ctx, RBX + 20, rbf2, 'STONE', 22);
  capBlock(ctx, RBX + bunkerW - 20, rbf2, 'STONE', 22);

  // ── Elevated WOOD Walkways (connecting bunkers to siege tower at level 1) ──
  const lwalkCX = (LBX + bunkerW + CTX - towerSpan / 2) / 2;
  const lwalkW = (CTX - towerSpan / 2) - (LBX + bunkerW);
  b(lwalkCX, lbf1, Math.max(lwalkW, 50), 10, 'WOOD');
  b(lwalkCX, groundY - 75 / 2, 14, 75, 'WOOD');         // walkway support

  const rwalkCX = (CTX + towerSpan / 2 + RBX) / 2;
  const rwalkW = RBX - (CTX + towerSpan / 2);
  b(rwalkCX, rbf1, Math.max(rwalkW, 50), 10, 'WOOD');
  b(rwalkCX, groundY - 80 / 2, 14, 80, 'WOOD');         // walkway support

  // ── Rear Guard Post (2 levels) ──
  const GPX = 990;
  b(GPX, groundY - 60 / 2, 14, 60, 'WOOD');
  b(GPX + 55, groundY - 60 / 2, 14, 60, 'WOOD');
  const gpf1 = groundY - 60 - 6;
  b(GPX + 27, gpf1, 75, 10, 'STONE');
  b(GPX + 27, gpf1 - 6 - 40 / 2, 14, 40, 'WOOD');
  const gpf2 = gpf1 - 6 - 40 - 6;
  b(GPX + 27, gpf2, 55, 10, 'STONE');
  capBlock(ctx, GPX + 27, gpf2, 'STONE', 22);

  // ── Crenellation caps on all rooftops ──
  capBlock(ctx, CTX - 20, tf5, 'STONE', 20);
  capBlock(ctx, CTX + 20, tf5, 'STONE', 20);

  // ── Barrels (6) ──
  ctx.barrel(LBX + bunkerW / 2, groundY - 18);    // left bunker ground
  ctx.barrel(CTX - 30, groundY - 18);             // siege tower ground left
  ctx.barrel(CTX + 30, tf1 - 6 - 18);             // siege tower level 1
  ctx.barrel(RBX + bunkerW / 2, groundY - 18);    // right bunker ground
  ctx.barrel(GPX + 27, groundY - 18);             // rear guard post
  ctx.barrel(CTX, tf2 - 6 - 18);                  // siege tower level 2

  // ── Spike traps (2) ──
  ctx.hazard('SPIKE_TRAP', lwalkCX, groundY - 5);
  ctx.hazard('SPIKE_TRAP', rwalkCX, groundY - 5);

  // ── Enemy Slots (10) ──
  ctx.enemySlots.push(
    { x: LBX + bunkerW / 2, y: lbf1 - 6 - eR },       // left bunker level 1
    { x: LBX + bunkerW / 2, y: lbf2 - 6 - 22 - eR },  // left bunker top
    { x: CTX, y: tf1 - 6 - eR },                       // siege tower level 1
    { x: CTX, y: tf2 - 6 - eR },                       // siege tower level 2
    { x: CTX, y: tf4 - 6 - eR },                       // siege tower level 4
    { x: CTX, y: tf5 - 6 - 24 - eR },                  // siege tower pinnacle (boss)
    { x: RBX + bunkerW / 2, y: rbf1 - 6 - eR },       // right bunker level 1
    { x: RBX + bunkerW / 2, y: rbf2 - 6 - 22 - eR },  // right bunker top
    { x: GPX + 27, y: gpf1 - 6 - eR },                // rear guard level 1
    { x: lwalkCX, y: lbf1 - 6 - eR },                  // left walkway
  );

  // ── Coins (~48g) ──
  ctx.coin(390, 250, 4);                              // approach — arc path
  ctx.coin(CTX, tf5 - 30, 7);                         // treasury — siege tower pinnacle
  ctx.coin(CTX, tf3 - 20, 6);                         // structure — siege tower level 3
  ctx.coin(LBX + bunkerW / 2, lbf2 - 30, 5);         // structure — left bunker top
  ctx.coin(RBX + bunkerW / 2, rbf2 - 30, 5);         // structure — right bunker top
  ctx.coin(GPX + 27, gpf2 - 30, 5);                   // structure — rear guard post top
  ctx.coin(LBX + bunkerW / 2, groundY - 18, 5);       // risky — near left barrel
  ctx.coin(CTX - 30, groundY - 18, 5);                // risky — near siege tower barrel
  ctx.coin(RBX + bunkerW / 2, groundY - 18, 6);       // risky — near right barrel
};

export const diff5Templates: TemplateFn[] = [
  theCitadel,
  theGauntlet,
  goblinThrone,
  siegeBreaker,
  grandStockade,
  warMachine,
];
