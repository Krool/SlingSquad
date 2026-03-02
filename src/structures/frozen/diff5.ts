import type { TemplateFn } from '../types';
import { raisedPlatform, tunnel, treasuryRoom, capBlock } from '../shared';

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

  // Coins (~28g total)
  ctx.coin(430, 350, 4);                          // approach — arc path
  ctx.coin(LX, lf2 - 20, 4);                     // structure — left tower mid level
  ctx.coin(CX, cf2 - 20, 5);                     // structure — center hall upper
  ctx.coin(RX, rf2 - 30, 4);                     // structure — right wing upper
  ctx.coin(CX - hallSpan / 4, groundY - 18, 5);  // risky — near center barrel + ice
  ctx.coin(CX, throneFloor - 30, 6);             // treasury — throne platform
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

  // Coins (~29g total)
  ctx.coin(430, 350, 4);                                    // approach — arc path
  ctx.coin(C1X + chamberW / 2, c1Floor2 - 20, 4);          // structure — chamber 1 upper
  ctx.coin(C2X + chamberW / 2, c2Floor2 - 20, 5);          // structure — chamber 2 upper
  ctx.coin(bridge1X + bridgeW / 2, groundY - 18, 5);       // risky — near bridge 1 barrel
  ctx.coin(C2X + chamberW / 2, groundY - 18, 5);           // risky — near chamber 2 ice patch
  ctx.coin(C3X + chamberW / 2, c3Floor2 - 40, 6);          // treasury — deep inside chamber 3
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

  // Coins (~29g total)
  ctx.coin(430, 340, 4);                          // approach — arc path
  ctx.coin(HX + hallW / 3, hf1 - 20, 4);         // structure — hall roof left
  ctx.coin(HX + hallW * 2 / 3, hf2 - 20, 5);     // structure — hall upper right
  ctx.coin(RX + 35, rf1 - 30, 5);                // structure — rear tower top
  ctx.coin(GX + 30, groundY - 18, 5);            // risky — near gate barrel + ice
  ctx.coin(throneX, tf - 40, 6);                 // treasury — throne platform
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

  // Coins (~29g total)
  ctx.coin(430, 330, 4);                        // approach — arc path
  ctx.coin(525, groundY - 70, 4);              // structure — between wall 1-2 platform
  ctx.coin(660, groundY - 80, 5);              // structure — between wall 2-3 platform
  ctx.coin(525, groundY - 18, 5);              // risky — near barrel between walls
  ctx.coin(FX + 55, groundY - 18, 5);          // risky — near compound barrel + ice
  ctx.coin(FX + 55, ff2 - 40, 6);             // treasury — compound top

  // Terrain — ledge between first two walls
  raisedPlatform(ctx, 600, groundY, 120, 22);
  // Terrain — ice tunnel at far end
  tunnel(ctx, 900, 980, groundY, 45, 'ICE', 'ICE');
};

