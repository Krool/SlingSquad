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
  common:   '\u25cf',
  uncommon: '\u25c6',
  rare:     '\u2605',
};

// Effect-specific icons for card display
const EFFECT_ICON: Record<string, string> = {
  FLAT_HP: '\u2665',
  COOLDOWN_REDUCE: '\u27f3',
  MAGE_AOE_RADIUS: '\u25ce',
  WARRIOR_IMPACT_BONUS: '\u2694',
  RANGER_ARROW_COUNT: '\u219f',
  PRIEST_HEAL_BONUS: '\u2665',
  FLAT_COMBAT_DAMAGE: '\u2694',
  COMBAT_SPEED_MULT: '\u26a1',
  MAX_DRAG_BONUS: '\u2197',
  GOLD_ON_WIN: '\u25c6',
  AIR_FRICTION_REDUCE: '\u2248',
  DAMAGE_REDUCTION: '\u25c8',
  THORNS: '\u2726',
  CRIT_CHANCE: '\u2727',
  IMPACT_DAMAGE_BONUS: '\u25cf',
  DEATH_SAVE: '\u2606',
  EXTRA_LAUNCH: '+',
  GOLD_ON_KILL: '\u25c6',
  WARRIOR_KNOCKBACK: '\u2694',
  MAGE_CHAIN: '\u26a1',
  RANGER_POISON: '\u2620',
  PRIEST_RESURRECT: '\u2606',
  BARD_CHARM_BONUS: '\u266a',
  STONE_DAMAGE_BONUS: '\u25fc',
  LOW_HP_DAMAGE: '\u2694',
};

function getEffectPreview(effect: string, value: number): string {
  switch (effect) {
    case 'FLAT_HP': return `+${value} HP`;
    case 'COOLDOWN_REDUCE': return `-${value / 1000}s cooldown`;
    case 'MAGE_AOE_RADIUS': return `+${value}px AoE`;
    case 'WARRIOR_IMPACT_BONUS': return `+${Math.round(value * 100)}% impact`;
    case 'RANGER_ARROW_COUNT': return `+${value} arrows`;
    case 'PRIEST_HEAL_BONUS': return `+${value}px heal range`;
    case 'FLAT_COMBAT_DAMAGE': return `+${value} damage`;
    case 'COMBAT_SPEED_MULT': return `${Math.round((1 - value) * 100)}% faster`;
    case 'MAX_DRAG_BONUS': return `+${value}px range`;
    case 'GOLD_ON_WIN': return `+${value}g per win`;
    case 'AIR_FRICTION_REDUCE': return `-${Math.round(value * 100)}% drag`;
    case 'DAMAGE_REDUCTION': return `-${Math.round(value * 100)}% damage taken`;
    case 'THORNS': return `${value} reflect dmg`;
    case 'CRIT_CHANCE': return `${Math.round(value * 100)}% crit`;
    case 'IMPACT_DAMAGE_BONUS': return `+${Math.round(value * 100)}% impact`;
    case 'DEATH_SAVE': return `Cheat death 1x`;
    case 'EXTRA_LAUNCH': return `+${value} launch`;
    case 'GOLD_ON_KILL': return `+${value}g per kill`;
    case 'WARRIOR_KNOCKBACK': return `Knockback ${value}px`;
    case 'MAGE_CHAIN': return `Chain to ${value}`;
    case 'RANGER_POISON': return `${value} poison dmg`;
    case 'PRIEST_RESURRECT': return `Revive ${Math.round(value * 100)}% HP`;
    case 'BARD_CHARM_BONUS': return `+${value / 1000}s charm`;
    case 'STONE_DAMAGE_BONUS': return `+${Math.round(value * 100)}% vs stone`;
    case 'LOW_HP_DAMAGE': return `${Math.round(value)}x low-HP dmg`;
    default: return '';
  }
}

export class ShopScene extends Phaser.Scene {
  private node!: NodeDef;
  private isFree = false;
  private offeredRelics: RelicDef[] = [];
  private _transitioning = false;

  private goldLabel!: Phaser.GameObjects.Text;
  private goldPanel!: Phaser.GameObjects.Graphics;
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private soldSet = new Set<number>();

  constructor() {
    super({ key: 'ShopScene' });
  }

