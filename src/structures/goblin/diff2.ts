import type { TemplateFn } from '../types';
import { raisedPlatform } from '../shared';

// ─── "The Bridge" — long elevated walkway on thin stilts ────────────────────
export const theBridge: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const startX = 480;
  const pillarSpacing = 110;
  const pillarH = 80;
  const deckW = 460;

  const pillarXs = [startX, startX + pillarSpacing, startX + 2 * pillarSpacing, startX + 3 * pillarSpacing];

  for (let i = 0; i < pillarXs.length; i++) {
    const px = pillarXs[i];
    if (i === 1) {
      b(px, groundY - pillarH / 2, 14, pillarH, 'WOOD');
    } else {
      b(px - 20, groundY - pillarH / 2, 14, pillarH, 'WOOD');
      b(px + 20, groundY - pillarH / 2, 14, pillarH, 'WOOD');
    }
  }

  const deckY = groundY - pillarH - 6;
  const deckCX = startX + 1.5 * pillarSpacing;
  b(deckCX, deckY, deckW, 12, 'STONE');

  for (let i = 0; i < 4; i++) {
    b(startX + i * pillarSpacing, deckY - 6 - 14, 28, 28, 'WOOD');
  }

  ctx.barrel(pillarXs[0] + pillarSpacing / 2, groundY - 18);
  ctx.barrel(deckCX + 100, deckY - 6 - 18);

  // Spike trap under the bridge
  ctx.hazard('SPIKE_TRAP', deckCX, groundY - 5);

  const eR = 20;
  ctx.enemySlots.push(
    { x: startX + 0.5 * pillarSpacing, y: deckY - 6 - eR },
    { x: startX + 1.5 * pillarSpacing, y: deckY - 6 - eR },
    { x: startX + 2.5 * pillarSpacing, y: deckY - 6 - eR },
    { x: startX + 1.5 * pillarSpacing, y: groundY - eR },
  );

  // Coins (~16g)
  ctx.coin(440, 300, 3);                                       // approach — arc path
  ctx.coin(startX + 0.5 * pillarSpacing, deckY - 30, 3);      // structure — above bridge deck
  ctx.coin(startX + 2.5 * pillarSpacing, deckY - 30, 4);      // structure — above far end of bridge
  ctx.coin(deckCX + 100, deckY - 6 - 18, 3);                  // risky — near deck barrel
  ctx.coin(deckCX, groundY - 18, 3);                           // risky — under bridge near spike
};

// ─── "The Avalanche" — heavy stone on thin supports above barrel ────────────
export const theAvalanche: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const CX = 640;
  const span = 130;
  const pillarH = 70;

  b(CX - span / 2, groundY - pillarH / 2, 14, pillarH, 'WOOD');
  b(CX, groundY - pillarH / 2, 14, pillarH, 'WOOD');
  b(CX + span / 2, groundY - pillarH / 2, 14, pillarH, 'WOOD');
  const shelf1 = groundY - pillarH - 6;
  b(CX, shelf1, span + 40, 12, 'STONE');

  ctx.barrel(CX - 30, shelf1 - 6 - 18);

  const thinH = 40;
  b(CX - 45, shelf1 - 6 - thinH / 2, 10, thinH, 'WOOD');
  b(CX - 15, shelf1 - 6 - thinH / 2, 10, thinH, 'WOOD');
  const shelf2 = shelf1 - 6 - thinH - 6;
  b(CX - 30, shelf2, 80, 12, 'STONE');

  b(CX - 45, shelf2 - 6 - 16, 40, 32, 'STONE');
  b(CX - 15, shelf2 - 6 - 16, 40, 32, 'STONE');

  const RX = 820;
  b(RX - 40, groundY - 60 / 2, 14, 60, 'WOOD');
  b(RX + 40, groundY - 60 / 2, 14, 60, 'WOOD');
  const rFloor = groundY - 60 - 6;
  b(RX, rFloor, 110, 12, 'STONE');
  b(RX - 20, rFloor - 6 - 40 / 2, 14, 40, 'WOOD');
  b(RX + 20, rFloor - 6 - 40 / 2, 14, 40, 'WOOD');
  const rFloor2 = rFloor - 6 - 40 - 6;
  b(RX, rFloor2, 80, 12, 'STONE');
  b(RX, rFloor2 - 18, 28, 28, 'STONE');

  ctx.barrel(RX, groundY - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: CX + 30, y: shelf1 - 6 - eR },
    { x: CX, y: groundY - eR },
    { x: RX, y: rFloor - 6 - eR },
    { x: RX, y: rFloor2 - 6 - 28 - eR },
  );

  // Coins (~16g)
  ctx.coin(460, 280, 3);                          // approach — arc path
  ctx.coin(CX - 30, shelf2 - 40, 4);             // structure — above avalanche stones
  ctx.coin(RX, rFloor2 - 40, 4);                 // structure — above right tower cap
  ctx.coin(CX + 40, shelf1 - 6 - 18, 3);         // structure — on first shelf
  ctx.coin(RX, groundY - 18, 2);                 // risky — near right barrel
};

