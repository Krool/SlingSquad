import type { TemplateFn } from '../types';
import { raisedPlatform } from '../shared';

// ─── "Demon Citadel" — massive twin-tower fortress with obsidian bridge ─────
export const demonCitadel: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Left tower — 3 levels
  const LX = 450;
  const tSpan = 90;
  b(LX, groundY - 75 / 2, 18, 75, 'OBSIDIAN');
  b(LX + tSpan, groundY - 75 / 2, 18, 75, 'OBSIDIAN');
  const lf1 = groundY - 75 - 6;
  b(LX + tSpan / 2, lf1, tSpan + 30, 14, 'OBSIDIAN');

  b(LX + 10, lf1 - 6 - 55 / 2, 14, 55, 'STONE');
  b(LX + tSpan - 10, lf1 - 6 - 55 / 2, 14, 55, 'STONE');
  const lf2 = lf1 - 6 - 55 - 6;
  b(LX + tSpan / 2, lf2, tSpan + 10, 12, 'OBSIDIAN');

  b(LX + tSpan / 2, lf2 - 6 - 35 / 2, 14, 35, 'WOOD');
  const lf3 = lf2 - 6 - 35 - 6;
  b(LX + tSpan / 2, lf3, 60, 12, 'OBSIDIAN');

  // Right tower — 3 levels, taller
  const RX = 720;
  b(RX, groundY - 80 / 2, 18, 80, 'OBSIDIAN');
  b(RX + tSpan, groundY - 80 / 2, 18, 80, 'OBSIDIAN');
  const rf1 = groundY - 80 - 6;
  b(RX + tSpan / 2, rf1, tSpan + 30, 14, 'OBSIDIAN');

  b(RX + 10, rf1 - 6 - 55 / 2, 14, 55, 'STONE');
  b(RX + tSpan - 10, rf1 - 6 - 55 / 2, 14, 55, 'STONE');
  const rf2 = rf1 - 6 - 55 - 6;
  b(RX + tSpan / 2, rf2, tSpan + 10, 12, 'OBSIDIAN');

  b(RX + tSpan / 2, rf2 - 6 - 40 / 2, 14, 40, 'WOOD');
  const rf3 = rf2 - 6 - 40 - 6;
  b(RX + tSpan / 2, rf3, 60, 12, 'OBSIDIAN');
  b(RX + tSpan / 2, rf3 - 6 - 14, 28, 28, 'OBSIDIAN');

  // Connecting bridge at level 1 — wood (critical weak point)
  const bridgeCX = (LX + tSpan + RX) / 2;
  b(bridgeCX, lf1 - 6 - 50 / 2, 14, 50, 'WOOD');
  b(bridgeCX, lf1, 100, 10, 'WOOD');

  ctx.hazard('LAVA_PIT', bridgeCX - 30, groundY - 10);
  ctx.hazard('LAVA_PIT', bridgeCX + 30, groundY - 10);

  ctx.barrel(bridgeCX, groundY - 18);
  ctx.barrel(LX + tSpan / 2, lf1 - 6 - 18);
  ctx.barrel(RX + tSpan / 2, rf1 - 6 - 18);

  ctx.enemySlots.push(
    { x: LX + tSpan / 2, y: lf1 - 6 - eR },
    { x: LX + tSpan / 2, y: lf2 - 6 - eR },
    { x: RX + tSpan / 2, y: rf1 - 6 - eR },
    { x: RX + tSpan / 2, y: rf2 - 6 - eR },
    { x: RX + tSpan / 2, y: rf3 - 6 - 28 - eR },
  );

  // Coins (~23g)
  ctx.coin(430, 280, 3);                          // approach — arc path
  ctx.coin(LX + tSpan / 2, lf3 - 30, 4);          // structure — above left tower cap
  ctx.coin(RX + tSpan / 2, rf3 - 40, 4);          // structure — above right tower cap
  ctx.coin(bridgeCX - 30, groundY - 40, 5);       // risky — near lava between towers
  ctx.coin(bridgeCX + 30, groundY - 40, 5);       // risky — near lava between towers
  ctx.coin(bridgeCX, lf1 - 30, 2);                // structure — above wood bridge
};

