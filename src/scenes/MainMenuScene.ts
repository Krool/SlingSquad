import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, type HeroClass } from '@/config/constants';
import {
  getShards, earnShards, getMetaBonuses, getPurchaseCount, pickRandomCommonRelic,
} from '@/systems/MetaState';
import { newRun, addRelic, clearSave, hasSavedRun, type NodeDef } from '@/systems/RunState';
import type { MusicSystem } from '@/systems/MusicSystem';
import { getTodayString, getDailySeed, getDailySquad, getDailyMapId, getTodaysBestScore } from '@/systems/DailyChallenge';
import nodesData from '@/data/nodes.json';

interface MainMenuData {
  shardsEarned?: number;
  fromDefeat?: boolean;
}

// Upgrade id → visual config for camp structures
const CAMP_STRUCTURES: Record<string, {
  label: string;
  x: number;
  color: number;
  buildFn: (g: Phaser.GameObjects.Graphics, x: number, groundY: number, count: number) => void;
}> = {
  starting_gold: {
    label: 'Cache', x: 340, color: 0x8b6914,
    buildFn: (g, x, gy, count) => {
      // Wooden crates
      g.fillStyle(0x8b6914, 1);
      g.fillRect(x - 16, gy - 20, 32, 20);
      g.lineStyle(1, 0x5a4410, 1);
      g.strokeRect(x - 16, gy - 20, 32, 20);
      if (count >= 2) { g.fillStyle(0x9b7924, 1); g.fillRect(x - 10, gy - 36, 24, 16); g.strokeRect(x - 10, gy - 36, 24, 16); }
      if (count >= 3) { g.fillStyle(0xa88a34, 1); g.fillRect(x - 6, gy - 48, 18, 12); g.strokeRect(x - 6, gy - 48, 18, 12); }
    },
  },
  hp_boost: {
    label: 'Dummy', x: 460, color: 0x6b5030,
    buildFn: (g, x, gy, count) => {
      // Training dummy
      g.fillStyle(0x6b5030, 1);
      g.fillRect(x - 3, gy - 50, 6, 50);   // post
      g.fillRect(x - 18, gy - 40, 36, 8);   // arms
      g.fillStyle(0x8a6842, 1);
      g.fillCircle(x, gy - 58, 10);         // head
      if (count >= 2) { g.fillStyle(0x993333, 0.6); g.fillCircle(x, gy - 36, 6); } // target
      if (count >= 3) { g.fillStyle(0xcc4444, 0.7); g.fillCircle(x, gy - 36, 4); }
    },
  },
  gold_gain: {
    label: 'Market', x: 580, color: 0x27ae60,
    buildFn: (g, x, gy, count) => {
      // Market stall
      g.fillStyle(0x6b5030, 1);
      g.fillRect(x - 28, gy - 8, 56, 8);    // counter
      g.fillRect(x - 26, gy - 40, 4, 32);   // left post
      g.fillRect(x + 22, gy - 40, 4, 32);   // right post
      g.fillStyle(0x27ae60, 0.8);
      g.fillRect(x - 30, gy - 48, 60, 10);  // awning
      if (count >= 2) { g.fillStyle(0xf1c40f, 0.8); g.fillCircle(x - 8, gy - 14, 4); g.fillCircle(x + 8, gy - 14, 4); }
    },
  },
  damage_bonus: {
    label: 'Forge', x: 700, color: 0x95a5a6,
    buildFn: (g, x, gy, count) => {
      // Forge — stone blocks + anvil
      g.fillStyle(0x5a5a6a, 1);
      g.fillRect(x - 20, gy - 24, 40, 24);  // base
      g.lineStyle(1, 0x3a3a4a, 1);
      g.strokeRect(x - 20, gy - 24, 40, 24);
      g.fillStyle(0x7a7a8a, 1);
      g.fillRect(x - 10, gy - 32, 20, 8);   // anvil top
      if (count >= 2) { g.fillStyle(0xe67e22, 0.7); g.fillCircle(x + 16, gy - 30, 5); } // flame
      if (count >= 3) { g.fillStyle(0xff4444, 0.5); g.fillCircle(x + 16, gy - 30, 8); }
    },
  },
  starting_relic: {
    label: 'Altar', x: 820, color: 0x8e44ad,
    buildFn: (g, x, gy, count) => {
      // Altar — stone pedestal
      g.fillStyle(0x5a5a6a, 1);
      g.fillRect(x - 14, gy - 30, 28, 30);  // pillar
      g.fillRect(x - 20, gy - 6, 40, 6);    // base
      g.fillStyle(0x8e44ad, 0.8);
      g.fillRect(x - 18, gy - 36, 36, 6);   // top slab
      if (count >= 1) { g.fillStyle(0xc89ef0, 0.7); g.fillCircle(x, gy - 44, 5); } // glow orb
    },
  },
  launch_power: {
    label: 'Sling', x: 940, color: 0xa0522d,
    buildFn: (g, x, gy, count) => {
      // Sling tower
      g.fillStyle(0x6b5030, 1);
      g.fillRect(x - 4, gy - 55, 8, 55);    // main post
      g.fillRect(x - 14, gy - 55, 6, 18);   // left prong
      g.fillRect(x + 8, gy - 55, 6, 18);    // right prong
      g.fillRect(x - 12, gy - 6, 24, 6);    // base
      g.lineStyle(2, 0x8b6914, 0.8);
      g.lineBetween(x - 11, gy - 40, x - 2, gy - 28); // left band
      g.lineBetween(x + 11, gy - 40, x + 2, gy - 28); // right band
      if (count >= 2) { g.fillStyle(0xa0522d, 1); g.fillRect(x - 6, gy - 65, 12, 10); } // reinforced top
    },
  },
};

