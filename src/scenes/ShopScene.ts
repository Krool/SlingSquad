import Phaser from 'phaser';
import relicsData from '@/data/relics.json';
import { getRunState, addRelic, spendGold, completeNode, type NodeDef, type RelicDef } from '@/systems/RunState';
import type { MusicSystem } from '@/systems/MusicSystem';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config/constants';
import { discoverRelic } from '@/systems/DiscoveryLog';
import { checkAchievements } from '@/systems/AchievementSystem';

const RARITY_COLOR: Record<string, number> = {
  common:   0x95a5a6,
  uncommon: 0x2ecc71,
  rare:     0x9b59b6,
};
const RARITY_BG: Record<string, number> = {
  common:   0x111e2e,
  uncommon: 0x0e2018,
  rare:     0x160e26,
};
// Icon per rarity — safe unicode that renders on canvas
const RARITY_ICON: Record<string, string> = {
  common:   '●',
  uncommon: '◆',
  rare:     '★',
};

export class ShopScene extends Phaser.Scene {
  private node!: NodeDef;
  private isFree = false;
  private offeredRelics: RelicDef[] = [];

  constructor() {
    super({ key: 'ShopScene' });
  }

  create(data: { node: NodeDef; free: boolean }) {
    (this.registry.get('music') as MusicSystem | null)?.play('shop');
    this.node = data.node;
    this.isFree = data.free;

    completeNode(this.node.id);

    this.buildBackground();
    this.buildTitle();
    this.buildGoldHUD();
    this.pickRelics();
    this.buildRelicCards();
    this.buildSkipButton();
  }

