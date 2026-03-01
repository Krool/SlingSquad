import type { TemplateFn } from '../types';

// ─── "Demon Gatehouse" — obsidian gate pillars with wood lintel weak point ──
export const demonGatehouse: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Two massive obsidian gate pillars
  const GX = 560;
  const gateW = 140;
  b(GX, groundY - 80 / 2, 22, 80, 'OBSIDIAN');
  b(GX + gateW, groundY - 80 / 2, 22, 80, 'OBSIDIAN');

  // Wood lintel — weak point above gate
  const lintelY = groundY - 80 - 6;
  b(GX + gateW / 2, lintelY, gateW + 30, 12, 'WOOD');

  // Upper battlements — obsidian crenellations
  b(GX, lintelY - 6 - 30 / 2, 14, 30, 'OBSIDIAN');
  b(GX + gateW, lintelY - 6 - 30 / 2, 14, 30, 'OBSIDIAN');
  const topY = lintelY - 6 - 30 - 6;
  b(GX + gateW / 2, topY, gateW + 20, 12, 'STONE');

  // Guard tower to the right
  const TX = 790;
  b(TX, groundY - 65 / 2, 14, 65, 'OBSIDIAN');
  b(TX + 70, groundY - 65 / 2, 14, 65, 'STONE');
  const tFloor = groundY - 65 - 6;
  b(TX + 35, tFloor, 90, 12, 'OBSIDIAN');

  ctx.barrel(GX + gateW / 2, groundY - 18);
  ctx.barrel(TX + 35, groundY - 18);

  ctx.hazard('LAVA_PIT', GX + gateW / 2 - 30, groundY - 10);

  ctx.enemySlots.push(
    { x: GX + gateW / 2, y: lintelY - 6 - eR },
    { x: GX + gateW / 2, y: topY - 6 - eR },
    { x: TX + 35, y: tFloor - 6 - eR },
    { x: GX + gateW + 40, y: groundY - eR },
  );

  // Coins (~16g)
  ctx.coin(490, 310, 2);                        // approach — arc path
  ctx.coin(GX + gateW / 2, topY - 30, 3);       // structure — above gate battlements
  ctx.coin(TX + 35, tFloor - 30, 3);             // structure — above guard tower
  ctx.coin(GX + gateW / 2 - 30, groundY - 40, 4); // risky — near lava pit
  ctx.coin(TX + 35, groundY - 18, 4);            // risky — near barrel inside tower
};

// ─── "Lava Bridge" — elevated deck over lava hazards ────────────────────────
export const lavaBridge: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  const startX = 470;
  const deckLen = 400;
  const pillarH = 70;
  const pillarCount = 4;
  const spacing = deckLen / (pillarCount - 1);

  // Support pillars — alternating obsidian and stone
  for (let i = 0; i < pillarCount; i++) {
    const px = startX + i * spacing;
    const mat = i % 2 === 0 ? 'OBSIDIAN' : 'STONE';
    b(px, groundY - pillarH / 2, 14, pillarH, mat);
  }

  // Bridge deck
  const deckY = groundY - pillarH - 6;
  const deckCX = startX + deckLen / 2;
  b(deckCX, deckY, deckLen + 20, 12, 'OBSIDIAN');

  // Wooden railings (weak points)
  b(startX + spacing * 0.5, deckY - 6 - 20 / 2, 10, 20, 'WOOD');
  b(startX + spacing * 2.5, deckY - 6 - 20 / 2, 10, 20, 'WOOD');

  // Lava hazards underneath
  ctx.hazard('LAVA_PIT', startX + spacing, groundY - 10);
  ctx.hazard('LAVA_PIT', startX + spacing * 2, groundY - 10);

  ctx.barrel(startX + spacing * 1.5, deckY - 6 - 18);
  ctx.barrel(startX + spacing * 0.5, groundY - 18);

  ctx.enemySlots.push(
    { x: startX + spacing * 0.5, y: deckY - 6 - eR },
    { x: startX + spacing * 1.5, y: deckY - 6 - eR },
    { x: startX + spacing * 2.5, y: deckY - 6 - eR },
    { x: startX + spacing * 3, y: groundY - eR },
  );

  // Coins (~16g)
  ctx.coin(450, 330, 2);                              // approach — arc path
  ctx.coin(deckCX, deckY - 30, 3);                    // structure — above bridge deck
  ctx.coin(startX + spacing * 2, deckY - 30, 3);      // structure — above right railing
  ctx.coin(startX + spacing, groundY - 18, 4);        // risky — under bridge near lava
  ctx.coin(startX + spacing * 2, groundY - 18, 4);    // risky — under bridge near lava
};

