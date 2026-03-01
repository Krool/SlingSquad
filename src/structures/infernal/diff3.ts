import type { TemplateFn } from '../types';
import { pit, treasuryRoom } from '../shared';

// ─── "Demon Forge" — anvil structure with fire geyser and lava pit ──────────
export const demonForge: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Forge frame — obsidian pillars with stone anvil base
  const FX = 520;
  const frameW = 130;
  b(FX, groundY - 80 / 2, 18, 80, 'OBSIDIAN');
  b(FX + frameW, groundY - 80 / 2, 18, 80, 'OBSIDIAN');
  const beamY = groundY - 80 - 6;
  b(FX + frameW / 2, beamY, frameW + 30, 14, 'OBSIDIAN');

  // Anvil hanging inside forge
  b(FX + frameW / 2, beamY + 25, 60, 14, 'STONE');
  b(FX + frameW / 2, beamY + 38, 40, 14, 'STONE');

  // Bellows side — wood (weak point)
  b(FX - 50, groundY - 40 / 2, 12, 40, 'WOOD');
  b(FX - 50, groundY - 40 - 6, 40, 10, 'WOOD');

  // Weapon rack behind
  const RX = 760;
  b(RX, groundY - 65 / 2, 14, 65, 'OBSIDIAN');
  b(RX + 90, groundY - 65 / 2, 14, 65, 'STONE');
  const rFloor = groundY - 65 - 6;
  b(RX + 45, rFloor, 110, 12, 'OBSIDIAN');
  b(RX + 15, rFloor - 6 - 40 / 2, 14, 40, 'WOOD');
  b(RX + 75, rFloor - 6 - 40 / 2, 14, 40, 'WOOD');
  const rFloor2 = rFloor - 6 - 40 - 6;
  b(RX + 45, rFloor2, 90, 12, 'STONE');

  ctx.hazard('LAVA_PIT', FX + frameW / 2, groundY - 10);
  ctx.hazard('FIRE_GEYSER', FX + frameW + 40, groundY - 10);

  ctx.barrel(FX + frameW / 2, groundY - 18);
  ctx.barrel(RX + 45, groundY - 18);

  ctx.enemySlots.push(
    { x: FX + frameW / 2, y: beamY - 6 - eR },
    { x: FX - 50, y: groundY - 40 - 6 - 6 - eR },
    { x: RX + 45, y: rFloor - 6 - eR },
    { x: RX + 45, y: rFloor2 - 6 - eR },
  );

  // Coins (~18g)
  ctx.coin(460, 320, 3);                           // approach — arc path
  ctx.coin(FX + frameW / 2, beamY - 30, 3);        // structure — above forge beam
  ctx.coin(RX + 45, rFloor2 - 30, 3);              // structure — above weapon rack top
  ctx.coin(FX + frameW / 2, groundY - 40, 4);      // risky — near lava pit inside forge
  ctx.coin(FX + frameW + 40, groundY - 40, 5);     // risky — near fire geyser

  // Terrain — forge stash
  treasuryRoom(ctx, 900, groundY, 80, 50, 'OBSIDIAN', 5);
};