// ─── "Obsidian Keep" — 4-room layered fortress ──────────────────────────────
export const obsidianKeep: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  const span = 90;
  const gap = 25;
  const pillarH = 70;
  const startX = 440;

  // Ground floor — 4 rooms
  const roomCenters: number[] = [];
  for (let i = 0; i < 4; i++) {
    const rx = startX + i * (span + gap);
    roomCenters.push(rx + span / 2);
    b(rx, groundY - pillarH / 2, 14, pillarH, 'OBSIDIAN');
    b(rx + span, groundY - pillarH / 2, 14, pillarH, 'OBSIDIAN');
    const floorY = groundY - pillarH - 6;
    b(rx + span / 2, floorY, 120, 12, 'STONE');
  }
  const lowerFloor = groundY - pillarH - 6;

  // Upper floor — 2 merged rooms
  const upperH = 55;
  for (let i = 0; i < 2; i++) {
    const lc = (roomCenters[i * 2] + roomCenters[i * 2 + 1]) / 2;
    b(lc - span / 2, lowerFloor - 6 - upperH / 2, 14, upperH, 'STONE');
    b(lc + span / 2, lowerFloor - 6 - upperH / 2, 14, upperH, 'STONE');
    const uFloor = lowerFloor - 6 - upperH - 6;
    b(lc, uFloor, 220, 12, 'OBSIDIAN');
  }
  const upperFloor = lowerFloor - 6 - upperH - 6;

  // Spire — obsidian cap
  const spireX = (roomCenters[1] + roomCenters[2]) / 2;
  b(spireX, upperFloor - 6 - 40 / 2, 14, 40, 'WOOD');
  const capY = upperFloor - 6 - 40 - 6;
  b(spireX, capY, 80, 12, 'OBSIDIAN');
  b(spireX - 20, capY - 6 - 14, 28, 28, 'OBSIDIAN');
  b(spireX + 20, capY - 6 - 14, 28, 28, 'OBSIDIAN');

  // Obsidian crenellations on lower floor
  for (let i = 0; i < 4; i++) {
    b(roomCenters[i], lowerFloor - 6 - 14, 24, 24, 'OBSIDIAN');
  }

  ctx.hazard('LAVA_PIT', roomCenters[0] - 30, groundY - 10);
  ctx.hazard('FIRE_GEYSER', roomCenters[3] + 30, groundY - 10);

  ctx.barrel(roomCenters[1], groundY - 18);
  ctx.barrel(roomCenters[2], groundY - 18);

  ctx.enemySlots.push(
    { x: roomCenters[0], y: lowerFloor - 6 - 24 - eR },
    { x: roomCenters[3], y: lowerFloor - 6 - 24 - eR },
    { x: (roomCenters[0] + roomCenters[1]) / 2, y: upperFloor - 6 - eR },
    { x: (roomCenters[2] + roomCenters[3]) / 2, y: upperFloor - 6 - eR },
    { x: spireX, y: capY - 6 - 28 - eR },
  );

  // Coins (~22g)
  ctx.coin(430, 290, 3);                                     // approach — arc path
  ctx.coin(spireX, capY - 40, 4);                             // structure — above spire cap
  ctx.coin(roomCenters[1], lowerFloor - 40, 3);               // structure — above room 2
  ctx.coin(roomCenters[0] - 30, groundY - 40, 5);             // risky — near lava pit
  ctx.coin(roomCenters[3] + 30, groundY - 40, 4);             // risky — near fire geyser
  ctx.coin((roomCenters[0] + roomCenters[1]) / 2, upperFloor - 30, 3); // structure — above upper left
};

