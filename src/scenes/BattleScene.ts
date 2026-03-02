import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT,
  SLING_X, SLING_Y,
  STARTER_SQUAD_SIZE,
  HeroClass, EnemyClass,
  HERO_STATS,
  ENEMY_STATS,
  HERO_FRICTION_AIR,
  LAUNCH_COOLDOWN_MS,
  HUD_BAR_HEIGHT,
  HAZARD,
  type MaterialType,
} from '@/config/constants';
import { getZoneTheme, type ZoneTheme, type BgElementDef } from '@/config/zoneThemes';

import { Hero } from '@/entities/Hero';
import { Enemy } from '@/entities/Enemy';
import { Block } from '@/entities/Block';
import { Barrel } from '@/entities/Barrel';
import { Coin } from '@/entities/Coin';
import { Projectile } from '@/entities/Projectile';
import { Hazard } from '@/entities/Hazard';
import type { GameBody } from '@/config/types';

import { LaunchSystem } from '@/systems/LaunchSystem';
import { CombatSystem } from '@/systems/CombatSystem';
import { ImpactSystem } from '@/systems/ImpactSystem';
import { TimeoutSystem } from '@/systems/TimeoutSystem';
import { VFXSystem } from '@/systems/VFXSystem';
import { SquadUI, type CooldownHeroInfo } from '@/ui/SquadUI';
import { DamageNumber } from '@/ui/DamageNumber';
import { isScreenShakeEnabled } from '@/systems/GameplaySettings';

import {
  getRunState, hasRunState, completeNode, syncSquadHp, newRun, getRelicModifiers, loadRun,
  addRelic, ensureActiveHero, getHeroesOnCooldown,
  addHeroBattleXP, getPendingLevelUps, ensureBattleSeed,
  type NodeDef, type RelicDef,
} from '@/systems/RunState';
import { AudioSystem } from '@/systems/AudioSystem';
import type { MusicSystem } from '@/systems/MusicSystem';
import { recordEnemyKill, recordHeroUsed } from '@/systems/DiscoveryLog';
import { addBlocksDestroyed, addEnemiesKilled, recordLaunchDamage, recordBattleTime } from '@/systems/RunHistory';
import { checkAchievements, incrementStat } from '@/systems/AchievementSystem';
import { isTutorialComplete, completeStep, getTutorialText, getNextStep } from '@/systems/TutorialSystem';
import { getAscensionModifiers } from '@/systems/AscensionSystem';
import { pickTemplate, pickTreasureTemplate } from '@/structures/index';
import type { StructureContext, HazardType } from '@/structures/types';
import nodesData from '@/data/nodes.json';
import relicsData from '@/data/relics.json';
import cursesData from '@/data/curses.json';
import { buildSettingsGear } from '@/ui/TopBar';

// ─── Scene ───────────────────────────────────────────────────────────────────

export class BattleScene extends Phaser.Scene {
  // Entities
  private heroes: Hero[] = [];
  private enemies: Enemy[] = [];
  private blocks: Block[] = [];
  private barrels: Barrel[] = [];
  private coins: Coin[] = [];
  private hazards: Hazard[] = [];

  // Zone theme for current battle
  private zoneTheme!: ZoneTheme;

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

  // TREASURE mode state
  private isTreasure = false;
  private shardBonus = 0;
  private treasureRelicAwarded = false;
  private treasureRelicName = '';
  private treasureSettleTimer = 0;
  private coinCountText!: Phaser.GameObjects.Text;

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
    this.hazards = [];
    this.coinGoldBonus = 0;
    this.trailTimer = 0;
    this.battleStartTime = 0;
    this.blocksDestroyedThisBattle = 0;
    this.barrelExplosionsThisBattle = 0;
    this.enemiesKilledThisBattle = 0;
    this.tutorialHint = null;
    this.shardBonus = 0;
    this.treasureRelicAwarded = false;
    this.treasureRelicName = '';
    this.treasureSettleTimer = 0;

