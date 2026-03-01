import Phaser from 'phaser';
import {
  getRunState, completeNode, saveRun, getRelicModifiers, getHeroesOnCooldown, applyAndStoreRegen,
  type NodeDef,
} from '@/systems/RunState';
import type { MusicSystem } from '@/systems/MusicSystem';
import { GAME_WIDTH, GAME_HEIGHT, REVIVE_HP_PERCENT } from '@/config/constants';
import { getShards } from '@/systems/MetaState';
import { buildSettingsGear, buildCurrencyBar } from '@/ui/TopBar';

const ACCENT = 0x2ecc71;
const ACCENT_HEX = '#2ecc71';
const BG_COLOR = 0x0a0e06;

interface RestOption {
  label: string;
  desc: string;
  action: () => string;
  canUse: () => boolean;
}

export class RestScene extends Phaser.Scene {
  private node!: NodeDef;

  constructor() {
    super({ key: 'RestScene' });
  }

  create(data: { node: NodeDef }) {
    (this.registry.get('music') as MusicSystem | null)?.play('event');
    this.node = data.node;
    completeNode(this.node.id);
    applyAndStoreRegen();

    this.buildBackground();
    buildSettingsGear(this, 'RestScene');
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

    // Warm ember particles
    bg.fillStyle(0x664400, 0.3);
    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const y = Phaser.Math.Between(0, GAME_HEIGHT);
      bg.fillCircle(x, y, Math.random() < 0.2 ? 2 : 1);
    }

    // Campfire glow at center
    const glow = this.add.graphics().setDepth(1).setAlpha(0.5);
    glow.fillGradientStyle(0xcc6600, 0xcc6600, 0x000000, 0x000000, 0.25, 0.25, 0, 0);
    glow.fillRect(0, GAME_HEIGHT * 0.4, GAME_WIDTH, GAME_HEIGHT * 0.3);

    // Campfire drawing at center-bottom
    const fireX = GAME_WIDTH / 2;
    const fireY = GAME_HEIGHT - 160;
    const fire = this.add.graphics().setDepth(3);
    // Log base
    fire.fillStyle(0x5a3a1a, 1);
    fire.fillRect(fireX - 30, fireY + 6, 60, 8);
    fire.fillRect(fireX - 24, fireY + 2, 48, 6);
    // Flames (layered circles)
    fire.fillStyle(0xff6600, 0.7);
    fire.fillCircle(fireX, fireY - 6, 16);
    fire.fillStyle(0xff9900, 0.5);
    fire.fillCircle(fireX - 4, fireY - 12, 10);
    fire.fillCircle(fireX + 6, fireY - 10, 8);
    fire.fillStyle(0xffcc00, 0.6);
    fire.fillCircle(fireX, fireY - 16, 6);

