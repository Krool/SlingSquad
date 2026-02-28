import type { TemplateFn } from '../types';

// ─── "Fortress Wall" — colonnade with flanking towers (migrated) ────────────
export const fortressWall: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const WX = 580;
  const colSpacing = 80;
  const pillarH = 80;

  for (let i = 0; i < 5; i++) {
    b(WX + i * colSpacing, groundY - pillarH / 2, 14, pillarH, 'WOOD');
  }
  const colRight = WX + 4 * colSpacing;
  const plankW = colRight - WX + 40;
  const plankCX = WX + 2 * colSpacing;
  const row1Y = groundY - pillarH - 6;
  b(plankCX, row1Y, plankW, 12, 'STONE');

  const tier2H = 50;
  for (let i = 0; i < 5; i++) {
    b(WX + i * colSpacing, row1Y - 6 - tier2H / 2, 14, tier2H, 'WOOD');
  }
  const row2Y = row1Y - 6 - tier2H - 6;
  b(plankCX, row2Y, plankW, 12, 'STONE');

  const tier3H = 30;
  for (let i = 0; i < 5; i += 2) {
    b(WX + i * colSpacing, row2Y - 6 - tier3H / 2, 14, tier3H, 'WOOD');
  }
  const capY = row2Y - 6 - tier3H - 6;
  b(plankCX, capY, plankW * 0.6, 12, 'STONE');

  const towerSpan = 60;
  const towerPillarH = 70;
  for (const tx of [WX - 115, colRight + 120]) {
    b(tx - towerSpan / 2, groundY - towerPillarH / 2, 14, towerPillarH, 'WOOD');
    b(tx + towerSpan / 2, groundY - towerPillarH / 2, 14, towerPillarH, 'WOOD');
    const tFloor1 = groundY - towerPillarH - 6;
    b(tx, tFloor1, 100, 12, 'STONE');
    b(tx - towerSpan / 2, tFloor1 - 6 - 50 / 2, 14, 50, 'WOOD');
    b(tx + towerSpan / 2, tFloor1 - 6 - 50 / 2, 14, 50, 'WOOD');
    const tFloor2 = tFloor1 - 6 - 50 - 6;
    b(tx, tFloor2, 100, 12, 'STONE');
    b(tx, tFloor2 - 20, 28, 28, 'STONE');
  }

  ctx.barrel(WX + 2.5 * colSpacing, groundY - 18);
  ctx.barrel(WX + 1.5 * colSpacing, row1Y - 6 - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: WX - 115, y: groundY - towerPillarH - 6 - 6 - eR },
    { x: WX + 1.5 * colSpacing, y: row1Y - 6 - eR },
    { x: WX + 2.5 * colSpacing, y: row1Y - 6 - eR },
    { x: colRight + 120, y: groundY - towerPillarH - 6 - 6 - eR },
  );
};

// ─── "The Cage" — 3-tier skeletal frame (migrated) ──────────────────────────
export const theCage: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const cx = 680;
  const cageW = 160;
  const frontL = cx - cageW / 2;
  const frontR = cx + cageW / 2;

  const lv1H = 50;
  b(frontL, groundY - lv1H / 2, 14, lv1H, 'WOOD');
  b(frontR, groundY - lv1H / 2, 14, lv1H, 'WOOD');
  b(cx, groundY - lv1H / 2, 14, lv1H, 'WOOD');
  const midY = groundY - lv1H - 6;
  b(cx, midY, cageW + 30, 12, 'WOOD');

  const lv2H = 60;
  b(frontL, midY - 6 - lv2H / 2, 14, lv2H, 'WOOD');
  b(frontR, midY - 6 - lv2H / 2, 14, lv2H, 'WOOD');
  const upperY = midY - 6 - lv2H - 6;
  b(cx, upperY, cageW + 30, 12, 'STONE');

  const lv3H = 40;
  b(frontL, upperY - 6 - lv3H / 2, 14, lv3H, 'WOOD');
  b(frontR, upperY - 6 - lv3H / 2, 14, lv3H, 'WOOD');
  const capY = upperY - 6 - lv3H - 6;
  b(cx, capY, cageW + 50, 12, 'STONE');
  b(cx - 40, capY - 18, 50, 24, 'STONE');
  b(cx + 40, capY - 18, 50, 24, 'STONE');

  ctx.barrel(frontL + 40, groundY - 18);
  ctx.barrel(frontR - 40, upperY - 6 - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: cx, y: midY - 6 - eR },
    { x: cx, y: upperY - 6 - eR },
    { x: frontL + 50, y: groundY - eR },
    { x: frontR - 50, y: groundY - eR },
  );
};