// ─── "Obsidian Pillbox" — low armored bunker with slit openings ─────────────
export const obsidianPillbox: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  const CX = 640;
  const boxW = 180;
  const wallH = 50;

  // Thick obsidian walls
  b(CX - boxW / 2, groundY - wallH / 2, 24, wallH, 'OBSIDIAN');
  b(CX + boxW / 2, groundY - wallH / 2, 24, wallH, 'OBSIDIAN');
  // Center divider — wood weak point
  b(CX, groundY - wallH / 2, 12, wallH, 'WOOD');

  // Obsidian roof
  const roofY = groundY - wallH - 6;
  b(CX, roofY, boxW + 20, 14, 'OBSIDIAN');

  // Stone cap on top
  b(CX - 40, roofY - 6 - 14, 28, 28, 'STONE');
  b(CX + 40, roofY - 6 - 14, 28, 28, 'STONE');

  // Flanking side post
  const SX = 870;
  b(SX, groundY - 45 / 2, 14, 45, 'STONE');
  b(SX, groundY - 45 - 6, 50, 10, 'OBSIDIAN');

  ctx.barrel(CX, groundY - 18);
  ctx.barrel(SX, groundY - 18);

  ctx.hazard('LAVA_PIT', CX + boxW / 2 + 40, groundY - 10);

  ctx.enemySlots.push(
    { x: CX - boxW / 4, y: groundY - eR },
    { x: CX + boxW / 4, y: groundY - eR },
    { x: CX, y: roofY - 6 - 28 - eR },
    { x: SX, y: groundY - 45 - 6 - 6 - eR },
  );

  // Coins (~15g)
  ctx.coin(500, 340, 2);                          // approach — arc path
  ctx.coin(CX, roofY - 40, 3);                    // structure — above bunker roof
  ctx.coin(SX, groundY - 45 - 20, 3);             // structure — near side post platform
  ctx.coin(CX + boxW / 2 + 40, groundY - 40, 4); // risky — near lava pit
};

// ─── "Hell Scaffold" — multi-tier scaffold with wood platforms ──────────────
export const hellScaffold: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  const CX = 660;
  const span = 120;

  // Level 1 — obsidian pillars
  b(CX - span / 2, groundY - 60 / 2, 14, 60, 'OBSIDIAN');
  b(CX + span / 2, groundY - 60 / 2, 14, 60, 'OBSIDIAN');
  const f1 = groundY - 60 - 6;
  b(CX, f1, span + 20, 12, 'WOOD'); // wood platform — weak point

  // Level 2 — narrower
  b(CX - 40, f1 - 6 - 50 / 2, 14, 50, 'STONE');
  b(CX + 40, f1 - 6 - 50 / 2, 14, 50, 'STONE');
  const f2 = f1 - 6 - 50 - 6;
  b(CX, f2, 100, 12, 'OBSIDIAN');

  // Level 3 — narrow top
  b(CX, f2 - 6 - 35 / 2, 14, 35, 'OBSIDIAN');
  const f3 = f2 - 6 - 35 - 6;
  b(CX, f3, 60, 12, 'STONE');

  // Side platform
  const SX = 480;
  b(SX, groundY - 50 / 2, 14, 50, 'STONE');
  b(SX + 60, groundY - 50 / 2, 14, 50, 'OBSIDIAN');
  const sf = groundY - 50 - 6;
  b(SX + 30, sf, 80, 12, 'WOOD');

  ctx.barrel(CX, groundY - 18);
  ctx.barrel(SX + 30, groundY - 18);

  ctx.hazard('LAVA_PIT', CX + span / 2 + 30, groundY - 10);

  ctx.enemySlots.push(
    { x: CX, y: f1 - 6 - eR },
    { x: CX, y: f2 - 6 - eR },
    { x: CX, y: f3 - 6 - eR },
    { x: SX + 30, y: sf - 6 - eR },
  );

  // Coins (~16g)
  ctx.coin(440, 320, 2);                         // approach — arc path
  ctx.coin(CX, f2 - 30, 3);                      // structure — above level 2 platform
  ctx.coin(SX + 30, sf - 30, 3);                  // structure — above side platform
  ctx.coin(CX + span / 2 + 30, groundY - 40, 4); // risky — near lava pit
  ctx.coin(CX, f3 - 30, 4);                       // risky — above narrow top level
};

