import type { TemplateFn } from '../types';
import { raisedPlatform, treasuryRoom, capBlock } from '../shared';

// ─── "Infernal Throne" — demon lord's throne room with lava moat ────────────
export const infernalThrone: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Front gate — massive obsidian
  const GX = 440;
  b(GX, groundY - 85 / 2, 24, 85, 'OBSIDIAN');
  b(GX + 70, groundY - 85 / 2, 24, 85, 'OBSIDIAN');
  b(GX + 35, groundY - 85 - 6, 90, 14, 'OBSIDIAN');

  // Main hall
  const HX = 560;
  const hallW = 210;
  b(HX, groundY - 80 / 2, 18, 80, 'OBSIDIAN');
  b(HX + hallW / 2, groundY - 80 / 2, 14, 80, 'STONE');
  b(HX + hallW, groundY - 80 / 2, 18, 80, 'OBSIDIAN');
  const hf1 = groundY - 80 - 6;
  b(HX + hallW / 2, hf1, hallW + 30, 14, 'OBSIDIAN');

  // Upper hall levels
  b(HX + 20, hf1 - 6 - 60 / 2, 14, 60, 'STONE');
  b(HX + hallW - 20, hf1 - 6 - 60 / 2, 14, 60, 'STONE');
  b(HX + hallW / 2, hf1 - 6 - 60 / 2, 14, 60, 'WOOD');
  const hf2 = hf1 - 6 - 60 - 6;
  b(HX + hallW / 2, hf2, hallW, 12, 'OBSIDIAN');

  // Throne platform
  const throneX = HX + hallW / 2;
  b(throneX - 35, hf2 - 6 - 45 / 2, 14, 45, 'WOOD');
  b(throneX + 35, hf2 - 6 - 45 / 2, 14, 45, 'WOOD');
  const tf = hf2 - 6 - 45 - 6;
  b(throneX, tf, 90, 12, 'OBSIDIAN');
  b(throneX, tf - 6 - 16, 40, 28, 'OBSIDIAN');

  // Rear tower
  const RX = 850;
  b(RX, groundY - 70 / 2, 14, 70, 'OBSIDIAN');
  b(RX + 80, groundY - 70 / 2, 14, 70, 'OBSIDIAN');
  const rf1 = groundY - 70 - 6;
  b(RX + 40, rf1, 100, 12, 'STONE');
  b(RX + 40, rf1 - 6 - 14, 28, 28, 'OBSIDIAN');

  ctx.hazard('LAVA_PIT', GX + 35, groundY - 10);
  ctx.hazard('LAVA_PIT', HX + hallW / 2, groundY - 10);
  ctx.hazard('FIRE_GEYSER', HX + hallW + 30, groundY - 10);

  ctx.barrel(HX + hallW / 4, groundY - 18);
  ctx.barrel(throneX, hf1 - 6 - 18);
  ctx.barrel(GX + 35, groundY - 18);

  ctx.enemySlots.push(
    { x: GX + 35, y: groundY - 85 - 6 - 6 - eR },
    { x: HX + hallW / 3, y: hf1 - 6 - eR },
    { x: HX + hallW * 2 / 3, y: hf1 - 6 - eR },
    { x: throneX, y: hf2 - 6 - eR },
    { x: throneX, y: tf - 6 - 28 - eR },
    { x: RX + 40, y: rf1 - 6 - 28 - eR },
  );

  // Coins (~30g)
  ctx.coin(430, 270, 4);                          // approach — arc path
  ctx.coin(throneX, tf - 40, 6);                   // treasury — above throne platform
  ctx.coin(GX + 35, groundY - 85 - 30, 4);        // structure — above front gate
  ctx.coin(RX + 40, rf1 - 40, 4);                 // structure — above rear tower
  ctx.coin(GX + 35, groundY - 40, 6);             // risky — near lava pit at gate
  ctx.coin(HX + hallW + 30, groundY - 40, 6);     // risky — near fire geyser

  // Terrain — hidden obsidian chamber
  treasuryRoom(ctx, 950, groundY, 80, 50, 'OBSIDIAN', 6);
};