    // Bootstrap run state if launched standalone (dev mode)
    if (!hasRunState()) {
      if (!loadRun()) {
        const nodes = nodesData.nodes as NodeDef[];
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
    this.isTreasure = this.activeNode.type === 'TREASURE';

    const music = this.registry.get('music') as MusicSystem | null;
    music?.play(this.isTreasure ? 'event' : this.activeNode.type === 'BOSS' ? 'boss' : 'battle');

    this.zoneTheme = getZoneTheme(run.currentMapId);
    this.buildBackground();
    this.vfxSystem = new VFXSystem(this, this.activeNode.difficulty ?? 1, this.zoneTheme);
    this.buildGround();
    this.buildStructure();
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
  // ─── End-run button ───────────────────────────────────────────────────────
  private buildEndRunButton() {
    const W = 160, H = 44, R = 7;
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
      fontSize: '16px', fontStyle: 'bold', fontFamily: 'Nunito, sans-serif',
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
      fontSize: '34px', fontFamily: 'Knights Quest, Nunito, sans-serif',
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
    if (isScreenShakeEnabled()) this.cameras.main.shake(600, 0.018);

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
      fontSize: '24px', fontFamily: 'Nunito, sans-serif',
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
      fontSize: '80px', fontFamily: 'Knights Quest, Nunito, sans-serif',
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
    this.time.delayedCall(420, () => { if (isScreenShakeEnabled()) this.cameras.main.shake(350, 0.010); });
  }

  // ─── Background ─────────────────────────────────────────────────────────
  private buildBackground() {
    const theme = this.zoneTheme;
    const diff = this.activeNode.difficulty ?? 1;
    // Darken sky slightly at higher difficulties within the zone
    const darken = diff >= 4 ? 0.7 : diff >= 3 ? 0.85 : 1.0;
    const skyColor = this.darkenColor(theme.skyColor, darken);

    this.bg = this.add.graphics().setDepth(-10);

    // ── Multi-stop sky gradient ──────────────────────────────────────────────
    if (theme.skyGradient && theme.skyGradient.length >= 2) {
      const stops = theme.skyGradient;
      for (let i = 0; i < stops.length - 1; i++) {
        const y0 = Math.round(stops[i].stop * GAME_HEIGHT);
        const y1 = Math.round(stops[i + 1].stop * GAME_HEIGHT);
        const c0 = this.darkenColor(stops[i].color, darken);
        const c1 = this.darkenColor(stops[i + 1].color, darken);
        this.bg.fillGradientStyle(c0, c0, c1, c1, 1);
        this.bg.fillRect(0, y0, GAME_WIDTH, y1 - y0);
      }
    } else {
      // Fallback: old 2-band sky
      this.bg.fillStyle(skyColor, 1);
      this.bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.65);
      this.bg.fillStyle(theme.skyLowerColor, 1);
      this.bg.fillRect(0, GAME_HEIGHT * 0.65, GAME_WIDTH, GAME_HEIGHT * 0.35);
    }

    // ── Celestial body with glow ─────────────────────────────────────────────
    const moonX = GAME_WIDTH - 120;
    const moonY = 80;

    // Outer glow
    if (theme.celestialGlow) {
      const g = theme.celestialGlow;
      this.bg.fillStyle(g.color, g.alpha);
      this.bg.fillCircle(moonX, moonY, g.radius);
      // Second softer glow ring
      this.bg.fillStyle(g.color, g.alpha * 0.4);
      this.bg.fillCircle(moonX, moonY, g.radius * 1.4);
    }

    if (theme.celestial === 'blood_moon') {
      // Corona rays (dark ring behind)
      if (theme.celestialGlow?.rays) {
        this.bg.lineStyle(2, theme.celestialColor, 0.15);
        for (let i = 0; i < theme.celestialGlow.rays; i++) {
          const angle = (i / theme.celestialGlow.rays) * Math.PI * 2;
          const r1 = 42;
          const r2 = 60;
          this.bg.beginPath();
          this.bg.moveTo(moonX + Math.cos(angle) * r1, moonY + Math.sin(angle) * r1);
          this.bg.lineTo(moonX + Math.cos(angle) * r2, moonY + Math.sin(angle) * r2);
          this.bg.strokePath();
        }
      }
      this.bg.fillStyle(theme.celestialColor, 0.8);
      this.bg.fillCircle(moonX, moonY, 38);
    } else if (theme.celestial === 'pale_moon') {
      // Corona rays
      if (theme.celestialGlow?.rays) {
        this.bg.lineStyle(1.5, theme.celestialColor, 0.12);
        for (let i = 0; i < theme.celestialGlow.rays; i++) {
          const angle = (i / theme.celestialGlow.rays) * Math.PI * 2;
          const r1 = 38;
          const r2 = 55;
          this.bg.beginPath();
          this.bg.moveTo(moonX + Math.cos(angle) * r1, moonY + Math.sin(angle) * r1);
          this.bg.lineTo(moonX + Math.cos(angle) * r2, moonY + Math.sin(angle) * r2);
          this.bg.strokePath();
        }
      }
      this.bg.fillStyle(theme.celestialColor, 0.9);
      this.bg.fillCircle(moonX, moonY, 34);
    } else {
      // Crescent moon
      this.bg.fillStyle(theme.celestialColor, 1);
      this.bg.fillCircle(moonX, moonY, 36);
      this.bg.fillStyle(
        theme.skyGradient ? this.darkenColor(theme.skyGradient[0].color, darken) : skyColor,
        1,
      );
      this.bg.fillCircle(moonX + 12, moonY - 8, 30);
    }

    // Stars — handled by VFXSystem (twinkling)

    // ── Horizon haze ─────────────────────────────────────────────────────────
    if (theme.horizonHaze) {
      const hz = theme.horizonHaze;
      const hzH = hz.yEnd - hz.yStart;
      const mid = hz.yStart + hzH * 0.5;
      // Fade in (transparent → peak)
      this.bg.fillGradientStyle(hz.color, hz.color, hz.color, hz.color, 0, 0, hz.peakAlpha, hz.peakAlpha);
      this.bg.fillRect(0, hz.yStart, GAME_WIDTH, mid - hz.yStart);
      // Fade out (peak → transparent)
      this.bg.fillGradientStyle(hz.color, hz.color, hz.color, hz.color, hz.peakAlpha, hz.peakAlpha, 0, 0);
      this.bg.fillRect(0, mid, GAME_WIDTH, hz.yEnd - mid);
    }

    // ── Ground with gradient + detail ────────────────────────────────────────
    const groundTop = GAME_HEIGHT - 100;
    this.bg.fillGradientStyle(theme.grassColor, theme.grassColor, theme.groundColor, theme.groundColor, 1);
    this.bg.fillRect(0, groundTop, GAME_WIDTH, 100);
    // Grass strip highlight
    this.bg.fillStyle(theme.grassColor, 1);
    this.bg.fillRect(0, groundTop, GAME_WIDTH, 10);

    // Ground tufts
    if (theme.groundDetail) {
      const seed = theme.skyColor & 0xffff; // deterministic per theme
      for (const tuft of theme.groundDetail.tufts) {
        for (let i = 0; i < tuft.count; i++) {
          const hash = ((seed + i * 7919 + tuft.color) * 2654435761) >>> 0;
          const tx = (hash % GAME_WIDTH);
          const th = tuft.height + (hash % 4) - 2;
          this.bg.fillStyle(tuft.color, 0.6);
          this.bg.fillRect(tx, groundTop - th + 2, tuft.width, th);
        }
      }
      // Lava cracks on ground
      if (theme.groundDetail.cracks) {
        const c = theme.groundDetail.cracks;
        for (let i = 0; i < c.count; i++) {
          const hash = ((seed + i * 6271) * 2654435761) >>> 0;
          const cx = hash % GAME_WIDTH;
          const cw = 30 + (hash % 40);
          // Glow behind
          this.bg.fillStyle(c.glowColor, 0.15);
          this.bg.fillRect(cx - 2, groundTop + 2, cw + 4, 6);
          // Crack line
          this.bg.fillStyle(c.color, 0.5);
          this.bg.fillRect(cx, groundTop + 3, cw, 2);
        }
      }
    }

    // ── Background decorative elements ───────────────────────────────────────
    this.drawBgElements(theme);

    // ── Hill mound (unchanged) ───────────────────────────────────────────────
    const groundY  = GAME_HEIGHT - 100;
    const peakY    = 545;
    const moundL   = 170;
    const moundR   = 490;

    const moundTop: { x: number; y: number }[] = [];
    for (let i = 0; i <= 40; i++) {
      const t    = i / 40;
      const px   = moundL + t * (moundR - moundL);
      const elev = (groundY - peakY) * Math.pow(Math.sin(Math.PI * t), 1.6);
      moundTop.push({ x: px, y: groundY - elev });
    }

    this.bg.fillStyle(theme.soilColor, 1);
    this.bg.fillPoints(
      [{ x: moundL, y: GAME_HEIGHT + 2 }, ...moundTop, { x: moundR, y: GAME_HEIGHT + 2 }],
      true,
    );

    this.bg.fillStyle(theme.hillGrassColor, 1);
    this.bg.fillPoints(
      [...moundTop, ...[...moundTop].reverse().map(p => ({ x: p.x, y: p.y + 13 }))],
      true,
    );
  }

  /** Draw background decorative elements based on zone theme, using 3 depth layers */
  private drawBgElements(theme: ZoneTheme) {
    const farGfx  = this.add.graphics().setDepth(-4);
    const midGfx  = this.add.graphics().setDepth(-3);
    const nearGfx = this.add.graphics().setDepth(-2);

    for (const el of theme.bgElements) {
      const layer = el.layer ?? 'mid';
      const gfx = layer === 'far' ? farGfx : layer === 'near' ? nearGfx : midGfx;
      this.drawBgElement(gfx, el);
    }
  }

  /** Render a single background element onto the given Graphics object */
  private drawBgElement(gfx: Phaser.GameObjects.Graphics, el: BgElementDef) {
    const s = el.scale ?? 1.0;
    const col = el.color ?? 0x111111;
    const a = el.alpha ?? 0.6;

    switch (el.type) {
      // ── Existing element types (enhanced) ──────────────────────────────────
      case 'tree_silhouette': {
        gfx.fillStyle(col, a);
        gfx.fillRect(el.x - 4 * s, el.y - 30 * s, 8 * s, 60 * s);
        gfx.fillCircle(el.x, el.y - 40 * s, 25 * s);
        gfx.fillCircle(el.x - 15 * s, el.y - 25 * s, 20 * s);
        gfx.fillCircle(el.x + 15 * s, el.y - 25 * s, 20 * s);
        // Extra foliage for depth
        gfx.fillCircle(el.x + 8 * s, el.y - 35 * s, 18 * s);
        break;
      }
      case 'pine_silhouette': {
        gfx.fillStyle(col, a);
        gfx.fillRect(el.x - 3 * s, el.y - 20 * s, 6 * s, 50 * s);
        // Two-tier canopy
        gfx.fillTriangle(
          el.x, el.y - 70 * s,
          el.x - 18 * s, el.y - 20 * s,
          el.x + 18 * s, el.y - 20 * s,
        );
        gfx.fillTriangle(
          el.x, el.y - 55 * s,
          el.x - 24 * s, el.y - 5 * s,
          el.x + 24 * s, el.y - 5 * s,
        );
        break;
      }
      case 'mountain_peak': {
        gfx.fillStyle(col, 0.5);
        gfx.fillTriangle(
          el.x, el.y - 100 * s,
          el.x - 80 * s, el.y + 80 * s,
          el.x + 80 * s, el.y + 80 * s,
        );
        // Snow cap
        gfx.fillStyle(0xddddff, 0.3);
        gfx.fillTriangle(
          el.x, el.y - 100 * s,
          el.x - 20 * s, el.y - 60 * s,
          el.x + 20 * s, el.y - 60 * s,
        );
        break;
      }
      case 'volcanic_peak': {
        gfx.fillStyle(col, a);
        gfx.fillTriangle(
          el.x, el.y - 120 * s,
          el.x - 90 * s, el.y + 100 * s,
          el.x + 90 * s, el.y + 100 * s,
        );
        // Glowing tip
        gfx.fillStyle(0xff4400, 0.3);
        gfx.fillCircle(el.x, el.y - 110 * s, 10 * s);
        // Lava glow at crater
        gfx.fillStyle(0xff6600, 0.15);
        gfx.fillCircle(el.x, el.y - 115 * s, 18 * s);
        break;
      }
      case 'aurora': {
        // Enhanced: 6 bands, gradient green→purple, thicker + wider amplitude
        const colors = [0x44ffaa, 0x55ffbb, 0x66eebb, 0x88ccdd, 0xaa88ee, 0xcc66ff];
        for (let band = 0; band < 6; band++) {
          const bandColor = colors[band];
          gfx.lineStyle(4, bandColor, 0.12);
          const by = el.y + band * 18;
          gfx.beginPath();
          gfx.moveTo(120, by);
          for (let px = 120; px < GAME_WIDTH - 120; px += 8) {
            const wave = Math.sin(px * 0.006 + band * 1.2) * 28
              + Math.sin(px * 0.012 + band * 0.7) * 10;
            gfx.lineTo(px, by + wave);
          }
          gfx.strokePath();
        }
        break;
      }
      case 'lava_flow': {
        gfx.fillStyle(col, 0.3);
        gfx.fillRect(el.x - 8, el.y, 16, GAME_HEIGHT - el.y);
        gfx.fillStyle(0xffaa00, 0.15);
        gfx.fillRect(el.x - 4, el.y + 10, 8, GAME_HEIGHT - el.y - 10);
        break;
      }
      case 'smoke_column': {
        for (let i = 0; i < 5; i++) {
          gfx.fillStyle(col, 0.1 - i * 0.015);
          gfx.fillCircle(el.x + i * 6, el.y - i * 28 * s, (15 + i * 9) * s);
        }
        break;
      }
      case 'stake_fence': {
        gfx.fillStyle(col, 0.4);
        for (let i = 0; i < 5; i++) {
          gfx.fillRect(el.x + i * 15, el.y - 20, 6, 30);
        }
        gfx.fillRect(el.x - 2, el.y - 10, 75, 4);
        break;
      }
      case 'campfire': {
        gfx.fillStyle(col, 0.4);
        gfx.fillCircle(el.x, el.y, 6);
        gfx.fillStyle(0xffcc00, 0.25);
        gfx.fillCircle(el.x, el.y - 4, 4);
        // Glow
        gfx.fillStyle(0xff8844, 0.06);
        gfx.fillCircle(el.x, el.y - 2, 18);
        break;
      }
      case 'ice_sheen': {
        gfx.fillStyle(col, 0.08);
        gfx.fillRect(0, el.y, GAME_WIDTH, 8);
        break;
      }

      // ── New element types ──────────────────────────────────────────────────
      case 'ridgeline': {
        const w = el.width ?? GAME_WIDTH;
        const segments = 12;
        const seed = (el.x * 137 + el.y * 251) >>> 0;
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const px = el.x + t * w;
          const hash = ((seed + i * 7919) * 2654435761) >>> 0;
          const variation = ((hash % 100) / 100) * 40 * s - 20 * s;
          const wave = Math.sin(t * Math.PI * 2.5 + seed * 0.001) * 25 * s;
          pts.push({ x: px, y: el.y + wave + variation });
        }
        gfx.fillStyle(col, a);
        gfx.fillPoints(
          [...pts, { x: el.x + w, y: GAME_HEIGHT }, { x: el.x, y: GAME_HEIGHT }],
          true,
        );
        break;
      }
      case 'treeline': {
        const w = el.width ?? 400;
        gfx.fillStyle(col, a);
        // Row of overlapping circle canopies along baseline
        const count = Math.floor(w / 30);
        for (let i = 0; i < count; i++) {
          const tx = el.x + i * 30 + (i % 3) * 5;
          const r = (14 + (i % 4) * 4) * s;
          gfx.fillCircle(tx, el.y - r * 0.5, r);
        }
        // Solid fill below tree line
        gfx.fillRect(el.x, el.y, w, GAME_HEIGHT - el.y);
        break;
      }
      case 'ruined_tower': {
        gfx.fillStyle(col, a);
        const tw = 22 * s;
        const th = 80 * s;
        // Main body
        gfx.fillRect(el.x - tw / 2, el.y - th, tw, th);
        // Jagged top (broken)
        gfx.fillTriangle(
          el.x - tw / 2, el.y - th,
          el.x - tw * 0.3, el.y - th - 15 * s,
          el.x, el.y - th,
        );
        gfx.fillTriangle(
          el.x, el.y - th,
          el.x + tw * 0.2, el.y - th - 10 * s,
          el.x + tw / 2, el.y - th,
        );
        break;
      }
      case 'broken_wall': {
        gfx.fillStyle(col, a);
        const segW = 18 * s;
        const segH = 22 * s;
        // 4 wall segments with gaps
        for (let i = 0; i < 4; i++) {
          const sx = el.x + i * (segW + 8 * s);
          const sh = segH - (i % 2) * 6 * s; // varying heights
          gfx.fillRect(sx, el.y - sh, segW, sh);
        }
        break;
      }
      case 'jagged_crag': {
        gfx.fillStyle(col, a);
        const seed2 = (el.x * 173 + el.y * 311) >>> 0;
        const pts2: { x: number; y: number }[] = [];
        const numPoints = 7;
        // Build irregular spiky polygon
        for (let i = 0; i < numPoints; i++) {
          const hash = ((seed2 + i * 4937) * 2654435761) >>> 0;
          const angle = (i / numPoints) * Math.PI - Math.PI * 0.1;
          const r = (30 + (hash % 30)) * s;
          pts2.push({
            x: el.x + Math.cos(angle) * r,
            y: el.y - Math.sin(angle) * r,
          });
        }
        // Close at base
        pts2.push({ x: el.x + 40 * s, y: el.y + 10 });
        pts2.push({ x: el.x - 40 * s, y: el.y + 10 });
        gfx.fillPoints(pts2, true);
        break;
      }
      case 'ruined_citadel': {
        gfx.fillStyle(col, a);
        const cw = 60 * s;
        // Left tower
        gfx.fillRect(el.x - cw, el.y - 70 * s, 20 * s, 70 * s);
        gfx.fillTriangle(
          el.x - cw, el.y - 70 * s,
          el.x - cw + 10 * s, el.y - 85 * s,
          el.x - cw + 20 * s, el.y - 70 * s,
        );
        // Right tower (shorter, broken)
        gfx.fillRect(el.x + cw - 20 * s, el.y - 55 * s, 20 * s, 55 * s);
        gfx.fillTriangle(
          el.x + cw - 20 * s, el.y - 55 * s,
          el.x + cw - 8 * s, el.y - 65 * s,
          el.x + cw, el.y - 55 * s,
        );
        // Broken wall between
        for (let i = 0; i < 3; i++) {
          const wx = el.x - cw + 25 * s + i * 28 * s;
          const wh = (25 - i * 5) * s;
          gfx.fillRect(wx, el.y - wh, 20 * s, wh);
        }
        break;
      }
      case 'fog_wisp': {
        const wispA = a * 0.7;
        // Overlapping semi-transparent ellipses along sine wave
        for (let i = 0; i < 6; i++) {
          const wx = el.x + i * 30 * s;
          const wy = el.y + Math.sin(i * 1.2) * 8;
          gfx.fillStyle(col, wispA - i * 0.01);
          gfx.fillEllipse(wx, wy, 35 * s, 10 * s);
        }
        break;
      }
      case 'ice_formation': {
        gfx.fillStyle(col, a);
        // 4 tall thin triangles at varied angles
        for (let i = 0; i < 4; i++) {
          const ix = el.x + (i - 1.5) * 12 * s;
          const ih = (35 + i * 8) * s;
          const lean = (i - 1.5) * 3 * s;
          gfx.fillTriangle(
            ix + lean, el.y - ih,
            ix - 5 * s, el.y,
            ix + 5 * s, el.y,
          );
        }
        break;
      }
      case 'glacier_cliff': {
        gfx.fillStyle(col, a);
        // 5-point angular polygon
        const gcw = 50 * s;
        const gch = 60 * s;
        gfx.fillPoints([
          { x: el.x - gcw, y: el.y },
          { x: el.x - gcw * 0.6, y: el.y - gch * 0.7 },
          { x: el.x, y: el.y - gch },
          { x: el.x + gcw * 0.4, y: el.y - gch * 0.5 },
          { x: el.x + gcw, y: el.y },
        ], true);
        // Ice highlight edge
        gfx.lineStyle(1, 0x88aacc, a * 0.5);
        gfx.beginPath();
        gfx.moveTo(el.x - gcw * 0.6, el.y - gch * 0.7);
        gfx.lineTo(el.x, el.y - gch);
        gfx.lineTo(el.x + gcw * 0.4, el.y - gch * 0.5);
        gfx.strokePath();
        break;
      }
      case 'ground_mushroom': {
        gfx.fillStyle(col, a);
        // Thin stem
        gfx.fillRect(el.x - 2 * s, el.y - 12 * s, 4 * s, 12 * s);
        // Half-circle cap
        gfx.fillCircle(el.x, el.y - 12 * s, 8 * s);
        // Cut the bottom half of the cap with ground color
        gfx.fillStyle(col, a);
        gfx.fillRect(el.x - 9 * s, el.y - 12 * s, 18 * s, 8 * s);
        // Redraw actual cap shape
        gfx.fillStyle(col, a * 1.2);
        gfx.fillEllipse(el.x, el.y - 14 * s, 16 * s, 8 * s);
        break;
      }
      case 'snow_drift': {
        const dw = el.width ?? 400;
        gfx.fillStyle(col, a);
        // Sine-undulating filled band
        const driftPts: { x: number; y: number }[] = [];
        for (let px = 0; px <= dw; px += 8) {
          const wave = Math.sin(px * 0.015 + el.x * 0.01) * 6
            + Math.sin(px * 0.03) * 3;
          driftPts.push({ x: el.x + px, y: el.y + wave });
        }
        // Close at bottom
        driftPts.push({ x: el.x + dw, y: el.y + 15 });
        driftPts.push({ x: el.x, y: el.y + 15 });
        gfx.fillPoints(driftPts, true);
        break;
      }
      case 'icicle_edge': {
        const iw = el.width ?? 400;
        gfx.fillStyle(col, a);
        const icicleCount = Math.floor(iw / 20);
        for (let i = 0; i < icicleCount; i++) {
          const ix = el.x + i * 20 + (i % 3) * 4;
          const ih = 8 + (i % 4) * 4;
          gfx.fillTriangle(
            ix - 3, el.y,
            ix + 3, el.y,
            ix, el.y + ih,
          );
        }
        break;
      }
      case 'ash_cloud': {
        // 8 overlapping circles at scattered positions
        const seed3 = (el.x * 199 + el.y * 337) >>> 0;
        for (let i = 0; i < 8; i++) {
          const hash = ((seed3 + i * 5471) * 2654435761) >>> 0;
          const ox = ((hash % 80) - 40) * s;
          const oy = ((hash >> 8) % 40 - 20) * s;
          const r = (12 + (hash >> 16) % 15) * s;
          gfx.fillStyle(col, a);
          gfx.fillCircle(el.x + ox, el.y + oy, r);
        }
        break;
      }
      case 'lava_crack': {
        const lcw = el.width ?? 80;
        // Glow behind
        gfx.fillStyle(col, a * 0.4);
        gfx.fillRect(el.x, el.y - 3, lcw, 8);
        // Jagged crack line
        gfx.lineStyle(2, col, a);
        gfx.beginPath();
        gfx.moveTo(el.x, el.y);
        const segments = 6;
        for (let i = 1; i <= segments; i++) {
          const lx = el.x + (i / segments) * lcw;
          const ly = el.y + ((i % 2) * 2 - 1) * 3;
          gfx.lineTo(lx, ly);
        }
        gfx.strokePath();
        break;
      }
    }
  }

