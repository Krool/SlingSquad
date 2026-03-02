import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SAFE_AREA_LEFT } from '@/config/constants';
import { getShards } from '@/systems/MetaState';
import { getGlobalStats } from '@/systems/RunHistory';
import {
  getProfile, setName, setAvatar,
  getUnlockedAvatars, isAvatarUnlocked, getAvatarRequirement, getAllAvatarKeys,
} from '@/systems/PlayerProfile';
import { generateName } from '@/systems/NameGenerator';
import {
  getAllAchievements, isUnlocked as isAchievementUnlocked, getUnlockedCount,
  type AchievementDef,
} from '@/systems/AchievementSystem';
import { isFirebaseAvailable, fetchTopScores, fetchPlayerRank, type LeaderboardEntry } from '@/services/LeaderboardService';
import { ScrollablePanel } from '@/ui/ScrollablePanel';
import { buildSettingsGear, buildBackButton, buildCurrencyBar } from '@/ui/TopBar';
import { Hero } from '@/entities/Hero';
import { Enemy } from '@/entities/Enemy';

type TabId = 'profile' | 'achievements';

/** Look up sprite tint from Hero or Enemy class tint maps. */
function getCharTint(key: string): number | undefined {
  const upper = key.toUpperCase();
  return (Hero.CLASS_TINT as Record<string, number>)[upper]
    ?? (Enemy.CLASS_TINT as Record<string, number>)[upper];
}

const ACCENT = 0xc0a060;
const ACCENT_HEX = '#c0a060';
const BG_COLOR = 0x0a0c14;

export class ProfileScene extends Phaser.Scene {
  private activeTab: TabId = 'profile';
  private tabButtons: Map<TabId, { container: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics; txt: Phaser.GameObjects.Text }> = new Map();
  private callerKey = 'MainMenuScene';
  private _scrollPanel: ScrollablePanel | null = null;

  private readonly HEADER_BOTTOM = 92;
  private readonly FOOTER_TOP = GAME_HEIGHT - 60;

  constructor() {
    super({ key: 'ProfileScene' });
  }

  create(data?: { callerKey?: string }) {
    this.callerKey = data?.callerKey ?? 'MainMenuScene';
    this.tabButtons.clear();
    this.buildBackground();
    buildSettingsGear(this, 'ProfileScene', 20, SAFE_AREA_LEFT);
    buildCurrencyBar(this, 'shard', () => getShards());
    this.buildTitle();
    this.buildTabs();
    this.buildBackBtn();
    this.showTab('profile');
    this.cameras.main.fadeIn(200, 0, 0, 0);
  }

  shutdown() {
    this._scrollPanel?.destroy();
    this._scrollPanel = null;
  }