// ─── "Demon Lord Lair" — 3 connected chambers with increasing difficulty ────
export const demonLordLair: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  const chamberW = 110;

  // Chamber 1 — outer ward (stone+obsidian)
  const C1X = 440;
  b(C1X, groundY - 70 / 2, 16, 70, 'STONE');
  b(C1X + chamberW, groundY - 70 / 2, 16, 70, 'OBSIDIAN');
  b(C1X + chamberW / 2, groundY - 70 / 2, 14, 70, 'OBSIDIAN');
  const c1f = groundY - 70 - 6;
  b(C1X + chamberW / 2, c1f, chamberW + 30, 12, 'OBSIDIAN');

  b(C1X + 15, c1f - 6 - 45 / 2, 14, 45, 'WOOD');
  b(C1X + chamberW - 15, c1f - 6 - 45 / 2, 14, 45, 'WOOD');
  const c1f2 = c1f - 6 - 45 - 6;
  b(C1X + chamberW / 2, c1f2, chamberW + 10, 12, 'STONE');

  // Bridge 1 — wood (weak point)
  const br1X = C1X + chamberW + 30;
  b(br1X + 25, groundY - 55 / 2, 14, 55, 'WOOD');
  b(br1X + 25, groundY - 55 - 6, 60, 12, 'WOOD');

  // Chamber 2 — inner sanctum (heavy obsidian)
  const C2X = br1X + 80;
  b(C2X, groundY - 75 / 2, 18, 75, 'OBSIDIAN');
  b(C2X + chamberW, groundY - 75 / 2, 18, 75, 'OBSIDIAN');
  const c2f = groundY - 75 - 6;
  b(C2X + chamberW / 2, c2f, chamberW + 30, 14, 'OBSIDIAN');

  b(C2X + 15, c2f - 6 - 55 / 2, 14, 55, 'STONE');
  b(C2X + chamberW - 15, c2f - 6 - 55 / 2, 14, 55, 'STONE');
  const c2f2 = c2f - 6 - 55 - 6;
  b(C2X + chamberW / 2, c2f2, chamberW + 10, 12, 'OBSIDIAN');

  // Bridge 2
  const br2X = C2X + chamberW + 30;
  b(br2X + 25, groundY - 60 / 2, 14, 60, 'WOOD');
  b(br2X + 25, groundY - 60 - 6, 60, 12, 'WOOD');

  // Chamber 3 — boss lair (all obsidian)
  const C3X = br2X + 80;
  b(C3X, groundY - 80 / 2, 20, 80, 'OBSIDIAN');
  b(C3X + chamberW, groundY - 80 / 2, 20, 80, 'OBSIDIAN');
  const c3f = groundY - 80 - 6;
  b(C3X + chamberW / 2, c3f, chamberW + 40, 14, 'OBSIDIAN');

  b(C3X + 15, c3f - 6 - 55 / 2, 16, 55, 'OBSIDIAN');
  b(C3X + chamberW - 15, c3f - 6 - 55 / 2, 16, 55, 'OBSIDIAN');
  const c3f2 = c3f - 6 - 55 - 6;
  b(C3X + chamberW / 2, c3f2, chamberW + 20, 14, 'OBSIDIAN');
  b(C3X + chamberW / 2 - 25, c3f2 - 6 - 16, 40, 32, 'OBSIDIAN');
  b(C3X + chamberW / 2 + 25, c3f2 - 6 - 16, 40, 32, 'OBSIDIAN');

  ctx.hazard('LAVA_PIT', br1X + 25, groundY - 10);
  ctx.hazard('LAVA_PIT', br2X + 25, groundY - 10);
  ctx.hazard('FIRE_GEYSER', C3X + chamberW / 2, groundY - 10);

  ctx.barrel(C1X + chamberW / 2, groundY - 18);
  ctx.barrel(C2X + chamberW / 2, groundY - 18);
  ctx.barrel(C3X + chamberW / 2, c3f - 6 - 18);

  ctx.enemySlots.push(
    { x: C1X + chamberW / 2, y: c1f - 6 - eR },
    { x: C1X + chamberW / 2, y: c1f2 - 6 - eR },
    { x: C2X + chamberW / 2, y: c2f - 6 - eR },
    { x: C2X + chamberW / 2, y: c2f2 - 6 - eR },
    { x: C3X + chamberW / 2, y: c3f - 6 - eR },
    { x: C3X + chamberW / 2, y: c3f2 - 6 - 32 - eR },
  );

  // Coins (~32g)
  ctx.coin(430, 280, 4);                                  // approach — arc path
  ctx.coin(C1X + chamberW / 2, c1f2 - 30, 4);             // structure — above chamber 1 upper
  ctx.coin(C2X + chamberW / 2, c2f2 - 30, 5);             // structure — above chamber 2 upper
  ctx.coin(C3X + chamberW / 2, c3f2 - 40, 6);             // treasury — above boss lair cap
  ctx.coin(br1X + 25, groundY - 40, 6);                   // risky — near lava bridge 1
  ctx.coin(C3X + chamberW / 2, groundY - 40, 4);          // risky — near fire geyser
  ctx.coin(br2X + 25, groundY - 40, 3);                   // risky — near lava bridge 2
};