// ─── "Lava Fortress" — central fortress surrounded by lava moat ─────────────
export const lavaFortress: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Outer lava moat
  ctx.hazard('LAVA_PIT', 500, groundY - 10);
  ctx.hazard('LAVA_PIT', 850, groundY - 10);

  // Central fortress
  const CX = 670;
  const fortW = 200;
  b(CX - fortW / 2, groundY - 80 / 2, 22, 80, 'OBSIDIAN');
  b(CX, groundY - 80 / 2, 14, 80, 'OBSIDIAN');
  b(CX + fortW / 2, groundY - 80 / 2, 22, 80, 'OBSIDIAN');
  const f1 = groundY - 80 - 6;
  b(CX, f1, fortW + 30, 14, 'OBSIDIAN');

  // Second level
  b(CX - fortW / 3, f1 - 6 - 55 / 2, 14, 55, 'STONE');
  b(CX + fortW / 3, f1 - 6 - 55 / 2, 14, 55, 'STONE');
  const f2 = f1 - 6 - 55 - 6;
  b(CX, f2, fortW - 20, 12, 'OBSIDIAN');

  // Third level — narrow
  b(CX - 25, f2 - 6 - 40 / 2, 14, 40, 'WOOD');
  b(CX + 25, f2 - 6 - 40 / 2, 14, 40, 'WOOD');
  const f3 = f2 - 6 - 40 - 6;
  b(CX, f3, 80, 12, 'STONE');
  b(CX, f3 - 6 - 14, 28, 28, 'OBSIDIAN');

  // Approach ramp (stone)
  const AX = 460;
  b(AX, groundY - 35 / 2, 14, 35, 'STONE');
  b(AX + 50, groundY - 50 / 2, 14, 50, 'STONE');
  b(AX + 25, groundY - 35 - 6, 70, 10, 'WOOD');

  ctx.hazard('FIRE_GEYSER', CX, groundY - 10);

  ctx.barrel(CX - fortW / 4, groundY - 18);
  ctx.barrel(CX + fortW / 4, f1 - 6 - 18);

  ctx.enemySlots.push(
    { x: CX - fortW / 4, y: f1 - 6 - eR },
    { x: CX + fortW / 4, y: f1 - 6 - eR },
    { x: CX, y: f2 - 6 - eR },
    { x: CX, y: f3 - 6 - 28 - eR },
    { x: AX + 25, y: groundY - 35 - 6 - 6 - eR },
  );

  // Coins (~23g)
  ctx.coin(440, 290, 3);                    // approach — arc path near ramp
  ctx.coin(CX, f3 - 40, 4);                 // structure — above fortress pinnacle
  ctx.coin(AX + 25, groundY - 50, 3);       // structure — above approach ramp
  ctx.coin(500, groundY - 40, 5);            // risky — near outer lava moat
  ctx.coin(850, groundY - 40, 5);            // risky — near right lava moat
  ctx.coin(CX, groundY - 40, 3);            // risky — near fire geyser

  // Terrain — rock formation at approach
  raisedPlatform(ctx, 560, groundY, 100, 22);
};

// ─── "Hellfire Complex" — multi-building compound with fire geysers ─────────
export const hellfireComplex: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Building A — left bunker
  const AX = 450;
  const bunkW = 100;
  b(AX, groundY - 60 / 2, 20, 60, 'OBSIDIAN');
  b(AX + bunkW, groundY - 60 / 2, 20, 60, 'OBSIDIAN');
  const af = groundY - 60 - 6;
  b(AX + bunkW / 2, af, bunkW + 20, 14, 'OBSIDIAN');
  b(AX + bunkW / 2, af - 6 - 14, 28, 28, 'STONE');

  // Building B — center hall
  const BX = 600;
  const hallW = 140;
  b(BX, groundY - 75 / 2, 16, 75, 'OBSIDIAN');
  b(BX + hallW / 2, groundY - 75 / 2, 14, 75, 'STONE');
  b(BX + hallW, groundY - 75 / 2, 16, 75, 'OBSIDIAN');
  const bf1 = groundY - 75 - 6;
  b(BX + hallW / 2, bf1, hallW + 30, 14, 'OBSIDIAN');

  // Upper hall level
  b(BX + 15, bf1 - 6 - 50 / 2, 14, 50, 'WOOD');
  b(BX + hallW - 15, bf1 - 6 - 50 / 2, 14, 50, 'WOOD');
  const bf2 = bf1 - 6 - 50 - 6;
  b(BX + hallW / 2, bf2, hallW, 12, 'OBSIDIAN');

  // Building C — right watchtower
  const CXt = 800;
  b(CXt, groundY - 65 / 2, 14, 65, 'OBSIDIAN');
  b(CXt + 70, groundY - 65 / 2, 14, 65, 'OBSIDIAN');
  const cf = groundY - 65 - 6;
  b(CXt + 35, cf, 90, 12, 'STONE');
  b(CXt + 35, cf - 6 - 30 / 2, 14, 30, 'STONE');
  const cf2 = cf - 6 - 30 - 6;
  b(CXt + 35, cf2, 60, 12, 'OBSIDIAN');

  // Fire geysers between buildings
  ctx.hazard('FIRE_GEYSER', AX + bunkW + 25, groundY - 10);
  ctx.hazard('FIRE_GEYSER', BX + hallW + 25, groundY - 10);
  ctx.hazard('LAVA_PIT', BX + hallW / 2, groundY - 10);

  ctx.barrel(AX + bunkW / 2, groundY - 18);
  ctx.barrel(BX + hallW / 2, groundY - 18);

  ctx.enemySlots.push(
    { x: AX + bunkW / 2, y: af - 6 - 28 - eR },
    { x: BX + hallW / 2, y: bf1 - 6 - eR },
    { x: BX + hallW / 2, y: bf2 - 6 - eR },
    { x: CXt + 35, y: cf - 6 - eR },
    { x: CXt + 35, y: cf2 - 6 - eR },
  );

  // Coins (~24g)
  ctx.coin(430, 300, 3);                               // approach — arc path
  ctx.coin(BX + hallW / 2, bf2 - 30, 4);               // structure — above center hall upper
  ctx.coin(CXt + 35, cf2 - 30, 4);                     // structure — above right watchtower top
  ctx.coin(AX + bunkW + 25, groundY - 40, 5);          // risky — near fire geyser (between A & B)
  ctx.coin(BX + hallW + 25, groundY - 40, 5);          // risky — near fire geyser (between B & C)
  ctx.coin(BX + hallW / 2, groundY - 40, 3);           // risky — near lava pit under hall
};

