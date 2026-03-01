import type { TemplateFn } from '../types';
import { raisedPlatform, treasuryRoom } from '../shared';

// ─── "The Keep" — grand multi-tier (migrated) ──────────────────────────────
export const theKeep: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const span = 100;
  const gap = 30;
  const pillarH = 70;
  const startX = 432;

  const roomCenters: number[] = [];
  for (let i = 0; i < 4; i++) {
    const rx = startX + i * (span + gap);
    roomCenters.push(rx + span / 2);
    b(rx, groundY - pillarH / 2, 14, pillarH, 'WOOD');
    b(rx + span, groundY - pillarH / 2, 14, pillarH, 'WOOD');
    const floorY = groundY - pillarH - 6;
    b(rx + span / 2, floorY, 140, 12, 'STONE');
  }
  const lowerFloorY = groundY - pillarH - 6;

  const upperPillarH = 60;
  const upperBase = lowerFloorY - 6;
  const upperRoomCenters: number[] = [];

  for (let i = 0; i < 2; i++) {
    const lc = (roomCenters[i * 2] + roomCenters[i * 2 + 1]) / 2;
    upperRoomCenters.push(lc);
    const ulx = lc - span / 2;
    const urx = lc + span / 2;
    b(ulx, upperBase - upperPillarH / 2, 14, upperPillarH, 'WOOD');
    b(urx, upperBase - upperPillarH / 2, 14, upperPillarH, 'WOOD');
    const uFloorY = upperBase - upperPillarH - 6;
    b(lc, uFloorY, 260, 12, 'STONE');
  }
  const upperFloorY = upperBase - upperPillarH - 6;

  for (let i = 0; i < 4; i++) {
    b(roomCenters[i], lowerFloorY - 6 - 14, 28, 28, 'STONE');
  }

  const spireX = (upperRoomCenters[0] + upperRoomCenters[1]) / 2;
  const spireH = 50;
  b(spireX, upperFloorY - 6 - spireH / 2, 14, spireH, 'WOOD');
  const capY = upperFloorY - 6 - spireH - 6;
  b(spireX, capY, 100, 12, 'STONE');
  b(spireX - 25, capY - 6 - 14, 28, 28, 'STONE');
  b(spireX + 25, capY - 6 - 14, 28, 28, 'STONE');

  ctx.barrel(roomCenters[0], groundY - 18);
  ctx.barrel(roomCenters[3], groundY - 18);
  ctx.barrel(upperRoomCenters[0], lowerFloorY - 6 - 18);
  ctx.barrel(upperRoomCenters[1], upperFloorY - 6 - 18);

  // Spike trap at the gate (between first two rooms)
  ctx.hazard('SPIKE_TRAP', (roomCenters[0] + roomCenters[1]) / 2, groundY - 5);

  const eR = 20;
  ctx.enemySlots.push(
    { x: roomCenters[1], y: lowerFloorY - 6 - 28 - eR },
    { x: roomCenters[2], y: lowerFloorY - 6 - 28 - eR },
    { x: upperRoomCenters[1], y: upperFloorY - 6 - eR },
    { x: spireX, y: capY - 6 - 28 - eR },
  );

  // Coins (~22g)
  ctx.coin(430, 280, 3);                                     // approach — arc path
  ctx.coin(roomCenters[1], lowerFloorY - 40, 4);             // structure — above lower room
  ctx.coin(spireX, capY - 40, 5);                            // treasury — above spire cap
  ctx.coin(upperRoomCenters[0], lowerFloorY - 6 - 18, 5);   // risky — near upper barrel
  ctx.coin(roomCenters[3], groundY - 18, 5);                 // risky — near right barrel

  // Terrain — raised approach to keep entrance
  raisedPlatform(ctx, 520, groundY, 90, 20);
};