// ─── "Obsidian Citadel" — multi-wing palace with obsidian everything ────────
export const obsidianCitadel: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  const span = 90;
  const pillarH = 75;

  // Left wing — 3-level tower
  const LX = 460;
  b(LX, groundY - pillarH / 2, 16, pillarH, 'OBSIDIAN');
  b(LX + span, groundY - pillarH / 2, 16, pillarH, 'OBSIDIAN');
  const lf1 = groundY - pillarH - 6;
  b(LX + span / 2, lf1, span + 20, 12, 'OBSIDIAN');

  b(LX + 10, lf1 - 6 - 55 / 2, 14, 55, 'STONE');
  b(LX + span - 10, lf1 - 6 - 55 / 2, 14, 55, 'STONE');
  const lf2 = lf1 - 6 - 55 - 6;
  b(LX + span / 2, lf2, span + 10, 12, 'OBSIDIAN');

  b(LX + span / 2, lf2 - 6 - 40 / 2, 14, 40, 'WOOD');
  const lf3 = lf2 - 6 - 40 - 6;
  b(LX + span / 2, lf3, 60, 12, 'OBSIDIAN');
  b(LX + span / 2, lf3 - 6 - 14, 28, 28, 'OBSIDIAN');

  // Center grand hall — 4 levels
  const CX = 660;
  const hallSpan = 130;
  b(CX - hallSpan / 2, groundY - pillarH / 2, 16, pillarH, 'OBSIDIAN');
  b(CX, groundY - pillarH / 2, 14, pillarH, 'STONE');
  b(CX + hallSpan / 2, groundY - pillarH / 2, 16, pillarH, 'OBSIDIAN');
  const cf1 = groundY - pillarH - 6;
  b(CX, cf1, hallSpan + 30, 14, 'OBSIDIAN');

  b(CX - hallSpan / 2, cf1 - 6 - 60 / 2, 14, 60, 'OBSIDIAN');
  b(CX + hallSpan / 2, cf1 - 6 - 60 / 2, 14, 60, 'OBSIDIAN');
  const cf2 = cf1 - 6 - 60 - 6;
  b(CX, cf2, hallSpan + 20, 12, 'OBSIDIAN');

  b(CX - span / 2, cf2 - 6 - 50 / 2, 14, 50, 'WOOD');
  b(CX + span / 2, cf2 - 6 - 50 / 2, 14, 50, 'WOOD');
  const cf3 = cf2 - 6 - 50 - 6;
  b(CX, cf3, 120, 12, 'OBSIDIAN');

  // Throne at top
  b(CX, cf3 - 6 - 35 / 2, 14, 35, 'STONE');
  const throneF = cf3 - 6 - 35 - 6;
  b(CX, throneF, 80, 12, 'OBSIDIAN');
  b(CX - 20, throneF - 6 - 14, 36, 24, 'OBSIDIAN');
  b(CX + 20, throneF - 6 - 14, 36, 24, 'OBSIDIAN');

  // Right wing — 2-level tower
  const RX = 870;
  b(RX, groundY - pillarH / 2, 16, pillarH, 'OBSIDIAN');
  b(RX + span, groundY - pillarH / 2, 16, pillarH, 'OBSIDIAN');
  const rf1 = groundY - pillarH - 6;
  b(RX + span / 2, rf1, span + 20, 12, 'OBSIDIAN');

  b(RX + span / 2, rf1 - 6 - 50 / 2, 14, 50, 'WOOD');
  const rf2 = rf1 - 6 - 50 - 6;
  b(RX + span / 2, rf2, 60, 12, 'STONE');

  // Connecting bridges — wood
  b((LX + span + CX - hallSpan / 2) / 2, cf1, 60, 10, 'WOOD');
  b((CX + hallSpan / 2 + RX) / 2, cf1, 60, 10, 'WOOD');

  ctx.hazard('LAVA_PIT', LX + span / 2, groundY - 10);
  ctx.hazard('LAVA_PIT', CX, groundY - 10);
  ctx.hazard('FIRE_GEYSER', RX + span / 2, groundY - 10);

  ctx.barrel(LX + span / 2, groundY - 18);
  ctx.barrel(CX + 40, cf1 - 6 - 18);

  ctx.enemySlots.push(
    { x: LX + span / 2, y: lf1 - 6 - eR },
    { x: CX, y: cf1 - 6 - eR },
    { x: RX + span / 2, y: rf1 - 6 - eR },
    { x: CX, y: cf2 - 6 - eR },
    { x: CX, y: throneF - 6 - 24 - eR },
    { x: LX + span / 2, y: lf3 - 6 - 28 - eR },
  );

  // Coins (~31g)
  ctx.coin(440, 270, 4);                          // approach — arc path
  ctx.coin(CX, throneF - 40, 6);                  // treasury — above throne at pinnacle
  ctx.coin(LX + span / 2, lf3 - 40, 5);           // structure — above left wing cap
  ctx.coin(RX + span / 2, rf2 - 30, 4);           // structure — above right wing top
  ctx.coin(LX + span / 2, groundY - 40, 6);       // risky — near lava pit (left)
  ctx.coin(CX, groundY - 40, 6);                  // risky — near lava pit (center)
};

// ─── "Hellfire Gauntlet" — progressive walls + fire gauntlet ────────────────
export const hellfireGauntlet: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // 4 progressively reinforced walls
  const walls = [
    { x: 460, h: 60, w: 18, mat: 'STONE' as const },
    { x: 570, h: 65, w: 20, mat: 'OBSIDIAN' as const },
    { x: 680, h: 70, w: 22, mat: 'OBSIDIAN' as const },
    { x: 790, h: 80, w: 26, mat: 'OBSIDIAN' as const },
  ];

  for (const wall of walls) {
    b(wall.x, groundY - wall.h / 2, wall.w, wall.h, wall.mat);
    b(wall.x, groundY - wall.h - 6 - 14, 28, 28, 'OBSIDIAN');
  }

  // Structures between walls
  b(515, groundY - 50 / 2, 14, 50, 'STONE');
  b(515, groundY - 50 - 6, 60, 10, 'WOOD');

  b(625, groundY - 55 / 2, 14, 55, 'OBSIDIAN');
  b(625, groundY - 55 - 6, 70, 12, 'STONE');

  b(735, groundY - 60 / 2, 14, 60, 'OBSIDIAN');
  b(735, groundY - 60 - 6, 70, 12, 'OBSIDIAN');

  // Final compound behind last wall
  const FX = 860;
  b(FX, groundY - 80 / 2, 18, 80, 'OBSIDIAN');
  b(FX + 90, groundY - 80 / 2, 18, 80, 'OBSIDIAN');
  const ff1 = groundY - 80 - 6;
  b(FX + 45, ff1, 110, 14, 'OBSIDIAN');
  b(FX + 45, ff1 - 6 - 50 / 2, 14, 50, 'WOOD');
  const ff2 = ff1 - 6 - 50 - 6;
  b(FX + 45, ff2, 80, 12, 'OBSIDIAN');
  b(FX + 45, ff2 - 6 - 16, 36, 28, 'OBSIDIAN');

  // Fire gauntlet hazards
  ctx.hazard('FIRE_GEYSER', 515, groundY - 10);
  ctx.hazard('FIRE_GEYSER', 735, groundY - 10);
  ctx.hazard('LAVA_PIT', 625, groundY - 10);

  ctx.barrel(515, groundY - 18);
  ctx.barrel(735, groundY - 18);
  ctx.barrel(FX + 45, ff1 - 6 - 18);

  ctx.enemySlots.push(
    { x: 515, y: groundY - 50 - 6 - 6 - eR },
    { x: 625, y: groundY - 55 - 6 - 6 - eR },
    { x: 735, y: groundY - 60 - 6 - 6 - eR },
    { x: FX + 45, y: ff1 - 6 - eR },
    { x: FX + 45, y: ff2 - 6 - 28 - eR },
    { x: 790, y: groundY - 80 - 6 - 28 - eR },
  );

  // Coins (~30g)
  ctx.coin(440, 280, 4);                    // approach — arc path
  ctx.coin(FX + 45, ff2 - 40, 6);            // treasury — above final compound cap
  ctx.coin(625, groundY - 55 - 30, 4);       // structure — above mid-wall structure
  ctx.coin(790, groundY - 80 - 40, 4);       // structure — above last wall battlement
  ctx.coin(515, groundY - 40, 6);            // risky — near fire geyser
  ctx.coin(625, groundY - 40, 6);            // risky — near lava pit
};

