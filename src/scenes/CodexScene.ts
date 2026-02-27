import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, HERO_STATS, ENEMY_STATS, HERO_PASSIVES } from '@/config/constants';
import relicsData from '@/data/relics.json';
import cursesData from '@/data/curses.json';
import type { RelicDef } from '@/systems/RunState';
import {
  isRelicDiscovered, getRelicDiscoveryCount,
  isEnemyDiscovered, getEnemyKillCount,
  isHeroDiscovered,
} from '@/systems/DiscoveryLog';
import { getMasteryLevel, getXPForNextLevel } from '@/systems/MasterySystem';
import { ScrollablePanel } from '@/ui/ScrollablePanel';

type TabId = 'heroes' | 'bestiary' | 'relics';

const ACCENT = 0xc0a060;
const ACCENT_HEX = '#c0a060';
const BG_COLOR = 0x0a0c14;

// Tab icon texture keys (loaded in BootScene)
const TAB_ICONS: Record<TabId, string> = {
  heroes:   'icon_tab_heroes',
  bestiary: 'icon_tab_bestiary',
  relics:   'icon_tab_relics',
};

export class CodexScene extends Phaser.Scene {
  private activeTab: TabId = 'heroes';
  private tabButtons: Map<TabId, { container: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics; txt: Phaser.GameObjects.Text; icon: Phaser.GameObjects.Image | null }> = new Map();
  private callerKey = 'MainMenuScene';
  private _scrollPanel: ScrollablePanel | null = null;

  // Layout constants
  private readonly HEADER_BOTTOM = 92;
  private readonly FOOTER_TOP = GAME_HEIGHT - 60;

  constructor() {
    super({ key: 'CodexScene' });
  }

  create(data?: { callerKey?: string }) {
    this.callerKey = data?.callerKey ?? 'MainMenuScene';
    this.tabButtons.clear();
    this.buildBackground();
    this.buildTitle();
    this.buildTabs();
    this.buildBackButton();
    this.showTab('heroes');
    this.cameras.main.fadeIn(200, 0, 0, 0);
  }

  shutdown() {
    this.destroyScrollPanel();
  }

  private destroyScrollPanel() {
    if (this._scrollPanel) {
      this._scrollPanel.destroy();
      this._scrollPanel = null;
    }
  }