// ─── "The Catapult" — fulcrum + plank + target tower (migrated) ─────────────
export const theCatapult: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const FX = 560;
  const fulcrumH = 40;
  b(FX, groundY - fulcrumH / 2, 30, fulcrumH, 'STONE');

  const plankW = 220;
  b(FX, groundY - fulcrumH - 6, plankW, 12, 'WOOD');
  const plankY = groundY - fulcrumH - 6;

  b(FX - plankW / 2 + 20, plankY - 6 - 18, 40, 36, 'STONE');
  b(FX - plankW / 2 + 55, plankY - 6 - 18, 40, 36, 'STONE');

  ctx.barrel(FX + plankW / 2 - 25, plankY - 6 - 18);
  ctx.barrel(FX + plankW / 2 - 25, groundY - 18);

  const TX = 840;
  const tSpan = 100;
  const tPillarH = 65;

  b(TX, groundY - tPillarH / 2, 14, tPillarH, 'WOOD');
  b(TX + tSpan, groundY - tPillarH / 2, 14, tPillarH, 'WOOD');
  const tFloor1 = groundY - tPillarH - 6;
  b(TX + tSpan / 2, tFloor1, tSpan + 30, 12, 'STONE');

  const tPH2 = 50;
  b(TX + 15, tFloor1 - 6 - tPH2 / 2, 14, tPH2, 'WOOD');
  b(TX + tSpan - 15, tFloor1 - 6 - tPH2 / 2, 14, tPH2, 'WOOD');
  const tFloor2 = tFloor1 - 6 - tPH2 - 6;
  b(TX + tSpan / 2, tFloor2, tSpan + 10, 12, 'STONE');
  b(TX + tSpan / 2, tFloor2 - 20, 28, 28, 'STONE');

  const eR = 20;
  ctx.enemySlots.push(
    { x: FX + 30, y: groundY - eR },
    { x: TX + tSpan / 2, y: tFloor1 - 6 - eR },
    { x: TX + tSpan / 2, y: tFloor2 - 6 - 28 - eR },
    { x: TX + tSpan / 2, y: groundY - eR },
  );
};

// ─── "The Shelf" — 4-level shelving + barrel under each shelf (migrated) ────
export const theShelf: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const CX = 680;
  const shelfW = 160;
  const pillarH = 40;
  let baseY = groundY;
  const floors: number[] = [];

  for (let level = 0; level < 4; level++) {
    const mat: 'WOOD' | 'STONE' = level < 2 ? 'WOOD' : 'STONE';
    const pH = pillarH - level * 4;

    b(CX - shelfW / 2, baseY - pH / 2, 14, pH, mat);
    b(CX + shelfW / 2, baseY - pH / 2, 14, pH, mat);
    if (level < 2) b(CX, baseY - pH / 2, 14, pH, 'WOOD');

    const floorY = baseY - pH - 6;
    const floorMat: 'WOOD' | 'STONE' = level < 2 ? 'WOOD' : 'STONE';
    b(CX, floorY, shelfW + 20, 12, floorMat);
    floors.push(floorY);

    if (level > 0) {
      ctx.barrel(CX + (level % 2 === 0 ? -30 : 30), baseY - 18);
    }
    baseY = floorY - 6;
  }

  ctx.barrel(CX, groundY - 18);
  b(CX - 30, floors[3] - 6 - 16, 40, 32, 'STONE');
  b(CX + 30, floors[3] - 6 - 16, 40, 32, 'STONE');

  const eR = 20;
  ctx.enemySlots.push(
    { x: CX, y: floors[0] - 6 - eR },
    { x: CX, y: floors[1] - 6 - eR },
    { x: CX, y: floors[2] - 6 - eR },
    { x: CX, y: floors[3] - 6 - 32 - eR },
  );
};