// ─── "Volcanic Palace" — grand two-wing palace with lava throughout ─────────
export const volcanicPalace: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Left wing — obsidian tower
  const LX = 450;
  const wSpan = 80;
  b(LX, groundY - 80 / 2, 16, 80, 'OBSIDIAN');
  b(LX + wSpan, groundY - 80 / 2, 16, 80, 'OBSIDIAN');
  const lf1 = groundY - 80 - 6;
  b(LX + wSpan / 2, lf1, wSpan + 20, 12, 'OBSIDIAN');

  b(LX + wSpan / 2 - 20, lf1 - 6 - 55 / 2, 14, 55, 'STONE');
  b(LX + wSpan / 2 + 20, lf1 - 6 - 55 / 2, 14, 55, 'STONE');
  const lf2 = lf1 - 6 - 55 - 6;
  b(LX + wSpan / 2, lf2, wSpan, 12, 'OBSIDIAN');
  b(LX + wSpan / 2, lf2 - 6 - 14, 28, 28, 'OBSIDIAN');

  // Grand central hall
  const CX = 640;
  const hallW = 180;
  b(CX, groundY - 85 / 2, 18, 85, 'OBSIDIAN');
  b(CX + hallW / 3, groundY - 85 / 2, 14, 85, 'STONE');
  b(CX + hallW * 2 / 3, groundY - 85 / 2, 14, 85, 'STONE');
  b(CX + hallW, groundY - 85 / 2, 18, 85, 'OBSIDIAN');
  const cf1 = groundY - 85 - 6;
  b(CX + hallW / 2, cf1, hallW + 30, 14, 'OBSIDIAN');

  // Second level
  b(CX + 20, cf1 - 6 - 55 / 2, 14, 55, 'WOOD');
  b(CX + hallW - 20, cf1 - 6 - 55 / 2, 14, 55, 'WOOD');
  b(CX + hallW / 2, cf1 - 6 - 55 / 2, 14, 55, 'OBSIDIAN');
  const cf2 = cf1 - 6 - 55 - 6;
  b(CX + hallW / 2, cf2, hallW, 12, 'OBSIDIAN');

  // Pinnacle
  b(CX + hallW / 2 - 25, cf2 - 6 - 40 / 2, 14, 40, 'STONE');
  b(CX + hallW / 2 + 25, cf2 - 6 - 40 / 2, 14, 40, 'STONE');
  const pf = cf2 - 6 - 40 - 6;
  b(CX + hallW / 2, pf, 70, 12, 'OBSIDIAN');
  b(CX + hallW / 2, pf - 6 - 16, 36, 28, 'OBSIDIAN');

  // Right tower — shorter
  const RX = 880;
  b(RX, groundY - 70 / 2, 16, 70, 'OBSIDIAN');
  b(RX + 70, groundY - 70 / 2, 16, 70, 'OBSIDIAN');
  const rf1 = groundY - 70 - 6;
  b(RX + 35, rf1, 90, 12, 'OBSIDIAN');
  b(RX + 35, rf1 - 6 - 14, 28, 28, 'STONE');

  ctx.hazard('LAVA_PIT', LX + wSpan / 2, groundY - 10);
  ctx.hazard('LAVA_PIT', CX + hallW / 2, groundY - 10);
  ctx.hazard('FIRE_GEYSER', RX + 35, groundY - 10);

  ctx.barrel(CX + hallW / 3, groundY - 18);
  ctx.barrel(CX + hallW / 2, cf1 - 6 - 18);

  ctx.enemySlots.push(
    { x: LX + wSpan / 2, y: lf1 - 6 - eR },
    { x: CX + hallW / 3, y: cf1 - 6 - eR },
    { x: CX + hallW * 2 / 3, y: cf1 - 6 - eR },
    { x: CX + hallW / 2, y: cf2 - 6 - eR },
    { x: CX + hallW / 2, y: pf - 6 - 28 - eR },
    { x: RX + 35, y: rf1 - 6 - 28 - eR },
  );

  // Coins (~32g)
  ctx.coin(430, 270, 4);                              // approach — arc path
  ctx.coin(CX + hallW / 2, pf - 40, 6);                // treasury — above palace pinnacle
  ctx.coin(LX + wSpan / 2, lf2 - 40, 5);               // structure — above left wing cap
  ctx.coin(RX + 35, rf1 - 40, 4);                      // structure — above right tower
  ctx.coin(LX + wSpan / 2, groundY - 40, 6);           // risky — near lava pit (left)
  ctx.coin(CX + hallW / 2, groundY - 40, 4);           // risky — near lava pit (center)
  ctx.coin(RX + 35, groundY - 40, 3);                  // risky — near fire geyser
};

