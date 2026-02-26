import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT,
  SLING_X, SLING_Y,
  STARTER_SQUAD_SIZE,
  HeroClass, EnemyClass,
  HERO_STATS,
  LAUNCH_COOLDOWN_MS,
  HUD_BAR_HEIGHT,
} from '@/config/constants';

import { Hero } from '@/entities/Hero';
import { Enemy } from '@/entities/Enemy';
import { Block } from '@/entities/Block';
import { Barrel } from '@/entities/Barrel';
import { Coin } from '@/entities/Coin';

import { LaunchSystem } from '@/systems/LaunchSystem';
import { CombatSystem } from '@/systems/CombatSystem';
import { ImpactSystem } from '@/systems/ImpactSystem';
import { TimeoutSystem } from '@/systems/TimeoutSystem';
import { SquadUI } from '@/ui/SquadUI';
import { DamageNumber } from '@/ui/DamageNumber';

import {
  getRunState, hasRunState, completeNode, syncSquadHp, newRun, getRelicModifiers, loadRun,
  addRelic,
  type NodeDef, type RelicDef,
} from '@/systems/RunState';
import { AudioSystem } from '@/systems/AudioSystem';
import type { MusicSystem } from '@/systems/MusicSystem';
import { recordEnemyKill, recordHeroUsed } from '@/systems/DiscoveryLog';
import { addBlocksDestroyed, addEnemiesKilled, recordLaunchDamage, recordBattleTime } from '@/systems/RunHistory';
import { checkAchievements, incrementStat } from '@/systems/AchievementSystem';
import { isTutorialComplete, completeStep, getTutorialText, getNextStep } from '@/systems/TutorialSystem';
import { getAscensionModifiers } from '@/systems/AscensionSystem';
import nodesData from '@/data/nodes.json';
import relicsData from '@/data/relics.json';
import cursesData from '@/data/curses.json';

// ─── Scene ───────────────────────────────────────────────────────────────────

export class BattleScene extends Phaser.Scene {
  // Entities
  private heroes: Hero[] = [];
  private enemies: Enemy[] = [];
  private blocks: Block[] = [];
  private barrels: Barrel[] = [];
  private coins: Coin[] = [];

  // Accumulated gold from coin pickups during the battle
  private coinGoldBonus = 0;

  // Trail particle timer
  private trailTimer = 0;

  // Systems
  private launchSystem!: LaunchSystem;
  private combatSystem!: CombatSystem;
  private impactSystem!: ImpactSystem;
  private timeoutSystem!: TimeoutSystem;
  private squadUI!: SquadUI;

  // Node being played
  private activeNode!: NodeDef;

  // State
  private battleEnded = false;
  private timeoutStarted = false;
  private shakeQueued = 0; // accumulated shake intensity

  // Audio + HUD extras
  private audio!: AudioSystem;
  private enemyCountText!: Phaser.GameObjects.Text;
  private enemyPanel!: Phaser.GameObjects.Graphics;

  // End-run button (shown once all heroes are launched)
  private endRunBtn!: Phaser.GameObjects.Container;
  private endRunBtnShown = false;

  // Battle tracking for stats/achievements
  private battleStartTime = 0;
  private blocksDestroyedThisBattle = 0;
  private barrelExplosionsThisBattle = 0;
  private enemiesKilledThisBattle = 0;

  // Tutorial hint text
  private tutorialHint: Phaser.GameObjects.Text | null = null;

  // Background
  private bg!: Phaser.GameObjects.Graphics;
  private ground!: MatterJS.BodyType;

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(data?: { node?: NodeDef }) {
    this.battleEnded = false;
    this.timeoutStarted = false;
    this.shakeQueued = 0;
    this.endRunBtnShown = false;
    this.heroes = [];
    this.enemies = [];
    this.blocks = [];
    this.barrels = [];
    this.coins = [];
    this.coinGoldBonus = 0;
    this.trailTimer = 0;
    this.battleStartTime = 0;
    this.blocksDestroyedThisBattle = 0;
    this.barrelExplosionsThisBattle = 0;
    this.enemiesKilledThisBattle = 0;
    this.tutorialHint = null;

    // Bootstrap run state if launched standalone (dev mode)
    if (!hasRunState()) {
      if (!loadRun()) {
        const nodes = (nodesData as any).nodes as NodeDef[];
        newRun(nodes, ['WARRIOR', 'RANGER', 'MAGE', 'PRIEST'] as HeroClass[]);
      }
    }

    const run = getRunState();
    this.activeNode = data?.node ?? run.nodeMap.find(n => n.id === run.currentNodeId)!;

    const music = this.registry.get('music') as MusicSystem | null;
    music?.play(this.activeNode.type === 'BOSS' ? 'boss' : 'battle');

    this.buildBackground();
    this.buildGround();
    this.buildStructure();
    this.spawnCoins();
    this.buildSquad();
    this.buildSystems();
    this.buildCollisionHandlers();
    this.buildEventHandlers();

    this.battleStartTime = this.time.now;

    // Tutorial hint for first run
    if (!isTutorialComplete()) {
      this.showTutorialHint();
    }

    // Fade in
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // Node name banner
    this.showNodeBanner();
  }

  // ─── Settings button ──────────────────────────────────────────────────────
  private buildSettingsButton() {
    const size = 36, r = 8;
    const bg = this.add.graphics().setDepth(55);
    const draw = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(0x060b12, hovered ? 1 : 0.75);
      bg.fillRoundedRect(10, 10, size, size, r);
      bg.lineStyle(1, 0x3a5070, hovered ? 1 : 0.5);
      bg.strokeRoundedRect(10, 10, size, size, r);
    };
    draw(false);
    const icon = this.add.text(10 + size / 2, 10 + size / 2, '⚙', {
      fontSize: '18px',
    }).setOrigin(0.5).setDepth(56);