    // Animated flicker
    this.tweens.add({
      targets: fire, alpha: 0.7, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

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
    // Heart icon
    const iconBg = this.add.graphics().setDepth(5);
    iconBg.fillStyle(ACCENT, 0.2);
    iconBg.fillCircle(GAME_WIDTH / 2, 72, 30);
    iconBg.lineStyle(1, ACCENT, 0.5);
    iconBg.strokeCircle(GAME_WIDTH / 2, 72, 30);

    this.add.text(GAME_WIDTH / 2, 72, '\u2665', {
      fontSize: '32px', fontFamily: 'Nunito, sans-serif',
      color: ACCENT_HEX, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(6);

    this.add.text(GAME_WIDTH / 2, 122, 'Rest Camp', {
      fontSize: '36px', fontFamily: 'Cinzel, Nunito, sans-serif',
      color: '#c0e8c0', stroke: '#000', strokeThickness: 4,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(5);

    this.add.text(GAME_WIDTH / 2, 158, 'Your squad rests by the campfire. Choose wisely.', {
      fontSize: '17px', fontFamily: 'Nunito, sans-serif',
      color: '#6a8a6a', fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(5);

    const rule = this.add.graphics().setDepth(5);
    rule.lineStyle(1, ACCENT, 0.3);
    rule.lineBetween(GAME_WIDTH / 2 - 200, 178, GAME_WIDTH / 2 + 200, 178);
  }

  // ── Three option cards ───────────────────────────────────────────────────────
  private buildOptions() {
    const run = getRunState();
    const cooldownHeroes = getHeroesOnCooldown();
    const hasCooldowns = cooldownHeroes.length > 0;

    const options: RestOption[] = [
      {
        label: 'Heal All',
        desc: 'Restore all living heroes to full HP.',
        canUse: () => run.squad.some(h => (h.reviveCooldown ?? 0) <= 0 && h.currentHp < h.maxHp),
        action: () => {
          for (const h of run.squad) {
            if ((h.reviveCooldown ?? 0) <= 0) {
              h.currentHp = h.maxHp;
            }
          }
          this.applyRestHpBonus();
          saveRun();
          return 'All heroes restored to full HP!';
        },
      },
      {
        label: 'Rally Fallen',
        desc: 'Reduce ALL revive cooldowns by 1.',
        canUse: () => hasCooldowns,
        action: () => {
          for (const h of run.squad) {
            if ((h.reviveCooldown ?? 0) > 0) {
              h.reviveCooldown = h.reviveCooldown! - 1;
              if (h.reviveCooldown === 0) {
                h.currentHp = Math.round(h.maxHp * REVIVE_HP_PERCENT);
              }
            }
          }
          this.applyRestHpBonus();
          saveRun();
          return 'Revive cooldowns reduced by 1!';
        },
      },
      {
        label: 'Both (Half Heal)',
        desc: 'Heal all to 50% HP AND reduce cooldowns by 1.',
        canUse: () => true,
        action: () => {
          for (const h of run.squad) {
            if ((h.reviveCooldown ?? 0) > 0) {
              h.reviveCooldown = h.reviveCooldown! - 1;
              if (h.reviveCooldown === 0) {
                h.currentHp = Math.round(h.maxHp * REVIVE_HP_PERCENT);
              }
            } else {
              h.currentHp = Math.max(h.currentHp, Math.round(h.maxHp * 0.5));
            }
          }
          this.applyRestHpBonus();
          saveRun();
          return 'Heroes healed to 50% HP, cooldowns reduced!';
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

  private applyRestHpBonus() {
    const mods = getRelicModifiers();
    if (mods.restHpBonus > 0) {
      const run = getRunState();
      for (const h of run.squad) {
        h.maxHp += mods.restHpBonus;
        h.currentHp = Math.min(h.currentHp + mods.restHpBonus, h.maxHp);
      }
    }
  }

  private buildOptionCard(
    cx: number, cy: number, w: number, h: number,
    opt: RestOption, idx: number,
  ) {
    const canUse = opt.canUse();
    const container = this.add.container(cx, cy + 50).setDepth(5).setAlpha(0);

    const bg = this.add.graphics();
    const drawBg = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(hovered ? 0x10200e : 0x0a160a, canUse ? 1 : 0.6);
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
        color: canUse ? '#c0e8c0' : '#8a8a9a',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5),
    );

    // Description
    container.add(
      this.add.text(0, -h / 2 + 108, opt.desc, {
        fontSize: '16px', fontFamily: 'Nunito, sans-serif',
        color: canUse ? '#6a8a6a' : '#6a6a7a',
        wordWrap: { width: w - 36 }, align: 'center',
      }).setOrigin(0.5),
    );

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
    bg.fillStyle(0x0a160a, 1);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    bg.lineStyle(2, ACCENT, 0.7);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    panel.add(bg);

    panel.add(
      this.add.text(0, -30, text, {
        fontSize: '19px', fontFamily: 'Nunito, sans-serif',
        color: '#c0e8c0', stroke: '#000', strokeThickness: 2,
        wordWrap: { width: panelW - 40 }, align: 'center',
      }).setOrigin(0.5),
    );

    const btnW = 200, btnH = 42;
    const btnGfx = this.add.graphics();
    const drawBtn = (hovered: boolean) => {
      btnGfx.clear();
      btnGfx.fillStyle(hovered ? 0x1a2e1a : 0x0e1e0e, 1);
      btnGfx.fillRoundedRect(-btnW / 2, 40, btnW, btnH, 7);
      btnGfx.lineStyle(1, ACCENT, hovered ? 0.9 : 0.5);
      btnGfx.strokeRoundedRect(-btnW / 2, 40, btnW, btnH, 7);
    };
    drawBtn(false);
    panel.add(btnGfx);

    panel.add(
      this.add.text(0, 61, 'Continue  \u2192', {
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
      this.add.text(0, 0, 'Skip  \u2192', {
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
