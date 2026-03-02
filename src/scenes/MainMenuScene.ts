import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT,
  CAMP_SHOOTING_STAR_MIN_INTERVAL, CAMP_SHOOTING_STAR_MAX_INTERVAL,
  CAMP_SHOOTING_STAR_COLOR, HERO_STATS, HERO_PASSIVES,
  MAX_DRAG_DISTANCE, LAUNCH_POWER_MULTIPLIER, GRAVITY_PER_FRAME, HERO_FRICTION_AIR,
  TRAJECTORY_POINTS, TRAJECTORY_SIM_FRAMES, TRAJECTORY_DOT_EVERY,
} from '@/config/constants';
import type { HeroClass } from '@/config/constants';
import {
  getShards, earnShards, getMetaBonuses, getPurchaseCount,
} from '@/systems/MetaState';
import { hasSavedRun } from '@/systems/RunState';
import { Hero } from '@/entities/Hero';
import { Enemy } from '@/entities/Enemy';
import { isFirebaseAvailable, fetchTopScores, getFirebaseUid } from '@/services/LeaderboardService';
import { subscribeToChat, unsubscribeFromChat, sendChatMessage, type ChatMessage } from '@/services/ChatService';
import { getProfile, ensureProfile } from '@/systems/PlayerProfile';
import { CAMP_STRUCTURES, CAMP_ALWAYS_VISIBLE, LAYER_CFG } from '@/data/campBuildings';
import type { ParallaxLayer } from '@/data/campBuildings';
import type { MusicSystem } from '@/systems/MusicSystem';
import { isScreenShakeEnabled } from '@/systems/GameplaySettings';
import { buildSettingsGear, buildCurrencyBar, type CurrencyBarResult } from '@/ui/TopBar';

interface MainMenuData {
  shardsEarned?: number;
  fromDefeat?: boolean;
}

interface BuildingHitZone {
  x: number; y: number; w: number; h: number;
  name: string; desc: string;
  level?: number; maxLevel?: number;
  depth: number;
}

const CAMP_SLING_X = 140;

// Per-hero walking state
interface HeroWalkState {
  sprite: Phaser.GameObjects.Sprite;
  key: string;
  targetX: number;
  pauseUntil: number;   // timestamp (ms) — 0 = not pausing
  walking: boolean;
  slingState: 'none' | 'walkingToSling' | 'waiting' | 'flying';
}

export class MainMenuScene extends Phaser.Scene {
  private _shardBar: CurrencyBarResult | null = null;
  private _layerGfx: Phaser.GameObjects.Graphics[] = [];
  private _fireGfx: Phaser.GameObjects.Graphics | null = null;
  private _heroStates: HeroWalkState[] = [];
  private _transitioning = false;
  private _slingOccupied = false;
  private _slingBands: Phaser.GameObjects.Graphics | null = null;
  private _slingHero: HeroWalkState | null = null;
  private _slingHitZone: Phaser.GameObjects.Rectangle | null = null;
  private _dragging = false;
  private _slingWaitStart = 0;
  private _buildingHitZones: BuildingHitZone[] = [];
  private _tooltipContainer: Phaser.GameObjects.Container | null = null;
  private _tooltipTimer: Phaser.Time.TimerEvent | null = null;
  private _trajectoryGfx: Phaser.GameObjects.Graphics | null = null;
  private _flyingHeroes: { hw: HeroWalkState; vx: number; vy: number }[] = [];
  private _chatContainer: Phaser.GameObjects.Container | null = null;
  private _chatInput: HTMLInputElement | null = null;
  private _chatMessages: ChatMessage[] = [];

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(data: MainMenuData = {}) {
    this._transitioning = false;
    this._slingOccupied = false;
    this._slingHero = null;
    this._dragging = false;
    this._slingWaitStart = 0;
    (this.registry.get('music') as MusicSystem | null)?.play('menu');
    const { shardsEarned = 0 } = data;

    if (shardsEarned > 0) earnShards(shardsEarned);

    this.cameras.main.fadeIn(400, 0, 0, 0);

    this.buildBackground();
    this.scheduleShootingStar();
    this.buildCampStructures();
    this.buildBuildingHitZones();
    this.buildCampSling();
    this.buildHeroSprites();
    this.setupSlingInput();
    this.buildTitle();
    this._shardBar = buildCurrencyBar(this, 'shard', () => getShards(), 10);
    this.buildShardEarnedBadge(shardsEarned);
    buildSettingsGear(this, 'MainMenuScene', 20);
    this.buildProfileButton();
    this.buildLeaderboardStrip();
    this.buildChatPanel();
    this.buildButtons();

    // Build version stamp (auto-updates each compile)
    const buildTime = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '';
    const short = buildTime.replace(/T/, ' ').replace(/\.\d+Z$/, '');
    this.add.text(GAME_WIDTH - 8, GAME_HEIGHT - 6, `build ${short}`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#555555',
    }).setOrigin(1, 1).setDepth(100).setAlpha(0.5);

    this.events.once('shutdown', this.onShutdown, this);
    this.events.off('resume', this.onResume, this); // prevent accumulation
    this.events.on('resume', this.onResume, this);