    const hit = this.add.rectangle(10 + size / 2, 10 + size / 2, size, size, 0x000000, 0)
      .setInteractive().setDepth(57);
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => {
      if (!this.battleEnded) this.scene.launch('SettingsScene', { callerKey: 'BattleScene' });
    });
  }

  // ─── End-run button ───────────────────────────────────────────────────────
  private buildEndRunButton() {
    const W = 130, H = 36, R = 7;
    // Bottom-right corner of the HUD bar, 10px from edge, vertically centered in bar
    const bx = GAME_WIDTH - W / 2 - 10;
    const by = GAME_HEIGHT - HUD_BAR_HEIGHT / 2;

    const bg = this.add.graphics();
    const drawBg = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(0x3a0808, hovered ? 1 : 0.88);
      bg.fillRoundedRect(-W / 2, -H / 2, W, H, R);
      bg.lineStyle(1.5, hovered ? 0xe74c3c : 0x7a1010, hovered ? 1 : 0.75);
      bg.strokeRoundedRect(-W / 2, -H / 2, W, H, R);
    };
    drawBg(false);

    const label = this.add.text(0, 0, 'END RUN', {
      fontSize: '13px', fontStyle: 'bold', fontFamily: 'Georgia, serif',
      color: '#e74c3c', stroke: '#000', strokeThickness: 2,
      letterSpacing: 2,
    }).setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, W, H, 0, 0).setInteractive();
    hit.on('pointerover',  () => { drawBg(true);  label.setStyle({ color: '#ff6b6b' }); });
    hit.on('pointerout',   () => { drawBg(false); label.setStyle({ color: '#e74c3c' }); });
    hit.on('pointerdown',  () => {
      if (!this.battleEnded) this.endBattle(false, 'Retreat!');
    });

    this.endRunBtn = this.add.container(bx, by, [bg, label, hit]).setDepth(60).setAlpha(0);

    // Fade in
    this.tweens.add({ targets: this.endRunBtn, alpha: 1, duration: 300, ease: 'Power2' });
  }

  // ─── Node banner ──────────────────────────────────────────────────────────
  private showNodeBanner() {
    if (this.activeNode.type === 'BOSS') {
      this.showBossIntro();
      return;
    }

    const banner = this.add.text(GAME_WIDTH / 2, 60, this.activeNode.name.toUpperCase(), {
      fontSize: '28px', fontFamily: 'serif',
      color: '#f1c40f', stroke: '#000', strokeThickness: 4,
      letterSpacing: 3,
    }).setOrigin(0.5).setDepth(60).setAlpha(0);

    this.tweens.add({
      targets: banner,
      alpha: 1, y: 50,
      duration: 500, ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(1500, () => {
          this.tweens.add({ targets: banner, alpha: 0, duration: 600, onComplete: () => banner.destroy() });
        });
      },
    });
  }

  // ─── Boss cinematic intro ─────────────────────────────────────────────────
  private showBossIntro() {
    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;

    // Red camera flash + rumble
    this.cameras.main.flash(700, 160, 0, 0, false);
    this.cameras.main.shake(600, 0.018);

    // Dark veil that sweeps in then retreats
    const veil = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setDepth(88);
    this.tweens.add({
      targets: veil, alpha: 0.78, duration: 350,
      onComplete: () => this.tweens.add({
        targets: veil, alpha: 0, duration: 700, delay: 1400,
        onComplete: () => veil.destroy(),
      }),
    });

    // "⚠  BOSS BATTLE  ⚠" warning line
    const warn = this.add.text(cx, cy - 70, '⚠  BOSS BATTLE  ⚠', {
      fontSize: '20px', fontFamily: 'Georgia, serif',
      color: '#e74c3c', stroke: '#2a0000', strokeThickness: 4,
      letterSpacing: 5,
    }).setOrigin(0.5).setDepth(90).setAlpha(0);
    this.tweens.add({
      targets: warn, alpha: 1, y: cy - 80,
      duration: 500, ease: 'Power3', delay: 250,
      onComplete: () => this.time.delayedCall(1100, () =>
        this.tweens.add({ targets: warn, alpha: 0, duration: 400, onComplete: () => warn.destroy() }),
      ),
    });

    // Boss name — large, slams in from scale
    const nameText = this.add.text(cx, cy + 20, this.activeNode.name.toUpperCase(), {
      fontSize: '72px', fontFamily: 'Georgia, serif',
      color: '#c0392b', stroke: '#1a0000', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(90).setAlpha(0).setScale(1.35);
    this.tweens.add({
      targets: nameText, alpha: 1, scaleX: 1, scaleY: 1, y: cy + 10,
      duration: 580, ease: 'Back.easeOut', delay: 400,
      onComplete: () => this.time.delayedCall(950, () =>
        this.tweens.add({ targets: nameText, alpha: 0, duration: 500, onComplete: () => nameText.destroy() }),
      ),
    });

    // Secondary shake after name lands
    this.time.delayedCall(420, () => this.cameras.main.shake(350, 0.010));
  }

  // ─── Background ─────────────────────────────────────────────────────────
  private buildBackground() {
    const diff = this.activeNode.difficulty ?? 1;
    // Sky color shifts redder at higher difficulties
    const skyColor = diff >= 4 ? 0x1a0a0a : diff >= 3 ? 0x1a1025 : 0x1a1a3e;
    const groundColor = diff >= 4 ? 0x2a1005 : 0x2d5a1b;

    this.bg = this.add.graphics().setDepth(0);
    this.bg.fillStyle(skyColor, 1);
    this.bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.65);
    this.bg.fillStyle(diff >= 3 ? 0x2d1b35 : 0x2d1b35, 1);
    this.bg.fillRect(0, GAME_HEIGHT * 0.65, GAME_WIDTH, GAME_HEIGHT * 0.35);

    // Moon / sun
    if (diff >= 4) {
      // Blood moon
      this.bg.fillStyle(0x8B0000, 0.8);
      this.bg.fillCircle(GAME_WIDTH - 120, 80, 38);
    } else {
      this.bg.fillStyle(0xe8d5a3, 1);
      this.bg.fillCircle(GAME_WIDTH - 120, 80, 36);
      this.bg.fillStyle(skyColor, 1);
      this.bg.fillCircle(GAME_WIDTH - 108, 72, 30);
    }

    // Stars
    for (let i = 0; i < 60; i++) {
      const sx = Phaser.Math.Between(0, GAME_WIDTH);
      const sy = Phaser.Math.Between(0, GAME_HEIGHT * 0.55);
      this.bg.fillStyle(0xffffff, Math.random() * 0.5 + 0.2);
      this.bg.fillCircle(sx, sy, Math.random() < 0.15 ? 2 : 1);
    }

    // Ground
    this.bg.fillStyle(groundColor, 1);
    this.bg.fillRect(0, GAME_HEIGHT - 100, GAME_WIDTH, 100);
    this.bg.fillStyle(diff >= 4 ? 0x4a1a00 : 0x3d7a28, 1);
    this.bg.fillRect(0, GAME_HEIGHT - 100, GAME_WIDTH, 14);

    // ── Hill mound — sits between the sling and the enemy structures ─────────
    // Low-angle shots arc into the hill; higher lobs clear it naturally.
    const groundY  = GAME_HEIGHT - 100;   // y = 620, top of flat ground plane
    const peakY    = 545;                 // hill peak (75 px above ground)
    const moundL   = 170;                 // just past the sling at x=160
    const moundR   = 490;                 // just before first structure column ~x=472

    // Build the top-curve once, reuse for both earth and grass layers
    const moundTop: { x: number; y: number }[] = [];
    for (let i = 0; i <= 40; i++) {
      const t    = i / 40;
      const px   = moundL + t * (moundR - moundL);
      const elev = (groundY - peakY) * Math.pow(Math.sin(Math.PI * t), 1.6);
      moundTop.push({ x: px, y: groundY - elev });
    }

    // Earth/soil body fills down to bottom of screen
    const soilColor = diff >= 4 ? 0x2a1005 : 0x4a3010;
    this.bg.fillStyle(soilColor, 1);
    this.bg.fillPoints(
      [{ x: moundL, y: GAME_HEIGHT + 2 }, ...moundTop, { x: moundR, y: GAME_HEIGHT + 2 }],
      true,
    );

    // Grass cap — thin strip along the top surface
    const grassCapColor = diff >= 4 ? 0x3d2000 : 0x3d7a28;
    this.bg.fillStyle(grassCapColor, 1);
    this.bg.fillPoints(
      [...moundTop, ...[...moundTop].reverse().map(p => ({ x: p.x, y: p.y + 13 }))],
      true,
    );
  }

  // ─── Ground ─────────────────────────────────────────────────────────────
  private buildGround() {
    this.ground = this.matter.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT - 50,
      GAME_WIDTH, 100,
      { isStatic: true, label: 'ground', friction: 0.8, restitution: 0.04 },
    ) as MatterJS.BodyType;

    // Hill physics body — matches the visual mound between sling and structures.
    // Top surface sits at ~y=540, blocking flat/low-angle shots.
    // Two overlapping rects approximate the slope so heroes don't get snagged
    // on a single hard corner.
    const hillOpts = { isStatic: true, label: 'hill', friction: 0.6, restitution: 0.08 };
    this.matter.add.rectangle(330, 558, 160, 44, hillOpts);  // main body
    this.matter.add.rectangle(290, 580, 80,  20, hillOpts);  // left shoulder
    this.matter.add.rectangle(370, 580, 80,  20, hillOpts);  // right shoulder
  }

  // ─── Structure templates ─────────────────────────────────────────────────
  // Template keyed by difficulty level 1-5+
  private buildStructure() {
    const diff = this.activeNode.difficulty ?? 1;
    if (diff >= 5) {
      this.buildTemplateCitadel();
    } else if (diff >= 4) {
      this.buildTemplateKeep();
    } else if (diff === 3) {
      // Randomly pick Fortress Wall or The Pit
      Math.random() < 0.5 ? this.buildTemplateFortress() : this.buildTemplatePit();
    } else if (diff === 2) {
      // Randomly pick Two Towers or The Bridge
      Math.random() < 0.5 ? this.buildTemplateTwoTowers() : this.buildTemplateBridge();
    } else {
      this.buildTemplateTwoTowers();
    }
  }

  // Template 1 — "Two Towers" (difficulty 1–2)
  // GAP=0 (no settle jitter), bigger blocks, hollow rooms, narrow load-bearing pillar
  private buildTemplateTwoTowers() {
    const groundY = GAME_HEIGHT - 100;
    const BW = 56, BH = 30;
    const cx = (origin: number, c: number) => origin + BW / 2 + c * BW;
    const cy = (r: number) => groundY - BH / 2 - r * BH;
    const block = (x: number, y: number, mat: 'WOOD' | 'STONE', w = BW, h = BH) =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    // ── Left castle: 4-wide, hollow room in rows 2-4 ────────────────────────
    const LX = 450;
    // Solid stone base (rows 0-1)
    for (let r = 0; r <= 1; r++)
      for (let c = 0; c < 4; c++) block(cx(LX, c), cy(r), 'STONE');
    // Stone outer walls only (rows 2-4) — hollow room inside
    for (let r = 2; r <= 4; r++) {
      block(cx(LX, 0), cy(r), 'STONE');
      block(cx(LX, 3), cy(r), 'STONE');
    }
    // Wood ceiling beam spanning full width (row 5)
    block(LX + 2 * BW, cy(5), 'WOOD', 4 * BW, BH);
    // Upper story: stone outer + wood inner (rows 6-7)
    for (let r = 6; r <= 7; r++) {
      block(cx(LX, 0), cy(r), 'STONE');
      block(cx(LX, 3), cy(r), 'STONE');
      for (let c = 1; c <= 2; c++) block(cx(LX, c), cy(r), 'WOOD');
    }
    // Stone capstone beam (row 8)
    block(LX + 2 * BW, cy(8), 'STONE', 4 * BW, BH);

    // ── Middle: narrow pillar + heavy cap — destroy it and everything falls ──
    const MX = 810;
    for (let r = 0; r <= 5; r++) block(MX, cy(r), 'STONE', 24, BH);
    block(MX, cy(6), 'STONE', BW * 3, BH);

    // ── Right tower: 4-wide, taller, hollow lower room ──────────────────────
    const RX = 920;
    // Solid stone base (rows 0-1)
    for (let r = 0; r <= 1; r++)
      for (let c = 0; c < 4; c++) block(cx(RX, c), cy(r), 'STONE');
    // Stone outer walls (rows 2-3), hollow interior
    for (let r = 2; r <= 3; r++) {
      block(cx(RX, 0), cy(r), 'STONE');
      block(cx(RX, 3), cy(r), 'STONE');
    }
    // Wood ceiling (row 4)
    block(RX + 2 * BW, cy(4), 'WOOD', 4 * BW, BH);
    // Wooden upper section (rows 5-8)
    for (let r = 5; r <= 8; r++) {
      block(cx(RX, 0), cy(r), 'WOOD');
      block(cx(RX, 3), cy(r), 'WOOD');
      for (let c = 1; c <= 2; c++) block(cx(RX, c), cy(r), 'WOOD');
    }
    // Stone cap (row 9)
    block(RX + 2 * BW, cy(9), 'STONE', 4 * BW, BH);

    this.barrels.push(new Barrel(this, LX + 2 * BW, groundY - 18));
    this.barrels.push(new Barrel(this, MX, groundY - 18));
    this.barrels.push(new Barrel(this, RX + 2 * BW, groundY - 18));

    const eR = 20; // standard enemy body radius for placement
    this.placeEnemies([
      { x: LX + 2 * BW, y: groundY - 2 * BH - eR },    // on floor of left room
      { x: MX,          y: cy(6) - BH / 2 - eR },        // on top of load-bearing cap
      { x: RX + 2 * BW, y: groundY - 2 * BH - eR },     // on floor of right room
      { x: RX + 2 * BW, y: cy(9) - BH / 2 - eR },       // atop right tower cap
    ]);
  }

  // Template 2 — "Fortress Wall" (difficulty 3)
  // GAP=0, hollow gate arch, flanking towers with hollow rooms
  private buildTemplateFortress() {
    const groundY = GAME_HEIGHT - 100;
    const BW = 50, BH = 26;
    const cx = (o: number, c: number) => o + BW / 2 + c * BW;
    const cy = (r: number) => groundY - BH / 2 - r * BH;
    const block = (x: number, y: number, mat: 'WOOD' | 'STONE', w = BW, h = BH) =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    // ── Main wall: 10 cols × 4 rows, gate arch hollow at cols 4-5 rows 0-3 ──
    const WX = 470;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 10; c++) {
        if (c >= 4 && c <= 5 && r <= 3) continue; // gate opening + lintel row
        block(cx(WX, c), cy(r), r < 2 ? 'STONE' : 'WOOD');
      }
    }
    // Stone lintel beam spanning the gate arch at row 3
    block(WX + 5 * BW, cy(3), 'STONE', 2 * BW, BH);
    // Battlements: alternating merlons at row 4
    for (let c = 0; c < 10; c += 2)
      block(cx(WX, c), cy(4), 'STONE');

    // ── Two flanking towers: 2-wide, stone base + tall wooden upper section ──
    const T1X = WX - 2 * BW;  // left of wall
    const T2X = WX + 10 * BW; // right of wall
    for (const TX of [T1X, T2X]) {
      // Stone lower section (rows 0-5)
      for (let r = 0; r <= 5; r++) {
        block(cx(TX, 0), cy(r), 'STONE');
        block(cx(TX, 1), cy(r), 'STONE');
      }
      // Wood upper section (rows 6-7)
      for (let r = 6; r <= 7; r++) {
        block(cx(TX, 0), cy(r), 'WOOD');
        block(cx(TX, 1), cy(r), 'WOOD');
      }
      // Stone tower cap
      block(TX + BW, cy(8), 'STONE', 2 * BW, BH);
    }

    this.barrels.push(new Barrel(this, cx(WX, 2), groundY - 18));
    this.barrels.push(new Barrel(this, cx(WX, 7), groundY - 18));

    const eR = 20;
    this.placeEnemies([
      { x: T1X + BW,  y: cy(8) - BH / 2 - eR },   // on top of left tower cap
      { x: cx(WX, 2), y: groundY - eR },             // on ground behind wall
      { x: cx(WX, 7), y: groundY - eR },             // on ground behind wall
      { x: T2X + BW,  y: cy(8) - BH / 2 - eR },    // on top of right tower cap
    ]);
  }

  // Template 3 — "Keep" (difficulty 4+)
  // GAP=0, hollow corner tower rooms, same grand scale
  private buildTemplateKeep() {
    const groundY = GAME_HEIGHT - 100;
    const BW = 44, BH = 22;
    const cx = (o: number, c: number) => o + BW / 2 + c * BW;
    const cy = (r: number) => groundY - BH / 2 - r * BH;
    const block = (x: number, y: number, mat: 'WOOD' | 'STONE', w = BW, h = BH) =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    // Massive stone base 14 wide × 3 high
    const BX = 420;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 14; c++)
        block(cx(BX, c), cy(r), 'STONE');

    // Four corner towers (3-wide each): hollow rooms in rows 3-5
    const towerOrigins = [BX, BX + 3 * BW, BX + 7 * BW, BX + 11 * BW];
    for (const TX of towerOrigins) {
      // Hollow room: outer walls only rows 3-5
      for (let r = 3; r <= 5; r++) {
        block(cx(TX, 0), cy(r), 'STONE');
        block(cx(TX, 2), cy(r), 'STONE');
        // col 1 empty = room
      }
      // Wood ceiling at row 6
      block(TX + BW + BW / 2, cy(6), 'WOOD', 3 * BW, BH);
      // Upper section rows 7-9
      for (let r = 7; r <= 9; r++) {
        block(cx(TX, 0), cy(r), r < 9 ? 'STONE' : 'WOOD');
        block(cx(TX, 1), cy(r), 'WOOD');
        block(cx(TX, 2), cy(r), r < 9 ? 'STONE' : 'WOOD');
      }
    }

    // Connecting walls between towers
    for (let r = 3; r < 5; r++) {
      for (let c = 3; c < 7; c++) block(cx(BX, c), cy(r), 'STONE');
      for (let c = 10; c < 14; c++) block(cx(BX, c), cy(r), 'STONE');
    }
    // Upper wooden bridges
    for (let r = 5; r < 7; r++) {
      for (let c = 3; c < 7; c++) block(cx(BX, c), cy(r), 'WOOD');
      for (let c = 10; c < 14; c++) block(cx(BX, c), cy(r), 'WOOD');
    }

    // Central keep (tallest): rows 3-11
    const KX = BX + 7 * BW;
    for (let r = 3; r < 12; r++)
      for (let c = 0; c < 3; c++)
        block(cx(KX, c), cy(r), r < 8 ? 'STONE' : 'WOOD');

    // Battlements
    for (let c = 0; c < 3; c++) block(cx(KX, c), cy(12), 'STONE');
    block(BX + 7 * BW, cy(9), 'STONE', 14 * BW, BH);

    // Barrels — lots for the big fight
    this.barrels.push(new Barrel(this, cx(BX, 2),  groundY - 18));
    this.barrels.push(new Barrel(this, cx(BX, 7),  groundY - 18));
    this.barrels.push(new Barrel(this, cx(BX, 11), groundY - 18));
    this.barrels.push(new Barrel(this, cx(KX, 1),  cy(12) - BH));

    const eR = 20;
    this.placeEnemies([
      { x: cx(BX, 1),  y: groundY - eR },
      { x: cx(BX, 6),  y: groundY - eR },
      { x: cx(BX, 11), y: groundY - eR },
      { x: cx(KX, 1),  y: cy(9) - BH / 2 - eR },   // atop the central keep
    ]);
  }

  // Template 4 — "The Bridge" (difficulty 2)
  // Elevated narrow walkway with support pillars — destroy supports to collapse
  private buildTemplateBridge() {
    const groundY = GAME_HEIGHT - 100;
    const BW = 50, BH = 28;
    const cx = (o: number, c: number) => o + BW / 2 + c * BW;
    const cy = (r: number) => groundY - BH / 2 - r * BH;
    const block = (x: number, y: number, mat: 'WOOD' | 'STONE', w = BW, h = BH) =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    const BX = 480;
    // Left support pillar (2 wide, 4 tall)
    for (let r = 0; r < 4; r++) {
      block(cx(BX, 0), cy(r), 'STONE');
      block(cx(BX, 1), cy(r), 'STONE');
    }
    // Right support pillar (2 wide, 4 tall)
    for (let r = 0; r < 4; r++) {
      block(cx(BX, 8), cy(r), 'STONE');
      block(cx(BX, 9), cy(r), 'STONE');
    }
    // Narrow center pillar (destroyable — load-bearing!)
    for (let r = 0; r < 4; r++) {
      block(cx(BX, 5), cy(r), 'WOOD', 24, BH);
    }
    // Bridge deck spanning full width at row 4
    for (let c = 0; c < 10; c++) {
      block(cx(BX, c), cy(4), 'WOOD');
    }
    // Railings (alternating blocks at row 5)
    for (let c = 0; c < 10; c += 2) {
      block(cx(BX, c), cy(5), 'WOOD');
    }

    this.barrels.push(new Barrel(this, cx(BX, 5), groundY - 18));
    this.barrels.push(new Barrel(this, cx(BX, 3), cy(4) - BH));

    const eR = 20;
    this.placeEnemies([
      { x: cx(BX, 2), y: cy(4) - BH / 2 - eR },   // on bridge left
      { x: cx(BX, 5), y: cy(5) - BH / 2 - eR },   // on bridge center
      { x: cx(BX, 8), y: cy(4) - BH / 2 - eR },   // on bridge right
      { x: cx(BX, 5), y: groundY - eR },             // on ground below
    ]);
  }

  // Template 5 — "The Pit" (difficulty 3)
  // Sunken area with thick walls — requires arcing shots over walls or breaking through
  private buildTemplatePit() {
    const groundY = GAME_HEIGHT - 100;
    const BW = 48, BH = 26;
    const cx = (o: number, c: number) => o + BW / 2 + c * BW;
    const cy = (r: number) => groundY - BH / 2 - r * BH;
    const block = (x: number, y: number, mat: 'WOOD' | 'STONE', w = BW, h = BH) =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    const PX = 500;
    // Pit floor (row 0, sunken — stone base)
    for (let c = 0; c < 8; c++) block(cx(PX, c), cy(0), 'STONE');
    // Left wall (3 tall stone)
    for (let r = 1; r <= 5; r++) {
      block(cx(PX, 0), cy(r), 'STONE');
      block(cx(PX, 1), cy(r), r <= 3 ? 'STONE' : 'WOOD');
    }
    // Right wall (3 tall stone)
    for (let r = 1; r <= 5; r++) {
      block(cx(PX, 6), cy(r), r <= 3 ? 'STONE' : 'WOOD');
      block(cx(PX, 7), cy(r), 'STONE');
    }
    // Weak wood ceiling over the center (breakable entry point)
    for (let c = 2; c <= 5; c++) {
      block(cx(PX, c), cy(3), 'WOOD');
    }
    // Inner floor platforms at different heights
    block(cx(PX, 2), cy(1), 'WOOD');
    block(cx(PX, 5), cy(1), 'WOOD');

    this.barrels.push(new Barrel(this, cx(PX, 3), groundY - 18));
    this.barrels.push(new Barrel(this, cx(PX, 4), cy(3) - BH));

    const eR = 20;
    this.placeEnemies([
      { x: cx(PX, 3), y: groundY - BH - eR },       // in pit floor
      { x: cx(PX, 5), y: groundY - BH - eR },       // in pit floor
      { x: cx(PX, 1), y: cy(5) - BH / 2 - eR },    // atop left wall
      { x: cx(PX, 6), y: cy(5) - BH / 2 - eR },    // atop right wall
    ]);
  }

  // Template 6 — "The Citadel" (difficulty 5+, Boss-specific)
  // Multi-tier fortress with separate rooms, internal barrels, throne room at top
  private buildTemplateCitadel() {
    const groundY = GAME_HEIGHT - 100;
    const BW = 40, BH = 20;
    const cx = (o: number, c: number) => o + BW / 2 + c * BW;
    const cy = (r: number) => groundY - BH / 2 - r * BH;
    const block = (x: number, y: number, mat: 'WOOD' | 'STONE', w = BW, h = BH) =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    const CX = 380;
    // Massive stone foundation (16 wide × 3 tall)
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 16; c++)
        block(cx(CX, c), cy(r), 'STONE');

    // Lower level: two large rooms side by side (rows 3-6)
    // Left room: walls at col 0, 7 (hollow 1-6)
    for (let r = 3; r <= 6; r++) {
      block(cx(CX, 0), cy(r), 'STONE');
      block(cx(CX, 7), cy(r), 'STONE');
    }
    // Right room: walls at col 8, 15 (hollow 9-14)
    for (let r = 3; r <= 6; r++) {
      block(cx(CX, 8), cy(r), 'STONE');
      block(cx(CX, 15), cy(r), 'STONE');
    }
    // Floor between levels
    for (let c = 0; c < 16; c++)
      block(cx(CX, c), cy(7), c < 8 ? 'STONE' : 'WOOD');

    // Upper level: central throne room (rows 8-12)
    for (let r = 8; r <= 12; r++) {
      block(cx(CX, 4), cy(r), 'STONE');
      block(cx(CX, 11), cy(r), 'STONE');
    }
    // Throne room interior wood elements
    for (let r = 8; r <= 10; r++) {
      block(cx(CX, 5), cy(r), 'WOOD');
      block(cx(CX, 10), cy(r), 'WOOD');
    }
    // Throne room ceiling
    for (let c = 4; c <= 11; c++)
      block(cx(CX, c), cy(13), 'STONE');
    // Battlements on top
    for (let c = 4; c <= 11; c += 2)
      block(cx(CX, c), cy(14), 'STONE');

    // Side towers (flanking)
    for (let r = 8; r <= 11; r++) {
      block(cx(CX, 0), cy(r), 'STONE');
      block(cx(CX, 1), cy(r), 'WOOD');
      block(cx(CX, 14), cy(r), 'WOOD');
      block(cx(CX, 15), cy(r), 'STONE');
    }
    block(cx(CX, 0) + BW / 2, cy(12), 'STONE', 2 * BW, BH);
    block(cx(CX, 14) + BW / 2, cy(12), 'STONE', 2 * BW, BH);

    // Barrels — many for the epic boss fight
    this.barrels.push(new Barrel(this, cx(CX, 3), groundY - 18));
    this.barrels.push(new Barrel(this, cx(CX, 12), groundY - 18));
    this.barrels.push(new Barrel(this, cx(CX, 7), cy(7) - BH));
    this.barrels.push(new Barrel(this, cx(CX, 8), cy(7) - BH));
    this.barrels.push(new Barrel(this, cx(CX, 7), cy(13) - BH));

    const eR = 20;
    this.placeEnemies([
      { x: cx(CX, 3),  y: groundY - 3 * BH - eR },   // left room
      { x: cx(CX, 12), y: groundY - 3 * BH - eR },   // right room
      { x: cx(CX, 7),  y: cy(13) - BH / 2 - eR },    // throne room
      { x: cx(CX, 1),  y: cy(12) - BH / 2 - eR },    // left tower top
      { x: cx(CX, 14), y: cy(12) - BH / 2 - eR },    // right tower top
      { x: cx(CX, 7),  y: groundY - eR },              // ground level
    ]);
  }

  // ─── Place enemies from node data ─────────────────────────────────────────
  private placeEnemies(slots: Array<{ x: number; y: number }>) {
    const run = getRunState();
    const ascMods = getAscensionModifiers(run.ascensionLevel);
    const enemyList = [...(this.activeNode.enemies ?? ['GRUNT', 'GRUNT'])];

    // Ascension: add extra enemies
    if (ascMods.extraEnemies > 0 && enemyList.length > 0) {
      for (let i = 0; i < ascMods.extraEnemies; i++) {
        enemyList.push(enemyList[i % enemyList.length]);
      }
    }

    // ELITE/BOSS nodes have tougher enemies — scale their HP
    const baseHpMult = this.activeNode.type === 'BOSS' ? 1.5
                     : this.activeNode.type === 'ELITE' ? 1.25
                     : 1.0;
    // Ascension HP scaling
    const bossExtra = this.activeNode.type === 'BOSS' ? ascMods.bossHpMult : ascMods.enemyHpMult;
    const hpMult = baseHpMult * bossExtra;

    enemyList.forEach((cls, i) => {
      const slot = slots[i % slots.length];
      const jitter = i >= slots.length ? Phaser.Math.Between(-30, 30) : 0;
      this.enemies.push(new Enemy(this, slot.x + jitter, slot.y, cls as EnemyClass, hpMult));
    });
  }

  // ─── Squad ─────────────────────────────────────────────────────────────
  private buildSquad() {
    const run = getRunState();
    const mods = getRelicModifiers();
    const ascMods = getAscensionModifiers(run.ascensionLevel);

    // Ascension: fewer heroes
    let squadData = [...run.squad];
    if (ascMods.fewerHeroes > 0 && squadData.length > 1) {
      squadData = squadData.slice(0, Math.max(1, squadData.length - ascMods.fewerHeroes));
    }

    for (const heroData of squadData) {
      const hero = new Hero(this, heroData.heroClass);
      // Apply relic HP bonus to maxHp, then restore persisted HP (death → 25% revive)
      hero.applyHpBonus(mods.flatHpBonus);
      hero.setStartHp(heroData.currentHp);
      // Death saves (relic)
      if (mods.deathSaves > 0) hero.setDeathSaves(mods.deathSaves);
      // Damage reduction (relic + Paladin innate)
      hero.damageReduction = mods.damageReduction;
      if (hero.heroClass === 'PALADIN') {
        hero.damageReduction += HERO_STATS.PALADIN.damageReduction;
        hero.hasDivineShield = true; // Paladin passive
      }
      this.heroes.push(hero);
      recordHeroUsed(heroData.heroClass);
    }

    // Extra launches relic: add duplicate heroes based on last squad member
    if (mods.extraLaunches > 0 && squadData.length > 0) {
      const lastClass = squadData[squadData.length - 1].heroClass;
      for (let i = 0; i < mods.extraLaunches; i++) {
        const extra = new Hero(this, lastClass);
        extra.applyHpBonus(mods.flatHpBonus);
        extra.setStartHp(extra.maxHp);
        if (mods.deathSaves > 0) extra.setDeathSaves(mods.deathSaves);
        extra.damageReduction = mods.damageReduction;
        if (lastClass === 'PALADIN') {
          extra.damageReduction += HERO_STATS.PALADIN.damageReduction;
          extra.hasDivineShield = true;
        }
        this.heroes.push(extra);
      }
    }

    // Fallback: if ALL dead (shouldn't happen but safety net)
    if (this.heroes.length === 0) {
      for (let i = 0; i < STARTER_SQUAD_SIZE; i++) {
        const cls: HeroClass[] = ['WARRIOR', 'RANGER', 'MAGE', 'PRIEST'];
        this.heroes.push(new Hero(this, cls[i]));
      }
    }
  }

  // ─── Systems ────────────────────────────────────────────────────────────
  private buildSystems() {
    this.audio = new AudioSystem();
    this.registry.set('audio', this.audio); // shared with SettingsScene

    this.combatSystem = new CombatSystem(this, this.heroes, this.enemies);
    this.impactSystem = new ImpactSystem(this, this.combatSystem, this.heroes);
    this.timeoutSystem = new TimeoutSystem(this);
    this.launchSystem = new LaunchSystem(this, this.heroes);
    this.squadUI = new SquadUI(this, this.heroes);

    // Enemies-remaining counter panel (top-right)
    this.enemyPanel = this.add.graphics().setDepth(49);
    this.enemyPanel.fillStyle(0x060b12, 0.88);
    this.enemyPanel.fillRoundedRect(GAME_WIDTH - 174, 12, 162, 42, 7);
    this.enemyPanel.lineStyle(1, 0x5a1010, 0.7);
    this.enemyPanel.strokeRoundedRect(GAME_WIDTH - 174, 12, 162, 42, 7);

    // Static "ENEMIES" label
    this.add.text(GAME_WIDTH - 93, 20, 'ENEMIES', {
      fontSize: '9px', fontFamily: 'monospace',
      color: '#5a3a3a', letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(50);

    this.enemyCountText = this.add.text(GAME_WIDTH - 93, 32,
      `${this.enemies.length}`, {
        fontSize: '20px', fontStyle: 'bold', fontFamily: 'Georgia, serif',
        color: '#e74c3c', stroke: '#000', strokeThickness: 3,
      },
    ).setOrigin(0.5, 0).setDepth(50);

    // Gear / settings button — top-left corner
    this.buildSettingsButton();

    this.launchSystem.onLaunch = () => {
      this.audio.playLaunch();
      if (!isTutorialComplete()) {
        completeStep('releaseToFire');
        completeStep('trajectoryDots');
        this.updateTutorialHint();
      }
      if (this.launchSystem.allLaunched) this.startTimeoutIfNeeded();
    };

    // Damage events → shake camera + reset stall timer
    const onDmg = () => {
      this.timeoutSystem.resetOnDamage();
      this.shakeQueued = Math.min(this.shakeQueued + 0.002, 0.012);
    };
    this.impactSystem.onDamageEvent = onDmg;
    this.combatSystem.onDamageEvent = onDmg;
    this.combatSystem.blocks = this.blocks;

    this.timeoutSystem.onTimeout = () => {
      const anyAlive = this.enemies.some(e => e.state !== 'dead');
      this.endBattle(!anyAlive, 'Time ran out!');
    };
  }

  // ─── Collision handlers ──────────────────────────────────────────────────
  private buildCollisionHandlers() {
    this.matter.world.on('collisionstart', (event: MatterJS.IEventCollision<MatterJS.Engine>) => {
      for (const pair of event.pairs) {
        this.processCollisionPair(
          pair.bodyA as MatterJS.BodyType,
          pair.bodyB as MatterJS.BodyType,
          pair,
        );
      }
    });
  }

  private processCollisionPair(bA: MatterJS.BodyType, bB: MatterJS.BodyType, _pair: MatterJS.IPair) {
    const heroA = (bA as any).__hero as Hero | undefined;
    const heroB = (bB as any).__hero as Hero | undefined;
    const hero = heroA ?? heroB;
    const other = hero === heroA ? bB : bA;

    if (hero && hero.state === 'flying') {
      // Rogue piercing: if flying through a block with piercing flag, deal damage but don't stop
      if (hero.piercing && (other as any).label?.startsWith('block_')) {
        const block = this.blocks.find(b => b.body === other);
        if (block && !block.destroyed) {
          const v = hero.body?.velocity ?? { x: 0, y: 0 };
          const speed = Math.hypot(v.x, v.y);
          block.applyDamage(speed * 15); // piercing damage
          hero.piercing = false; // clear after first pierce
        }
        return; // don't trigger normal impact — hero keeps flying
      }

      const v = hero.body?.velocity ?? { x: 0, y: 0 };
      const speed = Math.hypot(v.x, v.y);
      const mass  = hero.body?.mass ?? 1;
      const force = 0.5 * mass * speed * speed;

      // Cooldown prevents multi-fire within the same physics step; min force avoids dust triggers
      const now = this.time.now;
      const cooldown = hero.heroClass === 'RANGER' ? 180 : 250;
      if (force > 1.5 && now - hero.lastImpactTime > cooldown) {
        this.impactSystem.handleHeroImpact(hero, force, this.blocks, this.enemies, this.barrels);
        recordLaunchDamage(force);
        if (hero.heroClass === 'MAGE') {
          this.audio.playExplosion();
        } else {
          this.audio.playHeroLand();
        }
        // Camera shake scales with kinetic energy
        const shakeStrength = Math.min(0.018, Math.max(0.004, force * 0.000015));
        this.cameras.main.shake(150, shakeStrength);
      }
    }

    // Coin pickup — any flying hero that touches a coin sensor collects it
    if (hero) {
      const coinBody = bA.label === 'coin' ? bA : bB.label === 'coin' ? bB : null;
      if (coinBody) this.processCoinPickup(coinBody);
    }

    // Block crush check
    const label = (other as any).label as string | undefined;
    if (label?.startsWith('block_')) {
      const block = this.blocks.find(b => b.body === other || b.body === bA);
      if (block && !block.destroyed) {
        this.impactSystem.handleBlockCrush(block, this.heroes, this.enemies);
      }
    }

  }

  // ─── Events ──────────────────────────────────────────────────────────────
  private buildEventHandlers() {
    this.events.on('barrelExploded', (x: number, y: number, r: number, dmg: number) => {
      this.impactSystem.handleBarrelExplosion(x, y, r, dmg, this.blocks, this.enemies, this.heroes, this.barrels);
      this.cameras.main.shake(350, 0.015);
      this.cameras.main.flash(80, 255, 160, 30, false);
      DamageNumber.bigHit(this, x, y, dmg);
      this.audio.playExplosion();
      this.barrelExplosionsThisBattle++;
    });

    this.events.on('blockDestroyed', (x: number, y: number, mat: string) => {
      this.spawnDebris(x, y, mat as 'WOOD' | 'STONE');
      this.cameras.main.shake(80, 0.003);
      this.audio.playBlockHit(mat as 'WOOD' | 'STONE');
      this.blocksDestroyedThisBattle++;
      addBlocksDestroyed(1);
      // Near-miss flinch: enemies close but not crushed visually react
      for (const e of this.enemies) {
        if (e.state === 'dead') continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (d > 28 && d < 85) {
          this.tweens.add({
            targets: e.sprite,
            scaleX: 1.25, scaleY: 1.25,
            duration: 75, ease: 'Power1', yoyo: true,
          });
        }
      }
      // Mage Arcane Instability passive: 20% chance to chain-explode near a Mage
      for (const h of this.heroes) {
        if (h.state === 'dead' || h.heroClass !== 'MAGE') continue;
        const d = Math.hypot(h.x - x, h.y - y);
        if (d < 120 && Math.random() < 0.20) {
          this.events.emit('barrelExploded', x, y, 80, 30);
          break; // one explosion per block
        }
      }
    });

    this.events.on('priestHealAura', (x: number, y: number, radius: number, amount: number) => {
      for (const h of this.heroes) {
        if (h.state === 'dead') continue;
        const d = Math.hypot(h.x - x, h.y - y);
        if (d < radius) {
          h.heal(amount);
          DamageNumber.heal(this, h.x, h.y, amount);
        }
      }
    });

    // Forward damage events from ImpactSystem for floating numbers
    this.events.on('blockDamage', (x: number, y: number, amount: number) => {
      DamageNumber.blockDamage(this, x, y, amount);
    });
    this.events.on('unitDamage', (x: number, y: number, amount: number) => {
      DamageNumber.damage(this, x, y, amount);
    });

    // Bomber death explosion — damages heroes nearby (similar to barrel but smaller)
    this.events.on('bomberExploded', (x: number, y: number, r: number, dmg: number) => {
      this.impactSystem.handleBarrelExplosion(x, y, r, dmg, this.blocks, this.enemies, this.heroes, this.barrels);
      this.cameras.main.shake(250, 0.010);
      this.cameras.main.flash(60, 160, 60, 200, false);
      DamageNumber.bigHit(this, x, y, dmg);
      this.audio.playExplosion();
    });

    this.events.on('enemyDied', (enemy?: Enemy) => {
      this.audio.playEnemyDeath();
      // Gold-on-kill relic
      this.coinGoldBonus += this.combatSystem.killGoldBonus;
      this.combatSystem.killGoldBonus = 0;
      const mods = getRelicModifiers();
      if (mods.goldOnKill > 0) this.coinGoldBonus += mods.goldOnKill;
      // Encore passive (Bard): if any Bard is alive, next hero launches with +15% power
      const hasBard = this.heroes.some(h => h.heroClass === 'BARD' && h.state !== 'dead');
      if (hasBard) this.launchSystem.encoreActive = true;
      // Track discovery + stats
      this.enemiesKilledThisBattle++;
      addEnemiesKilled(1);
      if (enemy?.enemyClass) recordEnemyKill(enemy.enemyClass);
      this.checkWin();
    });
    this.events.on('heroDied', (hero?: Hero) => {
      // Priest Martyr passive: when a Priest dies, heal all living heroes for 15
      if (hero?.heroClass === 'PRIEST') {
        for (const h of this.heroes) {
          if (h.state !== 'dead' && h !== hero) {
            h.heal(15);
            DamageNumber.heal(this, h.x, h.y, 15);
          }
        }
      }
      this.checkLoss();
    });

    // Paladin ability: spawn temporary shield wall blocks
    this.events.on('spawnTempBlock', (x: number, y: number, mat: string) => {
      const b = new Block(this, x, y, 56, 30, mat as 'WOOD' | 'STONE');
      this.blocks.push(b);
      // Auto-destroy after 8 seconds
      this.time.delayedCall(8000, () => {
        if (!b.destroyed) {
          b.applyDamage(9999); // force destroy
        }
      });
    });

    // Druid ability: spawn wolf minions that deal damage to nearby enemies
    this.events.on('spawnWolf', (x: number, y: number, dmg: number, hp: number) => {
      this.spawnWolfMinion(x, y, dmg, hp);
    });

    // DEMON_KNIGHT thorns: reflect damage to nearest hero
    this.events.on('thornsReflect', (ex: number, ey: number, dmg: number) => {
      let nearest: Hero | null = null;
      let nearestDist = 80;
      for (const h of this.heroes) {
        if (h.state === 'dead') continue;
        const d = Math.hypot(h.x - ex, h.y - ey);
        if (d < nearestDist) { nearestDist = d; nearest = h; }
      }
      if (nearest) {
        nearest.applyDamage(dmg);
        DamageNumber.damage(this, nearest.x, nearest.y, Math.round(dmg));
      }
    });
  }

  // ─── Win / Loss ────────────────────────────────────────────────────────────
  private startTimeoutIfNeeded() {
    if (!this.timeoutStarted) {
      this.timeoutStarted = true;
      this.timeoutSystem.start();
    }
  }

  private checkWin() {
    if (this.battleEnded) return;
    if (this.enemies.every(e => e.state === 'dead')) this.endBattle(true, 'All enemies defeated!');
  }

  private checkLoss() {
    if (this.battleEnded) return;
    if (
      this.launchSystem.allLaunched &&
      this.heroes.every(h => h.state === 'dead') &&
      this.enemies.some(e => e.state !== 'dead')
    ) {
      this.endBattle(false, 'All heroes defeated.');
    }
  }

  private endBattle(victory: boolean, reason: string) {
    if (this.battleEnded) return;
    this.battleEnded = true;
    this.matter.world.enabled = false;
    this.timeoutSystem.stop();
    if (this.endRunBtn) this.endRunBtn.setVisible(false);

    if (victory) {
      this.audio.playWin();
      syncSquadHp(this.heroes.map(h => ({ heroClass: h.heroClass, hp: h.hp, maxHp: h.maxHp, state: h.state })));
      completeNode(this.activeNode.id);
    } else {
      this.audio.playLose();
    }

    // Record battle time
    const battleTimeMs = this.time.now - this.battleStartTime;
    recordBattleTime(battleTimeMs);

    // Track boss kills
    if (victory && this.activeNode.type === 'BOSS') {
      incrementStat('bosses_killed');
    }

    // Achievement checks
    const run = getRunState();
    checkAchievements({
      battlesWon: victory ? 1 : 0,
      blocksDestroyed: this.blocksDestroyedThisBattle,
      battleTimeMs,
      relicCount: run.relics.length,
      curseCount: run.relics.filter(r => r.curse).length,
      squadSize: run.squad.length,
      barrelExplosions: this.barrelExplosionsThisBattle,
      combatKills: this.enemiesKilledThisBattle,
    });

    // Tutorial step: combat explained
    if (!isTutorialComplete()) {
      completeStep('combatExplained');
    }

    const mods = getRelicModifiers();
    let gold = victory ? (this.activeNode.gold ?? 20) + this.coinGoldBonus + mods.goldOnWin : 0;
    // Gold tax curse
    if (mods.goldTaxPct > 0 && gold > 0) {
      gold = Math.round(gold * (1 - mods.goldTaxPct));
    }
    // Ascension: reduced gold
    const ascMods = getAscensionModifiers(run.ascensionLevel);
    if (ascMods.reducedGold && gold > 0) {
      gold = Math.round(gold * 0.5);
    }

    // Chaos modifier: add a random relic AND a random curse after each victory
    if (victory && run.activeModifiers.includes('chaos')) {
      const allRelics = (relicsData as any[]).filter((r: any) => !r.curse);
      const allCurses = (cursesData as any[]).filter((r: any) => r.curse === true);
      if (allRelics.length > 0) {
        const rr = allRelics[Math.floor(Math.random() * allRelics.length)];
        addRelic(rr as RelicDef);
      }
      if (allCurses.length > 0) {
        const rc = allCurses[Math.floor(Math.random() * allCurses.length)];
        addRelic(rc as RelicDef);
      }
    }

    this.time.delayedCall(800, () => {
      this.scene.start('ResultScene', { victory, reason, gold, nodeId: this.activeNode.id });
    });
  }

  // ─── Coins ─────────────────────────────────────────────────────────────────
  /** Place coins at positions reachable along typical hero flight arcs. */
  private spawnCoins() {
    const diff = this.activeNode.difficulty ?? 1;
    const groundY = GAME_HEIGHT - 100;
    const BH = diff >= 4 ? 22 : diff === 3 ? 26 : 30;
    const cy = (r: number) => groundY - BH / 2 - r * BH;

    // Coin layouts per template. Each entry: [x, y, value]
    // Positions chosen to lie along arc trajectories heroes naturally follow,
    // but slightly off-centre so there's skill involved.
    let layout: Array<[number, number, number]>;

    if (diff >= 4) {
      // The Keep — tall structure, spread wide
      layout = [
        [270, 340, 3],   // early arc, low-mid
        [460, 230, 4],   // high arc above base
        [660, 260, 4],   // mid-structure approach
        [860, 250, 5],   // deep, rewarding
        [1060, 320, 5],  // back wall (high drag required)
      ];
    } else if (diff === 3) {
      // Fortress Wall
      layout = [
        [280, 340, 3],   // approach arc
        [520, 230, 4],   // above wall battlements
        [710, 260, 4],   // through gate arch area
        [960, 270, 5],   // above right tower
      ];
    } else {
      // Two Towers
      layout = [
        [240, 360, 2],            // easy — early arc
        [420, 270, 3],            // medium — peak of a high arc
        [640, 340, 3],            // between hill and left tower
        [810, cy(7) - 30, 4],    // above the load-bearing cap (tricky angle)
        [1010, 320, 4],           // approach to right tower
      ];
    }

    // Ascension: reduced gold → halve coin count
    const run = getRunState();
    const ascMods = getAscensionModifiers(run.ascensionLevel);
    let coinLayout = layout;
    if (ascMods.reducedGold && layout.length > 1) {
      coinLayout = layout.filter((_, i) => i % 2 === 0);
    }

    for (const [x, y, value] of coinLayout) {
      this.coins.push(new Coin(this, x, y, value));
    }
  }

  private processCoinPickup(coinBody: MatterJS.BodyType) {
    const coin = this.coins.find(c => c.body === coinBody && !c.collected);
    if (!coin) return;

    coin.collect();

    // Remove body immediately (it's a static sensor, safe to do mid-collision handler)
    this.matter.world.remove(coinBody as any);

    this.coinGoldBonus += coin.value;

    // Floating gold text at current bob position (y tracks the bob tween)
    DamageNumber.show(this, coin.x, coin.graphics.y, coin.value, {
      prefix: '+', color: '#f1c40f', fontSize: 22,
    });

    this.audio.playCoinPickup();
  }

  /** Class-coloured dot that fades quickly — creates a visual trail during flight. */
  private spawnTrailDot(x: number, y: number, heroClass: HeroClass) {
    const cols: Partial<Record<HeroClass, number>> = {
      WARRIOR: 0xc0392b, RANGER: 0x27ae60, MAGE: 0x8e44ad, PRIEST: 0xf39c12, BARD: 0x1abc9c,
      ROGUE: 0x2c3e50, PALADIN: 0xf1c40f, DRUID: 0x16a085,
    };
    const g = this.add.graphics().setDepth(7);
    g.fillStyle(cols[heroClass] ?? 0xaaaaaa, 0.6);
    g.fillCircle(0, 0, Phaser.Math.Between(2, 4));
    g.setPosition(
      x + Phaser.Math.Between(-3, 3),
      y + Phaser.Math.Between(-3, 3),
    );
    this.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 0.15, scaleY: 0.15,
      duration: 280,
      ease: 'Linear',
      onComplete: () => g.destroy(),
    });
  }

  // ─── Debris ────────────────────────────────────────────────────────────────
  private spawnDebris(x: number, y: number, material: 'WOOD' | 'STONE') {
    const isWood = material === 'WOOD';
    const woodColors  = [0x8B5E3C, 0x6B4020, 0xA07040, 0x7B4E2C];
    const stoneColors = [0x7f8c8d, 0x606060, 0x9f9f9f, 0x5a6a6b];

    for (let i = 0; i < 9; i++) {
      const g = this.add.graphics().setDepth(15);
      const col = isWood
        ? woodColors[Phaser.Math.Between(0, 3)]
        : stoneColors[Phaser.Math.Between(0, 3)];
      g.fillStyle(col, 1);

      if (isWood) {
        // Rectangular splinters
        const sw = Phaser.Math.Between(5, 14);
        const sh = Phaser.Math.Between(2, 5);
        g.fillRect(-sw / 2, -sh / 2, sw, sh);
      } else {
        // Rounded stone chunks
        g.fillCircle(0, 0, Phaser.Math.Between(3, 7));
      }

      g.setPosition(x, y);
      const vx = Phaser.Math.Between(-140, 140);
      const vy = Phaser.Math.Between(-220, -55);
      this.tweens.add({
        targets: g,
        x: x + vx * 0.7,
        y: y + vy * 0.35,
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: Phaser.Math.Between(350, 750),
        ease: 'Power2',
        onComplete: () => g.destroy(),
      });
    }
  }

  // ─── Wolf minion (Druid ability) ────────────────────────────────────────────
  private spawnWolfMinion(x: number, y: number, dmg: number, hp: number) {
    const wolf = this.add.graphics().setDepth(12);
    wolf.fillStyle(0x16a085, 0.9);
    wolf.fillCircle(0, 0, 10);
    wolf.fillStyle(0x1abc9c, 1);
    wolf.fillCircle(3, -3, 3); // "eye"
    wolf.setPosition(x, y);

    let wolfHp = hp;
    let attackTimer = 0;
    const wolfSpeed = 1.5;

    // Wolf AI: runs toward nearest living enemy, attacks periodically
    const wolfUpdate = () => {
      if (wolfHp <= 0 || this.battleEnded) {
        wolf.destroy();
        this.time.removeEvent(updateEvent);
        return;
      }

      // Find nearest living enemy
      let nearest: Enemy | null = null;
      let nearestDist = Infinity;
      for (const e of this.enemies) {
        if (e.state === 'dead') continue;
        const d = Math.hypot(e.x - wolf.x, e.y - wolf.y);
        if (d < nearestDist) { nearestDist = d; nearest = e; }
      }

      if (nearest) {
        // Move toward enemy
        const dx = nearest.x - wolf.x;
        const dy = nearest.y - wolf.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 20) {
          wolf.x += (dx / dist) * wolfSpeed;
          wolf.y += (dy / dist) * wolfSpeed;
        }

        // Attack if close enough
        attackTimer += 50; // update runs every 50ms
        if (dist < 30 && attackTimer >= 1000) {
          attackTimer = 0;
          nearest.applyDamage(dmg);
          DamageNumber.damage(this, nearest.x, nearest.y, dmg);
          // Wolf takes counter-damage
          wolfHp -= 5;
          if (wolfHp <= 0) {
            // Death burst
            this.tweens.add({
              targets: wolf, alpha: 0, scaleX: 1.5, scaleY: 1.5,
              duration: 200, onComplete: () => wolf.destroy(),
            });
          }
        }
      }
    };

    const updateEvent = this.time.addEvent({
      delay: 50, callback: wolfUpdate, loop: true,
    });

    // Auto-expire after 10 seconds
    this.time.delayedCall(10000, () => {
      wolfHp = 0;
    });
  }

  // ─── Tutorial ──────────────────────────────────────────────────────────────
  private showTutorialHint() {
    const step = getNextStep();
    if (!step) return;
    const text = getTutorialText(step);
    this.tutorialHint = this.add.text(GAME_WIDTH / 2, 100, text, {
      fontSize: '18px', fontFamily: 'Georgia, serif',
      color: '#f1c40f', stroke: '#000', strokeThickness: 3,
      backgroundColor: '#00000088', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(80).setAlpha(0);
    this.tweens.add({ targets: this.tutorialHint, alpha: 1, duration: 500 });
    // First step auto-completes on drag start (handled in LaunchSystem pointer events)
    completeStep('dragToAim');
    this.time.delayedCall(2000, () => this.updateTutorialHint());
  }

  private updateTutorialHint() {
    const step = getNextStep();
    if (!step) {
      if (this.tutorialHint) {
        this.tweens.add({ targets: this.tutorialHint, alpha: 0, duration: 300, onComplete: () => this.tutorialHint?.destroy() });
        this.tutorialHint = null;
      }
      return;
    }
    if (this.tutorialHint) {
      this.tutorialHint.setText(getTutorialText(step));
    }
  }

  // ─── Update ────────────────────────────────────────────────────────────────
  update(_time: number, delta: number) {
    if (this.battleEnded) return;

    for (const b of this.blocks)   b.update();
    for (const e of this.enemies)  e.update();
    for (const h of this.heroes)   h.update();
    for (const b of this.barrels)  b.update();

    this.blocks = this.blocks.filter(b => !b.destroyed);
    this.coins  = this.coins.filter(c => !c.collected);

    // Hero flight trail particles
    this.trailTimer += delta;
    if (this.trailTimer > 45) {
      this.trailTimer -= 45;
      for (const hero of this.heroes) {
        if (hero.state === 'flying') this.spawnTrailDot(hero.x, hero.y, hero.heroClass);
      }
    }

    this.launchSystem.update(delta);
    this.combatSystem.update(delta);
    this.timeoutSystem.update(delta);
    this.squadUI.update();

    // Update enemy counter
    const alive = this.enemies.filter(e => e.state !== 'dead').length;
    this.enemyCountText.setText(`${alive}`);

    // Drain queued shake
    if (this.shakeQueued > 0) {
      this.cameras.main.shake(100, this.shakeQueued);
      this.shakeQueued = 0;
    }

    if (this.launchSystem.allLaunched) {
      this.startTimeoutIfNeeded();
      this.checkLoss();
      if (!this.endRunBtnShown && this.enemies.some(e => e.state !== 'dead')) {
        this.endRunBtnShown = true;
        this.buildEndRunButton();
      }
    }
  }
}