  private buildBackground() {
    const bg = this.add.graphics();
    bg.fillStyle(BG_COLOR, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.lineStyle(1, ACCENT, 0.3);
    bg.strokeRect(14, 14, GAME_WIDTH - 28, GAME_HEIGHT - 28);
  }

  private buildTitle() {
    this.add.text(GAME_WIDTH / 2, 32, 'CODEX', {
      fontSize: '24px', fontFamily: 'Georgia, serif',
      color: ACCENT_HEX, stroke: '#000', strokeThickness: 3,
      letterSpacing: 6,
    }).setOrigin(0.5).setDepth(10);
  }

  private buildTabs() {
    const tabs: { id: TabId; label: string }[] = [
      { id: 'heroes', label: 'Heroes' },
      { id: 'bestiary', label: 'Bestiary' },
      { id: 'relics', label: 'Relics' },
    ];
    const tabW = 160, tabH = 34, gap = 12;
    const totalW = tabs.length * tabW + (tabs.length - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2;

    tabs.forEach((tab, i) => {
      const cx = startX + i * (tabW + gap) + tabW / 2;
      const cy = 70;
      const container = this.add.container(cx, cy).setDepth(10);

      const bg = this.add.graphics();
      container.add(bg);

      // Tab icon (small, left of label)
      let tabIcon: Phaser.GameObjects.Image | null = null;
      const iconKey = TAB_ICONS[tab.id];
      if (this.textures.exists(iconKey)) {
        tabIcon = this.add.image(-tabW / 2 + 22, 0, iconKey)
          .setDisplaySize(18, 18);
        container.add(tabIcon);
      }

      const txt = this.add.text(8, 0, tab.label, {
        fontSize: '14px', fontFamily: 'Georgia, serif',
        color: ACCENT_HEX,
      }).setOrigin(0.5);
      container.add(txt);

      const isActive = tab.id === this.activeTab;
      bg.fillStyle(isActive ? 0x1e1a10 : 0x0c0e16, 1);
      bg.fillRoundedRect(-tabW / 2, -tabH / 2, tabW, tabH, 6);
      bg.lineStyle(1, ACCENT, isActive ? 0.8 : 0.25);
      bg.strokeRoundedRect(-tabW / 2, -tabH / 2, tabW, tabH, 6);
      txt.setColor(isActive ? ACCENT_HEX : '#556070');
      if (tabIcon) tabIcon.setAlpha(isActive ? 1 : 0.35);

      container.setInteractive(
        new Phaser.Geom.Rectangle(-tabW / 2, -tabH / 2, tabW, tabH),
        Phaser.Geom.Rectangle.Contains,
      );
      container.on('pointerdown', () => this.showTab(tab.id));

      this.tabButtons.set(tab.id, { container, bg, txt, icon: tabIcon });
    });
  }

  private showTab(tabId: TabId) {
    this.activeTab = tabId;
    this.destroyScrollPanel();

    // Update tab visuals
    for (const [id, btn] of this.tabButtons) {
      const active = id === tabId;
      btn.bg.clear();
      btn.bg.fillStyle(active ? 0x1e1a10 : 0x0c0e16, 1);
      btn.bg.fillRoundedRect(-80, -17, 160, 34, 6);
      btn.bg.lineStyle(1, ACCENT, active ? 0.8 : 0.25);
      btn.bg.strokeRoundedRect(-80, -17, 160, 34, 6);
      btn.txt.setColor(active ? ACCENT_HEX : '#556070');
      if (btn.icon) btn.icon.setAlpha(active ? 1 : 0.35);
    }

    // Create scroll panel for content
    const scrollX = 24;
    const scrollY = this.HEADER_BOTTOM;
    const scrollW = GAME_WIDTH - 48;
    const scrollH = this.FOOTER_TOP - this.HEADER_BOTTOM;
    this._scrollPanel = new ScrollablePanel(this, scrollX, scrollY, scrollW, scrollH, 5);

    switch (tabId) {
      case 'heroes': this.buildHeroesTab(scrollW); break;
      case 'bestiary': this.buildBestiaryTab(scrollW); break;
      case 'relics': this.buildRelicsTab(scrollW); break;
    }
  }

  // ── Heroes Tab ─────────────────────────────────────────────────────────────
  private buildHeroesTab(scrollW: number) {
    const classes = Object.keys(HERO_STATS) as (keyof typeof HERO_STATS)[];
    const cols = 4;
    const cardW = 270, cardH = 240, gapX = 16, gapY = 14;
    const gridW = cols * cardW + (cols - 1) * gapX;
    const offsetX = (scrollW - gridW) / 2;
    const startY = 10;

    const container = this._scrollPanel!.getContainer();
    const rows = Math.ceil(classes.length / cols);

    classes.forEach((cls, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = offsetX + col * (cardW + gapX) + cardW / 2;
      const cy = startY + row * (cardH + gapY) + cardH / 2;
      const discovered = isHeroDiscovered(cls);
      const stats = HERO_STATS[cls];
      const passive = HERO_PASSIVES[cls];

      // Card background
      const bg = this.add.graphics();
      bg.fillStyle(discovered ? 0x141018 : 0x0a0a0e, 1);
      bg.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
      bg.lineStyle(1, discovered ? stats.color : 0x222222, discovered ? 0.6 : 0.2);
      bg.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
      container.add(bg);

      // Name
      const name = discovered ? stats.label : '???';
      const color = discovered ? '#' + stats.color.toString(16).padStart(6, '0') : '#333';
      container.add(
        this.add.text(cx, cy - cardH / 2 + 18, name, {
          fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'bold',
          color, stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5),
      );

      // Animated sprite (idle) — 64×64
      const spriteKey = cls.toLowerCase();
      const idleFrame = `${spriteKey}_idle_1`;
      if (discovered && this.textures.exists(idleFrame)) {
        const sprite = this.add.sprite(cx, cy - 36, idleFrame)
          .setDisplaySize(64, 64);
        const animKey = `${spriteKey}_idle`;
        if (this.anims.exists(animKey)) sprite.play(animKey);
        container.add(sprite);
      } else if (!discovered) {
        // Silhouette placeholder
        const sil = this.add.graphics();
        sil.fillStyle(0x111111, 1);
        sil.fillCircle(cx, cy - 36, 28);
        container.add(sil);
        container.add(
          this.add.text(cx, cy - 36, '?', {
            fontSize: '28px', fontFamily: 'Georgia, serif', color: '#222',
          }).setOrigin(0.5),
        );
      }

      if (discovered) {
        // Stats
        const statLines = [
          `HP: ${stats.hp}`,
          `DMG: ${stats.combatDamage}`,
          `Range: ${stats.combatRange}`,
        ];
        statLines.forEach((line, li) => {
          container.add(
            this.add.text(cx, cy + 10 + li * 16, line, {
              fontSize: '13px', fontFamily: 'monospace', color: '#6a7a8a',
            }).setOrigin(0.5),
          );
        });

        // Passive name
        if (passive) {
          container.add(
            this.add.text(cx, cy + 64, passive.name, {
              fontSize: '12px', fontFamily: 'Georgia, serif', color: '#a0906a',
            }).setOrigin(0.5),
          );
        }

        // Mastery level bar
        const level = getMasteryLevel(cls);
        const { current, needed } = getXPForNextLevel(cls);
        const pct = needed > 0 ? current / needed : 1;
        const barW = cardW - 24, barH = 8;
        const barX = cx - barW / 2, barY = cy + cardH / 2 - 28;

        const barBg = this.add.graphics();
        barBg.fillStyle(0x1a1a1a, 1);
        barBg.fillRoundedRect(barX, barY, barW, barH, 3);
        barBg.fillStyle(stats.color, 0.7);
        barBg.fillRoundedRect(barX, barY, barW * Math.min(pct, 1), barH, 3);
        barBg.lineStyle(1, stats.color, 0.3);
        barBg.strokeRoundedRect(barX, barY, barW, barH, 3);
        container.add(barBg);

        container.add(
          this.add.text(cx, barY + barH + 8, `Mastery Lv.${level}`, {
            fontSize: '11px', fontFamily: 'monospace', color: '#556060',
          }).setOrigin(0.5),
        );
      }
    });

    const totalH = rows * (cardH + gapY) + startY + 10;
    this._scrollPanel!.setContentHeight(totalH);
  }

  // ── Bestiary Tab ───────────────────────────────────────────────────────────
  private buildBestiaryTab(scrollW: number) {
    const classes = Object.keys(ENEMY_STATS) as (keyof typeof ENEMY_STATS)[];
    const cols = 5;
    const cardW = 216, cardH = 160, gapX = 14, gapY = 12;
    const gridW = cols * cardW + (cols - 1) * gapX;
    const offsetX = (scrollW - gridW) / 2;
    const startY = 10;

    const container = this._scrollPanel!.getContainer();
    const rows = Math.ceil(classes.length / cols);

    classes.forEach((cls, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = offsetX + col * (cardW + gapX) + cardW / 2;
      const cy = startY + row * (cardH + gapY) + cardH / 2;
      const discovered = isEnemyDiscovered(cls);
      const stats = ENEMY_STATS[cls];

      // Card background
      const bg = this.add.graphics();
      bg.fillStyle(discovered ? 0x140a0a : 0x0a0a0e, 1);
      bg.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
      bg.lineStyle(1, discovered ? stats.color : 0x222222, discovered ? 0.6 : 0.2);
      bg.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
      container.add(bg);

      // Name
      const name = discovered ? stats.label : '???';
      const color = discovered ? '#' + stats.color.toString(16).padStart(6, '0') : '#333';
      container.add(
        this.add.text(cx, cy - cardH / 2 + 16, name, {
          fontSize: '13px', fontFamily: 'Georgia, serif', fontStyle: 'bold',
          color, stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5),
      );

      // Animated sprite (idle) — 48×48
      const spriteKey = cls.toLowerCase();
      const idleFrame = `${spriteKey}_idle_1`;
      if (discovered && this.textures.exists(idleFrame)) {
        const sprite = this.add.sprite(cx, cy - 12, idleFrame)
          .setDisplaySize(48, 48).setFlipX(true); // enemies face left
        const animKey = `${spriteKey}_idle`;
        if (this.anims.exists(animKey)) sprite.play(animKey);
        container.add(sprite);
      } else if (!discovered) {
        const sil = this.add.graphics();
        sil.fillStyle(0x111111, 1);
        sil.fillCircle(cx, cy - 12, 20);
        container.add(sil);
        container.add(
          this.add.text(cx, cy - 12, '?', {
            fontSize: '22px', fontFamily: 'Georgia, serif', color: '#222',
          }).setOrigin(0.5),
        );
      }

      if (discovered) {
        const kills = getEnemyKillCount(cls);
        container.add(
          this.add.text(cx, cy + 28, `HP: ${stats.hp}  DMG: ${stats.combatDamage}`, {
            fontSize: '12px', fontFamily: 'monospace', color: '#6a5a5a',
          }).setOrigin(0.5),
        );
        container.add(
          this.add.text(cx, cy + 46, `Kills: ${kills}`, {
            fontSize: '12px', fontFamily: 'monospace', color: '#aa6666',
          }).setOrigin(0.5),
        );
      }
    });

    const totalH = rows * (cardH + gapY) + startY + 10;
    this._scrollPanel!.setContentHeight(totalH);
  }

  // ── Relics Tab ─────────────────────────────────────────────────────────────
  private buildRelicsTab(scrollW: number) {
    const allRelics = [...(relicsData as RelicDef[]), ...(cursesData as RelicDef[])];
    const cols = 3;
    const cardW = 380, cardH = 80, gapX = 12, gapY = 8;
    const gridW = cols * cardW + (cols - 1) * gapX;
    const offsetX = (scrollW - gridW) / 2;
    const startY = 10;

    const RARITY_COLORS: Record<string, number> = {
      common: 0x95a5a6, uncommon: 0x2ecc71, rare: 0x9b59b6,
    };

    const container = this._scrollPanel!.getContainer();
    const rows = Math.ceil(allRelics.length / cols);

    allRelics.forEach((relic, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = offsetX + col * (cardW + gapX) + cardW / 2;
      const cy = startY + row * (cardH + gapY) + cardH / 2;
      const discovered = isRelicDiscovered(relic.id);
      const rarityCol = RARITY_COLORS[relic.rarity ?? 'common'] ?? 0x555555;
      const isCurse = relic.curse === true;

      // Card background
      const bg = this.add.graphics();
      bg.fillStyle(discovered ? (isCurse ? 0x140808 : 0x0e1018) : 0x0a0a0e, 1);
      bg.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 6);
      bg.lineStyle(1, discovered ? (isCurse ? 0x8a2020 : rarityCol) : 0x222222, discovered ? 0.5 : 0.15);
      bg.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 6);
      container.add(bg);

      // Relic icon placeholder (32×32)
      const iconX = cx - cardW / 2 + 28;
      const iconG = this.add.graphics();
      if (discovered) {
        iconG.fillStyle(isCurse ? 0x6a1a1a : rarityCol, 0.4);
        iconG.fillRoundedRect(iconX - 16, cy - 16, 32, 32, 4);
        iconG.lineStyle(1, isCurse ? 0x8a2020 : rarityCol, 0.5);
        iconG.strokeRoundedRect(iconX - 16, cy - 16, 32, 32, 4);
        // Curse skull or relic diamond symbol
        container.add(iconG);
        container.add(
          this.add.text(iconX, cy, isCurse ? '\u2620' : '\u25c6', {
            fontSize: '16px', color: isCurse ? '#aa3333' : '#' + rarityCol.toString(16).padStart(6, '0'),
          }).setOrigin(0.5),
        );
      } else {
        iconG.fillStyle(0x111111, 1);
        iconG.fillRoundedRect(iconX - 16, cy - 16, 32, 32, 4);
        container.add(iconG);
        container.add(
          this.add.text(iconX, cy, '?', {
            fontSize: '16px', color: '#222',
          }).setOrigin(0.5),
        );
      }

      // Right side: name, description, count
      const textX = iconX + 28;
      const name = discovered ? relic.name : '???';
      const nameCol = discovered
        ? (isCurse ? '#cc4444' : '#' + rarityCol.toString(16).padStart(6, '0'))
        : '#333';

      container.add(
        this.add.text(textX, cy - 14, name, {
          fontSize: '13px', fontFamily: 'Georgia, serif', fontStyle: 'bold',
          color: nameCol, stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0.5),
      );

      if (discovered) {
        const count = getRelicDiscoveryCount(relic.id);
        container.add(
          this.add.text(textX, cy + 10, relic.desc, {
            fontSize: '11px', fontFamily: 'Georgia, serif', color: '#5a6a7a',
            wordWrap: { width: cardW - 90 },
          }).setOrigin(0, 0.5),
        );
        container.add(
          this.add.text(cx + cardW / 2 - 14, cy, `\u00d7${count}`, {
            fontSize: '11px', fontFamily: 'monospace', color: '#556060',
          }).setOrigin(1, 0.5),
        );
      }
    });

    const totalH = rows * (cardH + gapY) + startY + 10;
    this._scrollPanel!.setContentHeight(totalH);
  }

  // ── Back Button ────────────────────────────────────────────────────────────
  private buildBackButton() {
    const w = 140, h = 42;
    const bx = 30, by = GAME_HEIGHT - 50;
    const container = this.add.container(bx + w / 2, by + h / 2).setDepth(20);

    const bg = this.add.graphics();
    const drawBtn = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(hovered ? 0x1e1a10 : 0x0c0e16, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 7);
      bg.lineStyle(1, ACCENT, hovered ? 0.8 : 0.3);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 7);
    };
    drawBtn(false);
    container.add(bg);
    container.add(
      this.add.text(0, 0, '\u2190 Back', {
        fontSize: '15px', fontFamily: 'Georgia, serif', color: ACCENT_HEX,
      }).setOrigin(0.5),
    );

    container.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on('pointerover', () => drawBtn(true));
    container.on('pointerout', () => drawBtn(false));
    container.on('pointerdown', () => {
      this.destroyScrollPanel();
      this.cameras.main.fadeOut(200, 0, 0, 0, (_: unknown, p: number) => {
        if (p === 1) this.scene.start(this.callerKey);
      });
    });
  }
}