export class MainMenuScene extends Phaser.Scene {
  private _shardText: Phaser.GameObjects.Text | null = null;
  private _campGfx: Phaser.GameObjects.Graphics | null = null;
  private _fireGfx: Phaser.GameObjects.Graphics | null = null;
  private _heroSprites: Phaser.GameObjects.Sprite[] = [];

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(data: MainMenuData = {}) {
    console.log('[MainMenuScene] create() called', data);
    (this.registry.get('music') as MusicSystem | null)?.play('menu');
    const { shardsEarned = 0 } = data;

    // Award shards from the completed run
    if (shardsEarned > 0) earnShards(shardsEarned);

    this.cameras.main.fadeIn(400, 0, 0, 0);

    this.buildBackground();
    this.buildCampStructures();
    this.buildHeroSprites();
    this.buildTitle();
    this.buildShardDisplay(shardsEarned);
    this.buildButtons();

    // Resume handler — rebuild visuals after returning from overlay
    this.events.on('resume', this.onResume, this);
  }

  private onResume() {
    // Rebuild camp structures (new purchases may have been made)
    this._campGfx?.destroy();
    this._campGfx = null;
    if (this._fireGfx) { this.tweens.killTweensOf(this._fireGfx); this._fireGfx.destroy(); this._fireGfx = null; }
    this.buildCampStructures();
    // Refresh shard display
    this._shardText?.setText(`◆ ${getShards()}`);
  }

  // ── Background ──────────────────────────────────────────────────────────
  private buildBackground() {
    const bg = this.add.graphics().setDepth(0);

    // Night sky gradient
    bg.fillGradientStyle(0x0a0e2a, 0x0a0e2a, 0x142040, 0x142040, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.75);

    // Ground
    const groundY = GAME_HEIGHT * 0.75;
    bg.fillGradientStyle(0x1a3a1a, 0x1a3a1a, 0x0d1f0d, 0x0d1f0d, 1);
    bg.fillRect(0, groundY, GAME_WIDTH, GAME_HEIGHT - groundY);

    // Grass strip
    bg.fillStyle(0x2a5a2a, 1);
    bg.fillRect(0, groundY, GAME_WIDTH, 4);
    bg.fillStyle(0x3a7a3a, 0.6);
    for (let i = 0; i < 60; i++) {
      const gx = Phaser.Math.Between(0, GAME_WIDTH);
      bg.fillRect(gx, groundY - Phaser.Math.Between(2, 8), 2, Phaser.Math.Between(4, 10));
    }

    // Stars
    for (let i = 0; i < 80; i++) {
      const sx = Phaser.Math.Between(0, GAME_WIDTH);
      const sy = Phaser.Math.Between(0, groundY - 40);
      bg.fillStyle(0xffffff, Math.random() * 0.4 + 0.1);
      bg.fillCircle(sx, sy, Math.random() < 0.15 ? 2 : 1);
    }

    // Crescent moon
    bg.fillStyle(0xf0e8c0, 0.85);
    bg.fillCircle(GAME_WIDTH - 140, 80, 22);
    bg.fillStyle(0x0a0e2a, 1);
    bg.fillCircle(GAME_WIDTH - 130, 74, 20); // carve crescent
  }