// ─── "The Bunker" — low wide stone fortification (migrated) ─────────────────
export const theBunker: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const BX = 620;
  const bunkerW = 260;
  const wallH = 55;

  b(BX - bunkerW / 2, groundY - wallH / 2, 24, wallH, 'STONE');
  b(BX + bunkerW / 2, groundY - wallH / 2, 24, wallH, 'STONE');

  const roofY = groundY - wallH - 6;
  b(BX - bunkerW / 4 - 15, roofY, bunkerW / 2 - 20, 14, 'STONE');
  b(BX + bunkerW / 4 + 15, roofY, bunkerW / 2 - 20, 14, 'STONE');

  b(BX - 40, groundY - 35 / 2, 10, 35, 'WOOD');
  b(BX + 40, groundY - 35 / 2, 10, 35, 'WOOD');

  ctx.barrel(BX - 80, groundY - 18);
  ctx.barrel(BX, groundY - 18);
  ctx.barrel(BX + 80, groundY - 18);

  for (const side of [-1, 1]) {
    const tx = BX + side * (bunkerW / 2 + 70);
    const tH = 65;
    b(tx - 25, groundY - tH / 2, 14, tH, 'WOOD');
    b(tx + 25, groundY - tH / 2, 14, tH, 'WOOD');
    const tFloor = groundY - tH - 6;
    b(tx, tFloor, 70, 12, 'STONE');
    b(tx, tFloor - 6 - 40 / 2, 14, 40, 'WOOD');
    b(tx, tFloor - 6 - 40 - 6, 50, 12, 'STONE');
  }

  const eR = 20;
  ctx.enemySlots.push(
    { x: BX - 80, y: groundY - eR },
    { x: BX + 80, y: groundY - eR },
    { x: BX - bunkerW / 2 - 70, y: groundY - 65 - 6 - 6 - eR },
    { x: BX + bunkerW / 2 + 70, y: groundY - 65 - 6 - 6 - eR },
  );

  // Coins (~22g)
  ctx.coin(440, 290, 3);                                       // approach — arc path
  ctx.coin(BX, roofY - 20, 5);                                // structure — above bunker roof
  ctx.coin(BX - bunkerW / 2 - 70, groundY - 65 - 6 - 40 - 20, 5); // structure — above left tower
  ctx.coin(BX, groundY - 18, 4);                              // risky — near center barrel
  ctx.coin(BX + bunkerW / 2 + 70, groundY - 65 - 6 - 40 - 20, 5); // structure — above right tower
};

// ─── "The Pendulum" — heavy stone on frame + target tower (migrated) ────────
export const thePendulum: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const PX = 540;
  const frameW = 120;
  const frameH = 100;

  b(PX - frameW / 2, groundY - frameH / 2, 16, frameH, 'STONE');
  b(PX + frameW / 2, groundY - frameH / 2, 16, frameH, 'STONE');
  const beamY = groundY - frameH - 6;
  b(PX, beamY, frameW + 30, 14, 'STONE');

  const shelfY = beamY + 35;
  b(PX - 15, shelfY, 10, 20, 'WOOD');
  b(PX + 15, shelfY, 10, 20, 'WOOD');
  b(PX, shelfY + 16, 50, 32, 'STONE');
  b(PX, shelfY + 42, 36, 24, 'STONE');

  ctx.barrel(PX, groundY - 18);
  ctx.barrel(PX - 30, groundY - 18);

  const TX = 800;
  const tSpan = 100;

  b(TX, groundY - 65 / 2, 14, 65, 'WOOD');
  b(TX + tSpan, groundY - 65 / 2, 14, 65, 'WOOD');
  const tF1 = groundY - 65 - 6;
  b(TX + tSpan / 2, tF1, tSpan + 30, 12, 'STONE');

  b(TX + 15, tF1 - 6 - 55 / 2, 14, 55, 'WOOD');
  b(TX + tSpan - 15, tF1 - 6 - 55 / 2, 14, 55, 'WOOD');
  const tF2 = tF1 - 6 - 55 - 6;
  b(TX + tSpan / 2, tF2, tSpan + 10, 12, 'STONE');

  b(TX + tSpan / 2 - 20, tF2 - 6 - 40 / 2, 14, 40, 'WOOD');
  b(TX + tSpan / 2 + 20, tF2 - 6 - 40 / 2, 14, 40, 'WOOD');
  const tF3 = tF2 - 6 - 40 - 6;
  b(TX + tSpan / 2, tF3, 80, 12, 'STONE');
  b(TX + tSpan / 2, tF3 - 18, 28, 28, 'STONE');

  const eR = 20;
  ctx.enemySlots.push(
    { x: TX + tSpan / 2, y: tF1 - 6 - eR },
    { x: TX + tSpan / 2, y: tF2 - 6 - eR },
    { x: TX + tSpan / 2, y: tF3 - 6 - 28 - eR },
    { x: PX, y: beamY - 6 - eR },
  );

  // Coins (~22g)
  ctx.coin(430, 280, 3);                          // approach — arc path
  ctx.coin(PX, beamY - 20, 5);                   // structure — above pendulum beam
  ctx.coin(TX + tSpan / 2, tF3 - 40, 5);         // structure — above tower cap
  ctx.coin(PX, groundY - 18, 4);                 // risky — near pendulum barrel
  ctx.coin(670, groundY - 18, 5);                // ground — between structures
};

