import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config/constants';
import {
  getShards, purchaseUpgrade, canPurchase, getPurchaseCount,
  getAllUpgrades, type UpgradeDef,
} from '@/systems/MetaState';
import { ScrollablePanel } from '@/ui/ScrollablePanel';
import { CAMP_STRUCTURES } from '@/data/campBuildings';

export class CampUpgradesScene extends Phaser.Scene {
  private callerKey = '';
  private _shardText: Phaser.GameObjects.Text | null = null;
  private _scrollPanel: ScrollablePanel | null = null;
  private _cardContainers: Map<string, Phaser.GameObjects.Container> = new Map();

  constructor() {
    super({ key: 'CampUpgradesScene' });
  }

  create(data?: { callerKey?: string }) {
    this.callerKey = data?.callerKey ?? '';
    if (this.callerKey) this.scene.pause(this.callerKey);

    this._cardContainers.clear();

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // ── Full-screen dim ──────────────────────────────────────────────────
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78)
      .setDepth(0).setInteractive();

    // ── Panel ────────────────────────────────────────────────────────────
    const pw = GAME_WIDTH - 80, ph = GAME_HEIGHT - 60, pr = 14;
    const panelX = cx - pw / 2, panelY = cy - ph / 2;

    const panel = this.add.graphics().setDepth(1);
    panel.fillStyle(0x0a1220, 0.97);
    panel.fillRoundedRect(panelX, panelY, pw, ph, pr);
    panel.lineStyle(2, 0x7ec8e3, 0.30);
    panel.strokeRoundedRect(panelX, panelY, pw, ph, pr);
    panel.lineStyle(1, 0x3a5070, 0.20);
    panel.strokeRoundedRect(panelX + 4, panelY + 4, pw - 8, ph - 8, pr - 2);