  // ── Camp structures ─────────────────────────────────────────────────────
  private buildCampStructures() {
    const groundY = GAME_HEIGHT * 0.75;
    const g = this.add.graphics().setDepth(2);
    this._campGfx = g;

    // Always: small wooden hut
    g.fillStyle(0x6b5030, 1);
    g.fillRect(170, groundY - 50, 60, 50);       // hut walls
    g.lineStyle(1, 0x4a3820, 1);
    g.strokeRect(170, groundY - 50, 60, 50);
    g.fillStyle(0x8b6914, 1);
    g.fillTriangle(165, groundY - 50, 200, groundY - 72, 235, groundY - 50); // roof
    g.fillStyle(0x3a2810, 1);
    g.fillRect(190, groundY - 22, 14, 22);       // door

    // Campfire glow
    this._fireGfx = this.add.graphics().setDepth(3);
    this._fireGfx.fillStyle(0xff6600, 0.3);
    this._fireGfx.fillCircle(280, groundY - 6, 18);
    this._fireGfx.fillStyle(0xff4400, 0.5);
    this._fireGfx.fillCircle(280, groundY - 8, 8);
    this._fireGfx.fillStyle(0xffaa00, 0.7);
    this._fireGfx.fillCircle(280, groundY - 10, 4);

    // Campfire pulse
    this.tweens.add({
      targets: this._fireGfx, alpha: 0.7, duration: 800,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Log beside fire
    g.fillStyle(0x5a4020, 1);
    g.fillRect(264, groundY - 6, 32, 6);

    // Per-upgrade structures
    for (const [upgradeId, cfg] of Object.entries(CAMP_STRUCTURES)) {
      const count = getPurchaseCount(upgradeId);
      if (count > 0) {
        cfg.buildFn(g, cfg.x, groundY, count);
      }
    }
  }

  // ── Hero sprites ────────────────────────────────────────────────────────
  private buildHeroSprites() {
    const groundY = GAME_HEIGHT * 0.75;
    const heroKeys: string[] = ['warrior', 'ranger', 'mage', 'priest'];

    // Show all unlocked hero classes
    const meta = getMetaBonuses();
    for (const cls of meta.unlockedHeroClasses) {
      const key = cls.toLowerCase();
      if (!heroKeys.includes(key)) heroKeys.push(key);
    }

    const spacing = 60;
    const startX = GAME_WIDTH / 2 - ((heroKeys.length - 1) * spacing) / 2;

    this._heroSprites = [];
    for (let i = 0; i < heroKeys.length; i++) {
      const hx = startX + i * spacing;
      const hy = groundY - 26;
      const key = heroKeys[i];

      const sprite = this.add.sprite(hx, hy, `${key}_idle_1`)
        .setDisplaySize(50, 50)
        .setDepth(4);

      const animKey = `${key}_idle`;
      if (this.anims.exists(animKey)) {
        sprite.play(animKey);
      }
      this._heroSprites.push(sprite);
    }
  }

  // ── Title ───────────────────────────────────────────────────────────────
  private buildTitle() {
    this.add.text(GAME_WIDTH / 2, 48, 'SLING SQUAD', {
      fontSize: '42px', fontFamily: 'Georgia, serif',
      color: '#c8a840', stroke: '#000', strokeThickness: 5,
      letterSpacing: 6,
    }).setOrigin(0.5).setDepth(10);
  }

  // ── Shard display (top-right) ───────────────────────────────────────────
  private buildShardDisplay(earned: number) {
    const px = GAME_WIDTH - 20, py = 14;
    const W = 180, H = 44;

    const panel = this.add.graphics().setDepth(10);
    panel.fillStyle(0x0d1526, 0.92);
    panel.fillRoundedRect(px - W, py, W, H, 7);
    panel.lineStyle(1, 0x3a5570, 0.7);
    panel.strokeRoundedRect(px - W, py, W, H, 7);

    this.add.text(px - W / 2, py + 7, 'SHARDS', {
      fontSize: '9px', fontFamily: 'monospace', color: '#4a6a8a', letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(11);

    this._shardText = this.add.text(px - W / 2, py + 20, `◆ ${getShards()}`, {
      fontSize: '18px', fontStyle: 'bold', fontFamily: 'Georgia, serif',
      color: '#7ec8e3', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(11);

    // Earned badge animation
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

  // ── Buttons ─────────────────────────────────────────────────────────────
  private buildButtons() {
    const cx = GAME_WIDTH / 2;
    const baseY = GAME_HEIGHT * 0.75 + 32; // just below ground line
    const colSpacing = 230;
    const rowSpacing = 50;
    const savedRunExists = hasSavedRun();

    // Row 1
    this.buildMenuButton(cx - colSpacing / 2, baseY, 'Continue Run', 0x2ecc71, savedRunExists, () => {
      this.cameras.main.fadeOut(350, 0, 0, 0, (_: unknown, p: number) => {
        if (p === 1) this.scene.start('OverworldScene');
      });
    });
    this.buildMenuButton(cx + colSpacing / 2, baseY, 'New Run', 0xf1c40f, true, () => {
      if (savedRunExists) {
        this.showConfirmDialog();
      } else {
        this.startNewRun();
      }
    });

    // Row 2
    this.buildMenuButton(cx - colSpacing / 2, baseY + rowSpacing, 'Camp Upgrades', 0x7ec8e3, true, () => {
      this.scene.launch('CampUpgradesScene', { callerKey: 'MainMenuScene' });
    });
    this.buildMenuButton(cx + colSpacing / 2, baseY + rowSpacing, 'Settings', 0xa0bcd0, true, () => {
      this.scene.launch('SettingsScene', { callerKey: 'MainMenuScene' });
    });

    // Row 3
    this.buildMenuButton(cx - colSpacing / 2, baseY + rowSpacing * 2, 'Codex', 0xc0a060, true, () => {
      this.scene.start('CodexScene', { callerKey: 'MainMenuScene' });
    });

    const dailyBest = getTodaysBestScore();
    const dailyLabel = dailyBest ? `Daily  ✓${dailyBest.score}` : 'Daily Challenge';
    this.buildMenuButton(cx + colSpacing / 2, baseY + rowSpacing * 2, dailyLabel, 0xe67e22, true, () => {
      this.startDailyChallenge();
    });
  }

  private startDailyChallenge() {
    const meta = getMetaBonuses();
    clearSave();

    const seed = getDailySeed();
    const squad = getDailySquad(seed) as HeroClass[];
    const mapId = getDailyMapId(seed);

    // Use goblin_wastes nodes for now (daily always uses the base map nodes)
    const nodes = (nodesData as any).nodes as NodeDef[];
    newRun(nodes, squad, meta, mapId, { isDaily: true });

    if (meta.startingRelic) {
      const relic = pickRandomCommonRelic();
      if (relic) addRelic(relic);
    }

    this.cameras.main.fadeOut(350, 0, 0, 0, (_: unknown, p: number) => {
      if (p === 1) this.scene.start('OverworldScene');
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

  // ── Confirm dialog ──────────────────────────────────────────────────────
  private showConfirmDialog() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const overlay = this.add.container(0, 0).setDepth(50);

    // Dim
    const dim = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65)
      .setInteractive(); // block input below
    overlay.add(dim);

    // Panel
    const pw = 440, ph = 220, pr = 12;
    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0a1220, 0.97);
    panelBg.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, pr);
    panelBg.lineStyle(2, 0xe74c3c, 0.5);
    panelBg.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, pr);
    overlay.add(panelBg);

    // Title
    const title = this.add.text(cx, cy - 60, 'Abandon Current Run?', {
      fontSize: '24px', fontFamily: 'Georgia, serif',
      color: '#e74c3c', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);
    overlay.add(title);

    // Subtitle
    const sub = this.add.text(cx, cy - 24, 'Your saved run will be lost.', {
      fontSize: '14px', fontFamily: 'Georgia, serif', color: '#7a9ab8',
    }).setOrigin(0.5);
    overlay.add(sub);

    // Cancel button
    this.buildDialogButton(overlay, cx - 90, cy + 46, 'Cancel', 0x3a5070, () => {
      overlay.destroy();
    });

    // Confirm button
    this.buildDialogButton(overlay, cx + 90, cy + 46, 'Confirm', 0xe74c3c, () => {
      overlay.destroy();
      this.startNewRun();
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

  // ── Start new run ───────────────────────────────────────────────────────
  private startNewRun() {
    const meta = getMetaBonuses();
    clearSave();

    // Build squad from unlocked classes
    const squad = ['WARRIOR', 'RANGER', 'MAGE', 'PRIEST'] as HeroClass[];
    for (const cls of meta.unlockedHeroClasses) {
      if (!squad.includes(cls as HeroClass)) {
        squad.push(cls as HeroClass);
      }
    }

    const nodes = (nodesData as any).nodes as NodeDef[];
    newRun(nodes, squad, meta);

    // Inject starting relic if purchased
    if (meta.startingRelic) {
      const relic = pickRandomCommonRelic();
      if (relic) addRelic(relic);
    }

    this.cameras.main.fadeOut(350, 0, 0, 0, (_: unknown, p: number) => {
      if (p === 1) this.scene.start('OverworldScene');
    });
  }
}