// ─── "Demon Stronghold" — L-shaped fortress with obsidian walls ─────────────
export const demonStronghold: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Horizontal wing — ground level
  const HX = 450;
  const wingW = 220;
  for (let i = 0; i < 4; i++) {
    const mat = i % 2 === 0 ? 'OBSIDIAN' : 'STONE';
    b(HX + i * (wingW / 3), groundY - 65 / 2, 14, 65, mat);
  }
  const hFloor = groundY - 65 - 6;
  b(HX + wingW / 2, hFloor, wingW + 30, 14, 'OBSIDIAN');

  // Vertical tower rising from right end
  const VX = HX + wingW - 10;
  const vSpan = 90;
  b(VX, hFloor - 6 - 60 / 2, 14, 60, 'OBSIDIAN');
  b(VX + vSpan, hFloor - 6 - 60 / 2, 14, 60, 'OBSIDIAN');
  const vf1 = hFloor - 6 - 60 - 6;
  b(VX + vSpan / 2, vf1, vSpan + 20, 12, 'OBSIDIAN');

  b(VX + 15, vf1 - 6 - 45 / 2, 14, 45, 'WOOD');
  b(VX + vSpan - 15, vf1 - 6 - 45 / 2, 14, 45, 'WOOD');
  const vf2 = vf1 - 6 - 45 - 6;
  b(VX + vSpan / 2, vf2, vSpan + 10, 12, 'OBSIDIAN');
  b(VX + vSpan / 2, vf2 - 6 - 14, 28, 28, 'OBSIDIAN');

  ctx.hazard('LAVA_PIT', HX + wingW / 4, groundY - 10);
  ctx.hazard('FIRE_GEYSER', HX + wingW * 3 / 4, groundY - 10);

  ctx.barrel(HX + wingW / 3, groundY - 18);
  ctx.barrel(VX + vSpan / 2, hFloor - 6 - 18);

  ctx.enemySlots.push(
    { x: HX + wingW / 3, y: hFloor - 6 - eR },
    { x: HX + wingW * 2 / 3, y: hFloor - 6 - eR },
    { x: VX + vSpan / 2, y: vf1 - 6 - eR },
    { x: VX + vSpan / 2, y: vf2 - 6 - 28 - eR },
    { x: HX + wingW / 2, y: groundY - eR },
  );

  // Coins (~22g)
  ctx.coin(430, 300, 3);                               // approach — arc path
  ctx.coin(VX + vSpan / 2, vf2 - 40, 4);               // structure — above L-tower cap
  ctx.coin(HX + wingW / 2, hFloor - 30, 3);            // structure — above horizontal wing
  ctx.coin(HX + wingW / 4, groundY - 40, 5);           // risky — near lava pit
  ctx.coin(HX + wingW * 3 / 4, groundY - 40, 4);       // risky — near fire geyser
  ctx.coin(VX + vSpan / 2, vf1 - 30, 3);               // structure — above vertical level 1
};

