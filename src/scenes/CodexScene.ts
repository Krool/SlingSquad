import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, HERO_STATS, ENEMY_STATS, HERO_PASSIVES } from '@/config/constants';
import relicsData from '@/data/relics.json';
import cursesData from '@/data/curses.json';
import type { RelicDef } from '@/systems/RunState';
import {
  isRelicDiscovered, getRelicDiscoveryCount,
  isEnemyDiscovered, getEnemyKillCount,
  isHeroDiscovered,
} from '@/systems/DiscoveryTracker';
import { getMasteryLevel, getXPForNextLevel } from '@/systems/MasterySystem';

type TabId = 'heroes' | 'bestiary' | 'relics';

const ACCENT = 0xc0a060;
const ACCENT_HEX = '#c0a060';
const BG_COLOR = 0x0a0c14;

export class CodexScene extends Phaser.Scene {
  private activeTab: TabId = 'heroes';
  private contentContainer!: Phaser.GameObjects.Container;
  private tabButtons: Map<TabId, Phaser.GameObjects.Container> = new Map();
  private callerKey = 'MainMenuScene';

  constructor() {
    super({ key: 'CodexScene' });
  }

  create(data?: { callerKey?: string }) {
    this.callerKey = data?.callerKey ?? 'MainMenuScene';
    this.buildBackground();
    this.buildTitle();
    this.buildTabs();
    this.contentContainer = this.add.container(0, 0).setDepth(5);
    this.buildBackButton();
    this.showTab('heroes');
    this.cameras.main.fadeIn(200, 0, 0, 0);
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
    const tabW = 140, tabH = 32, gap = 12;
    const totalW = tabs.length * tabW + (tabs.length - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2;

    tabs.forEach((tab, i) => {
      const cx = startX + i * (tabW + gap) + tabW / 2;
      const cy = 68;
      const container = this.add.container(cx, cy).setDepth(10);

      const bg = this.add.graphics();
      const drawTab = (active: boolean) => {
        bg.clear();
        bg.fillStyle(active ? 0x1e1a10 : 0x0c0e16, 1);
        bg.fillRoundedRect(-tabW / 2, -tabH / 2, tabW, tabH, 6);
        bg.lineStyle(1, ACCENT, active ? 0.8 : 0.25);
        bg.strokeRoundedRect(-tabW / 2, -tabH / 2, tabW, tabH, 6);
      };
      drawTab(tab.id === this.activeTab);
      container.add(bg);
      container.add(
        this.add.text(0, 0, tab.label, {
          fontSize: '14px', fontFamily: 'Georgia, serif',
          color: tab.id === this.activeTab ? ACCENT_HEX : '#556070',
        }).setOrigin(0.5),
      );

      container.setInteractive(
        new Phaser.Geom.Rectangle(-tabW / 2, -tabH / 2, tabW, tabH),
        Phaser.Geom.Rectangle.Contains,
      );
      container.on('pointerdown', () => this.showTab(tab.id));

      this.tabButtons.set(tab.id, container);
    });
  }

  private showTab(tabId: TabId) {
    this.activeTab = tabId;
    this.contentContainer.removeAll(true);

    // Update tab visuals
    for (const [id, container] of this.tabButtons) {
      const bg = container.list[0] as Phaser.GameObjects.Graphics;
      const active = id === tabId;
      bg.clear();
      bg.fillStyle(active ? 0x1e1a10 : 0x0c0e16, 1);
      bg.fillRoundedRect(-70, -16, 140, 32, 6);
      bg.lineStyle(1, ACCENT, active ? 0.8 : 0.25);
      bg.strokeRoundedRect(-70, -16, 140, 32, 6);
      const txt = container.list[1] as Phaser.GameObjects.Text;
      txt.setColor(active ? ACCENT_HEX : '#556070');
    }

    switch (tabId) {
      case 'heroes': this.buildHeroesTab(); break;
      case 'bestiary': this.buildBestiaryTab(); break;
      case 'relics': this.buildRelicsTab(); break;
    }
  }

  // ── Heroes Tab ───────────────────────────────────────────────────────────────
  private buildHeroesTab() {
    const classes = Object.keys(HERO_STATS) as (keyof typeof HERO_STATS)[];
    const cardW = 140, cardH = 180, gap = 12;
    const cols = Math.min(classes.length, 4);
    const rows = Math.ceil(classes.length / cols);
    const totalW = cols * cardW + (cols - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2;
    const startY = 105;

    classes.forEach((cls, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * (cardW + gap) + cardW / 2;
      const cy = startY + row * (cardH + gap) + cardH / 2;
      const discovered = isHeroDiscovered(cls);
      const stats = HERO_STATS[cls];
      const passive = HERO_PASSIVES[cls];

      const bg = this.add.graphics();
      bg.fillStyle(discovered ? 0x141018 : 0x0a0a0e, 1);
      bg.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
      bg.lineStyle(1, discovered ? stats.color : 0x222222, discovered ? 0.6 : 0.2);
      bg.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
      this.contentContainer.add(bg);

      // Name
      const name = discovered ? stats.label : '???';
      const color = discovered ? '#' + stats.color.toString(16).padStart(6, '0') : '#333';
      this.contentContainer.add(
        this.add.text(cx, cy - cardH / 2 + 20, name, {
          fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'bold',
          color, stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5),
      );

      if (discovered) {
        // Stats
        const lines = [
          `HP: ${stats.hp}`,
          `DMG: ${stats.combatDamage}`,
          `Range: ${stats.combatRange}`,
        ];
        lines.forEach((line, li) => {
          this.contentContainer.add(
            this.add.text(cx, cy - 20 + li * 16, line, {
              fontSize: '11px', fontFamily: 'monospace', color: '#6a7a8a',
            }).setOrigin(0.5),
          );
        });

        // Passive
        if (passive) {
          this.contentContainer.add(
            this.add.text(cx, cy + 38, passive.name, {
              fontSize: '10px', fontFamily: 'Georgia, serif', color: '#a0906a',
            }).setOrigin(0.5),
          );
        }

        // Mastery level
        const level = getMasteryLevel(cls);
        const { current, needed } = getXPForNextLevel(cls);
        const pct = needed > 0 ? current / needed : 1;
        const barW = cardW - 20, barH = 6;
        const barX = cx - barW / 2, barY = cy + cardH / 2 - 18;

        const barBg = this.add.graphics();
        barBg.fillStyle(0x1a1a1a, 1);
        barBg.fillRect(barX, barY, barW, barH);
        barBg.fillStyle(stats.color, 0.7);
        barBg.fillRect(barX, barY, barW * Math.min(pct, 1), barH);
        this.contentContainer.add(barBg);

        this.contentContainer.add(
          this.add.text(cx, barY + barH + 6, `Lv.${level}`, {
            fontSize: '9px', fontFamily: 'monospace', color: '#556060',
          }).setOrigin(0.5),
        );
      }
    });
  }

  // ── Bestiary Tab ─────────────────────────────────────────────────────────────
  private buildBestiaryTab() {
    const classes = Object.keys(ENEMY_STATS) as (keyof typeof ENEMY_STATS)[];
    const cardW = 140, cardH = 120, gap = 12;
    const cols = Math.min(classes.length, 5);
    const rows = Math.ceil(classes.length / cols);
    const totalW = cols * cardW + (cols - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2;
    const startY = 105;

    classes.forEach((cls, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * (cardW + gap) + cardW / 2;
      const cy = startY + row * (cardH + gap) + cardH / 2;
      const discovered = isEnemyDiscovered(cls);
      const stats = ENEMY_STATS[cls];

      const bg = this.add.graphics();
      bg.fillStyle(discovered ? 0x140a0a : 0x0a0a0e, 1);
      bg.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
      bg.lineStyle(1, discovered ? stats.color : 0x222222, discovered ? 0.6 : 0.2);
      bg.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
      this.contentContainer.add(bg);

      const name = discovered ? stats.label : '???';
      const color = discovered ? '#' + stats.color.toString(16).padStart(6, '0') : '#333';
      this.contentContainer.add(
        this.add.text(cx, cy - cardH / 2 + 18, name, {
          fontSize: '13px', fontFamily: 'Georgia, serif', fontStyle: 'bold',
          color, stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5),
      );

      if (discovered) {
        const kills = getEnemyKillCount(cls);
        this.contentContainer.add(
          this.add.text(cx, cy, `HP: ${stats.hp}  DMG: ${stats.combatDamage}`, {
            fontSize: '10px', fontFamily: 'monospace', color: '#6a5a5a',
          }).setOrigin(0.5),
        );
        this.contentContainer.add(
          this.add.text(cx, cy + 20, `Kills: ${kills}`, {
            fontSize: '10px', fontFamily: 'monospace', color: '#aa6666',
          }).setOrigin(0.5),
        );
      }
    });
  }

  // ── Relics Tab ───────────────────────────────────────────────────────────────
  private buildRelicsTab() {
    const allRelics = [...(relicsData as RelicDef[]), ...(cursesData as RelicDef[])];
    const cardW = 200, cardH = 60, gap = 8;
    const cols = 3;
    const totalW = cols * cardW + (cols - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2;
    const startY = 105;

    const RARITY_COLORS: Record<string, number> = {
      common: 0x95a5a6, uncommon: 0x2ecc71, rare: 0x9b59b6,
    };

    allRelics.forEach((relic, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * (cardW + gap) + cardW / 2;
      const cy = startY + row * (cardH + gap) + cardH / 2;
      const discovered = isRelicDiscovered(relic.id);
      const rarityCol = RARITY_COLORS[relic.rarity ?? 'common'] ?? 0x555555;
      const isCurse = relic.curse === true;

      const bg = this.add.graphics();
      bg.fillStyle(discovered ? (isCurse ? 0x140808 : 0x0e1018) : 0x0a0a0e, 1);
      bg.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 6);
      bg.lineStyle(1, discovered ? (isCurse ? 0x8a2020 : rarityCol) : 0x222222, discovered ? 0.5 : 0.15);
      bg.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 6);
      this.contentContainer.add(bg);

      const name = discovered ? relic.name : '???';
      const nameCol = discovered
        ? (isCurse ? '#cc4444' : '#' + rarityCol.toString(16).padStart(6, '0'))
        : '#333';
      this.contentContainer.add(
        this.add.text(cx - cardW / 2 + 10, cy - 10, name, {
          fontSize: '12px', fontFamily: 'Georgia, serif', fontStyle: 'bold',
          color: nameCol, stroke: '#000', strokeThickness: 1,
        }).setOrigin(0, 0.5),
      );

      if (discovered) {
        const count = getRelicDiscoveryCount(relic.id);
        this.contentContainer.add(
          this.add.text(cx - cardW / 2 + 10, cy + 10, relic.desc, {
            fontSize: '9px', fontFamily: 'Georgia, serif', color: '#5a6a7a',
            wordWrap: { width: cardW - 50 },
          }).setOrigin(0, 0.5),
        );
        this.contentContainer.add(
          this.add.text(cx + cardW / 2 - 10, cy, `×${count}`, {
            fontSize: '10px', fontFamily: 'monospace', color: '#556060',
          }).setOrigin(1, 0.5),
        );
      }
    });
  }

  // ── Back Button ──────────────────────────────────────────────────────────────
  private buildBackButton() {
    const w = 120, h = 36;
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
      this.add.text(0, 0, '← Back', {
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
      this.cameras.main.fadeOut(200, 0, 0, 0, (_: unknown, p: number) => {
        if (p === 1) this.scene.start(this.callerKey);
      });
    });
  }
}