// ─── "Goblin Arena" — circular pit with surrounding platforms ───────────────
export const goblinArena: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Central pit walls
  const CX = 680;
  const pitW = 180;
  b(CX - pitW / 2, groundY - 40 / 2, 20, 40, 'STONE');
  b(CX + pitW / 2, groundY - 40 / 2, 20, 40, 'STONE');

  // Raised platforms on sides
  const LX = CX - pitW / 2 - 80;
  b(LX, groundY - 70 / 2, 14, 70, 'WOOD');
  b(LX + 60, groundY - 70 / 2, 14, 70, 'WOOD');
  const lf = groundY - 70 - 6;
  b(LX + 30, lf, 80, 12, 'STONE');

  const RX = CX + pitW / 2 + 20;
  b(RX, groundY - 70 / 2, 14, 70, 'WOOD');
  b(RX + 60, groundY - 70 / 2, 14, 70, 'WOOD');
  const rf = groundY - 70 - 6;
  b(RX + 30, rf, 80, 12, 'STONE');

  // Overhead plank connecting platforms
  b(LX + 30, lf - 6 - 40 / 2, 14, 40, 'WOOD');
  b(RX + 30, rf - 6 - 40 / 2, 14, 40, 'WOOD');
  const overY = lf - 6 - 40 - 6;
  b(CX, overY, pitW + 100, 12, 'WOOD');

  ctx.barrel(CX - 40, groundY - 18);
  ctx.barrel(CX + 40, groundY - 18);
  ctx.barrel(CX, overY - 6 - 18);

  // Spike traps in pit
  ctx.hazard('SPIKE_TRAP', CX - 30, groundY - 10);
  ctx.hazard('SPIKE_TRAP', CX + 30, groundY - 10);

  const eR = 20;
  ctx.enemySlots.push(
    { x: CX, y: groundY - eR },
    { x: LX + 30, y: lf - 6 - eR },
    { x: RX + 30, y: rf - 6 - eR },
    { x: CX, y: overY - 6 - eR },
  );
};

// ─── "Raider Outpost" — L-shaped compound ──────────────────────────────────
export const raiderOutpost: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Horizontal wing
  const HX = 480;
  const wingW = 200;
  for (let i = 0; i < 4; i++) {
    b(HX + i * 66, groundY - 60 / 2, 14, 60, 'WOOD');
  }
  const hFloor = groundY - 60 - 6;
  b(HX + wingW / 2, hFloor, wingW + 30, 12, 'STONE');

  // Vertical wing (tower going up from right end)
  const VX = HX + wingW;
  const vSpan = 80;
  b(VX, hFloor - 6 - 55 / 2, 14, 55, 'WOOD');
  b(VX + vSpan, hFloor - 6 - 55 / 2, 14, 55, 'WOOD');
  const vf1 = hFloor - 6 - 55 - 6;
  b(VX + vSpan / 2, vf1, vSpan + 20, 12, 'STONE');

  b(VX + 15, vf1 - 6 - 40 / 2, 14, 40, 'WOOD');
  b(VX + vSpan - 15, vf1 - 6 - 40 / 2, 14, 40, 'WOOD');
  const vf2 = vf1 - 6 - 40 - 6;
  b(VX + vSpan / 2, vf2, vSpan + 10, 12, 'STONE');
  b(VX + vSpan / 2, vf2 - 18, 28, 28, 'STONE');

  ctx.barrel(HX + 100, groundY - 18);
  ctx.barrel(VX + vSpan / 2, hFloor - 6 - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: HX + 66, y: hFloor - 6 - eR },
    { x: HX + 132, y: hFloor - 6 - eR },
    { x: VX + vSpan / 2, y: vf1 - 6 - eR },
    { x: VX + vSpan / 2, y: vf2 - 6 - 28 - eR },
  );
};

