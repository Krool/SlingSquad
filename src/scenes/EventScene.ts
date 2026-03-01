import Phaser from 'phaser';
import eventsData from '@/data/events.json';
import relicsData from '@/data/relics.json';
import cursesData from '@/data/curses.json';
import {
  getRunState, addRelic, spendGold, completeNode, removeRelic, upgradeRelic,
  getCurses, getNonCurseRelics, reduceCooldown, getHeroesOnCooldown,
  type NodeDef, type RelicDef,
} from '@/systems/RunState';
import type { MusicSystem } from '@/systems/MusicSystem';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config/constants';
import { discoverRelic } from '@/systems/DiscoveryLog';
import { checkAchievements, incrementStat } from '@/systems/AchievementSystem';
import { getShards } from '@/systems/MetaState';
import { buildSettingsGear, buildCurrencyBar, type CurrencyBarResult } from '@/ui/TopBar';

// ── Types mirroring events.json ────────────────────────────────────────────────
interface EventOutcome {
  type: string;
  cost?: number;
  gold?: number;
  rarity?: string;
  relicId?: string;
  hpCost?: number;
  reward?: number;
}

interface EventChoice {
  label: string;
  desc: string;
  outcome: EventOutcome;
}

interface EventDef {
  id: string;
  name: string;
  text: string;
  choices: EventChoice[];
}

// ── Color theme ────────────────────────────────────────────────────────────────
const ACCENT = 0x9b59b6;
const ACCENT_HEX = '#9b59b6';
const BG_COLOR = 0x0a0812;

export class EventScene extends Phaser.Scene {
  private node!: NodeDef;
  private event!: EventDef;
  private _goldBar: CurrencyBarResult | null = null;

  constructor() {
    super({ key: 'EventScene' });
  }

  create(data: { node: NodeDef }) {
    (this.registry.get('music') as MusicSystem | null)?.play('event');
    this.node = data.node;

    completeNode(this.node.id);

    // Pick a random event
    const pool = eventsData as EventDef[];
    this.event = Phaser.Utils.Array.GetRandom(pool);

    this.buildBackground();
    buildSettingsGear(this, 'EventScene');
    buildCurrencyBar(this, 'shard', () => getShards(), 10, 0);
    this._goldBar = buildCurrencyBar(this, 'gold', () => getRunState().gold, 10, 1);
    this.buildTitle();
    this.buildNarrative();
    this.buildChoices();

    this.cameras.main.fadeIn(300, 0, 0, 0);

    this.events.on('resume', () => {
      this._goldBar?.updateValue();
    });
  }

  private refreshGoldHUD() {
    this._goldBar?.updateValue();
  }

