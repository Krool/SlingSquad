import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config/constants';
import {
  getShards, earnShards, getMetaBonuses, getPurchaseCount,
} from '@/systems/MetaState';
import { hasSavedRun } from '@/systems/RunState';
import { CAMP_STRUCTURES, LAYER_CFG } from '@/data/campBuildings';
import type { ParallaxLayer } from '@/data/campBuildings';
import type { MusicSystem } from '@/systems/MusicSystem';

interface MainMenuData {
  shardsEarned?: number;
  fromDefeat?: boolean;
}

// Per-hero walking state
interface HeroWalkState {
  sprite: Phaser.GameObjects.Sprite;
  key: string;
  targetX: number;
  pauseUntil: number;   // timestamp (ms) — 0 = not pausing
  walking: boolean;
}

export class MainMenuScene extends Phaser.Scene {
  private _shardText: Phaser.GameObjects.Text | null = null;
  private _layerGfx: Phaser.GameObjects.Graphics[] = [];
  private _fireGfx: Phaser.GameObjects.Graphics | null = null;
  private _heroStates: HeroWalkState[] = [];
  private _shimmerGfx: Phaser.GameObjects.Graphics | null = null;
  private _transitioning = false;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(data: MainMenuData = {}) {
    this._transitioning = false;
    (this.registry.get('music') as MusicSystem | null)?.play('menu');
    const { shardsEarned = 0 } = data;

    if (shardsEarned > 0) earnShards(shardsEarned);

    this.cameras.main.fadeIn(400, 0, 0, 0);

    this.buildBackground();
    this.buildCampStructures();
    this.buildHeroSprites();
    this.buildTitle();
    this.buildShardDisplay(shardsEarned);
    this.buildSettingsButton();
    this.buildButtons();

    this.events.on('resume', this.onResume, this);
  }

