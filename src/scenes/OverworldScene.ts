import Phaser from 'phaser';
import nodesData from '@/data/nodes.json';
import type { MusicSystem } from '@/systems/MusicSystem';
import { newRun, getRunState, hasRunState, selectNode, loadRun, clearSave, reorderSquad, advanceFloor, isRunFullyComplete, getCurrentFloorDisplay, getHeroesOnCooldown, consumePendingRegen, applyAndStoreRegen, type NodeDef, type RelicDef } from '@/systems/RunState';
import { GAME_WIDTH, GAME_HEIGHT, HERO_STATS, SAFE_AREA_LEFT } from '@/config/constants';
import type { HeroClass } from '@/config/constants';
import { getMapById } from '@/data/maps/index';
import { finalizeRun, getGlobalStats } from '@/systems/RunHistory';
import { getShards, calcShardsEarned, earnShards, getMetaBonuses } from '@/systems/MetaState';
import { calculateRunScore } from '@/systems/ScoreSystem';
import { buildSettingsGear, buildCurrencyBar, type CurrencyBarResult } from '@/ui/TopBar';
import { createRelicIcon } from '@/ui/RelicIcon';
import { Hero } from '@/entities/Hero';
import { getAscensionModifiers, getAscensionShardMult } from '@/systems/AscensionSystem';

const MAP_SPREAD = 2.0;       // Horizontal spread factor for node positions
const MAP_PADDING_X = 200;    // World padding beyond outermost nodes

const NODE_RADIUS = 26;
const NODE_COLORS: Record<string, number> = {
  BATTLE: 0xe74c3c,
  ELITE:  0x8e44ad,
  REWARD: 0xf1c40f,
  SHOP:   0x27ae60,
  BOSS:   0xc0392b,
  EVENT:  0x9b59b6,
  FORGE:  0xe67e22,
  REST:   0x2ecc71,
  TREASURE: 0xffd700,
};
const NODE_ICONS: Record<string, string> = {
  BATTLE: '⚔',
  ELITE:  '★',
  REWARD: '◆',
  SHOP:   '●',
  BOSS:   '☠',
  EVENT:  '?',
  FORGE:  '⚒',
  REST:   '\u2665',
  TREASURE: '◆',
};
const RARITY_COLOR: Record<string, string> = {
  common:   '#95a5a6',
  uncommon: '#2ecc71',
  rare:     '#9b59b6',
};
const RARITY_HEX: Record<string, number> = {
  common:   0x95a5a6,
  uncommon: 0x2ecc71,
  rare:     0x9b59b6,
  curse:    0xe74c3c,
};
const RARITY_ICON: Record<string, string> = {
  common:   '●',
  uncommon: '◆',
  rare:     '★',
  curse:    '☠',
};

// ── Biome color palettes ─────────────────────────────────────────────────────
// Shared base
const TERRAIN_GREEN   = 0x1e4416;
const TERRAIN_DARK    = 0x142e0e;
const TERRAIN_LIGHT   = 0x3a6a24;
const ROAD_COLOR      = 0x8a7a5a;
const ROAD_BORDER     = 0x6a5a3a;

// Goblin Wastes accents
const GW_CANOPY    = 0x1e4018;
const GW_DEAD_TREE = 0x4a3a2a;
const GW_SWAMP     = 0x2a4a3a;
const GW_RUIN      = 0x6a6a5a;

// Frozen Peaks accents
const FP_SNOW  = 0xd8e8f0;
const FP_ICE   = 0x7aaaca;
const FP_PINE  = 0x1a3a2a;
const FP_ROCK  = 0x6a7a8a;

// Infernal Keep accents
const IK_LAVA     = 0xcc4422;
const IK_CHAR     = 0x2a1a1a;
const IK_EMBER    = 0xff8844;
const IK_FORTRESS = 0x4a3a3a;

/** Visual state of a node from the player's perspective */
type NodeState = 'completed' | 'available' | 'locked' | 'future';

// ─── Party panel content ───────────────────────────────────────────────────────
const HERO_DESCS: Partial<Record<string, string>> = {
  WARRIOR: 'Frontline bruiser. Smashes through walls and trades blows at melee range.',
  RANGER:  'Bouncy archer. Fires a spread of arrows at nearby enemies each time it lands.',
  MAGE:    'Area nuker. Creates a massive explosion on landing that hits all nearby enemies.',
  PRIEST:  'Holy healer. Pulses a healing aura to nearby allies on each landing.',
  BARD:    'Support trickster. Charms nearby enemies and boosts ally attack speed.',
};
const HERO_KEY_STAT: Partial<Record<string, string>> = {
  WARRIOR: '×1.4 vs structures',
  RANGER:  '3 arrows / bounce',
  MAGE:    '150 px blast radius',
  PRIEST:  '25 HP heal aura',
  BARD:    '20% speed aura',
};

export class OverworldScene extends Phaser.Scene {
  private nodeMap: NodeDef[] = [];

  private pathLayer!: Phaser.GameObjects.Graphics;
  private nodeContainers: Map<number, Phaser.GameObjects.Container> = new Map();
  private nodeGlows: Map<number, Phaser.GameObjects.Graphics> = new Map();
  private pulseTime = 0;

  private _goldBar: CurrencyBarResult | null = null;
  private relicRow!: Phaser.GameObjects.Container;
  private tooltip!: Phaser.GameObjects.Container;
  /** Tracks which node was last tapped on touch — used for two-tap confirm. */
  private touchSelectedNodeId: number | null = null;

  // Relic detail popup
  private relicDetailPanel: Phaser.GameObjects.Container | null = null;
  private relicDetailVeil:  Phaser.GameObjects.Rectangle | null = null;

  // Party management panel
  private partyPanel:    Phaser.GameObjects.Container | null = null;
  private partyVeil:     Phaser.GameObjects.Rectangle | null = null;
  private squadPreviewCt!: Phaser.GameObjects.Container;

  // Horizontal scroll
  private worldWidth = GAME_WIDTH;
  private _scrollDrag: { startX: number; startScroll: number; moved: boolean } | null = null;

  // ── Visual overhaul fields ──────────────────────────────────────────────────
  // Hero party sprites on map
  private heroSprites: Phaser.GameObjects.Sprite[] = [];
  private heroCdLabels: Phaser.GameObjects.Text[] = [];

  // Path flow particles
  private pathParticles: { gfx: Phaser.GameObjects.Graphics; t: number; fromX: number; fromY: number; toX: number; toY: number; duration: number; color: number; elapsed: number }[] = [];
  private pathParticleTimer = 0;

  // Themed ambient particles
  private ambientParticles: { gfx: Phaser.GameObjects.Graphics; x: number; y: number; vx: number; vy: number; life: number; maxLife: number; phase: number }[] = [];
  private ambientTimer = 0;

