import type { TemplateFn } from '../types';

// ─── "Ice Bridge" — long elevated ice walkway ──────────────────────────────
export const iceBridge: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const startX = 470;
  const pillarSpacing = 120;
  const pillarH = 75;

  for (let i = 0; i < 4; i++) {
    b(startX + i * pillarSpacing, groundY - pillarH / 2, 16, pillarH, 'ICE');
  }

  const deckY = groundY - pillarH - 6;
  const deckCX = startX + 1.5 * pillarSpacing;
  b(deckCX, deckY, 420, 14, 'ICE');

  for (let i = 0; i < 3; i++) {
    b(startX + (i + 0.5) * pillarSpacing, deckY - 6 - 14, 28, 28, 'STONE');
  }

  ctx.barrel(startX + 0.5 * pillarSpacing, groundY - 18);
  ctx.barrel(deckCX + 80, deckY - 6 - 18);
  ctx.hazard('ICE_PATCH', deckCX, deckY - 6 - 5);

  const eR = 20;
  ctx.enemySlots.push(
    { x: startX + 0.5 * pillarSpacing, y: deckY - 6 - eR },
    { x: startX + 1.5 * pillarSpacing, y: deckY - 6 - eR },
    { x: startX + 2.5 * pillarSpacing, y: deckY - 6 - eR },
    { x: startX + 1.5 * pillarSpacing, y: groundY - eR },
  );

  // Coins (~16g total)
  ctx.coin(430, 350, 2);                                        // approach — early arc
  ctx.coin(startX + 0.5 * pillarSpacing, deckY - 30, 3);       // structure — on bridge deck
  ctx.coin(startX + 2.5 * pillarSpacing, deckY - 30, 3);       // structure — far end of bridge
  ctx.coin(deckCX, deckY - 18, 4);                              // risky — near ice patch on deck
  ctx.coin(startX + 0.5 * pillarSpacing, groundY - 18, 4);     // risky — near barrel under bridge
};

// ─── "Glacial Watchtower" — tall ice tower with flanking walls ─────────────
export const glacialWatchtower: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const TX = 640;
  const span = 90;
  const pH1 = 70, pH2 = 55, pH3 = 40;

  b(TX, groundY - pH1 / 2, 16, pH1, 'ICE');
  b(TX + span, groundY - pH1 / 2, 16, pH1, 'ICE');
  const f1 = groundY - pH1 - 6;
  b(TX + span / 2, f1, span + 20, 12, 'ICE');

  b(TX + 10, f1 - 6 - pH2 / 2, 14, pH2, 'WOOD');
  b(TX + span - 10, f1 - 6 - pH2 / 2, 14, pH2, 'WOOD');
  const f2 = f1 - 6 - pH2 - 6;
  b(TX + span / 2, f2, span + 10, 12, 'ICE');

  b(TX + span / 2, f2 - 6 - pH3 / 2, 14, pH3, 'WOOD');
  const f3 = f2 - 6 - pH3 - 6;
  b(TX + span / 2, f3, 60, 10, 'ICE');

  b(480, groundY - 40 / 2, 24, 40, 'ICE');
  b(870, groundY - 40 / 2, 24, 40, 'ICE');

  ctx.barrel(TX + span / 2, groundY - 18);
  ctx.barrel(480, groundY - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: TX + span / 2, y: f1 - 6 - eR },
    { x: TX + span / 2, y: f3 - 6 - eR },
    { x: 480, y: groundY - 40 - eR },
    { x: 870, y: groundY - 40 - eR },
  );

  // Coins (~16g total)
  ctx.coin(520, 300, 2);                        // approach — arc path
  ctx.coin(TX + span / 2, f2 - 20, 3);         // structure — mid tower level
  ctx.coin(870, groundY - 60, 3);              // structure — near far flanking wall
  ctx.coin(TX + span / 2, groundY - 18, 4);    // risky — near barrel inside tower
  ctx.coin(480, groundY - 18, 4);              // risky — near barrel at front wall
};

