import Phaser from 'phaser';
import relicsData from '@/data/relics.json';
import {
  getRunState, addRelic, removeRelic, upgradeRelic, completeNode, applyAndStoreRegen,
  getCurses, getNonCurseRelics,
  type NodeDef, type RelicDef,
} from '@/systems/RunState';
import type { MusicSystem } from '@/systems/MusicSystem';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config/constants';
import { discoverRelic } from '@/systems/DiscoveryLog';
import { incrementStat } from '@/systems/AchievementSystem';
import { getShards } from '@/systems/MetaState';
import { buildSettingsGear, buildCurrencyBar } from '@/ui/TopBar';

const ACCENT = 0xe67e22;
const ACCENT_HEX = '#e67e22';
const BG_COLOR = 0x0c0a06;

const RARITY_COLOR: Record<string, string> = {
  common: '#95a5a6',
  uncommon: '#2ecc71',
  rare: '#9b59b6',
};

interface ForgeOption {
  label: string;
  desc: string;
  action: () => string; // returns result text
  canUse: () => boolean;
}

export class ForgeScene extends Phaser.Scene {
  private node!: NodeDef;

  constructor() {
    super({ key: 'ForgeScene' });
  }

  create(data: { node: NodeDef }) {
    (this.registry.get('music') as MusicSystem | null)?.play('shop');
    this.node = data.node;
    completeNode(this.node.id);
    applyAndStoreRegen();

    this.buildBackground();
    buildSettingsGear(this, 'ForgeScene');
    buildCurrencyBar(this, 'shard', () => getShards(), 10, 0);
    buildCurrencyBar(this, 'gold', () => getRunState().gold, 10, 1);
    this.buildTitle();
    this.buildOptions();

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // ── Background ─────────────────────────────────────────────────────────────
  private buildBackground() {
    const bg = this.add.graphics();
    bg.fillStyle(BG_COLOR, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Ember particles
    bg.fillStyle(0x663300, 0.4);
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const y = Phaser.Math.Between(0, GAME_HEIGHT);
      bg.fillCircle(x, y, Math.random() < 0.2 ? 2 : 1);
    }

    // Top glow (warm)
    const glow = this.add.graphics().setDepth(1).setAlpha(0.5);
    glow.fillGradientStyle(ACCENT, ACCENT, 0x000000, 0x000000, 0.3, 0.3, 0, 0);
    glow.fillRect(0, 0, GAME_WIDTH, 220);

    // Border
    bg.lineStyle(1, ACCENT, 0.5);
    bg.strokeRect(18, 18, GAME_WIDTH - 36, GAME_HEIGHT - 36);
    bg.lineStyle(1, ACCENT, 0.15);
    bg.strokeRect(24, 24, GAME_WIDTH - 48, GAME_HEIGHT - 48);

    // Corner ornaments
    const corners = [
      [18, 18], [GAME_WIDTH - 18, 18],
      [18, GAME_HEIGHT - 18], [GAME_WIDTH - 18, GAME_HEIGHT - 18],
    ] as [number, number][];
    bg.lineStyle(2, ACCENT, 0.6);
    for (const [cx, cy] of corners) {
      const dx = cx < GAME_WIDTH / 2 ? 1 : -1;
      const dy = cy < GAME_HEIGHT / 2 ? 1 : -1;
      bg.lineBetween(cx, cy, cx + dx * 28, cy);
      bg.lineBetween(cx, cy, cx, cy + dy * 28);
    }
  }

  private buildTitle() {
    // Anvil icon
    const iconBg = this.add.graphics().setDepth(5);
    iconBg.fillStyle(ACCENT, 0.2);
    iconBg.fillCircle(GAME_WIDTH / 2, 72, 30);
    iconBg.lineStyle(1, ACCENT, 0.5);
    iconBg.strokeCircle(GAME_WIDTH / 2, 72, 30);

    this.add.text(GAME_WIDTH / 2, 72, '⚒', {
      fontSize: '32px', fontFamily: 'Nunito, sans-serif',
      color: ACCENT_HEX, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(6);

    this.add.text(GAME_WIDTH / 2, 122, 'The Forge', {
      fontSize: '36px', fontFamily: 'Knights Quest, Nunito, sans-serif',
      color: '#f0d8b0', stroke: '#000', strokeThickness: 4,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(5);

    this.add.text(GAME_WIDTH / 2, 158, 'Choose one action to improve your arsenal.', {
      fontSize: '17px', fontFamily: 'Nunito, sans-serif',
      color: '#8a7060', fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(5);

    const rule = this.add.graphics().setDepth(5);
    rule.lineStyle(1, ACCENT, 0.3);
    rule.lineBetween(GAME_WIDTH / 2 - 200, 178, GAME_WIDTH / 2 + 200, 178);
  }

  // ── Three option cards ───────────────────────────────────────────────────────
  private buildOptions() {
    const nonCurseRelics = getNonCurseRelics();
    const commons = nonCurseRelics.filter(r => (r.rarity ?? 'common') === 'common');
    const curses = getCurses();

    const options: ForgeOption[] = [
      {
        label: 'Upgrade Relic',
        desc: 'Enhance one relic\'s value by +50%.',
        canUse: () => nonCurseRelics.length > 0,
        action: () => {
          if (nonCurseRelics.length === 0) return 'No relics to upgrade.';
          const relic = Phaser.Utils.Array.GetRandom(nonCurseRelics);
          upgradeRelic(relic.id);
          incrementStat('forge_upgrades');
          return `Upgraded: ${relic.name} +`;
        },
      },
      {
        label: 'Fuse Relics',
        desc: 'Sacrifice 2 common relics for 1 random uncommon.',
        canUse: () => commons.length >= 2,
        action: () => {
          if (commons.length < 2) return 'Need 2 common relics.';
          // Check pool BEFORE removing commons to avoid losing relics for nothing
          const owned = new Set(getRunState().relics.map(r => r.id));
          const pool = (relicsData as RelicDef[]).filter(
            r => !owned.has(r.id) && (r.rarity ?? 'common') === 'uncommon' && !r.curse,
          );
          if (pool.length === 0) return 'No uncommon relics available.';
          // Remove 2 random commons
          const shuffled = Phaser.Utils.Array.Shuffle([...commons]);
          const removed1 = shuffled[0];
          const removed2 = shuffled[1];
          removeRelic(removed1.id);
          removeRelic(removed2.id);
          // Add random uncommon
          const gained = { ...Phaser.Utils.Array.GetRandom(pool) };
          addRelic(gained);
          discoverRelic(gained.id);
          incrementStat('forge_upgrades');
          return `Fused: ${removed1.name} + ${removed2.name}\nGained: ${gained.name}`;
        },
      },
      {
        label: 'Purge Curse',
        desc: 'Remove one curse from your collection.',
        canUse: () => curses.length > 0,
        action: () => {
          if (curses.length === 0) return 'No curses to remove.';
          const curse = Phaser.Utils.Array.GetRandom(curses);
          removeRelic(curse.id);
          return `Purged: ${curse.name}`;
        },
      },
    ];

    const cardW = 280, cardH = 240;
    const totalW = 3 * cardW + 2 * 36;
    const startX = (GAME_WIDTH - totalW) / 2;
    const cardCY = 200 + (GAME_HEIGHT - 200 - 80 - cardH) / 2;

    options.forEach((opt, i) => {
      const cx = startX + i * (cardW + 36) + cardW / 2;
      this.buildOptionCard(cx, cardCY + cardH / 2, cardW, cardH, opt, i);
    });

    // Skip button
    this.buildSkipButton();
  }

  private buildOptionCard(
    cx: number, cy: number, w: number, h: number,
    opt: ForgeOption, idx: number,
  ) {
    const canUse = opt.canUse();
    const container = this.add.container(cx, cy + 50).setDepth(5).setAlpha(0);

    const bg = this.add.graphics();
    const drawBg = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(hovered ? 0x1e1610 : 0x140e08, canUse ? 1 : 0.6);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      bg.lineStyle(hovered ? 2 : 1, ACCENT, canUse ? (hovered ? 1 : 0.6) : 0.15);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    };
    drawBg(false);
    container.add(bg);

    // Icon strip at top
    const strip = this.add.graphics();
    strip.fillStyle(ACCENT, canUse ? 0.6 : 0.15);
    strip.fillRoundedRect(-w / 2, -h / 2, w, 34, { tl: 12, tr: 12, bl: 0, br: 0 });
    container.add(strip);

    // Action label in strip
    container.add(
      this.add.text(0, -h / 2 + 17, opt.label.toUpperCase(), {
        fontSize: '16px', fontFamily: 'Nunito, sans-serif',
        color: '#fff', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(canUse ? 1 : 0.65),
    );

    // Big label
    container.add(
      this.add.text(0, -h / 2 + 72, opt.label, {
        fontSize: '22px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
        color: canUse ? '#f0d8b0' : '#8a8a9a',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5),
    );

    // Description
    container.add(
      this.add.text(0, -h / 2 + 108, opt.desc, {
        fontSize: '16px', fontFamily: 'Nunito, sans-serif',
        color: canUse ? '#8a7a6a' : '#6a6a7a',
        wordWrap: { width: w - 36 }, align: 'center',
      }).setOrigin(0.5),
    );

    // Show relevant relics preview
    if (canUse) {
      let previewText = '';
      if (idx === 0) {
        // Upgrade: show first 3 non-curse relics
        const relics = getNonCurseRelics().slice(0, 3);
        previewText = relics.map(r => r.name).join(', ');
      } else if (idx === 1) {
        // Fuse: show commons
        const commons = getNonCurseRelics().filter(r => (r.rarity ?? 'common') === 'common').slice(0, 3);
        previewText = commons.map(r => r.name).join(', ');
      } else {
        // Purge: show curses
        const curses = getCurses().slice(0, 3);
        previewText = curses.map(r => r.name).join(', ');
      }
      if (previewText) {
        container.add(
          this.add.text(0, -h / 2 + 145, previewText, {
            fontSize: '15px', fontFamily: 'Nunito, sans-serif',
            color: '#6a5a4a',
            wordWrap: { width: w - 30 }, align: 'center',
          }).setOrigin(0.5),
        );
      }
    }

    // Select button
    const btnY = h / 2 - 32;
    const btnGfx = this.add.graphics();
    btnGfx.fillStyle(canUse ? ACCENT : 0x2a2a2a, canUse ? 0.8 : 0.3);
    btnGfx.fillRoundedRect(-70, btnY - 18, 140, 36, 6);
    if (canUse) {
      btnGfx.lineStyle(1, ACCENT, 0.5);
      btnGfx.strokeRoundedRect(-70, btnY - 18, 140, 36, 6);
    }
    container.add(btnGfx);

    container.add(
      this.add.text(0, btnY, canUse ? 'SELECT' : 'N/A', {
        fontSize: '18px', fontStyle: 'bold', fontFamily: 'Nunito, sans-serif',
        color: canUse ? '#fff' : '#6a6a7a',
      }).setOrigin(0.5),
    );

    // Interactivity
    if (canUse) {
      const hitArea = new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h);
      container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

      container.on('pointerover', () => {
        drawBg(true);
        this.tweens.killTweensOf(container);
        this.tweens.add({ targets: container, y: cy - 8, duration: 120, ease: 'Power2' });
      });
      container.on('pointerout', () => {
        drawBg(false);
        this.tweens.killTweensOf(container);
        this.tweens.add({ targets: container, y: cy, duration: 120, ease: 'Power2' });
      });
      container.on('pointerdown', () => {
        container.disableInteractive();
        const result = opt.action();
        this.showResult(result);
      });
    }

    // Entrance animation
    this.tweens.add({
      targets: container,
      y: cy, alpha: 1,
      duration: 400, ease: 'Back.easeOut',
      delay: 100 + idx * 120,
    });
  }

  // ── Result overlay ───────────────────────────────────────────────────────────
  private showResult(text: string) {
    const veil = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setDepth(20).setAlpha(0);
    this.tweens.add({ targets: veil, alpha: 0.6, duration: 300 });

    const panel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(21).setAlpha(0);

    const panelW = 420, panelH = 180;
    const bg = this.add.graphics();
    bg.fillStyle(0x140e08, 1);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    bg.lineStyle(2, ACCENT, 0.7);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    panel.add(bg);

    panel.add(
      this.add.text(0, -30, text, {
        fontSize: '19px', fontFamily: 'Nunito, sans-serif',
        color: '#f0d8b0', stroke: '#000', strokeThickness: 2,
        wordWrap: { width: panelW - 40 }, align: 'center',
      }).setOrigin(0.5),
    );

    const btnW = 200, btnH = 42;
    const btnGfx = this.add.graphics();
    const drawBtn = (hovered: boolean) => {
      btnGfx.clear();
      btnGfx.fillStyle(hovered ? 0x2a1e10 : 0x1a1208, 1);
      btnGfx.fillRoundedRect(-btnW / 2, 40, btnW, btnH, 7);
      btnGfx.lineStyle(1, ACCENT, hovered ? 0.9 : 0.5);
      btnGfx.strokeRoundedRect(-btnW / 2, 40, btnW, btnH, 7);
    };
    drawBtn(false);
    panel.add(btnGfx);

    panel.add(
      this.add.text(0, 61, 'Continue  →', {
        fontSize: '19px', fontFamily: 'Nunito, sans-serif', color: ACCENT_HEX,
      }).setOrigin(0.5),
    );

    panel.setInteractive(
      new Phaser.Geom.Rectangle(-panelW / 2, -panelH / 2, panelW, panelH),
      Phaser.Geom.Rectangle.Contains,
    );
    panel.on('pointerover', () => drawBtn(true));
    panel.on('pointerout', () => drawBtn(false));
    panel.on('pointerdown', () => this.goToOverworld());

    this.tweens.add({
      targets: panel, alpha: 1, y: GAME_HEIGHT / 2 - 10,
      duration: 350, ease: 'Back.easeOut', delay: 100,
    });
  }

  private buildSkipButton() {
    const bx = GAME_WIDTH / 2, by = GAME_HEIGHT - 46;
    const container = this.add.container(bx, by).setDepth(10).setAlpha(0);

    const btnBg = this.add.graphics();
    const drawBtn = (hovered: boolean) => {
      btnBg.clear();
      btnBg.fillStyle(hovered ? 0x243020 : 0x151f1a, 1);
      btnBg.fillRoundedRect(-100, -21, 200, 42, 7);
      btnBg.lineStyle(1, 0x3a5040, hovered ? 0.9 : 0.45);
      btnBg.strokeRoundedRect(-100, -21, 200, 42, 7);
    };
    drawBtn(false);
    container.add(btnBg);

    container.add(
      this.add.text(0, 0, 'Skip  →', {
        fontSize: '19px', fontFamily: 'Nunito, sans-serif', color: '#6a8a7a',
      }).setOrigin(0.5),
    );

    container.setInteractive(
      new Phaser.Geom.Rectangle(-100, -21, 200, 42),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on('pointerover', () => drawBtn(true));
    container.on('pointerout', () => drawBtn(false));
    container.on('pointerdown', () => this.goToOverworld());

    this.tweens.add({ targets: container, alpha: 1, duration: 300, delay: 500 });
  }

  private goToOverworld() {
    this.cameras.main.fadeOut(300, 0, 0, 0, (_: unknown, progress: number) => {
      if (progress === 1) this.scene.start('OverworldScene', { fromBattle: false });
    });
  }
}