  // Boss node effects
  private bossAura: Phaser.GameObjects.Graphics | null = null;
  private bossRing: Phaser.GameObjects.Graphics | null = null;
  private bossNodePos: { x: number; y: number } | null = null;
  private bossParticles: { gfx: Phaser.GameObjects.Graphics; x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[] = [];
  private bossParticleTimer = 0;

  // Active node beacons
  private nodeBeacons: Map<number, Phaser.GameObjects.Graphics> = new Map();

  // Entrance animation timing (ms until nodes/paths are done animating)
  private entranceDelay = 0;

  // Completed path segments for particle spawning
  private completedPathSegments: { fromX: number; fromY: number; toX: number; toY: number }[] = [];
  private availablePathSegments: { fromX: number; fromY: number; toX: number; toY: number }[] = [];

  // Current map theme (for ambient particles)
  private currentTheme: { particle: 'firefly' | 'snowflake' | 'ember'; particleColors: number[] } = { particle: 'firefly', particleColors: [0x88ff88] };

  constructor() {
    super({ key: 'OverworldScene' });
  }

  create(data?: { fromBattle?: boolean }) {
    (this.registry.get('music') as MusicSystem | null)?.play('map');
    this.nodeContainers.clear();
    this.nodeGlows.clear();
    this.nodeBeacons.clear();
    this.heroSprites = [];
    this.heroCdLabels = [];
    this.pathParticles = [];
    this.pathParticleTimer = 0;
    this.ambientParticles = [];
    this.ambientTimer = 0;
    this.bossAura = null;
    this.bossRing = null;
    this.bossNodePos = null;
    this.bossParticles = [];
    this.bossParticleTimer = 0;
    this.pulseTime = 0;

    if (!hasRunState()) {
      if (!loadRun()) {
        const nodes = nodesData.nodes as NodeDef[];
        newRun(nodes, ['WARRIOR', 'RANGER', 'MAGE', 'PRIEST'] as HeroClass[]);
      }
    }

    const run = getRunState();
    // Use map-specific node data from the run state
    this.nodeMap = run.nodeMap;

    // Compute world width from node positions (spread factor applied)
    const maxNodeX = Math.max(...this.nodeMap.map(n => n.x));
    this.worldWidth = Math.max(GAME_WIDTH, maxNodeX * MAP_SPREAD + MAP_PADDING_X);

    this.buildBackground();
    this.buildMapTitle();

    this.pathLayer = this.add.graphics().setDepth(2);
    this.drawPaths();
    this.buildTooltip();
    this.buildNodes();
    this.buildHeroParty();
    this.buildHUD();
    this.buildSquadPreview();
    buildSettingsGear(this, 'OverworldScene', 30, SAFE_AREA_LEFT).setScrollFactor(0);

    // Camera bounds + initial scroll position
    this.cameras.main.setBounds(0, 0, this.worldWidth, GAME_HEIGHT);
    this.centerCameraOnActiveNode(false); // instant snap, no tween

    this.cameras.main.fadeIn(300, 0, 0, 0);

    this.events.on('resume', () => {
      this._goldBar?.updateValue();
    });

    // ── Scroll input ──────────────────────────────────────────────────────────
    // Mouse wheel scrolls map horizontally (blocked when overlay/panel is open)
    this.input.on('wheel', (_ptr: Phaser.Input.Pointer, _objs: Phaser.GameObjects.GameObject[], _dx: number, deltaY: number) => {
      if (this.partyPanel || this.relicDetailPanel || this.partyVeil || this.relicDetailVeil) return;
      const cam = this.cameras.main;
      cam.scrollX = Phaser.Math.Clamp(
        cam.scrollX + deltaY * 0.5,
        0, this.worldWidth - GAME_WIDTH,
      );
    });

    // Touch/mouse drag from empty space scrolls map
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer, hit: Phaser.GameObjects.GameObject[]) => {
      if (hit.length === 0) {
        this._scrollDrag = { startX: ptr.x, startScroll: this.cameras.main.scrollX, moved: false };
        this.clearTouchSelection();
      }
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!this._scrollDrag || !ptr.isDown) return;
      const dx = ptr.x - this._scrollDrag.startX;
      if (Math.abs(dx) > 5) this._scrollDrag.moved = true;
      if (this._scrollDrag.moved) {
        this.cameras.main.scrollX = Phaser.Math.Clamp(
          this._scrollDrag.startScroll - dx,
          0, this.worldWidth - GAME_WIDTH,
        );
      }
    });
    this.input.on('pointerup', () => { this._scrollDrag = null; });

    // Floor/Run complete detection
    const floorDone = this.isRunComplete();
    if (floorDone) {
      if (isRunFullyComplete()) {
        // All floors done — final run complete overlay
        this.time.delayedCall(400, () => this.buildRunCompleteOverlay());
      } else {
        // Current floor done but more floors remain
        this.time.delayedCall(400, () => this.buildFloorCompleteOverlay());
      }
    } else if (data?.fromBattle !== undefined) {
      if (data.fromBattle) {
        this.centerCameraOnActiveNode(true); // animated pan after battle
        // Apply regen on the map so the player sees health bars increase
        applyAndStoreRegen();
      }
      this.showAvailableGlow();
      // Show regen floating text on squad preview after a short delay
      this.time.delayedCall(500, () => this.showRegenFeedback());
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private worldX(x: number): number { return x * MAP_SPREAD; }

  private getNodeState(nodeId: number): NodeState {
    const run = getRunState();
    if (run.completedNodeIds.has(nodeId)) return 'completed';
    if (run.lockedNodeIds.has(nodeId))    return 'locked';
    if (run.availableNodeIds.has(nodeId)) return 'available';
    return 'future';
  }

  private isRunComplete(): boolean {
    const run = getRunState();
    // Complete when no non-locked, non-completed node exists in available
    const hasActive = [...run.availableNodeIds].some(
      id => !run.completedNodeIds.has(id) && !run.lockedNodeIds.has(id),
    );
    return !hasActive && run.completedNodeIds.size > 0;
  }

  private formatEnemies(enemies: string[]): string {
    const counts: Record<string, number> = {};
    for (const e of enemies) counts[e] = (counts[e] || 0) + 1;
    return Object.entries(counts)
      .map(([k, v]) => `${v}× ${k[0] + k.slice(1).toLowerCase()}`)
      .join('  ');
  }

  // ── Background ─────────────────────────────────────────────────────────────
  private buildBackground() {
    const bg = this.add.graphics().setDepth(0);
    const run = getRunState();
    const mapId = run.currentMapId;

    // Set particle theme
    const particleThemes: Record<string, { particle: 'firefly' | 'snowflake' | 'ember'; particleColors: number[] }> = {
      goblin_wastes:  { particle: 'firefly',   particleColors: [0x66cc66, 0x55aa55, 0x88cc66] },
      frozen_peaks:   { particle: 'snowflake', particleColors: [0xeeeeff, 0xddeeff, 0xffffff] },
      infernal_keep:  { particle: 'ember',     particleColors: [0xff8844, 0xff6622, 0xffaa33] },
    };
    this.currentTheme = particleThemes[mapId] ?? particleThemes.goblin_wastes;

    // 1. Base ground fill (gradient per biome)
    this.drawBaseGround(bg, mapId);

    // 2. Biome-specific terrain features
    this.drawTerrain(bg, mapId);

    // 3. Node clearings — lighter spots around each node position
    this.drawNodeClearings(bg);

    // 4. Edge vignette (biome-tinted)
    const vignetteColors: Record<string, number> = {
      goblin_wastes: 0x0a1a08,
      frozen_peaks:  0x0a1a2a,
      infernal_keep: 0x1a0808,
    };
    const vc = vignetteColors[mapId] ?? 0x0a1a08;
    const fog = this.add.graphics().setDepth(1).setScrollFactor(0);
    fog.fillGradientStyle(vc, vc, vc, vc, 0.6, 0.6, 0, 0);
    fog.fillRect(0, 0, 180, GAME_HEIGHT);
    fog.fillGradientStyle(vc, vc, vc, vc, 0, 0, 0.6, 0.6);
    fog.fillRect(GAME_WIDTH - 180, 0, 180, GAME_HEIGHT);
    fog.fillGradientStyle(vc, vc, vc, vc, 0.65, 0.65, 0, 0);
    fog.fillRect(0, 0, GAME_WIDTH, 60);
    fog.fillGradientStyle(vc, vc, vc, vc, 0, 0, 0.55, 0.55);
    fog.fillRect(0, GAME_HEIGHT - 60, GAME_WIDTH, 60);
  }

  // ── Base ground fill ─────────────────────────────────────────────────────
  private drawBaseGround(bg: Phaser.GameObjects.Graphics, mapId: string) {
    const W = this.worldWidth;
    const H = GAME_HEIGHT;
    const topH = Math.round(H * 0.3);
    const botH = H - topH;

    if (mapId === 'frozen_peaks') {
      // Sky: pale blue-grey to snow white
      bg.fillGradientStyle(0x5a7a9a, 0x5a7a9a, 0xc8d8e8, 0xc8d8e8);
      bg.fillRect(0, 0, W, topH);
      // Terrain: snowy
      bg.fillGradientStyle(0xb0c8d8, 0xb0c8d8, 0x8aa8b8, 0x8aa8b8);
      bg.fillRect(0, topH, W, botH);
      // Variation band
      bg.fillStyle(0x9ab8c8, 0.3);
      bg.fillRect(0, topH + botH * 0.4, W, botH * 0.15);
    } else if (mapId === 'infernal_keep') {
      // Sky: smoky dark red
      bg.fillGradientStyle(0x2a1008, 0x2a1008, 0x2a1a1a, 0x2a1a1a);
      bg.fillRect(0, 0, W, topH);
      // Terrain: dark volcanic
      bg.fillGradientStyle(0x1a1210, 0x1a1210, 0x120c08, 0x120c08);
      bg.fillRect(0, topH, W, botH);
      // Ashen variation
      bg.fillStyle(0x2a1a10, 0.3);
      bg.fillRect(0, topH + botH * 0.3, W, botH * 0.2);
    } else {
      // Goblin Wastes
      // Sky: dark mossy green to canopy
      bg.fillGradientStyle(0x1e3a28, 0x1e3a28, 0x1a3416, 0x1a3416);
      bg.fillRect(0, 0, W, topH);
      // Terrain: rich green
      bg.fillGradientStyle(TERRAIN_GREEN, TERRAIN_GREEN, TERRAIN_DARK, TERRAIN_DARK);
      bg.fillRect(0, topH, W, botH);
      // Variation band
      bg.fillStyle(0x1a3a14, 0.2);
      bg.fillRect(0, topH + botH * 0.35, W, botH * 0.15);
    }
  }

  // ── Node clearings ──────────────────────────────────────────────────────
  private drawNodeClearings(bg: Phaser.GameObjects.Graphics) {
    const run = getRunState();
    const mapId = run.currentMapId;

    // Biome-appropriate clearing colors
    let clearOuter: number, clearInner: number, bossClear: number;
    if (mapId === 'frozen_peaks') {
      clearOuter = 0xc8dce8; // bright snow
      clearInner = 0xd8e8f0;
      bossClear  = 0x4a5a6a; // dark icy
    } else if (mapId === 'infernal_keep') {
      clearOuter = 0x2a2018; // ashen ground
      clearInner = 0x3a2a1a;
      bossClear  = 0x3a1010; // dark red
    } else {
      clearOuter = TERRAIN_LIGHT;
      clearInner = TERRAIN_LIGHT;
      bossClear  = 0x3a2020;
    }

    for (const node of this.nodeMap) {
      const nx = this.worldX(node.x);
      const ny = node.y;
      const isBoss = node.type === 'BOSS';
      const radius = isBoss ? 80 : 55;

      // Outer soft glow (larger, more transparent)
      bg.fillStyle(clearOuter, 0.2);
      bg.fillCircle(nx, ny, radius + 15);

      // Inner clearing
      bg.fillStyle(isBoss ? bossClear : clearInner, 0.4);
      bg.fillCircle(nx, ny, radius);
    }
  }

  // ── Node proximity check for terrain avoidance ──────────────────────────
  private isNearNode(x: number, y: number, minDist: number): boolean {
    for (const node of this.nodeMap) {
      const nx = this.worldX(node.x);
      const ny = node.y;
      const dx = x - nx;
      const dy = y - ny;
      if (dx * dx + dy * dy < minDist * minDist) return true;
    }
    return false;
  }

  // ── Terrain drawing per map theme ─────────────────────────────────────────
  private drawTerrain(g: Phaser.GameObjects.Graphics, mapId: string) {
    // Seeded RNG for consistent terrain placement
    let seed = 0;
    for (let i = 0; i < mapId.length; i++) seed = (seed * 31 + mapId.charCodeAt(i)) | 0;
    const rand = () => { seed = (seed * 16807 + 11) % 2147483647; return (seed & 0x7fffffff) / 0x7fffffff; };

    const W = this.worldWidth;
    const H = GAME_HEIGHT;

    if (mapId === 'frozen_peaks') {
      this.drawFrozenPeaks(g, rand, W, H);
    } else if (mapId === 'infernal_keep') {
      this.drawInfernalKeep(g, rand, W, H);
    } else {
      this.drawGoblinWastes(g, rand, W, H);
    }
  }

  private drawGoblinWastes(g: Phaser.GameObjects.Graphics, rand: () => number, W: number, H: number) {
    const NODE_CLEAR = 70;

    // Dense tree canopy clusters — ellipses for 3/4 perspective
    for (let i = 0; i < 65; i++) {
      const cx = rand() * W;
      const cy = rand() * H;
      if (this.isNearNode(cx, cy, NODE_CLEAR)) continue;
      const count = 3 + Math.floor(rand() * 4); // 3-6 per cluster
      for (let j = 0; j < count; j++) {
        const ox = (rand() - 0.5) * 40;
        const oy = (rand() - 0.5) * 25;
        const rw = 22 + rand() * 28;  // wider than tall
        const rh = rw * (0.5 + rand() * 0.15); // squash 50-65% for perspective
        const greenVar = Math.floor(rand() * 3);
        const colors = [GW_CANOPY, 0x1e4a18, 0x1a3c14];
        // Dark shadow underneath for depth
        g.fillStyle(0x0a1a08, 0.3);
        g.fillEllipse(cx + ox + 2, cy + oy + rh * 0.2, rw * 0.9, rh * 0.7);
        // Canopy
        g.fillStyle(colors[greenVar], 0.35 + rand() * 0.2);
        g.fillEllipse(cx + ox, cy + oy, rw, rh);
      }
    }

    // Dead trees
    for (let i = 0; i < 12; i++) {
      const tx = rand() * W;
      const ty = 80 + rand() * (H - 160);
      if (this.isNearNode(tx, ty, NODE_CLEAR)) continue;
      const th = 30 + rand() * 50;
      const tw = 2 + rand() * 2;
      g.fillStyle(GW_DEAD_TREE, 0.6);
      g.fillRect(tx - tw / 2, ty - th, tw, th);
      // Bare branches
      const bw = 10 + rand() * 16;
      g.lineStyle(1.5, GW_DEAD_TREE, 0.5);
      g.lineBetween(tx, ty - th * 0.7, tx - bw, ty - th * 0.9 - rand() * 12);
      g.lineBetween(tx, ty - th * 0.5, tx + bw, ty - th * 0.7 - rand() * 10);
      if (rand() > 0.4) g.lineBetween(tx, ty - th * 0.85, tx + bw * 0.5, ty - th - rand() * 10);
    }

    // Swamp pools
    for (let i = 0; i < 7; i++) {
      const px = 100 + rand() * (W - 200);
      const py = 150 + rand() * (H - 300);
      if (this.isNearNode(px, py, NODE_CLEAR - 10)) continue;
      const sw = 40 + rand() * 65;
      const sh = 15 + rand() * 22;
      g.fillStyle(GW_SWAMP, 0.45);
      g.fillEllipse(px, py, sw, sh);
      // Water sheen highlight
      g.fillStyle(0x3a6a4a, 0.15);
      g.fillEllipse(px - sw * 0.1, py - sh * 0.15, sw * 0.6, sh * 0.5);
    }

    // Ruins/stone fragments
    for (let i = 0; i < 5; i++) {
      const rx = 120 + rand() * (W - 240);
      const ry = 120 + rand() * (H - 240);
      if (this.isNearNode(rx, ry, NODE_CLEAR)) continue;
      g.fillStyle(GW_RUIN, 0.35);
      const rw = 8 + rand() * 12;
      const rh = 14 + rand() * 20;
      g.fillRect(rx, ry, rw, rh);
      // L-shaped fragment
      if (rand() > 0.5) {
        g.fillRect(rx + rw, ry + rh - 6, rw * 0.6, 6);
      }
    }

    // Grass tufts (scattered across clearings)
    for (let i = 0; i < 35; i++) {
      const gx = rand() * W;
      const gy = rand() * H;
      g.lineStyle(1, 0x3a8a2a, 0.3);
      const tufts = 2 + Math.floor(rand() * 3);
      for (let t = 0; t < tufts; t++) {
        const ox = (rand() - 0.5) * 6;
        g.lineBetween(gx + ox, gy, gx + ox + (rand() - 0.5) * 3, gy - 5 - rand() * 6);
      }
    }
  }

  private drawFrozenPeaks(g: Phaser.GameObjects.Graphics, rand: () => number, W: number, H: number) {
    const NODE_CLEAR = 70;

    // Mountain ridges (large triangular peaks) — top and bottom thirds
    for (let i = 0; i < 8; i++) {
      const mx = rand() * W;
      const my = rand() < 0.5 ? rand() * H * 0.3 : H - rand() * H * 0.3;
      const mw = 80 + rand() * 120;
      const mh = 60 + rand() * 100;
      // Rock body
      g.fillStyle(FP_ROCK, 0.6);
      g.fillTriangle(mx, my - mh, mx - mw, my, mx + mw, my);
      // Shadow side
      g.fillStyle(0x5a6a7a, 0.3);
      g.fillTriangle(mx, my - mh, mx - mw, my, mx - mw * 0.3, my);
      // Snow cap
      g.fillStyle(FP_SNOW, 0.7);
      const capH = mh * 0.3;
      const capW = mw * 0.35;
      g.fillTriangle(mx, my - mh, mx - capW, my - mh + capH, mx + capW, my - mh + capH);
    }

    // Pine forest clusters
    for (let i = 0; i < 50; i++) {
      const tx = rand() * W;
      const ty = 100 + rand() * (H - 200);
      if (this.isNearNode(tx, ty, NODE_CLEAR)) continue;
      const th = 15 + rand() * 25;
      const tw = 6 + rand() * 8;
      g.fillStyle(FP_PINE, 0.6 + rand() * 0.2);
      g.fillTriangle(tx, ty - th, tx - tw, ty, tx + tw, ty);
      // Second tier
      g.fillTriangle(tx, ty - th * 0.7, tx - tw * 0.75, ty - th * 0.1, tx + tw * 0.75, ty - th * 0.1);
    }

    // Snow drifts
    for (let i = 0; i < 10; i++) {
      const dx = rand() * W;
      const dy = 100 + rand() * (H - 200);
      g.fillStyle(FP_SNOW, 0.35);
      g.fillEllipse(dx, dy, 60 + rand() * 100, 12 + rand() * 15);
    }

    // Frozen river (one winding path)
    g.lineStyle(10, FP_ICE, 0.35);
    g.beginPath();
    let rx = W * 0.2 + rand() * W * 0.2;
    g.moveTo(rx, -10);
    for (let y = 0; y < H + 20; y += 40) {
      rx += (rand() - 0.5) * 100;
      rx = Phaser.Math.Clamp(rx, 50, W - 50);
      g.lineTo(rx, y);
    }
    g.strokePath();
    // Brighter center line
    g.lineStyle(4, 0x9acaea, 0.25);
    g.beginPath();
    rx = W * 0.2 + rand() * W * 0.2;
    g.moveTo(rx, -10);
    for (let y = 0; y < H + 20; y += 40) {
      rx += (rand() - 0.5) * 100;
      rx = Phaser.Math.Clamp(rx, 50, W - 50);
      g.lineTo(rx, y);
    }
    g.strokePath();

    // Ice crystal formations
    for (let i = 0; i < 5; i++) {
      const cx = 100 + rand() * (W - 200);
      const cy = 120 + rand() * (H - 240);
      if (this.isNearNode(cx, cy, NODE_CLEAR)) continue;
      const cs = 8 + rand() * 14;
      g.fillStyle(FP_ICE, 0.4);
      g.fillTriangle(cx, cy - cs, cx - cs * 0.4, cy + cs * 0.3, cx + cs * 0.4, cy + cs * 0.3);
      g.fillTriangle(cx - cs * 0.2, cy - cs * 0.2, cx + cs * 0.5, cy - cs * 0.1, cx + cs * 0.1, cy + cs * 0.5);
    }
  }

  private drawInfernalKeep(g: Phaser.GameObjects.Graphics, rand: () => number, W: number, H: number) {
    const NODE_CLEAR = 70;

    // Volcanic rocks/crags
    for (let i = 0; i < 25; i++) {
      const cx = rand() * W;
      const cy = rand() * H;
      if (this.isNearNode(cx, cy, NODE_CLEAR)) continue;
      const sides = 3 + Math.floor(rand() * 3);
      const size = 10 + rand() * 25;
      g.fillStyle(IK_CHAR, 0.7);
      const pts: { x: number; y: number }[] = [];
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2 + rand() * 0.5;
        const r = size * (0.6 + rand() * 0.4);
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      g.fillPoints(pts, true);
    }

    // Lava rivers (2-3 winding bands)
    for (let r = 0; r < 3; r++) {
      g.lineStyle(6, IK_LAVA, 0.3);
      g.beginPath();
      let lx = rand() * W;
      g.moveTo(lx, -10);
      for (let y = 0; y < H + 20; y += 50) {
        lx += (rand() - 0.5) * 140;
        lx = Phaser.Math.Clamp(lx, 30, W - 30);
        g.lineTo(lx, y);
      }
      g.strokePath();
      // Bright ember core
      g.lineStyle(2.5, IK_EMBER, 0.2);
      g.beginPath();
      lx = rand() * W;
      g.moveTo(lx, -10);
      for (let y = 0; y < H + 20; y += 50) {
        lx += (rand() - 0.5) * 140;
        lx = Phaser.Math.Clamp(lx, 30, W - 30);
        g.lineTo(lx, y);
      }
      g.strokePath();
    }

    // Fortress wall segments
    for (let i = 0; i < 4; i++) {
      const fx = 100 + rand() * (W - 200);
      const fy = 100 + rand() * (H - 200);
      if (this.isNearNode(fx, fy, NODE_CLEAR + 20)) continue;
      const fw = 50 + rand() * 80;
      const angle = rand() * Math.PI * 0.5 - Math.PI * 0.25;
      g.lineStyle(4, IK_FORTRESS, 0.5);
      const ex = fx + Math.cos(angle) * fw;
      const ey = fy + Math.sin(angle) * fw;
      g.lineBetween(fx, fy, ex, ey);
      // Tower dots at corners
      g.fillStyle(IK_FORTRESS, 0.6);
      g.fillCircle(fx, fy, 5);
      g.fillCircle(ex, ey, 5);
    }

    // Large fortress outline near boss node (right side)
    const bossNode = this.nodeMap.find(n => n.type === 'BOSS');
    if (bossNode) {
      const bx = this.worldX(bossNode.x);
      const by = bossNode.y;
      g.lineStyle(3, IK_FORTRESS, 0.4);
      g.strokeRect(bx - 60, by - 50, 120, 100);
      // Corner towers
      g.fillStyle(IK_FORTRESS, 0.5);
      g.fillCircle(bx - 60, by - 50, 6);
      g.fillCircle(bx + 60, by - 50, 6);
      g.fillCircle(bx - 60, by + 50, 6);
      g.fillCircle(bx + 60, by + 50, 6);
    }

    // Ground cracks
    for (let i = 0; i < 18; i++) {
      const cx = rand() * W;
      const cy = 100 + rand() * (H - 200);
      const len = 25 + rand() * 50;
      const angle = rand() * Math.PI;
      g.lineStyle(1.5, IK_LAVA, 0.18);
      g.lineBetween(cx, cy, cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
      // Branch
      const bx = cx + Math.cos(angle) * len * 0.5;
      const by = cy + Math.sin(angle) * len * 0.5;
      const ba = angle + (rand() - 0.5) * 1.2;
      g.lineBetween(bx, by, bx + Math.cos(ba) * len * 0.35, by + Math.sin(ba) * len * 0.35);
    }

    // Ash/char patches
    for (let i = 0; i < 12; i++) {
      const ax = rand() * W;
      const ay = rand() * H;
      g.fillStyle(IK_CHAR, 0.25);
      const dots = 5 + Math.floor(rand() * 8);
      for (let d = 0; d < dots; d++) {
        g.fillCircle(ax + (rand() - 0.5) * 30, ay + (rand() - 0.5) * 20, 1 + rand() * 2);
      }
    }

    // Flame symbols (teardrop shapes near lava)
    for (let i = 0; i < 5; i++) {
      const fx = rand() * W;
      const fy = 100 + rand() * (H - 200);
      if (this.isNearNode(fx, fy, NODE_CLEAR)) continue;
      const sz = 6 + rand() * 8;
      g.fillStyle(IK_EMBER, 0.25);
      g.fillCircle(fx, fy, sz * 0.5);
      g.fillTriangle(fx - sz * 0.4, fy, fx + sz * 0.4, fy, fx, fy - sz);
    }
  }

  private buildMapTitle() {
    const run = getRunState();
    const mapDef = getMapById(run.currentMapId);
    const title = mapDef?.name ?? nodesData.name;

    const titleBg = this.add.graphics().setDepth(9).setScrollFactor(0);
    titleBg.fillStyle(0x000000, 0.65);
    titleBg.fillRect(0, 0, GAME_WIDTH, 52);
    titleBg.lineStyle(1, 0xc0a060, 0.25);
    titleBg.lineBetween(0, 52, GAME_WIDTH, 52);

    this.add.text(GAME_WIDTH / 2, 26, title.toUpperCase(), {
      fontSize: '20px', fontFamily: 'Nunito, sans-serif',
      color: '#c0a060', stroke: '#000', strokeThickness: 3, letterSpacing: 6,
    }).setOrigin(0.5).setDepth(10).setScrollFactor(0);

    // Floor label (right side of title bar)
    const floorLabel = run.totalFloors > 1 ? getCurrentFloorDisplay() : 'RUN 1';
    this.add.text(GAME_WIDTH - 20, 26, floorLabel, {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif', color: '#5a7a9a',
    }).setOrigin(1, 0.5).setDepth(10).setScrollFactor(0);
  }

  // ── Paths ──────────────────────────────────────────────────────────────────
  private drawPaths() {
    this.pathLayer.clear();
    this.completedPathSegments = [];
    this.availablePathSegments = [];

    for (const node of this.nodeMap) {
      for (const nextId of node.next) {
        const next = this.nodeMap.find(n => n.id === nextId);
        if (!next) continue;

        const fromState = this.getNodeState(node.id);
        const toState   = this.getNodeState(nextId);

        let color: number, alpha: number, thickness: number;
        let isCompleted = false;
        let isAvailable = false;

        if (fromState === 'locked' || toState === 'locked') {
          color = 0x3a2a1a; alpha = 0.25; thickness = 1;
        } else if (fromState === 'completed') {
          color = ROAD_COLOR; alpha = 0.8; thickness = 4;
          isCompleted = true;
        } else if (fromState === 'available') {
          color = ROAD_COLOR; alpha = 0.5; thickness = 3;
          isAvailable = true;
        } else {
          color = ROAD_BORDER; alpha = 0.3; thickness = 1.5;
        }

        const nx0 = this.worldX(node.x), nx1 = this.worldX(next.x);

        if (isCompleted) {
          // Road with darker border glow
          this.pathLayer.lineStyle(8, ROAD_BORDER, 0.3);
          this.pathLayer.lineBetween(nx0, node.y, nx1, next.y);
          this.pathLayer.lineStyle(thickness, color, alpha);
          this.pathLayer.lineBetween(nx0, node.y, nx1, next.y);
          this.completedPathSegments.push({ fromX: nx0, fromY: node.y, toX: nx1, toY: next.y });
        } else {
          // Dashed line
          const steps = 20;
          for (let i = 0; i < steps; i++) {
            if (i % 2 === 1) continue;
            const t0 = i / steps;
            const t1 = (i + 0.7) / steps;
            const x0 = Phaser.Math.Interpolation.Linear([nx0, nx1], t0);
            const y0 = Phaser.Math.Interpolation.Linear([node.y, next.y], t0);
            const x1 = Phaser.Math.Interpolation.Linear([nx0, nx1], t1);
            const y1 = Phaser.Math.Interpolation.Linear([node.y, next.y], t1);
            this.pathLayer.lineStyle(thickness, color, alpha);
            this.pathLayer.lineBetween(x0, y0, x1, y1);
          }
          if (isAvailable) {
            this.availablePathSegments.push({ fromX: nx0, fromY: node.y, toX: nx1, toY: next.y });
          }
        }
      }
    }
  }

  // ── Nodes ──────────────────────────────────────────────────────────────────
  private buildNodes() {
    // Build all nodes first
    const entranceNodes: { container: Phaser.GameObjects.Container; wx: number; targetAlpha: number }[] = [];

    for (const node of this.nodeMap) {
      const state = this.getNodeState(node.id);
      const container = this.add.container(this.worldX(node.x), node.y).setDepth(5);
      this.nodeContainers.set(node.id, container);

      this.buildNodeVisual(container, node, state);

      // Capture target alpha from buildNodeVisual (locked=0.7, future=0.8, others=1)
      const targetAlpha = container.alpha;
      container.setAlpha(0).setScale(0.7);

      entranceNodes.push({ container, wx: this.worldX(node.x), targetAlpha });

      // Completed nodes: no interaction
      if (state === 'completed') continue;

      const hitArea = new Phaser.Geom.Circle(0, 0, NODE_RADIUS + 16);
      container.setInteractive(hitArea, Phaser.Geom.Circle.Contains);

      if (state === 'available') {
        // Mouse: hover shows tooltip, click enters immediately
        container.on('pointerover', (ptr: Phaser.Input.Pointer) => {
          if (ptr.wasTouch) return;
          this.showTooltip(node, false);
          this.onNodeHover(node.id, true);
        });
        container.on('pointerout', (ptr: Phaser.Input.Pointer) => {
          if (ptr.wasTouch) return;
          this.hideTooltip();
          this.onNodeHover(node.id, false);
        });
        container.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
          if (ptr.wasTouch) {
            // Two-tap confirm: first tap previews, second tap enters
            if (this.touchSelectedNodeId === node.id && this.tooltip.visible) {
              this.clearTouchSelection();
              this.onNodeClick(node.id);
            } else {
              this.clearTouchSelection();
              this.touchSelectedNodeId = node.id;
              this.showTooltip(node, true);
              this.onNodeHover(node.id, true);
            }
          } else {
            this.onNodeClick(node.id);
          }
        });
      } else {
        // Locked / future: tap toggles tooltip (info only)
        container.on('pointerover', (ptr: Phaser.Input.Pointer) => {
          if (ptr.wasTouch) return;
          this.showTooltip(node, false);
        });
        container.on('pointerout', (ptr: Phaser.Input.Pointer) => {
          if (ptr.wasTouch) return;
          this.hideTooltip();
        });
        container.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
          if (!ptr.wasTouch) return;
          if (this.touchSelectedNodeId === node.id && this.tooltip.visible) {
            this.clearTouchSelection();
          } else {
            this.clearTouchSelection();
            this.touchSelectedNodeId = node.id;
            this.showTooltip(node, false);
          }
        });
      }
    }

    // Entrance stagger animation — left-to-right cascade
    entranceNodes.sort((a, b) => a.wx - b.wx);
    this.pathLayer.setAlpha(0);
    entranceNodes.forEach((entry, index) => {
      this.tweens.add({
        targets: entry.container,
        alpha: entry.targetAlpha, scaleX: 1, scaleY: 1,
        duration: 280,
        ease: 'Back.easeOut',
        delay: index * 50,
      });
    });
    // Fade in paths after last node arrives
    const pathDelay = entranceNodes.length * 50 + 280;
    this.entranceDelay = pathDelay;
    this.tweens.add({
      targets: this.pathLayer,
      alpha: 1,
      duration: 300,
      delay: pathDelay,
    });
  }

  // ── Hero party sprites on map ──────────────────────────────────────────────
  private buildHeroParty() {
    // Destroy previous sprites
    this.heroSprites.forEach(s => s.destroy());
    this.heroSprites = [];
    this.heroCdLabels.forEach(t => t.destroy());
    this.heroCdLabels = [];

    const run = getRunState();

    // Current position node: rightmost completed, or first node
    let currentNode = this.nodeMap[0];
    for (const id of run.completedNodeIds) {
      const n = this.nodeMap.find(nd => nd.id === id);
      if (n && n.x > currentNode.x) currentNode = n;
    }

    const baseX = this.worldX(currentNode.x) + 10;
    const baseY = currentNode.y + 55;
    const SPACING = 28;

    run.squad.forEach((h, i) => {
      const hx = baseX + i * SPACING;
      const hy = baseY;
      const charKey = h.heroClass.toLowerCase();
      const onCooldown = (h.reviveCooldown ?? 0) > 0;
      const targetAlpha = onCooldown ? 0.3 : 1.0;

      const sprite = this.add.sprite(hx, hy, `${charKey}_idle_1`)
        .setDepth(4)
        .setAlpha(0);

      // Play animation FIRST so frame dimensions are established
      try { sprite.play(`${charKey}_idle`); } catch { /* anim may not exist */ }

      // THEN set display size (scale is computed against the current anim frame)
      sprite.setDisplaySize(44, 44);
      const targetSX = sprite.scaleX;
      const targetSY = sprite.scaleY;
      sprite.setScale(targetSX * 0.5, targetSY * 0.5);

      if (onCooldown) {
        sprite.setTint(0x444444);
        // Red cooldown number above — starts hidden
        const cdLabel = this.add.text(hx, hy - 28, `${h.reviveCooldown}`, {
          fontSize: '14px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
          color: '#e74c3c', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(4).setAlpha(0);
        this.heroCdLabels.push(cdLabel);

        // Animate cooldown label in
        this.tweens.add({
          targets: cdLabel,
          alpha: 1,
          duration: 250,
          delay: this.entranceDelay + i * 60,
        });
      } else {
        // Apply class tint
        const classTint = Hero.CLASS_TINT[h.heroClass as HeroClass];
        if (classTint) sprite.setTint(classTint);
      }

      // Animate sprite in — stagger after nodes/paths finish
      this.tweens.add({
        targets: sprite,
        alpha: targetAlpha,
        scaleX: targetSX, scaleY: targetSY,
        duration: 300,
        ease: 'Back.easeOut',
        delay: this.entranceDelay + i * 60,
        onComplete: () => { sprite.setDisplaySize(44, 44); },
      });

      this.heroSprites.push(sprite);
    });
  }

  private clearTouchSelection() {
    if (this.touchSelectedNodeId !== null) {
      this.onNodeHover(this.touchSelectedNodeId, false);
      this.touchSelectedNodeId = null;
    }
    this.hideTooltip();
  }

  private buildNodeVisual(
    container: Phaser.GameObjects.Container,
    node: NodeDef,
    state: NodeState,
  ) {
    const baseColor = NODE_COLORS[node.type] ?? 0x555555;

    // ── Available ────────────────────────────────────────────────────────────
    if (state === 'available') {
      // Vertical light beacon behind node
      const beacon = this.add.graphics();
      beacon.fillStyle(baseColor, 0.14);
      beacon.fillTriangle(-12, 0, 12, 0, 0, -90);
      container.add(beacon);
      this.nodeBeacons.set(node.id, beacon);

      // Outer glow
      const glow = this.add.graphics();
      glow.fillStyle(baseColor, 0.35);
      glow.fillCircle(0, 0, NODE_RADIUS + 14);
      container.add(glow);
      this.nodeGlows.set(node.id, glow);

      // Boss node — dark aura + rotating danger ring
      if (node.type === 'BOSS') {
        // Dark aura (pulsing in update)
        const aura = this.add.graphics();
        aura.fillStyle(0x3a0000, 0.25);
        aura.fillCircle(0, 0, NODE_RADIUS + 22);
        container.add(aura);
        this.bossAura = aura;

        // Rotating danger ring (8 spokes)
        const ring = this.add.graphics();
        ring.lineStyle(2, 0xff2222, 0.7);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ring.lineBetween(
            Math.cos(a) * (NODE_RADIUS + 4), Math.sin(a) * (NODE_RADIUS + 4),
            Math.cos(a) * (NODE_RADIUS + 14), Math.sin(a) * (NODE_RADIUS + 14),
          );
        }
        container.add(ring);
        this.bossRing = ring;
        this.bossNodePos = { x: this.worldX(node.x), y: node.y };

        // Spiky border
        const circle = this.add.graphics();
        circle.fillStyle(baseColor, 1);
        circle.fillCircle(0, 0, NODE_RADIUS);
        circle.lineStyle(2, 0xff2222, 0.9);
        circle.strokeCircle(0, 0, NODE_RADIUS);
        container.add(circle);
      } else {
        const circle = this.add.graphics();
        // White ring glow behind the node for extra visibility
        circle.lineStyle(4, 0xffffff, 0.15);
        circle.strokeCircle(0, 0, NODE_RADIUS + 4);
        circle.fillStyle(baseColor, 1);
        circle.fillCircle(0, 0, NODE_RADIUS);
        circle.lineStyle(2, 0xffffff, 0.9);
        circle.strokeCircle(0, 0, NODE_RADIUS);
        container.add(circle);
      }

      // Top shine
      const shine = this.add.graphics();
      shine.fillStyle(0xffffff, 0.09);
      shine.fillEllipse(0, -NODE_RADIUS * 0.35, NODE_RADIUS * 1.2, NODE_RADIUS * 0.7);
      container.add(shine);

      // Icon
      container.add(this.add.text(0, -1, NODE_ICONS[node.type] ?? '?', {
        fontSize: '17px', color: '#ffffff', fontFamily: 'Nunito, sans-serif',
      }).setOrigin(0.5));

      // Name label
      container.add(this.add.text(0, NODE_RADIUS + 11, node.name, {
        fontSize: '16px', color: '#b8a870',
        fontFamily: 'Nunito, sans-serif', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5));

      // Type badge above
      const typeHex = '#' + baseColor.toString(16).padStart(6, '0');
      container.add(this.add.text(0, -NODE_RADIUS - 14, node.type, {
        fontSize: '14px', color: typeHex,
        fontFamily: 'Nunito, sans-serif', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5));

      // Difficulty pips
      if (node.difficulty && node.difficulty > 0) {
        for (let i = 0; i < node.difficulty; i++) {
          const pip = this.add.graphics();
          pip.fillStyle(0xe74c3c, 0.8);
          pip.fillCircle(
            -((node.difficulty - 1) * 6) / 2 + i * 6,
            NODE_RADIUS + 27, 2.5,
          );
          container.add(pip);
        }
      }
      return;
    }

    // ── Completed ────────────────────────────────────────────────────────────
    if (state === 'completed') {
      const circle = this.add.graphics();
      // Gold ring behind
      circle.lineStyle(2, 0xc0a060, 0.3);
      circle.strokeCircle(0, 0, NODE_RADIUS + 4);
      circle.fillStyle(0x2a3040, 1);
      circle.fillCircle(0, 0, NODE_RADIUS);
      circle.lineStyle(1, 0x556070, 0.5);
      circle.strokeCircle(0, 0, NODE_RADIUS);
      container.add(circle);

      container.add(this.add.text(0, -1, '\u2713', {
        fontSize: '18px', color: '#c0a060', fontFamily: 'Nunito, sans-serif',
      }).setOrigin(0.5));

      container.add(this.add.text(0, NODE_RADIUS + 11, node.name, {
        fontSize: '16px', color: '#556070',
        fontFamily: 'Nunito, sans-serif', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5));
      return;
    }

    // ── Locked (path not taken) ───────────────────────────────────────────
    if (state === 'locked') {
      const circle = this.add.graphics();
      circle.fillStyle(0x1a0f0f, 1);
      circle.fillCircle(0, 0, NODE_RADIUS);
      circle.lineStyle(1.5, 0x4a2a2a, 0.7);
      circle.strokeCircle(0, 0, NODE_RADIUS);
      // Diagonal strike-through
      circle.lineStyle(2, 0x6a2020, 0.55);
      const d = NODE_RADIUS * 0.65;
      circle.lineBetween(-d, -d, d, d);
      circle.lineBetween(d, -d, -d, d);
      container.add(circle);

      // Dim type icon (shows what you missed)
      container.add(this.add.text(0, -1, NODE_ICONS[node.type] ?? '?', {
        fontSize: '14px', color: '#4a3030', fontFamily: 'Nunito, sans-serif',
      }).setOrigin(0.5));

      // Name
      container.add(this.add.text(0, NODE_RADIUS + 11, node.name, {
        fontSize: '14px', color: '#4a3030',
        fontFamily: 'Nunito, sans-serif', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0.7));

      // Dim type badge so you can still see what it was
      const typeHex = '#' + (baseColor & 0x555555).toString(16).padStart(6, '0');
      container.add(this.add.text(0, -NODE_RADIUS - 13, node.type, {
        fontSize: '14px', color: typeHex,
        fontFamily: 'Nunito, sans-serif', stroke: '#000', strokeThickness: 1,
      }).setOrigin(0.5).setAlpha(0.5));

      container.setAlpha(0.7);
      return;
    }

    // ── Future (on active path, not yet reachable) ────────────────────────
    // state === 'future'
    const circle = this.add.graphics();
    circle.fillStyle(baseColor, 0.15);
    circle.fillCircle(0, 0, NODE_RADIUS);
    circle.lineStyle(1.5, baseColor, 0.45);
    circle.strokeCircle(0, 0, NODE_RADIUS);
    container.add(circle);

    // Icon — visible but muted
    container.add(this.add.text(0, -1, NODE_ICONS[node.type] ?? '?', {
      fontSize: '16px', color: '#' + baseColor.toString(16).padStart(6, '0'),
      fontFamily: 'Nunito, sans-serif',
    }).setOrigin(0.5).setAlpha(0.55));

    // Name
    container.add(this.add.text(0, NODE_RADIUS + 11, node.name, {
      fontSize: '16px', color: '#7a6840',
      fontFamily: 'Nunito, sans-serif', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0.75));

    // Type badge — clearly labeled so you can plan
    const typeHex = '#' + baseColor.toString(16).padStart(6, '0');
    container.add(this.add.text(0, -NODE_RADIUS - 13, node.type, {
      fontSize: '14px', color: typeHex,
      fontFamily: 'Nunito, sans-serif', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0.6));

    // Difficulty pips (dimmed)
    if (node.difficulty && node.difficulty > 0) {
      for (let i = 0; i < node.difficulty; i++) {
        const pip = this.add.graphics();
        pip.fillStyle(0xe74c3c, 0.4);
        pip.fillCircle(
          -((node.difficulty - 1) * 6) / 2 + i * 6,
          NODE_RADIUS + 27, 2.5,
        );
        container.add(pip);
      }
    }

    container.setAlpha(0.8);
  }

  // ── Tooltip ────────────────────────────────────────────────────────────────
  private buildTooltip() {
    this.tooltip = this.add.container(0, 0).setDepth(40).setVisible(false);
  }

  /**
   * @param node       Node to describe
   * @param showConfirm  If true (touch, available node) adds "Tap again to enter →" hint
   */
  private showTooltip(node: NodeDef, showConfirm: boolean) {
    this.tooltip.removeAll(true);

    const state = this.getNodeState(node.id);
    const lines: string[] = [];

    if (node.enemies && node.enemies.length > 0) lines.push(this.formatEnemies(node.enemies));
    if (node.gold && node.gold > 0)              lines.push(`◆ ${node.gold} reward`);
    if (node.type === 'REWARD') {
      const ascMods = getAscensionModifiers(getRunState().ascensionLevel);
      lines.push(ascMods.noFreeRelics ? 'Spend gold on relics' : 'Free relic pick');
    }
    if (node.type === 'SHOP')                    lines.push('Spend gold on relics');
    if (node.type === 'EVENT')                   lines.push('Random encounter — choose wisely');
    if (node.type === 'FORGE')                   lines.push('Upgrade, fuse, or purge relics');
    if (node.type === 'REST')                    lines.push('Heal your squad or rally fallen heroes');
    if (node.difficulty && node.difficulty > 0) {
      const stars = '★'.repeat(node.difficulty) + '☆'.repeat(5 - node.difficulty);
      lines.push(`Threat  ${stars}`);
    }
    if (state === 'locked') lines.push('— Path not taken —');

    const padX = 10, padY = 8, lineH = 18;
    const ttW = 240;
    // Extra height for confirm hint
    const confirmH = showConfirm ? lineH + 6 : 0;
    const ttH = padY * 2 + lineH + (lines.length > 0 ? 4 + lines.length * lineH : 0) + confirmH;

    const borderCol = state === 'locked' ? 0x5a2020 : (NODE_COLORS[node.type] ?? 0x3a5070);
    const bg = this.add.graphics();
    bg.fillStyle(0x07101e, 0.97);
    bg.fillRoundedRect(0, 0, ttW, ttH, 6);
    bg.lineStyle(1, borderCol, 0.7);
    bg.strokeRoundedRect(0, 0, ttW, ttH, 6);
    this.tooltip.add(bg);

    const typeHex = '#' + (NODE_COLORS[node.type] ?? 0x8a9aaa).toString(16).padStart(6, '0');
    this.tooltip.add(
      this.add.text(padX, padY, `${NODE_ICONS[node.type] ?? '?'}  ${node.name}`, {
        fontSize: '17px', fontFamily: 'Nunito, sans-serif', color: typeHex,
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0, 0),
    );

    lines.forEach((line, i) => {
      this.tooltip.add(
        this.add.text(padX, padY + lineH + 4 + i * lineH, line, {
          fontSize: '15px', fontFamily: 'Nunito, sans-serif', color: '#7a9ab8',
        }).setOrigin(0, 0),
      );
    });

    // Touch confirm hint — shown below a separator
    if (showConfirm) {
      const sepY = ttH - confirmH - 1;
      const sep = this.add.graphics();
      sep.lineStyle(1, borderCol, 0.35);
      sep.lineBetween(padX, sepY, ttW - padX, sepY);
      this.tooltip.add(sep);
      this.tooltip.add(
        this.add.text(ttW / 2, sepY + confirmH / 2 + 2, 'Tap again to enter  \u2192', {
          fontSize: '15px', fontFamily: 'Nunito, sans-serif', color: typeHex,
        }).setOrigin(0.5, 0.5),
      );
    }

    // ── Smart positioning ────────────────────────────────────────────────────
    // Tooltip stays in world space (scrolls with map, near its node).
    // Clamp to visible camera viewport.
    const cam = this.cameras.main;
    const nx = this.worldX(node.x), ny = node.y;
    const HUD_TOP = 60, HUD_BOT = 64; // safe margins from title bar + bottom HUD
    const GAP = 12;
    const viewLeft = cam.scrollX + 8;
    const viewRight = cam.scrollX + GAME_WIDTH - ttW - 8;

    const aboveY = ny - NODE_RADIUS - GAP - ttH;
    const belowY = ny + NODE_RADIUS + GAP;
    const aboveFits = aboveY >= HUD_TOP;
    const belowFits = belowY + ttH <= GAME_HEIGHT - HUD_BOT;

    let tx: number, ty: number;

    if (aboveFits) {
      tx = Phaser.Math.Clamp(nx - ttW / 2, viewLeft, viewRight);
      ty = aboveY;
    } else if (belowFits) {
      tx = Phaser.Math.Clamp(nx - ttW / 2, viewLeft, viewRight);
      ty = belowY;
    } else {
      tx = nx + NODE_RADIUS + GAP;
      ty = Phaser.Math.Clamp(ny - ttH / 2, HUD_TOP, GAME_HEIGHT - HUD_BOT - ttH);
      if (tx + ttW > cam.scrollX + GAME_WIDTH - 8) tx = nx - NODE_RADIUS - GAP - ttW;
    }

    this.tooltip.setPosition(tx, ty).setVisible(true);
  }

  private hideTooltip() {
    this.tooltip.setVisible(false);
  }

  // ── Interaction ────────────────────────────────────────────────────────────
  private onNodeHover(nodeId: number, hovered: boolean) {
    const c = this.nodeContainers.get(nodeId);
    if (!c) return;
    this.tweens.killTweensOf(c);
    this.tweens.add({
      targets: c,
      scaleX: hovered ? 1.14 : 1,
      scaleY: hovered ? 1.14 : 1,
      duration: 130,
      ease: 'Power2',
    });
  }

  private onNodeClick(nodeId: number) {
    const node = this.nodeMap.find(n => n.id === nodeId);
    if (!node) return;
    (this.registry.get('audio') as import('@/systems/AudioSystem').AudioSystem | null)?.playNodeSelect();
    selectNode(nodeId); // locks sibling branches

    const c = this.nodeContainers.get(nodeId);
    if (!c) return;
    this.tweens.add({
      targets: c, scaleX: 1.28, scaleY: 1.28, duration: 90, yoyo: true,
      onComplete: () => this.enterNode(node),
    });
  }

  private enterNode(node: NodeDef) {
    this.hideTooltip();
    this.cameras.main.fadeOut(350, 0, 0, 0, (_: unknown, progress: number) => {
      if (progress === 1) {
        if (node.type === 'BATTLE' || node.type === 'ELITE' || node.type === 'BOSS' || node.type === 'TREASURE') {
          this.scene.start('BattleScene', { node });
        } else if (node.type === 'REWARD') {
          const ascMods = getAscensionModifiers(getRunState().ascensionLevel);
          this.scene.start('ShopScene', { node, free: !ascMods.noFreeRelics });
        } else if (node.type === 'SHOP') {
          this.scene.start('ShopScene', { node, free: false });
        } else if (node.type === 'EVENT') {
          this.scene.start('EventScene', { node });
        } else if (node.type === 'FORGE') {
          this.scene.start('ForgeScene', { node });
        } else if (node.type === 'REST') {
          this.scene.start('RestScene', { node });
        }
      }
    });
  }

  // ── HUD ─────────────────────────────────────────────────────────────────────
  private buildHUD() {
    // Currency bars (top-right): shards rightmost, gold to its left
    const shardBar = buildCurrencyBar(this, 'shard', () => getShards(), 20, 0);
    shardBar.container.setScrollFactor(0);
    this._goldBar = buildCurrencyBar(this, 'gold', () => getRunState().gold, 20, 1);
    this._goldBar.container.setScrollFactor(0);

    this.relicRow = this.add.container(SAFE_AREA_LEFT, GAME_HEIGHT - 56).setDepth(21).setScrollFactor(0);
    this.refreshRelicRow();
  }

  private refreshRelicRow() {
    const run = getRunState();
    this.relicRow.removeAll(true);
    if (run.relics.length === 0) return;

    // "RELICS" label
    const label = this.add.text(0, 0, 'RELICS', {
      fontSize: '14px', color: '#5a7a9a', fontFamily: 'Nunito, sans-serif', letterSpacing: 2,
    }).setOrigin(0, 0.5);
    this.relicRow.add(label);

    const BADGE = 42;
    const GAP = 8;
    let xOff = 62;

    for (const relic of run.relics) {
      const badgeX = xOff;  // capture per-iteration value for closures
      const rarity = relic.curse ? 'curse' : (relic.rarity ?? 'common');
      const col = RARITY_HEX[rarity] ?? 0x888888;
      const iconChar = RARITY_ICON[rarity] ?? '●';
      const colHex = '#' + col.toString(16).padStart(6, '0');

      // Badge background
      const badge = this.add.graphics();
      const drawBadge = (hovered: boolean) => {
        badge.clear();
        badge.fillStyle(hovered ? 0x1a2838 : 0x101828, 1);
        badge.fillRoundedRect(badgeX, -BADGE / 2, BADGE, BADGE, 4);
        badge.lineStyle(hovered ? 2 : 1, col, hovered ? 0.9 : 0.5);
        badge.strokeRoundedRect(badgeX, -BADGE / 2, BADGE, BADGE, 4);
      };
      drawBadge(false);
      this.relicRow.add(badge);

      // Icon — sprite if available, else Unicode fallback
      const relicImg = createRelicIcon(this, relic, badgeX + BADGE / 2, 0, 30);
      if (relicImg) {
        this.relicRow.add(relicImg);
      } else {
        const iconText = this.add.text(badgeX + BADGE / 2, 0, iconChar, {
          fontSize: '18px', fontFamily: 'Nunito, sans-serif',
          color: colHex, stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5);
        this.relicRow.add(iconText);
      }

      // Hit area for click + hover
      const hitRect = this.add.rectangle(
        badgeX + BADGE / 2, 0, BADGE, BADGE, 0x000000, 0,
      ).setInteractive({ useHandCursor: true }).setScrollFactor(0);
      this.relicRow.add(hitRect);

      hitRect.on('pointerover', () => drawBadge(true));
      hitRect.on('pointerout',  () => drawBadge(false));
      hitRect.on('pointerdown', () => { drawBadge(false); this.showRelicDetail(relic); });

      xOff += BADGE + GAP;
    }
  }

  // ── Relic detail popup ──────────────────────────────────────────────────────
  private showRelicDetail(relic: RelicDef) {
    this.closeRelicDetail();
    this.closePartyPanel();
    this.clearTouchSelection();
    this.hideTooltip();

    const rarity = relic.curse ? 'curse' : (relic.rarity ?? 'common');
    const col = RARITY_HEX[rarity] ?? 0x888888;
    const colHex = '#' + col.toString(16).padStart(6, '0');
    const iconChar = RARITY_ICON[rarity] ?? '●';

    // Veil
    this.relicDetailVeil = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000,
    ).setAlpha(0).setDepth(45).setInteractive().setScrollFactor(0);
    this.relicDetailVeil.on('pointerdown', () => this.closeRelicDetail());
    this.tweens.add({ targets: this.relicDetailVeil, alpha: 0.7, duration: 150 });

    // Panel dimensions
    const PW = 320, PH = 280;
    const px = Math.round(GAME_WIDTH / 2 - PW / 2);
    const py = Math.round(GAME_HEIGHT / 2 - PH / 2);

    const panel = this.add.container(px, py).setDepth(46).setAlpha(0).setScrollFactor(0);
    this.relicDetailPanel = panel;
    this.tweens.add({ targets: panel, alpha: 1, duration: 150 });

    // Panel shell
    const shell = this.add.graphics();
    shell.fillStyle(0x05101c, 0.98);
    shell.fillRoundedRect(0, 0, PW, PH, 10);
    shell.lineStyle(1, col, 0.5);
    shell.strokeRoundedRect(0, 0, PW, PH, 10);
    panel.add(shell);

    // Rarity banner
    const banner = this.add.graphics();
    banner.fillStyle(col, 0.75);
    banner.fillRoundedRect(0, 0, PW, 30, { tl: 10, tr: 10, bl: 0, br: 0 });
    panel.add(banner);

    const rarityLabel = rarity.toUpperCase();
    panel.add(this.add.text(PW / 2, 15, rarityLabel, {
      fontSize: '15px', fontFamily: 'Nunito, sans-serif', color: '#fff',
      stroke: '#000', strokeThickness: 2, letterSpacing: 3,
    }).setOrigin(0.5));

    // Close ✕
    const closeBtn = this.add.text(PW - 18, 15, '✕', {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif', color: '#aaa',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScrollFactor(0);
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff6666'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#aaa'));
    closeBtn.on('pointerdown', () => this.closeRelicDetail());
    panel.add(closeBtn);

    // Icon circle
    const iconGfx = this.add.graphics();
    iconGfx.fillStyle(col, 0.15);
    iconGfx.fillCircle(PW / 2, 78, 28);
    iconGfx.lineStyle(1.5, col, 0.5);
    iconGfx.strokeCircle(PW / 2, 78, 28);
    panel.add(iconGfx);

    const detailIcon = createRelicIcon(this, relic, PW / 2, 78, 36);
    if (detailIcon) {
      panel.add(detailIcon);
    } else {
      panel.add(this.add.text(PW / 2, 78, iconChar, {
        fontSize: '22px', fontFamily: 'Nunito, sans-serif',
        color: colHex, stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5));
    }

    // Relic name
    panel.add(this.add.text(PW / 2, 122, relic.name, {
      fontSize: '19px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#e8e0d0', stroke: '#000', strokeThickness: 3,
      wordWrap: { width: PW - 40 }, align: 'center',
    }).setOrigin(0.5));

    // Description
    panel.add(this.add.text(PW / 2, 158, relic.desc, {
      fontSize: '17px', fontFamily: 'Nunito, sans-serif', color: '#8a9aaa',
      wordWrap: { width: PW - 48 }, align: 'center',
    }).setOrigin(0.5));

    // Effect line
    const effectStr = this.formatRelicEffect(relic);
    if (effectStr) {
      // Separator
      const sep = this.add.graphics();
      sep.lineStyle(1, col, 0.2);
      sep.lineBetween(20, 200, PW - 20, 200);
      panel.add(sep);

      const effectColor = relic.curse ? '#e74c3c' : '#66cc88';
      panel.add(this.add.text(PW / 2, 222, effectStr, {
        fontSize: '14px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
        color: effectColor, stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5));
    }
  }

  private closeRelicDetail() {
    if (this.relicDetailPanel) {
      this.relicDetailPanel.destroy();
      this.relicDetailPanel = null;
    }
    if (this.relicDetailVeil) {
      this.relicDetailVeil.destroy();
      this.relicDetailVeil = null;
    }
  }

  private formatRelicEffect(relic: RelicDef): string {
    const effect = relic.effect;
    const v = relic.value;
    if (!effect) return '';

    const sign = v >= 0 ? '+' : '';

    switch (effect) {
      case 'FLAT_HP':              return `${sign}${v} Max HP`;
      case 'COOLDOWN_REDUCE':      return `${v > 0 ? '-' : '+'}${Math.abs(v) / 1000}s cooldown`;
      case 'MAGE_AOE_RADIUS':      return `${sign}${v} AoE radius`;
      case 'WARRIOR_IMPACT_BONUS': return `${sign}${Math.round(v * 100)}% impact`;
      case 'RANGER_ARROW_COUNT':   return `${sign}${v} arrow${Math.abs(v) !== 1 ? 's' : ''}`;
      case 'PRIEST_HEAL_BONUS':    return `${sign}${v} heal range`;
      case 'FLAT_COMBAT_DAMAGE':   return `${sign}${v} combat damage`;
      case 'COMBAT_SPEED_MULT':    return `${Math.round((1 - v) * 100)}% faster attacks`;
      case 'MAX_DRAG_BONUS':       return `${sign}${v} sling range`;
      case 'GOLD_ON_WIN':          return `${sign}${v}g per win`;
      case 'GOLD_ON_KILL':         return `${sign}${v}g per kill`;
      case 'AIR_FRICTION_REDUCE':  return `${sign}${Math.round(v * 100)}% less air drag`;
      case 'DAMAGE_REDUCTION':     return `${v > 0 ? sign : ''}${Math.round(v * 100)}% damage taken`;
      case 'THORNS':               return `${v} thorns damage`;
      case 'CRIT_CHANCE':          return `${Math.round(v * 100)}% crit chance`;
      case 'IMPACT_DAMAGE_BONUS':  return `${sign}${Math.round(v * 100)}% impact damage`;
      case 'DEATH_SAVE':           return `Cheat death ${v}x`;
      case 'EXTRA_LAUNCH':         return `${sign}${v} extra launch`;
      case 'WARRIOR_KNOCKBACK':    return `${sign}${v} knockback`;
      case 'MAGE_CHAIN':           return `Chain to ${v} targets`;
      case 'RANGER_POISON':        return `${v} poison/sec`;
      case 'PRIEST_RESURRECT':     return `Revive at ${Math.round(v * 100)}% HP`;
      case 'BARD_CHARM_BONUS':     return `${sign}${v / 1000}s charm duration`;
      case 'STONE_DAMAGE_BONUS':   return `${sign}${Math.round(v * 100)}% vs stone`;
      case 'LOW_HP_DAMAGE':        return `${Math.round(v)}x damage below 30% HP`;
      case 'GOLD_TAX_PCT':         return `-${Math.round(v * 100)}% gold on win`;
      case 'TRAJECTORY_REDUCE':    return `-${v} trajectory dots`;
      case 'LAUNCH_POWER_CURSE':   return `${Math.round(v * 100)}% launch power`;
      case 'DRUID_WOLF_BONUS':     return `${sign}${v} wolf summon${v !== 1 ? 's' : ''}`;
      case 'ROGUE_PIERCE_BONUS':   return `${sign}${v} extra pierce`;
      case 'HEAL_ON_KILL':         return `${sign}${v} HP per kill`;
      case 'REST_HP_BONUS':        return `${sign}${v} max HP at REST`;
      case 'REVIVE_COOLDOWN_REDUCE': return `-${v} revive cooldown`;
      default:                     return '';
    }
  }

  // ── Squad preview (bottom-right, clickable) ─────────────────────────────────
  private buildSquadPreview() {
    const panelX = GAME_WIDTH - 188, panelY = GAME_HEIGHT - 102;
    const panelW = 176, panelH = 90;

    // Static bg + title (never changes)
    const bg = this.add.graphics().setDepth(20).setScrollFactor(0);
    bg.fillStyle(0x060b12, 0.92);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    bg.lineStyle(1, 0x2a3a50, 0.6);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);

    this.add.text(panelX + panelW / 2, panelY + 14, 'PARTY  \u25b6', {
      fontSize: '14px', color: '#5a7a9a', fontFamily: 'Nunito, sans-serif', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(21).setScrollFactor(0);

    // Dynamic hero bubbles container (refreshed when order changes)
    this.squadPreviewCt = this.add.container(0, 0).setDepth(21).setScrollFactor(0);
    this.refreshSquadPreview();

    // Hover highlight + click to open party panel
    const hoverRing = this.add.graphics().setDepth(22).setScrollFactor(0);
    const hit = this.add.rectangle(
      panelX + panelW / 2, panelY + panelH / 2, panelW, panelH, 0x000000, 0,
    ).setInteractive({ useHandCursor: true }).setDepth(23).setScrollFactor(0);
    hit.on('pointerover', () => {
      hoverRing.clear();
      hoverRing.lineStyle(1, 0xc0a060, 0.5);
      hoverRing.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);
    });
    hit.on('pointerout', () => hoverRing.clear());
    hit.on('pointerdown', () => { hoverRing.clear(); this.openPartyPanel(); });
  }

  private refreshSquadPreview() {
    this.squadPreviewCt.removeAll(true);
    const run = getRunState();
    const panelX = GAME_WIDTH - 188, panelY = GAME_HEIGHT - 102;
    const panelW = 176;
    const count = run.squad.length;
    const spacing = Math.min(40, (panelW - 20) / Math.max(count, 1));
    const startX = panelX + panelW / 2 - ((count - 1) * spacing) / 2;

    run.squad.forEach((h, i) => {
      const hx = startX + i * spacing;
      const hy = panelY + 54;
      const onCooldown = (h.reviveCooldown ?? 0) > 0;
      const charKey = h.heroClass.toLowerCase();

      // Mini animated sprite instead of colored circle
      const sprite = this.add.sprite(hx, hy, `${charKey}_idle_1`)
        .setDisplaySize(28, 28).setScrollFactor(0);
      try { sprite.play(`${charKey}_idle`); } catch { /* */ }

      if (onCooldown) {
        sprite.setTint(0x444444).setAlpha(0.4);
      } else {
        const classTint = Hero.CLASS_TINT[h.heroClass as HeroClass];
        if (classTint) sprite.setTint(classTint);
      }
      this.squadPreviewCt.add(sprite);

      // HP bar under sprite (alive only)
      if (!onCooldown) {
        const pct = Math.max(0, h.currentHp / h.maxHp);
        const g = this.add.graphics().setScrollFactor(0);
        g.fillStyle(0x1a2a3a, 1);
        g.fillRect(hx - 12, hy + 16, 24, 3);
        g.fillStyle(pct > 0.5 ? 0x2ecc71 : pct > 0.25 ? 0xf39c12 : 0xe74c3c, 1);
        g.fillRect(hx - 12, hy + 16, 24 * pct, 3);
        this.squadPreviewCt.add(g);
      }

      if (onCooldown) {
        this.squadPreviewCt.add(
          this.add.text(hx, hy - 18, `${h.reviveCooldown}`, {
            fontSize: '15px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold', color: '#e74c3c',
            stroke: '#000', strokeThickness: 2,
          }).setOrigin(0.5).setScrollFactor(0),
        );
      }
    });
  }

  // ── Regen visual feedback ────────────────────────────────────────────────────
  private showRegenFeedback() {
    const regenResults = consumePendingRegen();
    if (regenResults.length === 0) return;

    const run = getRunState();
    const panelX = GAME_WIDTH - 188, panelY = GAME_HEIGHT - 102;
    const panelW = 176;
    const count = run.squad.length;
    const spacing = Math.min(40, (panelW - 20) / Math.max(count, 1));
    const startX = panelX + panelW / 2 - ((count - 1) * spacing) / 2;

    for (let i = 0; i < run.squad.length; i++) {
      const h = run.squad[i];
      const regen = regenResults.find(r => r.heroClass === h.heroClass);
      if (!regen) continue;

      const hx = startX + i * spacing;
      const hy = panelY + 54;

      // Floating "+N" text that drifts upward and fades out
      const txt = this.add.text(hx, hy - 20, `+${regen.healed}`, {
        fontSize: '14px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
        color: '#2ecc71', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(30).setScrollFactor(0).setAlpha(0);

      this.tweens.add({
        targets: txt,
        y: hy - 48,
        alpha: { from: 1, to: 0 },
        duration: 1200,
        ease: 'Cubic.easeOut',
        onComplete: () => txt.destroy(),
      });
    }

    // Refresh squad preview to show updated HP bars
    this.time.delayedCall(200, () => this.refreshSquadPreview());
  }

  // ── Party management panel ───────────────────────────────────────────────────
  private openPartyPanel() {
    if (this.partyPanel) return;
    this.closeRelicDetail();
    const run = getRunState();
    const PANEL_W = 520;
    const CARD_H  = 100;
    const CARD_GAP = 6;
    const HEADER_H = 46;
    const FOOTER_PAD = 14;
    const n = run.squad.length;
    const panelH = HEADER_H + n * (CARD_H + CARD_GAP) - CARD_GAP + FOOTER_PAD;
    const px = Math.round(GAME_WIDTH  / 2 - PANEL_W / 2);
    const py = Math.round(GAME_HEIGHT / 2 - panelH / 2);

    // Veil
    this.partyVeil = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000,
    ).setAlpha(0).setDepth(45).setInteractive().setScrollFactor(0);
    this.partyVeil.on('pointerdown', () => this.closePartyPanel());
    this.tweens.add({ targets: this.partyVeil, alpha: 0.75, duration: 180 });

    // Panel container — use local ref so TS knows it's non-null throughout
    const panel = this.add.container(px, py).setDepth(46).setAlpha(0).setScrollFactor(0);
    this.partyPanel = panel;
    this.tweens.add({ targets: panel, alpha: 1, duration: 180 });

    // Shell
    const shell = this.add.graphics();
    shell.fillStyle(0x05101c, 0.98);
    shell.fillRoundedRect(0, 0, PANEL_W, panelH, 10);
    shell.lineStyle(1, 0xc0a060, 0.45);
    shell.strokeRoundedRect(0, 0, PANEL_W, panelH, 10);
    panel.add(shell);

    // Header
    panel.add(this.add.text(PANEL_W / 2, HEADER_H / 2, 'PARTY', {
      fontSize: '17px', fontFamily: 'Nunito, sans-serif', color: '#c0a060', letterSpacing: 5,
    }).setOrigin(0.5));

    // Close ✕
    const closeBtn = this.add.text(PANEL_W - 20, HEADER_H / 2, '✕', {
      fontSize: '16px', fontFamily: 'Nunito, sans-serif', color: '#556070',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScrollFactor(0);
    closeBtn.on('pointerover', () => closeBtn.setColor('#cc4444'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#556070'));
    closeBtn.on('pointerdown', () => this.closePartyPanel());
    panel.add(closeBtn);

    // Header separator
    const hSep = this.add.graphics();
    hSep.lineStyle(1, 0xc0a060, 0.18);
    hSep.lineBetween(14, HEADER_H, PANEL_W - 14, HEADER_H);
    panel.add(hSep);

    // Cards
    const heroColors: Record<string, number> = {
      WARRIOR: 0xc0392b, RANGER: 0x27ae60, MAGE: 0x8e44ad,
      PRIEST: 0xf39c12, BARD: 0x1abc9c, ROGUE: 0x2c3e50,
      PALADIN: 0xf1c40f, DRUID: 0x16a085,
    };
    run.squad.forEach((heroData, idx) => {
      const cardY  = HEADER_H + idx * (CARD_H + CARD_GAP);
      const col    = heroColors[heroData.heroClass] ?? 0x888888;
      const hexCol = '#' + col.toString(16).padStart(6, '0');
      const pct    = Math.max(0, heroData.currentHp / heroData.maxHp);
      const stats  = HERO_STATS[heroData.heroClass as HeroClass];
      const onCooldown = (heroData.reviveCooldown ?? 0) > 0;

      // Card bg
      const cardBg = this.add.graphics();
      cardBg.fillStyle(onCooldown ? 0x0a0a12 : 0x0b1828, 1);
      cardBg.fillRoundedRect(10, cardY + 2, PANEL_W - 20, CARD_H - 4, 6);
      cardBg.lineStyle(1, onCooldown ? 0x444444 : col, onCooldown ? 0.15 : 0.2);
      cardBg.strokeRoundedRect(10, cardY + 2, PANEL_W - 20, CARD_H - 4, 6);
      panel.add(cardBg);

      // Portrait (idle frame 1)
      const charKey = heroData.heroClass.toLowerCase();
      const portrait = this.add.image(48, cardY + CARD_H / 2, `${charKey}_idle_1`)
        .setDisplaySize(58, 58);
      if (onCooldown) {
        portrait.setTint(0x444444);
        portrait.setAlpha(0.5);
      } else {
        const classTint = Hero.CLASS_TINT[heroData.heroClass as HeroClass];
        if (classTint) portrait.setTint(classTint);
      }
      panel.add(portrait);

      // Name
      panel.add(this.add.text(88, cardY + 13, heroData.name, {
        fontSize: '18px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
        color: onCooldown ? '#666666' : '#ddd0b0', stroke: '#000', strokeThickness: 2,
      }));

      // Class badge
      panel.add(this.add.text(88, cardY + 32, heroData.heroClass, {
        fontSize: '14px', fontFamily: 'Nunito, sans-serif', color: onCooldown ? '#555555' : hexCol, letterSpacing: 2,
      }));

      if (onCooldown) {
        // "REVIVING" badge + cooldown text instead of HP bar / stats
        panel.add(this.add.text(88, cardY + 50, 'REVIVING', {
          fontSize: '14px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
          color: '#e74c3c', stroke: '#000', strokeThickness: 2,
        }));
        const nodesLeft = heroData.reviveCooldown!;
        panel.add(this.add.text(88, cardY + 68, `Returns in ${nodesLeft} node${nodesLeft > 1 ? 's' : ''}`, {
          fontSize: '14px', fontFamily: 'Nunito, sans-serif', color: '#8a6060',
        }));
      } else {
        // HP bar
        const barX = 88, barY = cardY + 50, barW = PANEL_W - 170;
        const hpBg = this.add.graphics();
        hpBg.fillStyle(0x1a2a3a, 1);
        hpBg.fillRoundedRect(barX, barY, barW, 6, 3);
        panel.add(hpBg);

        const hpFill = this.add.graphics();
        const hpCol = pct > 0.5 ? 0x2ecc71 : pct > 0.25 ? 0xf39c12 : 0xe74c3c;
        hpFill.fillStyle(hpCol, 1);
        hpFill.fillRoundedRect(barX, barY, Math.max(3, barW * pct), 6, 3);
        panel.add(hpFill);

        const hpHex = pct > 0.5 ? '#2ecc71' : pct > 0.25 ? '#f39c12' : '#e74c3c';
        panel.add(this.add.text(barX + barW + 8, barY - 1,
          `${heroData.currentHp} / ${heroData.maxHp}`, {
            fontSize: '14px', fontFamily: 'Nunito, sans-serif', color: hpHex,
          }));

        // Description
        const desc = HERO_DESCS[heroData.heroClass] ?? '';
        panel.add(this.add.text(88, cardY + 63, desc, {
          fontSize: '14px', fontFamily: 'Nunito, sans-serif', color: '#6a8aaa',
          wordWrap: { width: PANEL_W - 190 },
        }));

        // Stats row
        const keyStat = HERO_KEY_STAT[heroData.heroClass] ?? '';
        panel.add(this.add.text(88, cardY + 83,
          `\u2694 ${stats.combatDamage} atk   \u25ce ${stats.combatRange} range   ${keyStat}`, {
            fontSize: '14px', fontFamily: 'Nunito, sans-serif', color: '#4a6080',
          }));
      }

      // Reorder arrows ▲ ▼ (larger touch targets)
      const arrowW = 36, arrowH = 32;
      if (idx > 0) {
        const upBg = this.add.graphics();
        upBg.fillStyle(0x0b1828, 0.8);
        upBg.fillRoundedRect(PANEL_W - 50, cardY + 12, arrowW, arrowH, 6);
        panel.add(upBg);
        const upBtn = this.add.text(PANEL_W - 32, cardY + 28, '\u25b2', {
          fontSize: '24px', fontFamily: 'Nunito, sans-serif', color: '#4a6a88',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScrollFactor(0);
        upBtn.on('pointerover', () => upBtn.setColor('#c0a060'));
        upBtn.on('pointerout',  () => upBtn.setColor('#4a6a88'));
        upBtn.on('pointerdown', () => this.reorderAndRebuild(idx, idx - 1));
        panel.add(upBtn);
      }
      if (idx < n - 1) {
        const dnBg = this.add.graphics();
        dnBg.fillStyle(0x0b1828, 0.8);
        dnBg.fillRoundedRect(PANEL_W - 50, cardY + 52, arrowW, arrowH, 6);
        panel.add(dnBg);
        const dnBtn = this.add.text(PANEL_W - 32, cardY + 68, '\u25bc', {
          fontSize: '24px', fontFamily: 'Nunito, sans-serif', color: '#4a6a88',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setScrollFactor(0);
        dnBtn.on('pointerover', () => dnBtn.setColor('#c0a060'));
        dnBtn.on('pointerout',  () => dnBtn.setColor('#4a6a88'));
        dnBtn.on('pointerdown', () => this.reorderAndRebuild(idx, idx + 1));
        panel.add(dnBtn);
      }

      // Drag-to-reorder — drag the card row up/down
      const dragHit = this.add.rectangle(
        PANEL_W / 2 - 30, cardY + CARD_H / 2, PANEL_W - 120, CARD_H - 4, 0x000000, 0,
      ).setInteractive({ useHandCursor: true, draggable: true }).setScrollFactor(0);
      dragHit.setData('heroIdx', idx);
      panel.add(dragHit);

      this.input.setDraggable(dragHit);
    });

    // Drag events for party card reorder
    const cardMidY = (i: number) => HEADER_H + i * (CARD_H + CARD_GAP) + CARD_H / 2;
    this.input.on('drag', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Rectangle, _dragX: number, dragY: number) => {
      if (gameObject.getData('heroIdx') === undefined) return;
      // Clamp within panel bounds, only move vertically
      const minY = HEADER_H + CARD_H / 2;
      const maxY = HEADER_H + (n - 1) * (CARD_H + CARD_GAP) + CARD_H / 2;
      gameObject.y = Phaser.Math.Clamp(dragY - py, minY, maxY);
    });
    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Rectangle) => {
      const fromIdx = gameObject.getData('heroIdx') as number | undefined;
      if (fromIdx === undefined) return;
      // Calculate target slot from Y position
      const currentY = gameObject.y;
      let toIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < n; i++) {
        const dist = Math.abs(currentY - cardMidY(i));
        if (dist < bestDist) { bestDist = dist; toIdx = i; }
      }
      if (toIdx !== fromIdx) {
        this.reorderAndRebuild(fromIdx, toIdx);
      } else {
        // Snap back
        gameObject.y = cardMidY(fromIdx);
      }
    });
  }

  private closePartyPanel(refreshPreview = true) {
    this.partyPanel?.destroy();
    this.partyPanel = null;
    this.partyVeil?.destroy();
    this.partyVeil = null;
    if (refreshPreview) this.refreshSquadPreview();
  }

  private reorderAndRebuild(fromIdx: number, toIdx: number) {
    reorderSquad(fromIdx, toIdx);
    this.closePartyPanel(false); // skip preview refresh — openPartyPanel will do it after close
    this.openPartyPanel();
    this.refreshSquadPreview();  // update the mini-preview too
  }

  private showAvailableGlow() {
    const run = getRunState();
    for (const id of run.availableNodeIds) {
      if (run.completedNodeIds.has(id) || run.lockedNodeIds.has(id)) continue;
      const c = this.nodeContainers.get(id);
      if (!c) continue;
      this.tweens.add({
        targets: c, scaleX: 1.18, scaleY: 1.18,
        duration: 550, yoyo: true, repeat: 2, ease: 'Sine.easeInOut',
      });
    }
  }

  // ── Floor complete overlay (more floors remain) ──────────────────────────
  private buildFloorCompleteOverlay() {
    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
    const run = getRunState();
    const nextFloor = run.currentFloor + 1;
    const nextMapId = run.floorMapIds[nextFloor];
    const nextMap = getMapById(nextMapId);
    const nextMapName = nextMap?.name ?? nextMapId;

    // Dark veil
    const veil = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setDepth(50).setAlpha(0).setScrollFactor(0);
    this.tweens.add({ targets: veil, alpha: 0.8, duration: 500 });

    // Top glow
    const glow = this.add.graphics().setDepth(51).setAlpha(0).setScrollFactor(0);
    glow.fillGradientStyle(0x3498db, 0x3498db, 0x000000, 0x000000, 0.15, 0.15, 0, 0);
    glow.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.55);
    this.tweens.add({ targets: glow, alpha: 1, duration: 700, delay: 200 });

    // Title
    const title = this.add.text(cx, cy - 100, `FLOOR ${run.currentFloor + 1} COMPLETE`, {
      fontSize: '56px', fontFamily: 'Knights Quest, Nunito, sans-serif',
      color: '#3498db', stroke: '#0a1a30', strokeThickness: 6,
      letterSpacing: 4,
    }).setOrigin(0.5).setDepth(52).setAlpha(0).setScrollFactor(0);
    this.tweens.add({
      targets: title, y: cy - 130, alpha: 1,
      duration: 650, ease: 'Back.easeOut', delay: 280,
    });

    // Floor progress dots
    const dotY = cy - 60;
    for (let i = 0; i < run.totalFloors; i++) {
      const dotX = cx - ((run.totalFloors - 1) * 30) / 2 + i * 30;
      const done = i <= run.currentFloor;
      const dot = this.add.graphics().setDepth(52).setAlpha(0).setScrollFactor(0);
      dot.fillStyle(done ? 0x3498db : 0x2a3a4a, 1);
      dot.fillCircle(dotX, dotY, done ? 8 : 6);
      if (done) {
        dot.lineStyle(2, 0x5ab8e8, 0.8);
        dot.strokeCircle(dotX, dotY, 8);
      }
      this.tweens.add({ targets: dot, alpha: 1, duration: 300, delay: 600 + i * 100 });

      // Floor number label
      const numText = this.add.text(dotX, dotY + 18, `${i + 1}`, {
        fontSize: '14px', fontFamily: 'Nunito, sans-serif',
        color: done ? '#5ab8e8' : '#3a4a5a',
      }).setOrigin(0.5).setDepth(52).setAlpha(0).setScrollFactor(0);
      this.tweens.add({ targets: numText, alpha: 1, duration: 300, delay: 600 + i * 100 });
    }

    // Next map name
    const sub = this.add.text(cx, cy - 16, `Next: ${nextMapName}`, {
      fontSize: '20px', fontFamily: 'Nunito, sans-serif', color: '#c8a840',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(52).setAlpha(0).setScrollFactor(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 380, delay: 860 });

    // Button
    this.time.delayedCall(1100, () => {
      const w = 280, h = 52;
      const btnLabel = `Onward to Floor ${nextFloor + 1}  \u2192`;
      const btn = this.add.container(cx, cy + 60).setDepth(52).setAlpha(0).setScrollFactor(0);

      const btnBg = this.add.graphics();
      const drawBtn = (hovered: boolean) => {
        btnBg.clear();
        btnBg.fillStyle(hovered ? 0x1a4a7a : 0x0a2a4a, 1);
        btnBg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
        btnBg.lineStyle(hovered ? 2 : 1, 0x3498db, hovered ? 1 : 0.65);
        btnBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
      };
      drawBtn(false);
      btn.add(btnBg);
      btn.add(this.add.text(0, 0, btnLabel, {
        fontSize: '21px', fontFamily: 'Nunito, sans-serif', color: '#3498db',
      }).setOrigin(0.5));

      btn.setInteractive(
        new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
        Phaser.Geom.Rectangle.Contains,
      );
      btn.on('pointerover', () => { drawBtn(true); this.tweens.add({ targets: btn, scaleX: 1.05, scaleY: 1.05, duration: 80 }); });
      btn.on('pointerout',  () => { drawBtn(false); this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 80 }); });
      btn.on('pointerdown', () => {
        advanceFloor();
        this.cameras.main.fadeOut(400, 0, 0, 0, (_: unknown, p: number) => {
          if (p === 1) this.scene.start('OverworldScene');
        });
      });

      this.tweens.add({ targets: btn, alpha: 1, y: cy + 42, duration: 360, ease: 'Back.easeOut' });
    });
  }

  // ── Run complete overlay ──────────────────────────────────────────────────
  private buildRunCompleteOverlay() {
    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
    const run = getRunState();

    // Did the player beat the boss?
    const bossNode = run.nodeMap.find(n => n.type === 'BOSS');
    const bossDefeated = bossNode ? run.completedNodeIds.has(bossNode.id) : false;

    const mapName = getMapById(run.currentMapId)?.name ?? nodesData.name;
    const titleText  = bossDefeated ? 'VICTORY!' : 'RUN COMPLETE';
    const subText    = bossDefeated
      ? `${mapName} has been conquered!`
      : `${mapName} — all paths exhausted.`;
    const btnLabel   = 'Start New Run  →';
    const glowColor  = bossDefeated ? 0xf1c40f : 0x4a7ab8;

    // Dark veil
    const veil = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setDepth(50).setAlpha(0).setScrollFactor(0);
    this.tweens.add({ targets: veil, alpha: 0.8, duration: 500 });

    // Top glow
    const glow = this.add.graphics().setDepth(51).setAlpha(0).setScrollFactor(0);
    glow.fillGradientStyle(glowColor, glowColor, 0x000000, 0x000000, 0.18, 0.18, 0, 0);
    glow.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.55);
    this.tweens.add({ targets: glow, alpha: 1, duration: 700, delay: 200 });

    // Decorative rules
    const rules = this.add.graphics().setDepth(52).setAlpha(0).setScrollFactor(0);
    rules.lineStyle(1, glowColor, 0.35);
    rules.lineBetween(cx - 320, cy - 62, cx + 320, cy - 62);
    rules.lineBetween(cx - 320, cy + 22, cx + 320, cy + 22);
    this.tweens.add({ targets: rules, alpha: 1, duration: 350, delay: 900 });

    // Title
    const title = this.add.text(cx, cy - 120, titleText, {
      fontSize: bossDefeated ? '80px' : '72px',
      fontFamily: 'Knights Quest, Nunito, sans-serif',
      color: '#f1c40f', stroke: '#5c3d00', strokeThickness: 7,
      letterSpacing: 4,
    }).setOrigin(0.5).setDepth(52).setAlpha(0).setScrollFactor(0);
    this.tweens.add({
      targets: title, y: cy - 148, alpha: 1,
      duration: 650, ease: 'Back.easeOut', delay: 280,
    });

    // Subtitle
    const sub = this.add.text(cx, cy - 22, subText, {
      fontSize: '20px', fontFamily: 'Nunito, sans-serif', color: '#c8a840',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(52).setAlpha(0).setScrollFactor(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 380, delay: 860 });

    // Score display
    try {
      const completedNodes = run.nodeMap.filter(n => run.completedNodeIds.has(n.id));
      const prevBest = getGlobalStats().bestScore ?? 0;
      const breakdown = calculateRunScore({
        completedNodes,
        victory: bossDefeated,
        heroDeathsTotal: run.heroDeathsTotal ?? 0,
        ascensionLevel: run.ascensionLevel,
        modifiers: run.activeModifiers,
      });
      if (breakdown.final > 0) {
        const scoreLabel = this.add.text(cx, cy + 4, `Score: ${breakdown.final.toLocaleString()}`, {
          fontSize: '24px', fontFamily: 'Knights Quest, Nunito, sans-serif',
          color: '#f1c40f', stroke: '#5c3d00', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(52).setAlpha(0).setScrollFactor(0);
        this.tweens.add({ targets: scoreLabel, alpha: 1, duration: 380, delay: 920 });

        if (breakdown.final > prevBest) {
          const newBest = this.add.text(cx + scoreLabel.width / 2 + 14, cy + 2, 'NEW BEST!', {
            fontSize: '14px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
            color: '#ff6b6b', stroke: '#000', strokeThickness: 2,
          }).setOrigin(0, 0.5).setDepth(52).setAlpha(0).setScrollFactor(0);
          this.tweens.add({
            targets: newBest, alpha: 1, duration: 300, delay: 1050,
            onComplete: () => {
              this.tweens.add({ targets: newBest, scaleX: 1.1, scaleY: 1.1, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            },
          });
        }
      }
    } catch { /* run state unavailable */ }

    // Gold particle rain (only on boss victory)
    if (bossDefeated) {
      const goldCols = [0xf1c40f, 0xffe066, 0xffd700, 0xfff0a0];
      for (let i = 0; i < 18; i++) {
        this.time.delayedCall(Phaser.Math.Between(200, 2000), () => this.dropGoldSpeck(goldCols));
        this.time.addEvent({
          delay: Phaser.Math.Between(2000, 3500), repeat: 5,
          callback: () => this.dropGoldSpeck(goldCols),
        });
      }
    }

    // Button
    this.time.delayedCall(1100, () => {
      const w = 260, h = 52;
      const btn = this.add.container(cx, cy + 72).setDepth(52).setAlpha(0).setScrollFactor(0);

      const btnBg = this.add.graphics();
      const drawBtn = (hovered: boolean) => {
        btnBg.clear();
        btnBg.fillStyle(hovered ? 0x7d5a00 : 0x3a2800, 1);
        btnBg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
        btnBg.lineStyle(hovered ? 2 : 1, 0xf1c40f, hovered ? 1 : 0.65);
        btnBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
      };
      drawBtn(false);
      btn.add(btnBg);
      btn.add(this.add.text(0, 0, btnLabel, {
        fontSize: '21px', fontFamily: 'Nunito, sans-serif', color: '#f1c40f',
      }).setOrigin(0.5));

      btn.setInteractive(
        new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
        Phaser.Geom.Rectangle.Contains,
      );
      btn.on('pointerover', () => { drawBtn(true); this.tweens.add({ targets: btn, scaleX: 1.05, scaleY: 1.05, duration: 80 }); });
      btn.on('pointerout',  () => { drawBtn(false); this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 80 }); });
      btn.on('pointerdown', () => {
        finalizeRun(true);
        // Calculate shards earned from this run
        const nodesCompleted = run.completedNodeIds.size;
        const killedBoss = bossDefeated;
        let shardsEarned = calcShardsEarned({ nodesCompleted, killedBoss, victory: true });
        shardsEarned += getMetaBonuses().bonusShardsPerRun;
        shardsEarned = Math.floor(shardsEarned * getAscensionShardMult(run.ascensionLevel));
        if (shardsEarned > 0) earnShards(shardsEarned);
        this.cameras.main.fadeOut(400, 0, 0, 0, (_: unknown, p: number) => {
          if (p === 1) this.scene.start('MainMenuScene', { shardsEarned });
        });
      });

      this.tweens.add({ targets: btn, alpha: 1, y: cy + 54, duration: 360, ease: 'Back.easeOut' });
    });
  }

  private dropGoldSpeck(colors: number[]) {
    const x = Phaser.Math.Between(60, GAME_WIDTH - 60);
    const size = Phaser.Math.Between(2, 7);
    const col = colors[Phaser.Math.Between(0, colors.length - 1)];
    const g = this.add.graphics().setDepth(53).setScrollFactor(0);
    g.fillStyle(col, 1);
    if (size >= 5) {
      g.fillTriangle(-size, 0, 0, -size, size, 0);
      g.fillTriangle(-size, 0, 0, size, size, 0);
    } else {
      g.fillCircle(0, 0, size);
    }
    g.setPosition(x, -12);
    this.tweens.add({
      targets: g, y: GAME_HEIGHT + 12,
      alpha: { from: 0.85, to: 0 },
      angle: Phaser.Math.Between(-100, 100),
      duration: Phaser.Math.Between(2400, 4000),
      ease: 'Linear',
      onComplete: () => g.destroy(),
    });
  }

  // ── Camera centering ──────────────────────────────────────────────────────
  private centerCameraOnActiveNode(animate = true) {
    const run = getRunState();
    // Find the leftmost available (non-completed, non-locked) node
    let targetX = this.worldWidth / 2;
    let bestRawX = Infinity;
    for (const id of run.availableNodeIds) {
      if (!run.completedNodeIds.has(id) && !run.lockedNodeIds.has(id)) {
        const node = this.nodeMap.find(n => n.id === id);
        if (node && node.x < bestRawX) {
          bestRawX = node.x;
          targetX = this.worldX(node.x);
        }
      }
    }
    const scrollX = Phaser.Math.Clamp(targetX - GAME_WIDTH / 2, 0, this.worldWidth - GAME_WIDTH);
    if (animate) {
      this.tweens.add({ targets: this.cameras.main, scrollX, duration: 500, ease: 'Cubic.easeOut' });
    } else {
      this.cameras.main.scrollX = scrollX;
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(_time: number, delta: number) {
    this.pulseTime += delta;
    const run = getRunState();

    // ── Node glow + beacon pulse ──────────────────────────────────────────
    const pulseMag = 0.12 * Math.sin(this.pulseTime / 380);
    for (const id of run.availableNodeIds) {
      if (run.completedNodeIds.has(id) || run.lockedNodeIds.has(id)) continue;
      const glow = this.nodeGlows.get(id);
      if (glow) glow.setAlpha(0.28 + pulseMag);
      const beacon = this.nodeBeacons.get(id);
      if (beacon) beacon.setAlpha(0.10 + 0.06 * Math.sin(this.pulseTime / 380));
    }

    // ── Boss node effects ─────────────────────────────────────────────────
    if (this.bossAura) {
      this.bossAura.setAlpha(0.18 + 0.08 * Math.sin(this.pulseTime / 500));
    }
    if (this.bossRing) {
      this.bossRing.rotation += 0.003 * delta;
    }
    // Boss red sparks
    if (this.bossNodePos) {
      this.bossParticleTimer += delta;
      if (this.bossParticleTimer > 1200 && this.bossParticles.length < 6) {
        this.bossParticleTimer = 0;
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.015 + Math.random() * 0.01;
        const gfx = this.add.graphics().setDepth(4);
        gfx.fillStyle(0xff3322, 0.9);
        gfx.fillCircle(0, 0, 1.5);
        gfx.setPosition(this.bossNodePos.x, this.bossNodePos.y);
        this.bossParticles.push({
          gfx, x: this.bossNodePos.x, y: this.bossNodePos.y,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: 0, maxLife: 1500 + Math.random() * 1000,
        });
      }
      for (let i = this.bossParticles.length - 1; i >= 0; i--) {
        const p = this.bossParticles[i];
        p.life += delta;
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.gfx.setPosition(p.x, p.y);
        const lifeRatio = p.life / p.maxLife;
        p.gfx.setAlpha(lifeRatio > 0.7 ? 1 - (lifeRatio - 0.7) / 0.3 : 0.9);
        if (p.life >= p.maxLife) {
          p.gfx.destroy();
          this.bossParticles.splice(i, 1);
        }
      }
    }

    // ── Path flow particles ───────────────────────────────────────────────
    this.pathParticleTimer += delta;

    // Spawn gold dots on completed paths
    if (this.pathParticleTimer > 600 && this.completedPathSegments.length > 0 && this.pathParticles.length < 12) {
      this.pathParticleTimer = 0;
      const seg = this.completedPathSegments[Math.floor(Math.random() * this.completedPathSegments.length)];
      const gfx = this.add.graphics().setDepth(3);
      gfx.fillStyle(0xf1c40f, 1);
      gfx.fillCircle(0, 0, 3);
      gfx.setPosition(seg.fromX, seg.fromY);
      this.pathParticles.push({
        gfx, t: 0, fromX: seg.fromX, fromY: seg.fromY, toX: seg.toX, toY: seg.toY,
        duration: 2000, color: 0xf1c40f, elapsed: 0,
      });
    }
    // Spawn blue dots on available paths (slower)
    if (this.pathParticleTimer > 400 && this.availablePathSegments.length > 0 && this.pathParticles.length < 12) {
      if (Math.random() < 0.3) {
        const seg = this.availablePathSegments[Math.floor(Math.random() * this.availablePathSegments.length)];
        const gfx = this.add.graphics().setDepth(3);
        gfx.fillStyle(0x6b8cba, 1);
        gfx.fillCircle(0, 0, 2.5);
        gfx.setPosition(seg.fromX, seg.fromY);
        this.pathParticles.push({
          gfx, t: 0, fromX: seg.fromX, fromY: seg.fromY, toX: seg.toX, toY: seg.toY,
          duration: 3000, color: 0x6b8cba, elapsed: 0,
        });
      }
    }
    // Update path particles
    for (let i = this.pathParticles.length - 1; i >= 0; i--) {
      const p = this.pathParticles[i];
      p.elapsed += delta;
      p.t = Math.min(1, p.elapsed / p.duration);
      p.gfx.setPosition(
        p.fromX + (p.toX - p.fromX) * p.t,
        p.fromY + (p.toY - p.fromY) * p.t,
      );
      // Fade in first 10%, fade out last 20%
      let alpha = 1;
      if (p.t < 0.1) alpha = p.t / 0.1;
      else if (p.t > 0.8) alpha = (1 - p.t) / 0.2;
      p.gfx.setAlpha(alpha);
      if (p.t >= 1) {
        p.gfx.destroy();
        this.pathParticles.splice(i, 1);
      }
    }

    // ── Themed ambient particles ──────────────────────────────────────────
    this.ambientTimer += delta;
    if (this.ambientTimer > 400 && this.ambientParticles.length < 20) {
      this.ambientTimer = 0;
      const cam = this.cameras.main;
      const colors = this.currentTheme.particleColors;
      const col = colors[Math.floor(Math.random() * colors.length)];
      const pType = this.currentTheme.particle;

      let px: number, py: number, vx: number, vy: number;
      if (pType === 'snowflake') {
        px = cam.scrollX + Math.random() * GAME_WIDTH;
        py = cam.scrollY - 10;
        vx = (Math.random() - 0.5) * 0.01;
        vy = 0.02 + Math.random() * 0.015;
      } else if (pType === 'ember') {
        px = cam.scrollX + Math.random() * GAME_WIDTH;
        py = GAME_HEIGHT + 10;
        vx = (Math.random() - 0.5) * 0.015;
        vy = -(0.02 + Math.random() * 0.015);
      } else {
        // firefly — drift up with sine wave
        px = cam.scrollX + Math.random() * GAME_WIDTH;
        py = GAME_HEIGHT * 0.4 + Math.random() * GAME_HEIGHT * 0.5;
        vx = (Math.random() - 0.5) * 0.008;
        vy = -(0.008 + Math.random() * 0.01);
      }

      const maxLife = 4000 + Math.random() * 3000;
      const gfx = this.add.graphics().setDepth(3);
      gfx.fillStyle(col, 1);
      const r = pType === 'snowflake' ? 2 : 1.5;
      gfx.fillCircle(0, 0, r);
      gfx.setPosition(px, py).setAlpha(0);

      this.ambientParticles.push({
        gfx, x: px, y: py, vx, vy,
        life: 0, maxLife,
        phase: Math.random() * Math.PI * 2,
      });
    }
    // Update ambient particles
    for (let i = this.ambientParticles.length - 1; i >= 0; i--) {
      const p = this.ambientParticles[i];
      p.life += delta;
      const pType = this.currentTheme.particle;

      // Sine wave oscillation
      const sineOffset = Math.sin(p.life / 800 + p.phase) * 0.3;
      p.x += (p.vx + (pType === 'firefly' ? sineOffset * 0.02 : 0)) * delta;
      p.y += p.vy * delta;
      if (pType === 'snowflake') p.x += sineOffset * 0.015 * delta;

      p.gfx.setPosition(p.x, p.y);

      // Fade: in first 15%, out last 25%
      const lifeRatio = p.life / p.maxLife;
      let alpha: number;
      if (lifeRatio < 0.15) alpha = lifeRatio / 0.15;
      else if (lifeRatio > 0.75) alpha = (1 - lifeRatio) / 0.25;
      else alpha = 1;
      p.gfx.setAlpha(alpha * 0.6);

      if (p.life >= p.maxLife) {
        p.gfx.destroy();
        this.ambientParticles.splice(i, 1);
      }
    }
  }
}