// ─── "The Glacier Cathedral" — twin spires + central nave + crypt (~71 blocks) ──
export const glacierCathedral: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // ── Narthex Entrance (ICE gateposts) ──
  const NX = 410;
  b(NX, groundY - 80 / 2, 20, 80, 'ICE');
  b(NX + 60, groundY - 80 / 2, 20, 80, 'ICE');
  b(NX + 30, groundY - 80 - 6, 80, 12, 'ICE');
  capBlock(ctx, NX, groundY - 80 - 6, 'STONE', 22);
  capBlock(ctx, NX + 60, groundY - 80 - 6, 'STONE', 22);

  // ── Left Spire (5 levels — tallest, reaches y≈285) ──
  const LSX = 500;
  const spireSpan = 60;
  // Level 1
  b(LSX - spireSpan / 2, groundY - 75 / 2, 16, 75, 'ICE');
  b(LSX + spireSpan / 2, groundY - 75 / 2, 16, 75, 'ICE');
  const ls1 = groundY - 75 - 6;
  b(LSX, ls1, spireSpan + 20, 12, 'STONE');
  // Level 2
  b(LSX - 20, ls1 - 6 - 60 / 2, 14, 60, 'ICE');
  b(LSX + 20, ls1 - 6 - 60 / 2, 14, 60, 'ICE');
  const ls2 = ls1 - 6 - 60 - 6;
  b(LSX, ls2, spireSpan + 10, 12, 'ICE');
  // Level 3
  b(LSX - 15, ls2 - 6 - 50 / 2, 14, 50, 'ICE');
  b(LSX + 15, ls2 - 6 - 50 / 2, 14, 50, 'ICE');
  const ls3 = ls2 - 6 - 50 - 6;
  b(LSX, ls3, spireSpan, 12, 'STONE');
  // Level 4
  b(LSX, ls3 - 6 - 40 / 2, 14, 40, 'ICE');
  const ls4 = ls3 - 6 - 40 - 6;
  b(LSX, ls4, 45, 12, 'ICE');
  // Level 5 — pinnacle
  b(LSX, ls4 - 6 - 30 / 2, 14, 30, 'ICE');
  const ls5 = ls4 - 6 - 30 - 6;
  b(LSX, ls5, 35, 10, 'STONE');
  capBlock(ctx, LSX, ls5, 'STONE', 20);

  // ── Central Nave (wide hall, 3 levels + apex shrine) ──
  const CX = 700;
  const naveSpan = 260;
  // Level 1 — wide base with 4 pillars
  b(CX - naveSpan / 2, groundY - 80 / 2, 18, 80, 'ICE');
  b(CX - naveSpan / 4, groundY - 80 / 2, 14, 80, 'WOOD');
  b(CX + naveSpan / 4, groundY - 80 / 2, 14, 80, 'WOOD');
  b(CX + naveSpan / 2, groundY - 80 / 2, 18, 80, 'ICE');
  const nf1 = groundY - 80 - 6;
  b(CX, nf1, naveSpan + 30, 14, 'STONE');
  // Level 2
  b(CX - naveSpan / 3, nf1 - 6 - 65 / 2, 14, 65, 'ICE');
  b(CX, nf1 - 6 - 65 / 2, 14, 65, 'ICE');
  b(CX + naveSpan / 3, nf1 - 6 - 65 / 2, 14, 65, 'ICE');
  const nf2 = nf1 - 6 - 65 - 6;
  b(CX, nf2, naveSpan, 12, 'ICE');
  // Level 3
  b(CX - 50, nf2 - 6 - 50 / 2, 14, 50, 'ICE');
  b(CX + 50, nf2 - 6 - 50 / 2, 14, 50, 'ICE');
  const nf3 = nf2 - 6 - 50 - 6;
  b(CX, nf3, 140, 12, 'STONE');
  // Apex Shrine
  b(CX, nf3 - 6 - 35 / 2, 14, 35, 'ICE');
  const apexF = nf3 - 6 - 35 - 6;
  b(CX, apexF, 80, 12, 'STONE');
  b(CX - 20, apexF - 6 - 14, 36, 24, 'STONE');
  b(CX + 20, apexF - 6 - 14, 36, 24, 'STONE');

  // ── ICE Buttresses (bracing nave from outside) ──
  b(CX - naveSpan / 2 - 30, groundY - 60 / 2, 22, 60, 'ICE');
  b(CX + naveSpan / 2 + 30, groundY - 60 / 2, 22, 60, 'ICE');

  // ── Right Spire (4 levels) ──
  const RSX = 920;
  // Level 1
  b(RSX - spireSpan / 2, groundY - 75 / 2, 16, 75, 'ICE');
  b(RSX + spireSpan / 2, groundY - 75 / 2, 16, 75, 'ICE');
  const rs1 = groundY - 75 - 6;
  b(RSX, rs1, spireSpan + 20, 12, 'STONE');
  // Level 2
  b(RSX - 20, rs1 - 6 - 60 / 2, 14, 60, 'ICE');
  b(RSX + 20, rs1 - 6 - 60 / 2, 14, 60, 'ICE');
  const rs2 = rs1 - 6 - 60 - 6;
  b(RSX, rs2, spireSpan + 10, 12, 'ICE');
  // Level 3
  b(RSX, rs2 - 6 - 50 / 2, 14, 50, 'ICE');
  const rs3 = rs2 - 6 - 50 - 6;
  b(RSX, rs3, 50, 12, 'STONE');
  // Level 4 — cap
  b(RSX, rs3 - 6 - 35 / 2, 14, 35, 'ICE');
  const rs4 = rs3 - 6 - 35 - 6;
  b(RSX, rs4, 40, 10, 'STONE');
  capBlock(ctx, RSX, rs4, 'STONE', 20);

  // ── Long ICE Bridge connecting spires at level 3 ──
  const bridgeCX = (LSX + RSX) / 2;
  const bridgeW = RSX - LSX - spireSpan;
  b(bridgeCX, ls3, bridgeW, 10, 'ICE');
  // Bridge support pillars (must reach from ground to bridge deck)
  const bridgePH = groundY - ls3 - 6;
  b(bridgeCX - bridgeW / 4, groundY - bridgePH / 2, 12, bridgePH, 'ICE');
  b(bridgeCX + bridgeW / 4, groundY - bridgePH / 2, 12, bridgePH, 'ICE');

  // ── Crypt (treasuryRoom) behind right spire ──
  treasuryRoom(ctx, RSX + 70, groundY, 70, 55, 'ICE', 6);

  // ── Barrels (6) ──
  ctx.barrel(NX + 30, groundY - 18);                // narthex
  ctx.barrel(CX - naveSpan / 4, groundY - 18);      // nave ground left
  ctx.barrel(CX + naveSpan / 4, groundY - 18);      // nave ground right
  ctx.barrel(CX, nf1 - 6 - 18);                     // nave level 1
  ctx.barrel(LSX, groundY - 18);                     // left spire ground
  ctx.barrel(RSX, groundY - 18);                     // right spire ground

  // ── ICE_PATCHes (3) ──
  ctx.hazard('ICE_PATCH', CX - 80, groundY - 10);
  ctx.hazard('ICE_PATCH', CX + 80, groundY - 10);
  ctx.hazard('ICE_PATCH', bridgeCX, groundY - 10);

  // ── Enemy Slots (10) ──
  ctx.enemySlots.push(
    { x: NX + 30, y: groundY - 80 - 6 - 6 - eR },     // narthex top
    { x: LSX, y: ls1 - 6 - eR },                       // left spire level 1
    { x: LSX, y: ls3 - 6 - eR },                       // left spire level 3
    { x: CX - naveSpan / 3, y: nf1 - 6 - eR },        // nave level 1 left
    { x: CX + naveSpan / 3, y: nf1 - 6 - eR },        // nave level 1 right
    { x: CX, y: nf2 - 6 - eR },                        // nave level 2
    { x: CX, y: apexF - 6 - 24 - eR },                // nave apex (boss)
    { x: RSX, y: rs1 - 6 - eR },                       // right spire level 1
    { x: RSX, y: rs3 - 6 - eR },                       // right spire level 3
    { x: bridgeCX, y: ls3 - 6 - eR },                  // bridge between spires
  );

  // ── Coins (~46g) ──
  ctx.coin(390, 260, 4);                              // approach — arc path
  ctx.coin(CX, apexF - 40, 7);                       // treasury — nave apex shrine
  ctx.coin(LSX, ls5 - 20, 6);                         // structure — left spire pinnacle
  ctx.coin(RSX, rs4 - 20, 5);                         // structure — right spire top
  ctx.coin(CX, nf3 - 20, 5);                          // structure — nave level 3
  ctx.coin(NX + 30, groundY - 18, 4);                 // risky — near narthex barrel
  ctx.coin(CX - naveSpan / 4, groundY - 18, 5);       // risky — near nave barrel
  ctx.coin(LSX, groundY - 18, 5);                     // risky — near left spire barrel
  ctx.coin(RSX + 70, groundY - 30, 5);                // structure — crypt hidden coin
};