// ─── "Obsidian Castle" — two-tower castle with obsidian walls ───────────────
export const obsidianCastle: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Left tower
  const LX = 470;
  const tSpan = 80;
  b(LX, groundY - 70 / 2, 16, 70, 'OBSIDIAN');
  b(LX + tSpan, groundY - 70 / 2, 16, 70, 'OBSIDIAN');
  const lf1 = groundY - 70 - 6;
  b(LX + tSpan / 2, lf1, tSpan + 20, 12, 'STONE');

  b(LX + 10, lf1 - 6 - 50 / 2, 14, 50, 'WOOD');
  b(LX + tSpan - 10, lf1 - 6 - 50 / 2, 14, 50, 'WOOD');
  const lf2 = lf1 - 6 - 50 - 6;
  b(LX + tSpan / 2, lf2, tSpan + 10, 12, 'OBSIDIAN');
  b(LX + tSpan / 2, lf2 - 6 - 14, 28, 28, 'OBSIDIAN');

  // Right tower
  const RX = 710;
  b(RX, groundY - 75 / 2, 16, 75, 'OBSIDIAN');
  b(RX + tSpan, groundY - 75 / 2, 16, 75, 'OBSIDIAN');
  const rf1 = groundY - 75 - 6;
  b(RX + tSpan / 2, rf1, tSpan + 20, 12, 'STONE');

  b(RX + 10, rf1 - 6 - 55 / 2, 14, 55, 'WOOD');
  b(RX + tSpan - 10, rf1 - 6 - 55 / 2, 14, 55, 'WOOD');
  const rf2 = rf1 - 6 - 55 - 6;
  b(RX + tSpan / 2, rf2, tSpan + 10, 12, 'OBSIDIAN');
  b(RX + tSpan / 2, rf2 - 6 - 14, 28, 28, 'OBSIDIAN');

  // Connecting wall — wood bridge (weak point)
  const bridgeCX = (LX + tSpan + RX) / 2;
  b(bridgeCX, groundY - 55 / 2, 14, 55, 'STONE');
  b(bridgeCX, groundY - 55 - 6, 80, 10, 'WOOD');

  ctx.hazard('LAVA_PIT', bridgeCX - 30, groundY - 10);
  ctx.hazard('LAVA_PIT', bridgeCX + 30, groundY - 10);

  ctx.barrel(LX + tSpan / 2, groundY - 18);
  ctx.barrel(RX + tSpan / 2, groundY - 18);

  ctx.enemySlots.push(
    { x: LX + tSpan / 2, y: lf1 - 6 - eR },
    { x: LX + tSpan / 2, y: lf2 - 6 - 28 - eR },
    { x: RX + tSpan / 2, y: rf1 - 6 - eR },
    { x: RX + tSpan / 2, y: rf2 - 6 - 28 - eR },
    { x: bridgeCX, y: groundY - 55 - 6 - 6 - eR },
  );

  // Coins (~19g)
  ctx.coin(430, 310, 3);                           // approach — arc path
  ctx.coin(LX + tSpan / 2, lf2 - 40, 3);           // structure — above left tower cap
  ctx.coin(RX + tSpan / 2, rf2 - 40, 3);           // structure — above right tower cap
  ctx.coin(bridgeCX - 30, groundY - 40, 5);        // risky — near lava between towers
  ctx.coin(bridgeCX + 30, groundY - 40, 5);        // risky — near lava between towers
};

