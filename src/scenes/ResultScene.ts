import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, HERO_STATS, MAX_RETRIES_PER_BATTLE, type HeroClass } from '@/config/constants';
import { getRunState, incrementRetries, selectHeroSkill, type NodeDef } from '@/systems/RunState';
import type { MusicSystem } from '@/systems/MusicSystem';
import { calcShardsEarned, getMetaBonuses } from '@/systems/MetaState';
import { addXP, addMVP } from '@/systems/MasterySystem';
import { finalizeRun, getGlobalStats } from '@/systems/RunHistory';
import { checkAchievements } from '@/systems/AchievementSystem';
import { calculateRunScore, type ScoreBreakdown } from '@/systems/ScoreSystem';
import { recordDailyScore, getTodayString } from '@/systems/DailyChallenge';
import { getSkillOptions, type SkillDef } from '@/data/skills';
import { Hero } from '@/entities/Hero';

interface HeroBattleStats {
  heroClass: string;
  damageDealt: number;
  impactDamage: number;
  blockDamage: number;
  enemiesKilled: number;
  healingDone: number;
}

interface LevelUpEntry {
  heroClass: HeroClass;
  tier: 1 | 2;
}

interface ResultData {
  victory: boolean;
  reason?: string;
  gold?: number;
  nodeId?: number;
  heroStats?: HeroBattleStats[];
  pendingLevelUps?: LevelUpEntry[];
  extraShards?: number;
  treasureRelicName?: string;
}

function mvpScore(s: HeroBattleStats): number {
  return s.damageDealt + s.enemiesKilled * 50 + s.healingDone;
}

/** Returns the index of the MVP hero, or -1 if none qualifies. */
function findMVP(heroStats: HeroBattleStats[] | undefined): number {
  if (!heroStats || heroStats.length <= 1) return -1;
  let bestScore = 0;
  let bestIndex = -1;
  heroStats.forEach((s, i) => {
    const score = mvpScore(s);
    if (score > bestScore) { bestScore = score; bestIndex = i; }
  });
  return bestIndex;
}