// ─── "Volcanic Bastion" — 4-tier pyramid fortress ───────────────────────────
export const volcanicBastion: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  const CX = 680;

  // Tier 1 — wide obsidian base
  const t1W = 280;
  b(CX - t1W / 2, groundY - 60 / 2, 20, 60, 'OBSIDIAN');
  b(CX, groundY - 60 / 2, 14, 60, 'OBSIDIAN');
  b(CX + t1W / 2, groundY - 60 / 2, 20, 60, 'OBSIDIAN');
  const f1 = groundY - 60 - 6;
  b(CX, f1, t1W + 20, 14, 'OBSIDIAN');

  // Tier 2
  const t2W = 180;
  b(CX - t2W / 2, f1 - 6 - 50 / 2, 14, 50, 'STONE');
  b(CX + t2W / 2, f1 - 6 - 50 / 2, 14, 50, 'STONE');
  const f2 = f1 - 6 - 50 - 6;
  b(CX, f2, t2W + 10, 12, 'OBSIDIAN');

  // Tier 3
  const t3W = 100;
  b(CX - t3W / 2, f2 - 6 - 40 / 2, 14, 40, 'WOOD');
  b(CX + t3W / 2, f2 - 6 - 40 / 2, 14, 40, 'WOOD');
  const f3 = f2 - 6 - 40 - 6;
  b(CX, f3, t3W + 10, 12, 'STONE');

  // Tier 4 — cap
  b(CX, f3 - 6 - 30 / 2, 14, 30, 'OBSIDIAN');
  const f4 = f3 - 6 - 30 - 6;
  b(CX, f4, 50, 12, 'OBSIDIAN');
  b(CX, f4 - 6 - 14, 24, 24, 'OBSIDIAN');

  ctx.hazard('LAVA_PIT', CX - t1W / 2 - 30, groundY - 10);
  ctx.hazard('LAVA_PIT', CX + t1W / 2 + 30, groundY - 10);

  ctx.barrel(CX - t1W / 4, groundY - 18);
  ctx.barrel(CX + t1W / 4, f1 - 6 - 18);

  ctx.enemySlots.push(
    { x: CX - t1W / 4, y: f1 - 6 - eR },
    { x: CX + t1W / 4, y: f1 - 6 - eR },
    { x: CX, y: f2 - 6 - eR },
    { x: CX, y: f3 - 6 - eR },
    { x: CX, y: f4 - 6 - 24 - eR },
  );

  // Coins (~24g)
  ctx.coin(470, 280, 3);                            // approach — arc path
  ctx.coin(CX, f4 - 40, 5);                          // treasury — above pyramid pinnacle
  ctx.coin(CX - t1W / 4, f1 - 30, 3);                // structure — above tier 1 left
  ctx.coin(CX + t1W / 4, f2 - 30, 4);                // structure — above tier 2
  ctx.coin(CX - t1W / 2 - 30, groundY - 40, 5);      // risky — near lava moat left
  ctx.coin(CX + t1W / 2 + 30, groundY - 40, 4);      // risky — near lava moat right
};

// ─── "Obsidian Monolith" — single massive pillar with satellite platforms ───
export const obsidianMonolith: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Central monolith — thick obsidian tower
  const MX = 650;
  b(MX, groundY - 100 / 2, 30, 100, 'OBSIDIAN');
  b(MX, groundY - 100 - 6 - 14, 40, 28, 'OBSIDIAN');

  // Satellite platform left
  const LX = 470;
  b(LX, groundY - 55 / 2, 14, 55, 'STONE');
  b(LX + 70, groundY - 55 / 2, 14, 55, 'OBSIDIAN');
  const lf = groundY - 55 - 6;
  b(LX + 35, lf, 90, 12, 'OBSIDIAN');
  // Upper left
  b(LX + 35, lf - 6 - 40 / 2, 14, 40, 'WOOD');
  const lf2 = lf - 6 - 40 - 6;
  b(LX + 35, lf2, 60, 12, 'STONE');

  // Satellite platform right
  const RX = 770;
  b(RX, groundY - 60 / 2, 14, 60, 'OBSIDIAN');
  b(RX + 80, groundY - 60 / 2, 14, 60, 'STONE');
  const rf = groundY - 60 - 6;
  b(RX + 40, rf, 100, 12, 'OBSIDIAN');
  // Upper right
  b(RX + 40, rf - 6 - 45 / 2, 14, 45, 'WOOD');
  const rf2 = rf - 6 - 45 - 6;
  b(RX + 40, rf2, 70, 12, 'STONE');

  // Wood bridges to monolith (weak points)
  b((LX + 70 + MX) / 2, lf, 60, 10, 'WOOD');
  b((MX + RX) / 2, rf, 60, 10, 'WOOD');

  ctx.hazard('LAVA_PIT', MX - 60, groundY - 10);
  ctx.hazard('LAVA_PIT', MX + 60, groundY - 10);
  ctx.hazard('FIRE_GEYSER', LX + 35, groundY - 10);

  ctx.barrel(MX, groundY - 18);
  ctx.barrel(RX + 40, groundY - 18);

  ctx.enemySlots.push(
    { x: LX + 35, y: lf - 6 - eR },
    { x: LX + 35, y: lf2 - 6 - eR },
    { x: RX + 40, y: rf - 6 - eR },
    { x: RX + 40, y: rf2 - 6 - eR },
    { x: MX, y: groundY - 100 - 6 - 28 - eR },
  );

  // Coins (~24g)
  ctx.coin(440, 290, 3);                       // approach — arc path
  ctx.coin(MX, groundY - 100 - 50, 5);         // treasury — above monolith top
  ctx.coin(LX + 35, lf2 - 30, 3);              // structure — above left upper platform
  ctx.coin(RX + 40, rf2 - 30, 4);              // structure — above right upper platform
  ctx.coin(MX - 60, groundY - 40, 5);          // risky — near lava left of monolith
  ctx.coin(LX + 35, groundY - 40, 4);          // risky — near fire geyser at left

  // Terrain — rock outcrop around monolith base
  raisedPlatform(ctx, 750, groundY, 80, 18);
};