// ─── "Lava Gallery" — long corridor with lava traps between rooms ───────────
export const lavaGallery: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Room 1 — left
  const R1X = 460;
  const roomW = 100;
  b(R1X, groundY - 60 / 2, 16, 60, 'OBSIDIAN');
  b(R1X + roomW, groundY - 60 / 2, 16, 60, 'STONE');
  const r1Floor = groundY - 60 - 6;
  b(R1X + roomW / 2, r1Floor, roomW + 20, 12, 'OBSIDIAN');

  // Lava gap between rooms
  ctx.hazard('LAVA_PIT', R1X + roomW + 40, groundY - 10);

  // Room 2 — center (larger, taller)
  const R2X = 630;
  b(R2X, groundY - 70 / 2, 16, 70, 'OBSIDIAN');
  b(R2X + roomW, groundY - 70 / 2, 16, 70, 'OBSIDIAN');
  const r2Floor = groundY - 70 - 6;
  b(R2X + roomW / 2, r2Floor, roomW + 20, 12, 'STONE');

  // Upper level on room 2
  b(R2X + 15, r2Floor - 6 - 45 / 2, 14, 45, 'WOOD');
  b(R2X + roomW - 15, r2Floor - 6 - 45 / 2, 14, 45, 'WOOD');
  const r2Upper = r2Floor - 6 - 45 - 6;
  b(R2X + roomW / 2, r2Upper, roomW, 12, 'OBSIDIAN');

  // Lava gap
  ctx.hazard('LAVA_PIT', R2X + roomW + 40, groundY - 10);

  // Room 3 — right
  const R3X = 800;
  b(R3X, groundY - 55 / 2, 16, 55, 'STONE');
  b(R3X + 80, groundY - 55 / 2, 16, 55, 'OBSIDIAN');
  const r3Floor = groundY - 55 - 6;
  b(R3X + 40, r3Floor, 100, 12, 'OBSIDIAN');

  ctx.hazard('FIRE_GEYSER', R2X + roomW / 2, groundY - 10);

  ctx.barrel(R2X + roomW / 2, groundY - 18);
  ctx.barrel(R1X + roomW / 2, groundY - 18);

  ctx.enemySlots.push(
    { x: R1X + roomW / 2, y: r1Floor - 6 - eR },
    { x: R2X + roomW / 2, y: r2Floor - 6 - eR },
    { x: R2X + roomW / 2, y: r2Upper - 6 - eR },
    { x: R3X + 40, y: r3Floor - 6 - eR },
    { x: R3X + 40, y: groundY - eR },
  );

  // Coins (~19g)
  ctx.coin(430, 330, 3);                              // approach — arc path
  ctx.coin(R1X + roomW / 2, r1Floor - 30, 3);         // structure — above room 1
  ctx.coin(R2X + roomW / 2, r2Upper - 30, 3);         // structure — above room 2 upper
  ctx.coin(R1X + roomW + 40, groundY - 40, 5);        // risky — near lava gap 1
  ctx.coin(R2X + roomW / 2, groundY - 40, 5);         // risky — near fire geyser
};

// ─── "Hellfire Corridor" — narrow passage with fire geysers ─────────────────
export const hellfireCorridor: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Corridor walls — left side
  const WX = 460;
  const corridorLen = 380;
  const wallH = 75;
  b(WX, groundY - wallH / 2, 20, wallH, 'OBSIDIAN');
  b(WX + corridorLen / 3, groundY - wallH / 2, 20, wallH, 'OBSIDIAN');
  b(WX + corridorLen * 2 / 3, groundY - wallH / 2, 20, wallH, 'OBSIDIAN');
  b(WX + corridorLen, groundY - wallH / 2, 20, wallH, 'OBSIDIAN');

  // Roof sections with gaps — wood weak points
  const roofY = groundY - wallH - 6;
  b(WX + corridorLen / 6, roofY, corridorLen / 3 - 20, 12, 'WOOD');
  b(WX + corridorLen / 2, roofY, corridorLen / 3 - 20, 12, 'STONE');
  b(WX + corridorLen * 5 / 6, roofY, corridorLen / 3 - 20, 12, 'OBSIDIAN');

  // Upper platforms on obsidian roof section
  b(WX + corridorLen * 5 / 6 - 25, roofY - 6 - 30 / 2, 14, 30, 'STONE');
  b(WX + corridorLen * 5 / 6 + 25, roofY - 6 - 30 / 2, 14, 30, 'STONE');
  const upperY = roofY - 6 - 30 - 6;
  b(WX + corridorLen * 5 / 6, upperY, 70, 12, 'OBSIDIAN');

  // Fire geysers along corridor floor
  ctx.hazard('FIRE_GEYSER', WX + corridorLen / 4, groundY - 10);
  ctx.hazard('LAVA_PIT', WX + corridorLen * 3 / 4, groundY - 10);

  ctx.barrel(WX + corridorLen / 6, groundY - 18);
  ctx.barrel(WX + corridorLen / 2, groundY - 18);

  ctx.enemySlots.push(
    { x: WX + corridorLen / 6, y: groundY - eR },
    { x: WX + corridorLen / 2, y: roofY - 6 - eR },
    { x: WX + corridorLen * 5 / 6, y: roofY - 6 - eR },
    { x: WX + corridorLen * 5 / 6, y: upperY - 6 - eR },
  );

  // Coins (~18g)
  ctx.coin(440, 340, 3);                                  // approach — arc path
  ctx.coin(WX + corridorLen / 2, roofY - 30, 3);          // structure — above mid corridor
  ctx.coin(WX + corridorLen * 5 / 6, upperY - 30, 3);     // structure — above upper platform
  ctx.coin(WX + corridorLen / 4, groundY - 40, 4);        // risky — near fire geyser
  ctx.coin(WX + corridorLen * 3 / 4, groundY - 40, 5);    // risky — near lava pit
};