  create(data: { node: NodeDef; free: boolean }) {
    (this.registry.get('music') as MusicSystem | null)?.play('shop');
    this.node = data.node;
    this.isFree = data.free;
    this.cardContainers = [];
    this.soldSet.clear();
    this._transitioning = false;

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
      : 'Buy as many as you can afford.';

    this.add.text(GAME_WIDTH / 2, 64, title, {
      fontSize: '40px', fontFamily: 'Cinzel, Nunito, sans-serif',
      color: accentCol, stroke: '#000', strokeThickness: 4,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(5);

    this.add.text(GAME_WIDTH / 2, 108, sub, {
      fontSize: '19px', fontFamily: 'Nunito, sans-serif', color: '#6a7e94',
    }).setOrigin(0.5).setDepth(5);

    // Thin rule under the subtitle
    const rule = this.add.graphics().setDepth(5);
    rule.lineStyle(1, this.isFree ? 0xf1c40f : 0x27ae60, 0.3);
    rule.lineBetween(GAME_WIDTH / 2 - 240, 128, GAME_WIDTH / 2 + 240, 128);
  }

  private buildGoldHUD() {
    const run = getRunState();
    this.goldPanel = this.add.graphics().setDepth(10);
    this.goldPanel.fillStyle(0x0d1117, 0.9);
    this.goldPanel.fillRoundedRect(18, 18, 180, 44, 7);
    this.goldPanel.lineStyle(1, 0xf1c40f, 0.4);
    this.goldPanel.strokeRoundedRect(18, 18, 180, 44, 7);

    this.goldLabel = this.add.text(32, 32, `◆  ${run.gold} Gold`, {
      fontSize: '24px', fontFamily: 'Nunito, sans-serif',
      color: '#f1c40f', stroke: '#000', strokeThickness: 3,
    }).setDepth(11);
  }

  private refreshGoldHUD() {
    const run = getRunState();
    this.goldLabel.setText(`◆  ${run.gold} Gold`);
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
      const c = this.buildCard(cx, finalY, cardW, cardH, relic, i);
      this.cardContainers.push(c);
    });
  }