    // ── Fixed header ─────────────────────────────────────────────────────
    this.add.text(cx, panelY + 32, 'CAMP UPGRADES', {
      fontSize: '26px', fontFamily: 'Georgia, serif',
      color: '#7ec8e3', stroke: '#000', strokeThickness: 3,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(20);

    // Divider
    const div = this.add.graphics().setDepth(20);
    div.lineStyle(1, 0x7ec8e3, 0.18);
    div.lineBetween(panelX + 20, panelY + 55, panelX + pw - 20, panelY + 55);

    this.buildShardDisplay(panelX, panelY);

    // ── Scrollable area ──────────────────────────────────────────────────
    const scrollX = panelX + 20;
    const scrollY = panelY + 65;
    const scrollW = pw - 40;
    const scrollH = ph - 120; // room for header + footer

    this._scrollPanel = new ScrollablePanel(this, scrollX, scrollY, scrollW, scrollH, 5);
    this.buildUpgradeGrid(scrollW);

    // ── Fixed footer: Close button ───────────────────────────────────────
    this.buildCloseButton(cx, panelY + ph - 38);

    // ESC key closes
    this.input.keyboard?.addKey('ESC').on('down', () => this.closeOverlay());
  }

  shutdown() {
    this._scrollPanel?.destroy();
    this._scrollPanel = null;
    this._cardContainers.clear();
  }

  // ── Shard display (top-right of panel) ─────────────────────────────────
  private buildShardDisplay(panelX: number, panelY: number) {
    const px = panelX + (GAME_WIDTH - 80) - 20;
    const py = panelY + 12;
    const W = 160, H = 38;

    const bg = this.add.graphics().setDepth(20);
    bg.fillStyle(0x0d1526, 0.92);
    bg.fillRoundedRect(px - W, py, W, H, 7);
    bg.lineStyle(1, 0x3a5570, 0.7);
    bg.strokeRoundedRect(px - W, py, W, H, 7);

    this.add.text(px - W / 2, py + 5, 'SHARDS', {
      fontSize: '11px', fontFamily: 'monospace', color: '#4a6a8a', letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(21);

    this._shardText = this.add.text(px - W / 2, py + 18, `\u25c6 ${getShards()}`, {
      fontSize: '16px', fontStyle: 'bold', fontFamily: 'Georgia, serif',
      color: '#7ec8e3', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(21);
  }

  // ── Upgrade grid (3 columns) ───────────────────────────────────────────
  private buildUpgradeGrid(scrollW: number) {
    const upgrades = getAllUpgrades().filter(u => !u.hidden);
    const cols = 3;
    const cardW = 340, cardH = 140, gapX = 16, gapY = 14;
    const gridW = cols * cardW + (cols - 1) * gapX;
    const offsetX = (scrollW - gridW) / 2;
    const startY = 8;

    const rows = Math.ceil(upgrades.length / cols);
    const totalH = rows * (cardH + gapY) + startY + 10;

    const container = this._scrollPanel!.getContainer();

    upgrades.forEach((upgrade, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = offsetX + col * (cardW + gapX) + cardW / 2;
      const cy = startY + row * (cardH + gapY) + cardH / 2;
      this.buildUpgradeCard(container, upgrade, cx, cy, cardW, cardH);
    });

    this._scrollPanel!.setContentHeight(totalH);
  }

  private buildUpgradeCard(
    parent: Phaser.GameObjects.Container,
    upgrade: UpgradeDef, cx: number, cy: number, W: number, H: number,
  ) {
    const count   = getPurchaseCount(upgrade.id);
    const maxed   = count >= upgrade.maxStack;
    const buyable = canPurchase(upgrade.id);
    const R = 8;

    const card = this.add.container(cx, cy);
    this._cardContainers.set(upgrade.id, card);

    // ── Background ──
    const bg = this.add.graphics();
    const drawBg = (hovered: boolean) => {
      bg.clear();
      let borderColor: number, borderAlpha: number, fillColor: number;
      if (maxed) {
        borderColor = 0x2a6a2a; borderAlpha = 0.9; fillColor = 0x0a160a;
      } else if (buyable) {
        borderColor = hovered ? 0x7ec8e3 : 0x4a8aaa;
        borderAlpha = hovered ? 1 : 0.7;
        fillColor = hovered ? 0x122838 : 0x0d1e2e;
      } else {
        borderColor = 0x2a3040; borderAlpha = 0.4; fillColor = 0x0a0e16;
      }
      bg.fillStyle(fillColor, 1);
      bg.fillRoundedRect(-W / 2, -H / 2, W, H, R);
      bg.lineStyle(1.5, borderColor, borderAlpha);
      bg.strokeRoundedRect(-W / 2, -H / 2, W, H, R);
    };
    drawBg(false);
    card.add(bg);

    // ── Left column: Icon (48×48) ──
    const iconX = -W / 2 + 34;
    const iconY = -14;
    if (this.textures.exists(upgrade.icon)) {
      const icon = this.add.image(iconX, iconY, upgrade.icon)
        .setDisplaySize(48, 48);
      if (!buyable && !maxed) icon.setTint(0x555555);
      if (maxed) icon.setTint(0x66aa66);
      card.add(icon);
    } else {
      // Fallback: colored square
      const fallback = this.add.graphics();
      fallback.fillStyle(maxed ? 0x2a6a2a : buyable ? 0x3a6a8a : 0x2a2a3a, 1);
      fallback.fillRect(iconX - 24, iconY - 24, 48, 48);
      card.add(fallback);
    }

    // ── Mini building thumbnail (below icon, if applicable) ──
    const buildingDef = upgrade.building ? CAMP_STRUCTURES[upgrade.building] : null;
    if (buildingDef) {
      const thumbG = this.add.graphics();
      const thumbX = iconX;
      const thumbY = iconY + 38;
      // Draw at a small offset within the graphics context
      buildingDef.buildFn(thumbG, thumbX, thumbY + 25, count);
      thumbG.setScale(0.45);
      thumbG.setPosition(
        thumbG.x + thumbX * (1 - 0.45),
        thumbG.y + (thumbY + 25) * (1 - 0.45),
      );
      thumbG.setAlpha(0.6);
      card.add(thumbG);
    }

    // ── Center column: Name + Description ──
    const textX = -W / 2 + 72;
    const nameColor = maxed ? '#66aa66' : '#c8d8e8';
    card.add(
      this.add.text(textX, -H / 2 + 14, upgrade.name, {
        fontSize: '15px', fontStyle: 'bold', fontFamily: 'Georgia, serif',
        color: nameColor, stroke: '#000', strokeThickness: 2,
      }),
    );

    const descColor = maxed ? '#3a6a3a' : buyable ? '#7a9ab8' : '#4a5a68';
    card.add(
      this.add.text(textX, -H / 2 + 34, upgrade.desc, {
        fontSize: '13px', fontFamily: 'Georgia, serif', color: descColor,
        wordWrap: { width: W - 150 },
      }),
    );

    // ── Segmented progress bar ──
    const barX = textX;
    const barY = H / 2 - 34;
    const segW = 28, segH = 10, segGap = 3;
    const totalBarW = upgrade.maxStack * (segW + segGap) - segGap;

    for (let s = 0; s < upgrade.maxStack; s++) {
      const sx = barX + s * (segW + segGap);
      const filled = s < count;
      const segG = this.add.graphics();
      // Filled segment
      if (filled) {
        segG.fillStyle(maxed ? 0x2ecc71 : 0x4a9abb, 1);
      } else {
        segG.fillStyle(0x1a2030, 1);
      }
      segG.fillRoundedRect(sx, barY, segW, segH, 2);
      segG.lineStyle(1, filled ? (maxed ? 0x3adc81 : 0x5abadb) : 0x2a3040, 0.5);
      segG.strokeRoundedRect(sx, barY, segW, segH, 2);
      card.add(segG);
    }

    // Progress label
    const progressLabel = `${count}/${upgrade.maxStack}`;
    card.add(
      this.add.text(barX + totalBarW + 10, barY + segH / 2, progressLabel, {
        fontSize: '12px', fontFamily: 'monospace',
        color: maxed ? '#2ecc71' : '#5a7a8a',
      }).setOrigin(0, 0.5),
    );

    // ── Right column: Cost badge or MAXED badge ──
    const badgeX = W / 2 - 50;
    const badgeY = 0;
    const badgeW = 80, badgeH = 34;

    if (maxed) {
      const badgeBg = this.add.graphics();
      badgeBg.fillStyle(0x1a3a1a, 1);
      badgeBg.fillRoundedRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 6);
      badgeBg.lineStyle(1, 0x2ecc71, 0.6);
      badgeBg.strokeRoundedRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 6);
      card.add(badgeBg);
      card.add(
        this.add.text(badgeX, badgeY, '\u2713 MAXED', {
          fontSize: '14px', fontFamily: 'monospace', color: '#2ecc71',
        }).setOrigin(0.5),
      );
    } else {
      const badgeBg = this.add.graphics();
      badgeBg.fillStyle(buyable ? 0x0d2030 : 0x0a0e16, 1);
      badgeBg.fillRoundedRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 6);
      badgeBg.lineStyle(1, buyable ? 0x4a8aaa : 0x2a2a3a, 0.6);
      badgeBg.strokeRoundedRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 6);
      card.add(badgeBg);
      card.add(
        this.add.text(badgeX, badgeY, `\u25c6 ${upgrade.shardCost}`, {
          fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold',
          color: buyable ? '#7ec8e3' : '#4a3030',
        }).setOrigin(0.5),
      );
    }

    // ── Hit area + interaction ──
    if (!maxed) {
      const hit = this.add.rectangle(0, 0, W, H, 0, 0)
        .setInteractive({ useHandCursor: buyable });
      card.add(hit);
      hit.on('pointerover', () => {
        drawBg(true);
        this.tweens.add({ targets: card, scaleX: 1.02, scaleY: 1.02, duration: 70 });
      });
      hit.on('pointerout', () => {
        drawBg(false);
        this.tweens.add({ targets: card, scaleX: 1, scaleY: 1, duration: 70 });
      });
      hit.on('pointerdown', () => {
        if (!canPurchase(upgrade.id)) {
          this.flashDeny(card);
          return;
        }
        if (purchaseUpgrade(upgrade.id)) {
          this.rebuildCard(upgrade);
          this.refreshShardDisplay();
        }
      });
    }

    parent.add(card);
  }

  /** Rebuild a single card after purchase. */
  private rebuildCard(upgrade: UpgradeDef) {
    const old = this._cardContainers.get(upgrade.id);
    if (!old) return;
    const cx = old.x, cy = old.y;
    const parent = old.parentContainer;
    old.destroy(true);
    this._cardContainers.delete(upgrade.id);
    if (parent) {
      this.buildUpgradeCard(parent, upgrade, cx, cy, 340, 140);
    }
  }

  private flashDeny(container: Phaser.GameObjects.Container) {
    const startX = container.x;
    this.tweens.add({
      targets: container,
      x: startX + 6, duration: 40, yoyo: true, repeat: 3,
      onComplete: () => { container.setX(startX); },
    });
  }

  private refreshShardDisplay() {
    this._shardText?.setText(`\u25c6 ${getShards()}`);
  }

  // ── Close button ───────────────────────────────────────────────────────
  private buildCloseButton(cx: number, cy: number) {
    const w = 160, h = 44, r = 8;
    const bg = this.add.graphics().setDepth(20);

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
    }).setOrigin(0.5).setDepth(21);

    const hit = this.add.rectangle(cx, cy, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true }).setDepth(22);
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => this.closeOverlay());
  }

  private closeOverlay() {
    this._scrollPanel?.destroy();
    this._scrollPanel = null;
    this._cardContainers.clear();
    if (this.callerKey) this.scene.resume(this.callerKey);
    this.scene.stop();
  }
}
