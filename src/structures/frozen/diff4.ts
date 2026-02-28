import type { TemplateFn } from '../types';

// ─── "Ice Monolith" — grand multi-tier ice keep ────────────────────────────
export const iceMonolith: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const span = 100;
  const gap = 30;
  const pillarH = 70;
  const startX = 450;

  // 3 ground-level rooms
  const roomCenters: number[] = [];
  for (let i = 0; i < 3; i++) {
    const rx = startX + i * (span + gap);
    roomCenters.push(rx + span / 2);
    b(rx, groundY - pillarH / 2, 14, pillarH, 'ICE');
    b(rx + span, groundY - pillarH / 2, 14, pillarH, 'ICE');
    const floorY = groundY - pillarH - 6;
    b(rx + span / 2, floorY, 130, 12, 'STONE');
  }
  const lowerFloorY = groundY - pillarH - 6;

  // Stone caps on ground rooms
  for (let i = 0; i < 3; i++) {
    b(roomCenters[i], lowerFloorY - 6 - 14, 28, 28, 'STONE');
  }

  // Upper tier — spans across 2 rooms
  const upperBase = lowerFloorY - 6 - 28;
  const upperCX = (roomCenters[0] + roomCenters[2]) / 2;
  b(roomCenters[0], upperBase - 55 / 2, 14, 55, 'ICE');
  b(roomCenters[2], upperBase - 55 / 2, 14, 55, 'ICE');
  const uf = upperBase - 55 - 6;
  b(upperCX, uf, 260, 12, 'STONE');

  // Spire
  b(upperCX, uf - 6 - 45 / 2, 14, 45, 'ICE');
  const spireTop = uf - 6 - 45 - 6;
  b(upperCX, spireTop, 80, 12, 'ICE');
  b(upperCX, spireTop - 6 - 14, 28, 28, 'STONE');

  ctx.barrel(roomCenters[0], groundY - 18);
  ctx.barrel(roomCenters[2], groundY - 18);
  ctx.barrel(upperCX, lowerFloorY - 6 - 18);
  ctx.barrel(upperCX, uf - 6 - 18);

  ctx.hazard('ICE_PATCH', roomCenters[1], groundY - 10);
  ctx.hazard('ICE_PATCH', roomCenters[0] - 20, groundY - 10);

  const eR = 20;
  ctx.enemySlots.push(
    { x: roomCenters[0], y: lowerFloorY - 6 - 28 - eR },
    { x: roomCenters[1], y: lowerFloorY - 6 - 28 - eR },
    { x: roomCenters[2], y: lowerFloorY - 6 - 28 - eR },
    { x: upperCX, y: uf - 6 - eR },
    { x: upperCX, y: spireTop - 6 - 28 - eR },
  );
};

// ─── "Frozen Stronghold" — thick-walled ice bunker with flanking towers ────
export const frozenStronghold: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const BX = 620;
  const bunkerW = 240;
  const wallH = 60;

  // Thick ice walls
  b(BX - bunkerW / 2, groundY - wallH / 2, 24, wallH, 'ICE');
  b(BX + bunkerW / 2, groundY - wallH / 2, 24, wallH, 'ICE');

  // Split roof (ice)
  const roofY = groundY - wallH - 6;
  b(BX - bunkerW / 4, roofY, bunkerW / 2 - 20, 14, 'ICE');
  b(BX + bunkerW / 4, roofY, bunkerW / 2 - 20, 14, 'ICE');

  // Interior wood supports
  b(BX - 40, groundY - 40 / 2, 10, 40, 'WOOD');
  b(BX + 40, groundY - 40 / 2, 10, 40, 'WOOD');

  // Flanking ice towers
  for (const side of [-1, 1]) {
    const tx = BX + side * (bunkerW / 2 + 70);
    const tH = 70;
    b(tx - 25, groundY - tH / 2, 14, tH, 'ICE');
    b(tx + 25, groundY - tH / 2, 14, tH, 'ICE');
    const tFloor = groundY - tH - 6;
    b(tx, tFloor, 70, 12, 'STONE');
    b(tx, tFloor - 6 - 40 / 2, 12, 40, 'ICE');
    b(tx, tFloor - 6 - 40 - 6, 50, 12, 'STONE');
  }

  ctx.barrel(BX - 80, groundY - 18);
  ctx.barrel(BX, groundY - 18);
  ctx.barrel(BX + 80, groundY - 18);

  ctx.hazard('ICE_PATCH', BX - 40, groundY - 10);
  ctx.hazard('ICE_PATCH', BX + 40, groundY - 10);

  const eR = 20;
  ctx.enemySlots.push(
    { x: BX - 80, y: groundY - eR },
    { x: BX + 80, y: groundY - eR },
    { x: BX - bunkerW / 2 - 70, y: groundY - 70 - 6 - 6 - eR },
    { x: BX + bunkerW / 2 + 70, y: groundY - 70 - 6 - 6 - eR },
    { x: BX, y: roofY - 6 - eR },
  );
};