  private buildCard(
    cx: number, cy: number, w: number, h: number, relic: RelicDef, idx: number,
  ) {
    const run = getRunState();
    const rarity = relic.rarity ?? 'common';
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
      fontSize: '15px', fontFamily: 'Nunito, sans-serif',
      color: '#fff', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(canAfford ? 1 : 0.65);
    container.add(rarityLabel);

    // ── Icon circle ──────────────────────────────────────────────────────────
    const icon = this.add.graphics();
    icon.fillStyle(accentColor, canAfford ? 0.2 : 0.07);
    icon.fillCircle(0, -h / 2 + 82, 32);
    icon.lineStyle(1, accentColor, canAfford ? 0.55 : 0.15);
    icon.strokeCircle(0, -h / 2 + 82, 32);
    container.add(icon);

    const iconSymbol = EFFECT_ICON[relic.effect] ?? RARITY_ICON[rarity] ?? '\u25cf';
    container.add(
      this.add.text(0, -h / 2 + 82, iconSymbol, {
        fontSize: '28px', fontFamily: 'Nunito, sans-serif',
        color: canAfford ? '#' + accentColor.toString(16).padStart(6, '0') : '#6a6a7a',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5),
    );

    // ── Relic name ───────────────────────────────────────────────────────────
    container.add(
      this.add.text(0, -h / 2 + 132, relic.name, {
        fontSize: '21px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
        color: canAfford ? '#e8e0d0' : '#8a8a9a',
        stroke: '#000', strokeThickness: 3,
        wordWrap: { width: w - 24 }, align: 'center',
      }).setOrigin(0.5),
    );

    // ── Stat preview ──────────────────────────────────────────────────────────
    const preview = getEffectPreview(relic.effect, relic.value);
    if (preview) {
      container.add(
        this.add.text(0, -h / 2 + 155, preview, {
          fontSize: '16px', fontFamily: 'Nunito, sans-serif',
          color: canAfford ? '#' + accentColor.toString(16).padStart(6, '0') : '#6a6a7a',
        }).setOrigin(0.5),
      );
    }

    // ── Description ──────────────────────────────────────────────────────────
    container.add(
      this.add.text(0, -h / 2 + 190, relic.desc, {
        fontSize: '16px', fontFamily: 'Nunito, sans-serif',
        color: canAfford ? '#8a9aaa' : '#6a6a7a',
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
        fontSize: '17px', fontStyle: 'bold', fontFamily: 'Nunito, sans-serif',
        color: canAfford ? '#fff' : '#6a6a7a',
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
      container.on('pointerdown', () => this.onPickRelic(relic, cost, idx));
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

  private onPickRelic(relic: RelicDef, cost: number, idx: number) {
    if (this.soldSet.has(idx)) return;

    if (!this.isFree) {
      if (!spendGold(cost)) return;
    }
    addRelic(relic);
    discoverRelic(relic.id);
    checkAchievements({ relicCount: getRunState().relics.length });
    this.cameras.main.flash(260, 255, 240, 180, false);

    this.soldSet.add(idx);
    this.markCardSold(idx);
    this.refreshGoldHUD();

    if (this.isFree) {
      // Free shop: pick one, disable the rest
      this.offeredRelics.forEach((_r, i) => {
        if (i !== idx && !this.soldSet.has(i)) this.disableCard(i);
      });
    } else {
      this.refreshCardAffordability();
    }
  }

  private markCardSold(idx: number) {
    const container = this.cardContainers[idx];
    if (!container) return;

    // Remove interactivity
    container.disableInteractive();

    // Dim the whole card
    this.tweens.add({ targets: container, alpha: 0.45, duration: 200 });

    // SOLD overlay
    const soldBg = this.add.graphics();
    soldBg.fillStyle(0x000000, 0.5);
    soldBg.fillRoundedRect(-60, -30, 120, 60, 8);
    container.add(soldBg);

    const soldText = this.add.text(0, -10, 'SOLD', {
      fontSize: '24px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#2ecc71', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);
    container.add(soldText);

    const checkText = this.add.text(0, 14, '✓ Acquired', {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif',
      color: '#88ddaa', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0);
    container.add(checkText);

    // Entrance animation
    this.tweens.add({
      targets: [soldText, checkText],
      alpha: 1, duration: 250, ease: 'Power2',
    });
    this.tweens.add({
      targets: soldBg, alpha: 1, scaleX: { from: 0.5, to: 1 }, scaleY: { from: 0.5, to: 1 },
      duration: 200, ease: 'Back.easeOut',
    });
  }

  private disableCard(idx: number) {
    const container = this.cardContainers[idx];
    if (!container) return;
    container.disableInteractive();
    this.tweens.add({ targets: container, alpha: 0.35, duration: 200 });
  }

  private refreshCardAffordability() {
    const run = getRunState();
    this.offeredRelics.forEach((relic, i) => {
      if (this.soldSet.has(i)) return;
      const cost = relic.cost ?? 30;
      if (run.gold < cost) {
        this.disableCard(i);
      }
    });
  }

  // ── Skip / continue button ──────────────────────────────────────────────────
  private buildSkipButton() {
    const bx = GAME_WIDTH / 2, by = GAME_HEIGHT - 46;
    const container = this.add.container(bx, by).setDepth(10).setAlpha(0);

    const btnBg = this.add.graphics();
    const drawBtn = (hovered: boolean) => {
      btnBg.clear();
      btnBg.fillStyle(hovered ? 0x243040 : 0x151f2a, 1);
      btnBg.fillRoundedRect(-100, -21, 200, 42, 7);
      btnBg.lineStyle(1, 0x3a5070, hovered ? 0.9 : 0.45);
      btnBg.strokeRoundedRect(-100, -21, 200, 42, 7);
    };
    drawBtn(false);
    container.add(btnBg);

    container.add(
      this.add.text(0, 0, 'Continue  →', {
        fontSize: '19px', fontFamily: 'Nunito, sans-serif', color: '#6a8aaa',
      }).setOrigin(0.5),
    );

    container.setInteractive(
      new Phaser.Geom.Rectangle(-100, -21, 200, 42),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on('pointerover', () => drawBtn(true));
    container.on('pointerout',  () => drawBtn(false));
    container.on('pointerdown', () => this.goToOverworld());

    this.tweens.add({ targets: container, alpha: 1, duration: 300, delay: 500 });
  }

  private goToOverworld() {
    if (this._transitioning) return;
    this._transitioning = true;
    this.cameras.main.fadeOut(300, 0, 0, 0, (_: unknown, progress: number) => {
      if (progress === 1) this.scene.start('OverworldScene', { fromBattle: false });
    });
  }
}