    // Enter key opens chat (desktop shortcut)
    this._chatKeyHandler = (e: KeyboardEvent) => {
      // Don't capture if chat input is already focused or a dialog is open
      if (document.activeElement === this._chatInput) return;
      if (e.key === 'Enter' && this._chatInputBar) {
        e.preventDefault();
        this.showChatInput();
      }
    };
    document.addEventListener('keydown', this._chatKeyHandler);
  }

  private _chatKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  private onShutdown() {
    unsubscribeFromChat();
    if (this._chatInputBar) { this._chatInputBar.remove(); this._chatInputBar = null; }
    if (this._chatInput) { this._chatInput.remove(); this._chatInput = null; }
    this._chatPlaceholder = null;
    if (this._chatKeyHandler) {
      document.removeEventListener('keydown', this._chatKeyHandler);
      this._chatKeyHandler = null;
    }
  }

  update(_time: number, _delta: number) {
    const now = this.time.now;
    const heroRestY = LAYER_CFG.mid.y - 16;

    // Physics loop for flying heroes
    for (let i = this._flyingHeroes.length - 1; i >= 0; i--) {
      const f = this._flyingHeroes[i];
      f.vx *= (1 - HERO_FRICTION_AIR);
      f.vy *= (1 - HERO_FRICTION_AIR);
      f.vy += GRAVITY_PER_FRAME;
      f.hw.sprite.x += f.vx;
      f.hw.sprite.y += f.vy;
      f.hw.sprite.angle += f.vx * 3; // spin

      // Off-screen check — teleport back to ground
      if (f.hw.sprite.x < -100 || f.hw.sprite.x > GAME_WIDTH + 100 || f.hw.sprite.y > GAME_HEIGHT + 100) {
        const landX = Phaser.Math.Between(200, 1100);
        f.hw.sprite.x = landX;
        f.hw.sprite.y = heroRestY;
        f.hw.sprite.angle = 0;
        f.hw.sprite.setFlipX(false);
        f.hw.slingState = 'none';
        this.spawnDust(landX, heroRestY);
        const idleAnim = `${f.hw.key}_idle`;
        if (this.anims.exists(idleAnim)) f.hw.sprite.play(idleAnim);
        f.hw.pauseUntil = now + Phaser.Math.Between(500, 1500);
        this._flyingHeroes.splice(i, 1);
      }
    }

    for (const h of this._heroStates) {
      // Skip flying heroes — physics loop controls them
      if (h.slingState === 'flying') continue;

      // Handle waiting-at-sling state
      if (h.slingState === 'waiting') {
        if (!this._dragging) {
          this.drawSlingBands(h.sprite.x, h.sprite.y);
          if (now - this._slingWaitStart > 8000) {
            this.ejectFromSling(h, now);
          }
        }
        continue;
      }

      if (h.pauseUntil > 0) {
        if (now < h.pauseUntil) continue;
        h.pauseUntil = 0;
        h.targetX = Phaser.Math.Between(200, 1100);
        h.walking = true;
        const walkAnim = `${h.key}_walk`;
        if (this.anims.exists(walkAnim)) {
          h.sprite.play(walkAnim);
        }
        h.sprite.setFlipX(h.targetX < h.sprite.x);
      }

      if (!h.walking) continue;

      const dx = h.targetX - h.sprite.x;
      if (Math.abs(dx) < 5) {
        h.walking = false;
        const idleAnim = `${h.key}_idle`;
        if (this.anims.exists(idleAnim)) {
          h.sprite.play(idleAnim);
        }

        if (h.slingState === 'walkingToSling') {
          // Arrived at sling — enter waiting state
          h.sprite.x = CAMP_SLING_X;
          h.slingState = 'waiting';
          this._slingOccupied = true;
          this._slingHero = h;
          this._slingWaitStart = now;
          this._slingHitZone?.setInteractive({ useHandCursor: true });
        } else if (h.sprite.x < 300 && !this._slingOccupied && Math.random() < 0.25) {
          // Near sling zone — chance to walk to sling
          this._slingOccupied = true; // reserve immediately to prevent races
          h.slingState = 'walkingToSling';
          h.targetX = CAMP_SLING_X;
          h.walking = true;
          const walkAnim2 = `${h.key}_walk`;
          if (this.anims.exists(walkAnim2)) h.sprite.play(walkAnim2);
          h.sprite.setFlipX(CAMP_SLING_X < h.sprite.x);
        } else {
          h.pauseUntil = now + Phaser.Math.Between(1000, 4000);
        }
      } else {
        h.sprite.x += Math.sign(dx) * 0.4;
        h.sprite.setFlipX(dx < 0);
      }
    }
  }

  private onResume() {
    // Reset sling state
    this._slingOccupied = false;
    this._slingHero = null;
    this._dragging = false;
    this._flyingHeroes = [];
    if (this._slingBands) { this._slingBands.destroy(); this._slingBands = null; }
    if (this._slingHitZone) { this._slingHitZone.destroy(); this._slingHitZone = null; }
    if (this._trajectoryGfx) { this._trajectoryGfx.destroy(); this._trajectoryGfx = null; }
    // Destroy and rebuild camp layers (sling post is in _layerGfx)
    for (const g of this._layerGfx) { this.tweens.killTweensOf(g); g.destroy(); }
    this._layerGfx = [];
    if (this._fireGfx) { this.tweens.killTweensOf(this._fireGfx); this._fireGfx.destroy(); this._fireGfx = null; }
    this.dismissTooltip();
    this.buildCampStructures();
    this.buildBuildingHitZones();
    this.buildCampSling();
    // Rebuild heroes (new unlocks)
    this.destroyHeroes();
    this.buildHeroSprites();
    this._shardBar?.updateValue();
  }

  private destroyHeroes() {
    for (const h of this._heroStates) {
      this.tweens.killTweensOf(h.sprite);
      h.sprite.destroy();
    }
    this._heroStates = [];
    this._flyingHeroes = [];
    this._slingOccupied = false;
    this._slingHero = null;
    this._dragging = false;
  }

  // ── Background (sky + parallax ground strips) ─────────────────────────
  private buildBackground() {
    const bg = this.add.graphics().setDepth(0);
    const midY = LAYER_CFG.mid.y;

    // Sky gradient (0 → distant terrain start)
    bg.fillGradientStyle(0x0a0e2a, 0x0a0e2a, 0x142040, 0x142040, 1);
    bg.fillRect(0, 0, GAME_WIDTH, 498);

    // Distant terrain transition (498 → midY) — subtle hill area
    bg.fillGradientStyle(0x101830, 0x101830, 0x152a15, 0x152a15, 1);
    bg.fillRect(0, 498, GAME_WIDTH, midY - 498);

    // Main ground (midY → bottom)
    bg.fillGradientStyle(0x1a3a1a, 0x1a3a1a, 0x0d1f0d, 0x0d1f0d, 1);
    bg.fillRect(0, midY, GAME_WIDTH, GAME_HEIGHT - midY);

    // Foreground ground — slightly different shade below midY
    bg.fillGradientStyle(0x16321a, 0x16321a, 0x0b1a0e, 0x0b1a0e, 0.5);
    bg.fillRect(0, midY + 6, GAME_WIDTH, GAME_HEIGHT - midY - 6);

    // Parallax ground strips — a grass/path line at each layer Y
    const strips: { y: number; intensity: number; tufts: number }[] = [
      { y: LAYER_CFG.superBg.y, intensity: 0.12, tufts: 8 },
      { y: LAYER_CFG.bg.y,      intensity: 0.22, tufts: 14 },
      { y: midY,                 intensity: 0.80, tufts: 50 },
      { y: LAYER_CFG.fg.y,      intensity: 0.30, tufts: 16 },
      { y: LAYER_CFG.superFg.y, intensity: 0.18, tufts: 10 },
    ];
    for (const strip of strips) {
      bg.fillStyle(0x2a5a2a, strip.intensity);
      bg.fillRect(0, strip.y, GAME_WIDTH, 3);
      bg.fillStyle(0x3a7a3a, strip.intensity * 0.6);
      for (let i = 0; i < strip.tufts; i++) {
        const gx = Phaser.Math.Between(0, GAME_WIDTH);
        bg.fillRect(gx, strip.y - Phaser.Math.Between(2, 7), 2, Phaser.Math.Between(3, 8));
      }
    }

    // Stars (sky area only)
    for (let i = 0; i < 80; i++) {
      const sx = Phaser.Math.Between(0, GAME_WIDTH);
      const sy = Phaser.Math.Between(0, 480);
      bg.fillStyle(0xffffff, Math.random() * 0.4 + 0.1);
      bg.fillCircle(sx, sy, Math.random() < 0.15 ? 2 : 1);
    }

    // Crescent moon
    bg.fillStyle(0xf0e8c0, 0.85);
    bg.fillCircle(GAME_WIDTH - 140, 80, 22);
    bg.fillStyle(0x0a0e2a, 1);
    bg.fillCircle(GAME_WIDTH - 130, 74, 20);
  }

  // ── Shooting Stars ──────────────────────────────────────────────────────
  private scheduleShootingStar() {
    const delay = Phaser.Math.Between(CAMP_SHOOTING_STAR_MIN_INTERVAL, CAMP_SHOOTING_STAR_MAX_INTERVAL);
    this.time.delayedCall(delay, () => {
      this.spawnShootingStar();
      this.scheduleShootingStar();
    });
  }

  private spawnShootingStar() {
    const startX = Phaser.Math.Between(50, GAME_WIDTH - 200);
    const startY = Phaser.Math.Between(20, GAME_HEIGHT * 0.3);
    const endX = startX + Phaser.Math.Between(200, 400);
    const endY = startY + Phaser.Math.Between(80, 200);
    const color = CAMP_SHOOTING_STAR_COLOR;
    const duration = Phaser.Math.Between(400, 700);
    const tailLen = 10;

    const g = this.add.graphics().setDepth(0.5);
    this.tweens.add({
      targets: { t: 0 },
      t: 1,
      duration,
      onUpdate: (_tw: Phaser.Tweens.Tween, obj: { t: number }) => {
        const t = obj.t;
        const cx = startX + (endX - startX) * t;
        const cy = startY + (endY - startY) * t;
        g.clear();
        for (let i = 0; i < tailLen; i++) {
          const tt = Math.max(0, t - i * 0.015);
          const tx = startX + (endX - startX) * tt;
          const ty = startY + (endY - startY) * tt;
          const r = Math.max(0.5, 3 - i * 0.3);
          const a = Math.max(0, 1 - i / tailLen) * (1 - t * 0.3);
          g.fillStyle(color, a);
          g.fillCircle(tx, ty, r);
        }
        g.fillStyle(0xffffff, 1 - t * 0.4);
        g.fillCircle(cx, cy, 2.5);
      },
      onComplete: () => g.destroy(),
    });
  }

  // ── Camp structures (parallax layers) ─────────────────────────────────
  private buildCampStructures() {
    this._layerGfx = [];
    this._buildingHitZones = [];
    const midY = LAYER_CFG.mid.y;

    // ── Middle layer (always: hut + log) ──
    const midGfx = this.add.graphics().setDepth(LAYER_CFG.mid.depth);
    this._layerGfx.push(midGfx);

    // Hut — enhanced with window, chimney, wood grain
    // Shadow
    midGfx.fillStyle(0x000000, 0.15);
    midGfx.fillEllipse(200, midY, 70, 10);
    // Walls
    midGfx.fillStyle(0x6b5030, 1);
    midGfx.fillRect(170, midY - 50, 60, 50);
    midGfx.lineStyle(1, 0x4a3820, 1);
    midGfx.strokeRect(170, midY - 50, 60, 50);
    // Wood grain lines
    midGfx.lineStyle(1, 0x5a4020, 0.3);
    midGfx.lineBetween(172, midY - 30, 228, midY - 30);
    midGfx.lineBetween(172, midY - 18, 228, midY - 18);
    // Roof
    midGfx.fillStyle(0x8b6914, 1);
    midGfx.fillTriangle(165, midY - 50, 200, midY - 72, 235, midY - 50);
    // Roof edge highlight
    midGfx.lineStyle(1, 0xa07a20, 0.4);
    midGfx.lineBetween(165, midY - 50, 200, midY - 72);
    // Door
    midGfx.fillStyle(0x3a2810, 1);
    midGfx.fillRect(190, midY - 22, 14, 22);
    // Window (warm glow)
    midGfx.fillStyle(0xd4a030, 0.6);
    midGfx.fillRect(175, midY - 42, 10, 10);
    midGfx.lineStyle(1, 0x5a4020, 0.8);
    midGfx.strokeRect(175, midY - 42, 10, 10);
    midGfx.lineBetween(180, midY - 42, 180, midY - 32);
    midGfx.lineBetween(175, midY - 37, 185, midY - 37);
    // Chimney
    midGfx.fillStyle(0x5a5a6a, 1);
    midGfx.fillRect(215, midY - 68, 8, 18);
    midGfx.fillStyle(0x6a6a7a, 1);
    midGfx.fillRect(213, midY - 70, 12, 4);

    // Hut tooltip hitzone
    this._buildingHitZones.push({
      x: 200, y: midY - 35, w: 70, h: 72,
      name: 'Camp Hut', desc: 'Home sweet home. Your base of operations.',
      depth: LAYER_CFG.mid.depth,
    });

    // Log beside fire
    midGfx.fillStyle(0x5a4020, 1);
    midGfx.fillRect(264, midY - 6, 32, 6);
    midGfx.lineStyle(1, 0x4a3018, 0.4);
    midGfx.lineBetween(266, midY - 4, 294, midY - 4);

    // Campfire — enhanced with more flame layers + stone ring
    this._fireGfx = this.add.graphics().setDepth(LAYER_CFG.mid.depth);
    // Stone ring
    this._fireGfx.fillStyle(0x4a4a5a, 0.6);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      this._fireGfx.fillCircle(280 + Math.cos(angle) * 12, midY - 4 + Math.sin(angle) * 5, 3);
    }
    // Glow base
    this._fireGfx.fillStyle(0xff6600, 0.25);
    this._fireGfx.fillCircle(280, midY - 6, 20);
    // Outer flame
    this._fireGfx.fillStyle(0xff4400, 0.4);
    this._fireGfx.fillCircle(280, midY - 8, 10);
    // Mid flame
    this._fireGfx.fillStyle(0xff6600, 0.6);
    this._fireGfx.fillCircle(280, midY - 10, 6);
    // Core
    this._fireGfx.fillStyle(0xffaa00, 0.8);
    this._fireGfx.fillCircle(280, midY - 12, 3);
    // Hot white center
    this._fireGfx.fillStyle(0xfff0a0, 0.5);
    this._fireGfx.fillCircle(280, midY - 13, 1.5);
    this.tweens.add({
      targets: this._fireGfx, alpha: 0.7, duration: 800,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Campfire tooltip hitzone
    this._buildingHitZones.push({
      x: 280, y: midY - 10, w: 40, h: 30,
      name: 'Campfire', desc: 'Gather round. Keeps the night at bay.',
      depth: LAYER_CFG.mid.depth,
    });

    // ── Always-visible buildings ──
    const alwaysByLayer = new Map<ParallaxLayer, typeof CAMP_ALWAYS_VISIBLE>();
    for (const bldg of CAMP_ALWAYS_VISIBLE) {
      if (!alwaysByLayer.has(bldg.layer)) alwaysByLayer.set(bldg.layer, []);
      alwaysByLayer.get(bldg.layer)!.push(bldg);
    }

    for (const [layerKey, items] of alwaysByLayer.entries()) {
      const lcfg = LAYER_CFG[layerKey];
      // Mid-layer always-visible buildings go on the existing midGfx
      const g = layerKey === 'mid' ? midGfx : this.add.graphics().setDepth(lcfg.depth).setAlpha(lcfg.alpha);
      if (layerKey !== 'mid') this._layerGfx.push(g);
      for (const bldg of items) {
        bldg.buildFn(g, bldg.x, lcfg.y);
        this._buildingHitZones.push({
          x: bldg.x, y: lcfg.y - bldg.hitH / 2,
          w: bldg.hitW, h: bldg.hitH,
          name: bldg.name, desc: bldg.desc,
          depth: lcfg.depth,
        });
      }
    }

    // ── Per-upgrade structures on their assigned layers ──
    const byLayer = new Map<ParallaxLayer, Array<{ x: number; buildFn: (typeof CAMP_STRUCTURES)[string]['buildFn']; count: number; def: (typeof CAMP_STRUCTURES)[string] }>>();
    for (const [id, cfg] of Object.entries(CAMP_STRUCTURES)) {
      const count = getPurchaseCount(id);
      if (count === 0) continue;
      if (!byLayer.has(cfg.layer)) byLayer.set(cfg.layer, []);
      byLayer.get(cfg.layer)!.push({ x: cfg.x, buildFn: cfg.buildFn, count, def: cfg });
    }

    for (const [layerKey, items] of byLayer.entries()) {
      const lcfg = LAYER_CFG[layerKey];
      const g = this.add.graphics().setDepth(lcfg.depth).setAlpha(lcfg.alpha);
      this._layerGfx.push(g);
      for (const item of items) {
        item.buildFn(g, item.x, lcfg.y, item.count);
        this._buildingHitZones.push({
          x: item.x, y: lcfg.y - item.def.hitH / 2,
          w: item.def.hitW, h: item.def.hitH,
          name: item.def.name, desc: item.def.desc,
          level: item.count, maxLevel: item.def.maxLevel,
          depth: lcfg.depth,
        });
      }
    }
  }

  // ── Camp sling (interactive decoration) ──────────────────────────────
  private buildCampSling() {
    const midY = LAYER_CFG.mid.y;
    const forkY = midY - 30;
    const leftTip = { x: CAMP_SLING_X - 14, y: midY - 50 };
    const rightTip = { x: CAMP_SLING_X + 14, y: midY - 50 };
    const heroY = midY - 16;

    // Y-fork post
    const postGfx = this.add.graphics().setDepth(LAYER_CFG.mid.depth);
    postGfx.lineStyle(6, 0x5a4020, 0.9);
    postGfx.lineBetween(CAMP_SLING_X, midY, CAMP_SLING_X, forkY);
    postGfx.lineStyle(5, 0x6b5030, 0.9);
    postGfx.lineBetween(CAMP_SLING_X, forkY, leftTip.x, leftTip.y);
    postGfx.lineBetween(CAMP_SLING_X, forkY, rightTip.x, rightTip.y);
    postGfx.fillStyle(0x8b6914, 1);
    postGfx.fillCircle(leftTip.x, leftTip.y, 3);
    postGfx.fillCircle(rightTip.x, rightTip.y, 3);
    this._layerGfx.push(postGfx);

    // Band graphics (depth between structure and heroes)
    this._slingBands = this.add.graphics().setDepth(3.5);

    // Trajectory preview graphics (between bands and heroes)
    this._trajectoryGfx = this.add.graphics().setDepth(3.6);

    // Hit zone — invisible interactive area (active only when hero waiting)
    this._slingHitZone = this.add.rectangle(CAMP_SLING_X, heroY, 80, 80, 0x000000, 0)
      .setDepth(4.5);
    this._slingHitZone.on('pointerdown', () => {
      if (!this._slingHero || this._slingHero.slingState !== 'waiting') return;
      this._dragging = true;
    });
  }

  private setupSlingInput() {
    const heroRestY = LAYER_CFG.mid.y - 16;

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this._dragging || !this._slingHero) return;
      const h = this._slingHero;
      // Follow pointer directly (like combat sling)
      h.sprite.x = pointer.x;
      h.sprite.y = pointer.y;
      this.drawCampTrajectory(pointer, h);
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this._dragging || !this._slingHero) return;
      this._dragging = false;
      const h = this._slingHero;

      // Calculate launch velocity using LaunchSystem formula
      const dx = CAMP_SLING_X - pointer.x;
      const dy = heroRestY - pointer.y;
      const mag = Math.hypot(dx, dy);
      if (mag < 1) {
        h.sprite.x = CAMP_SLING_X;
        h.sprite.y = heroRestY;
        this.drawSlingBands(h.sprite.x, h.sprite.y);
        this._trajectoryGfx?.clear();
        return;
      }
      const dist = Math.min(mag, MAX_DRAG_DISTANCE);
      const vx = (dx / mag) * dist * LAUNCH_POWER_MULTIPLIER;
      const vy = (dy / mag) * dist * LAUNCH_POWER_MULTIPLIER;

      if (Math.hypot(vx, vy) < 0.3) {
        // Snap back — not enough drag
        h.sprite.x = CAMP_SLING_X;
        h.sprite.y = heroRestY;
        this.drawSlingBands(h.sprite.x, h.sprite.y);
        this._trajectoryGfx?.clear();
      } else {
        this.launchCampHero(h, vx, vy);
      }
    });
  }

  private drawSlingBands(heroX: number, heroY: number) {
    if (!this._slingBands) return;
    this._slingBands.clear();
    const midY = LAYER_CFG.mid.y;
    const leftTip = { x: CAMP_SLING_X - 14, y: midY - 50 };
    const rightTip = { x: CAMP_SLING_X + 14, y: midY - 50 };
    const stretch = Math.max(0, CAMP_SLING_X - heroX);
    const thickness = 2 + stretch * 0.03;
    this._slingBands.lineStyle(thickness, 0x8b6914, 0.85);
    this._slingBands.lineBetween(leftTip.x, leftTip.y, heroX, heroY);
    this._slingBands.lineBetween(rightTip.x, rightTip.y, heroX, heroY);
    this._slingBands.fillStyle(0x8b6914, 0.6);
    this._slingBands.fillCircle(heroX, heroY, 3);
  }

  private drawCampTrajectory(pointer: Phaser.Input.Pointer, h: HeroWalkState) {
    if (!this._trajectoryGfx) return;
    this._trajectoryGfx.clear();

    const heroRestY = LAYER_CFG.mid.y - 16;
    const midY = LAYER_CFG.mid.y;
    const leftTip = { x: CAMP_SLING_X - 14, y: midY - 50 };
    const rightTip = { x: CAMP_SLING_X + 14, y: midY - 50 };

    // Rubber band lines from fork tips to drag point
    const stretch = Math.hypot(CAMP_SLING_X - pointer.x, heroRestY - pointer.y);
    const thickness = 2 + Math.min(stretch, MAX_DRAG_DISTANCE) * 0.015;
    this._trajectoryGfx.lineStyle(thickness, 0x8b6914, 0.85);
    this._trajectoryGfx.lineBetween(leftTip.x, leftTip.y, pointer.x, pointer.y);
    this._trajectoryGfx.lineBetween(rightTip.x, rightTip.y, pointer.x, pointer.y);
    // Pouch
    this._trajectoryGfx.fillStyle(0x8b6914, 0.6);
    this._trajectoryGfx.fillCircle(pointer.x, pointer.y, 3);

    // Calculate launch velocity
    const dx = CAMP_SLING_X - pointer.x;
    const dy = heroRestY - pointer.y;
    const mag = Math.hypot(dx, dy);
    if (mag < 1) return;
    const dist = Math.min(mag, MAX_DRAG_DISTANCE);
    const vx = (dx / mag) * dist * LAUNCH_POWER_MULTIPLIER;
    const vy = (dy / mag) * dist * LAUNCH_POWER_MULTIPLIER;
    if (Math.hypot(vx, vy) < 0.3) return;

    // Frame-by-frame simulation (same as LaunchSystem)
    let px = CAMP_SLING_X, py = heroRestY;
    let pvx = vx, pvy = vy;
    let dotsDrawn = 0;

    // Class-colored dots
    const cls = h.key.toUpperCase() as import('@/config/constants').HeroClass;
    const dotColor = HERO_STATS[cls]?.color ?? 0xf39c12;

    for (let frame = 0; frame < TRAJECTORY_SIM_FRAMES && dotsDrawn < TRAJECTORY_POINTS; frame++) {
      pvx *= (1 - HERO_FRICTION_AIR);
      pvy *= (1 - HERO_FRICTION_AIR);
      pvy += GRAVITY_PER_FRAME;
      px += pvx;
      py += pvy;

      if (frame % TRAJECTORY_DOT_EVERY === 0) {
        const alpha = (1 - dotsDrawn / TRAJECTORY_POINTS) * 0.85;
        const size = Math.max(2, 4.5 - dotsDrawn * 0.1);
        this._trajectoryGfx.fillStyle(dotColor, alpha);
        this._trajectoryGfx.fillCircle(px, py, size);
        dotsDrawn++;
      }

      if (py > GAME_HEIGHT + 20) break;
    }

    // Power bar indicator below sling
    const power = Math.min(dist / MAX_DRAG_DISTANCE, 1);
    const barW = 40, barH = 4;
    const barX = CAMP_SLING_X - barW / 2;
    const barY = midY + 8;
    this._trajectoryGfx.fillStyle(0x333333, 0.5);
    this._trajectoryGfx.fillRect(barX, barY, barW, barH);
    const r = Math.floor(255 * power);
    const g = Math.floor(255 * (1 - power));
    const fillColor = Phaser.Display.Color.GetColor(r, g, 0);
    this._trajectoryGfx.fillStyle(fillColor, 0.8);
    this._trajectoryGfx.fillRect(barX, barY, barW * power, barH);

    // Also draw band graphics (clear default resting bands since trajectory gfx draws them)
    if (this._slingBands) this._slingBands.clear();
  }

  private launchCampHero(h: HeroWalkState, vx: number, vy: number) {
    h.slingState = 'flying';

    // Place sprite at launch origin
    h.sprite.x = CAMP_SLING_X;
    h.sprite.y = LAYER_CFG.mid.y - 16;

    this._slingBands?.clear();
    this._trajectoryGfx?.clear();
    this._slingHitZone?.disableInteractive();

    this._slingOccupied = false;
    this._slingHero = null;

    // Push to flying heroes array for physics update loop
    this._flyingHeroes.push({ hw: h, vx, vy });
  }

  private spawnDust(x: number, y: number) {
    for (let i = 0; i < 5; i++) {
      const dot = this.add.graphics().setDepth(4);
      dot.fillStyle(0xc8b898, 0.7);
      dot.fillCircle(0, 0, Phaser.Math.Between(2, 4));
      dot.setPosition(x + Phaser.Math.Between(-10, 10), y);
      this.tweens.add({
        targets: dot,
        x: dot.x + Phaser.Math.Between(-20, 20),
        y: dot.y - Phaser.Math.Between(5, 15),
        alpha: 0,
        duration: 300,
        onComplete: () => dot.destroy(),
      });
    }
  }

  private ejectFromSling(h: HeroWalkState, now: number) {
    h.slingState = 'none';
    this._slingOccupied = false;
    this._slingHero = null;
    this._slingBands?.clear();
    this._slingHitZone?.disableInteractive();
    h.pauseUntil = now + Phaser.Math.Between(500, 1500);
  }

  // ── Hero sprites (walking, on middle layer) ───────────────────────────
  private buildHeroSprites() {
    const midY = LAYER_CFG.mid.y;
    const heroKeys: string[] = ['warrior', 'ranger', 'mage', 'priest'];

    const meta = getMetaBonuses();
    for (const cls of meta.unlockedHeroClasses) {
      const key = cls.toLowerCase();
      if (!heroKeys.includes(key)) heroKeys.push(key);
    }

    const spacing = 60;
    const startX = GAME_WIDTH / 2 - ((heroKeys.length - 1) * spacing) / 2;
    const hy = midY - 16; // feet align with ground line

    this._heroStates = [];
    const now = this.time.now;
    for (let i = 0; i < heroKeys.length; i++) {
      const hx = startX + i * spacing;
      const key = heroKeys[i];

      const sprite = this.add.sprite(hx, hy, `${key}_idle_1`)
        .setDisplaySize(50, 50)
        .setDepth(4) // between mid (3) and fg (5)
        .setInteractive({ useHandCursor: true });

      const animKey = `${key}_idle`;
      if (this.anims.exists(animKey)) sprite.play(animKey);
      const classTint = Hero.CLASS_TINT[key.toUpperCase() as import('@/config/constants').HeroClass];
      if (classTint) sprite.setTint(classTint);

      sprite.on('pointerdown', () => {
        if (this._dragging) return;
        this.showHeroTooltip(key, sprite.x, sprite.y);
      });

      this._heroStates.push({
        sprite,
        key,
        targetX: hx,
        pauseUntil: now + Phaser.Math.Between(500, 3000),
        walking: false,
        slingState: 'none',
      });
    }
  }

  // ── Building hit zones (click for tooltip) ──────────────────────────────
  private buildBuildingHitZones() {
    for (const zone of this._buildingHitZones) {
      const hit = this.add.rectangle(zone.x, zone.y + zone.h / 2, zone.w, zone.h, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(zone.depth + 0.5);
      this._layerGfx.push(hit as unknown as Phaser.GameObjects.Graphics); // cleaned up on resume
      hit.on('pointerdown', () => {
        if (this._dragging) return;
        this.showBuildingTooltip(zone.x, zone.y, zone.name, zone.desc, zone.level, zone.maxLevel);
      });
    }
  }

  private showBuildingTooltip(x: number, y: number, name: string, desc: string, level?: number, maxLevel?: number) {
    this.dismissTooltip();
    const pw = 220, ph = level !== undefined ? 80 : 64, pr = 8;
    const tx = Phaser.Math.Clamp(x, pw / 2 + 10, GAME_WIDTH - pw / 2 - 10);
    const ty = Math.max(y - 10, ph + 10);

    const container = this.add.container(tx, ty - ph).setDepth(30).setAlpha(0);
    this._tooltipContainer = container;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a1220, 0.94);
    bg.fillRoundedRect(-pw / 2, 0, pw, ph, pr);
    bg.lineStyle(1, 0xc0a060, 0.6);
    bg.strokeRoundedRect(-pw / 2, 0, pw, ph, pr);
    container.add(bg);

    container.add(this.add.text(0, 10, name, {
      fontSize: '16px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#c0a060', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0));

    container.add(this.add.text(0, 30, desc, {
      fontSize: '15px', fontFamily: 'Nunito, sans-serif', color: '#7a9ab8',
      wordWrap: { width: pw - 24 }, align: 'center',
    }).setOrigin(0.5, 0));

    if (level !== undefined && maxLevel !== undefined) {
      const dots: string[] = [];
      for (let i = 0; i < maxLevel; i++) dots.push(i < level ? '\u25c6' : '\u25c7');
      container.add(this.add.text(0, ph - 18, dots.join(' '), {
        fontSize: '14px', fontFamily: 'Nunito, sans-serif', color: '#c0a060',
      }).setOrigin(0.5, 0));
    }

    this.tweens.add({ targets: container, alpha: 1, y: ty - ph - 6, duration: 150 });
    this._tooltipTimer = this.time.delayedCall(3000, () => this.dismissTooltip());
  }

  private showHeroTooltip(heroKey: string, x: number, y: number) {
    this.dismissTooltip();
    const cls = heroKey.toUpperCase() as HeroClass;
    const stats = HERO_STATS[cls];
    const passive = HERO_PASSIVES[cls];
    if (!stats) return;

    const pw = 230, pr = 8;
    const lines: string[] = [
      `HP: ${stats.hp}   DMG: ${stats.combatDamage}   Range: ${stats.combatRange}`,
    ];
    if (passive) lines.push(`${passive.name}: ${passive.desc}`);
    const ph = 50 + lines.length * 18;

    const tx = Phaser.Math.Clamp(x, pw / 2 + 10, GAME_WIDTH - pw / 2 - 10);
    const ty = Math.max(y - 20, ph + 10);

    const container = this.add.container(tx, ty - ph).setDepth(30).setAlpha(0);
    this._tooltipContainer = container;

    const borderColor = stats.color ?? 0xc0a060;
    const bg = this.add.graphics();
    bg.fillStyle(0x0a1220, 0.94);
    bg.fillRoundedRect(-pw / 2, 0, pw, ph, pr);
    bg.lineStyle(1.5, borderColor, 0.7);
    bg.strokeRoundedRect(-pw / 2, 0, pw, ph, pr);
    container.add(bg);

    container.add(this.add.text(0, 10, stats.label, {
      fontSize: '17px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#' + borderColor.toString(16).padStart(6, '0'),
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0));

    container.add(this.add.text(0, 32, lines[0], {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif', color: '#7a9ab8',
    }).setOrigin(0.5, 0));

    if (lines[1]) {
      container.add(this.add.text(0, 50, lines[1], {
        fontSize: '13px', fontFamily: 'Nunito, sans-serif', color: '#a0906a',
        wordWrap: { width: pw - 20 }, align: 'center',
      }).setOrigin(0.5, 0));
    }

    this.tweens.add({ targets: container, alpha: 1, y: ty - ph - 6, duration: 150 });
    this._tooltipTimer = this.time.delayedCall(4000, () => this.dismissTooltip());
  }

  private dismissTooltip() {
    if (this._tooltipTimer) {
      this._tooltipTimer.destroy();
      this._tooltipTimer = null;
    }
    if (this._tooltipContainer) {
      this._tooltipContainer.destroy();
      this._tooltipContainer = null;
    }
  }

  // ── Title (sling / rubber-band launch animation) ──────────────────────
  private buildTitle() {
    const finalX = GAME_WIDTH / 2;
    const finalY = 48;
    const postX = 130;

    // ── Sling Y-fork post ──
    const forkY = finalY + 8;
    const baseY = finalY + 55;
    const leftTip = { x: postX - 18, y: finalY - 22 };
    const rightTip = { x: postX + 18, y: finalY - 22 };

    const postGfx = this.add.graphics().setDepth(9);
    postGfx.lineStyle(6, 0x5a4020, 0.9);
    postGfx.lineBetween(postX, baseY, postX, forkY);             // handle
    postGfx.lineStyle(5, 0x6b5030, 0.9);
    postGfx.lineBetween(postX, forkY, leftTip.x, leftTip.y);     // left prong
    postGfx.lineBetween(postX, forkY, rightTip.x, rightTip.y);   // right prong
    // Prong caps
    postGfx.fillStyle(0x8b6914, 1);
    postGfx.fillCircle(leftTip.x, leftTip.y, 4);
    postGfx.fillCircle(rightTip.x, rightTip.y, 4);

    // ── Elastic bands ──
    const bandGfx = this.add.graphics().setDepth(9);

    // ── Title text (the "projectile") ──
    const startX = postX - 30;
    const title = this.add.text(startX, finalY, 'SLING SQUAD', {
      fontSize: '52px', fontFamily: 'Knights Quest, Nunito, sans-serif',
      color: '#c8a840', stroke: '#000', strokeThickness: 5,
      letterSpacing: 6,
    }).setOrigin(0.5).setDepth(10).setScale(0.9, 1);

    // Draw elastic bands from prong tips to the title pouch point
    const drawBands = () => {
      bandGfx.clear();
      const pouchX = title.x - title.displayWidth * 0.35;
      const pouchY = title.y;
      // Band thickness increases with stretch
      const stretch = Math.max(0, postX - pouchX);
      const thickness = 2 + stretch * 0.025;
      bandGfx.lineStyle(thickness, 0x8b6914, 0.85);
      bandGfx.lineBetween(leftTip.x, leftTip.y, pouchX, pouchY);
      bandGfx.lineBetween(rightTip.x, rightTip.y, pouchX, pouchY);
      // Pouch
      bandGfx.fillStyle(0x8b6914, 0.6);
      bandGfx.fillCircle(pouchX, pouchY, 4);
    };
    drawBands();

    // ── Phase 1: Pull back (350ms) ──
    let bandsSnapped = false;
    this.tweens.add({
      targets: title,
      x: postX - 70,
      scaleX: 0.7,
      duration: 350,
      ease: 'Sine.easeIn',
      onUpdate: () => drawBands(),
      onComplete: () => {
        // ── Phase 2: Release — fling to center (1200ms, Elastic.easeOut) ──
        this.tweens.add({
          targets: title,
          x: finalX,
          scaleX: 1,
          duration: 1200,
          ease: 'Elastic.easeOut',
          onUpdate: () => {
            if (!bandsSnapped && title.x > postX + 40) {
              bandsSnapped = true;
              // Bands snap back to resting position
              bandGfx.clear();
              bandGfx.lineStyle(2, 0x8b6914, 0.6);
              const restX = postX;
              const restY = finalY + 5;
              bandGfx.lineBetween(leftTip.x, leftTip.y, restX, restY);
              bandGfx.lineBetween(rightTip.x, rightTip.y, restX, restY);
            } else if (!bandsSnapped) {
              drawBands();
            }
          },
          onComplete: () => {
            // ── Phase 3: Settle ──
            // Fade out sling post + bands
            this.tweens.add({
              targets: [postGfx, bandGfx],
              alpha: 0,
              duration: 600,
              onComplete: () => { postGfx.destroy(); bandGfx.destroy(); },
            });

            // Micro-shake for impact
            if (isScreenShakeEnabled()) this.cameras.main.shake(120, 0.003);

            // Random rubber-bandy idle effects
            this.startTitleEffects(title);
          },
        });
      },
    });

  }

  // ── Random rubber-bandy title idle effects ──────────────────────────
  private _titleEffectTimer?: Phaser.Time.TimerEvent;

  private startTitleEffects(title: Phaser.GameObjects.Text) {
    // Capture resting state once — every effect resets to this before animating
    const homeX = title.x;
    const homeY = title.y;

    const resetTitle = () => {
      this.tweens.killTweensOf(title);
      title.setPosition(homeX, homeY).setScale(1, 1).setAngle(0);
    };

    // Each effect calls done() when finished to schedule the next
    type EffectFn = (done: () => void) => void;
    const effects: EffectFn[] = [

      // 1. Squash & stretch — horizontal pull then secondary bounce
      (done) => {
        this.tweens.chain({
          targets: title,
          tweens: [
            { scaleX: 1.12, scaleY: 0.90, duration: 180, ease: 'Sine.easeOut' },
            { scaleX: 0.95, scaleY: 1.05, duration: 160, ease: 'Sine.easeOut' },
            { scaleX: 1.03, scaleY: 0.98, duration: 120, ease: 'Sine.easeOut' },
            { scaleX: 1, scaleY: 1, duration: 100, ease: 'Sine.easeOut' },
          ],
          onComplete: done,
        });
      },

      // 2. Drop bounce — falls, squishes on "landing", springs back up
      (done) => {
        this.tweens.chain({
          targets: title,
          tweens: [
            { y: homeY + 10, scaleY: 0.88, scaleX: 1.08, duration: 160, ease: 'Quad.easeIn' },
            { y: homeY - 6, scaleY: 1.07, scaleX: 0.96, duration: 220, ease: 'Back.easeOut' },
            { y: homeY + 2, scaleY: 0.97, scaleX: 1.02, duration: 120, ease: 'Sine.easeOut' },
            { y: homeY, scaleX: 1, scaleY: 1, duration: 100, ease: 'Sine.easeOut' },
          ],
          onComplete: done,
        });
      },

      // 3. Spring wobble — decaying left-right tilt
      (done) => {
        this.tweens.chain({
          targets: title,
          tweens: [
            { angle: 3, duration: 80, ease: 'Sine.easeOut' },
            { angle: -2.5, duration: 80, ease: 'Sine.easeOut' },
            { angle: 1.8, duration: 70, ease: 'Sine.easeOut' },
            { angle: -1, duration: 70, ease: 'Sine.easeOut' },
            { angle: 0.4, duration: 60, ease: 'Sine.easeOut' },
            { angle: 0, duration: 60, ease: 'Sine.easeOut' },
          ],
          onComplete: done,
        });
      },

      // 4. Jelly pulse — elastic pop out then settle
      (done) => {
        this.tweens.chain({
          targets: title,
          tweens: [
            { scaleX: 1.10, scaleY: 1.10, duration: 200, ease: 'Back.easeOut' },
            { scaleX: 0.97, scaleY: 0.97, duration: 180, ease: 'Sine.easeOut' },
            { scaleX: 1, scaleY: 1, duration: 250, ease: 'Elastic.easeOut' },
          ],
          onComplete: done,
        });
      },

      // 5. Snap sideways — horizontal jolt then elastic return
      (done) => {
        this.tweens.chain({
          targets: title,
          tweens: [
            { x: homeX + 8, scaleX: 0.94, duration: 70, ease: 'Sine.easeOut' },
            { x: homeX - 3, scaleX: 1.02, duration: 200, ease: 'Elastic.easeOut' },
            { x: homeX, scaleX: 1, duration: 300, ease: 'Elastic.easeOut' },
          ],
          onComplete: done,
        });
      },

      // 6. Trampoline — rapid small bounces decaying in height
      (done) => {
        this.tweens.chain({
          targets: title,
          tweens: [
            { y: homeY - 8, duration: 120, ease: 'Quad.easeOut' },
            { y: homeY, scaleY: 0.93, scaleX: 1.05, duration: 100, ease: 'Quad.easeIn' },
            { y: homeY - 5, scaleY: 1.03, scaleX: 0.98, duration: 100, ease: 'Quad.easeOut' },
            { y: homeY, scaleY: 0.96, scaleX: 1.03, duration: 90, ease: 'Quad.easeIn' },
            { y: homeY - 2, scaleY: 1.01, scaleX: 0.99, duration: 80, ease: 'Quad.easeOut' },
            { y: homeY, scaleX: 1, scaleY: 1, duration: 70, ease: 'Sine.easeOut' },
          ],
          onComplete: done,
        });
      },

      // 7. Shiver — quick micro-vibrations (nervous energy)
      (done) => {
        let count = 0;
        const total = 8;
        const shake = () => {
          if (count >= total) {
            title.setPosition(homeX, homeY);
            done();
            return;
          }
          const amp = 2.5 * (1 - count / total); // decaying amplitude
          const dx = (Math.random() - 0.5) * amp * 2;
          const dy = (Math.random() - 0.5) * amp;
          this.tweens.add({
            targets: title, x: homeX + dx, y: homeY + dy,
            duration: 40, ease: 'Linear', onComplete: () => { count++; shake(); },
          });
        };
        shake();
      },

      // 8. Slingshot echo — mimics being pulled left then flung right
      (done) => {
        this.tweens.chain({
          targets: title,
          tweens: [
            { x: homeX - 12, scaleX: 0.90, duration: 200, ease: 'Sine.easeIn' },
            { x: homeX + 6, scaleX: 1.06, duration: 180, ease: 'Back.easeOut' },
            { x: homeX - 2, scaleX: 1.01, duration: 140, ease: 'Sine.easeOut' },
            { x: homeX, scaleX: 1, scaleY: 1, duration: 120, ease: 'Sine.easeOut' },
          ],
          onComplete: done,
        });
      },

      // 9. Breathe — slow gentle inhale/exhale
      (done) => {
        this.tweens.chain({
          targets: title,
          tweens: [
            { scaleX: 1.04, scaleY: 1.04, duration: 600, ease: 'Sine.easeInOut' },
            { scaleX: 1, scaleY: 1, duration: 600, ease: 'Sine.easeInOut' },
          ],
          onComplete: done,
        });
      },
    ];

    let lastIdx = -1;

    const playRandom = () => {
      // Pick a random effect, avoiding back-to-back repeats
      let idx: number;
      do { idx = Phaser.Math.Between(0, effects.length - 1); } while (idx === lastIdx);
      lastIdx = idx;

      // Reset to home before each effect to prevent drift
      resetTitle();

      effects[idx](() => {
        // Defensive reset after effect completes
        title.setPosition(homeX, homeY).setScale(1, 1).setAngle(0);
        const rest = Phaser.Math.Between(2500, 5000);
        this._titleEffectTimer = this.time.delayedCall(rest, playRandom);
      });
    };

    // First effect after a short pause
    this._titleEffectTimer = this.time.delayedCall(2000, playRandom);
  }

  // ── Profile button (top-left, next to gear) ───────────────────────
  private buildProfileButton() {
    const profile = ensureProfile();
    const size = 52;
    const r = 10;
    // Gear is at x=20, y=20, size=52. Place profile button right next to it.
    const px = 20 + 52 + 8; // gear x + gear width + gap
    const py = 20;
    const container = this.add.container(0, 0).setDepth(15);

    const bg = this.add.graphics();
    const drawBg = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(0x060b12, hovered ? 1 : 0.75);
      bg.fillRoundedRect(px, py, size, size, r);
      bg.lineStyle(1, hovered ? 0xc0a060 : 0x3a5070, hovered ? 1 : 0.5);
      bg.strokeRoundedRect(px, py, size, size, r);
    };
    drawBg(false);
    container.add(bg);

    // Avatar sprite (36×36 inside the 52×52 button)
    const cx = px + size / 2;
    const cy = py + size / 2;
    const spriteKey = `${profile.avatarKey}_idle_1`;
    if (this.textures.exists(spriteKey)) {
      const avatar = this.add.image(cx, cy, spriteKey).setDisplaySize(36, 36);
      const upper = profile.avatarKey.toUpperCase();
      const tint = (Hero.CLASS_TINT as Record<string, number>)[upper]
        ?? (Enemy.CLASS_TINT as Record<string, number>)[upper];
      if (tint) avatar.setTint(tint);
      container.add(avatar);
    }

    const hit = this.add.rectangle(cx, cy, size, size, 0, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hit);
    hit.on('pointerover', () => {
      drawBg(true);
      this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 60 });
    });
    hit.on('pointerout', () => {
      drawBg(false);
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 60 });
    });
    hit.on('pointerdown', () => {
      if (this._transitioning) return;
      this._transitioning = true;
      this.cameras.main.fadeOut(200, 0, 0, 0, (_: unknown, p: number) => {
        if (p === 1) this.scene.start('ProfileScene', { callerKey: 'MainMenuScene' });
      });
    });
  }

  // ── Leaderboard strip (top-right, below shard bar) ────────────────────
  private buildLeaderboardStrip() {
    const stripW = 200;
    const stripX = GAME_WIDTH - stripW - 10; // right-aligned
    const stripY = 68;  // below shard bar (bar is at y=20, h=40)
    const depth = 15;

    const container = this.add.container(stripX, stripY).setDepth(depth).setAlpha(0);

    if (!isFirebaseAvailable()) {
      // Show "Offline" placeholder
      const offBg = this.add.graphics();
      offBg.fillStyle(0x0a1220, 0.7);
      offBg.fillRoundedRect(0, 0, stripW, 30, 6);
      container.add(offBg);
      container.add(this.add.text(stripW / 2, 15, 'Leaderboard: Offline', {
        fontSize: '10px', fontFamily: 'Nunito, sans-serif', color: '#4a5a6a',
      }).setOrigin(0.5));
      this.tweens.add({ targets: container, alpha: 1, duration: 400, delay: 600 });
      return;
    }

    // Async fetch — show loading then populate
    const loadingText = this.add.text(stripW / 2, 15, 'Loading...', {
      fontSize: '10px', fontFamily: 'Nunito, sans-serif', color: '#4a5a6a',
    }).setOrigin(0.5);
    const loadBg = this.add.graphics();
    loadBg.fillStyle(0x0a1220, 0.7);
    loadBg.fillRoundedRect(0, 0, stripW, 30, 6);
    container.add(loadBg);
    container.add(loadingText);
    this.tweens.add({ targets: container, alpha: 1, duration: 400, delay: 600 });

    fetchTopScores(5).then(entries => {
      if (!this.scene.isActive()) return; // scene may have been destroyed
      container.removeAll(true);

      if (!entries || entries.length === 0) {
        const emptyBg = this.add.graphics();
        emptyBg.fillStyle(0x0a1220, 0.7);
        emptyBg.fillRoundedRect(0, 0, stripW, 30, 6);
        container.add(emptyBg);
        container.add(this.add.text(stripW / 2, 15, 'No scores yet', {
          fontSize: '10px', fontFamily: 'Nunito, sans-serif', color: '#4a5a6a',
        }).setOrigin(0.5));
        return;
      }

      const headerH = 20;
      const rowH_est = 22;
      const totalH = headerH + entries.length * rowH_est + 4;

      const bg = this.add.graphics();
      bg.fillStyle(0x0a1220, 0.75);
      bg.fillRoundedRect(0, 0, stripW, totalH, 6);
      bg.lineStyle(1, 0x3a5070, 0.4);
      bg.strokeRoundedRect(0, 0, stripW, totalH, 6);
      container.add(bg);

      // Header
      container.add(this.add.text(stripW / 2, 2, 'LEADERBOARD', {
        fontSize: '9px', fontFamily: 'Nunito, sans-serif',
        color: '#c0a060', letterSpacing: 2,
      }).setOrigin(0.5, 0));

      // Entries
      const rowH = 22;
      let ey = headerH;
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const rank = `#${i + 1}`;
        const rawName = e.name || '???';
        const name = rawName.length > 10 ? rawName.slice(0, 9) + '\u2026' : rawName;
        const score = (e.score ?? 0).toLocaleString();
        const color = i === 0 ? '#f1c40f' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#7a9ab8';

        container.add(this.add.text(6, ey + 3, rank, {
          fontSize: '10px', fontFamily: 'Nunito, sans-serif', color, fontStyle: 'bold',
        }).setOrigin(0, 0));

        // Avatar sprite
        const avKey = `${e.avatarKey || 'warrior'}_idle_1`;
        if (this.textures.exists(avKey)) {
          const av = this.add.image(34, ey + rowH / 2, avKey).setDisplaySize(16, 16);
          const upper = (e.avatarKey || 'warrior').toUpperCase();
          const tint = (Hero.CLASS_TINT as Record<string, number>)[upper]
            ?? (Enemy.CLASS_TINT as Record<string, number>)[upper];
          if (tint) av.setTint(tint);
          container.add(av);
        }

        container.add(this.add.text(46, ey + 3, name, {
          fontSize: '10px', fontFamily: 'Nunito, sans-serif', color: '#b0c8e0',
        }).setOrigin(0, 0));
        container.add(this.add.text(stripW - 6, ey + 3, score, {
          fontSize: '10px', fontFamily: 'Nunito, sans-serif', color,
        }).setOrigin(1, 0));
        ey += rowH;
      }

      // Player's own rank
      const profile = getProfile();
      const uid = getFirebaseUid() || profile.uid;
      if (uid && profile.bestScore > 0) {
        const isInTop = entries.some(e => e.uid === uid);
        if (!isInTop) {
          const yourY = ey + 2;
          const divider = this.add.graphics();
          divider.lineStyle(1, 0x3a5070, 0.3);
          divider.lineBetween(8, yourY - 1, stripW - 8, yourY - 1);
          container.add(divider);
          container.add(this.add.text(6, yourY + 2, 'You:', {
            fontSize: '10px', fontFamily: 'Nunito, sans-serif', color: '#7ec8e3',
          }).setOrigin(0, 0));
          container.add(this.add.text(stripW - 6, yourY + 2, profile.bestScore.toLocaleString(), {
            fontSize: '10px', fontFamily: 'Nunito, sans-serif', color: '#7ec8e3',
          }).setOrigin(1, 0));

          // Resize background to fit
          const newH = yourY + rowH + 4;
          bg.clear();
          bg.fillStyle(0x0a1220, 0.75);
          bg.fillRoundedRect(0, 0, stripW, newH, 6);
          bg.lineStyle(1, 0x3a5070, 0.4);
          bg.strokeRoundedRect(0, 0, stripW, newH, 6);
        }
      }
    }).catch(() => {
      if (!this.scene.isActive()) return;
      container.removeAll(true);
      const errBg = this.add.graphics();
      errBg.fillStyle(0x0a1220, 0.7);
      errBg.fillRoundedRect(0, 0, stripW, 30, 6);
      container.add(errBg);
      container.add(this.add.text(stripW / 2, 15, 'Leaderboard unavailable', {
        fontSize: '10px', fontFamily: 'Nunito, sans-serif', color: '#6a4a4a',
      }).setOrigin(0.5));
    });
  }

  // ── Chat panel (left side, real-time) ────────────────────────────────
  private buildChatPanel() {
    if (!isFirebaseAvailable()) return;

    const panelX = 10;
    const panelY = 82; // below gear+profile buttons
    const panelW = 300;
    const panelH = 380;
    const headerH = 28;
    const inputBarH = 44;
    const msgAreaH = panelH - headerH - inputBarH;
    const depth = 15;

    const container = this.add.container(panelX, panelY).setDepth(depth).setAlpha(0);
    this._chatContainer = container;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0a1220, 0.8);
    bg.fillRoundedRect(0, 0, panelW, panelH, 10);
    bg.lineStyle(1, 0x3a5070, 0.4);
    bg.strokeRoundedRect(0, 0, panelW, panelH, 10);
    container.add(bg);

    // Header
    container.add(this.add.text(panelW / 2, 8, 'CHAT', {
      fontSize: '13px', fontFamily: 'Nunito, sans-serif',
      color: '#c0a060', letterSpacing: 3,
    }).setOrigin(0.5, 0));

    // Message area container
    const msgContainer = this.add.container(0, headerH);
    container.add(msgContainer);

    // Input background bar
    const inputBg = this.add.graphics();
    inputBg.fillStyle(0x060b12, 0.9);
    inputBg.fillRoundedRect(6, panelH - inputBarH + 4, panelW - 12, inputBarH - 8, 8);
    inputBg.lineStyle(1, 0x3a5070, 0.3);
    inputBg.strokeRoundedRect(6, panelH - inputBarH + 4, panelW - 12, inputBarH - 8, 8);
    container.add(inputBg);

    // Placeholder text (visible when input not focused)
    const placeholder = this.add.text(panelW / 2, panelH - inputBarH / 2, 'Tap to chat...', {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif', color: '#3a5a7a',
    }).setOrigin(0.5);
    container.add(placeholder);

    // Click zone for input area (large touch target)
    const inputHit = this.add.rectangle(panelW / 2, panelH - inputBarH / 2, panelW - 12, inputBarH, 0, 0)
      .setInteractive({ useHandCursor: true });
    container.add(inputHit);

    // Create the DOM input bar (full-width bottom overlay on mobile)
    this.createChatInput(placeholder);

    inputHit.on('pointerdown', () => {
      this.showChatInput();
    });

    // Render helper
    const renderMessages = () => {
      if (!this.scene.isActive()) return;
      msgContainer.removeAll(true);

      const msgs = this._chatMessages;
      const lineH = 34;
      const maxVisible = Math.floor(msgAreaH / lineH);
      const visible = msgs.slice(-maxVisible);

      let my = 0;
      for (const msg of visible) {
        // Avatar
        const avKey = `${msg.avatarKey || 'warrior'}_idle_1`;
        if (this.textures.exists(avKey)) {
          const av = this.add.image(16, my + 12, avKey).setDisplaySize(20, 20);
          const upper = (msg.avatarKey || 'warrior').toUpperCase();
          const tint = (Hero.CLASS_TINT as Record<string, number>)[upper]
            ?? (Enemy.CLASS_TINT as Record<string, number>)[upper];
          if (tint) av.setTint(tint);
          msgContainer.add(av);
        }

        // Name
        const shortName = (msg.name || '???').slice(0, 12);
        msgContainer.add(this.add.text(30, my, shortName, {
          fontSize: '12px', fontFamily: 'Nunito, sans-serif', color: '#c0a060', fontStyle: 'bold',
        }));

        // Timestamp (local timezone)
        const date = new Date(msg.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        msgContainer.add(this.add.text(panelW - 14, my, timeStr, {
          fontSize: '10px', fontFamily: 'Nunito, sans-serif', color: '#4a6a7a',
        }).setOrigin(1, 0));

        // Message text
        const msgText = (msg.message || '').slice(0, 80);
        msgContainer.add(this.add.text(30, my + 15, msgText, {
          fontSize: '13px', fontFamily: 'Nunito, sans-serif', color: '#b0c8e0',
          wordWrap: { width: panelW - 48 },
          maxLines: 1,
        }));

        my += lineH;
      }
    };

    // Subscribe to real-time chat
    subscribeToChat((messages) => {
      if (!this.scene.isActive()) return;
      this._chatMessages = messages;
      renderMessages();
    });

    // Fade in
    this.tweens.add({ targets: container, alpha: 1, duration: 400, delay: 800 });
  }

  private _chatInputBar: HTMLDivElement | null = null;
  private _chatPlaceholder: Phaser.GameObjects.Text | null = null;

  private showChatInput() {
    if (!this._chatInput || !this._chatInputBar) return;
    this._chatInputBar.style.display = 'flex';
    this._chatInput.focus();
    if (this._chatPlaceholder?.active) this._chatPlaceholder.setVisible(false);
  }

  private hideChatInput() {
    if (this._chatInputBar) this._chatInputBar.style.display = 'none';
    if (this._chatPlaceholder?.active) this._chatPlaceholder.setVisible(true);
  }

  private createChatInput(placeholder: Phaser.GameObjects.Text) {
    this._chatPlaceholder = placeholder;

    // Remove old elements
    if (this._chatInputBar) { this._chatInputBar.remove(); this._chatInputBar = null; }
    if (this._chatInput) { this._chatInput.remove(); this._chatInput = null; }

    // Full-width bottom bar container (DOM overlay)
    const bar = document.createElement('div');
    bar.style.cssText = `
      position: fixed;
      bottom: 0; left: 0; right: 0;
      display: none;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(6,11,18,0.97);
      border-top: 1px solid #3a5070;
      z-index: 2000;
      box-sizing: border-box;
    `;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 80;
    input.placeholder = 'Type a message...';
    input.autocomplete = 'off';
    input.autocapitalize = 'sentences';
    input.style.cssText = `
      flex: 1;
      background: rgba(13,21,38,0.95);
      border: 1px solid #3a5070;
      border-radius: 8px;
      color: #b0c8e0;
      font-family: 'Nunito', sans-serif;
      font-size: 16px;
      padding: 10px 14px;
      outline: none;
      min-height: 44px;
      box-sizing: border-box;
      -webkit-appearance: none;
    `;

    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'Send';
    sendBtn.style.cssText = `
      background: #c0a060;
      border: none;
      border-radius: 8px;
      color: #0a1220;
      font-family: 'Nunito', sans-serif;
      font-size: 16px;
      font-weight: bold;
      padding: 10px 20px;
      min-height: 44px;
      cursor: pointer;
      -webkit-appearance: none;
    `;

    let sending = false;
    let sendBtnTouched = false; // flag to prevent iOS blur-before-click race

    const doSend = () => {
      if (sending) return;
      const text = input.value.trim();
      if (!text) return;
      sending = true;
      sendBtn.disabled = true;
      sendChatMessage(text).then((ok) => {
        if (!this.scene.isActive()) return;
        if (ok) {
          input.value = '';
          input.blur();
          this.hideChatInput();
        }
      }).catch(() => {}).finally(() => {
        sending = false;
        sendBtn.disabled = false;
      });
    };

    // Use touchstart/mousedown to set flag before blur fires (iOS fix)
    sendBtn.addEventListener('touchstart', () => { sendBtnTouched = true; }, { passive: true });
    sendBtn.addEventListener('mousedown', () => { sendBtnTouched = true; });
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sendBtnTouched = false;
      doSend();
    });

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        doSend();
      }
      if (e.key === 'Escape') {
        input.blur();
        this.hideChatInput();
      }
    });

    input.addEventListener('blur', () => {
      // Delay hide — if send button was touched, skip the dismiss
      setTimeout(() => {
        if (sendBtnTouched) { sendBtnTouched = false; return; }
        if (document.activeElement !== sendBtn && document.activeElement !== input) {
          this.hideChatInput();
        }
      }, 300);
    });

    bar.appendChild(input);
    bar.appendChild(sendBtn);
    document.body.appendChild(bar);
    this._chatInput = input;
    this._chatInputBar = bar;
  }

  // ── Shard earned badge (animated +N popup) ──────────────────────────
  private buildShardEarnedBadge(earned: number) {
    if (earned <= 0) return;
    const px = GAME_WIDTH - 126 + 55; // center of currency bar
    const py = 12;
    const badge = this.add.text(px, py + 8, `+${earned}`, {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif',
      color: '#7ec8e3', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(12).setAlpha(0).setScale(1.4);
    this.tweens.add({
      targets: badge, alpha: 1, scaleX: 1, scaleY: 1, y: py - 4,
      duration: 500, ease: 'Back.easeOut', delay: 300,
      onComplete: () => this.time.delayedCall(1000, () =>
        this.tweens.add({ targets: badge, alpha: 0, duration: 400, onComplete: () => badge.destroy() }),
      ),
    });
  }

  // ── Buttons (single row: Camp, Codex, Continue, Fresh) ──────────────
  private buildButtons() {
    const baseY = GAME_HEIGHT - 80;
    const savedRunExists = hasSavedRun();

    // Layout: 4 buttons, 16px gaps, centered
    const sizes = [100, 100, 120, 120]; // Camp, Codex, Continue, Fresh
    const gap = 16;
    const totalW = sizes.reduce((a, b) => a + b, 0) + (sizes.length - 1) * gap;
    const startX = GAME_WIDTH / 2 - totalW / 2;
    let cx = startX;

    // Camp (100x100, amber)
    this.buildSquareButton(cx + 50, baseY, 100, 100, 14, '\u2692', 'Camp', 28, 18,
      0xc8a840, true, () => {
        this.scene.launch('CampUpgradesScene', { callerKey: 'MainMenuScene' });
      });
    cx += 100 + gap;

    // Codex (100x100, tan)
    this.buildSquareButton(cx + 50, baseY, 100, 100, 14, '\ud83d\udcdc', 'Codex', 28, 18,
      0xc0a060, true, () => {
        this.scene.start('CodexScene', { callerKey: 'MainMenuScene' });
      });
    cx += 100 + gap;

    // Continue (120x120, green, play icon)
    this.buildSquareButton(cx + 60, baseY, 120, 120, 14, '\u25b6', 'Continue', 38, 18,
      0x2ecc71, savedRunExists, () => {
        if (this._transitioning) return;
        this._transitioning = true;
        this.cameras.main.fadeOut(350, 0, 0, 0, (_: unknown, p: number) => {
          if (p === 1) this.scene.start('OverworldScene');
        });
      });
    cx += 120 + gap;

    // Fresh (120x120, gold, sparkle icon, glow pulse)
    const freshX = cx + 60;
    this.buildFreshGlow(freshX, baseY);
    this.buildSquareButton(freshX, baseY, 120, 120, 14, '\u2726', 'Fresh', 38, 20,
      0xf1c40f, true, () => {
        if (this._transitioning) return;
        if (savedRunExists) {
          this.showConfirmDialog();
        } else {
          this.goToSquadSelect();
        }
      });
  }

  private buildFreshGlow(x: number, y: number) {
    const glow = this.add.graphics().setDepth(14);
    glow.fillStyle(0xf1c40f, 0.08);
    glow.fillRoundedRect(x - 66, y - 66, 132, 132, 18);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.6, to: 1 },
      yoyo: true,
      repeat: -1,
      duration: 1200,
      ease: 'Sine.easeInOut',
    });
  }

  private buildSquareButton(
    x: number, y: number, w: number, h: number, r: number,
    icon: string | null, label: string,
    iconSize: number, labelSize: number,
    accentColor: number, enabled: boolean,
    onClick: () => void,
  ) {
    const container = this.add.container(x, y).setDepth(15);

    const bg = this.add.graphics();
    const drawBg = (hovered: boolean) => {
      bg.clear();
      if (!enabled) {
        bg.fillStyle(0x1a1a2a, 0.6);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
        bg.lineStyle(2, 0x2a2a3a, 0.4);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
        return;
      }
      const dark = Phaser.Display.Color.IntegerToColor(accentColor);
      const mult = hovered ? 0.40 : 0.20;
      const bgColor = Phaser.Display.Color.GetColor(
        Math.floor(dark.red * mult),
        Math.floor(dark.green * mult),
        Math.floor(dark.blue * mult),
      );
      bg.fillStyle(bgColor, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);

      // Inner highlight (1px white line near top)
      bg.lineStyle(1, 0xffffff, 0.06);
      bg.lineBetween(-w / 2 + r, -h / 2 + 2, w / 2 - r, -h / 2 + 2);

      // Border
      bg.lineStyle(2, accentColor, hovered ? 1.0 : 0.65);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    };
    drawBg(false);
    container.add(bg);

    const accentHex = '#' + accentColor.toString(16).padStart(6, '0');
    const labelColor = enabled ? accentHex : '#6a6a7a';

    if (icon) {
      container.add(
        this.add.text(0, -18, icon, {
          fontSize: `${iconSize}px`, fontFamily: 'Nunito, sans-serif',
        }).setOrigin(0.5),
      );
      container.add(
        this.add.text(0, 24, label, {
          fontSize: `${labelSize}px`, fontStyle: 'bold', fontFamily: 'Nunito, sans-serif',
          color: labelColor, stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5),
      );
    } else {
      // Text-only layout
      container.add(
        this.add.text(0, 0, label, {
          fontSize: `${labelSize}px`, fontStyle: 'bold', fontFamily: 'Nunito, sans-serif',
          color: labelColor, stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5),
      );
    }

    if (enabled) {
      const hit = this.add.rectangle(0, 0, w, h, 0, 0).setInteractive({ useHandCursor: true });
      container.add(hit);
      hit.on('pointerover', () => {
        drawBg(true);
        this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 70 });
      });
      hit.on('pointerout', () => {
        drawBg(false);
        this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 70 });
      });
      hit.on('pointerdown', () => {
        (this.registry.get('audio') as import('@/systems/AudioSystem').AudioSystem | null)?.playButtonClick();
        onClick();
      });
    }
  }

  // ── Confirm dialog ────────────────────────────────────────────────────
  private showConfirmDialog() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const overlay = this.add.container(0, 0).setDepth(50);

    const dim = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65)
      .setInteractive();
    overlay.add(dim);

    const pw = 440, ph = 220, pr = 12;
    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0a1220, 0.97);
    panelBg.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, pr);
    panelBg.lineStyle(2, 0xe74c3c, 0.5);
    panelBg.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, pr);
    overlay.add(panelBg);

    overlay.add(this.add.text(cx, cy - 60, 'Abandon Current Run?', {
      fontSize: '24px', fontFamily: 'Nunito, sans-serif',
      color: '#e74c3c', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5));

    overlay.add(this.add.text(cx, cy - 24, 'Your saved run will be lost.', {
      fontSize: '18px', fontFamily: 'Nunito, sans-serif', color: '#7a9ab8',
    }).setOrigin(0.5));

    this.buildDialogButton(overlay, cx - 90, cy + 46, 'Cancel', 0x3a5070, () => {
      overlay.destroy();
    });
    this.buildDialogButton(overlay, cx + 90, cy + 46, 'Confirm', 0xe74c3c, () => {
      overlay.destroy();
      this.goToSquadSelect();
    });
  }

  private buildDialogButton(
    parent: Phaser.GameObjects.Container,
    x: number, y: number, label: string,
    color: number, onClick: () => void,
  ) {
    const w = 140, h = 42, r = 8;

    const bg = this.add.graphics();
    const drawBg = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(hovered ? color : 0x101c2e, 1);
      bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, r);
      bg.lineStyle(1.5, color, hovered ? 1 : 0.6);
      bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, r);
    };
    drawBg(false);
    parent.add(bg);

    parent.add(
      this.add.text(x, y, label, {
        fontSize: '18px', fontFamily: 'Nunito, sans-serif',
        color: '#' + color.toString(16).padStart(6, '0'),
      }).setOrigin(0.5),
    );

    const hit = this.add.rectangle(x, y, w, h, 0, 0)
      .setInteractive({ useHandCursor: true });
    parent.add(hit);
    hit.on('pointerover', () => drawBg(true));
    hit.on('pointerout', () => drawBg(false));
    hit.on('pointerdown', () => {
      (this.registry.get('audio') as import('@/systems/AudioSystem').AudioSystem | null)?.playButtonClick();
      onClick();
    });
  }

  // ── Navigate to Squad Select ──────────────────────────────────────────
  private goToSquadSelect() {
    this._transitioning = true;
    this.cameras.main.fadeOut(350, 0, 0, 0, (_: unknown, p: number) => {
      if (p === 1) this.scene.start('SquadSelectScene');
    });
  }
}