export class ResultScene extends Phaser.Scene {
  // Level-up state
  private levelUpQueue: LevelUpEntry[] = [];
  private levelUpIndex = 0;
  private levelUpPanel: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'ResultScene' });
  }

  create(data: ResultData) {
    const { victory, reason, gold = 0, nodeId, heroStats, pendingLevelUps, extraShards = 0, treasureRelicName } = data;
    (this.registry.get('music') as MusicSystem | null)?.play(victory ? 'victory' : 'defeat');
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.levelUpQueue = pendingLevelUps ?? [];
    this.levelUpIndex = 0;

    // Calculate shards earned this run + score
    let shardsEarned = 0;
    let scoreBreakdown: ScoreBreakdown | null = null;
    let isNewBest = false;
    try {
      const run = getRunState();
      const nodesCompleted = run.completedNodeIds.size;
      const bossNode = run.nodeMap.find((n: NodeDef) => n.type === 'BOSS');
      const killedBoss = bossNode ? run.completedNodeIds.has(bossNode.id) : false;
      shardsEarned = calcShardsEarned({ nodesCompleted, killedBoss, victory, ascensionLevel: run.ascensionLevel });
      // Add bonus shards from TREASURE node shard crystals
      shardsEarned += extraShards;
      // Add bonus shards from Shard Magnet meta upgrade
      shardsEarned += getMetaBonuses().bonusShardsPerRun;

      // Calculate score
      const completedNodes = run.nodeMap.filter(n => run.completedNodeIds.has(n.id));
      const prevBest = getGlobalStats().bestScore ?? 0;
      scoreBreakdown = calculateRunScore({
        completedNodes,
        victory,
        heroDeathsTotal: run.heroDeathsTotal ?? 0,
        ascensionLevel: run.ascensionLevel,
        modifiers: run.activeModifiers,
      });
      isNewBest = scoreBreakdown.final > prevBest;

      // Award mastery XP to each hero used (per-battle, cosmetic progression)
      for (const h of run.squad) {
        const xp = victory ? (h.currentHp > 0 ? 20 : 5) + 10 : 5;
        addXP(h.heroClass, xp);
      }

      // Track MVP for this battle
      const mvpIdx = findMVP(heroStats);
      if (mvpIdx >= 0) addMVP(heroStats![mvpIdx].heroClass as HeroClass);

      // Post-run achievement checks (some are battle-specific)
      checkAchievements({
        battlesWon: victory ? 1 : 0,
        mapCleared: victory ? run.currentMapId : undefined,
        relicCount: run.relics.length,
        curseCount: run.relics.filter(r => r.curse).length,
        goldTotal: run.gold,
        squadSize: run.squad.length,
      });

      // Daily challenge score
      if (run.isDailyChallenge) {
        recordDailyScore({
          date: getTodayString(),
          score: nodesCompleted * 100 + run.gold + (killedBoss ? 500 : 0),
          enemiesKilled: 0, // tracked in BattleScene but not passed here — approximate
          goldEarned: run.gold,
          nodesCleared: nodesCompleted,
        });
      }
    } catch (e) { console.warn('ResultScene: failed to read run state', e); }

    // ── Layered atmospheric overlay ─────────────────────────────────────────
    // Base blackout — fades in from transparent
    const dimRect = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setDepth(5).setAlpha(0);
    this.tweens.add({ targets: dimRect, alpha: victory ? 0.78 : 0.88, duration: 500 });

    // Directional tint: warm gold wash (victory) or cold blood bleed (defeat)
    const tint = this.add.graphics().setDepth(6).setAlpha(0);
    if (victory) {
      tint.fillGradientStyle(0xf1c40f, 0xf1c40f, 0x000000, 0x000000, 0.14, 0.14, 0, 0);
      tint.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.55);
    } else {
      tint.fillGradientStyle(0x3a0000, 0x3a0000, 0x000000, 0x000000, 0.55, 0.55, 0, 0);
      tint.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
    this.tweens.add({ targets: tint, alpha: 1, duration: 700, delay: 150 });

    if (victory) {
      this.spawnGoldParticles();
      this.buildVictoryContent(cx, reason, gold, shardsEarned, heroStats, treasureRelicName, scoreBreakdown, isNewBest);
    } else {
      this.buildDefeatContent(cx, reason, shardsEarned, heroStats, scoreBreakdown);
    }
  }

  // ── Victory layout ────────────────────────────────────────────────────────
  private buildVictoryContent(cx: number, reason?: string, gold = 0, shards = 0, heroStats?: HeroBattleStats[], relicName?: string, scoreBreakdown?: ScoreBreakdown | null, isNewBest = false) {
    // Thin decorative rule
    const ruleY = 88;
    const rules = this.add.graphics().setDepth(12).setAlpha(0);
    rules.lineStyle(1, 0xf1c40f, 0.35);
    rules.lineBetween(cx - 200, ruleY, cx + 200, ruleY);
    const drawDiamond = (gfx: Phaser.GameObjects.Graphics, dx: number, dy: number) => {
      gfx.fillStyle(0xf1c40f, 0.5);
      gfx.fillTriangle(dx - 5, dy, dx, dy - 5, dx + 5, dy);
      gfx.fillTriangle(dx - 5, dy, dx, dy + 5, dx + 5, dy);
    };
    drawDiamond(rules, cx - 200, ruleY);
    drawDiamond(rules, cx + 200, ruleY);

    // VICTORY — slides down from above
    const title = this.add.text(cx, 30, 'VICTORY', {
      fontSize: '56px', fontFamily: 'Knights Quest, Nunito, sans-serif',
      color: '#f1c40f', stroke: '#5c3d00', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(15).setAlpha(0);
    this.tweens.add({
      targets: title, y: 50, alpha: 1,
      duration: 600, ease: 'Back.easeOut', delay: 200,
      onComplete: () => this.tweens.add({ targets: rules, alpha: 1, duration: 350 }),
    });

    // Reason sub-text
    if (reason) {
      const rt = this.add.text(cx, 100, reason, {
        fontSize: '18px', fontFamily: 'Nunito, sans-serif', color: '#c8a840',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(15).setAlpha(0);
      this.tweens.add({ targets: rt, alpha: 1, duration: 350, delay: 780 });
    }

    // Track vertical cursor so elements don't overlap
    let cursorY = reason ? 126 : 106;

    // Gold + shards on one compact row (each in its own color)
    if (gold > 0 || shards > 0) {
      const rewardY = cursorY;
      const rc = this.add.container(cx, rewardY).setDepth(15).setAlpha(0).setScale(1.2);
      const items: Phaser.GameObjects.Text[] = [];
      if (gold > 0) {
        items.push(this.add.text(0, 0, `+\u25c6${gold} gold`, {
          fontSize: '22px', fontFamily: 'Nunito, sans-serif', color: '#f1c40f',
          stroke: '#000', strokeThickness: 3,
        }));
      }
      if (shards > 0) {
        items.push(this.add.text(0, 0, `\u25c6 +${shards} shards`, {
          fontSize: '22px', fontFamily: 'Nunito, sans-serif', color: '#7ec8e3',
          stroke: '#000', strokeThickness: 3,
        }));
      }
      const gap = 24;
      const totalW = items.reduce((s, t) => s + t.width, 0) + (items.length - 1) * gap;
      let rx = -totalW / 2;
      for (const item of items) {
        item.setPosition(rx, 0).setOrigin(0, 0.5);
        rc.add(item);
        rx += item.width + gap;
      }
      this.tweens.add({
        targets: rc, alpha: 1, scaleX: 1, scaleY: 1,
        duration: 450, ease: 'Back.easeOut', delay: 920,
      });
      cursorY += 28;
    }

    // Treasure relic name display
    if (relicName) {
      const rt2 = this.add.text(cx, cursorY, `Relic found: ${relicName}`, {
        fontSize: '20px', fontFamily: 'Nunito, sans-serif', color: '#f1c40f',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(15).setAlpha(0);
      this.tweens.add({ targets: rt2, alpha: 1, duration: 350, delay: 1020 });
      cursorY += 26;
    }

    // Score display
    if (scoreBreakdown && scoreBreakdown.final > 0) {
      const scoreY = cursorY + 4;
      const scoreText = `Score: ${scoreBreakdown.final.toLocaleString()}`;
      const st = this.add.text(cx, scoreY, scoreText, {
        fontSize: '28px', fontFamily: 'Knights Quest, Nunito, sans-serif',
        color: '#f1c40f', stroke: '#5c3d00', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(15).setAlpha(0);
      this.tweens.add({ targets: st, alpha: 1, duration: 400, delay: 1050 });

      if (isNewBest) {
        const badge = this.add.text(cx + st.width / 2 + 16, scoreY - 2, 'NEW BEST!', {
          fontSize: '16px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
          color: '#ff6b6b', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5).setDepth(15).setAlpha(0);
        this.tweens.add({
          targets: badge, alpha: 1, duration: 300, delay: 1200,
          onComplete: () => {
            this.tweens.add({ targets: badge, scaleX: 1.1, scaleY: 1.1, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          },
        });
      }
    }

    // Stats table starts below all header content
    const tableTop = Math.max(195, cursorY + 40);
    this.buildStatsTable(cx, tableTop, 880, heroStats, true);

    // If there are pending level-ups, show them before the continue button
    if (this.levelUpQueue.length > 0) {
      this.time.delayedCall(1100, () => this.showNextLevelUp());
    } else {
      this.time.delayedCall(1100, () => this.showContinueButton());
    }
  }

  // ── Continue button (shown after all level-ups or if none) ──────────────
  private showContinueButton() {
    const cx = GAME_WIDTH / 2;
    this.buildButton(cx, GAME_HEIGHT - 56, 'Continue to Map  \u2192', 0x3a2800, 0xf1c40f, () => {
      this.cameras.main.fadeOut(350, 0, 0, 0, (_: unknown, p: number) => {
        if (p === 1) this.scene.start('OverworldScene', { fromBattle: true });
      });
    });
  }

  // ── Level-up flow ──────────────────────────────────────────────────────────

  private showNextLevelUp() {
    // Destroy previous panel
    if (this.levelUpPanel) {
      this.levelUpPanel.destroy();
      this.levelUpPanel = null;
    }

    if (this.levelUpIndex >= this.levelUpQueue.length) {
      // All done — show continue button
      this.showContinueButton();
      return;
    }

    const entry = this.levelUpQueue[this.levelUpIndex];
    this.buildSkillPanel(entry.heroClass, entry.tier, this.levelUpIndex, this.levelUpQueue.length);
  }

  private buildSkillPanel(heroClass: HeroClass, tier: 1 | 2, index: number, total: number) {
    const cx = GAME_WIDTH / 2;
    const panelY = 440;
    const panelW = 520;
    const panelH = 160;

    const panel = this.add.container(cx, panelY).setDepth(25).setAlpha(0);
    this.levelUpPanel = panel;

    // Dark background with gold border
    const bg = this.add.graphics();
    bg.fillStyle(0x0d1520, 0.92);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    bg.lineStyle(2, 0xf1c40f, 0.6);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    panel.add(bg);

    // Hero portrait + name + level badge
    const charKey = heroClass.toLowerCase();
    const portrait = this.add.image(-panelW / 2 + 50, -20, `${charKey}_idle_1`)
      .setDisplaySize(52, 52);
    const classTint = Hero.CLASS_TINT[heroClass];
    if (classTint) portrait.setTint(classTint);
    panel.add(portrait);

    const stats = HERO_STATS[heroClass];
    const tierLabel = tier === 1 ? 'Level 1' : 'Level 2';
    const heroLabel = this.add.text(-panelW / 2 + 50, -panelH / 2 + 14, `${stats.label} \u2014 ${tierLabel}!`, {
      fontSize: '18px', fontFamily: 'Nunito, sans-serif',
      color: '#f1c40f', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0);
    panel.add(heroLabel);

    // Two skill cards side by side
    const [skillA, skillB] = getSkillOptions(heroClass, tier);
    const cardGap = 16;
    const cardW = 200;
    const cardX1 = -cardW / 2 - cardGap / 2;
    const cardX2 = cardW / 2 + cardGap / 2;

    this.buildSkillCard(panel, cardX1 + 30, 10, cardW, skillA, heroClass);
    this.buildSkillCard(panel, cardX2 + 30, 10, cardW, skillB, heroClass);

    // Hero counter
    if (total > 1) {
      const counter = this.add.text(0, panelH / 2 - 14, `${index + 1} / ${total} heroes`, {
        fontSize: '14px', fontFamily: 'Nunito, sans-serif',
        color: '#6a7a8a', stroke: '#000', strokeThickness: 1,
      }).setOrigin(0.5);
      panel.add(counter);
    }

    // Slide-up entrance
    this.tweens.add({
      targets: panel,
      alpha: 1,
      y: panelY,
      duration: 350,
      ease: 'Back.easeOut',
    });
  }

  private buildSkillCard(
    panel: Phaser.GameObjects.Container,
    x: number, y: number, w: number,
    skill: SkillDef, heroClass: HeroClass,
  ) {
    const h = 100;
    const card = this.add.container(x, y);

    const cardBg = this.add.graphics();
    const drawCardBg = (hovered: boolean) => {
      cardBg.clear();
      cardBg.fillStyle(hovered ? 0x2a1e40 : 0x161020, 1);
      cardBg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      cardBg.lineStyle(hovered ? 2 : 1, 0xf1c40f, hovered ? 0.9 : 0.35);
      cardBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    };
    drawCardBg(false);
    card.add(cardBg);

    // Icon + name
    card.add(this.add.text(0, -h / 2 + 14, `${skill.icon} ${skill.name}`, {
      fontSize: '16px', fontFamily: 'Nunito, sans-serif',
      color: '#f1c40f', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0));

    // Description
    card.add(this.add.text(0, -h / 2 + 38, skill.desc, {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif',
      color: '#b0c0d0', stroke: '#000', strokeThickness: 1,
      wordWrap: { width: w - 20 },
      align: 'center',
    }).setOrigin(0.5, 0));

    // Effect list
    const effectLines = Object.entries(skill.effects).map(([key, val]) => {
      const sign = val >= 0 ? '+' : '';
      return `${sign}${val} ${formatEffectKey(key)}`;
    });
    card.add(this.add.text(0, h / 2 - 14, effectLines.join('  '), {
      fontSize: '13px', fontFamily: 'Nunito, sans-serif',
      color: '#6a8a6a',
    }).setOrigin(0.5, 1));

    // Interactivity
    const hitArea = this.add.rectangle(0, 0, w, h).setAlpha(0.001);
    card.add(hitArea);
    hitArea.setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      drawCardBg(true);
      this.tweens.killTweensOf(card);
      this.tweens.add({ targets: card, scaleX: 1.04, scaleY: 1.04, duration: 80 });
    });
    hitArea.on('pointerout', () => {
      drawCardBg(false);
      this.tweens.killTweensOf(card);
      this.tweens.add({ targets: card, scaleX: 1, scaleY: 1, duration: 80 });
    });
    hitArea.on('pointerdown', () => {
      hitArea.disableInteractive();
      selectHeroSkill(heroClass, skill.id);

      // Gold flash on chosen card
      cardBg.clear();
      cardBg.fillStyle(0xf1c40f, 0.3);
      cardBg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      cardBg.lineStyle(2, 0xf1c40f, 1);
      cardBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

      this.tweens.add({
        targets: card, scaleX: 1.08, scaleY: 1.08,
        duration: 150, yoyo: true, ease: 'Power2',
      });

      this.levelUpIndex++;
      this.time.delayedCall(600, () => this.showNextLevelUp());
    });

    panel.add(card);
  }

  // ── Defeat layout ─────────────────────────────────────────────────────────
  private buildDefeatContent(cx: number, reason?: string, shards = 0, heroStats?: HeroBattleStats[], scoreBreakdown?: ScoreBreakdown | null) {
    // Pulsing blood glow behind title
    const glow = this.add.graphics().setDepth(9).setAlpha(0);
    glow.fillStyle(0x8b0000, 0.22);
    glow.fillEllipse(cx, 50, 600, 100);
    this.tweens.add({
      targets: glow, alpha: 1, duration: 600, delay: 200,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // DEFEAT — bleeds in
    const title = this.add.text(cx, 50, 'DEFEAT', {
      fontSize: '56px', fontFamily: 'Knights Quest, Nunito, sans-serif',
      color: '#e74c3c', stroke: '#5a0000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(15).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 650, ease: 'Power3', delay: 200 });

    if (reason) {
      const rt = this.add.text(cx, 100, reason, {
        fontSize: '18px', fontFamily: 'Nunito, sans-serif', color: '#c06860',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(15).setAlpha(0);
      this.tweens.add({ targets: rt, alpha: 1, duration: 350, delay: 760 });
    }

    // Shard earn display
    if (shards > 0) {
      const shardY = reason ? 130 : 110;
      const st = this.add.text(cx, shardY, `\u25c6 +${shards} shards`, {
        fontSize: '18px', fontFamily: 'Nunito, sans-serif',
        color: '#7ec8e3', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(15).setAlpha(0);
      this.tweens.add({ targets: st, alpha: 1, duration: 350, delay: 820 });
    }

    // Score display (smaller, dimmer on defeat)
    if (scoreBreakdown && scoreBreakdown.final > 0) {
      const scoreY = 155;
      const st2 = this.add.text(cx, scoreY, `Score: ${scoreBreakdown.final.toLocaleString()}`, {
        fontSize: '18px', fontFamily: 'Nunito, sans-serif',
        color: '#6a5a4a', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(15).setAlpha(0);
      this.tweens.add({ targets: st2, alpha: 1, duration: 350, delay: 860 });
    }

    this.buildStatsTable(cx, 178, 720, heroStats, false);

    this.time.delayedCall(880, () => {
      let canRetry = false;
      try { canRetry = getRunState().retriesUsed < MAX_RETRIES_PER_BATTLE; }
      catch (e) { console.warn('ResultScene: could not read retry state', e); }

      const goToCamp = () => {
        finalizeRun(false);
        this.cameras.main.fadeOut(300, 0, 0, 0, (_: unknown, p: number) => {
          if (p === 1) this.scene.start('MainMenuScene', { shardsEarned: shards, fromDefeat: true });
        });
      };

      if (canRetry) {
        this.buildButton(cx - 115, GAME_HEIGHT - 56, 'Retry', 0x3a1010, 0xe74c3c, () => {
          try { incrementRetries(); }
          catch (e) { console.warn('ResultScene: failed to increment retry', e); }
          this.cameras.main.fadeOut(300, 0, 0, 0, (_: unknown, p: number) => {
            if (p === 1) this.scene.start('BattleScene');
          });
        });
        this.buildButton(cx + 115, GAME_HEIGHT - 56, 'To Camp  \u25c6', 0x0d1a2e, 0x7ec8e3, goToCamp);
      } else {
        this.buildButton(cx, GAME_HEIGHT - 56, 'To Camp  \u25c6', 0x0d1a2e, 0x7ec8e3, goToCamp);
      }
    });
  }

  // ── Gold particle rain ────────────────────────────────────────────────────
  private spawnGoldParticles() {
    const cols = [0xf1c40f, 0xffe066, 0xffd700, 0xfff0a0, 0xe8b800];
    for (let i = 0; i < 24; i++) {
      this.time.delayedCall(Phaser.Math.Between(0, 2200), () => this.dropSpeck(cols));
      // Keep dripping every few seconds
      this.time.addEvent({
        delay: Phaser.Math.Between(2000, 3400),
        repeat: 6,
        callback: () => this.dropSpeck(cols),
      });
    }
  }

  private dropSpeck(colors: number[]) {
    const x = Phaser.Math.Between(60, GAME_WIDTH - 60);
    const size = Phaser.Math.Between(2, 7);
    const col = colors[Phaser.Math.Between(0, colors.length - 1)];
    const g = this.add.graphics().setDepth(8);
    g.fillStyle(col, 1);
    if (size >= 5) {
      // Diamond shape
      g.fillTriangle(-size, 0, 0, -size, size, 0);
      g.fillTriangle(-size, 0, 0, size, size, 0);
    } else {
      g.fillCircle(0, 0, size);
    }
    g.setPosition(x, -12);
    this.tweens.add({
      targets: g,
      y: GAME_HEIGHT + 12,
      alpha: { from: 0.85, to: 0 },
      angle: Phaser.Math.Between(-100, 100),
      duration: Phaser.Math.Between(2400, 4000),
      ease: 'Linear',
      onComplete: () => g.destroy(),
    });
  }

  // ── Stats table ─────────────────────────────────────────────────────────
  private buildStatsTable(cx: number, tableY: number, introDelay: number, heroStats?: HeroBattleStats[], isVictory = true) {
    try {
      const run = getRunState();
      const squad = run.squad;
      const count = squad.length;

      const tableW = 720;
      const labelColW = 80;
      const heroColW = (tableW - labelColW) / count;
      const headerH = 90;
      const rowH = 34;
      const statRowCount = 5;
      const tableH = headerH + rowH * statRowCount;
      const left = cx - tableW / 2;

      const mvpIndex = findMVP(heroStats);
      const mvpClass = mvpIndex >= 0 ? heroStats![mvpIndex].heroClass : null;

      // Comparative colors
      const bright = isVictory ? '#f1c40f' : '#e07060';
      const medium = '#8ca0b8';
      const dim = '#5a6a7a';
      const zero = '#2a3040';

      function rankColor(value: number, allValues: number[]): string {
        if (value === 0) return zero;
        const sorted = [...new Set(allValues.filter(v => v > 0))].sort((a, b) => b - a);
        if (sorted.length === 0) return zero;
        if (value === sorted[0]) return bright;
        if (sorted.length > 1 && value === sorted[1]) return medium;
        return dim;
      }

      // ── Dark panel background ───────────────────────────────────────
      const panel = this.add.graphics().setDepth(12).setAlpha(0);
      panel.fillStyle(0x0d1520, 0.85);
      panel.fillRoundedRect(left, tableY, tableW, tableH, 10);
      panel.lineStyle(1, isVictory ? 0xf1c40f : 0xe74c3c, 0.25);
      panel.strokeRoundedRect(left, tableY, tableW, tableH, 10);

      // Header separator
      panel.lineStyle(1, 0xffffff, 0.08);
      panel.lineBetween(left + 8, tableY + headerH, left + tableW - 8, tableY + headerH);

      // Alternating row shading
      for (let r = 0; r < statRowCount; r++) {
        if (r % 2 === 0) {
          panel.fillStyle(0xffffff, 0.03);
          panel.fillRect(left + 4, tableY + headerH + r * rowH, tableW - 8, rowH);
        }
      }

      this.tweens.add({ targets: panel, alpha: 1, duration: 400, delay: introDelay });

      // ── Per-hero stat entries for comparative coloring ──────────────
      const heroStatEntries = squad.map(h => heroStats?.find(s => s.heroClass === h.heroClass));
      type StatKey = 'impactDamage' | 'combatDamage' | 'blockDamage' | 'enemiesKilled' | 'healingDone';

      /** Get stat value — combatDamage is derived (total - impact). */
      function getStatValue(entry: HeroBattleStats, key: StatKey): number {
        if (key === 'combatDamage') return Math.max(0, entry.damageDealt - (entry.impactDamage ?? 0));
        return (entry as unknown as Record<string, number>)[key] ?? 0;
      }

      const statKeys: { key: StatKey; label: string; icon: string }[] = [
        { key: 'impactDamage', label: 'Impact', icon: '\ud83d\udca5' },
        { key: 'combatDamage', label: 'Combat', icon: '\u2694' },
        { key: 'blockDamage', label: 'Struct', icon: '\u25fc' },
        { key: 'enemiesKilled', label: 'Kills', icon: '\u2726' },
        { key: 'healingDone', label: 'Healed', icon: '\u2665' },
      ];

      // ── Header row (portraits, MVP badge, HP bars) ─────────────────
      const headerContainer = this.add.container(0, 0).setDepth(15).setAlpha(0);

      squad.forEach((h, i) => {
        const colCx = left + labelColW + heroColW * i + heroColW / 2;
        const onCooldown = (h.reviveCooldown ?? 0) > 0;
        const alive = h.currentHp > 0 && !onCooldown;
        const pct = onCooldown ? 0 : Math.max(0, h.currentHp / h.maxHp);

        // Portrait
        const portrait = this.add.image(colCx, tableY + 28, `${h.heroClass.toLowerCase()}_idle_1`)
          .setDisplaySize(44, 44);
        if (onCooldown || !alive) {
          portrait.setAlpha(0.3).setTint(0x555555);
        } else {
          const classTint = Hero.CLASS_TINT[h.heroClass as HeroClass];
          if (classTint) portrait.setTint(classTint);
        }
        headerContainer.add(portrait);

        // Badge line: MVP or cooldown
        if (h.heroClass === mvpClass) {
          headerContainer.add(
            this.add.text(colCx, tableY + 56, '\u2605 MVP', {
              fontSize: '14px', fontFamily: 'Nunito, sans-serif',
              color: '#ffd700', stroke: '#5c3d00', strokeThickness: 2,
            }).setOrigin(0.5),
          );
        } else if (onCooldown) {
          headerContainer.add(
            this.add.text(colCx, tableY + 56, `\u23f3 ${h.reviveCooldown}`, {
              fontSize: '14px', fontFamily: 'Nunito, sans-serif',
              color: '#e74c3c', stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5),
          );
        }

        // HP bar
        const barW = Math.min(heroColW - 16, 56);
        const barX = colCx - barW / 2;
        const barY = tableY + 72;
        const barG = this.add.graphics();
        barG.fillStyle(0x1a2235, 1);
        barG.fillRoundedRect(barX, barY, barW, 5, 2);
        if (pct > 0) {
          barG.fillStyle(pct > 0.5 ? 0x2ecc71 : pct > 0.25 ? 0xf39c12 : 0xe74c3c, 1);
          barG.fillRoundedRect(barX, barY, Math.max(4, barW * pct), 5, 2);
        }
        headerContainer.add(barG);
      });

      this.tweens.add({ targets: headerContainer, alpha: 1, duration: 380, delay: introDelay });

      // ── Stat rows (staggered reveal) ────────────────────────────────
      statKeys.forEach((stat, rowIdx) => {
        const rowY = tableY + headerH + rowIdx * rowH + rowH / 2;
        const rowContainer = this.add.container(0, 0).setDepth(15).setAlpha(0);

        // Row label
        rowContainer.add(
          this.add.text(left + labelColW / 2, rowY, `${stat.icon} ${stat.label}`, {
            fontSize: '16px', fontFamily: 'Nunito, sans-serif',
            color: '#6a7a8a', stroke: '#000', strokeThickness: 1,
          }).setOrigin(0.5),
        );

        // Gather values for comparative coloring
        const rowValues = heroStatEntries.map(e => (e ? getStatValue(e, stat.key) : 0));

        // Per-hero values
        squad.forEach((_h, i) => {
          const colCx = left + labelColW + heroColW * i + heroColW / 2;
          const entry = heroStatEntries[i];

          if (!entry) {
            // Hero wasn't in this battle (already on cooldown) — show dash
            rowContainer.add(
              this.add.text(colCx, rowY, '\u2014', {
                fontSize: '18px', fontFamily: 'Nunito, sans-serif',
                color: '#2a3040',
              }).setOrigin(0.5),
            );
          } else {
            const val = getStatValue(entry, stat.key);
            const color = rankColor(val, rowValues);
            rowContainer.add(
              this.add.text(colCx, rowY, `${val}`, {
                fontSize: '18px', fontFamily: 'Nunito, sans-serif',
                color, stroke: '#000', strokeThickness: 1,
              }).setOrigin(0.5),
            );
          }
        });

        this.tweens.add({
          targets: rowContainer, alpha: 1,
          duration: 300, delay: introDelay + 60 * (rowIdx + 1),
        });
      });
    } catch {
      // no run state — standalone launch
    }
  }

  // ── Button ────────────────────────────────────────────────────────────────
  private buildButton(
    x: number, y: number, label: string,
    bgColor: number, accentColor: number,
    onClick: () => void,
  ) {
    const w = 210, h = 46, r = 8;
    // Start slightly below final position for slide-up entrance
    const container = this.add.container(x, y + 20).setDepth(20).setAlpha(0);

    const drawBg = (hovered: boolean) => {
      bg.clear();
      if (hovered) {
        bg.fillStyle(accentColor, 0.22);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
        bg.lineStyle(2, accentColor, 1);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
      } else {
        bg.fillStyle(bgColor, 1);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
        bg.lineStyle(1, accentColor, 0.55);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
      }
    };

    const bg = this.add.graphics();
    drawBg(false);
    container.add(bg);

    container.add(
      this.add.text(0, 0, label, {
        fontSize: '20px', fontFamily: 'Nunito, sans-serif',
        color: '#' + accentColor.toString(16).padStart(6, '0'),
      }).setOrigin(0.5),
    );

    container.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on('pointerover', () => {
      drawBg(true);
      this.tweens.killTweensOf(container);
      this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 80 });
    });
    container.on('pointerout', () => {
      drawBg(false);
      this.tweens.killTweensOf(container);
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 80 });
    });
    container.on('pointerdown', onClick);

    // Slide-up entrance
    this.tweens.add({ targets: container, alpha: 1, y, duration: 320, ease: 'Back.easeOut' });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatEffectKey(key: string): string {
  const map: Record<string, string> = {
    maxHpBonus: 'HP',
    combatDamageMult: 'melee',
    combatSpeedMult: 'atk speed',
    walkSpeedMult: 'walk speed',
    impactMultBonus: 'impact',
    damageReduction: 'DR',
    arrowCountBonus: 'arrows',
    aoeRadiusBonus: 'AoE px',
    chainTargetBonus: 'chain',
    clusterCountBonus: 'bomblets',
    healAmountBonus: 'heal',
    healRadiusBonus: 'heal radius',
    charmRadiusBonus: 'charm radius',
    charmDurationBonus: 'charm ms',
    piercingBonus: 'pierce',
    backstabMult: 'backstab',
    shieldWallBonus: 'blocks',
    wolfCountBonus: 'wolves',
    wolfDamageBonus: 'wolf dmg',
    gravityScaleBonus: 'gravity',
  };
  return map[key] ?? key;
}