// ─── "The Frozen Rampart" — 3 progressive walls + grand keep + watchtower (~70 blocks) ──
export const frozenRampart: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // ── Wall 1 (shortest, h=80) ──
  const W1X = 430;
  b(W1X, groundY - 80 / 2, 22, 80, 'ICE');
  b(W1X, groundY - 80 - 6 - 14, 30, 28, 'STONE');   // battlement
  // Small structure behind wall 1
  b(W1X + 50, groundY - 45 / 2, 14, 45, 'ICE');
  b(W1X + 90, groundY - 45 / 2, 14, 45, 'ICE');
  const w1sf = groundY - 45 - 6;
  b(W1X + 70, w1sf, 60, 10, 'ICE');

  // ── ICE walkway on wall 1 ──
  b(W1X + 30, groundY - 80 - 6, 50, 10, 'ICE');

  // ── Wall 2 (medium, h=95) ──
  const W2X = 560;
  b(W2X, groundY - 95 / 2, 24, 95, 'ICE');
  b(W2X, groundY - 95 - 6 - 14, 32, 28, 'STONE');   // battlement
  // Kill zone structure between wall 1 and 2
  b(W2X - 50, groundY - 55 / 2, 14, 55, 'ICE');
  b(W2X - 90, groundY - 55 / 2, 14, 55, 'ICE');
  const kz1f = groundY - 55 - 6;
  b(W2X - 70, kz1f, 60, 10, 'WOOD');

  // ── ICE walkway on wall 2 ──
  b(W2X + 30, groundY - 95 - 6, 50, 10, 'ICE');

  // ── Wall 3 (tallest wall, h=110) ──
  const W3X = 690;
  b(W3X, groundY - 110 / 2, 26, 110, 'ICE');
  b(W3X, groundY - 110 - 6 - 14, 34, 28, 'STONE');  // battlement
  // Kill zone structure between wall 2 and 3
  b(W3X - 50, groundY - 60 / 2, 14, 60, 'ICE');
  b(W3X - 90, groundY - 60 / 2, 14, 60, 'ICE');
  const kz2f = groundY - 60 - 6;
  b(W3X - 70, kz2f, 60, 10, 'WOOD');

  // ── ICE walkways connecting wall tops ──
  // wall 1 → wall 2 (lower walkway)
  const walk12CX = (W1X + W2X) / 2;
  b(walk12CX, groundY - 80 - 6, (W2X - W1X) - 20, 10, 'ICE');
  // wall 2 → wall 3 (mid walkway)
  const walk23CX = (W2X + W3X) / 2;
  b(walk23CX, groundY - 95 - 6, (W3X - W2X) - 20, 10, 'ICE');

  // ── Grand Keep behind wall 3 (4 levels, reaches y≈305) ──
  const KX = 820;
  const keepSpan = 120;
  // Level 1 — wide ICE base
  b(KX - keepSpan / 2, groundY - 80 / 2, 18, 80, 'ICE');
  b(KX, groundY - 80 / 2, 14, 80, 'ICE');
  b(KX + keepSpan / 2, groundY - 80 / 2, 18, 80, 'ICE');
  const kf1 = groundY - 80 - 6;
  b(KX, kf1, keepSpan + 30, 14, 'STONE');
  // Level 2
  b(KX - keepSpan / 3, kf1 - 6 - 65 / 2, 14, 65, 'ICE');
  b(KX + keepSpan / 3, kf1 - 6 - 65 / 2, 14, 65, 'ICE');
  const kf2 = kf1 - 6 - 65 - 6;
  b(KX, kf2, keepSpan + 10, 12, 'ICE');
  // Level 3
  b(KX - 30, kf2 - 6 - 50 / 2, 14, 50, 'ICE');
  b(KX + 30, kf2 - 6 - 50 / 2, 14, 50, 'ICE');
  const kf3 = kf2 - 6 - 50 - 6;
  b(KX, kf3, 100, 12, 'STONE');
  // Level 4 — throne
  b(KX, kf3 - 6 - 40 / 2, 14, 40, 'ICE');
  const kf4 = kf3 - 6 - 40 - 6;
  b(KX, kf4, 70, 12, 'STONE');
  b(KX - 20, kf4 - 6 - 14, 36, 24, 'STONE');
  b(KX + 20, kf4 - 6 - 14, 36, 24, 'STONE');

  // ── Rear Watchtower (2 levels) ──
  const WTX = 970;
  b(WTX, groundY - 65 / 2, 14, 65, 'ICE');
  b(WTX + 55, groundY - 65 / 2, 14, 65, 'ICE');
  const wtf1 = groundY - 65 - 6;
  b(WTX + 27, wtf1, 75, 10, 'STONE');
  b(WTX + 27, wtf1 - 6 - 45 / 2, 14, 45, 'ICE');
  const wtf2 = wtf1 - 6 - 45 - 6;
  b(WTX + 27, wtf2, 55, 10, 'STONE');
  capBlock(ctx, WTX + 27, wtf2, 'STONE', 22);

  // ── STONE battlements on every wall ──
  capBlock(ctx, W1X + 30, groundY - 80 - 6, 'STONE', 20);
  capBlock(ctx, W2X + 30, groundY - 95 - 6, 'STONE', 20);

  // ── Barrels (7) ──
  ctx.barrel(W1X + 70, groundY - 18);              // behind wall 1
  ctx.barrel(W2X - 70, groundY - 18);              // kill zone 1
  ctx.barrel(W3X - 70, groundY - 18);              // kill zone 2
  ctx.barrel(KX - keepSpan / 3, groundY - 18);     // keep ground left
  ctx.barrel(KX + keepSpan / 3, groundY - 18);     // keep ground right
  ctx.barrel(KX, kf1 - 6 - 18);                    // keep level 1
  ctx.barrel(WTX + 27, groundY - 18);              // watchtower ground

  // ── ICE_PATCHes (4) ──
  ctx.hazard('ICE_PATCH', W1X + 50, groundY - 10);
  ctx.hazard('ICE_PATCH', W2X - 40, groundY - 10);
  ctx.hazard('ICE_PATCH', W3X - 40, groundY - 10);
  ctx.hazard('ICE_PATCH', KX, groundY - 10);

  // ── Enemy Slots (10) ──
  ctx.enemySlots.push(
    { x: W1X, y: groundY - 80 - 6 - 28 - eR },        // wall 1 battlement
    { x: W1X + 70, y: w1sf - 6 - eR },                // behind wall 1 structure
    { x: W2X, y: groundY - 95 - 6 - 28 - eR },        // wall 2 battlement
    { x: W2X - 70, y: kz1f - 6 - eR },                // kill zone 1 structure
    { x: W3X, y: groundY - 110 - 6 - 28 - eR },       // wall 3 battlement
    { x: KX, y: kf1 - 6 - eR },                        // keep level 1
    { x: KX, y: kf2 - 6 - eR },                        // keep level 2
    { x: KX, y: kf4 - 6 - 24 - eR },                  // keep throne (boss)
    { x: WTX + 27, y: wtf1 - 6 - eR },                // watchtower level 1
    { x: W3X - 70, y: kz2f - 6 - eR },                // kill zone 2 structure
  );

  // ── Coins (~47g) ──
  ctx.coin(400, 260, 4);                              // approach — arc path
  ctx.coin(KX, kf4 - 40, 7);                          // treasury — keep throne
  ctx.coin(KX, kf3 - 20, 5);                          // structure — keep level 3
  ctx.coin(WTX + 27, wtf2 - 30, 5);                   // structure — watchtower top
  ctx.coin(W3X, groundY - 110 - 40, 5);               // structure — wall 3 top
  ctx.coin(W1X + 70, groundY - 18, 4);                // risky — near wall 1 barrel
  ctx.coin(W2X - 70, groundY - 18, 4);                // risky — near kill zone 1 barrel
  ctx.coin(KX - keepSpan / 3, groundY - 18, 5);       // risky — near keep barrel
  ctx.coin(W3X - 70, groundY - 18, 4);                // risky — near kill zone 2 barrel
  ctx.coin(W2X, groundY - 95 - 40, 4);                // structure — wall 2 battlement

  // Terrain — raised ground behind wall 3
  raisedPlatform(ctx, 780, groundY, 80, 18);
};

export const diff5Templates: TemplateFn[] = [
  frostThrone,
  glacierCitadel,
  iceQueenLair,
  frozenGauntlet,
  glacierCathedral,
  frozenRampart,
];