// ─── "Inferno Compound" — walled compound with inner structures ─────────────
export const infernoCompound: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Outer walls
  const WX = 450;
  b(WX, groundY - 75 / 2, 24, 75, 'OBSIDIAN');
  b(WX + 200, groundY - 75 / 2, 24, 75, 'OBSIDIAN');
  // Lintel
  const lintelY = groundY - 75 - 6;
  b(WX + 100, lintelY, 170, 12, 'STONE');

  // Inner structure A — barracks
  const AX = 490;
  b(AX, groundY - 50 / 2, 14, 50, 'STONE');
  b(AX + 60, groundY - 50 / 2, 14, 50, 'STONE');
  const af = groundY - 50 - 6;
  b(AX + 30, af, 80, 12, 'WOOD');

  // Inner structure B — armory tower
  const BX = 600;
  b(BX, groundY - 55 / 2, 14, 55, 'OBSIDIAN');
  b(BX + 70, groundY - 55 / 2, 14, 55, 'OBSIDIAN');
  const bf = groundY - 55 - 6;
  b(BX + 35, bf, 90, 12, 'OBSIDIAN');

  // Rear keep
  const KX = 730;
  b(KX, groundY - 85 / 2, 18, 85, 'OBSIDIAN');
  b(KX + 110, groundY - 85 / 2, 18, 85, 'OBSIDIAN');
  const kf1 = groundY - 85 - 6;
  b(KX + 55, kf1, 130, 14, 'OBSIDIAN');

  b(KX + 20, kf1 - 6 - 55 / 2, 14, 55, 'WOOD');
  b(KX + 90, kf1 - 6 - 55 / 2, 14, 55, 'WOOD');
  const kf2 = kf1 - 6 - 55 - 6;
  b(KX + 55, kf2, 100, 12, 'OBSIDIAN');
  b(KX + 55, kf2 - 6 - 14, 28, 28, 'OBSIDIAN');

  ctx.hazard('LAVA_PIT', WX + 100, groundY - 10);
  ctx.hazard('FIRE_GEYSER', KX + 55, groundY - 10);

  ctx.barrel(AX + 30, groundY - 18);
  ctx.barrel(KX + 55, groundY - 18);
  ctx.barrel(BX + 35, groundY - 18);

  ctx.enemySlots.push(
    { x: AX + 30, y: af - 6 - eR },
    { x: BX + 35, y: bf - 6 - eR },
    { x: KX + 55, y: kf1 - 6 - eR },
    { x: KX + 55, y: kf2 - 6 - 28 - eR },
    { x: WX + 100, y: lintelY - 6 - eR },
    { x: KX + 55, y: groundY - eR },
  );

  // Coins (~25g)
  ctx.coin(430, 280, 3);                      // approach — arc path
  ctx.coin(WX + 100, lintelY - 30, 4);        // structure — above outer gate lintel
  ctx.coin(KX + 55, kf2 - 40, 5);             // treasury — above rear keep cap
  ctx.coin(WX + 100, groundY - 40, 5);        // risky — near lava pit
  ctx.coin(KX + 55, groundY - 40, 5);         // risky — near fire geyser
  ctx.coin(BX + 35, bf - 30, 3);              // structure — above armory tower
};

export const diff4Templates: TemplateFn[] = [
  demonCitadel,
  obsidianKeep,
  lavaFortress,
  hellfireComplex,
  demonStronghold,
  volcanicBastion,
  obsidianMonolith,
  infernoCompound,
];