// ─── "Frozen Camp" — two ice huts flanking barrels ─────────────────────────
export const frozenCamp: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const LX = 490;
  const hutW = 90;
  b(LX, groundY - 55 / 2, 16, 55, 'ICE');
  b(LX + hutW, groundY - 55 / 2, 16, 55, 'ICE');
  const lFloor = groundY - 55 - 6;
  b(LX + hutW / 2, lFloor, hutW + 20, 12, 'WOOD');
  b(LX + hutW / 2, lFloor - 6 - 25 / 2, 12, 25, 'WOOD');
  b(LX + hutW / 2, lFloor - 6 - 25 - 6, 60, 10, 'ICE');

  const CX = 660;
  b(CX - 25, groundY - 30 / 2, 10, 30, 'WOOD');
  b(CX + 25, groundY - 30 / 2, 10, 30, 'WOOD');
  b(CX, groundY - 30 - 6, 60, 10, 'ICE');

  const RX = 810;
  b(RX, groundY - 40 / 2, 20, 40, 'STONE');
  b(RX + hutW, groundY - 40 / 2, 20, 40, 'STONE');
  const rBase = groundY - 40 - 6;
  b(RX + hutW / 2, rBase, hutW + 20, 12, 'STONE');
  b(RX + 15, rBase - 6 - 45 / 2, 14, 45, 'ICE');
  b(RX + hutW - 15, rBase - 6 - 45 / 2, 14, 45, 'ICE');
  const rFloor = rBase - 6 - 45 - 6;
  b(RX + hutW / 2, rFloor, hutW + 10, 12, 'ICE');

  ctx.barrel(CX - 10, groundY - 18);
  ctx.barrel(CX + 10, groundY - 30 - 6 - 6 - 18);
  ctx.barrel(RX + hutW / 2, groundY - 18);
  ctx.hazard('ICE_PATCH', 580, groundY - 5);

  const eR = 20;
  ctx.enemySlots.push(
    { x: LX + hutW / 2, y: lFloor - 6 - eR },
    { x: CX, y: groundY - eR },
    { x: RX + hutW / 2, y: rBase - 6 - eR },
    { x: RX + hutW / 2, y: rFloor - 6 - eR },
  );

  // Coins (~16g total)
  ctx.coin(440, 320, 2);                        // approach — arc path
  ctx.coin(LX + hutW / 2, lFloor - 40, 3);     // structure — above left hut
  ctx.coin(RX + hutW / 2, rBase - 60, 3);      // structure — near right hut upper
  ctx.coin(580, groundY - 18, 4);              // risky — near ice patch
  ctx.coin(CX, groundY - 18, 4);              // risky — near center barrels
};

// ─── "Avalanche Shelf" — heavy ice on thin wood supports ───────────────────
export const avalancheShelf: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  const CX = 650;
  const span = 130;

  b(CX - span / 2, groundY - 70 / 2, 14, 70, 'WOOD');
  b(CX, groundY - 70 / 2, 14, 70, 'WOOD');
  b(CX + span / 2, groundY - 70 / 2, 14, 70, 'WOOD');
  const shelf1 = groundY - 70 - 6;
  b(CX, shelf1, span + 40, 12, 'ICE');

  const thinH = 35;
  b(CX - 40, shelf1 - 6 - thinH / 2, 10, thinH, 'WOOD');
  b(CX - 10, shelf1 - 6 - thinH / 2, 10, thinH, 'WOOD');
  const shelf2 = shelf1 - 6 - thinH - 6;
  b(CX - 25, shelf2, 80, 12, 'ICE');
  b(CX - 40, shelf2 - 6 - 16, 40, 32, 'ICE');
  b(CX - 10, shelf2 - 6 - 16, 40, 32, 'ICE');

  ctx.barrel(CX + 30, shelf1 - 6 - 18);

  const RX = 830;
  b(RX - 35, groundY - 60 / 2, 14, 60, 'ICE');
  b(RX + 35, groundY - 60 / 2, 14, 60, 'ICE');
  const rFloor = groundY - 60 - 6;
  b(RX, rFloor, 90, 12, 'STONE');
  b(RX, rFloor - 18, 28, 28, 'ICE');

  ctx.barrel(RX, groundY - 18);

  const eR = 20;
  ctx.enemySlots.push(
    { x: CX + 30, y: shelf1 - 6 - eR },
    { x: CX, y: groundY - eR },
    { x: RX, y: rFloor - 6 - eR },
    { x: RX, y: rFloor - 6 - 28 - eR },
  );

  // Coins (~16g total)
  ctx.coin(480, 280, 2);                        // approach — arc path
  ctx.coin(CX - 25, shelf1 - 30, 3);           // structure — above main shelf
  ctx.coin(RX, rFloor - 30, 3);                // structure — above right platform
  ctx.coin(CX + 30, shelf1 - 18, 4);           // risky — near barrel on shelf
  ctx.coin(RX, groundY - 18, 4);               // risky — near right barrel
};

export const diff2Templates: TemplateFn[] = [
  iceBridge,
  glacialWatchtower,
  frozenCamp,
  avalancheShelf,
];