// ─── "Warlord's Compound" — large fortified complex ─────────────────────────
export const warlordsCompound: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Front wall with gate gap
  const WX = 460;
  b(WX, groundY - 70 / 2, 22, 70, 'STONE');
  b(WX + 180, groundY - 70 / 2, 22, 70, 'STONE');
  // Gate opening between x=482 and x=618

  // Lintel over gate
  b(WX + 90, groundY - 70 - 6, 150, 12, 'STONE');

  // Rear fortification
  const RX = 750;
  const rSpan = 120;
  b(RX, groundY - 80 / 2, 16, 80, 'STONE');
  b(RX + rSpan, groundY - 80 / 2, 16, 80, 'STONE');
  const rf1 = groundY - 80 - 6;
  b(RX + rSpan / 2, rf1, rSpan + 30, 14, 'STONE');

  b(RX + 20, rf1 - 6 - 60 / 2, 14, 60, 'WOOD');
  b(RX + rSpan - 20, rf1 - 6 - 60 / 2, 14, 60, 'WOOD');
  const rf2 = rf1 - 6 - 60 - 6;
  b(RX + rSpan / 2, rf2, rSpan + 10, 12, 'STONE');

  // Watchtower on top
  b(RX + rSpan / 2, rf2 - 6 - 40 / 2, 14, 40, 'WOOD');
  const rf3 = rf2 - 6 - 40 - 6;
  b(RX + rSpan / 2, rf3, 60, 10, 'WOOD');
  b(RX + rSpan / 2, rf3 - 18, 28, 28, 'STONE');

  // Interior structures (between wall and rear fort)
  b(580, groundY - 45 / 2, 14, 45, 'WOOD');
  b(640, groundY - 45 / 2, 14, 45, 'WOOD');
  b(610, groundY - 45 - 6, 80, 10, 'WOOD');

  ctx.barrel(WX + 90, groundY - 18);
  ctx.barrel(610, groundY - 18);
  ctx.barrel(RX + rSpan / 2, groundY - 18);
  ctx.barrel(RX + rSpan / 2, rf1 - 6 - 18);

  // Spike traps at gate
  ctx.hazard('SPIKE_TRAP', WX + 60, groundY - 10);
  ctx.hazard('SPIKE_TRAP', WX + 120, groundY - 10);

  const eR = 20;
  ctx.enemySlots.push(
    { x: 610, y: groundY - 45 - 6 - 6 - eR },
    { x: RX + rSpan / 2, y: rf1 - 6 - eR },
    { x: RX + rSpan / 2, y: rf2 - 6 - eR },
    { x: RX + rSpan / 2, y: rf3 - 6 - 28 - eR },
    { x: WX + 90, y: groundY - 70 - 6 - 6 - eR },
  );

  // Coins (~24g)
  ctx.coin(430, 280, 3);                          // approach — arc path
  ctx.coin(WX + 90, groundY - 70 - 20, 4);       // structure — above gate lintel
  ctx.coin(RX + rSpan / 2, rf3 - 30, 5);         // treasury — above watchtower top
  ctx.coin(610, groundY - 18, 5);                // risky — near interior barrel + spikes
  ctx.coin(RX + rSpan / 2, rf1 - 6 - 18, 4);    // risky — near rear barrel
  ctx.coin(RX + rSpan / 2, groundY - 18, 3);     // risky — near rear ground barrel
};