// ─── "War Camp" — two wooden huts flanking a barrel cache ───────────────────
export const warCamp: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Left hut — open front
  const LX = 490;
  const hutW = 90;
  b(LX, groundY - 55 / 2, 14, 55, 'WOOD');
  b(LX + hutW, groundY - 55 / 2, 14, 55, 'WOOD');
  const lFloor = groundY - 55 - 6;
  b(LX + hutW / 2, lFloor, hutW + 20, 12, 'WOOD');
  // Small roof
  b(LX + hutW / 2, lFloor - 6 - 25 / 2, 12, 25, 'WOOD');
  b(LX + hutW / 2, lFloor - 6 - 25 - 6, 60, 10, 'WOOD');

  // Central barrel cache (ground level)
  const CX = 660;
  b(CX - 25, groundY - 30 / 2, 10, 30, 'WOOD');
  b(CX + 25, groundY - 30 / 2, 10, 30, 'WOOD');
  b(CX, groundY - 30 - 6, 60, 10, 'WOOD');

  // Right hut — taller, stone base
  const RX = 810;
  b(RX, groundY - 35 / 2, 24, 35, 'STONE');
  b(RX + hutW, groundY - 35 / 2, 24, 35, 'STONE');
  const rBase = groundY - 35 - 6;
  b(RX + hutW / 2, rBase, hutW + 20, 12, 'STONE');
  b(RX + 15, rBase - 6 - 45 / 2, 14, 45, 'WOOD');
  b(RX + hutW - 15, rBase - 6 - 45 / 2, 14, 45, 'WOOD');
  const rFloor = rBase - 6 - 45 - 6;
  b(RX + hutW / 2, rFloor, hutW + 10, 12, 'WOOD');

  ctx.barrel(CX - 10, groundY - 18);
  ctx.barrel(CX + 10, groundY - 30 - 6 - 6 - 18);
  ctx.barrel(RX + hutW / 2, groundY - 18);

  // Spike trap between huts
  ctx.hazard('SPIKE_TRAP', (CX + RX) / 2, groundY - 5);

  const eR = 20;
  ctx.enemySlots.push(
    { x: LX + hutW / 2, y: lFloor - 6 - eR },
    { x: CX, y: groundY - eR },
    { x: RX + hutW / 2, y: rBase - 6 - eR },
    { x: RX + hutW / 2, y: rFloor - 6 - eR },
  );

  // Coins (~16g)
  ctx.coin(440, 310, 3);                                    // approach — arc path
  ctx.coin(LX + hutW / 2, lFloor - 6 - 25 - 18, 3);       // structure — above left hut roof
  ctx.coin(CX, groundY - 30 - 18, 4);                      // risky — above barrel cache
  ctx.coin(RX + hutW / 2, rFloor - 10, 4);                 // structure — right hut upper level
  ctx.coin(RX + hutW / 2, groundY - 18, 2);                // risky — near right barrel

  // Terrain — raised ground between the two huts
  raisedPlatform(ctx, 650, groundY, 100, 16);
};

// ─── "Watchtower Row" — 3 small watchtowers in a line ───────────────────────
export const watchtowerRow: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const startX = 470;
  const towerSpacing = 170;

  for (let t = 0; t < 3; t++) {
    const tx = startX + t * towerSpacing;
    const span = 70;
    const pH = 55 + t * 10; // each tower slightly taller

    b(tx, groundY - pH / 2, 14, pH, 'WOOD');
    b(tx + span, groundY - pH / 2, 14, pH, 'WOOD');
    const floor = groundY - pH - 6;
    b(tx + span / 2, floor, span + 20, 12, 'STONE');
    b(tx + span / 2, floor - 6 - 14, 24, 24, 'STONE');

    ctx.barrel(tx + span / 2, groundY - 18);
    ctx.enemySlots.push({ x: tx + span / 2, y: floor - 6 - eR(t) });
  }

  // Ground enemies between towers
  ctx.enemySlots.push({ x: startX + towerSpacing * 0.5 + 35, y: groundY - 20 });
  ctx.enemySlots.push({ x: startX + towerSpacing * 1.5 + 35, y: groundY - 20 });

  function eR(_t: number) { return 20; }

  // Coins (~16g)
  ctx.coin(430, 300, 3);                                         // approach — arc path
  ctx.coin(startX + 35, groundY - 65 - 30, 3);                  // structure — above 1st tower
  ctx.coin(startX + towerSpacing + 35, groundY - 75 - 30, 4);   // structure — above 2nd tower
  ctx.coin(startX + 2 * towerSpacing + 35, groundY - 85 - 30, 4); // structure — above 3rd tower
  ctx.coin(startX + towerSpacing + 35, groundY - 18, 2);        // ground — between towers
};