  private buildBackground() {
    const bg = this.add.graphics();
    bg.fillStyle(BG_COLOR, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.lineStyle(1, ACCENT, 0.3);
    bg.strokeRect(14, 14, GAME_WIDTH - 28, GAME_HEIGHT - 28);
  }

  private buildTitle() {
    this.add.text(GAME_WIDTH / 2, 32, 'PROFILE', {
      fontSize: '30px', fontFamily: 'Knights Quest, Nunito, sans-serif',
      color: ACCENT_HEX, stroke: '#000', strokeThickness: 3,
      letterSpacing: 6,
    }).setOrigin(0.5).setDepth(10);
  }

  private buildTabs() {
    const tabs: { id: TabId; label: string }[] = [
      { id: 'profile', label: 'Profile' },
      { id: 'achievements', label: 'Achievements' },
    ];
    const tabW = 160, tabH = 34, gap = 8;
    const totalW = tabs.length * tabW + (tabs.length - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2;

    tabs.forEach((tab, i) => {
      const x = startX + i * (tabW + gap) + tabW / 2;
      const y = 68;
      const container = this.add.container(x, y).setDepth(10);

      const bg = this.add.graphics();
      container.add(bg);

      const txt = this.add.text(0, 0, tab.label, {
        fontSize: '16px', fontFamily: 'Nunito, sans-serif',
        color: '#6a7a8a',
      }).setOrigin(0.5);
      container.add(txt);

      container.setInteractive(
        new Phaser.Geom.Rectangle(-tabW / 2, -tabH / 2, tabW, tabH),
        Phaser.Geom.Rectangle.Contains,
      );
      container.on('pointerdown', () => this.showTab(tab.id));

      this.tabButtons.set(tab.id, { container, bg, txt });
    });
  }

  private showTab(tabId: TabId) {
    this.activeTab = tabId;
    const tabW = 160, tabH = 34;

    this.tabButtons.forEach((btn, id) => {
      const active = id === tabId;
      btn.bg.clear();
      btn.bg.fillStyle(active ? 0x1a1e2e : 0x0e1018, 1);
      btn.bg.fillRoundedRect(-tabW / 2, -tabH / 2, tabW, tabH, 6);
      btn.bg.lineStyle(1, active ? ACCENT : 0x2a3040, active ? 0.8 : 0.3);
      btn.bg.strokeRoundedRect(-tabW / 2, -tabH / 2, tabW, tabH, 6);
      btn.txt.setColor(active ? ACCENT_HEX : '#6a7a8a');
    });

    this._scrollPanel?.destroy();
    this._scrollPanel = null;

    const scrollX = SAFE_AREA_LEFT + 24;
    const scrollY = this.HEADER_BOTTOM;
    const scrollW = GAME_WIDTH - SAFE_AREA_LEFT - 48;
    const scrollH = this.FOOTER_TOP - this.HEADER_BOTTOM - 8;

    this._scrollPanel = new ScrollablePanel(this, scrollX, scrollY, scrollW, scrollH, 10);

    if (tabId === 'profile') this.buildProfileTab(scrollW);
    else this.buildAchievementsTab(scrollW);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE TAB
  // ═══════════════════════════════════════════════════════════════════════════

  private buildProfileTab(scrollW: number) {
    const container = this._scrollPanel!.getContainer();
    const profile = getProfile();
    const stats = getGlobalStats();
    let cy = 10;

    // ── Avatar + Name Row ──
    const avatarKey = profile.avatarKey;
    const spriteKey = `${avatarKey}_idle_1`;
    if (this.textures.exists(spriteKey)) {
      const avatar = this.add.image(50, cy + 40, spriteKey).setDisplaySize(72, 72);
      const classTint = getCharTint(avatarKey);
      if (classTint) avatar.setTint(classTint);
      container.add(avatar);
    }

    const nameText = this.add.text(100, cy + 20, profile.name, {
      fontSize: '26px', fontFamily: 'Knights Quest, Nunito, sans-serif',
      color: ACCENT_HEX, stroke: '#000', strokeThickness: 3,
    });
    container.add(nameText);

    // Randomize button
    const randBtn = this.add.text(100 + nameText.width + 16, cy + 24, '\u21bb Randomize', {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif',
      color: '#5a8aaa', stroke: '#000', strokeThickness: 1,
      backgroundColor: '#0d1a2e', padding: { x: 8, y: 4 },
    }).setInteractive({ useHandCursor: true });
    randBtn.on('pointerdown', () => {
      const newName = generateName();
      setName(newName);
      nameText.setText(newName);
      randBtn.setX(100 + nameText.width + 16);
    });
    randBtn.on('pointerover', () => randBtn.setColor('#7ec8e3'));
    randBtn.on('pointerout', () => randBtn.setColor('#5a8aaa'));
    container.add(randBtn);

    cy += 88;

    // ── Best Score ──
    container.add(this.add.text(scrollW / 2, cy, 'BEST SCORE', {
      fontSize: '18px', fontFamily: 'Knights Quest, Nunito, sans-serif',
      color: ACCENT_HEX, stroke: '#000', strokeThickness: 2,
      letterSpacing: 3,
    }).setOrigin(0.5, 0));
    cy += 30;

    const scoreStr = profile.bestScore > 0 ? profile.bestScore.toLocaleString() + ' pts' : 'No runs yet';
    container.add(this.add.text(scrollW / 2, cy, scoreStr, {
      fontSize: '28px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: profile.bestScore > 0 ? '#f1c40f' : '#4a5a6a',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0));
    cy += 36;

    if (profile.bestAscension > 0 || profile.bestModifiers.length > 0) {
      const parts: string[] = [];
      if (profile.bestAscension > 0) parts.push(`Ascension ${profile.bestAscension}`);
      if (profile.bestModifiers.length > 0) parts.push(profile.bestModifiers.join(', '));
      container.add(this.add.text(scrollW / 2, cy, parts.join(' | '), {
        fontSize: '14px', fontFamily: 'Nunito, sans-serif', color: '#6a7a8a',
      }).setOrigin(0.5, 0));
      cy += 24;
    }

    // ── Divider ──
    const div1 = this.add.graphics();
    div1.lineStyle(1, ACCENT, 0.2);
    div1.lineBetween(40, cy + 4, scrollW - 40, cy + 4);
    container.add(div1);
    cy += 16;

    // ── Lifetime Statistics ──
    container.add(this.add.text(scrollW / 2, cy, 'LIFETIME STATISTICS', {
      fontSize: '18px', fontFamily: 'Knights Quest, Nunito, sans-serif',
      color: ACCENT_HEX, stroke: '#000', strokeThickness: 2,
      letterSpacing: 3,
    }).setOrigin(0.5, 0));
    cy += 32;

    const statItems: [string, string][] = [
      ['Total Runs',      `${stats.totalRuns}`],
      ['Victories',       `${stats.totalWins}`],
      ['Defeats',         `${stats.totalLosses}`],
      ['Win Rate',        stats.totalRuns > 0 ? `${Math.round(stats.totalWins / stats.totalRuns * 100)}%` : '--'],
      ['Enemies Slain',   `${stats.totalEnemiesKilled}`],
      ['Blocks Destroyed',`${stats.totalBlocksDestroyed}`],
      ['Gold Earned',     `${stats.totalGoldEarned}`],
      ['Best Launch DMG', `${Math.round(stats.bestDamageInOneLaunch)}`],
    ];

    const gridCols = 4, gridGapX = 14, gridGapY = 8;
    const cellW = (scrollW - gridGapX * (gridCols - 1)) / gridCols;
    const cellH = 58;

    statItems.forEach((item, i) => {
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      const cellCx = col * (cellW + gridGapX) + cellW / 2;
      const cellY = cy + row * (cellH + gridGapY);

      const cellBg = this.add.graphics();
      cellBg.fillStyle(0x0e1220, 1);
      cellBg.fillRoundedRect(cellCx - cellW / 2, cellY, cellW, cellH, 6);
      cellBg.lineStyle(1, ACCENT, 0.2);
      cellBg.strokeRoundedRect(cellCx - cellW / 2, cellY, cellW, cellH, 6);
      container.add(cellBg);

      container.add(this.add.text(cellCx, cellY + 12, item[0], {
        fontSize: '13px', fontFamily: 'Nunito, sans-serif', color: '#5a6a7a',
      }).setOrigin(0.5, 0));

      container.add(this.add.text(cellCx, cellY + 30, item[1], {
        fontSize: '20px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
        color: ACCENT_HEX, stroke: '#000', strokeThickness: 1,
      }).setOrigin(0.5, 0));
    });

    cy += 2 * (cellH + gridGapY) + 8;

    // Fastest Battle
    if (stats.fastestBattleMs < Infinity) {
      const secs = (stats.fastestBattleMs / 1000).toFixed(1);
      container.add(this.add.text(scrollW / 2, cy, `Fastest Battle: ${secs}s`, {
        fontSize: '15px', fontFamily: 'Nunito, sans-serif', color: '#a0906a',
      }).setOrigin(0.5, 0));
      cy += 28;
    }

    // ── Divider ──
    const div2 = this.add.graphics();
    div2.lineStyle(1, ACCENT, 0.2);
    div2.lineBetween(40, cy, scrollW - 40, cy);
    container.add(div2);
    cy += 16;

    // ── Choose Avatar ──
    container.add(this.add.text(scrollW / 2, cy, 'CHOOSE AVATAR', {
      fontSize: '18px', fontFamily: 'Knights Quest, Nunito, sans-serif',
      color: ACCENT_HEX, stroke: '#000', strokeThickness: 2,
      letterSpacing: 3,
    }).setOrigin(0.5, 0));
    cy += 32;

    const allAvatars = getAllAvatarKeys();
    const avatarSize = 56;
    const avatarGap = 10;
    const avatarsPerRow = Math.floor(scrollW / (avatarSize + avatarGap));
    const avatarRowW = avatarsPerRow * (avatarSize + avatarGap) - avatarGap;
    const avatarOffsetX = (scrollW - avatarRowW) / 2;

    allAvatars.forEach((key, i) => {
      const col = i % avatarsPerRow;
      const row = Math.floor(i / avatarsPerRow);
      const ax = avatarOffsetX + col * (avatarSize + avatarGap) + avatarSize / 2;
      const ay = cy + row * (avatarSize + avatarGap) + avatarSize / 2;
      const unlocked = isAvatarUnlocked(key);
      const selected = key === profile.avatarKey;

      const frame = `${key}_idle_1`;
      if (this.textures.exists(frame)) {
        const img = this.add.image(ax, ay, frame).setDisplaySize(avatarSize - 8, avatarSize - 8);
        if (!unlocked) {
          img.setTint(0x111111);
          img.setAlpha(0.5);
        } else {
          const tint = getCharTint(key);
          if (tint) img.setTint(tint);
        }
        container.add(img);
      }

      // Selection border
      const border = this.add.graphics();
      if (selected) {
        border.lineStyle(2, 0xf1c40f, 1);
        border.strokeRoundedRect(ax - avatarSize / 2, ay - avatarSize / 2, avatarSize, avatarSize, 6);
      } else if (unlocked) {
        border.lineStyle(1, ACCENT, 0.3);
        border.strokeRoundedRect(ax - avatarSize / 2, ay - avatarSize / 2, avatarSize, avatarSize, 6);
      } else {
        border.lineStyle(1, 0x2a2a3a, 0.4);
        border.strokeRoundedRect(ax - avatarSize / 2, ay - avatarSize / 2, avatarSize, avatarSize, 6);
        // Lock icon
        container.add(this.add.text(ax, ay, '\u{1F512}', {
          fontSize: '20px',
        }).setOrigin(0.5));
      }
      container.add(border);

      if (unlocked && !selected) {
        const hit = this.add.rectangle(ax, ay, avatarSize, avatarSize, 0, 0)
          .setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => {
          setAvatar(key);
          this.showTab('profile'); // refresh
        });
        container.add(hit);
      }
    });

    const avatarRows = Math.ceil(allAvatars.length / avatarsPerRow);
    cy += avatarRows * (avatarSize + avatarGap) + 8;

    // ── Divider ──
    const div3 = this.add.graphics();
    div3.lineStyle(1, ACCENT, 0.2);
    div3.lineBetween(40, cy, scrollW - 40, cy);
    container.add(div3);
    cy += 16;

    // ── Leaderboard ──
    container.add(this.add.text(scrollW / 2, cy, 'LEADERBOARD', {
      fontSize: '18px', fontFamily: 'Knights Quest, Nunito, sans-serif',
      color: ACCENT_HEX, stroke: '#000', strokeThickness: 2,
      letterSpacing: 3,
    }).setOrigin(0.5, 0));
    cy += 32;

    if (!isFirebaseAvailable()) {
      container.add(this.add.text(scrollW / 2, cy, 'Offline — leaderboard unavailable', {
        fontSize: '15px', fontFamily: 'Nunito, sans-serif', color: '#4a5a6a',
      }).setOrigin(0.5, 0));
      cy += 30;
    } else {
      const loadingText = this.add.text(scrollW / 2, cy, 'Loading...', {
        fontSize: '15px', fontFamily: 'Nunito, sans-serif', color: '#6a7a8a',
      }).setOrigin(0.5, 0);
      container.add(loadingText);

      // Fetch async
      fetchTopScores(10).then((entries: LeaderboardEntry[] | null) => {
        if (!this.scene.isActive() || !this._scrollPanel || !container.active) return;
        loadingText.destroy();

        if (!entries || entries.length === 0) {
          container.add(this.add.text(scrollW / 2, cy, 'No scores yet. Be the first!', {
            fontSize: '15px', fontFamily: 'Nunito, sans-serif', color: '#4a5a6a',
          }).setOrigin(0.5, 0));
          return;
        }

        let lbY = cy;
        const rowH = 30;
        entries.forEach((entry, i) => {
          const rank = `#${i + 1}`;
          const color = i === 0 ? '#f1c40f' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#6a7a8a';
          const textY = lbY + 4;
          container.add(this.add.text(20, textY, rank, {
            fontSize: '16px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold', color,
          }));

          // Avatar sprite
          const avatarKey = `${entry.avatarKey || 'warrior'}_idle_1`;
          if (this.textures.exists(avatarKey)) {
            const av = this.add.image(62, lbY + rowH / 2, avatarKey).setDisplaySize(22, 22);
            const tint = getCharTint(entry.avatarKey || 'warrior');
            if (tint) av.setTint(tint);
            container.add(av);
          }

          container.add(this.add.text(80, textY, entry.name, {
            fontSize: '16px', fontFamily: 'Nunito, sans-serif', color: '#b0c0d0',
          }));
          container.add(this.add.text(scrollW - 20, textY, entry.score.toLocaleString(), {
            fontSize: '16px', fontFamily: 'Nunito, sans-serif', color,
          }).setOrigin(1, 0));
          lbY += rowH;
        });

        // Player rank
        fetchPlayerRank().then((rank: number | null) => {
          if (!this.scene.isActive() || !this._scrollPanel || !container.active || rank === null) return;
          lbY += 8;
          const divG = this.add.graphics();
          divG.lineStyle(1, ACCENT, 0.15);
          divG.lineBetween(20, lbY, scrollW - 20, lbY);
          container.add(divG);
          lbY += 8;
          container.add(this.add.text(20, lbY, `You: #${rank}`, {
            fontSize: '15px', fontFamily: 'Nunito, sans-serif', color: '#7ec8e3',
          }));
          container.add(this.add.text(scrollW - 20, lbY, `${profile.bestScore.toLocaleString()} pts`, {
            fontSize: '15px', fontFamily: 'Nunito, sans-serif', color: '#7ec8e3',
          }).setOrigin(1, 0));
        });
      });
      cy += 300; // reserve space
    }

    this._scrollPanel!.setContentHeight(cy + 20);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACHIEVEMENTS TAB
  // ═══════════════════════════════════════════════════════════════════════════

  private buildAchievementsTab(scrollW: number) {
    const container = this._scrollPanel!.getContainer();
    const all = getAllAchievements();
    const unlockedCount = getUnlockedCount();
    let cy = 10;

    // Header with progress bar
    const headerText = `ACHIEVEMENTS  ${unlockedCount}/${all.length} Unlocked`;
    container.add(this.add.text(scrollW / 2, cy, headerText, {
      fontSize: '18px', fontFamily: 'Knights Quest, Nunito, sans-serif',
      color: ACCENT_HEX, stroke: '#000', strokeThickness: 2,
      letterSpacing: 2,
    }).setOrigin(0.5, 0));
    cy += 30;

    // Progress bar
    const barW = scrollW - 100, barH = 10;
    const barX = (scrollW - barW) / 2;
    const barBg = this.add.graphics();
    barBg.fillStyle(0x1a2030, 1);
    barBg.fillRoundedRect(barX, cy, barW, barH, 4);
    container.add(barBg);

    if (unlockedCount > 0) {
      const fillW = Math.max(8, (barW * unlockedCount) / all.length);
      const barFill = this.add.graphics();
      barFill.fillStyle(0xf1c40f, 1);
      barFill.fillRoundedRect(barX, cy, fillW, barH, 4);
      container.add(barFill);
    }
    cy += 24;

    // Group by category
    const categories = ['completion', 'combat', 'challenge', 'meta'];
    const categoryLabels: Record<string, string> = {
      completion: 'COMPLETION', combat: 'COMBAT', challenge: 'CHALLENGE', meta: 'META',
    };

    for (const cat of categories) {
      const items = all.filter(a => a.category === cat);
      if (items.length === 0) continue;

      // Category header
      const divG = this.add.graphics();
      divG.lineStyle(1, ACCENT, 0.15);
      divG.lineBetween(20, cy, scrollW - 20, cy);
      container.add(divG);
      cy += 8;

      container.add(this.add.text(scrollW / 2, cy, categoryLabels[cat] ?? cat.toUpperCase(), {
        fontSize: '14px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
        color: '#5a6a7a', letterSpacing: 3,
      }).setOrigin(0.5, 0));
      cy += 26;

      for (const ach of items) {
        const unlocked = isAchievementUnlocked(ach.id);
        this.buildAchievementRow(container, ach, unlocked, scrollW, cy);
        cy += 52;
      }
      cy += 8;
    }

    this._scrollPanel!.setContentHeight(cy + 10);
  }

  private buildAchievementRow(
    container: Phaser.GameObjects.Container,
    ach: AchievementDef, unlocked: boolean,
    scrollW: number, cy: number,
  ) {
    const rowH = 46;
    const rowBg = this.add.graphics();
    rowBg.fillStyle(unlocked ? 0x0e1a12 : 0x0e1018, 1);
    rowBg.fillRoundedRect(10, cy, scrollW - 20, rowH, 6);
    rowBg.lineStyle(1, unlocked ? 0x2ecc71 : 0x2a3040, unlocked ? 0.5 : 0.3);
    rowBg.strokeRoundedRect(10, cy, scrollW - 20, rowH, 6);
    container.add(rowBg);

    // Check or question mark
    const icon = unlocked ? '\u2713' : '?';
    const iconColor = unlocked ? '#2ecc71' : '#4a4a5a';
    container.add(this.add.text(30, cy + rowH / 2, icon, {
      fontSize: '20px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: iconColor,
    }).setOrigin(0.5));

    // Name
    const name = unlocked ? ach.name : '???';
    container.add(this.add.text(52, cy + 8, name, {
      fontSize: '16px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: unlocked ? '#c8d8e8' : '#3a3a4a',
    }));

    // Description
    const desc = unlocked ? ach.desc : '???';
    container.add(this.add.text(52, cy + 28, desc, {
      fontSize: '13px', fontFamily: 'Nunito, sans-serif',
      color: unlocked ? '#6a8a6a' : '#2a3040',
    }));

    // Shard reward
    const rewardStr = `+${ach.shardReward}\u25c6`;
    container.add(this.add.text(scrollW - 30, cy + rowH / 2, rewardStr, {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif',
      color: unlocked ? '#7ec8e3' : '#2a3040',
    }).setOrigin(1, 0.5));

    // Avatar badge (if this achievement unlocks an avatar)
    const avatarMap: Record<string, string> = {
      first_blood: 'ranger', goblin_slayer: 'grunt', frost_conqueror: 'yeti',
      infernal_victor: 'demon_knight', conqueror: 'boss_grunt', ten_runs: 'mage',
      wrecking_ball: 'bomber', boss_rush: 'ranged', collector: 'priest',
      gold_hoarder: 'rogue', full_squad: 'paladin', event_explorer: 'druid',
    };
    if (avatarMap[ach.id]) {
      const avatarFrame = `${avatarMap[ach.id]}_idle_1`;
      if (this.textures.exists(avatarFrame)) {
        const badge = this.add.image(scrollW - 64, cy + rowH / 2, avatarFrame)
          .setDisplaySize(24, 24);
        if (!unlocked) badge.setTint(0x222222).setAlpha(0.4);
        container.add(badge);
      }
    }
  }

  // ── Back button ──────────────────────────────────────────────────────────
  private buildBackBtn() {
    buildBackButton(this, '\u2190 Back', ACCENT, () => {
      this._scrollPanel?.destroy();
      this._scrollPanel = null;
      this.cameras.main.fadeOut(200, 0, 0, 0, (_: unknown, p: number) => {
        if (p === 1) this.scene.start(this.callerKey);
      });
    }, 20, SAFE_AREA_LEFT);
  }
}