// ─── "Demon King Fortress" — ultimate boss structure with everything ────────
export const demonKingFortress: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Outer gate
  const GX = 440;
  b(GX, groundY - 90 / 2, 26, 90, 'OBSIDIAN');
  b(GX + 80, groundY - 90 / 2, 26, 90, 'OBSIDIAN');
  b(GX + 40, groundY - 90 - 6, 100, 14, 'OBSIDIAN');
  const gateTop = groundY - 90 - 6;

  // Inner courtyard structures
  b(540, groundY - 55 / 2, 14, 55, 'STONE');
  b(580, groundY - 55 / 2, 14, 55, 'STONE');
  b(560, groundY - 55 - 6, 60, 12, 'WOOD');

  // Central fortress — massive 3-tier obsidian keep
  const KX = 630;
  const keepW = 180;
  b(KX, groundY - 85 / 2, 20, 85, 'OBSIDIAN');
  b(KX + keepW / 2, groundY - 85 / 2, 14, 85, 'OBSIDIAN');
  b(KX + keepW, groundY - 85 / 2, 20, 85, 'OBSIDIAN');
  const kf1 = groundY - 85 - 6;
  b(KX + keepW / 2, kf1, keepW + 30, 14, 'OBSIDIAN');

  // Tier 2
  b(KX + 20, kf1 - 6 - 60 / 2, 14, 60, 'OBSIDIAN');
  b(KX + keepW - 20, kf1 - 6 - 60 / 2, 14, 60, 'OBSIDIAN');
  const kf2 = kf1 - 6 - 60 - 6;
  b(KX + keepW / 2, kf2, keepW - 10, 12, 'OBSIDIAN');

  // Tier 3 — throne
  b(KX + keepW / 2 - 30, kf2 - 6 - 45 / 2, 14, 45, 'WOOD');
  b(KX + keepW / 2 + 30, kf2 - 6 - 45 / 2, 14, 45, 'WOOD');
  const kf3 = kf2 - 6 - 45 - 6;
  b(KX + keepW / 2, kf3, 80, 12, 'OBSIDIAN');
  b(KX + keepW / 2, kf3 - 6 - 16, 40, 28, 'OBSIDIAN');

  // Rear watchtower
  const RX = 870;
  b(RX, groundY - 75 / 2, 16, 75, 'OBSIDIAN');
  b(RX + 70, groundY - 75 / 2, 16, 75, 'OBSIDIAN');
  const rf = groundY - 75 - 6;
  b(RX + 35, rf, 90, 12, 'OBSIDIAN');
  b(RX + 35, rf - 6 - 14, 28, 28, 'STONE');

  // All the hazards
  ctx.hazard('LAVA_PIT', GX + 40, groundY - 10);
  ctx.hazard('LAVA_PIT', KX + keepW / 2, groundY - 10);
  ctx.hazard('FIRE_GEYSER', KX + keepW + 20, groundY - 10);

  ctx.barrel(560, groundY - 18);
  ctx.barrel(KX + keepW / 4, groundY - 18);
  ctx.barrel(KX + keepW / 2, kf1 - 6 - 18);

  ctx.enemySlots.push(
    { x: GX + 40, y: gateTop - 6 - eR },
    { x: 560, y: groundY - 55 - 6 - 6 - eR },
    { x: KX + keepW / 2, y: kf1 - 6 - eR },
    { x: KX + keepW / 2, y: kf2 - 6 - eR },
    { x: KX + keepW / 2, y: kf3 - 6 - 28 - eR },
    { x: RX + 35, y: rf - 6 - 28 - eR },
  );

  // Coins (~34g)
  ctx.coin(430, 260, 4);                              // approach — arc path
  ctx.coin(KX + keepW / 2, kf3 - 40, 6);               // treasury — above keep throne
  ctx.coin(GX + 40, gateTop - 30, 5);                  // structure — above outer gate
  ctx.coin(RX + 35, rf - 40, 4);                       // structure — above rear watchtower
  ctx.coin(GX + 40, groundY - 40, 6);                  // risky — near lava pit at gate
  ctx.coin(KX + keepW / 2, groundY - 40, 6);           // risky — near lava pit under keep
  ctx.coin(KX + keepW + 20, groundY - 40, 3);          // risky — near fire geyser

  // Terrain — volcanic rock formations in courtyard
  raisedPlatform(ctx, 600, groundY, 130, 24);
  raisedPlatform(ctx, 900, groundY, 100, 20);
};