// ─── "Stacked Crates" — pyramid of wooden boxes ────────────────────────────
export const stackedCrates: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const CX = 660;
  const crateSize = 36;
  const gap = 2;

  // Bottom row: 4 crates
  for (let i = 0; i < 4; i++) {
    const x = CX - 1.5 * (crateSize + gap) + i * (crateSize + gap);
    b(x, groundY - crateSize / 2, crateSize, crateSize, 'WOOD');
  }
  // Row 2: 3 crates
  for (let i = 0; i < 3; i++) {
    const x = CX - 1 * (crateSize + gap) + i * (crateSize + gap);
    b(x, groundY - crateSize - gap - crateSize / 2, crateSize, crateSize, 'WOOD');
  }
  // Row 3: 2 crates
  for (let i = 0; i < 2; i++) {
    const x = CX - 0.5 * (crateSize + gap) + i * (crateSize + gap);
    b(x, groundY - 2 * (crateSize + gap) - crateSize / 2, crateSize, crateSize, 'WOOD');
  }
  // Top: 1 stone block
  b(CX, groundY - 3 * (crateSize + gap) - crateSize / 2, crateSize, crateSize, 'STONE');

  // Side shelter
  const SX = 870;
  b(SX, groundY - 45 / 2, 14, 45, 'WOOD');
  b(SX + 55, groundY - 45 / 2, 14, 45, 'WOOD');
  b(SX + 27, groundY - 45 - 6, 75, 10, 'WOOD');

  ctx.barrel(CX - (crateSize + gap), groundY - 18);
  ctx.barrel(CX + (crateSize + gap), groundY - 18);
  ctx.barrel(SX + 27, groundY - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: CX, y: groundY - 3 * (crateSize + gap) - crateSize - eR },
    { x: CX + 60, y: groundY - eR },
    { x: SX + 27, y: groundY - 45 - 6 - 6 - eR },
    { x: CX - 80, y: groundY - eR },
  );

  // Coins (~16g)
  ctx.coin(480, 290, 3);                                              // approach — arc path
  ctx.coin(CX, groundY - 3 * (crateSize + gap) - crateSize - 20, 4); // structure — above pyramid
  ctx.coin(CX - (crateSize + gap), groundY - 18, 3);                 // risky — near barrel
  ctx.coin(SX + 27, groundY - 18, 4);                                // risky — near side barrel
  ctx.coin(CX + 60, groundY - 18, 2);                                // ground — front
};

// ─── "Drawbridge" — hinged plank over a gap with enemies on both sides ─────
export const drawbridge: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Left platform
  const LX = 480;
  b(LX, groundY - 60 / 2, 14, 60, 'WOOD');
  b(LX + 80, groundY - 60 / 2, 14, 60, 'WOOD');
  const lFloor = groundY - 60 - 6;
  b(LX + 40, lFloor, 110, 12, 'STONE');

  // Bridge plank (rests on single thin support — weak point)
  const bridgeX = LX + 130;
  b(bridgeX, groundY - 30 / 2, 10, 30, 'WOOD');
  b(bridgeX, groundY - 30 - 6, 80, 10, 'WOOD');

  // Right platform — taller
  const RX = LX + 220;
  b(RX, groundY - 75 / 2, 14, 75, 'WOOD');
  b(RX + 90, groundY - 75 / 2, 14, 75, 'WOOD');
  const rFloor = groundY - 75 - 6;
  b(RX + 45, rFloor, 120, 12, 'STONE');

  // Top level on right
  b(RX + 15, rFloor - 6 - 40 / 2, 14, 40, 'WOOD');
  b(RX + 75, rFloor - 6 - 40 / 2, 14, 40, 'WOOD');
  const rFloor2 = rFloor - 6 - 40 - 6;
  b(RX + 45, rFloor2, 90, 12, 'STONE');

  ctx.barrel(LX + 40, groundY - 18);
  ctx.barrel(RX + 45, groundY - 18);
  ctx.barrel(bridgeX, groundY - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: LX + 40, y: lFloor - 6 - eR },
    { x: bridgeX, y: groundY - 30 - 6 - 6 - eR },
    { x: RX + 45, y: rFloor - 6 - eR },
    { x: RX + 45, y: rFloor2 - 6 - eR },
  );

  // Coins (~16g)
  ctx.coin(440, 300, 3);                          // approach — arc path
  ctx.coin(LX + 40, lFloor - 30, 3);             // structure — above left platform
  ctx.coin(bridgeX, groundY - 30 - 20, 4);       // structure — above bridge plank
  ctx.coin(RX + 45, rFloor2 - 20, 4);            // structure — above right top level
  ctx.coin(bridgeX, groundY - 18, 2);            // risky — near bridge barrel
};