// ─── "Siege Tower" — very tall single tower with ramp ──────────────────────
export const siegeTower: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const TX = 650;
  const span = 110;

  // Level 1 — stone base
  b(TX, groundY - 60 / 2, 18, 60, 'STONE');
  b(TX + span, groundY - 60 / 2, 18, 60, 'STONE');
  const f1 = groundY - 60 - 6;
  b(TX + span / 2, f1, span + 30, 14, 'STONE');

  // Level 2
  b(TX + 10, f1 - 6 - 60 / 2, 14, 60, 'WOOD');
  b(TX + span - 10, f1 - 6 - 60 / 2, 14, 60, 'WOOD');
  const f2 = f1 - 6 - 60 - 6;
  b(TX + span / 2, f2, span + 20, 12, 'STONE');

  // Level 3
  b(TX + 15, f2 - 6 - 55 / 2, 14, 55, 'WOOD');
  b(TX + span - 15, f2 - 6 - 55 / 2, 14, 55, 'WOOD');
  const f3 = f2 - 6 - 55 - 6;
  b(TX + span / 2, f3, span + 10, 12, 'STONE');

  // Level 4 — narrow top
  b(TX + span / 2 - 20, f3 - 6 - 45 / 2, 14, 45, 'WOOD');
  b(TX + span / 2 + 20, f3 - 6 - 45 / 2, 14, 45, 'WOOD');
  const f4 = f3 - 6 - 45 - 6;
  b(TX + span / 2, f4, 80, 12, 'STONE');
  b(TX + span / 2, f4 - 18, 28, 28, 'STONE');

  // Ramp structure leading to first level
  const RampX = 470;
  b(RampX, groundY - 30 / 2, 14, 30, 'WOOD');
  b(RampX + 60, groundY - 45 / 2, 14, 45, 'WOOD');
  b(RampX + 30, groundY - 30 - 6, 80, 10, 'WOOD');

  ctx.barrel(TX + span / 2, groundY - 18);
  ctx.barrel(TX + span / 2, f1 - 6 - 18);
  ctx.barrel(TX + span / 2, f2 - 6 - 18);

  // Spike traps at base approaches
  ctx.hazard('SPIKE_TRAP', RampX + 60, groundY - 5);
  ctx.hazard('SPIKE_TRAP', TX + span + 30, groundY - 5);

  const eR = 20;
  ctx.enemySlots.push(
    { x: TX + span / 2, y: f1 - 6 - eR },
    { x: TX + span / 2, y: f2 - 6 - eR },
    { x: TX + span / 2, y: f3 - 6 - eR },
    { x: TX + span / 2, y: f4 - 6 - 28 - eR },
    { x: RampX + 30, y: groundY - 30 - 6 - 6 - eR },
  );

  // Coins (~24g)
  ctx.coin(430, 280, 3);                          // approach — arc path
  ctx.coin(TX + span / 2, f4 - 40, 5);           // treasury — above tower top cap
  ctx.coin(TX + span / 2, f2 - 10, 5);           // structure — between tower levels
  ctx.coin(TX + span / 2, groundY - 18, 5);      // risky — near ground barrel
  ctx.coin(RampX + 30, groundY - 30 - 18, 3);    // structure — above ramp
  ctx.coin(TX + span / 2, f1 - 6 - 18, 3);       // risky — near level 1 barrel
};

// ─── "Barrel Fortress" — walls lined with explosive barrels ────────────────
export const barrelFortress: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const CX = 660;
  const wallW = 240;

  // Outer walls
  b(CX - wallW / 2, groundY - 65 / 2, 20, 65, 'STONE');
  b(CX + wallW / 2, groundY - 65 / 2, 20, 65, 'STONE');
  b(CX, groundY - 65 / 2, 14, 65, 'WOOD'); // center divider

  // Roof
  const roofY = groundY - 65 - 6;
  b(CX, roofY, wallW + 20, 14, 'STONE');

  // Upper battlements
  b(CX - wallW / 4, roofY - 6 - 35 / 2, 14, 35, 'WOOD');
  b(CX + wallW / 4, roofY - 6 - 35 / 2, 14, 35, 'WOOD');
  const upperRoof = roofY - 6 - 35 - 6;
  b(CX, upperRoof, wallW * 0.7, 12, 'STONE');

  // Barrels EVERYWHERE inside
  ctx.barrel(CX - wallW / 4 - 20, groundY - 18);
  ctx.barrel(CX - wallW / 4 + 20, groundY - 18);
  ctx.barrel(CX + wallW / 4 - 20, groundY - 18);
  ctx.barrel(CX + wallW / 4 + 20, groundY - 18);
  ctx.barrel(CX, roofY - 6 - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: CX - wallW / 4, y: groundY - eR },
    { x: CX + wallW / 4, y: groundY - eR },
    { x: CX - wallW / 4, y: roofY - 6 - eR },
    { x: CX + wallW / 4, y: roofY - 6 - eR },
    { x: CX, y: upperRoof - 6 - eR },
  );

  // Coins (~22g)
  ctx.coin(440, 280, 3);                          // approach — arc path
  ctx.coin(CX, upperRoof - 20, 5);               // structure — above upper battlements
  ctx.coin(CX - wallW / 4, roofY - 20, 4);       // structure — above roof
  ctx.coin(CX - wallW / 4 - 20, groundY - 18, 5); // risky — among barrels
  ctx.coin(CX + wallW / 4 + 20, groundY - 18, 5); // risky — among barrels

  // Terrain — hidden stone chamber
  treasuryRoom(ctx, 950, groundY, 80, 50, 'STONE', 5);
};

export const diff4Templates: TemplateFn[] = [
  theKeep,
  theBunker,
  thePendulum,
  warlordsCompound,
  siegeTower,
  barrelFortress,
];
