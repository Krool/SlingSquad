import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config/constants';
import { getRunState, type NodeDef } from '@/systems/RunState';
import type { MusicSystem } from '@/systems/MusicSystem';
import { calcShardsEarned } from '@/systems/MetaState';
import { addXP } from '@/systems/MasterySystem';
import { recordRunEnd } from '@/systems/StatsTracker';
import { checkAchievements, incrementStat } from '@/systems/AchievementSystem';
import { recordDailyScore, getTodayString } from '@/systems/DailyChallenge';
import nodesData from '@/data/nodes.json';

interface ResultData {
  victory: boolean;
  reason?: string;
  gold?: number;
  nodeId?: number;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  create(data: ResultData) {
    const { victory, reason, gold = 0, nodeId } = data;
    (this.registry.get('music') as MusicSystem | null)?.play(victory ? 'victory' : 'defeat');
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Calculate shards earned this run
    let shardsEarned = 0;
    try {
      const run = getRunState();
      const nodesCompleted = run.completedNodeIds.size;
      const nodes = (nodesData as any).nodes as NodeDef[];
      const bossNode = nodes.find((n: NodeDef) => n.type === 'BOSS');
      const killedBoss = bossNode ? run.completedNodeIds.has(bossNode.id) : false;
      shardsEarned = calcShardsEarned({ nodesCompleted, killedBoss, victory });

      // Award mastery XP to each hero used
      for (const h of run.squad) {
        const xp = victory ? (h.currentHp > 0 ? 20 : 5) + 10 : 5;
        addXP(h.heroClass, xp);
      }

      // Record run stats
      incrementStat('runs_completed');
      incrementStat('total_gold', gold);
      recordRunEnd({
        mapId: run.currentMapId,
        squad: run.squad.map(h => h.heroClass),
        relicCount: run.relics.length,
        nodesCleared: nodesCompleted,
        gold: run.gold,
        victory,
        timestamp: Date.now(),
      });

      // Post-run achievement checks
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
    } catch { /* standalone */ }

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
      this.buildVictoryContent(cx, cy, reason, gold, shardsEarned);
    } else {
      this.buildDefeatContent(cx, cy, reason, shardsEarned);
    }
  }

  // ── Victory layout ────────────────────────────────────────────────────────
  private buildVictoryContent(cx: number, cy: number, reason?: string, gold = 0, shards = 0) {
    // Thin decorative rules that appear after title
    const divY1 = cy - 70, divY2 = cy + 30;
    const rules = this.add.graphics().setDepth(12).setAlpha(0);
    rules.lineStyle(1, 0xf1c40f, 0.35);
    rules.lineBetween(cx - 300, divY1, cx + 300, divY1);
    rules.lineBetween(cx - 300, divY2, cx + 300, divY2);
    // Small corner diamonds on the rules
    const drawDiamond = (gfx: Phaser.GameObjects.Graphics, dx: number, dy: number) => {
      gfx.fillStyle(0xf1c40f, 0.5);
      gfx.fillTriangle(dx - 5, dy, dx, dy - 5, dx + 5, dy);
      gfx.fillTriangle(dx - 5, dy, dx, dy + 5, dx + 5, dy);
    };
    for (const dy of [divY1, divY2]) {
      drawDiamond(rules, cx - 300, dy);
      drawDiamond(rules, cx + 300, dy);
    }

    // VICTORY — slides down from above
    const title = this.add.text(cx, cy - 110, 'VICTORY', {
      fontSize: '86px', fontFamily: 'Georgia, serif',
      color: '#f1c40f', stroke: '#5c3d00', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(15).setAlpha(0);
    this.tweens.add({
      targets: title, y: cy - 140, alpha: 1,
      duration: 600, ease: 'Back.easeOut', delay: 200,
      onComplete: () => this.tweens.add({ targets: rules, alpha: 1, duration: 350 }),
    });

    // Reason sub-text
    if (reason) {
      const rt = this.add.text(cx, cy - 42, reason, {
        fontSize: '19px', fontFamily: 'Georgia, serif', color: '#c8a840',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(15).setAlpha(0);
      this.tweens.add({ targets: rt, alpha: 1, duration: 350, delay: 780 });
    }

    // Gold reward — pops in with scale
    if (gold > 0) {
      const goldY = reason ? cy - 6 : cy - 28;
      const gt = this.add.text(cx, goldY, `✦  +${gold} Gold  ✦`, {
        fontSize: '28px', fontFamily: 'Georgia, serif', color: '#ffe070',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(15).setAlpha(0).setScale(1.4);
      this.tweens.add({
        targets: gt, alpha: 1, scaleX: 1, scaleY: 1,
        duration: 450, ease: 'Back.easeOut', delay: 920,
      });
    }

    // Shard earn display
    if (shards > 0) {
      const st = this.add.text(cx, cy + 74, `◆  +${shards} Shards`, {
        fontSize: '16px', fontFamily: 'Georgia, serif',
        color: '#7ec8e3', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(15).setAlpha(0);
      this.tweens.add({ targets: st, alpha: 1, duration: 350, delay: 1020 });
    }

    this.buildSquadSummary(cx, cy + (shards > 0 ? 108 : 92), 880);

    this.time.delayedCall(1100, () =>
      this.buildButton(cx, cy + 200, 'Continue to Map  →', 0x3a2800, 0xf1c40f, () => {
        this.cameras.main.fadeOut(350, 0, 0, 0, (_: unknown, p: number) => {
          if (p === 1) this.scene.start('OverworldScene', { fromBattle: true });
        });
      }),
    );
  }

  // ── Defeat layout ─────────────────────────────────────────────────────────
  private buildDefeatContent(cx: number, cy: number, reason?: string, shards = 0) {
    // Pulsing blood glow behind title
    const glow = this.add.graphics().setDepth(9).setAlpha(0);
    glow.fillStyle(0x8b0000, 0.22);
    glow.fillEllipse(cx, cy - 128, 740, 140);
    this.tweens.add({
      targets: glow, alpha: 1, duration: 600, delay: 200,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // DEFEAT — bleeds in
    const title = this.add.text(cx, cy - 130, 'DEFEAT', {
      fontSize: '86px', fontFamily: 'Georgia, serif',
      color: '#e74c3c', stroke: '#5a0000', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(15).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 650, ease: 'Power3', delay: 200 });

    if (reason) {
      const rt = this.add.text(cx, cy - 55, reason, {
        fontSize: '19px', fontFamily: 'Georgia, serif', color: '#c06860',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(15).setAlpha(0);
      this.tweens.add({ targets: rt, alpha: 1, duration: 350, delay: 760 });
    }

    // Shard earn display
    if (shards > 0) {
      const st = this.add.text(cx, cy - 15, `◆  +${shards} Shards earned`, {
        fontSize: '16px', fontFamily: 'Georgia, serif',
        color: '#7ec8e3', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(15).setAlpha(0);
      this.tweens.add({ targets: st, alpha: 1, duration: 350, delay: 820 });
    }

    this.buildSquadSummary(cx, cy + (shards > 0 ? 60 : 42), 720);

    this.time.delayedCall(880, () => {
      this.buildButton(cx - 115, cy + 178, 'Retry', 0x3a1010, 0xe74c3c, () => {
        this.cameras.main.fadeOut(300, 0, 0, 0, (_: unknown, p: number) => {
          if (p === 1) this.scene.start('BattleScene');
        });
      });
      this.buildButton(cx + 115, cy + 178, 'To Camp  ◆', 0x0d1a2e, 0x7ec8e3, () => {
        this.cameras.main.fadeOut(300, 0, 0, 0, (_: unknown, p: number) => {
          if (p === 1) this.scene.start('MainMenuScene', { shardsEarned: shards, fromDefeat: true });
        });
      });
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

  // ── Squad summary ─────────────────────────────────────────────────────────
  private buildSquadSummary(cx: number, cy: number, introDelay: number) {
    try {
      const run = getRunState();
      const heroColors: Record<string, number> = {
        WARRIOR: 0xc0392b, RANGER: 0x27ae60, MAGE: 0x8e44ad, PRIEST: 0xf39c12,
        BARD: 0x1abc9c, ROGUE: 0x2c3e50, PALADIN: 0xf1c40f, DRUID: 0x16a085,
      };
      const count = run.squad.length;
      const spacing = 100;
      const startX = cx - ((count - 1) * spacing) / 2;

      run.squad.forEach((h, i) => {
        const hx = startX + i * spacing;
        const col = heroColors[h.heroClass] ?? 0x888888;
        const pct = Math.max(0, h.currentHp / h.maxHp);
        const alive = h.currentHp > 0;

        const container = this.add.container(hx, cy + 16).setDepth(15).setAlpha(0);

        // Outer ring + filled circle background
        const g = this.add.graphics();
        g.fillStyle(col, alive ? 0.35 : 0.10);
        g.fillCircle(0, 0, 28);
        g.lineStyle(2, alive ? col : 0x3a3a3a, 1);
        g.strokeCircle(0, 0, 28);
        container.add(g);

        // Character portrait sprite
        const charImg = this.add.image(0, -2, `${h.heroClass.toLowerCase()}_idle_1`)
          .setDisplaySize(44, 44)
          .setAlpha(alive ? 1 : 0.28);
        container.add(charImg);

        // HP bar track + fill
        const bar = this.add.graphics();
        bar.fillStyle(0x1a2235, 1);
        bar.fillRoundedRect(-22, 33, 44, 6, 3);
        if (pct > 0) {
          bar.fillStyle(pct > 0.5 ? 0x2ecc71 : pct > 0.25 ? 0xf39c12 : 0xe74c3c, 1);
          bar.fillRoundedRect(-22, 33, Math.max(4, 44 * pct), 6, 3);
        }
        container.add(bar);

        // HP / fallen label
        container.add(
          this.add.text(0, 46, alive ? `${Math.round(h.currentHp)} hp` : 'fallen', {
            fontSize: '10px', color: alive ? '#8ca0b8' : '#4a2a2a',
            fontFamily: 'Georgia, serif',
          }).setOrigin(0.5),
        );

        // Staggered slide-up reveal
        this.tweens.add({
          targets: container, alpha: 1, y: cy,
          duration: 380, ease: 'Back.easeOut',
          delay: introDelay + i * 80,
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
        fontSize: '18px', fontFamily: 'Georgia, serif',
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