// ─── "The Hellfire Citadel" — gatehouse + twin towers + altar complex + outpost (~75 blocks) ──
export const hellfireCitadel: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // ── Approach Gatehouse: 2 massive OBSIDIAN gateposts ──
  const GX = 400;
  const gateH = 100;
  b(GX, groundY - gateH / 2, 24, gateH, 'OBSIDIAN');
  b(GX + 80, groundY - gateH / 2, 24, gateH, 'OBSIDIAN');
  b(GX + 40, groundY - gateH - 6, 100, 14, 'OBSIDIAN');
  capBlock(ctx, GX, groundY - gateH - 6, 'OBSIDIAN', 24);
  capBlock(ctx, GX + 80, groundY - gateH - 6, 'OBSIDIAN', 24);

  // ── Left Tower (4 levels) ──
  const LTX = 520;
  const ltSpan = 70;
  // Level 1
  b(LTX - ltSpan / 2, groundY - 80 / 2, 16, 80, 'OBSIDIAN');
  b(LTX + ltSpan / 2, groundY - 80 / 2, 16, 80, 'OBSIDIAN');
  const lt1 = groundY - 80 - 6;
  b(LTX, lt1, ltSpan + 20, 12, 'OBSIDIAN');
  // Level 2
  b(LTX - 25, lt1 - 6 - 60 / 2, 14, 60, 'STONE');
  b(LTX + 25, lt1 - 6 - 60 / 2, 14, 60, 'STONE');
  const lt2 = lt1 - 6 - 60 - 6;
  b(LTX, lt2, ltSpan + 10, 12, 'OBSIDIAN');
  // Level 3
  b(LTX - 20, lt2 - 6 - 50 / 2, 14, 50, 'WOOD');
  b(LTX + 20, lt2 - 6 - 50 / 2, 14, 50, 'WOOD');
  const lt3 = lt2 - 6 - 50 - 6;
  b(LTX, lt3, ltSpan, 12, 'STONE');
  // Level 4
  b(LTX, lt3 - 6 - 35 / 2, 14, 35, 'WOOD');
  const lt4 = lt3 - 6 - 35 - 6;
  b(LTX, lt4, 50, 10, 'OBSIDIAN');
  capBlock(ctx, LTX, lt4, 'OBSIDIAN', 22);

  // ── Central Altar Complex (wide nave, 3 levels + altar pinnacle) ──
  const CX = 700;
  const altarSpan = 200;
  // Level 1 — heavy OBSIDIAN base
  b(CX - altarSpan / 2, groundY - 85 / 2, 18, 85, 'OBSIDIAN');
  b(CX - altarSpan / 4, groundY - 85 / 2, 14, 85, 'STONE');
  b(CX + altarSpan / 4, groundY - 85 / 2, 14, 85, 'STONE');
  b(CX + altarSpan / 2, groundY - 85 / 2, 18, 85, 'OBSIDIAN');
  const af1 = groundY - 85 - 6;
  b(CX, af1, altarSpan + 30, 14, 'OBSIDIAN');
  // Level 2
  b(CX - altarSpan / 3, af1 - 6 - 65 / 2, 14, 65, 'OBSIDIAN');
  b(CX, af1 - 6 - 65 / 2, 14, 65, 'WOOD');
  b(CX + altarSpan / 3, af1 - 6 - 65 / 2, 14, 65, 'OBSIDIAN');
  const af2 = af1 - 6 - 65 - 6;
  b(CX, af2, altarSpan, 12, 'OBSIDIAN');
  // Level 3
  b(CX - 45, af2 - 6 - 50 / 2, 14, 50, 'WOOD');
  b(CX + 45, af2 - 6 - 50 / 2, 14, 50, 'WOOD');
  const af3 = af2 - 6 - 50 - 6;
  b(CX, af3, 130, 12, 'OBSIDIAN');
  // Altar Pinnacle
  b(CX, af3 - 6 - 40 / 2, 14, 40, 'STONE');
  const altarF = af3 - 6 - 40 - 6;
  b(CX, altarF, 80, 12, 'OBSIDIAN');
  b(CX - 22, altarF - 6 - 14, 36, 24, 'OBSIDIAN');
  b(CX + 22, altarF - 6 - 14, 36, 24, 'OBSIDIAN');

  // ── Right Tower (5 levels — tallest, reaches y≈270) ──
  const RTX = 900;
  const rtSpan = 70;
  // Level 1 — heaviest OBSIDIAN
  b(RTX - rtSpan / 2, groundY - 80 / 2, 18, 80, 'OBSIDIAN');
  b(RTX + rtSpan / 2, groundY - 80 / 2, 18, 80, 'OBSIDIAN');
  const rt1 = groundY - 80 - 6;
  b(RTX, rt1, rtSpan + 20, 14, 'OBSIDIAN');
  // Level 2
  b(RTX - 25, rt1 - 6 - 65 / 2, 14, 65, 'OBSIDIAN');
  b(RTX + 25, rt1 - 6 - 65 / 2, 14, 65, 'OBSIDIAN');
  const rt2 = rt1 - 6 - 65 - 6;
  b(RTX, rt2, rtSpan + 10, 12, 'OBSIDIAN');
  // Level 3
  b(RTX - 20, rt2 - 6 - 55 / 2, 14, 55, 'STONE');
  b(RTX + 20, rt2 - 6 - 55 / 2, 14, 55, 'STONE');
  const rt3 = rt2 - 6 - 55 - 6;
  b(RTX, rt3, rtSpan, 12, 'STONE');
  // Level 4
  b(RTX, rt3 - 6 - 45 / 2, 14, 45, 'WOOD');
  const rt4 = rt3 - 6 - 45 - 6;
  b(RTX, rt4, 55, 12, 'OBSIDIAN');
  // Level 5 — pinnacle
  b(RTX, rt4 - 6 - 30 / 2, 14, 30, 'WOOD');
  const rt5 = rt4 - 6 - 30 - 6;
  b(RTX, rt5, 40, 10, 'OBSIDIAN');
  capBlock(ctx, RTX, rt5, 'OBSIDIAN', 20);

  // ── WOOD Bridges connecting all sections (intentional weak points) ──
  // Gate → left tower
  b((GX + 80 + LTX - ltSpan / 2) / 2, lt1, 50, 10, 'WOOD');
  // Left tower → altar complex
  b((LTX + ltSpan / 2 + CX - altarSpan / 2) / 2, af1, 60, 10, 'WOOD');
  // Altar → right tower
  b((CX + altarSpan / 2 + RTX - rtSpan / 2) / 2, af1, 50, 10, 'WOOD');

  // ── Rear Outpost with treasuryRoom ──
  treasuryRoom(ctx, 1010, groundY, 80, 55, 'OBSIDIAN', 6);

  // ── Barrels (7) ──
  ctx.barrel(GX + 40, groundY - 18);              // under gate
  ctx.barrel(LTX, groundY - 18);                  // left tower ground
  ctx.barrel(CX - altarSpan / 4, groundY - 18);   // altar ground left
  ctx.barrel(CX + altarSpan / 4, groundY - 18);   // altar ground right
  ctx.barrel(CX, af1 - 6 - 18);                   // altar level 1
  ctx.barrel(RTX, groundY - 18);                  // right tower ground
  ctx.barrel(RTX, rt1 - 6 - 18);                  // right tower level 1

  // ── Hazards ──
  ctx.hazard('LAVA_PIT', GX + 40, groundY - 10);
  ctx.hazard('LAVA_PIT', CX, groundY - 10);
  ctx.hazard('LAVA_PIT', RTX + 50, groundY - 10);
  ctx.hazard('FIRE_GEYSER', LTX + 50, groundY - 10);
  ctx.hazard('FIRE_GEYSER', CX + altarSpan / 3, groundY - 10);

  // ── Enemy Slots (10) ──
  ctx.enemySlots.push(
    { x: GX + 40, y: groundY - gateH - 6 - 6 - eR },   // gatehouse top
    { x: LTX, y: lt1 - 6 - eR },                        // left tower level 1
    { x: LTX, y: lt3 - 6 - eR },                        // left tower level 3
    { x: CX - altarSpan / 3, y: af1 - 6 - eR },        // altar level 1 left
    { x: CX + altarSpan / 3, y: af1 - 6 - eR },        // altar level 1 right
    { x: CX, y: af2 - 6 - eR },                         // altar level 2
    { x: RTX, y: rt1 - 6 - eR },                        // right tower level 1
    { x: RTX, y: rt3 - 6 - eR },                        // right tower level 3
    { x: RTX, y: rt5 - 6 - 20 - eR },                  // right tower pinnacle (boss)
    { x: CX, y: altarF - 6 - 24 - eR },                // altar pinnacle
  );

  // ── Coins (~48g) ──
  ctx.coin(380, 250, 4);                              // approach — arc path
  ctx.coin(RTX, rt5 - 30, 7);                         // treasury — right tower pinnacle
  ctx.coin(CX, altarF - 40, 6);                       // treasury — altar pinnacle
  ctx.coin(LTX, lt4 - 30, 5);                         // structure — left tower top
  ctx.coin(GX + 40, groundY - gateH - 30, 5);         // structure — above gatehouse
  ctx.coin(GX + 40, groundY - 40, 5);                 // risky — near lava at gate
  ctx.coin(CX, groundY - 40, 5);                      // risky — near lava under altar
  ctx.coin(RTX, groundY - 18, 5);                     // risky — near right tower barrel
  ctx.coin(1010, groundY - 30, 6);                    // structure — outpost treasury
};