// ─── "Cinder Hut" — compact obsidian shelter with wood roof ─────────────────
export const cinderHut: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Main hut — obsidian walls, wood roof
  const HX = 530;
  const hutW = 110;
  b(HX, groundY - 60 / 2, 20, 60, 'OBSIDIAN');
  b(HX + hutW, groundY - 60 / 2, 20, 60, 'OBSIDIAN');
  const hutFloor = groundY - 60 - 6;
  b(HX + hutW / 2, hutFloor, hutW + 20, 12, 'STONE');

  // Wood roof struts (weak point)
  b(HX + hutW / 2, hutFloor - 6 - 30 / 2, 12, 30, 'WOOD');
  const roofY = hutFloor - 6 - 30 - 6;
  b(HX + hutW / 2, roofY, hutW - 10, 10, 'WOOD');

  // Secondary structure
  const RX = 740;
  b(RX, groundY - 55 / 2, 14, 55, 'STONE');
  b(RX + 80, groundY - 55 / 2, 14, 55, 'OBSIDIAN');
  const rFloor = groundY - 55 - 6;
  b(RX + 40, rFloor, 100, 12, 'OBSIDIAN');
  b(RX + 40, rFloor - 6 - 14, 28, 28, 'STONE');

  ctx.barrel(HX + hutW / 2, groundY - 18);

  ctx.hazard('LAVA_PIT', HX + hutW + 30, groundY - 10);

  ctx.enemySlots.push(
    { x: HX + hutW / 2, y: hutFloor - 6 - eR },
    { x: HX + hutW / 2, y: roofY - 6 - eR },
    { x: RX + 40, y: rFloor - 6 - eR },
    { x: RX + 40, y: groundY - eR },
  );

  // Coins (~14g)
  ctx.coin(460, 300, 2);                          // approach — arc path
  ctx.coin(HX + hutW / 2, roofY - 30, 3);         // structure — above hut roof
  ctx.coin(RX + 40, rFloor - 30, 3);              // structure — above secondary structure
  ctx.coin(HX + hutW + 30, groundY - 40, 4);      // risky — near lava pit
};

// ─── "Ash Barricade" — layered barricade walls ──────────────────────────────
export const ashBarricade: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Three barricade walls, progressively taller
  const walls = [
    { x: 480, h: 45, mat: 'STONE' as const },
    { x: 600, h: 55, mat: 'OBSIDIAN' as const },
    { x: 720, h: 65, mat: 'OBSIDIAN' as const },
  ];

  for (const wall of walls) {
    b(wall.x, groundY - wall.h / 2, 20, wall.h, wall.mat);
    // Wood cap — weak point
    b(wall.x, groundY - wall.h - 6 - 12, 30, 20, 'WOOD');
  }

  // Rear platform
  const RX = 830;
  b(RX, groundY - 60 / 2, 14, 60, 'OBSIDIAN');
  b(RX + 80, groundY - 60 / 2, 14, 60, 'OBSIDIAN');
  const rFloor = groundY - 60 - 6;
  b(RX + 40, rFloor, 100, 12, 'STONE');
  b(RX + 40, rFloor - 6 - 14, 28, 28, 'OBSIDIAN');

  ctx.barrel(600, groundY - 18);
  ctx.barrel(RX + 40, groundY - 18);

  ctx.hazard('LAVA_PIT', 540, groundY - 10);

  ctx.enemySlots.push(
    { x: 540, y: groundY - eR },
    { x: 660, y: groundY - eR },
    { x: RX + 40, y: rFloor - 6 - eR },
    { x: 720, y: groundY - 65 - 6 - 20 - eR },
  );

  // Coins (~17g)
  ctx.coin(430, 350, 2);                 // approach — arc path
  ctx.coin(660, groundY - 55 - 30, 3);   // structure — above second barricade
  ctx.coin(RX + 40, rFloor - 30, 3);     // structure — above rear platform
  ctx.coin(720, groundY - 65 - 40, 4);   // structure — above tallest barricade cap
  ctx.coin(540, groundY - 18, 5);        // risky — near lava pit on ground
};