// ─── "Trebuchet Camp" — siege engine structure ──────────────────────────────
export const trebuchetCamp: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Trebuchet frame
  const TX = 530;
  const frameW = 100;
  b(TX, groundY - 70 / 2, 16, 70, 'WOOD');
  b(TX + frameW, groundY - 70 / 2, 16, 70, 'WOOD');
  const beam = groundY - 70 - 6;
  b(TX + frameW / 2, beam, frameW + 30, 12, 'WOOD');

  // Arm (long plank with counterweight)
  b(TX + frameW / 2, beam - 6 - 8, 140, 10, 'WOOD');
  b(TX + frameW / 2 - 55, beam - 6 - 16 - 14, 32, 28, 'STONE'); // counterweight

  // Ammo pile behind trebuchet
  const AX = 820;
  for (let i = 0; i < 3; i++) {
    b(AX + i * 32, groundY - 16, 28, 28, 'STONE');
  }
  b(AX + 16, groundY - 28 - 4 - 14, 28, 28, 'STONE');

  // Supply tent
  b(AX - 60, groundY - 40 / 2, 12, 40, 'WOOD');
  b(AX - 20, groundY - 40 / 2, 12, 40, 'WOOD');
  b(AX - 40, groundY - 40 - 6, 60, 10, 'WOOD');

  ctx.barrel(TX + frameW / 2, groundY - 18);
  ctx.barrel(TX + frameW / 2 + 40, beam - 6 - 18);
  ctx.barrel(AX + 48, groundY - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: TX + frameW / 2, y: beam - 6 - 18 - eR },
    { x: AX + 16, y: groundY - 28 - 4 - 28 - eR },
    { x: AX - 40, y: groundY - 40 - 6 - 6 - eR },
    { x: 700, y: groundY - eR },
  );

  // Coins (~16g)
  ctx.coin(440, 280, 3);                          // approach — arc path
  ctx.coin(TX + frameW / 2, beam - 30, 4);       // structure — above trebuchet beam
  ctx.coin(AX + 16, groundY - 28 - 4 - 40, 4);  // structure — above ammo pile
  ctx.coin(700, groundY - 18, 3);                // ground — between structures
  ctx.coin(AX + 48, groundY - 18, 2);            // risky — near ammo barrel
};

// ─── "Spiked Gauntlet" — palisade with spike traps ─────────────────────────
export const spikedGauntlet: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // Entry palisade
  const PX = 470;
  b(PX, groundY - 50 / 2, 16, 50, 'WOOD');
  b(PX + 40, groundY - 60 / 2, 16, 60, 'WOOD');
  b(PX + 80, groundY - 50 / 2, 16, 50, 'WOOD');

  // Spike traps on ground
  ctx.hazard('SPIKE_TRAP', 560, groundY - 10);
  ctx.hazard('SPIKE_TRAP', 680, groundY - 10);

  // Main tower behind traps
  const TX = 760;
  const span = 100;
  b(TX, groundY - 65 / 2, 14, 65, 'WOOD');
  b(TX + span, groundY - 65 / 2, 14, 65, 'WOOD');
  const f1 = groundY - 65 - 6;
  b(TX + span / 2, f1, span + 20, 12, 'STONE');

  b(TX + 15, f1 - 6 - 45 / 2, 14, 45, 'WOOD');
  b(TX + span - 15, f1 - 6 - 45 / 2, 14, 45, 'WOOD');
  const f2 = f1 - 6 - 45 - 6;
  b(TX + span / 2, f2, span + 10, 12, 'STONE');
  b(TX + span / 2, f2 - 18, 28, 28, 'STONE');

  ctx.barrel(TX + span / 2, groundY - 18);
  ctx.barrel(PX + 40, groundY - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: PX + 40, y: groundY - 60 - eR },
    { x: 620, y: groundY - eR },
    { x: TX + span / 2, y: f1 - 6 - eR },
    { x: TX + span / 2, y: f2 - 6 - 28 - eR },
  );

  // Coins (~16g)
  ctx.coin(430, 290, 3);                          // approach — arc path
  ctx.coin(PX + 40, groundY - 70, 3);            // structure — above palisade
  ctx.coin(TX + span / 2, f2 - 40, 4);           // structure — above tower cap
  ctx.coin(620, groundY - 18, 4);                // risky — between spike traps
  ctx.coin(TX + span / 2, groundY - 18, 2);      // risky — near tower barrel
};

export const diff2Templates: TemplateFn[] = [
  theBridge,
  theAvalanche,
  warCamp,
  watchtowerRow,
  stackedCrates,
  drawbridge,
  trebuchetCamp,
  spikedGauntlet,
];