  // ── Background ─────────────────────────────────────────────────────────────
  private buildBackground() {
    const bg = this.add.graphics();
    bg.fillStyle(0x080c14, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle dot-grid pattern
    const dotCol = this.isFree ? 0x2a2000 : 0x001a0e;
    bg.fillStyle(dotCol, 1);
    const spacing = 40;
    for (let x = spacing; x < GAME_WIDTH; x += spacing) {
      for (let y = spacing; y < GAME_HEIGHT; y += spacing) {
        bg.fillCircle(x, y, 1);
      }
    }

    // Atmospheric radial glow at center-top
    const glow = this.add.graphics().setDepth(1).setAlpha(0.4);
    const glowCol = this.isFree ? 0x7d5a00 : 0x005520;
    glow.fillGradientStyle(glowCol, glowCol, 0x000000, 0x000000, 0.35, 0.35, 0, 0);
    glow.fillRect(0, 0, GAME_WIDTH, 260);

    // Outer border — double lines for richness
    const accentHex = this.isFree ? 0xf1c40f : 0x27ae60;
    bg.lineStyle(1, accentHex, 0.6);
    bg.strokeRect(18, 18, GAME_WIDTH - 36, GAME_HEIGHT - 36);
    bg.lineStyle(1, accentHex, 0.2);
    bg.strokeRect(24, 24, GAME_WIDTH - 48, GAME_HEIGHT - 48);

    // Corner ornaments
    const corners = [
      [18, 18], [GAME_WIDTH - 18, 18],
      [18, GAME_HEIGHT - 18], [GAME_WIDTH - 18, GAME_HEIGHT - 18],
    ] as [number, number][];
    bg.lineStyle(2, accentHex, 0.7);
    for (const [cx, cy] of corners) {
      const dx = cx < GAME_WIDTH / 2 ? 1 : -1;
      const dy = cy < GAME_HEIGHT / 2 ? 1 : -1;
      bg.lineBetween(cx, cy, cx + dx * 28, cy);
      bg.lineBetween(cx, cy, cx, cy + dy * 28);
    }
  }

  private buildTitle() {
    const accentCol = this.isFree ? '#f1c40f' : '#2ecc71';
    const title = this.isFree ? '✦  Supply Cache  ✦' : '◆  Wandering Trader  ◆';
    const sub = this.isFree
      ? 'Choose one relic — it\'s yours for free.'
      : 'Spend your gold wisely.';

    this.add.text(GAME_WIDTH / 2, 64, title, {
      fontSize: '34px', fontFamily: 'Georgia, serif',
      color: accentCol, stroke: '#000', strokeThickness: 4,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(5);

    this.add.text(GAME_WIDTH / 2, 108, sub, {
      fontSize: '17px', fontFamily: 'Georgia, serif', color: '#6a7e94',
    }).setOrigin(0.5).setDepth(5);

    // Thin rule under the subtitle
    const rule = this.add.graphics().setDepth(5);
    rule.lineStyle(1, this.isFree ? 0xf1c40f : 0x27ae60, 0.3);
    rule.lineBetween(GAME_WIDTH / 2 - 240, 128, GAME_WIDTH / 2 + 240, 128);
  }

  private buildGoldHUD() {
    const run = getRunState();
    const panel = this.add.graphics().setDepth(10);
    panel.fillStyle(0x0d1117, 0.9);
    panel.fillRoundedRect(18, 18, 180, 44, 7);
    panel.lineStyle(1, 0xf1c40f, 0.4);
    panel.strokeRoundedRect(18, 18, 180, 44, 7);

    this.add.text(32, 32, `◆  ${run.gold} Gold`, {
      fontSize: '20px', fontFamily: 'Georgia, serif',
      color: '#f1c40f', stroke: '#000', strokeThickness: 3,
    }).setDepth(11);
  }

  // ── Pick 3 random relics the player doesn't have ───────────────────────────
  private pickRelics() {
    const run = getRunState();
    const owned = new Set(run.relics.map(r => r.id));
    const pool = (relicsData as RelicDef[]).filter(r => !owned.has(r.id));
    Phaser.Utils.Array.Shuffle(pool);
    this.offeredRelics = pool.slice(0, 3);
  }

  // ── Relic cards ────────────────────────────────────────────────────────────
  private buildRelicCards() {
    const cardW = 280, cardH = 310;
    const totalW = 3 * cardW + 2 * 44;
    const startX = (GAME_WIDTH - totalW) / 2;
    const cardCY = GAME_HEIGHT / 2 - cardH / 2 + 28;

    this.offeredRelics.forEach((relic, i) => {
      const cx = startX + i * (cardW + 44) + cardW / 2;
      const finalY = cardCY + cardH / 2;
      this.buildCard(cx, finalY, cardW, cardH, relic, i);
    });
  }

  private buildCard(
    cx: number, cy: number, w: number, h: number, relic: RelicDef, idx: number,
  ) {
    const run = getRunState();
    const rarity = (relic as any).rarity ?? 'common';
    const bgColor = RARITY_BG[rarity] ?? 0x111e2e;
    const accentColor = RARITY_COLOR[rarity] ?? 0x95a5a6;
    const cost = this.isFree ? 0 : (relic.cost ?? 30);
    const canAfford = this.isFree || run.gold >= cost;
    const baseY = cy;   // remembered for hover correction

    const container = this.add.container(cx, cy + 60).setDepth(5).setAlpha(0);

    // ── Card background ──────────────────────────────────────────────────────
    const bg = this.add.graphics();
    const drawCardBg = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(hovered ? bgColor + 0x0d0d0d : bgColor, canAfford ? 1 : 0.7);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      bg.lineStyle(hovered ? 2 : 1, accentColor, canAfford ? (hovered ? 1 : 0.7) : 0.25);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    };
    drawCardBg(false);
    container.add(bg);

    // ── Rarity banner ────────────────────────────────────────────────────────
    const banner = this.add.graphics();
    banner.fillStyle(accentColor, canAfford ? 0.75 : 0.25);
    banner.fillRoundedRect(-w / 2, -h / 2, w, 30, { tl: 12, tr: 12, bl: 0, br: 0 });
    container.add(banner);

    const rarityLabel = this.add.text(0, -h / 2 + 15, rarity.toUpperCase(), {
      fontSize: '11px', fontFamily: 'monospace',
      color: '#fff', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(canAfford ? 1 : 0.4);
    container.add(rarityLabel);

    // ── Icon circle ──────────────────────────────────────────────────────────
    const icon = this.add.graphics();
    icon.fillStyle(accentColor, canAfford ? 0.2 : 0.07);
    icon.fillCircle(0, -h / 2 + 82, 32);
    icon.lineStyle(1, accentColor, canAfford ? 0.55 : 0.15);
    icon.strokeCircle(0, -h / 2 + 82, 32);
    container.add(icon);

    const iconSymbol = RARITY_ICON[rarity] ?? '●';
    container.add(
      this.add.text(0, -h / 2 + 82, iconSymbol, {
        fontSize: '24px', fontFamily: 'Georgia, serif',
        color: canAfford ? '#' + accentColor.toString(16).padStart(6, '0') : '#333',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5),
    );

    // ── Relic name ───────────────────────────────────────────────────────────
    container.add(
      this.add.text(0, -h / 2 + 132, relic.name, {
        fontSize: '19px', fontFamily: 'Georgia, serif', fontStyle: 'bold',
        color: canAfford ? '#e8e0d0' : '#555',
        stroke: '#000', strokeThickness: 3,
        wordWrap: { width: w - 24 }, align: 'center',
      }).setOrigin(0.5),
    );

    // ── Description ──────────────────────────────────────────────────────────
    // Position description centered between name and buy button.
    // max ~3 lines at 13px ≈ 48px height; anchor at -h/2+176 gives ~86px to button.
    container.add(
      this.add.text(0, -h / 2 + 178, relic.desc, {
        fontSize: '13px', fontFamily: 'Georgia, serif',
        color: canAfford ? '#8a9aaa' : '#3a3a3a',
        wordWrap: { width: w - 40 }, align: 'center',
      }).setOrigin(0.5),
    );

    // ── Buy / Take button ────────────────────────────────────────────────────
    const btnY = h / 2 - 36;
    const btnLabel = this.isFree ? 'TAKE' : `BUY  ◆${cost}`;
    const btnCol = canAfford
      ? (this.isFree ? 0xf1c40f : 0x27ae60)
      : 0x2a2a2a;

    const btnGfx = this.add.graphics();
    btnGfx.fillStyle(btnCol, canAfford ? 0.9 : 0.4);
    btnGfx.fillRoundedRect(-64, btnY - 16, 128, 32, 6);
    if (canAfford) {
      btnGfx.lineStyle(1, btnCol, 0.5);
      btnGfx.strokeRoundedRect(-64, btnY - 16, 128, 32, 6);
    }
    container.add(btnGfx);

    container.add(
      this.add.text(0, btnY, btnLabel, {
        fontSize: '15px', fontStyle: 'bold', fontFamily: 'Georgia, serif',
        color: canAfford ? '#fff' : '#444',
      }).setOrigin(0.5),
    );

    // ── Interactivity (only if affordable) ──────────────────────────────────
    if (canAfford) {
      const hitArea = new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h);
      container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

      container.on('pointerover', () => {
        this.tweens.killTweensOf(container);
        this.tweens.add({ targets: container, y: baseY - 10, duration: 120, ease: 'Power2' });
        drawCardBg(true);
      });
      container.on('pointerout', () => {
        this.tweens.killTweensOf(container);
        this.tweens.add({ targets: container, y: baseY, duration: 120, ease: 'Power2' });
        drawCardBg(false);
      });
      container.on('pointerdown', () => this.onPickRelic(relic, cost));
    }

    // ── Entrance animation (stagger by card index) ───────────────────────────
    this.tweens.add({
      targets: container,
      y: baseY, alpha: 1,
      duration: 420, ease: 'Back.easeOut',
      delay: 80 + idx * 120,
    });

    return container;
  }

  private onPickRelic(relic: RelicDef, cost: number) {
    if (!this.isFree) {
      if (!spendGold(cost)) return;
    }
    addRelic(relic);
    discoverRelic(relic.id);
    // Check collector achievement
    checkAchievements({ relicCount: getRunState().relics.length });
    this.cameras.main.flash(260, 255, 240, 180, false);
    this.time.delayedCall(380, () => this.goToOverworld());
  }

  // ── Skip / continue button ──────────────────────────────────────────────────
  private buildSkipButton() {
    const bx = GAME_WIDTH / 2, by = GAME_HEIGHT - 46;
    const container = this.add.container(bx, by).setDepth(10).setAlpha(0);

    const btnBg = this.add.graphics();
    const drawBtn = (hovered: boolean) => {
      btnBg.clear();
      btnBg.fillStyle(hovered ? 0x243040 : 0x151f2a, 1);
      btnBg.fillRoundedRect(-90, -18, 180, 36, 7);
      btnBg.lineStyle(1, 0x3a5070, hovered ? 0.9 : 0.45);
      btnBg.strokeRoundedRect(-90, -18, 180, 36, 7);
    };
    drawBtn(false);
    container.add(btnBg);

    container.add(
      this.add.text(0, 0, 'Continue  →', {
        fontSize: '17px', fontFamily: 'Georgia, serif', color: '#6a8aaa',
      }).setOrigin(0.5),
    );

    container.setInteractive(
      new Phaser.Geom.Rectangle(-90, -18, 180, 36),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on('pointerover', () => drawBtn(true));
    container.on('pointerout',  () => drawBtn(false));
    container.on('pointerdown', () => this.goToOverworld());

    this.tweens.add({ targets: container, alpha: 1, duration: 300, delay: 500 });
  }

  private goToOverworld() {
    this.cameras.main.fadeOut(300, 0, 0, 0, (_: unknown, progress: number) => {
      if (progress === 1) this.scene.start('OverworldScene', { fromBattle: false });
    });
  }
}