// ─── "Demon Arena" — circular pit with obsidian walls and lava ──────────────
export const demonArena: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  const CX = 680;
  const pitW = 200;

  // Thick obsidian pit walls
  b(CX - pitW / 2, groundY - 50 / 2, 22, 50, 'OBSIDIAN');
  b(CX + pitW / 2, groundY - 50 / 2, 22, 50, 'OBSIDIAN');

  // Raised platforms on sides
  const LX = CX - pitW / 2 - 90;
  b(LX, groundY - 65 / 2, 14, 65, 'STONE');
  b(LX + 70, groundY - 65 / 2, 14, 65, 'OBSIDIAN');
  const lf = groundY - 65 - 6;
  b(LX + 35, lf, 90, 12, 'OBSIDIAN');

  const RX = CX + pitW / 2 + 20;
  b(RX, groundY - 65 / 2, 14, 65, 'OBSIDIAN');
  b(RX + 70, groundY - 65 / 2, 14, 65, 'STONE');
  const rf = groundY - 65 - 6;
  b(RX + 35, rf, 90, 12, 'OBSIDIAN');

  // Overhead plank (wood weak point)
  b(LX + 35, lf - 6 - 35 / 2, 14, 35, 'STONE');
  b(RX + 35, rf - 6 - 35 / 2, 14, 35, 'STONE');
  const overY = lf - 6 - 35 - 6;
  b(CX, overY, pitW + 80, 12, 'WOOD');

  // Lava in the pit
  ctx.hazard('LAVA_PIT', CX - 40, groundY - 10);
  ctx.hazard('LAVA_PIT', CX + 40, groundY - 10);

  ctx.barrel(CX, groundY - 18);
  ctx.barrel(CX, overY - 6 - 18);

  ctx.enemySlots.push(
    { x: CX, y: groundY - eR },
    { x: LX + 35, y: lf - 6 - eR },
    { x: RX + 35, y: rf - 6 - eR },
    { x: CX, y: overY - 6 - eR },
    { x: CX + 60, y: groundY - eR },
  );

  // Coins (~20g)
  ctx.coin(460, 310, 3);                   // approach — arc path
  ctx.coin(CX, overY - 30, 3);             // structure — above overhead plank
  ctx.coin(RX + 35, rf - 30, 3);           // structure — above right platform
  ctx.coin(CX - 40, groundY - 40, 5);      // risky — near lava in pit
  ctx.coin(CX + 40, groundY - 18, 3);      // risky — near lava in pit (ground level)
  ctx.coin(LX + 35, lf - 30, 3);           // structure — above left platform

  // Terrain — raised edges around the arena pit
  pit(ctx, 700, groundY, 100, 24);
};