  private darkenColor(color: number, factor: number): number {
    const r = Math.round(((color >> 16) & 0xff) * factor);
    const g = Math.round(((color >> 8) & 0xff) * factor);
    const bv = Math.round((color & 0xff) * factor);
    return (r << 16) | (g << 8) | bv;
  }

  // ─── Ground ─────────────────────────────────────────────────────────────
  private buildGround() {
    // Frozen zones have slippery ground
    const run = getRunState();
    const isFrozen = run.currentMapId === 'frozen_peaks';
    const groundFriction = isFrozen ? 0.3 : 0.8;

    this.ground = this.matter.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT - 50,
      GAME_WIDTH, 100,
      { isStatic: true, label: 'ground', friction: groundFriction, restitution: 0.04 },
    ) as MatterJS.BodyType;

    const hillOpts = { isStatic: true, label: 'hill', friction: isFrozen ? 0.2 : 0.6, restitution: 0.08 };
    this.matter.add.rectangle(330, 558, 160, 44, hillOpts);
    this.matter.add.rectangle(290, 580, 80,  20, hillOpts);
    this.matter.add.rectangle(370, 580, 80,  20, hillOpts);
  }

  // ─── Structure templates (delegated to src/structures/) ─────────────────
  private buildStructure() {
    const run = getRunState();
    const zone = run.currentMapId;
    const diff = this.activeNode.difficulty ?? 1;

    // Deterministic seed: set on first visit, reused on retry
    const seed = ensureBattleSeed();
    const template = this.isTreasure
      ? pickTreasureTemplate(seed)
      : pickTemplate(zone, diff, seed);

    const templateCoins: Array<[number, number, number]> = [];
    const terrainBodies: Array<{ x: number; y: number; w: number; h: number }> = [];

    const ctx: StructureContext = {
      groundY: GAME_HEIGHT - 100,
      block: (x, y, w, h, mat) => {
        this.blocks.push(new Block(this, x, y, w, h, mat));
      },
      barrel: (x, y) => {
        this.barrels.push(new Barrel(this, x, y));
      },
      hazard: (type: HazardType, x: number, y: number) => {
        this.hazards.push(new Hazard(this, type, x, y));
      },
      coin: (x, y, value) => {
        templateCoins.push([x, y, value]);
      },
      terrain: (x, y, w, h) => {
        terrainBodies.push({ x, y, w, h });
      },
      enemySlots: [],
    };

    // TREASURE: add shard and chest callbacks
    if (this.isTreasure) {
      ctx.shard = (x, y) => {
        this.coins.push(new Coin(this, x, y, 0, 'shard'));
      };
      ctx.chest = (x, y) => {
        this.coins.push(new Coin(this, x, y, 0, 'chest'));
      };
    }

    template(ctx);
    if (!this.isTreasure) this.placeEnemies(ctx.enemySlots);
    this.spawnTemplateCoins(templateCoins);
    this.buildTerrain(terrainBodies);
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
    // Ascension HP scaling — use dedicated elite/boss/enemy mults
    const ascHpMult = this.activeNode.type === 'BOSS' ? ascMods.bossHpMult
                    : this.activeNode.type === 'ELITE' ? ascMods.eliteHpMult
                    : ascMods.enemyHpMult;
    const hpMult = baseHpMult * ascHpMult;

    // Seeded jitter: use battleSeed so retries produce identical placement
    const seed = run.battleSeed;
    enemyList.forEach((cls, i) => {
      const slot = slots[i % slots.length];
      const jitter = i >= slots.length
        ? ((((seed * 16807 + i * 48271) & 0x7fffffff) % 61) - 30)  // seeded ±30
        : 0;
      // Slots use eR=20 for y placement; adjust for enemies with different radii
      const actualRadius = ENEMY_STATS[cls as EnemyClass]?.radius ?? 20;
      const yAdjust = 20 - actualRadius;
      this.enemies.push(new Enemy(this, slot.x + jitter, slot.y + yAdjust, cls as EnemyClass, hpMult));
    });
  }

  // ─── Squad ─────────────────────────────────────────────────────────────
  private buildSquad() {
    const run = getRunState();
    const mods = getRelicModifiers();
    const ascMods = getAscensionModifiers(run.ascensionLevel);

    // Ensure at least one hero is available (failsafe if all are on cooldown)
    ensureActiveHero();

    // Filter out heroes on revive cooldown, then apply ascension cuts
    let squadData = run.squad.filter(h => (h.reviveCooldown ?? 0) <= 0);
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
    this.audio = this.registry.get('audio') as AudioSystem ?? new AudioSystem();
    this.registry.set('audio', this.audio); // shared with SettingsScene

    this.combatSystem = new CombatSystem(this, this.heroes, this.enemies);
    this.impactSystem = new ImpactSystem(this, this.combatSystem, this.heroes);
    this.timeoutSystem = new TimeoutSystem(this);
    this.launchSystem = new LaunchSystem(this, this.heroes);
    const cooldownHeroes: CooldownHeroInfo[] = getHeroesOnCooldown().map(h => ({
      heroClass: h.heroClass,
      cooldownRemaining: h.reviveCooldown ?? 0,
    }));
    const squadOrder = getRunState().squad.map(h => h.heroClass);
    this.squadUI = new SquadUI(this, this.heroes, cooldownHeroes, squadOrder);

    // HUD counter panel (top-right)
    this.enemyPanel = this.add.graphics().setDepth(49);
    this.enemyPanel.fillStyle(0x060b12, 0.88);
    this.enemyPanel.fillRoundedRect(GAME_WIDTH - 174, 12, 162, 42, 7);
    this.enemyPanel.lineStyle(1, this.isTreasure ? 0x5a5a10 : 0x5a1010, 0.7);
    this.enemyPanel.strokeRoundedRect(GAME_WIDTH - 174, 12, 162, 42, 7);

    if (this.isTreasure) {
      // TREASURE mode: show coin counter
      this.add.text(GAME_WIDTH - 93, 20, 'COINS', {
        fontSize: '14px', fontFamily: 'Nunito, sans-serif',
        color: '#5a5a3a', letterSpacing: 2,
      }).setOrigin(0.5, 0).setDepth(50);
      this.coinCountText = this.add.text(GAME_WIDTH - 93, 32, '0', {
        fontSize: '24px', fontStyle: 'bold', fontFamily: 'Nunito, sans-serif',
        color: '#f1c40f', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5, 0).setDepth(50);
      // Dummy enemy counter (hidden)
      this.enemyCountText = this.add.text(0, 0, '').setVisible(false);
    } else {
      // Normal battle: enemy counter
      this.add.text(GAME_WIDTH - 93, 20, 'ENEMIES', {
        fontSize: '14px', fontFamily: 'Nunito, sans-serif',
        color: '#5a3a3a', letterSpacing: 2,
      }).setOrigin(0.5, 0).setDepth(50);
      this.enemyCountText = this.add.text(GAME_WIDTH - 93, 32,
        `${this.enemies.length}`, {
          fontSize: '24px', fontStyle: 'bold', fontFamily: 'Nunito, sans-serif',
          color: '#e74c3c', stroke: '#000', strokeThickness: 3,
        },
      ).setOrigin(0.5, 0).setDepth(50);
    }

    // Gear / settings button — top-left corner (standardized TopBar)
    // Override default listener with battle-aware one that blocks after battle ends
    const gearCt = buildSettingsGear(this, 'BattleScene', 55);
    // The hit rectangle is the last child in the container — override its listener
    const gearHit = gearCt.list[gearCt.list.length - 1] as Phaser.GameObjects.Rectangle;
    gearHit.removeAllListeners('pointerdown');
    gearHit.on('pointerdown', () => {
      if (!this.battleEnded) this.scene.launch('SettingsScene', { callerKey: 'BattleScene' });
    });

    this.launchSystem.onLaunch = () => {
      this.audio.playLaunch();
      if (!isTutorialComplete()) {
        completeStep('releaseToFire');
        completeStep('trajectoryDots');
        this.updateTutorialHint();
      }
      if (this.launchSystem.allLaunched && !this.isTreasure) this.startTimeoutIfNeeded();
    };

    // TREASURE: show "End Level" button immediately
    if (this.isTreasure) {
      this.buildTreasureEndButton();
    }

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
    const heroA = (bA as GameBody).__hero;
    const heroB = (bB as GameBody).__hero;
    const hero = heroA ?? heroB;
    const other = hero === heroA ? bB : bA;

    if (hero && hero.state === 'flying') {
      // Rogue piercing: if flying through a block with piercing counter, deal damage but don't stop
      if (hero.piercing > 0 && other.label?.startsWith('block_')) {
        const block = this.blocks.find(b => b.body === other);
        if (block && !block.destroyed) {
          const v = hero.body?.velocity ?? { x: 0, y: 0 };
          const speed = Math.hypot(v.x, v.y);
          const pierceDmg = speed * 15;
          block.applyDamage(pierceDmg); // piercing damage
          hero.battleBlockDamage += pierceDmg;
          hero.piercing--; // decrement pierce counter
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
        if (isScreenShakeEnabled()) this.cameras.main.shake(150, shakeStrength);
      }
    }

    // Coin pickup — any hero that touches a coin/shard/chest sensor collects it
    if (hero) {
      const coinBody = bA.label === 'coin' ? bA : bB.label === 'coin' ? bB : null;
      if (coinBody) this.processCoinPickup(coinBody);

      // TREASURE: shard crystal pickup
      const shardBody = bA.label === 'shard_crystal' ? bA : bB.label === 'shard_crystal' ? bB : null;
      if (shardBody) this.processShardPickup(shardBody);

      // TREASURE: chest pickup
      const chestBody = bA.label === 'chest' ? bA : bB.label === 'chest' ? bB : null;
      if (chestBody) this.processChestPickup(chestBody);
    }

    // Block crush check
    if (other.label?.startsWith('block_')) {
      const block = this.blocks.find(b => b.body === other || b.body === bA);
      if (block && !block.destroyed) {
        this.impactSystem.handleBlockCrush(block, this.heroes, this.enemies);
      }
    }

    // Spike trap collision — hero takes spike damage, trap takes impact damage
    if (hero && other.label === 'hazard_spike') {
      const trap = this.hazards.find(h => h.body === other && !h.destroyed);
      if (trap) {
        // Damage hero
        hero.applyDamage(HAZARD.SPIKE_TRAP.damage);
        DamageNumber.damage(this, hero.x, hero.y, HAZARD.SPIKE_TRAP.damage);
        // Hero impact damages the trap (destroyable)
        if (hero.state === 'flying') {
          const v = hero.body?.velocity ?? { x: 0, y: 0 };
          const speed = Math.hypot(v.x, v.y);
          const impactDmg = speed * 10;
          trap.applyDamage(impactDmg);
        }
      }
    }

  }

  // ─── Events ──────────────────────────────────────────────────────────────
  private buildEventHandlers() {
    // Geyser eruption damage
    this.events.on('geyserErupted', (gx: number, gy: number, radius: number, damage: number) => {
      this.handleGeyserEruption(gx, gy, radius, damage);
    });

    this.events.on('barrelExploded', (x: number, y: number, r: number, dmg: number) => {
      this.impactSystem.handleBarrelExplosion(x, y, r, dmg, this.blocks, this.enemies, this.heroes, this.barrels);
      if (isScreenShakeEnabled()) this.cameras.main.shake(350, 0.015);
      this.cameras.main.flash(80, 255, 160, 30, false);
      DamageNumber.bigHit(this, x, y, dmg);
      this.audio.playExplosion();
      this.barrelExplosionsThisBattle++;
    });

    this.events.on('blockDestroyed', (x: number, y: number, mat: string) => {
      this.spawnDebris(x, y, mat as MaterialType);
      if (mat === 'WOOD') this.vfxSystem.dustCloud(x, y);
      else if (mat === 'STONE') this.vfxSystem.stoneSparkShower(x, y);
      else if (mat === 'ICE') this.vfxSystem.iceShatter(x, y);
      else if (mat === 'OBSIDIAN') this.vfxSystem.obsidianCrack(x, y);
      if (isScreenShakeEnabled()) this.cameras.main.shake(80, mat === 'OBSIDIAN' ? 0.006 : 0.003);
      this.audio.playBlockHit(mat as MaterialType);
      this.blocksDestroyedThisBattle++;
      addBlocksDestroyed(1);
      // Wake ALL sleeping bodies so they fall when support is removed.
      // (80px radius was too small — top of a tower stayed floating when the base was knocked out.)
      for (const b of this.blocks) {
        if (!b.destroyed) this.wakeBody(b.body);
      }
      for (const e of this.enemies) {
        if (e.state !== 'dead') this.wakeBody(e.body);
      }
      for (const barrel of this.barrels) {
        if (!barrel.exploded) this.wakeBody(barrel.body);
      }
      for (const h of this.heroes) {
        if (h.body && h.state !== 'dead') this.wakeBody(h.body as MatterJS.BodyType);
      }
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
      if (isScreenShakeEnabled()) this.cameras.main.shake(250, 0.010);
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
      // Heal-on-kill relic: heal all living heroes
      if (mods.healOnKill > 0) {
        for (const h of this.heroes) {
          if (h.state !== 'dead') {
            h.heal(mods.healOnKill);
          }
        }
      }
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

    // Ranger triple split: spawn 2 flanking arrow projectiles on launch
    this.events.on('rangerSplitLaunch', (hero: Hero, vx: number, vy: number) => {
      const stats = HERO_STATS.RANGER;
      const splitCount = stats.splitCount;
      const spreadDeg = stats.splitSpreadDeg;
      const splitDmg = stats.splitDamage;
      const launchAngle = Math.atan2(vy, vx);
      const launchSpeed = Math.hypot(vx, vy) * 0.85;
      for (let i = 0; i < splitCount; i++) {
        const sign = i === 0 ? -1 : 1;
        const angle = launchAngle + Phaser.Math.DegToRad(spreadDeg * sign);
        const pvx = Math.cos(angle) * launchSpeed;
        const pvy = Math.sin(angle) * launchSpeed;
        const p = new Projectile(this, SLING_X, SLING_Y, pvx, pvy, splitDmg, 0x27ae60);
        p.sourceHero = hero;
        // Override frictionAir to match hero trajectory
        if (p.body) p.body.frictionAir = HERO_FRICTION_AIR;
        this.combatSystem.addProjectile(p);
      }
    });

    // Mage cluster grenade: bomblets launch upward with random spread, then arc down
    this.events.on('mageClusterSpawn', (x: number, y: number, hero: Hero) => {
      const stats = HERO_STATS.MAGE;
      const count = stats.clusterCount + (hero.skillMods?.clusterCountBonus ?? 0);
      const dmg = stats.clusterDamage;
      // Stagger spawns to avoid frame-spike from creating all bodies at once
      for (let i = 0; i < count; i++) {
        this.time.delayedCall(i * 120, () => {
          if (this.battleEnded) return;
          const hSpeed = Phaser.Math.FloatBetween(-3, 3);      // tight horizontal spread
          const vSpeed = Phaser.Math.FloatBetween(-14, -10);    // strong upward launch
          const p = new Projectile(this, x, y, hSpeed, vSpeed, dmg, 0x8e44ad);
          p.sourceHero = hero;
          // Low air friction so bomblets arc high and fall naturally with gravity
          if (p.body) p.body.frictionAir = 0.005;
          this.combatSystem.addProjectile(p);
        });
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
    if (this.isTreasure) return; // TREASURE: victory handled by checkTreasureVictory / End Level button
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
      // completeNode first (ticks existing cooldowns), then syncSquadHp (assigns new cooldowns for dead heroes)
      // Regen is applied on the overworld map so the player sees health bars increase
      completeNode(this.activeNode.id);
      syncSquadHp(this.heroes.map(h => ({ heroClass: h.heroClass, hp: h.hp, maxHp: h.maxHp, state: h.state })));
      addHeroBattleXP();
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
      const allRelics = (relicsData as RelicDef[]).filter(r => !r.curse);
      const allCurses = (cursesData as RelicDef[]).filter(r => r.curse === true);
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
      impactDamage: Math.round(h.battleImpactDamage),
      blockDamage: Math.round(h.battleBlockDamage),
      enemiesKilled: h.battleEnemiesKilled,
      healingDone: Math.round(h.battleHealingDone),
    }));

    const pendingLevelUps = victory ? getPendingLevelUps() : [];
    const extraShards = this.isTreasure ? this.shardBonus : 0;
    const treasureRelicName = this.isTreasure ? this.treasureRelicName : '';
    this.time.delayedCall(800, () => {
      this.scene.start('ResultScene', { victory, reason, gold, nodeId: this.activeNode.id, heroStats, pendingLevelUps, extraShards, treasureRelicName });
    });
  }

  // ─── Coins ─────────────────────────────────────────────────────────────────
  /** Spawn coins from template-provided positions (easy coins first, risky last). */
  private spawnTemplateCoins(layout: Array<[number, number, number]>) {
    // Ascension: reduced gold → halve coin count (removes easy coins first)
    const run = getRunState();
    const ascMods = getAscensionModifiers(run.ascensionLevel);
    let coinLayout = layout;
    if (ascMods.reducedGold && layout.length > 1) {
      coinLayout = layout.filter((_, i) => i % 2 === 0);
    }

    for (const [x, y] of coinLayout) {
      this.coins.push(new Coin(this, x, y, 5));
    }
  }

  // ─── Terrain ──────────────────────────────────────────────────────────────
  /** Create static terrain bodies (platforms, berms) and draw them. */
  private buildTerrain(bodies: Array<{ x: number; y: number; w: number; h: number }>) {
    if (bodies.length === 0) return;

    const run = getRunState();
    const isFrozen = run.currentMapId === 'frozen_peaks';
    const terrainColor = this.zoneTheme.groundColor;
    const topColor = this.zoneTheme.grassColor;

    const gfx = this.add.graphics();
    gfx.setDepth(-1); // behind blocks and entities

    for (const { x, y, w, h } of bodies) {
      // Static physics body
      this.matter.add.rectangle(x, y, w, h, {
        isStatic: true,
        label: 'terrain',
        friction: isFrozen ? 0.3 : 0.8,
        restitution: 0.04,
      });

      // Visual: filled rect with grass top
      gfx.fillStyle(terrainColor, 1);
      gfx.fillRect(x - w / 2, y - h / 2, w, h);
      // Grass/snow/lava crust line on top
      gfx.fillStyle(topColor, 1);
      gfx.fillRect(x - w / 2, y - h / 2, w, 3);
    }
  }

  private processCoinPickup(coinBody: MatterJS.BodyType) {
    const coin = this.coins.find(c => c.body === coinBody && !c.collected);
    if (!coin) return;

    coin.collect();

    // Remove body immediately (it's a static sensor, safe to do mid-collision handler)
    this.matter.world.remove(coinBody);

    this.coinGoldBonus += coin.value;

    // Floating gold text at current bob position (y tracks the bob tween)
    DamageNumber.show(this, coin.x, coin.graphics.y, coin.value, {
      prefix: '+', color: '#f1c40f', fontSize: 22,
    });

    this.audio.playCoinPickup();
  }

  // ─── TREASURE pickups ──────────────────────────────────────────────────────
  private processShardPickup(shardBody: MatterJS.BodyType) {
    const shard = this.coins.find(c => c.body === shardBody && !c.collected && c.coinType === 'shard');
    if (!shard) return;

    shard.collect();
    this.matter.world.remove(shardBody);
    this.shardBonus++;

    // Blue floating text
    DamageNumber.show(this, shard.x, shard.graphics.y, 1, {
      prefix: '+', suffix: ' shard', color: '#7ec8e3', fontSize: 24,
    });

    this.audio.playCoinPickup();
  }

  private processChestPickup(chestBody: MatterJS.BodyType) {
    const chest = this.coins.find(c => c.body === chestBody && !c.collected && c.coinType === 'chest');
    if (!chest) return;
    if (this.treasureRelicAwarded) return; // only one chest per level

    chest.collect();
    this.matter.world.remove(chestBody);
    this.treasureRelicAwarded = true;

    // Award a random relic
    const run = getRunState();
    const ownedIds = new Set(run.relics.map(r => r.id));
    const pool = (relicsData as RelicDef[]).filter(r => !r.curse && !ownedIds.has(r.id));
    if (pool.length > 0) {
      const relic = pool[Math.floor(Math.random() * pool.length)];
      addRelic(relic as RelicDef);
      this.treasureRelicName = relic.name;

      // Floating relic name
      DamageNumber.show(this, chest.x, chest.graphics.y - 10, 0, {
        text: `${relic.name}!`, color: '#f1c40f', fontSize: 26,
      });
    }

    this.audio.playCoinPickup();
  }

  // ─── TREASURE auto-victory ──────────────────────────────────────────────────
  private checkTreasureVictory(delta: number) {
    if (this.battleEnded || !this.launchSystem.allLaunched) {
      this.treasureSettleTimer = 0;
      return;
    }

    // Check if all heroes have stopped flying (settled or dead)
    const anyFlying = this.heroes.some(h => h.state === 'flying');
    if (anyFlying) {
      this.treasureSettleTimer = 0;
      return;
    }

    // Check hero speeds — must all be below threshold
    const allSlow = this.heroes.every(h => {
      if (h.state === 'dead') return true;
      const v = h.body?.velocity ?? { x: 0, y: 0 };
      return Math.hypot(v.x, v.y) < 0.5;
    });

    if (!allSlow) {
      this.treasureSettleTimer = 0;
      return;
    }

    this.treasureSettleTimer += delta;
    if (this.treasureSettleTimer >= 1500) {
      this.endBattle(true, 'Treasure looted!');
    }
  }

  // ─── TREASURE End Level button ─────────────────────────────────────────────
  private buildTreasureEndButton() {
    const W = 170, H = 44, R = 7;
    const bx = GAME_WIDTH - W / 2 - 10;
    const by = GAME_HEIGHT - HUD_BAR_HEIGHT / 2;

    const bg = this.add.graphics();
    const drawBg = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(0x2a2800, hovered ? 1 : 0.88);
      bg.fillRoundedRect(-W / 2, -H / 2, W, H, R);
      bg.lineStyle(1.5, hovered ? 0xf1c40f : 0x7a6a10, hovered ? 1 : 0.75);
      bg.strokeRoundedRect(-W / 2, -H / 2, W, H, R);
    };
    drawBg(false);

    const label = this.add.text(0, 0, 'END LEVEL \u2713', {
      fontSize: '16px', fontStyle: 'bold', fontFamily: 'Nunito, sans-serif',
      color: '#f1c40f', stroke: '#000', strokeThickness: 2,
      letterSpacing: 2,
    }).setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, W, H, 0, 0).setInteractive();
    hit.on('pointerover',  () => { drawBg(true);  label.setStyle({ color: '#ffe066' }); });
    hit.on('pointerout',   () => { drawBg(false); label.setStyle({ color: '#f1c40f' }); });
    hit.on('pointerdown',  () => {
      if (!this.battleEnded) this.endBattle(true, 'Treasure looted!');
    });

    this.endRunBtn = this.add.container(bx, by, [bg, label, hit]).setDepth(60).setAlpha(0);
    this.tweens.add({ targets: this.endRunBtn, alpha: 1, duration: 300, ease: 'Power2' });
  }

  /** Wake a sleeping Matter.js body (isSleeping/sleepCounter are valid but not always in Phaser's type defs). */
  private wakeBody(body: MatterJS.BodyType) {
    const b = body as MatterJS.BodyType & { isSleeping: boolean; sleepCounter: number };
    if (b.isSleeping) {
      b.isSleeping = false;
      b.sleepCounter = 0;
    }
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
  private spawnDebris(x: number, y: number, material: MaterialType) {
    const colorMap: Record<MaterialType, number[]> = {
      WOOD:     [0x8B5E3C, 0x6B4020, 0xA07040, 0x7B4E2C],
      STONE:    [0x7f8c8d, 0x606060, 0x9f9f9f, 0x5a6a6b],
      ICE:      [0xb0d4e8, 0x88ccff, 0xddeeFF, 0xaaccee],
      OBSIDIAN: [0x1a0808, 0x330808, 0x440a0a, 0xff6600],
    };
    const colors = colorMap[material];

    for (let i = 0; i < 9; i++) {
      const g = this.add.graphics().setDepth(15);
      const col = colors[Phaser.Math.Between(0, colors.length - 1)];
      g.fillStyle(col, 1);

      if (material === 'WOOD') {
        const sw = Phaser.Math.Between(5, 14);
        const sh = Phaser.Math.Between(2, 5);
        g.fillRect(-sw / 2, -sh / 2, sw, sh);
      } else if (material === 'ICE') {
        // Crystal-like angular shards
        const sw = Phaser.Math.Between(3, 8);
        const sh = Phaser.Math.Between(4, 10);
        g.fillRect(-sw / 2, -sh / 2, sw, sh);
      } else {
        // Rounded chunks (stone + obsidian)
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
    // ── Wolf body ───────────────────────────────────────────────────────────
    const wolf = this.add.graphics().setDepth(12);
    const drawWolf = (lunging: boolean) => {
      wolf.clear();
      const sc = lunging ? 1.3 : 1;
      // Body
      wolf.fillStyle(0x16a085, 0.9);
      wolf.fillEllipse(0, 0, 18 * sc, 12 * sc);
      // Head
      wolf.fillStyle(0x1abc9c, 1);
      wolf.fillCircle(7 * sc, -3, 6);
      // Eyes (glow when lunging)
      wolf.fillStyle(lunging ? 0xffff00 : 0x0d2818, 1);
      wolf.fillCircle(9 * sc, -5, lunging ? 2.5 : 1.5);
      // Ears
      wolf.fillStyle(0x16a085, 1);
      wolf.fillTriangle(4, -8, 7, -14, 10, -8);
    };
    drawWolf(false);
    wolf.setPosition(x, y);

    // Spawn burst
    wolf.setScale(0.3).setAlpha(0);
    this.tweens.add({ targets: wolf, scaleX: 1, scaleY: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });

    let wolfHp = hp;
    let attackTimer = 0;
    let lunging = false;
    const TICK_MS = 80;
    const RUN_SPEED = 6;
    const LUNGE_SPEED = 14;
    const LUNGE_RANGE = 80;
    const ATTACK_RANGE = 28;
    const ATTACK_COOLDOWN = 800;
    const WOLF_RADIUS = 10;
    const BLOCK_DMG = Math.ceil(dmg * 0.6); // wolves deal reduced damage to structures
    const BLOCK_HIT_COOLDOWN = 400;         // don't shred blocks instantly
    let blockHitTimer = BLOCK_HIT_COOLDOWN; // ready to hit immediately

    // Cache target to avoid scanning every tick
    let cachedTarget: Enemy | null = null;
    let targetScanTimer = 0;

    // Trail particles
    let trailTimer = 0;
    const spawnTrail = () => {
      const t = this.add.graphics().setDepth(11);
      t.fillStyle(0x1abc9c, 0.5);
      t.fillCircle(0, 0, Phaser.Math.Between(2, 4));
      t.setPosition(wolf.x - (lunging ? 4 : 2), wolf.y + 2);
      this.tweens.add({ targets: t, alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 250, onComplete: () => t.destroy() });
    };

    const killWolf = () => {
      wolfHp = 0;
      this.tweens.add({
        targets: wolf, alpha: 0, scaleX: 1.5, scaleY: 1.5,
        duration: 200, onComplete: () => wolf.destroy(),
      });
    };

    const wolfUpdate = () => {
      if (wolfHp <= 0 || this.battleEnded) {
        wolf.destroy();
        this.time.removeEvent(updateEvent);
        return;
      }

      // Re-scan for nearest enemy periodically
      targetScanTimer += TICK_MS;
      if (!cachedTarget || cachedTarget.state === 'dead' || targetScanTimer >= 300) {
        targetScanTimer = 0;
        cachedTarget = null;
        let nearestDist = Infinity;
        for (const e of this.enemies) {
          if (e.state === 'dead') continue;
          const d = Math.hypot(e.x - wolf.x, e.y - wolf.y);
          if (d < nearestDist) { nearestDist = d; cachedTarget = e; }
        }
      }

      // ── Block collision: damage blocks in the way, wolf takes recoil ──
      blockHitTimer += TICK_MS;
      if (blockHitTimer >= BLOCK_HIT_COOLDOWN) {
        for (const b of this.blocks) {
          if (b.destroyed) continue;
          const bx = b.body.position.x, by = b.body.position.y;
          // Simple overlap: wolf circle vs block AABB
          const closestX = Phaser.Math.Clamp(wolf.x, bx - b.halfW, bx + b.halfW);
          const closestY = Phaser.Math.Clamp(wolf.y, by - b.halfH, by + b.halfH);
          const dd = Math.hypot(wolf.x - closestX, wolf.y - closestY);
          if (dd < WOLF_RADIUS) {
            b.applyDamage(BLOCK_DMG);
            DamageNumber.blockDamage(this, bx, by, BLOCK_DMG);
            wolfHp -= 8;
            blockHitTimer = 0;
            if (wolfHp <= 0) { killWolf(); return; }
            break; // one block per cooldown
          }
        }
      }

      if (cachedTarget) {
        const dx = cachedTarget.x - wolf.x;
        const dy = cachedTarget.y - wolf.y;
        const dist = Math.hypot(dx, dy);

        // Face direction of travel
        wolf.setScale(dx < 0 ? -1 : 1, 1);

        // Lunge when close enough and attack ready
        const canLunge = !lunging && dist < LUNGE_RANGE && dist > ATTACK_RANGE && attackTimer >= ATTACK_COOLDOWN * 0.7;
        if (canLunge) {
          lunging = true;
          drawWolf(true);
          this.time.delayedCall(200, () => { lunging = false; drawWolf(false); });
        }

        const speed = lunging ? LUNGE_SPEED : RUN_SPEED;
        if (dist > ATTACK_RANGE * 0.6) {
          wolf.x += (dx / dist) * speed;
          wolf.y += (dy / dist) * speed;
        }

        // Trail while moving
        trailTimer += TICK_MS;
        if (trailTimer >= (lunging ? 50 : 160)) {
          trailTimer = 0;
          spawnTrail();
        }

        // Attack enemy
        attackTimer += TICK_MS;
        if (dist < ATTACK_RANGE && attackTimer >= ATTACK_COOLDOWN) {
          attackTimer = 0;
          cachedTarget.applyDamage(dmg, undefined, druid);
          if (druid) druid.battleDamageDealt += dmg;
          DamageNumber.damage(this, cachedTarget.x, cachedTarget.y, dmg);

          // Bite flash
          const flash = this.add.graphics().setDepth(13);
          flash.fillStyle(0xffff00, 0.7);
          flash.fillCircle(0, 0, 8);
          flash.setPosition(cachedTarget.x, cachedTarget.y);
          this.tweens.add({ targets: flash, alpha: 0, scaleX: 2, scaleY: 2, duration: 150, onComplete: () => flash.destroy() });

          wolfHp -= 5;
          if (wolfHp <= 0) { killWolf(); return; }
        }
      }
    };

    const updateEvent = this.time.addEvent({
      delay: TICK_MS, callback: wolfUpdate, loop: true,
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
      fontSize: '18px', fontFamily: 'Nunito, sans-serif',
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

  // ─── Hazard helpers ────────────────────────────────────────────────────────
  private updateLavaDots() {
    for (const hz of this.hazards) {
      if (hz.type !== 'LAVA_PIT' || !hz.shouldApplyLavaDot()) continue;
      const cfg = HAZARD.LAVA_PIT;
      // Damage heroes in range
      for (const h of this.heroes) {
        if (h.state === 'dead') continue;
        const d = Math.hypot(h.x - hz.x, h.y - hz.y);
        if (d < cfg.radius) {
          h.applyDamage(cfg.damage);
          DamageNumber.damage(this, h.x, h.y, cfg.damage);
        }
      }
      // Damage enemies in range (lava hurts everyone)
      for (const e of this.enemies) {
        if (e.state === 'dead') continue;
        const d = Math.hypot(e.x - hz.x, e.y - hz.y);
        if (d < cfg.radius) {
          e.applyDamage(cfg.damage);
          DamageNumber.damage(this, e.x, e.y, cfg.damage);
        }
      }
    }
  }

  private handleGeyserEruption(gx: number, gy: number, radius: number, damage: number) {
    // Damage heroes in eruption column
    for (const h of this.heroes) {
      if (h.state === 'dead') continue;
      const dx = Math.abs(h.x - gx);
      const dy = gy - h.y; // geyser damages upward
      if (dx < radius * 0.5 && dy > 0 && dy < radius * 2) {
        h.applyDamage(damage);
        DamageNumber.damage(this, h.x, h.y, damage);
      }
    }
    // Damage enemies in eruption column
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      const dx = Math.abs(e.x - gx);
      const dy = gy - e.y;
      if (dx < radius * 0.5 && dy > 0 && dy < radius * 2) {
        e.applyDamage(damage);
        DamageNumber.damage(this, e.x, e.y, damage);
      }
    }
    if (isScreenShakeEnabled()) this.cameras.main.shake(200, 0.008);
  }

  // ─── Update ────────────────────────────────────────────────────────────────
  update(_time: number, delta: number) {
    if (this.battleEnded) return;

    for (const b of this.blocks)   b.update();
    for (const e of this.enemies)  e.update();
    for (const h of this.heroes)   h.update();
    for (const b of this.barrels)  b.update();
    for (const hz of this.hazards) hz.update(delta);

    this.blocks = this.blocks.filter(b => !b.destroyed);
    this.hazards = this.hazards.filter(h => !h.destroyed);
    this.coins  = this.coins.filter(c => !c.collected);

    // Lava pit DoT — damage heroes and enemies standing in lava
    this.updateLavaDots();

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

    if (this.isTreasure) {
      // TREASURE mode: update coin counter + check for auto-victory
      this.coinCountText.setText(`${this.coinGoldBonus}`);
      this.checkTreasureVictory(delta);
    } else {
      // Normal battle: update enemy counter
      const alive = this.enemies.filter(e => e.state !== 'dead').length;
      this.enemyCountText.setText(`${alive}`);
    }

    // Drain queued shake
    if (this.shakeQueued > 0) {
      if (isScreenShakeEnabled()) this.cameras.main.shake(100, this.shakeQueued);
      this.shakeQueued = 0;
    }

    if (this.launchSystem.allLaunched && !this.isTreasure) {
      this.startTimeoutIfNeeded();
      this.checkLoss();
      if (!this.endRunBtnShown && this.enemies.some(e => e.state !== 'dead')) {
        this.endRunBtnShown = true;
        this.buildEndRunButton();
      }
    }
  }
}