// ─── "Glacier Fortress" — wide compound with ice bridges ───────────────────
export const glacierFortress: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Left fort — stone base, ice upper
  const LX = 460;
  const fortW = 100;
  b(LX, groundY - 45 / 2, 18, 45, 'STONE');
  b(LX + fortW, groundY - 45 / 2, 18, 45, 'STONE');
  const lBase = groundY - 45 - 6;
  b(LX + fortW / 2, lBase, fortW + 20, 12, 'STONE');

  b(LX + 15, lBase - 6 - 55 / 2, 14, 55, 'ICE');
  b(LX + fortW - 15, lBase - 6 - 55 / 2, 14, 55, 'ICE');
  const lf2 = lBase - 6 - 55 - 6;
  b(LX + fortW / 2, lf2, fortW + 10, 12, 'ICE');
  b(LX + fortW / 2, lf2 - 6 - 14, 28, 28, 'STONE');

  // Right fort — taller
  const RX = 720;
  b(RX, groundY - 55 / 2, 18, 55, 'STONE');
  b(RX + fortW, groundY - 55 / 2, 18, 55, 'STONE');
  const rBase = groundY - 55 - 6;
  b(RX + fortW / 2, rBase, fortW + 20, 12, 'STONE');

  b(RX + 15, rBase - 6 - 60 / 2, 14, 60, 'ICE');
  b(RX + fortW - 15, rBase - 6 - 60 / 2, 14, 60, 'ICE');
  const rf2 = rBase - 6 - 60 - 6;
  b(RX + fortW / 2, rf2, fortW + 10, 12, 'ICE');
  b(RX + fortW / 2, rf2 - 6 - 14, 28, 28, 'STONE');

  // Ice bridge connecting forts
  const bridgeCX = (LX + fortW + RX) / 2;
  b(bridgeCX, groundY - 55 / 2, 14, 55, 'ICE');
  b(bridgeCX, groundY - 55 - 6, 90, 10, 'ICE');

  ctx.barrel(LX + fortW / 2, groundY - 18);
  ctx.barrel(RX + fortW / 2, groundY - 18);
  ctx.barrel(bridgeCX, groundY - 18);

  ctx.hazard('ICE_PATCH', LX + fortW / 2, groundY - 10);
  ctx.hazard('ICE_PATCH', bridgeCX, groundY - 10);
  ctx.hazard('ICE_PATCH', RX + fortW / 2, groundY - 10);

  const eR = 20;
  ctx.enemySlots.push(
    { x: LX + fortW / 2, y: lBase - 6 - eR },
    { x: LX + fortW / 2, y: lf2 - 6 - 28 - eR },
    { x: RX + fortW / 2, y: rBase - 6 - eR },
    { x: RX + fortW / 2, y: rf2 - 6 - 28 - eR },
    { x: bridgeCX, y: groundY - 55 - 6 - 6 - eR },
  );
};