// ─── "Volcanic Spire" — very tall single spire with fire geyser ────────────
export const volcanicSpire: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  const TX = 600;
  const span = 90;

  // Level 1 — wide obsidian base
  b(TX, groundY - 65 / 2, 18, 65, 'OBSIDIAN');
  b(TX + span, groundY - 65 / 2, 18, 65, 'OBSIDIAN');
  b(TX + span / 2, groundY - 65 / 2, 14, 65, 'STONE');
  const f1 = groundY - 65 - 6;
  b(TX + span / 2, f1, span + 30, 14, 'OBSIDIAN');

  // Level 2
  b(TX + 10, f1 - 6 - 55 / 2, 14, 55, 'STONE');
  b(TX + span - 10, f1 - 6 - 55 / 2, 14, 55, 'STONE');
  const f2 = f1 - 6 - 55 - 6;
  b(TX + span / 2, f2, span + 10, 12, 'OBSIDIAN');

  // Level 3 — narrow
  b(TX + span / 2 - 20, f2 - 6 - 45 / 2, 14, 45, 'WOOD');
  b(TX + span / 2 + 20, f2 - 6 - 45 / 2, 14, 45, 'WOOD');
  const f3 = f2 - 6 - 45 - 6;
  b(TX + span / 2, f3, 60, 12, 'OBSIDIAN');
  b(TX + span / 2, f3 - 6 - 14, 24, 24, 'OBSIDIAN');

  // Side shelter
  const SX = 790;
  b(SX, groundY - 45 / 2, 14, 45, 'OBSIDIAN');
  b(SX + 60, groundY - 45 / 2, 14, 45, 'STONE');
  const sf = groundY - 45 - 6;
  b(SX + 30, sf, 80, 12, 'STONE');

  ctx.hazard('FIRE_GEYSER', TX - 40, groundY - 10);
  ctx.hazard('LAVA_PIT', TX + span + 30, groundY - 10);

  ctx.barrel(TX + span / 2, groundY - 18);
  ctx.barrel(TX + span / 2, f1 - 6 - 18);

  ctx.enemySlots.push(
    { x: TX + span / 2, y: f1 - 6 - eR },
    { x: TX + span / 2, y: f2 - 6 - eR },
    { x: TX + span / 2, y: f3 - 6 - 24 - eR },
    { x: SX + 30, y: sf - 6 - eR },
  );

  // Coins (~18g)
  ctx.coin(480, 300, 3);                          // approach — arc path
  ctx.coin(TX + span / 2, f2 - 30, 3);            // structure — above level 2
  ctx.coin(SX + 30, sf - 30, 3);                   // structure — above side shelter
  ctx.coin(TX - 40, groundY - 40, 4);              // risky — near fire geyser
  ctx.coin(TX + span + 30, groundY - 40, 5);       // risky — near lava pit
};

// ─── "Obsidian Bunker" — low wide hardened shelter ──────────────────────────
export const obsidianBunker: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  const BX = 580;
  const bunkerW = 250;
  const wallH = 55;

  // Thick obsidian outer walls
  b(BX - bunkerW / 2, groundY - wallH / 2, 26, wallH, 'OBSIDIAN');
  b(BX + bunkerW / 2, groundY - wallH / 2, 26, wallH, 'OBSIDIAN');

  // Inner wood dividers (weak points)
  b(BX - bunkerW / 6, groundY - 40 / 2, 10, 40, 'WOOD');
  b(BX + bunkerW / 6, groundY - 40 / 2, 10, 40, 'WOOD');

  // Split roof — obsidian outer, gap in middle
  const roofY = groundY - wallH - 6;
  b(BX - bunkerW / 4 - 10, roofY, bunkerW / 2 - 30, 14, 'OBSIDIAN');
  b(BX + bunkerW / 4 + 10, roofY, bunkerW / 2 - 30, 14, 'OBSIDIAN');

  // Upper battlement
  b(BX - bunkerW / 4, roofY - 6 - 30 / 2, 14, 30, 'STONE');
  b(BX + bunkerW / 4, roofY - 6 - 30 / 2, 14, 30, 'STONE');
  const upperY = roofY - 6 - 30 - 6;
  b(BX, upperY, bunkerW * 0.6, 12, 'STONE');

  ctx.hazard('LAVA_PIT', BX - bunkerW / 2 - 40, groundY - 10);
  ctx.hazard('FIRE_GEYSER', BX + bunkerW / 2 + 40, groundY - 10);

  ctx.barrel(BX, groundY - 18);
  ctx.barrel(BX + bunkerW / 4, roofY - 6 - 18);

  ctx.enemySlots.push(
    { x: BX - bunkerW / 4, y: groundY - eR },
    { x: BX + bunkerW / 4, y: groundY - eR },
    { x: BX - bunkerW / 4, y: roofY - 6 - eR },
    { x: BX + bunkerW / 4, y: roofY - 6 - eR },
    { x: BX, y: upperY - 6 - eR },
  );

  // Coins (~19g)
  ctx.coin(440, 320, 3);                              // approach — arc path
  ctx.coin(BX, upperY - 30, 3);                       // structure — above upper battlement
  ctx.coin(BX, roofY - 30, 3);                        // structure — above bunker roof gap
  ctx.coin(BX - bunkerW / 2 - 40, groundY - 40, 5);   // risky — near lava pit
  ctx.coin(BX + bunkerW / 2 + 40, groundY - 40, 5);   // risky — near fire geyser
};