// ─── "Barrel Gallery" — multi-level barrel chain connected by thin supports ─
export const barrelGallery: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // 3 levels of shelves, each with barrel groups
  const CX = 660;
  const shelfW = 200;
  const levels = [
    { h: 55, barrels: 3 },
    { h: 50, barrels: 2 },
    { h: 45, barrels: 1 },
  ];

  let currentBase = groundY;
  const floors: number[] = [];

  for (let i = 0; i < levels.length; i++) {
    const { h, barrels: bCount } = levels[i];
    const w = shelfW - i * 30;

    b(CX - w / 2, currentBase - h / 2, 12, h, 'WOOD');
    b(CX + w / 2, currentBase - h / 2, 12, h, 'WOOD');
    if (i === 0) b(CX, currentBase - h / 2, 12, h, 'WOOD'); // center support on ground floor

    const floorY = currentBase - h - 6;
    b(CX, floorY, w + 20, 12, i < 2 ? 'WOOD' : 'STONE');
    floors.push(floorY);

    // Place barrels on this level
    for (let j = 0; j < bCount; j++) {
      const bx = CX + (j - (bCount - 1) / 2) * 40;
      ctx.barrel(bx, currentBase - 18);
    }

    currentBase = floorY - 6;
  }

  // Stone cap
  b(CX, floors[2] - 6 - 14, 28, 28, 'STONE');

  // Side watchtower
  const SX = 870;
  b(SX, groundY - 50 / 2, 14, 50, 'WOOD');
  b(SX + 55, groundY - 50 / 2, 14, 50, 'WOOD');
  b(SX + 27, groundY - 50 - 6, 75, 12, 'STONE');

  const eR = 20;
  ctx.enemySlots.push(
    { x: CX, y: floors[0] - 6 - eR },
    { x: CX, y: floors[1] - 6 - eR },
    { x: CX, y: floors[2] - 6 - 28 - eR },
    { x: SX + 27, y: groundY - 50 - 6 - 6 - eR },
  );
};

// ─── "Twin Forts" — two fortified structures with bridge ────────────────────
export const twinForts: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Left fort — stone base, wood upper
  const LX = 490;
  const fortW = 100;
  b(LX, groundY - 40 / 2, 20, 40, 'STONE');
  b(LX + fortW, groundY - 40 / 2, 20, 40, 'STONE');
  const lBase = groundY - 40 - 6;
  b(LX + fortW / 2, lBase, fortW + 20, 12, 'STONE');

  b(LX + 15, lBase - 6 - 50 / 2, 14, 50, 'WOOD');
  b(LX + fortW - 15, lBase - 6 - 50 / 2, 14, 50, 'WOOD');
  const lf2 = lBase - 6 - 50 - 6;
  b(LX + fortW / 2, lf2, fortW + 10, 12, 'STONE');
  b(LX + fortW / 2, lf2 - 18, 28, 28, 'STONE');

  // Right fort — mirror, taller
  const RX = 740;
  b(RX, groundY - 50 / 2, 20, 50, 'STONE');
  b(RX + fortW, groundY - 50 / 2, 20, 50, 'STONE');
  const rBase = groundY - 50 - 6;
  b(RX + fortW / 2, rBase, fortW + 20, 12, 'STONE');

  b(RX + 15, rBase - 6 - 55 / 2, 14, 55, 'WOOD');
  b(RX + fortW - 15, rBase - 6 - 55 / 2, 14, 55, 'WOOD');
  const rf2 = rBase - 6 - 55 - 6;
  b(RX + fortW / 2, rf2, fortW + 10, 12, 'STONE');
  b(RX + fortW / 2, rf2 - 18, 28, 28, 'STONE');

  // Connecting bridge
  const bridgeCX = (LX + fortW + RX) / 2;
  b(bridgeCX, groundY - 50 / 2, 14, 50, 'WOOD');
  b(bridgeCX, groundY - 50 - 6, 80, 10, 'WOOD');

  ctx.barrel(LX + fortW / 2, groundY - 18);
  ctx.barrel(RX + fortW / 2, groundY - 18);
  ctx.barrel(bridgeCX, groundY - 18);

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
  fortressWall,
  theCage,
  theCatapult,
  theShelf,
  goblinArena,
  raiderOutpost,
  barrelGallery,
  twinForts,
];