// ─── "Crystal Keep" — tall single tower, ice + stone layers ────────────────
export const crystalKeep: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const TX = 620;
  const span = 120;

  // Level 1 — stone base
  b(TX, groundY - 65 / 2, 18, 65, 'STONE');
  b(TX + span, groundY - 65 / 2, 18, 65, 'STONE');
  const f1 = groundY - 65 - 6;
  b(TX + span / 2, f1, span + 30, 14, 'STONE');

  // Level 2 — ice
  b(TX + 10, f1 - 6 - 60 / 2, 14, 60, 'ICE');
  b(TX + span - 10, f1 - 6 - 60 / 2, 14, 60, 'ICE');
  const f2 = f1 - 6 - 60 - 6;
  b(TX + span / 2, f2, span + 20, 12, 'ICE');

  // Level 3 — ice
  b(TX + 20, f2 - 6 - 55 / 2, 14, 55, 'ICE');
  b(TX + span - 20, f2 - 6 - 55 / 2, 14, 55, 'ICE');
  const f3 = f2 - 6 - 55 - 6;
  b(TX + span / 2, f3, span + 10, 12, 'STONE');

  // Level 4 — narrow ice top
  b(TX + span / 2 - 20, f3 - 6 - 45 / 2, 12, 45, 'ICE');
  b(TX + span / 2 + 20, f3 - 6 - 45 / 2, 12, 45, 'ICE');
  const f4 = f3 - 6 - 45 - 6;
  b(TX + span / 2, f4, 80, 12, 'ICE');
  b(TX + span / 2, f4 - 6 - 14, 28, 28, 'STONE');

  // Ramp structure
  const RampX = 460;
  b(RampX, groundY - 35 / 2, 14, 35, 'WOOD');
  b(RampX + 60, groundY - 50 / 2, 14, 50, 'WOOD');
  b(RampX + 30, groundY - 35 - 6, 80, 10, 'ICE');

  ctx.barrel(TX + span / 2, groundY - 18);
  ctx.barrel(TX + span / 2, f1 - 6 - 18);
  ctx.barrel(TX + span / 2, f2 - 6 - 18);

  ctx.hazard('ICE_PATCH', TX + span / 2 - 30, groundY - 10);
  ctx.hazard('ICE_PATCH', TX + span / 2 + 30, groundY - 10);

  const eR = 20;
  ctx.enemySlots.push(
    { x: TX + span / 2, y: f1 - 6 - eR },
    { x: TX + span / 2, y: f2 - 6 - eR },
    { x: TX + span / 2, y: f3 - 6 - eR },
    { x: TX + span / 2, y: f4 - 6 - 28 - eR },
    { x: RampX + 30, y: groundY - 35 - 6 - 6 - eR },
  );
};