// ─── "Ash Fortress" — multi-wing compound with obsidian reinforcement ───────
export const ashFortress: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Front wall with obsidian gate
  const WX = 460;
  b(WX, groundY - 70 / 2, 22, 70, 'OBSIDIAN');
  b(WX + 100, groundY - 70 / 2, 22, 70, 'OBSIDIAN');
  const lintel = groundY - 70 - 6;
  b(WX + 50, lintel, 90, 12, 'STONE');

  // Inner compound
  const IX = 610;
  b(IX, groundY - 60 / 2, 14, 60, 'STONE');
  b(IX + 80, groundY - 60 / 2, 14, 60, 'STONE');
  const iFloor = groundY - 60 - 6;
  b(IX + 40, iFloor, 100, 12, 'WOOD');

  // Rear tower — heavy obsidian
  const RX = 770;
  b(RX, groundY - 80 / 2, 16, 80, 'OBSIDIAN');
  b(RX + 100, groundY - 80 / 2, 16, 80, 'OBSIDIAN');
  const rf1 = groundY - 80 - 6;
  b(RX + 50, rf1, 120, 14, 'OBSIDIAN');

  b(RX + 15, rf1 - 6 - 50 / 2, 14, 50, 'WOOD');
  b(RX + 85, rf1 - 6 - 50 / 2, 14, 50, 'WOOD');
  const rf2 = rf1 - 6 - 50 - 6;
  b(RX + 50, rf2, 100, 12, 'OBSIDIAN');
  b(RX + 50, rf2 - 6 - 14, 28, 28, 'STONE');

  ctx.hazard('LAVA_PIT', WX + 50, groundY - 10);
  ctx.hazard('FIRE_GEYSER', IX + 40, groundY - 10);

  ctx.barrel(IX + 40, groundY - 18);
  ctx.barrel(RX + 50, groundY - 18);

  ctx.enemySlots.push(
    { x: WX + 50, y: lintel - 6 - eR },
    { x: IX + 40, y: iFloor - 6 - eR },
    { x: RX + 50, y: rf1 - 6 - eR },
    { x: RX + 50, y: rf2 - 6 - 28 - eR },
    { x: RX + 50, y: groundY - eR },
  );

  // Coins (~20g)
  ctx.coin(430, 320, 3);                   // approach — arc path
  ctx.coin(WX + 50, lintel - 30, 3);       // structure — above front gate lintel
  ctx.coin(RX + 50, rf2 - 40, 3);          // structure — above rear tower cap
  ctx.coin(WX + 50, groundY - 40, 5);      // risky — near lava pit
  ctx.coin(IX + 40, groundY - 40, 3);      // risky — near fire geyser
  ctx.coin(RX + 50, rf1 - 30, 3);          // structure — above rear tower level 1
};

export const diff3Templates: TemplateFn[] = [
  demonForge,
  obsidianCastle,
  lavaGallery,
  hellfireCorridor,
  demonArena,
  volcanicSpire,
  obsidianBunker,
  ashFortress,
];