// ─── "Magma Vent" — structure built around central lava hazard ──────────────
export const magmaVent: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  // Central vent area
  const CX = 650;

  // Left obsidian wall
  b(CX - 80, groundY - 60 / 2, 18, 60, 'OBSIDIAN');
  // Right obsidian wall
  b(CX + 80, groundY - 60 / 2, 18, 60, 'OBSIDIAN');

  // Bridge over vent
  const bridgeY = groundY - 60 - 6;
  b(CX, bridgeY, 180, 12, 'STONE');

  // Lava vent below
  ctx.hazard('LAVA_PIT', CX - 20, groundY - 10);
  ctx.hazard('LAVA_PIT', CX + 20, groundY - 10);

  // Upper obsidian turret
  b(CX - 30, bridgeY - 6 - 45 / 2, 14, 45, 'OBSIDIAN');
  b(CX + 30, bridgeY - 6 - 45 / 2, 14, 45, 'OBSIDIAN');
  const topY = bridgeY - 6 - 45 - 6;
  b(CX, topY, 80, 12, 'OBSIDIAN');

  // Side watchtower
  const SX = 850;
  b(SX, groundY - 50 / 2, 14, 50, 'STONE');
  b(SX + 55, groundY - 50 / 2, 14, 50, 'STONE');
  const sf = groundY - 50 - 6;
  b(SX + 27, sf, 75, 12, 'OBSIDIAN');

  ctx.barrel(CX, bridgeY - 6 - 18);
  ctx.barrel(SX + 27, groundY - 18);

  ctx.enemySlots.push(
    { x: CX - 50, y: bridgeY - 6 - eR },
    { x: CX + 50, y: bridgeY - 6 - eR },
    { x: CX, y: topY - 6 - eR },
    { x: SX + 27, y: sf - 6 - eR },
  );

  // Coins (~16g)
  ctx.coin(500, 310, 2);                    // approach — arc path
  ctx.coin(CX, topY - 30, 3);               // structure — above upper turret
  ctx.coin(SX + 27, sf - 30, 3);            // structure — above watchtower
  ctx.coin(CX - 20, groundY - 40, 4);       // risky — near lava vent
  ctx.coin(CX + 20, groundY - 40, 4);       // risky — near lava vent
};

// ─── "Inferno Watchtower" — tall obsidian tower with lava moat ──────────────
export const infernoWatchtower: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);
  const eR = 20;

  const TX = 600;
  const span = 100;

  // Level 1 — obsidian base
  b(TX, groundY - 65 / 2, 16, 65, 'OBSIDIAN');
  b(TX + span, groundY - 65 / 2, 16, 65, 'OBSIDIAN');
  const f1 = groundY - 65 - 6;
  b(TX + span / 2, f1, span + 30, 12, 'STONE');

  // Level 2 — wood interior (weak point)
  b(TX + 15, f1 - 6 - 50 / 2, 14, 50, 'WOOD');
  b(TX + span - 15, f1 - 6 - 50 / 2, 14, 50, 'WOOD');
  const f2 = f1 - 6 - 50 - 6;
  b(TX + span / 2, f2, span + 10, 12, 'OBSIDIAN');

  // Level 3 — cap
  b(TX + span / 2, f2 - 6 - 35 / 2, 14, 35, 'STONE');
  const f3 = f2 - 6 - 35 - 6;
  b(TX + span / 2, f3, 70, 12, 'OBSIDIAN');
  b(TX + span / 2, f3 - 6 - 14, 28, 28, 'OBSIDIAN');

  // Lava moat in front
  ctx.hazard('LAVA_PIT', TX - 40, groundY - 10);

  // Side rubble
  const SX = 810;
  b(SX, groundY - 35 / 2, 30, 35, 'STONE');
  b(SX + 45, groundY - 25 / 2, 24, 25, 'STONE');

  ctx.barrel(TX + span / 2, groundY - 18);
  ctx.barrel(TX + span / 2, f1 - 6 - 18);

  ctx.enemySlots.push(
    { x: TX + span / 2, y: f1 - 6 - eR },
    { x: TX + span / 2, y: f2 - 6 - eR },
    { x: TX + span / 2, y: f3 - 6 - 28 - eR },
    { x: SX + 20, y: groundY - eR },
  );

  // Coins (~15g)
  ctx.coin(480, 300, 2);                       // approach — arc path
  ctx.coin(TX + span / 2, f2 - 30, 3);         // structure — above level 2
  ctx.coin(TX + span / 2, f3 - 40, 3);         // structure — above tower cap
  ctx.coin(TX - 40, groundY - 40, 4);          // risky — near lava moat
  ctx.coin(SX + 20, groundY - 18, 3);          // structure — near side rubble
};

export const diff2Templates: TemplateFn[] = [
  demonGatehouse,
  lavaBridge,
  obsidianPillbox,
  hellScaffold,
  cinderHut,
  ashBarricade,
  magmaVent,
  infernoWatchtower,
];