  update(_time: number, _delta: number) {
    const now = this.time.now;
    for (const h of this._heroStates) {
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
        // Keep current facing direction while idle
        h.pauseUntil = now + Phaser.Math.Between(1000, 4000);
      } else {
        h.sprite.x += Math.sign(dx) * 0.4;
        h.sprite.setFlipX(dx < 0);
      }
    }
  }

  private onResume() {
    // Destroy and rebuild camp layers
    for (const g of this._layerGfx) { this.tweens.killTweensOf(g); g.destroy(); }
    this._layerGfx = [];
    if (this._fireGfx) { this.tweens.killTweensOf(this._fireGfx); this._fireGfx.destroy(); this._fireGfx = null; }
    this.buildCampStructures();
    // Rebuild heroes (new unlocks)
    this.destroyHeroes();
    this.buildHeroSprites();
    this._shardText?.setText(`\u25c6 ${getShards()}`);
  }

  private destroyHeroes() {
    for (const h of this._heroStates) h.sprite.destroy();
    this._heroStates = [];
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

  // ── Camp structures (parallax layers) ─────────────────────────────────
  private buildCampStructures() {
    this._layerGfx = [];
    const midY = LAYER_CFG.mid.y;

    // ── Middle layer (always: hut + log) ──
    const midGfx = this.add.graphics().setDepth(LAYER_CFG.mid.depth);
    this._layerGfx.push(midGfx);

    // Hut
    midGfx.fillStyle(0x6b5030, 1);
    midGfx.fillRect(170, midY - 50, 60, 50);
    midGfx.lineStyle(1, 0x4a3820, 1);
    midGfx.strokeRect(170, midY - 50, 60, 50);
    midGfx.fillStyle(0x8b6914, 1);
    midGfx.fillTriangle(165, midY - 50, 200, midY - 72, 235, midY - 50);
    midGfx.fillStyle(0x3a2810, 1);
    midGfx.fillRect(190, midY - 22, 14, 22);

    // Log beside fire
    midGfx.fillStyle(0x5a4020, 1);
    midGfx.fillRect(264, midY - 6, 32, 6);

    // Campfire (separate gfx for pulse tween)
    this._fireGfx = this.add.graphics().setDepth(LAYER_CFG.mid.depth);
    this._fireGfx.fillStyle(0xff6600, 0.3);
    this._fireGfx.fillCircle(280, midY - 6, 18);
    this._fireGfx.fillStyle(0xff4400, 0.5);
    this._fireGfx.fillCircle(280, midY - 8, 8);
    this._fireGfx.fillStyle(0xffaa00, 0.7);
    this._fireGfx.fillCircle(280, midY - 10, 4);
    this.tweens.add({
      targets: this._fireGfx, alpha: 0.7, duration: 800,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // ── Per-upgrade structures on their assigned layers ──
    const byLayer = new Map<ParallaxLayer, Array<{ x: number; buildFn: (typeof CAMP_STRUCTURES)[string]['buildFn']; count: number }>>();
    for (const [id, cfg] of Object.entries(CAMP_STRUCTURES)) {
      const count = getPurchaseCount(id);
      if (count === 0) continue;
      if (!byLayer.has(cfg.layer)) byLayer.set(cfg.layer, []);
      byLayer.get(cfg.layer)!.push({ x: cfg.x, buildFn: cfg.buildFn, count });
    }

    for (const [layerKey, items] of byLayer.entries()) {
      const lcfg = LAYER_CFG[layerKey];
      const g = this.add.graphics().setDepth(lcfg.depth).setAlpha(lcfg.alpha);
      this._layerGfx.push(g);
      for (const item of items) {
        item.buildFn(g, item.x, lcfg.y, item.count);
      }
    }
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
        .setDepth(4); // between mid (3) and fg (5)

      const animKey = `${key}_idle`;
      if (this.anims.exists(animKey)) sprite.play(animKey);

      this._heroStates.push({
        sprite,
        key,
        targetX: hx,
        pauseUntil: now + Phaser.Math.Between(500, 3000),
        walking: false,
      });
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
      fontSize: '42px', fontFamily: 'Georgia, serif',
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
            this.cameras.main.shake(120, 0.003);

            // Ambient scale pulse
            this.tweens.add({
              targets: title,
              scaleX: 1.02, scaleY: 1.02,
              yoyo: true, repeat: -1, duration: 2000,
              ease: 'Sine.easeInOut',
            });

            // Gold shimmer sweep
            this.buildShimmer(title, finalX, finalY);
          },
        });
      },
    });

    // ── Subtitle — fades in after fling completes ──
    const subtitle = this.add.text(GAME_WIDTH / 2, finalY + 34, 'Ready Your Sling', {
      fontSize: '16px', fontFamily: 'Georgia, serif',
      color: '#8a9ab0', fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(10).setAlpha(0);

    this.tweens.add({
      targets: subtitle,
      alpha: 0.8,
      duration: 600,
      delay: 1800, // after pull (350) + fling (1200) + settle
      ease: 'Sine.easeIn',
    });
  }

  // ── Shimmer sweep across title ────────────────────────────────────────
  private buildShimmer(title: Phaser.GameObjects.Text, cx: number, cy: number) {
    if (this._shimmerGfx) {
      this.tweens.killTweensOf(this._shimmerGfx);
      this._shimmerGfx.destroy();
    }
    const shimmer = this.add.graphics().setDepth(11);
    this._shimmerGfx = shimmer;
    const shimmerW = 60;
    const shimmerH = 62;
    const halfW = title.displayWidth / 2;
    const shimmerStartX = cx - halfW - shimmerW;
    const shimmerEndX = cx + halfW + shimmerW;

    shimmer.setPosition(shimmerStartX, cy - shimmerH / 2);
    shimmer.fillStyle(0xfff8d0, 0.15);
    shimmer.fillRect(0, 0, shimmerW, shimmerH);
    shimmer.fillStyle(0xfff8d0, 0.25);
    shimmer.fillRect(shimmerW * 0.3, 0, shimmerW * 0.4, shimmerH);
    shimmer.setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: shimmer,
      x: shimmerEndX,
      duration: 4000,
      repeat: -1,
      repeatDelay: 2000,
      ease: 'Linear',
      onRepeat: () => shimmer.setPosition(shimmerStartX, cy - shimmerH / 2),
    });
  }

  // ── Shard display (top-right) ─────────────────────────────────────────
  private buildShardDisplay(earned: number) {
    const px = GAME_WIDTH - 20, py = 14;
    const W = 180, H = 44;

    const panel = this.add.graphics().setDepth(10);
    panel.fillStyle(0x0d1526, 0.92);
    panel.fillRoundedRect(px - W, py, W, H, 7);
    panel.lineStyle(1, 0x3a5570, 0.7);
    panel.strokeRoundedRect(px - W, py, W, H, 7);

    this.add.text(px - W / 2, py + 7, 'SHARDS', {
      fontSize: '11px', fontFamily: 'monospace', color: '#4a6a8a', letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(11);

    this._shardText = this.add.text(px - W / 2, py + 20, `\u25c6 ${getShards()}`, {
      fontSize: '18px', fontStyle: 'bold', fontFamily: 'Georgia, serif',
      color: '#7ec8e3', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(11);

    if (earned > 0) {
      const badge = this.add.text(px - 22, py + 8, `+${earned}`, {
        fontSize: '13px', fontFamily: 'Georgia, serif',
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
  }

  // ── Settings gear icon (top-left) ─────────────────────────────────────
  private buildSettingsButton() {
    const size = 44, r = 8;
    const bg = this.add.graphics().setDepth(20);
    const draw = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(0x060b12, hovered ? 1 : 0.75);
      bg.fillRoundedRect(10, 10, size, size, r);
      bg.lineStyle(1, 0x3a5070, hovered ? 1 : 0.5);
      bg.strokeRoundedRect(10, 10, size, size, r);
    };
    draw(false);
    this.add.text(10 + size / 2, 10 + size / 2, '\u2699', {
      fontSize: '22px',
    }).setOrigin(0.5).setDepth(21);

    const hit = this.add.rectangle(10 + size / 2, 10 + size / 2, size, size, 0x000000, 0)
      .setInteractive({ useHandCursor: true }).setDepth(22);
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => {
      this.scene.launch('SettingsScene', { callerKey: 'MainMenuScene' });
    });
  }

  // ── Buttons ───────────────────────────────────────────────────────────
  private buildButtons() {
    const cx = GAME_WIDTH / 2;
    const baseY = GAME_HEIGHT * 0.75 + 32;
    const colSpacing = 230;
    const rowSpacing = 50;
    const savedRunExists = hasSavedRun();

    // Row 1: Continue Run | New Run
    this.buildMenuButton(cx - colSpacing / 2, baseY, 'Continue Run', 0x2ecc71, savedRunExists, () => {
      if (this._transitioning) return;
      this._transitioning = true;
      this.cameras.main.fadeOut(350, 0, 0, 0, (_: unknown, p: number) => {
        if (p === 1) this.scene.start('OverworldScene');
      });
    });
    this.buildMenuButton(cx + colSpacing / 2, baseY, 'New Run', 0xf1c40f, true, () => {
      if (this._transitioning) return;
      if (savedRunExists) {
        this.showConfirmDialog();
      } else {
        this.goToSquadSelect();
      }
    });

    // Row 2: Camp Upgrades | Codex
    this.buildMenuButton(cx - colSpacing / 2, baseY + rowSpacing, 'Camp Upgrades', 0x7ec8e3, true, () => {
      this.scene.launch('CampUpgradesScene', { callerKey: 'MainMenuScene' });
    });
    this.buildMenuButton(cx + colSpacing / 2, baseY + rowSpacing, 'Codex', 0xc0a060, true, () => {
      this.scene.start('CodexScene', { callerKey: 'MainMenuScene' });
    });
  }

  private buildMenuButton(
    x: number, y: number, label: string,
    accentColor: number, enabled: boolean,
    onClick: () => void,
  ) {
    const w = 200, h = 46, r = 9;
    const container = this.add.container(x, y).setDepth(15);

    const bg = this.add.graphics();
    const drawBg = (hovered: boolean) => {
      bg.clear();
      if (!enabled) {
        bg.fillStyle(0x1a1a2a, 0.6);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
        bg.lineStyle(1, 0x2a2a3a, 0.4);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
        return;
      }
      const dark = Phaser.Display.Color.IntegerToColor(accentColor);
      const bgColor = Phaser.Display.Color.GetColor(
        Math.floor(dark.red * 0.15),
        Math.floor(dark.green * 0.15),
        Math.floor(dark.blue * 0.15),
      );
      bg.fillStyle(hovered ? Phaser.Display.Color.GetColor(
        Math.floor(dark.red * 0.35),
        Math.floor(dark.green * 0.35),
        Math.floor(dark.blue * 0.35),
      ) : bgColor, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      bg.lineStyle(hovered ? 2 : 1, accentColor, hovered ? 1 : 0.65);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    };
    drawBg(false);
    container.add(bg);

    const labelColor = enabled
      ? '#' + accentColor.toString(16).padStart(6, '0')
      : '#3a3a4a';
    container.add(
      this.add.text(0, 0, label, {
        fontSize: '18px', fontStyle: 'bold', fontFamily: 'Georgia, serif',
        color: labelColor, stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5),
    );

    if (enabled) {
      const hit = this.add.rectangle(0, 0, w, h, 0, 0).setInteractive({ useHandCursor: true });
      container.add(hit);
      hit.on('pointerover', () => { drawBg(true); this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 70 }); });
      hit.on('pointerout', () => { drawBg(false); this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 70 }); });
      hit.on('pointerdown', onClick);
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
      fontSize: '24px', fontFamily: 'Georgia, serif',
      color: '#e74c3c', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5));

    overlay.add(this.add.text(cx, cy - 24, 'Your saved run will be lost.', {
      fontSize: '16px', fontFamily: 'Georgia, serif', color: '#7a9ab8',
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
        fontSize: '16px', fontFamily: 'Georgia, serif',
        color: '#' + color.toString(16).padStart(6, '0'),
      }).setOrigin(0.5),
    );

    const hit = this.add.rectangle(x, y, w, h, 0, 0)
      .setInteractive({ useHandCursor: true });
    parent.add(hit);
    hit.on('pointerover', () => drawBg(true));
    hit.on('pointerout', () => drawBg(false));
    hit.on('pointerdown', onClick);
  }

  // ── Navigate to Squad Select ──────────────────────────────────────────
  private goToSquadSelect() {
    this._transitioning = true;
    this.cameras.main.fadeOut(350, 0, 0, 0, (_: unknown, p: number) => {
      if (p === 1) this.scene.start('SquadSelectScene');
    });
  }
}
