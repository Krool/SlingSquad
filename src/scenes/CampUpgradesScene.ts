import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config/constants';
import {
  getShards, purchaseUpgrade, canPurchase, getPurchaseCount,
  getAllUpgrades, type UpgradeDef,
} from '@/systems/MetaState';

const RARITY_COLOR: Record<string, number> = {
  common:   0x4a7a9b,
  uncommon: 0x27ae60,
  rare:     0x8e44ad,
};

const RARITY_LABEL: Record<string, string> = {
  common:   'COMMON',
  uncommon: 'UNCOMMON',
  rare:     'RARE',
};

export class CampUpgradesScene extends Phaser.Scene {
  private callerKey = '';
  private _shardText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'CampUpgradesScene' });
  }

  create(data?: { callerKey?: string }) {
    this.callerKey = data?.callerKey ?? '';
    if (this.callerKey) this.scene.pause(this.callerKey);

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // ── Full-screen dim ────────────────────────────────────────────────────
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78)
      .setDepth(0).setInteractive();

    // ── Panel ──────────────────────────────────────────────────────────────
    const pw = GAME_WIDTH - 80, ph = GAME_HEIGHT - 60, pr = 14;
    const panelX = cx - pw / 2, panelY = cy - ph / 2;

    const panel = this.add.graphics().setDepth(1);
    panel.fillStyle(0x0a1220, 0.97);
    panel.fillRoundedRect(panelX, panelY, pw, ph, pr);
    panel.lineStyle(2, 0x7ec8e3, 0.30);
    panel.strokeRoundedRect(panelX, panelY, pw, ph, pr);
    panel.lineStyle(1, 0x3a5070, 0.20);
    panel.strokeRoundedRect(panelX + 4, panelY + 4, pw - 8, ph - 8, pr - 2);

    // ── Title ──────────────────────────────────────────────────────────────
    this.add.text(cx, panelY + 32, 'CAMP UPGRADES', {
      fontSize: '26px', fontFamily: 'Georgia, serif',
      color: '#7ec8e3', stroke: '#000', strokeThickness: 3,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(2);

    // Divider
    const div = this.add.graphics().setDepth(2);
    div.lineStyle(1, 0x7ec8e3, 0.18);
    div.lineBetween(cx - 340, panelY + 55, cx + 340, panelY + 55);

    // ── Shard display ──────────────────────────────────────────────────────
    this.buildShardDisplay();

    // ── Upgrade grid ───────────────────────────────────────────────────────
    this.buildUpgradeGrid();

    // ── Close button ───────────────────────────────────────────────────────
    this.buildCloseButton(cx, panelY + ph - 38);

    // ESC key closes
    this.input.keyboard?.addKey('ESC').on('down', () => this.closeOverlay());
  }

  // ── Shard display (top-right of panel) ──────────────────────────────────
  private buildShardDisplay() {
    const px = GAME_WIDTH - 60, py = 48;
    const W = 180, H = 44;

    const panel = this.add.graphics().setDepth(5);
    panel.fillStyle(0x0d1526, 0.92);
    panel.fillRoundedRect(px - W, py, W, H, 7);
    panel.lineStyle(1, 0x3a5570, 0.7);
    panel.strokeRoundedRect(px - W, py, W, H, 7);

    this.add.text(px - W / 2, py + 7, 'SHARDS', {
      fontSize: '9px', fontFamily: 'monospace', color: '#4a6a8a', letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(6);

    this._shardText = this.add.text(px - W / 2, py + 20, `◆ ${getShards()}`, {
      fontSize: '18px', fontStyle: 'bold', fontFamily: 'Georgia, serif',
      color: '#7ec8e3', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(6);
  }

  // ── Upgrade grid ────────────────────────────────────────────────────────
  private buildUpgradeGrid() {
    const upgrades = getAllUpgrades();
    const cols = 4;
    const cardW = 240, cardH = 148, gapX = 20, gapY = 16;
    const rows = Math.ceil(upgrades.length / cols);
    const gridW = cols * cardW + (cols - 1) * gapX;
    const startX = (GAME_WIDTH - gridW) / 2;
    const startY = 130;

    // Section label
    this.add.text(GAME_WIDTH / 2, startY - 22, 'PERMANENT UPGRADES', {
      fontSize: '11px', fontFamily: 'monospace', color: '#3a5a7a', letterSpacing: 3,
    }).setOrigin(0.5).setDepth(5);

    upgrades.forEach((upgrade, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * (cardW + gapX) + cardW / 2;
      const cy = startY + row * (cardH + gapY) + cardH / 2;
      this.buildUpgradeCard(upgrade, cx, cy, cardW, cardH);
    });
  }

  private buildUpgradeCard(upgrade: UpgradeDef, cx: number, cy: number, W: number, H: number) {
    const count    = getPurchaseCount(upgrade.id);
    const maxed    = count >= upgrade.maxStack;
    const buyable  = canPurchase(upgrade.id);
    const accentCol = RARITY_COLOR[upgrade.rarity] ?? 0x4a7a9b;
    const R = 8;

    const container = this.add.container(cx, cy).setDepth(10);

    const bg = this.add.graphics();
    const drawBg = (hovered: boolean) => {
      bg.clear();
      const fillAlpha = maxed ? 0.12 : hovered && buyable ? 0.28 : 0.18;
      bg.fillStyle(0x0d1526, fillAlpha + 0.5);
      bg.fillRoundedRect(-W / 2, -H / 2, W, H, R);
      bg.lineStyle(1.5, maxed ? 0x2a4a2a : hovered && buyable ? accentCol : 0x1e3050,
        maxed ? 0.9 : hovered && buyable ? 1 : 0.5);
      bg.strokeRoundedRect(-W / 2, -H / 2, W, H, R);
    };
    drawBg(false);
    container.add(bg);

    // Rarity tag
    container.add(
      this.add.text(-W / 2 + 10, -H / 2 + 9, RARITY_LABEL[upgrade.rarity], {
        fontSize: '8px', fontFamily: 'monospace',
        color: '#' + accentCol.toString(16).padStart(6, '0'),
        letterSpacing: 1,
      }),
    );

    // Name
    container.add(
      this.add.text(0, -H / 2 + 26, upgrade.name, {
        fontSize: '15px', fontStyle: 'bold', fontFamily: 'Georgia, serif',
        color: maxed ? '#4a7a4a' : '#c8d8e8',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5),
    );

    // Description
    container.add(
      this.add.text(0, -4, upgrade.desc, {
        fontSize: '12px', fontFamily: 'Georgia, serif',
        color: maxed ? '#3a5a3a' : '#7a9ab8',
        wordWrap: { width: W - 24 }, align: 'center',
      }).setOrigin(0.5),
    );

    // Stack pips
    if (upgrade.maxStack > 1) {
      for (let pip = 0; pip < upgrade.maxStack; pip++) {
        const filled = pip < count;
        const px = (pip - (upgrade.maxStack - 1) / 2) * 14;
        const pipG = this.add.graphics();
        pipG.fillStyle(filled ? accentCol : 0x1e3050, filled ? 1 : 0.6);
        pipG.fillCircle(px, H / 2 - 28, 5);
        pipG.lineStyle(1, accentCol, 0.5);
        pipG.strokeCircle(px, H / 2 - 28, 5);
        container.add(pipG);
      }
    }

    // Cost / maxed badge
    const costLabel = maxed
      ? '✓ MAXED'
      : `◆ ${upgrade.shardCost} shards`;
    const costColor = maxed ? '#4a9a4a' : buyable ? '#7ec8e3' : '#4a5a6a';
    container.add(
      this.add.text(0, H / 2 - 14, costLabel, {
        fontSize: '11px', fontFamily: 'monospace', color: costColor, letterSpacing: 1,
      }).setOrigin(0.5),
    );

    // Hit area + interaction (only if not maxed)
    if (!maxed) {
      const hit = this.add.rectangle(0, 0, W, H, 0, 0).setInteractive();
      container.add(hit);
      hit.on('pointerover',  () => { drawBg(true);  this.tweens.add({ targets: container, scaleX: 1.03, scaleY: 1.03, duration: 70 }); });
      hit.on('pointerout',   () => { drawBg(false); this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 70 }); });
      hit.on('pointerdown',  () => {
        if (!canPurchase(upgrade.id)) {
          this.flashDeny(container);
          return;
        }
        if (purchaseUpgrade(upgrade.id)) {
          container.destroy();
          this.buildUpgradeCard(upgrade, cx, cy, W, H);
          this.refreshShardDisplay();
        }
      });
    }
  }

  private flashDeny(container: Phaser.GameObjects.Container) {
    this.tweens.add({
      targets: container,
      x: container.x + 6, duration: 40, yoyo: true, repeat: 3,
      onComplete: () => { container.setX(container.x); },
    });
  }

  private refreshShardDisplay() {
    this._shardText?.setText(`◆ ${getShards()}`);
  }

  // ── Close button ─────────────────────────────────────────────────────────
  private buildCloseButton(cx: number, cy: number) {
    const w = 160, h = 44, r = 8;
    const bg = this.add.graphics().setDepth(10);

    const draw = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(hovered ? 0x243550 : 0x101c2e, 1);
      bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
      bg.lineStyle(2, hovered ? 0x7ec8e3 : 0x3a5070, hovered ? 0.9 : 0.5);
      bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
    };
    draw(false);

    this.add.text(cx, cy, 'Close', {
      fontSize: '18px', fontFamily: 'Georgia, serif', color: '#a0bcd0',
    }).setOrigin(0.5).setDepth(11);

    const hit = this.add.rectangle(cx, cy, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true }).setDepth(12);
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => this.closeOverlay());
  }

  private closeOverlay() {
    if (this.callerKey) this.scene.resume(this.callerKey);
    this.scene.stop();
  }
}