  // ── Background ─────────────────────────────────────────────────────────────
  private buildBackground() {
    const bg = this.add.graphics();
    bg.fillStyle(BG_COLOR, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Mystical particle dots
    bg.fillStyle(0x4a2680, 0.3);
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const y = Phaser.Math.Between(0, GAME_HEIGHT);
      bg.fillCircle(x, y, Math.random() < 0.3 ? 2 : 1);
    }

    // Top glow
    const glow = this.add.graphics().setDepth(1).setAlpha(0.5);
    glow.fillGradientStyle(ACCENT, ACCENT, 0x000000, 0x000000, 0.25, 0.25, 0, 0);
    glow.fillRect(0, 0, GAME_WIDTH, 220);

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
    // Event icon
    const iconBg = this.add.graphics().setDepth(5);
    iconBg.fillStyle(ACCENT, 0.2);
    iconBg.fillCircle(GAME_WIDTH / 2, 72, 30);
    iconBg.lineStyle(1, ACCENT, 0.5);
    iconBg.strokeCircle(GAME_WIDTH / 2, 72, 30);

    this.add.text(GAME_WIDTH / 2, 72, '?', {
      fontSize: '36px', fontFamily: 'Nunito, sans-serif',
      color: ACCENT_HEX, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(6);

    // Event name
    this.add.text(GAME_WIDTH / 2, 122, this.event.name, {
      fontSize: '36px', fontFamily: 'Cinzel, Nunito, sans-serif',
      color: '#e8d8f0', stroke: '#000', strokeThickness: 4,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(5);

    // Rule
    const rule = this.add.graphics().setDepth(5);
    rule.lineStyle(1, ACCENT, 0.3);
    rule.lineBetween(GAME_WIDTH / 2 - 200, 145, GAME_WIDTH / 2 + 200, 145);
  }

  private buildNarrative() {
    this.add.text(GAME_WIDTH / 2, 186, this.event.text, {
      fontSize: '20px', fontFamily: 'Nunito, sans-serif',
      color: '#9a8aaa', fontStyle: 'italic',
      wordWrap: { width: 700 }, align: 'center',
    }).setOrigin(0.5).setDepth(5);
  }

  // ── Outcome badge helper ────────────────────────────────────────────────────
  private getOutcomeBadge(outcome: EventOutcome): { text: string; color: number } {
    switch (outcome.type) {
      case 'NOTHING':
        return { text: 'Safe', color: 0x555555 };
      case 'RELIC_AND_CURSE':
        return { text: 'Relic + Curse', color: 0xe67e22 };
      case 'BUY_RELIC':
        return { text: `◆${outcome.cost ?? 0} \u2192 Relic`, color: 0x3498db };
      case 'FREE_RELIC':
        return { text: '\u2726 Free Relic', color: 0x2ecc71 };
      case 'GOLD_AND_CURSE':
        return { text: `+◆${outcome.gold ?? 0} + Curse`, color: 0xe67e22 };
      case 'GOLD':
        return { text: `+◆${outcome.gold ?? 0}`, color: 0x2ecc71 };
      case 'REMOVE_CURSE':
        return { text: '\u2726 Cleanse', color: 0x9b59b6 };
      case 'UPGRADE_RELIC':
        return { text: '\u25b2 Upgrade', color: 0x3498db };
      case 'SPECIFIC_RELIC': {
        const all = relicsData as RelicDef[];
        const r = all.find(x => x.id === outcome.relicId);
        return { text: `\u2726 ${r ? r.name : 'Relic'}`, color: 0x2ecc71 };
      }
      case 'HP_COST_RELIC':
        return { text: `-${outcome.hpCost ?? 0} HP \u2192 Relic`, color: 0xe74c3c };
      case 'GAMBLE':
        return { text: '\u2726 50/50', color: 0xf39c12 };
      case 'TRADE_RELIC':
        return { text: '\u27f3 Trade', color: 0x3498db };
      case 'HEAL_ALL':
        return { text: '\u2665 Full Heal', color: 0x2ecc71 };
      case 'BUY_UPGRADE':
        return { text: `◆${outcome.cost ?? 0} \u2192 Upgrade`, color: 0x3498db };
      case 'REDUCE_COOLDOWN':
        return { text: '\u231b Rally Fallen', color: 0x2ecc71 };
      default:
        return { text: '...', color: 0x555555 };
    }
  }

  // ── Choice buttons ───────────────────────────────────────────────────────────
  private buildChoices() {
    const choices = this.event.choices;
    const btnW = 520, btnH = 80;
    const gap = 16;
    const totalH = choices.length * btnH + (choices.length - 1) * gap;
    const startY = 260 + (GAME_HEIGHT - 260 - 60 - totalH) / 2;

    choices.forEach((choice, i) => {
      const cy = startY + i * (btnH + gap) + btnH / 2;
      this.buildChoiceButton(GAME_WIDTH / 2, cy, btnW, btnH, choice, i);
    });
  }

  private buildChoiceButton(
    cx: number, cy: number, w: number, h: number,
    choice: EventChoice, idx: number,
  ) {
    const canChoose = this.canAffordChoice(choice);
    const container = this.add.container(cx, cy + 40).setDepth(5).setAlpha(0);

    const bg = this.add.graphics();
    const drawBg = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(hovered ? 0x1e1430 : 0x120e1e, canChoose ? 1 : 0.6);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.lineStyle(hovered ? 2 : 1, ACCENT, canChoose ? (hovered ? 0.9 : 0.5) : 0.15);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    };
    drawBg(false);
    container.add(bg);

    // Label
    container.add(
      this.add.text(-w / 2 + 20, -16, choice.label, {
        fontSize: '22px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
        color: canChoose ? '#e8d8f0' : '#8a8a9a',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0, 0.5),
    );

    // Description
    container.add(
      this.add.text(-w / 2 + 20, 10, choice.desc, {
        fontSize: '16px', fontFamily: 'Nunito, sans-serif',
        color: canChoose ? '#8a7a9a' : '#6a6a7a',
      }).setOrigin(0, 0.5),
    );

    // Outcome badge (replaces arrow)
    const badge = this.getOutcomeBadge(choice.outcome);
    const badgeText = this.add.text(0, 0, badge.text, {
      fontSize: '15px', fontFamily: 'Nunito, sans-serif',
      color: '#' + badge.color.toString(16).padStart(6, '0'),
    }).setOrigin(0.5);
    const badgePadX = 10, badgePadY = 4;
    const bw = badgeText.width + badgePadX * 2;
    const bh = badgeText.height + badgePadY * 2;
    const badgeX = w / 2 - 16 - bw / 2;
    badgeText.setPosition(badgeX, 0);

    const badgeGfx = this.add.graphics();
    badgeGfx.fillStyle(badge.color, 0.2);
    badgeGfx.fillRoundedRect(badgeX - bw / 2, -bh / 2, bw, bh, 6);
    badgeGfx.lineStyle(1, badge.color, 0.5);
    badgeGfx.strokeRoundedRect(badgeX - bw / 2, -bh / 2, bw, bh, 6);
    if (!canChoose) {
      badgeGfx.setAlpha(0.3);
      badgeText.setAlpha(0.3);
    }
    container.add(badgeGfx);
    container.add(badgeText);

    // Interactivity
    if (canChoose) {
      const hitArea = new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h);
      container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

      container.on('pointerover', () => {
        drawBg(true);
        this.tweens.killTweensOf(container);
        this.tweens.add({ targets: container, x: cx + 4, duration: 100 });
      });
      container.on('pointerout', () => {
        drawBg(false);
        this.tweens.killTweensOf(container);
        this.tweens.add({ targets: container, x: cx, duration: 100 });
      });
      container.on('pointerdown', () => {
        container.disableInteractive();
        this.processOutcome(choice.outcome);
      });
    }

    // Entrance animation
    this.tweens.add({
      targets: container,
      y: cy, alpha: 1,
      duration: 350, ease: 'Back.easeOut',
      delay: 200 + idx * 100,
    });
  }

  private canAffordChoice(choice: EventChoice): boolean {
    const run = getRunState();
    const o = choice.outcome;
    if (o.cost && o.cost > 0 && run.gold < o.cost) return false;
    if (o.type === 'REMOVE_CURSE' && getCurses().length === 0) return false;
    if (o.type === 'UPGRADE_RELIC' && getNonCurseRelics().filter(r => (r.rarity ?? 'common') === 'common').length === 0) return false;
    if (o.type === 'TRADE_RELIC' && getNonCurseRelics().filter(r => (r.rarity ?? 'common') === 'common').length === 0) return false;
    if (o.type === 'REDUCE_COOLDOWN' && getHeroesOnCooldown().length === 0) return false;
    return true;
  }

  // ── Outcome processing ───────────────────────────────────────────────────────
  private processOutcome(outcome: EventOutcome) {
    const run = getRunState();
    let resultText = '';

    switch (outcome.type) {
      case 'NOTHING':
        resultText = 'You move on.';
        break;

      case 'RELIC_AND_CURSE': {
        const rarity = (outcome.rarity as 'common' | 'uncommon' | 'rare') ?? 'common';
        const relic = this.getRandomRelic(rarity);
        const curse = this.getRandomCurse();
        if (relic) { this.addRelicTracked(relic); resultText = `Gained: ${relic.name}`; }
        if (curse) { this.addRelicTracked(curse); resultText += `\nCursed: ${curse.name}`; }
        if (!relic && !curse) resultText = 'Nothing happened...';
        break;
      }

      case 'BUY_RELIC': {
        if (outcome.cost && outcome.cost > 0) {
          if (!spendGold(outcome.cost)) { resultText = 'Not enough ◆!'; break; }
        }
        const rarity = (outcome.rarity as 'common' | 'uncommon' | 'rare') ?? 'common';
        const relic = this.getRandomRelic(rarity);
        if (relic) { this.addRelicTracked(relic); resultText = `Gained: ${relic.name}`; }
        else resultText = 'Nothing suitable was found.';
        break;
      }

      case 'FREE_RELIC': {
        const rarity = (outcome.rarity as 'common' | 'uncommon' | 'rare') ?? 'common';
        const relic = this.getRandomRelic(rarity);
        if (relic) { this.addRelicTracked(relic); resultText = `Gained: ${relic.name}`; }
        else resultText = 'Nothing suitable was found.';
        break;
      }

      case 'GOLD_AND_CURSE': {
        const gold = outcome.gold ?? 0;
        run.gold += gold;
        const curse = this.getRandomCurse();
        resultText = `+◆${gold}`;
        if (curse) { this.addRelicTracked(curse); resultText += `\nCursed: ${curse.name}`; }
        break;
      }

      case 'GOLD': {
        const gold = outcome.gold ?? 0;
        run.gold += gold;
        resultText = `+◆${gold}`;
        break;
      }

      case 'REMOVE_CURSE': {
        const curses = getCurses();
        if (curses.length > 0) {
          const curse = Phaser.Utils.Array.GetRandom(curses);
          removeRelic(curse.id);
          resultText = `Removed curse: ${curse.name}`;
        } else {
          resultText = 'You have no curses.';
        }
        break;
      }

      case 'UPGRADE_RELIC': {
        const commons = getNonCurseRelics().filter(r => (r.rarity ?? 'common') === 'common');
        if (commons.length > 0) {
          const relic = Phaser.Utils.Array.GetRandom(commons);
          upgradeRelic(relic.id);
          resultText = `Upgraded: ${relic.name}`;
        } else {
          resultText = 'No eligible relics.';
        }
        break;
      }

      case 'SPECIFIC_RELIC': {
        const all = relicsData as RelicDef[];
        const relic = all.find(r => r.id === outcome.relicId);
        if (relic) { this.addRelicTracked({ ...relic }); resultText = `Gained: ${relic.name}`; }
        else resultText = 'Nothing happened...';
        break;
      }

      case 'HP_COST_RELIC': {
        const cost = outcome.hpCost ?? 0;
        for (const hero of run.squad) {
          hero.currentHp = Math.max(1, hero.currentHp - cost);
        }
        const rarity = (outcome.rarity as 'common' | 'uncommon' | 'rare') ?? 'rare';
        const relic = this.getRandomRelic(rarity);
        resultText = `All heroes lost ${cost} HP.`;
        if (relic) { this.addRelicTracked(relic); resultText += `\nGained: ${relic.name}`; }
        break;
      }

      case 'GAMBLE': {
        const cost = outcome.cost ?? 0;
        const reward = outcome.reward ?? 0;
        if (!spendGold(cost)) { resultText = 'Not enough ◆!'; break; }
        if (Math.random() < 0.5) {
          run.gold += reward;
          resultText = `Won +◆${reward}!`;
        } else {
          resultText = `Lost ◆${cost}...`;
        }
        break;
      }

      case 'TRADE_RELIC': {
        const commons = getNonCurseRelics().filter(r => (r.rarity ?? 'common') === 'common');
        if (commons.length > 0) {
          const given = Phaser.Utils.Array.GetRandom(commons);
          removeRelic(given.id);
          const gained = this.getRandomRelic('uncommon');
          resultText = `Traded: ${given.name}`;
          if (gained) { this.addRelicTracked(gained); resultText += `\nGained: ${gained.name}`; }
        } else {
          resultText = 'No common relics to trade.';
        }
        break;
      }

      case 'HEAL_ALL': {
        for (const hero of run.squad) {
          hero.currentHp = hero.maxHp;
          hero.reviveCooldown = 0; // also clears revive cooldown
        }
        resultText = 'All heroes healed to full HP!';
        break;
      }

      case 'REDUCE_COOLDOWN': {
        const onCooldown = getHeroesOnCooldown();
        if (onCooldown.length > 0) {
          for (const h of onCooldown) {
            reduceCooldown(h.heroClass, 1);
          }
          resultText = 'All revive cooldowns reduced by 1!';
        } else {
          resultText = 'No heroes on cooldown.';
        }
        break;
      }

      case 'BUY_UPGRADE': {
        if (outcome.cost && outcome.cost > 0) {
          if (!spendGold(outcome.cost)) { resultText = 'Not enough ◆!'; break; }
        }
        const relics = getNonCurseRelics();
        if (relics.length > 0) {
          const relic = Phaser.Utils.Array.GetRandom(relics);
          upgradeRelic(relic.id);
          resultText = `Upgraded: ${relic.name}`;
        } else {
          resultText = 'No relics to upgrade.';
        }
        break;
      }

      default:
        resultText = 'Nothing happened.';
    }

    // Track event visit + check achievements
    incrementStat('events_visited');
    checkAchievements({ relicCount: run.relics.length, curseCount: run.relics.filter(r => r.curse).length });

    this.showResult(resultText);
  }

  /** addRelic + discovery tracking in one call */
  private addRelicTracked(relic: RelicDef) {
    addRelic(relic);
    discoverRelic(relic.id);
  }

  // ── Relic / Curse helpers ────────────────────────────────────────────────────
  private getRandomRelic(rarity: string): RelicDef | null {
    const owned = new Set(getRunState().relics.map(r => r.id));
    const pool = (relicsData as RelicDef[]).filter(
      r => !owned.has(r.id) && (r.rarity ?? 'common') === rarity && !r.curse,
    );
    if (pool.length === 0) {
      // Fall back to any unowned non-curse relic
      const fallback = (relicsData as RelicDef[]).filter(r => !owned.has(r.id) && !r.curse);
      return fallback.length > 0 ? { ...Phaser.Utils.Array.GetRandom(fallback) } : null;
    }
    return { ...Phaser.Utils.Array.GetRandom(pool) };
  }

  private getRandomCurse(): RelicDef | null {
    const owned = new Set(getRunState().relics.map(r => r.id));
    const pool = (cursesData as RelicDef[]).filter(r => !owned.has(r.id));
    if (pool.length === 0) return null;
    return { ...Phaser.Utils.Array.GetRandom(pool) };
  }

  // ── Result overlay ───────────────────────────────────────────────────────────
  private getResultIcon(text: string): { icon: string; color: string } {
    const t = text.toLowerCase();
    if (t.includes('lost') || t.includes('not enough')) return { icon: '\u2717', color: '#e74c3c' };
    if (t.includes('curse')) return { icon: '\u26a0', color: '#e67e22' };
    if (t.includes('upgraded')) return { icon: '\u25b2', color: '#3498db' };
    if (t.includes('removed')) return { icon: '\u2726', color: '#9b59b6' };
    if (t.includes('heal')) return { icon: '\u2665', color: '#2ecc71' };
    if (t.includes('◆') && !t.includes('not enough')) return { icon: '\u25c6', color: '#f1c40f' };
    if (t.includes('gained') || t.includes('relic')) return { icon: '\u2726', color: '#2ecc71' };
    return { icon: '\u25cf', color: '#ffffff' };
  }

  private showResult(text: string) {
    this.refreshGoldHUD();

    const veil = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setDepth(20).setAlpha(0);
    this.tweens.add({ targets: veil, alpha: 0.6, duration: 300 });

    const panel = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(21).setAlpha(0);

    const panelW = 420, panelH = 200;
    const bg = this.add.graphics();
    bg.fillStyle(0x120e1e, 1);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    bg.lineStyle(2, ACCENT, 0.7);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    panel.add(bg);

    // Result icon
    const resultIcon = this.getResultIcon(text);
    panel.add(
      this.add.text(0, -55, resultIcon.icon, {
        fontSize: '32px', fontFamily: 'Nunito, sans-serif',
        color: resultIcon.color, stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5),
    );

    // Result text
    panel.add(
      this.add.text(0, -20, text, {
        fontSize: '19px', fontFamily: 'Nunito, sans-serif',
        color: '#e8d8f0', stroke: '#000', strokeThickness: 2,
        wordWrap: { width: panelW - 40 }, align: 'center',
      }).setOrigin(0.5),
    );

    // Continue button
    const btnW = 200, btnH = 42;
    const btnGfx = this.add.graphics();
    const drawBtn = (hovered: boolean) => {
      btnGfx.clear();
      btnGfx.fillStyle(hovered ? 0x2a1e40 : 0x1a1228, 1);
      btnGfx.fillRoundedRect(-btnW / 2, 50, btnW, btnH, 7);
      btnGfx.lineStyle(1, ACCENT, hovered ? 0.9 : 0.5);
      btnGfx.strokeRoundedRect(-btnW / 2, 50, btnW, btnH, 7);
    };
    drawBtn(false);
    panel.add(btnGfx);

    const btnText = this.add.text(0, 71, 'Continue  \u2192', {
      fontSize: '18px', fontFamily: 'Nunito, sans-serif', color: ACCENT_HEX,
    }).setOrigin(0.5);
    panel.add(btnText);

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

  private goToOverworld() {
    this.cameras.main.fadeOut(300, 0, 0, 0, (_: unknown, progress: number) => {
      if (progress === 1) this.scene.start('OverworldScene', { fromBattle: false });
    });
  }
}
