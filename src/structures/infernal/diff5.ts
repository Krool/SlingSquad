import type { TemplateFn } from '../types';

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
};

export const diff5Templates: TemplateFn[] = [
  infernalThrone,
  demonLordLair,
  obsidianCitadel,
  hellfireGauntlet,
  volcanicPalace,
  demonKingFortress,
];