// ─── "The Obsidian Ziggurat" — stepped pyramid + guard towers + chambers (~70 blocks) ──
export const obsidianZiggurat: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // ── Left Guard Tower (3 levels) ──
  const LGX = 420;
  const gtSpan = 60;
  b(LGX - gtSpan / 2, groundY - 70 / 2, 16, 70, 'OBSIDIAN');
  b(LGX + gtSpan / 2, groundY - 70 / 2, 16, 70, 'OBSIDIAN');
  const lg1 = groundY - 70 - 6;
  b(LGX, lg1, gtSpan + 20, 12, 'OBSIDIAN');
  b(LGX - 20, lg1 - 6 - 50 / 2, 14, 50, 'STONE');
  b(LGX + 20, lg1 - 6 - 50 / 2, 14, 50, 'STONE');
  const lg2 = lg1 - 6 - 50 - 6;
  b(LGX, lg2, gtSpan + 10, 12, 'OBSIDIAN');
  b(LGX, lg2 - 6 - 35 / 2, 14, 35, 'WOOD');
  const lg3 = lg2 - 6 - 35 - 6;
  b(LGX, lg3, 50, 10, 'OBSIDIAN');
  capBlock(ctx, LGX, lg3, 'OBSIDIAN', 22);

  // ── Approach Ramp ──
  b(490, groundY - 30 / 2, 50, 30, 'STONE');
  capBlock(ctx, 490, groundY - 30, 'OBSIDIAN', 20);

  // ── Ziggurat — 5 stepped tiers (base=440px → apex=80px) ──
  const ZCX = 720;

  // Tier 1 (base) — widest, 440px span
  const t1W = 440;
  b(ZCX - t1W / 2, groundY - 55 / 2, 20, 55, 'OBSIDIAN');
  b(ZCX - t1W / 4, groundY - 55 / 2, 14, 55, 'STONE');
  b(ZCX, groundY - 55 / 2, 14, 55, 'STONE');
  b(ZCX + t1W / 4, groundY - 55 / 2, 14, 55, 'STONE');
  b(ZCX + t1W / 2, groundY - 55 / 2, 20, 55, 'OBSIDIAN');
  const z1 = groundY - 55 - 6;
  b(ZCX, z1, t1W + 20, 14, 'OBSIDIAN');
  // Decorative cap blocks on tier 1 edges
  capBlock(ctx, ZCX - t1W / 2, z1, 'OBSIDIAN', 20);
  capBlock(ctx, ZCX + t1W / 2, z1, 'OBSIDIAN', 20);

  // Interior chambers inside tier 1 (treasuryRooms with hidden coins)
  treasuryRoom(ctx, ZCX - 100, groundY, 50, 40, 'WOOD', 5);
  treasuryRoom(ctx, ZCX + 100, groundY, 50, 40, 'WOOD', 5);

  // Tier 2 — 340px
  const t2W = 340;
  b(ZCX - t2W / 2, z1 - 6 - 55 / 2, 16, 55, 'OBSIDIAN');
  b(ZCX, z1 - 6 - 55 / 2, 14, 55, 'STONE');
  b(ZCX + t2W / 2, z1 - 6 - 55 / 2, 16, 55, 'OBSIDIAN');
  const z2 = z1 - 6 - 55 - 6;
  b(ZCX, z2, t2W + 10, 12, 'OBSIDIAN');
  capBlock(ctx, ZCX - t2W / 2, z2, 'OBSIDIAN', 18);
  capBlock(ctx, ZCX + t2W / 2, z2, 'OBSIDIAN', 18);

  // Tier 3 — 240px
  const t3W = 240;
  b(ZCX - t3W / 2, z2 - 6 - 50 / 2, 14, 50, 'OBSIDIAN');
  b(ZCX + t3W / 2, z2 - 6 - 50 / 2, 14, 50, 'OBSIDIAN');
  const z3 = z2 - 6 - 50 - 6;
  b(ZCX, z3, t3W + 10, 12, 'STONE');
  capBlock(ctx, ZCX - t3W / 2, z3, 'OBSIDIAN', 18);
  capBlock(ctx, ZCX + t3W / 2, z3, 'OBSIDIAN', 18);

  // Tier 4 — 160px
  const t4W = 160;
  b(ZCX - t4W / 2, z3 - 6 - 45 / 2, 14, 45, 'WOOD');
  b(ZCX + t4W / 2, z3 - 6 - 45 / 2, 14, 45, 'WOOD');
  const z4 = z3 - 6 - 45 - 6;
  b(ZCX, z4, t4W + 10, 12, 'OBSIDIAN');
  capBlock(ctx, ZCX - t4W / 2, z4, 'OBSIDIAN', 18);
  capBlock(ctx, ZCX + t4W / 2, z4, 'OBSIDIAN', 18);

  // Tier 5 — apex (80px)
  const t5W = 80;
  b(ZCX, z4 - 6 - 40 / 2, 14, 40, 'STONE');
  const z5 = z4 - 6 - 40 - 6;
  b(ZCX, z5, t5W + 10, 12, 'OBSIDIAN');
  b(ZCX - 20, z5 - 6 - 14, 32, 24, 'OBSIDIAN');
  b(ZCX + 20, z5 - 6 - 14, 32, 24, 'OBSIDIAN');

  // ── Right Guard Tower (2 levels) ──
  const RGX = 1000;
  b(RGX - gtSpan / 2, groundY - 65 / 2, 16, 65, 'OBSIDIAN');
  b(RGX + gtSpan / 2, groundY - 65 / 2, 16, 65, 'OBSIDIAN');
  const rg1 = groundY - 65 - 6;
  b(RGX, rg1, gtSpan + 20, 12, 'OBSIDIAN');
  b(RGX, rg1 - 6 - 45 / 2, 14, 45, 'STONE');
  const rg2 = rg1 - 6 - 45 - 6;
  b(RGX, rg2, 55, 10, 'OBSIDIAN');
  capBlock(ctx, RGX, rg2, 'OBSIDIAN', 22);

  // ── WOOD Bridges from guard towers to ziggurat tier 1 ──
  b((LGX + gtSpan / 2 + ZCX - t1W / 2) / 2, z1, 60, 10, 'WOOD');
  b((ZCX + t1W / 2 + RGX - gtSpan / 2) / 2, z1, 60, 10, 'WOOD');

  // ── Barrels (6) ──
  ctx.barrel(LGX, groundY - 18);                  // left guard tower ground
  ctx.barrel(ZCX - t1W / 4, groundY - 18);        // ziggurat tier 1 left
  ctx.barrel(ZCX + t1W / 4, groundY - 18);        // ziggurat tier 1 right
  ctx.barrel(ZCX, z1 - 6 - 18);                   // ziggurat tier 1 top
  ctx.barrel(RGX, groundY - 18);                  // right guard tower ground
  ctx.barrel(ZCX, z2 - 6 - 18);                   // ziggurat tier 2

  // ── Hazards ──
  ctx.hazard('LAVA_PIT', ZCX - t1W / 3, groundY - 10);
  ctx.hazard('LAVA_PIT', ZCX + t1W / 3, groundY - 10);
  ctx.hazard('LAVA_PIT', LGX - 40, groundY - 10);
  ctx.hazard('FIRE_GEYSER', ZCX - 60, groundY - 10);
  ctx.hazard('FIRE_GEYSER', ZCX + 60, groundY - 10);

  // ── Enemy Slots (10) ──
  ctx.enemySlots.push(
    { x: LGX, y: lg1 - 6 - eR },                     // left guard level 1
    { x: LGX, y: lg3 - 6 - 22 - eR },                // left guard top
    { x: ZCX - t2W / 3, y: z1 - 6 - eR },            // ziggurat tier 1 left
    { x: ZCX + t2W / 3, y: z1 - 6 - eR },            // ziggurat tier 1 right
    { x: ZCX, y: z2 - 6 - eR },                       // ziggurat tier 2
    { x: ZCX, y: z3 - 6 - eR },                       // ziggurat tier 3
    { x: ZCX, y: z4 - 6 - eR },                       // ziggurat tier 4
    { x: ZCX, y: z5 - 6 - 24 - eR },                 // ziggurat apex (boss)
    { x: RGX, y: rg1 - 6 - eR },                     // right guard level 1
    { x: RGX, y: rg2 - 6 - 22 - eR },                // right guard top
  );

  // ── Coins (~50g) ──
  ctx.coin(390, 250, 4);                              // approach — arc path
  ctx.coin(ZCX, z5 - 30, 8);                          // treasury — ziggurat apex
  ctx.coin(LGX, lg3 - 30, 5);                         // structure — left guard top
  ctx.coin(RGX, rg2 - 30, 5);                         // structure — right guard top
  ctx.coin(ZCX, z3 - 20, 5);                          // structure — ziggurat tier 3
  ctx.coin(ZCX - t1W / 4, groundY - 18, 5);           // risky — near ziggurat barrel
  ctx.coin(ZCX + t1W / 4, groundY - 18, 5);           // risky — near ziggurat barrel
  ctx.coin(LGX, groundY - 18, 4);                     // risky — near left guard barrel
  ctx.coin(ZCX, z4 - 20, 5);                          // structure — ziggurat tier 4
  ctx.coin(RGX, groundY - 18, 4);                     // risky — near right guard barrel

  // Terrain — volcanic mound near approach
  raisedPlatform(ctx, 500, groundY, 90, 20);
};

export const diff5Templates: TemplateFn[] = [
  infernalThrone,
  demonLordLair,
  obsidianCitadel,
  hellfireGauntlet,
  volcanicPalace,
  demonKingFortress,
  hellfireCitadel,
  obsidianZiggurat,
];