// ─── "Frostbite Complex" — multi-wing compound, ice walls everywhere ───────
export const frostbiteComplex: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Front gate — ice pillars
  const GX = 450;
  b(GX, groundY - 75 / 2, 20, 75, 'ICE');
  b(GX + 60, groundY - 75 / 2, 20, 75, 'ICE');
  b(GX + 30, groundY - 75 - 6, 80, 14, 'ICE');

  // Main hall
  const HX = 560;
  const hallW = 180;
  b(HX, groundY - 70 / 2, 16, 70, 'ICE');
  b(HX + hallW, groundY - 70 / 2, 16, 70, 'ICE');
  b(HX + hallW / 2, groundY - 70 / 2, 14, 70, 'WOOD');
  const hf1 = groundY - 70 - 6;
  b(HX + hallW / 2, hf1, hallW + 30, 14, 'STONE');

  // Upper levels
  b(HX + 20, hf1 - 6 - 55 / 2, 14, 55, 'ICE');
  b(HX + hallW - 20, hf1 - 6 - 55 / 2, 14, 55, 'ICE');
  const hf2 = hf1 - 6 - 55 - 6;
  b(HX + hallW / 2, hf2, hallW + 10, 12, 'ICE');

  // Throne platform
  const throneX = HX + hallW / 2;
  b(throneX - 30, hf2 - 6 - 40 / 2, 14, 40, 'ICE');
  b(throneX + 30, hf2 - 6 - 40 / 2, 14, 40, 'ICE');
  const tf = hf2 - 6 - 40 - 6;
  b(throneX, tf, 80, 12, 'STONE');
  b(throneX, tf - 6 - 14, 28, 28, 'STONE');

  // Rear watchtower
  const RX = 860;
  b(RX, groundY - 60 / 2, 14, 60, 'ICE');
  b(RX + 60, groundY - 60 / 2, 14, 60, 'ICE');
  const rf1 = groundY - 60 - 6;
  b(RX + 30, rf1, 80, 12, 'WOOD');

  ctx.barrel(HX + hallW / 3, groundY - 18);
  ctx.barrel(HX + hallW * 2 / 3, groundY - 18);
  ctx.barrel(throneX, hf1 - 6 - 18);
  ctx.barrel(GX + 30, groundY - 18);

  ctx.hazard('ICE_PATCH', GX + 30, groundY - 10);
  ctx.hazard('ICE_PATCH', HX + hallW / 2, groundY - 10);
  ctx.hazard('ICE_PATCH', RX + 30, groundY - 10);

  const eR = 20;
  ctx.enemySlots.push(
    { x: GX + 30, y: groundY - 75 - 6 - 6 - eR },
    { x: HX + hallW / 3, y: hf1 - 6 - eR },
    { x: HX + hallW * 2 / 3, y: hf1 - 6 - eR },
    { x: throneX, y: hf2 - 6 - eR },
    { x: throneX, y: tf - 6 - 28 - eR },
    { x: RX + 30, y: rf1 - 6 - eR },
  );
};

// ─── "Avalanche Keep" — walls lined with stone-on-ice traps ────────────────
export const avalancheKeep: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const CX = 660;
  const wallW = 260;

  // Outer ice walls
  b(CX - wallW / 2, groundY - 70 / 2, 22, 70, 'ICE');
  b(CX + wallW / 2, groundY - 70 / 2, 22, 70, 'ICE');
  b(CX, groundY - 65 / 2, 14, 65, 'WOOD'); // center divider

  // Stone roof
  const roofY = groundY - 70 - 6;
  b(CX, roofY, wallW + 20, 14, 'STONE');

  // Upper battlements on ice pillars (avalanche risk)
  b(CX - wallW / 4, roofY - 6 - 40 / 2, 10, 40, 'ICE');
  b(CX + wallW / 4, roofY - 6 - 40 / 2, 10, 40, 'ICE');
  const upperRoof = roofY - 6 - 40 - 6;
  b(CX, upperRoof, wallW * 0.7, 12, 'STONE');

  // Heavy stone blocks on upper roof (avalanche payload)
  b(CX - 40, upperRoof - 6 - 16, 40, 32, 'STONE');
  b(CX + 40, upperRoof - 6 - 16, 40, 32, 'STONE');

  // Barrels inside
  ctx.barrel(CX - wallW / 4 - 20, groundY - 18);
  ctx.barrel(CX - wallW / 4 + 20, groundY - 18);
  ctx.barrel(CX + wallW / 4 - 20, groundY - 18);
  ctx.barrel(CX + wallW / 4 + 20, groundY - 18);

  ctx.hazard('ICE_PATCH', CX - wallW / 4, groundY - 10);
  ctx.hazard('ICE_PATCH', CX + wallW / 4, groundY - 10);

  const eR = 20;
  ctx.enemySlots.push(
    { x: CX - wallW / 4, y: groundY - eR },
    { x: CX + wallW / 4, y: groundY - eR },
    { x: CX - wallW / 4, y: roofY - 6 - eR },
    { x: CX + wallW / 4, y: roofY - 6 - eR },
    { x: CX, y: upperRoof - 6 - 32 - eR },
  );
};

export const diff4Templates: TemplateFn[] = [
  iceMonolith,
  frozenStronghold,
  glacierFortress,
  crystalKeep,
  frostbiteComplex,
  avalancheKeep,
];
