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
import { VFXSystem } from '@/systems/VFXSystem';
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
  private vfxSystem!: VFXSystem;
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
    const foundNode = data?.node ?? run.nodeMap.find(n => n.id === run.currentNodeId);
    if (!foundNode) {
      console.error('BattleScene: could not find node', run.currentNodeId);
      this.scene.start('OverworldScene');
      return;
    }
    this.activeNode = foundNode;

    const music = this.registry.get('music') as MusicSystem | null;
    music?.play(this.activeNode.type === 'BOSS' ? 'boss' : 'battle');

    this.buildBackground();
    this.vfxSystem = new VFXSystem(this, this.activeNode.difficulty ?? 1);
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

    // Stars — handled by VFXSystem (twinkling)

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
  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private buildStructure() {
    const diff = this.activeNode.difficulty ?? 1;
    if (diff >= 5) {
      this.pickRandom([
        () => this.buildTemplateCitadel(),
        () => this.buildTemplateGauntlet(),
      ])();
    } else if (diff >= 4) {
      this.pickRandom([
        () => this.buildTemplateKeep(),
        () => this.buildTemplateBunker(),
        () => this.buildTemplatePendulum(),
      ])();
    } else if (diff === 3) {
      this.pickRandom([
        () => this.buildTemplateFortress(),
        () => this.buildTemplatePit(),
        () => this.buildTemplateCatapult(),
        () => this.buildTemplateShelf(),
      ])();
    } else if (diff === 2) {
      this.pickRandom([
        () => this.buildTemplateTwoTowers(),
        () => this.buildTemplateBridge(),
        () => this.buildTemplateAvalanche(),
        () => this.buildTemplateDominoRun(),
      ])();
    } else {
      this.pickRandom([
        () => this.buildTemplateTwoTowers(),
        () => this.buildTemplatePowderKeg(),
        () => this.buildTemplateDominoRun(),
      ])();
    }
  }

  // Template 1 — "Two Towers" (difficulty 1–2)
  // Angry Birds style: thin pillars + plank floors, ~30% fill, open rooms
  private buildTemplateTwoTowers() {
    const groundY = GAME_HEIGHT - 100;
    const b = (x: number, y: number, w: number, h: number, mat: 'WOOD' | 'STONE') =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    // ── Left tower: 2 levels, pillar+plank construction ─────────────────────
    const LX = 460;          // left pillar center
    const span = 110;        // distance between pillar pair centers
    const pillarH = 60;      // wood pillar height per level
    const plankW = 140;      // stone floor plank width

    // Level 1: two wood pillars + stone plank
    const lv1y = groundY - pillarH / 2;
    b(LX, lv1y, 14, pillarH, 'WOOD');
    b(LX + span, lv1y, 14, pillarH, 'WOOD');
    const floor1 = groundY - pillarH - 6;      // plank top sits on pillars
    b(LX + span / 2, floor1, plankW, 12, 'STONE');

    // Level 2: two wood pillars + stone plank
    const lv2base = floor1 - 6;
    const lv2y = lv2base - pillarH / 2;
    b(LX, lv2y, 14, pillarH, 'WOOD');
    b(LX + span, lv2y, 14, pillarH, 'WOOD');
    const floor2 = lv2base - pillarH - 6;
    b(LX + span / 2, floor2, plankW, 12, 'STONE');

    // Cap: stone square on top
    b(LX + span / 2, floor2 - 20, 28, 28, 'STONE');

    // ── Right tower: 3 levels, taller ───────────────────────────────────────
    const RX = 780;

    // Level 1
    b(RX, lv1y, 14, pillarH, 'WOOD');
    b(RX + span, lv1y, 14, pillarH, 'WOOD');
    const rFloor1 = groundY - pillarH - 6;
    b(RX + span / 2, rFloor1, plankW, 12, 'STONE');

    // Level 2
    const rLv2base = rFloor1 - 6;
    const rLv2y = rLv2base - pillarH / 2;
    b(RX, rLv2y, 14, pillarH, 'WOOD');
    b(RX + span, rLv2y, 14, pillarH, 'WOOD');
    const rFloor2 = rLv2base - pillarH - 6;
    b(RX + span / 2, rFloor2, plankW, 12, 'STONE');

    // Level 3
    const rLv3base = rFloor2 - 6;
    const rLv3y = rLv3base - 50 / 2;  // shorter pillar for top level
    b(RX, rLv3y, 14, 50, 'WOOD');
    b(RX + span, rLv3y, 14, 50, 'WOOD');
    const rFloor3 = rLv3base - 50 - 6;
    b(RX + span / 2, rFloor3, plankW, 12, 'STONE');

    // Cap
    b(RX + span / 2, rFloor3 - 20, 28, 28, 'STONE');

    // ── Barrels ─────────────────────────────────────────────────────────────
    this.barrels.push(new Barrel(this, RX + span / 2, groundY - 18));  // between right tower pillars
    this.barrels.push(new Barrel(this, LX + span / 2, groundY - 18));

    // ── Enemies ─────────────────────────────────────────────────────────────
    const eR = 20;
    this.placeEnemies([
      { x: LX + span / 2, y: floor1 - 6 - eR },          // inside left tower level 1
      { x: 620,            y: groundY - eR },               // on ground between towers
      { x: RX + span / 2, y: rFloor1 - 6 - eR },          // inside right tower level 1
      { x: RX + span / 2, y: rFloor3 - 6 - 28 - eR },    // on top of right tower cap block
    ]);
  }

  // Template 2 — "Fortress Wall" (difficulty 3)
  // Colonnade/arcade: evenly-spaced tall pillars with plank rows, flanking towers
  private buildTemplateFortress() {
    const groundY = GAME_HEIGHT - 100;
    const b = (x: number, y: number, w: number, h: number, mat: 'WOOD' | 'STONE') =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    // ── Main colonnade: 5 tall pillars with 3 rows of stone planks ──────────
    const WX = 580;           // first pillar center (must clear hill at ~x=410)
    const colSpacing = 80;    // between pillar centers (creates ~66px archways)
    const pillarH = 80;       // tall wood pillars

    // 5 evenly-spaced tall wood pillars rising from ground
    for (let i = 0; i < 5; i++) {
      b(WX + i * colSpacing, groundY - pillarH / 2, 14, pillarH, 'WOOD');
    }
    const colRight = WX + 4 * colSpacing;

    // 3 stone plank rows spanning all pillars
    const plankW = colRight - WX + 40;  // extend slightly past outer pillars
    const plankCX = WX + 2 * colSpacing;
    const row1Y = groundY - pillarH - 6;
    b(plankCX, row1Y, plankW, 12, 'STONE');

    // Second tier: shorter pillars + plank
    const tier2H = 50;
    for (let i = 0; i < 5; i++) {
      b(WX + i * colSpacing, row1Y - 6 - tier2H / 2, 14, tier2H, 'WOOD');
    }
    const row2Y = row1Y - 6 - tier2H - 6;
    b(plankCX, row2Y, plankW, 12, 'STONE');

    // Third tier: short pillars + cap plank (battlements)
    const tier3H = 30;
    for (let i = 0; i < 5; i += 2) {
      b(WX + i * colSpacing, row2Y - 6 - tier3H / 2, 14, tier3H, 'WOOD');
    }
    const capY = row2Y - 6 - tier3H - 6;
    b(plankCX, capY, plankW * 0.6, 12, 'STONE');

    // ── Flanking pillar towers (2 levels each) ──────────────────────────────
    const towerSpan = 60;
    const towerPillarH = 70;

    for (const tx of [WX - 115, colRight + 120]) {
      // Level 1
      b(tx - towerSpan / 2, groundY - towerPillarH / 2, 14, towerPillarH, 'WOOD');
      b(tx + towerSpan / 2, groundY - towerPillarH / 2, 14, towerPillarH, 'WOOD');
      const tFloor1 = groundY - towerPillarH - 6;
      b(tx, tFloor1, 100, 12, 'STONE');

      // Level 2
      b(tx - towerSpan / 2, tFloor1 - 6 - 50 / 2, 14, 50, 'WOOD');
      b(tx + towerSpan / 2, tFloor1 - 6 - 50 / 2, 14, 50, 'WOOD');
      const tFloor2 = tFloor1 - 6 - 50 - 6;
      b(tx, tFloor2, 100, 12, 'STONE');

      // Cap stone
      b(tx, tFloor2 - 20, 28, 28, 'STONE');
    }

    // ── Barrels ─────────────────────────────────────────────────────────────
    // Barrels offset from pillar centers to avoid overlap
    this.barrels.push(new Barrel(this, WX + 2.5 * colSpacing, groundY - 18));
    this.barrels.push(new Barrel(this, WX + 1.5 * colSpacing, row1Y - 6 - 18));

    const eR = 20;
    this.placeEnemies([
      { x: WX - 115,              y: groundY - towerPillarH - 6 - 6 - eR },  // left tower floor
      { x: WX + 1.5 * colSpacing, y: row1Y - 6 - eR },        // between pillars on plank
      { x: WX + 2.5 * colSpacing, y: row1Y - 6 - eR },        // between pillars on plank
      { x: colRight + 120,        y: groundY - towerPillarH - 6 - 6 - eR },  // right tower floor
    ]);
  }

  // Template 3 — "Keep" (difficulty 4+)
  // Grand multi-tier: 4 pillar-pair rooms below, 2 above, central spire weak point
  private buildTemplateKeep() {
    const groundY = GAME_HEIGHT - 100;
    const b = (x: number, y: number, w: number, h: number, mat: 'WOOD' | 'STONE') =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    const span = 100;        // room width (pillar-to-pillar)
    const gap = 30;          // gap between rooms
    const pillarH = 70;      // ground-floor pillar height
    const startX = 432;      // first pillar center (must clear hill at ~x=410)

    // ── Lower tier: 4 open rooms (4 pillar pairs + 4 planks) ────────────────
    const roomCenters: number[] = [];
    for (let i = 0; i < 4; i++) {
      const rx = startX + i * (span + gap);
      roomCenters.push(rx + span / 2);

      // Two wood pillars
      b(rx, groundY - pillarH / 2, 14, pillarH, 'WOOD');
      b(rx + span, groundY - pillarH / 2, 14, pillarH, 'WOOD');

      // Stone plank floor on top
      const floorY = groundY - pillarH - 6;
      b(rx + span / 2, floorY, 140, 12, 'STONE');
    }
    const lowerFloorY = groundY - pillarH - 6;

    // ── Upper tier: 2 rooms centered above lower rooms 1-2 and 3-4 ─────────
    const upperPillarH = 60;
    const upperBase = lowerFloorY - 6;
    const upperRoomCenters: number[] = [];

    for (let i = 0; i < 2; i++) {
      // Center between two lower rooms
      const lc = (roomCenters[i * 2] + roomCenters[i * 2 + 1]) / 2;
      upperRoomCenters.push(lc);
      const ulx = lc - span / 2;
      const urx = lc + span / 2;

      b(ulx, upperBase - upperPillarH / 2, 14, upperPillarH, 'WOOD');
      b(urx, upperBase - upperPillarH / 2, 14, upperPillarH, 'WOOD');

      const uFloorY = upperBase - upperPillarH - 6;
      // Wide planks (260px) so the two upper rooms meet at the center
      b(lc, uFloorY, 260, 12, 'STONE');
    }
    const upperFloorY = upperBase - upperPillarH - 6;

    // ── Stone caps on lower room planks (adds visual weight) ──────────────
    for (let i = 0; i < 4; i++) {
      b(roomCenters[i], lowerFloorY - 6 - 14, 28, 28, 'STONE');
    }

    // ── Central spire: single tall pillar + heavy stone cap ─────────────────
    // Sits at junction of two upper planks — destroy the pillar for spectacular collapse
    const spireX = (upperRoomCenters[0] + upperRoomCenters[1]) / 2;
    const spireH = 50;
    b(spireX, upperFloorY - 6 - spireH / 2, 14, spireH, 'WOOD');
    const capY = upperFloorY - 6 - spireH - 6;
    b(spireX, capY, 100, 12, 'STONE');
    b(spireX - 25, capY - 6 - 14, 28, 28, 'STONE');  // on cap plank top
    b(spireX + 25, capY - 6 - 14, 28, 28, 'STONE');

    // ── Barrels ─────────────────────────────────────────────────────────────
    this.barrels.push(new Barrel(this, roomCenters[0], groundY - 18));
    this.barrels.push(new Barrel(this, roomCenters[3], groundY - 18));
    this.barrels.push(new Barrel(this, upperRoomCenters[0], lowerFloorY - 6 - 18));
    this.barrels.push(new Barrel(this, upperRoomCenters[1], upperFloorY - 6 - 18));

    const eR = 20;
    this.placeEnemies([
      { x: roomCenters[1],      y: lowerFloorY - 6 - 28 - eR },  // on top of stone cap block
      { x: roomCenters[2],      y: lowerFloorY - 6 - 28 - eR },  // on top of stone cap block
      { x: upperRoomCenters[1], y: upperFloorY - 6 - eR },    // upper room right
      { x: spireX,              y: capY - 6 - 28 - eR },        // atop the spire cap blocks
    ]);
  }

  // Template 4 — "The Bridge" (difficulty 2)
  // Long elevated walkway on thin stilts — very vulnerable, one solo center pillar
  private buildTemplateBridge() {
    const groundY = GAME_HEIGHT - 100;
    const b = (x: number, y: number, w: number, h: number, mat: 'WOOD' | 'STONE') =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    const startX = 480;        // must clear hill at ~x=410 (deck left edge = 415)
    const pillarSpacing = 110;  // between each stilt pair
    const pillarH = 80;         // tall stilts
    const deckW = 460;          // total bridge deck width

    // 4 pillar positions: pairs at ends + middle, solo center pillar
    const pillarXs = [
      startX,                     // left stilt pair
      startX + pillarSpacing,     // left-center: SOLO (weak point!)
      startX + 2 * pillarSpacing, // right-center pair
      startX + 3 * pillarSpacing, // right stilt pair
    ];

    // All pillars rise from ground
    for (let i = 0; i < pillarXs.length; i++) {
      const px = pillarXs[i];
      if (i === 1) {
        // Solo center pillar — the key weak point
        b(px, groundY - pillarH / 2, 14, pillarH, 'WOOD');
      } else {
        // Paired pillars (narrowly spaced)
        b(px - 20, groundY - pillarH / 2, 14, pillarH, 'WOOD');
        b(px + 20, groundY - pillarH / 2, 14, pillarH, 'WOOD');
      }
    }

    // Bridge deck: long stone plank at top of pillars
    const deckY = groundY - pillarH - 6;
    const deckCX = startX + 1.5 * pillarSpacing;
    b(deckCX, deckY, deckW, 12, 'STONE');

    // Railings: small square blocks on deck edges
    for (let i = 0; i < 4; i++) {
      b(startX + i * pillarSpacing, deckY - 6 - 14, 28, 28, 'WOOD');
    }

    // ── Barrels ─────────────────────────────────────────────────────────────
    this.barrels.push(new Barrel(this, pillarXs[0] + pillarSpacing / 2, groundY - 18));  // between pillar positions 0 and 1
    this.barrels.push(new Barrel(this, deckCX + 100, deckY - 6 - 18));  // between railings 2 and 3

    const eR = 20;
    this.placeEnemies([
      { x: startX + 0.5 * pillarSpacing,  y: deckY - 6 - eR },   // on deck left
      { x: startX + 1.5 * pillarSpacing,  y: deckY - 6 - eR },   // on deck center
      { x: startX + 2.5 * pillarSpacing,  y: deckY - 6 - eR },   // on deck right
      { x: startX + 1.5 * pillarSpacing,  y: groundY - eR },      // on ground below
    ]);
  }

  // Template 5 — "The Cage" (difficulty 3)
  // 3-tier skeletal frame: pillar+plank modules stacked, heavy stone cap
  private buildTemplatePit() {
    const groundY = GAME_HEIGHT - 100;
    const b = (x: number, y: number, w: number, h: number, mat: 'WOOD' | 'STONE') =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    const cx = 680;           // cage center x
    const cageW = 160;        // pillar-to-pillar width
    const frontL = cx - cageW / 2;
    const frontR = cx + cageW / 2;

    // ── Level 1: short pillars + mid-level plank ───────────────────────────
    const lv1H = 50;
    b(frontL, groundY - lv1H / 2, 14, lv1H, 'WOOD');
    b(frontR, groundY - lv1H / 2, 14, lv1H, 'WOOD');
    // Center support pillar — same height as outer pillars so it reaches the plank
    b(cx, groundY - lv1H / 2, 14, lv1H, 'WOOD');
    const midY = groundY - lv1H - 6;
    b(cx, midY, cageW + 30, 12, 'WOOD');

    // ── Level 2: taller pillars + stone upper floor ────────────────────────
    const lv2H = 60;
    b(frontL, midY - 6 - lv2H / 2, 14, lv2H, 'WOOD');
    b(frontR, midY - 6 - lv2H / 2, 14, lv2H, 'WOOD');
    const upperY = midY - 6 - lv2H - 6;
    b(cx, upperY, cageW + 30, 12, 'STONE');

    // ── Level 3: short pillars + heavy stone cap ───────────────────────────
    const lv3H = 40;
    b(frontL, upperY - 6 - lv3H / 2, 14, lv3H, 'WOOD');
    b(frontR, upperY - 6 - lv3H / 2, 14, lv3H, 'WOOD');
    const capY = upperY - 6 - lv3H - 6;
    b(cx, capY, cageW + 50, 12, 'STONE');

    // Heavy cap pieces — collapse spectacularly when pillars break
    b(cx - 40, capY - 18, 50, 24, 'STONE');
    b(cx + 40, capY - 18, 50, 24, 'STONE');

    // ── Barrels ─────────────────────────────────────────────────────────────
    this.barrels.push(new Barrel(this, frontL + 40, groundY - 18));    // offset from center pillar
    this.barrels.push(new Barrel(this, frontR - 40, upperY - 6 - 18)); // on upper floor, offset from enemy

    const eR = 20;
    this.placeEnemies([
      { x: cx,          y: midY - 6 - eR },        // on mid-level plank
      { x: cx,          y: upperY - 6 - eR },       // on upper stone floor
      { x: frontL + 50, y: groundY - eR },          // ground level left
      { x: frontR - 50, y: groundY - eR },          // ground level right
    ]);
  }

  // Template 6 — "The Citadel" (difficulty 5+, Boss-specific)
  // Multi-wing palace: left tower, grand center hall, right tower, throne room on top
  private buildTemplateCitadel() {
    const groundY = GAME_HEIGHT - 100;
    const b = (x: number, y: number, w: number, h: number, mat: 'WOOD' | 'STONE') =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    const span = 100;         // room width
    const pillarH = 70;       // floor-1 pillar height

    // ── Helper: build a pillar-plank level ──────────────────────────────────
    const buildLevel = (cx: number, baseY: number, pH: number, plankW: number) => {
      b(cx - span / 2, baseY - pH / 2, 14, pH, 'WOOD');
      b(cx + span / 2, baseY - pH / 2, 14, pH, 'WOOD');
      const floorY = baseY - pH - 6;
      b(cx, floorY, plankW, 12, 'STONE');
      return floorY;
    };

    // ── Left wing: 3-level tower ────────────────────────────────────────────
    const LX = 482;           // must clear hill at ~x=410 (left plank edge at LX - 70 = 412)
    const lf1 = buildLevel(LX, groundY, pillarH, 140);
    const lf2 = buildLevel(LX, lf1 - 6, 55, 140);
    const lf3 = buildLevel(LX, lf2 - 6, 45, 100);
    b(LX, lf3 - 20, 28, 28, 'STONE');  // cap

    // ── Center grand hall: 4 levels, wider span ─────────────────────────────
    const CX = 680;
    const hallSpan = 140;     // wider room

    // Level 1: 3 pillars (2 outer + 1 center weak point)
    b(CX - hallSpan / 2, groundY - pillarH / 2, 14, pillarH, 'WOOD');
    b(CX, groundY - pillarH / 2, 14, pillarH, 'WOOD');  // center weak point
    b(CX + hallSpan / 2, groundY - pillarH / 2, 14, pillarH, 'WOOD');
    const cf1 = groundY - pillarH - 6;
    b(CX, cf1, hallSpan + 40, 12, 'STONE');

    // Level 2: 2 outer pillars (no center — open)
    const cPH2 = 60;
    b(CX - hallSpan / 2, cf1 - 6 - cPH2 / 2, 14, cPH2, 'WOOD');
    b(CX + hallSpan / 2, cf1 - 6 - cPH2 / 2, 14, cPH2, 'WOOD');
    const cf2 = cf1 - 6 - cPH2 - 6;
    b(CX, cf2, hallSpan + 40, 12, 'STONE');

    // Level 3: narrower, 2 pillars
    const cPH3 = 50;
    b(CX - span / 2, cf2 - 6 - cPH3 / 2, 14, cPH3, 'WOOD');
    b(CX + span / 2, cf2 - 6 - cPH3 / 2, 14, cPH3, 'WOOD');
    const cf3 = cf2 - 6 - cPH3 - 6;
    b(CX, cf3, 140, 12, 'STONE');

    // Level 4 — Throne room: single pillar + wide stone cap (boss sits here)
    const throneH = 40;
    b(CX, cf3 - 6 - throneH / 2, 14, throneH, 'WOOD');
    const throneFloor = cf3 - 6 - throneH - 6;
    b(CX, throneFloor, 100, 12, 'STONE');
    // Heavy throne cap — satisfying collapse when pillar breaks
    b(CX - 30, throneFloor - 18, 50, 24, 'STONE');
    b(CX + 30, throneFloor - 18, 50, 24, 'STONE');

    // ── Right wing: 3-level tower ───────────────────────────────────────────
    const RX = 940;
    const rf1 = buildLevel(RX, groundY, pillarH, 140);
    const rf2 = buildLevel(RX, rf1 - 6, 55, 140);
    const rf3 = buildLevel(RX, rf2 - 6, 45, 100);
    b(RX, rf3 - 20, 28, 28, 'STONE');  // cap

    // ── Connecting bridges at level 2 ───────────────────────────────────────
    // Bridge planks must NOT overlap adjacent structure planks (same Y = collision)
    // Left wing plank right edge: LX + 70 = 552. Center hall plank left edge: CX - 90 = 590.
    const lBridgeX = (LX + 70 + CX - 90) / 2;  // centered in gap (=571)
    const lBridgeW = (CX - 90) - (LX + 70);     // spans the gap exactly (=38)
    b(lBridgeX, cf1, lBridgeW, 12, 'WOOD');
    // Support pillar under left bridge (from ground)
    b(lBridgeX, groundY - pillarH / 2, 14, pillarH, 'WOOD');

    // Right bridge: center hall plank right edge (CX + 90 = 770) to right wing left edge (RX - 70 = 870)
    const rBridgeX = (CX + 90 + RX - 70) / 2;
    const rBridgeW = (RX - 70) - (CX + 90);
    b(rBridgeX, cf1, rBridgeW, 12, 'WOOD');
    // Support pillar under right bridge (from ground)
    b(rBridgeX, groundY - pillarH / 2, 14, pillarH, 'WOOD');

    // ── Barrels — lots for the epic boss fight ──────────────────────────────
    this.barrels.push(new Barrel(this, LX, groundY - 18));
    this.barrels.push(new Barrel(this, CX - hallSpan / 4, groundY - 18));  // offset from center pillar
    this.barrels.push(new Barrel(this, RX, groundY - 18));
    this.barrels.push(new Barrel(this, CX + 40, cf1 - 6 - 18));  // on hall floor, offset from enemies/pillars

    const eR = 20;
    this.placeEnemies([
      { x: LX,  y: lf1 - 6 - eR },           // left wing level 1
      { x: CX,  y: cf1 - 6 - eR },           // center hall level 1
      { x: RX,  y: rf1 - 6 - eR },           // right wing level 1
      { x: CX,  y: cf2 - 6 - eR },           // center hall level 2
      { x: CX,  y: throneFloor - 6 - 24 - eR }, // on top of throne cap blocks
      { x: lBridgeX, y: cf1 - 6 - eR },        // on left bridge
    ]);
  }

  // Template 7 — "Powder Keg" (difficulty 1)
  // Simple tower with 3 barrels clustered inside ground floor — chain detonation scatters everything
  private buildTemplatePowderKeg() {
    const groundY = GAME_HEIGHT - 100;
    const b = (x: number, y: number, w: number, h: number, mat: 'WOOD' | 'STONE') =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    // ── Main tower: 2 levels with barrel-packed ground floor ──────────────
    const TX = 620;
    const span = 120;
    const pillarH = 60;

    // Level 1: four pillars forming a wide room
    b(TX, groundY - pillarH / 2, 14, pillarH, 'WOOD');
    b(TX + span, groundY - pillarH / 2, 14, pillarH, 'WOOD');
    b(TX + span / 3, groundY - pillarH / 2, 14, pillarH, 'WOOD');
    b(TX + span * 2 / 3, groundY - pillarH / 2, 14, pillarH, 'WOOD');
    const floor1 = groundY - pillarH - 6;
    b(TX + span / 2, floor1, span + 30, 12, 'STONE');

    // Level 2: two pillars + cap
    const lv2H = 45;
    b(TX + 15, floor1 - 6 - lv2H / 2, 14, lv2H, 'WOOD');
    b(TX + span - 15, floor1 - 6 - lv2H / 2, 14, lv2H, 'WOOD');
    const floor2 = floor1 - 6 - lv2H - 6;
    b(TX + span / 2, floor2, span + 10, 12, 'STONE');
    b(TX + span / 2, floor2 - 20, 28, 28, 'STONE');

    // ── Small side shelter ────────────────────────────────────────────────
    const SX = 850;
    b(SX, groundY - 40 / 2, 14, 40, 'WOOD');
    b(SX + 60, groundY - 40 / 2, 14, 40, 'WOOD');
    b(SX + 30, groundY - 40 - 6, 80, 12, 'WOOD');

    // ── 3 barrels clustered inside ground floor → chain detonation ────────
    this.barrels.push(new Barrel(this, TX + span / 3, groundY - 18));
    this.barrels.push(new Barrel(this, TX + span / 2, groundY - 18));
    this.barrels.push(new Barrel(this, TX + span * 2 / 3, groundY - 18));
    // 1 barrel on upper floor
    this.barrels.push(new Barrel(this, TX + span / 2, floor1 - 6 - 18));

    const eR = 20;
    this.placeEnemies([
      { x: TX + span / 2, y: floor1 - 6 - eR },
      { x: TX + span / 2, y: floor2 - 6 - 28 - eR },
      { x: SX + 30,       y: groundY - 40 - 6 - 6 - eR },
    ]);
  }

  // Template 8 — "The Avalanche" (difficulty 2)
  // Heavy stone on thin supports above a barrel on a mid-shelf — destroy support → stone falls on barrel → explosion
  private buildTemplateAvalanche() {
    const groundY = GAME_HEIGHT - 100;
    const b = (x: number, y: number, w: number, h: number, mat: 'WOOD' | 'STONE') =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    // ── Main structure: wide base with shelf holding heavy stones ─────────
    const CX = 640;
    const span = 130;
    const pillarH = 70;

    // Ground floor: 3 pillars
    b(CX - span / 2, groundY - pillarH / 2, 14, pillarH, 'WOOD');
    b(CX, groundY - pillarH / 2, 14, pillarH, 'WOOD');
    b(CX + span / 2, groundY - pillarH / 2, 14, pillarH, 'WOOD');
    const shelf1 = groundY - pillarH - 6;
    b(CX, shelf1, span + 40, 12, 'STONE');

    // Barrel on mid-shelf — stone will fall onto it
    this.barrels.push(new Barrel(this, CX - 30, shelf1 - 6 - 18));

    // ── Thin supports holding heavy stones above the barrel ───────────────
    const thinH = 40;
    b(CX - 45, shelf1 - 6 - thinH / 2, 10, thinH, 'WOOD');  // fragile!
    b(CX - 15, shelf1 - 6 - thinH / 2, 10, thinH, 'WOOD');
    const shelf2 = shelf1 - 6 - thinH - 6;
    b(CX - 30, shelf2, 80, 12, 'STONE');

    // Heavy stone blocks on the shelf — will crush down onto barrel
    b(CX - 45, shelf2 - 6 - 16, 40, 32, 'STONE');
    b(CX - 15, shelf2 - 6 - 16, 40, 32, 'STONE');

    // ── Right side: reinforced tower with second barrel ───────────────────
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

    this.barrels.push(new Barrel(this, RX, groundY - 18));

    const eR = 20;
    this.placeEnemies([
      { x: CX + 30,  y: shelf1 - 6 - eR },
      { x: CX,       y: groundY - eR },
      { x: RX,       y: rFloor - 6 - eR },
      { x: RX,       y: rFloor2 - 6 - 28 - eR },
    ]);
  }

  // Template 9 — "Domino Run" (difficulty 1–2)
  // 5 tall thin pillars in a row, each with cap block + barrel at base — topple first → cascade
  private buildTemplateDominoRun() {
    const groundY = GAME_HEIGHT - 100;
    const b = (x: number, y: number, w: number, h: number, mat: 'WOOD' | 'STONE') =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    const startX = 460;
    const spacing = 90;
    const pillarH = 80;

    // 5 tall thin pillars with cap blocks — designed to domino
    for (let i = 0; i < 5; i++) {
      const px = startX + i * spacing;
      b(px, groundY - pillarH / 2, 12, pillarH, 'WOOD');
      // Cap block on top — adds weight to tip it over
      b(px, groundY - pillarH - 6 - 14, 28, 28, 'STONE');
      // Barrel at each base
      this.barrels.push(new Barrel(this, px + 20, groundY - 18));
    }

    // ── Terminal shelter at end — the target ──────────────────────────────
    const endX = startX + 5 * spacing;
    b(endX - 30, groundY - 50 / 2, 14, 50, 'WOOD');
    b(endX + 30, groundY - 50 / 2, 14, 50, 'WOOD');
    const shelterFloor = groundY - 50 - 6;
    b(endX, shelterFloor, 80, 12, 'STONE');
    b(endX, shelterFloor - 6 - 30 / 2, 14, 30, 'WOOD');
    b(endX, shelterFloor - 6 - 30 - 6, 60, 12, 'STONE');

    const eR = 20;
    this.placeEnemies([
      { x: startX + 2 * spacing, y: groundY - eR },
      { x: endX,                 y: shelterFloor - 6 - eR },
      { x: endX,                 y: groundY - eR },
    ]);
  }

  // Template 10 — "The Catapult" (difficulty 3)
  // Long plank on a fulcrum. Stone on one end, barrel on other. Explode barrel → plank rotates → stone launches
  private buildTemplateCatapult() {
    const groundY = GAME_HEIGHT - 100;
    const b = (x: number, y: number, w: number, h: number, mat: 'WOOD' | 'STONE') =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    // ── Catapult mechanism: fulcrum + long plank ──────────────────────────
    const FX = 560;  // fulcrum center
    const fulcrumH = 40;

    // Fulcrum: short wide block
    b(FX, groundY - fulcrumH / 2, 30, fulcrumH, 'STONE');

    // Long plank balanced on fulcrum
    const plankW = 220;
    b(FX, groundY - fulcrumH - 6, plankW, 12, 'WOOD');
    const plankY = groundY - fulcrumH - 6;

    // Heavy stone on left end (projectile)
    b(FX - plankW / 2 + 20, plankY - 6 - 18, 40, 36, 'STONE');
    b(FX - plankW / 2 + 55, plankY - 6 - 18, 40, 36, 'STONE');

    // Barrel on right end (detonation lifts the plank)
    this.barrels.push(new Barrel(this, FX + plankW / 2 - 25, plankY - 6 - 18));
    this.barrels.push(new Barrel(this, FX + plankW / 2 - 25, groundY - 18));

    // ── Target tower to the right ─────────────────────────────────────────
    const TX = 840;
    const tSpan = 100;
    const tPillarH = 65;

    // Level 1
    b(TX, groundY - tPillarH / 2, 14, tPillarH, 'WOOD');
    b(TX + tSpan, groundY - tPillarH / 2, 14, tPillarH, 'WOOD');
    const tFloor1 = groundY - tPillarH - 6;
    b(TX + tSpan / 2, tFloor1, tSpan + 30, 12, 'STONE');

    // Level 2
    const tPH2 = 50;
    b(TX + 15, tFloor1 - 6 - tPH2 / 2, 14, tPH2, 'WOOD');
    b(TX + tSpan - 15, tFloor1 - 6 - tPH2 / 2, 14, tPH2, 'WOOD');
    const tFloor2 = tFloor1 - 6 - tPH2 - 6;
    b(TX + tSpan / 2, tFloor2, tSpan + 10, 12, 'STONE');

    // Cap
    b(TX + tSpan / 2, tFloor2 - 20, 28, 28, 'STONE');

    const eR = 20;
    this.placeEnemies([
      { x: FX + 30,          y: groundY - eR },
      { x: TX + tSpan / 2,   y: tFloor1 - 6 - eR },
      { x: TX + tSpan / 2,   y: tFloor2 - 6 - 28 - eR },
      { x: TX + tSpan / 2,   y: groundY - eR },
    ]);
  }

  // Template 11 — "The Shelf" (difficulty 3)
  // 4-level shelving, barrel under each shelf. Destroy bottom → collapse cascades upward through barrels.
  private buildTemplateShelf() {
    const groundY = GAME_HEIGHT - 100;
    const b = (x: number, y: number, w: number, h: number, mat: 'WOOD' | 'STONE') =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    const CX = 680;
    const shelfW = 160;
    const pillarH = 40;
    let baseY = groundY;

    const floors: number[] = [];

    // Build 4 levels — lower = wood, upper = stone pillars for heavy debris
    for (let level = 0; level < 4; level++) {
      const mat: 'WOOD' | 'STONE' = level < 2 ? 'WOOD' : 'STONE';
      const pH = pillarH - level * 4;  // slightly shorter each level

      b(CX - shelfW / 2, baseY - pH / 2, 14, pH, mat);
      b(CX + shelfW / 2, baseY - pH / 2, 14, pH, mat);
      // Center support on lower levels
      if (level < 2) b(CX, baseY - pH / 2, 14, pH, 'WOOD');

      const floorY = baseY - pH - 6;
      const floorMat: 'WOOD' | 'STONE' = level < 2 ? 'WOOD' : 'STONE';
      b(CX, floorY, shelfW + 20, 12, floorMat);
      floors.push(floorY);

      // Barrel under each shelf (sitting on the floor below)
      if (level > 0) {
        this.barrels.push(new Barrel(this, CX + (level % 2 === 0 ? -30 : 30), baseY - 18));
      }

      baseY = floorY - 6;
    }

    // Bottom barrel on ground
    this.barrels.push(new Barrel(this, CX, groundY - 18));

    // Stone cap on top
    b(CX - 30, floors[3] - 6 - 16, 40, 32, 'STONE');
    b(CX + 30, floors[3] - 6 - 16, 40, 32, 'STONE');

    const eR = 20;
    this.placeEnemies([
      { x: CX,      y: floors[0] - 6 - eR },
      { x: CX,      y: floors[1] - 6 - eR },
      { x: CX,      y: floors[2] - 6 - eR },
      { x: CX,      y: floors[3] - 6 - 32 - eR },
    ]);
  }

  // Template 12 — "The Bunker" (difficulty 4)
  // Low wide stone fortification with hidden interior barrels — need high-arc shots to reach inside
  private buildTemplateBunker() {
    const groundY = GAME_HEIGHT - 100;
    const b = (x: number, y: number, w: number, h: number, mat: 'WOOD' | 'STONE') =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    const BX = 620;  // bunker center
    const bunkerW = 260;
    const wallH = 55;

    // ── Outer stone walls (thick, low) ────────────────────────────────────
    b(BX - bunkerW / 2, groundY - wallH / 2, 24, wallH, 'STONE');
    b(BX + bunkerW / 2, groundY - wallH / 2, 24, wallH, 'STONE');

    // ── Roof: heavy stone slab with gap in center ─────────────────────────
    const roofY = groundY - wallH - 6;
    b(BX - bunkerW / 4 - 15, roofY, bunkerW / 2 - 20, 14, 'STONE');
    b(BX + bunkerW / 4 + 15, roofY, bunkerW / 2 - 20, 14, 'STONE');
    // Gap in center (~40px) for high-arc shots to enter

    // ── Interior dividers (thin wood) ─────────────────────────────────────
    b(BX - 40, groundY - 35 / 2, 10, 35, 'WOOD');
    b(BX + 40, groundY - 35 / 2, 10, 35, 'WOOD');

    // ── Barrels hidden inside chambers ────────────────────────────────────
    this.barrels.push(new Barrel(this, BX - 80, groundY - 18));
    this.barrels.push(new Barrel(this, BX, groundY - 18));
    this.barrels.push(new Barrel(this, BX + 80, groundY - 18));

    // ── Flanking watchtowers ──────────────────────────────────────────────
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
    this.placeEnemies([
      { x: BX - 80, y: groundY - eR },
      { x: BX + 80, y: groundY - eR },
      { x: BX - bunkerW / 2 - 70, y: groundY - 65 - 6 - 6 - eR },
      { x: BX + bunkerW / 2 + 70, y: groundY - 65 - 6 - 6 - eR },
    ]);
  }

  // Template 13 — "The Pendulum" (difficulty 4)
  // Heavy stone hanging from beam in a frame, barrel below — detonate barrel → force swings stone into target tower
  private buildTemplatePendulum() {
    const groundY = GAME_HEIGHT - 100;
    const b = (x: number, y: number, w: number, h: number, mat: 'WOOD' | 'STONE') =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    // ── Pendulum frame ────────────────────────────────────────────────────
    const PX = 540;
    const frameW = 120;
    const frameH = 100;

    // Two tall pillars
    b(PX - frameW / 2, groundY - frameH / 2, 16, frameH, 'STONE');
    b(PX + frameW / 2, groundY - frameH / 2, 16, frameH, 'STONE');

    // Cross beam at top
    const beamY = groundY - frameH - 6;
    b(PX, beamY, frameW + 30, 14, 'STONE');

    // Hanging stone blocks (the "pendulum" weight) — resting on a thin wood shelf
    const shelfY = beamY + 35;
    b(PX - 15, shelfY, 10, 20, 'WOOD');   // thin support
    b(PX + 15, shelfY, 10, 20, 'WOOD');   // thin support
    b(PX, shelfY + 16, 50, 32, 'STONE');  // heavy pendulum bob
    b(PX, shelfY + 42, 36, 24, 'STONE');  // second weight

    // Barrel below pendulum — explosion launches the weights sideways
    this.barrels.push(new Barrel(this, PX, groundY - 18));
    this.barrels.push(new Barrel(this, PX - 30, groundY - 18));

    // ── Target tower to the right ─────────────────────────────────────────
    const TX = 800;
    const tSpan = 100;

    // Level 1
    b(TX, groundY - 65 / 2, 14, 65, 'WOOD');
    b(TX + tSpan, groundY - 65 / 2, 14, 65, 'WOOD');
    const tF1 = groundY - 65 - 6;
    b(TX + tSpan / 2, tF1, tSpan + 30, 12, 'STONE');

    // Level 2
    b(TX + 15, tF1 - 6 - 55 / 2, 14, 55, 'WOOD');
    b(TX + tSpan - 15, tF1 - 6 - 55 / 2, 14, 55, 'WOOD');
    const tF2 = tF1 - 6 - 55 - 6;
    b(TX + tSpan / 2, tF2, tSpan + 10, 12, 'STONE');

    // Level 3
    b(TX + tSpan / 2 - 20, tF2 - 6 - 40 / 2, 14, 40, 'WOOD');
    b(TX + tSpan / 2 + 20, tF2 - 6 - 40 / 2, 14, 40, 'WOOD');
    const tF3 = tF2 - 6 - 40 - 6;
    b(TX + tSpan / 2, tF3, 80, 12, 'STONE');
    b(TX + tSpan / 2, tF3 - 18, 28, 28, 'STONE');

    const eR = 20;
    this.placeEnemies([
      { x: TX + tSpan / 2, y: tF1 - 6 - eR },
      { x: TX + tSpan / 2, y: tF2 - 6 - eR },
      { x: TX + tSpan / 2, y: tF3 - 6 - 28 - eR },
      { x: PX,             y: beamY - 6 - eR },
    ]);
  }

  // Template 14 — "The Gauntlet" (difficulty 5+, Boss)
  // 3 connected chambers with increasing fortification, linked by barrel-rigged bridges
  private buildTemplateGauntlet() {
    const groundY = GAME_HEIGHT - 100;
    const b = (x: number, y: number, w: number, h: number, mat: 'WOOD' | 'STONE') =>
      this.blocks.push(new Block(this, x, y, w, h, mat));

    // ── Chamber 1 (left, wood) ────────────────────────────────────────────
    const C1X = 440;
    const chamberW = 110;
    const c1H = 65;

    b(C1X, groundY - c1H / 2, 14, c1H, 'WOOD');
    b(C1X + chamberW, groundY - c1H / 2, 14, c1H, 'WOOD');
    b(C1X + chamberW / 2, groundY - c1H / 2, 14, c1H, 'WOOD');
    const c1Floor = groundY - c1H - 6;
    b(C1X + chamberW / 2, c1Floor, chamberW + 30, 12, 'STONE');

    // Upper level
    const c1pH2 = 45;
    b(C1X + 15, c1Floor - 6 - c1pH2 / 2, 14, c1pH2, 'WOOD');
    b(C1X + chamberW - 15, c1Floor - 6 - c1pH2 / 2, 14, c1pH2, 'WOOD');
    const c1Floor2 = c1Floor - 6 - c1pH2 - 6;
    b(C1X + chamberW / 2, c1Floor2, chamberW + 10, 12, 'STONE');

    // ── Bridge 1 (barrel-rigged) ──────────────────────────────────────────
    const bridge1X = C1X + chamberW + 35;
    const bridgeW = 50;
    b(bridge1X + bridgeW / 2, groundY - 50 / 2, 14, 50, 'WOOD');  // support pillar
    b(bridge1X + bridgeW / 2, groundY - 50 - 6, bridgeW + 20, 12, 'WOOD');
    this.barrels.push(new Barrel(this, bridge1X + bridgeW / 2, groundY - 18));

    // ── Chamber 2 (center, mixed) ─────────────────────────────────────────
    const C2X = bridge1X + bridgeW + 35;
    const c2H = 70;

    b(C2X, groundY - c2H / 2, 16, c2H, 'STONE');
    b(C2X + chamberW, groundY - c2H / 2, 16, c2H, 'STONE');
    b(C2X + chamberW / 2, groundY - c2H / 2, 14, c2H, 'WOOD');
    const c2Floor = groundY - c2H - 6;
    b(C2X + chamberW / 2, c2Floor, chamberW + 30, 12, 'STONE');

    // Upper level
    const c2pH2 = 50;
    b(C2X + 15, c2Floor - 6 - c2pH2 / 2, 14, c2pH2, 'WOOD');
    b(C2X + chamberW - 15, c2Floor - 6 - c2pH2 / 2, 14, c2pH2, 'WOOD');
    const c2Floor2 = c2Floor - 6 - c2pH2 - 6;
    b(C2X + chamberW / 2, c2Floor2, chamberW + 10, 12, 'STONE');

    // ── Bridge 2 (barrel-rigged) ──────────────────────────────────────────
    const bridge2X = C2X + chamberW + 35;
    b(bridge2X + bridgeW / 2, groundY - 55 / 2, 14, 55, 'WOOD');
    b(bridge2X + bridgeW / 2, groundY - 55 - 6, bridgeW + 20, 12, 'WOOD');
    this.barrels.push(new Barrel(this, bridge2X + bridgeW / 2, groundY - 18));

    // ── Chamber 3 (right, heavy stone — boss chamber) ─────────────────────
    const C3X = bridge2X + bridgeW + 35;
    const c3H = 75;

    b(C3X, groundY - c3H / 2, 18, c3H, 'STONE');
    b(C3X + chamberW, groundY - c3H / 2, 18, c3H, 'STONE');
    const c3Floor = groundY - c3H - 6;
    b(C3X + chamberW / 2, c3Floor, chamberW + 40, 14, 'STONE');

    // Upper level (thicker stone)
    const c3pH2 = 55;
    b(C3X + 15, c3Floor - 6 - c3pH2 / 2, 16, c3pH2, 'STONE');
    b(C3X + chamberW - 15, c3Floor - 6 - c3pH2 / 2, 16, c3pH2, 'STONE');
    const c3Floor2 = c3Floor - 6 - c3pH2 - 6;
    b(C3X + chamberW / 2, c3Floor2, chamberW + 20, 14, 'STONE');

    // Heavy stone cap
    b(C3X + chamberW / 2 - 25, c3Floor2 - 6 - 16, 40, 32, 'STONE');
    b(C3X + chamberW / 2 + 25, c3Floor2 - 6 - 16, 40, 32, 'STONE');

    // ── Barrels inside chambers ───────────────────────────────────────────
    this.barrels.push(new Barrel(this, C1X + chamberW / 2, groundY - 18));
    this.barrels.push(new Barrel(this, C2X + chamberW / 2, groundY - 18));
    this.barrels.push(new Barrel(this, C3X + chamberW / 2, c3Floor - 6 - 18));

    const eR = 20;
    this.placeEnemies([
      { x: C1X + chamberW / 2, y: c1Floor - 6 - eR },
      { x: C2X + chamberW / 2, y: c2Floor - 6 - eR },
      { x: C2X + chamberW / 2, y: c2Floor2 - 6 - eR },
      { x: C3X + chamberW / 2, y: c3Floor - 6 - eR },
      { x: C3X + chamberW / 2, y: c3Floor2 - 6 - 32 - eR },
      { x: C1X + chamberW / 2, y: c1Floor2 - 6 - eR },
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
          const pierceDmg = speed * 15;
          block.applyDamage(pierceDmg); // piercing damage
          hero.battleBlockDamage += pierceDmg;
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
      if (mat === 'WOOD') this.vfxSystem.dustCloud(x, y);
      else if (mat === 'STONE') this.vfxSystem.stoneSparkShower(x, y);
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

    this.events.on('priestHealAura', (x: number, y: number, radius: number, amount: number, healer?: Hero) => {
      for (const h of this.heroes) {
        if (h.state === 'dead') continue;
        const d = Math.hypot(h.x - x, h.y - y);
        if (d < radius) {
          h.heal(amount);
          if (healer) healer.battleHealingDone += amount;
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

    // VFX: hero landing dust, melee hit sparks, mage explosion
    this.events.on('heroLanded', (x: number, y: number) => {
      this.vfxSystem.landingDust(x, y);
    });
    this.events.on('meleeHit', (x: number, y: number, type: string) => {
      this.vfxSystem.meleeHitSparks(x, y, type);
    });
    this.events.on('mageExplosion', (x: number, y: number, r: number) => {
      this.vfxSystem.mageExplosion(x, y, r);
    });

    // Bomber death explosion — damages heroes nearby (similar to barrel but smaller)
    this.events.on('bomberExploded', (x: number, y: number, r: number, dmg: number) => {
      this.impactSystem.handleBarrelExplosion(x, y, r, dmg, this.blocks, this.enemies, this.heroes, this.barrels);
      this.cameras.main.shake(250, 0.010);
      this.cameras.main.flash(60, 160, 60, 200, false);
      DamageNumber.bigHit(this, x, y, dmg);
      this.audio.playExplosion();
    });

    this.events.on('enemyDied', (enemy?: Enemy, killer?: Hero) => {
      this.audio.playEnemyDeath();
      if (killer) killer.battleEnemiesKilled++;
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
            hero.battleHealingDone += 15;
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
    this.events.on('spawnWolf', (x: number, y: number, dmg: number, hp: number, druid?: Hero) => {
      this.spawnWolfMinion(x, y, dmg, hp, druid);
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

    const heroStats = this.heroes.map(h => ({
      heroClass: h.heroClass,
      damageDealt: Math.round(h.battleDamageDealt),
      blockDamage: Math.round(h.battleBlockDamage),
      enemiesKilled: h.battleEnemiesKilled,
      healingDone: Math.round(h.battleHealingDone),
    }));

    this.time.delayedCall(800, () => {
      this.scene.start('ResultScene', { victory, reason, gold, nodeId: this.activeNode.id, heroStats });
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
  private spawnWolfMinion(x: number, y: number, dmg: number, hp: number, druid?: Hero) {
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
          nearest.applyDamage(dmg, undefined, druid);
          if (druid) druid.battleDamageDealt += dmg;
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
        if (hero.state === 'flying') {
          if (hero.heroClass === 'MAGE') this.vfxSystem.mageTrailDot(hero.x, hero.y);
          else this.spawnTrailDot(hero.x, hero.y, hero.heroClass);
        }
      }
    }

    this.launchSystem.update(delta);
    this.combatSystem.update(delta);
    this.timeoutSystem.update(delta);
    this.squadUI.update();
    this.vfxSystem.update(delta);

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
