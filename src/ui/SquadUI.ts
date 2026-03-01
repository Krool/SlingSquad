import Phaser from 'phaser';
import { Hero } from '@/entities/Hero';
import { PORTRAIT_SIZE, PORTRAIT_PADDING, HUD_BAR_HEIGHT, GAME_WIDTH, GAME_HEIGHT, HERO_STATS, type HeroClass } from '@/config/constants';

export interface CooldownHeroInfo {
  heroClass: HeroClass;
  cooldownRemaining: number;
}

const STATUS_COLOR: Record<string, number> = {
  queued:  0x2ecc71,  // green  — ready to launch
  flying:  0xf39c12,  // amber  — airborne
  combat:  0x3498db,  // blue   — fighting
  dead:    0x7f8c8d,  // gray   — eliminated
};


export class SquadUI {
  private scene: Phaser.Scene;
  private heroes: Hero[];
  private cooldownHeroes: CooldownHeroInfo[];

  private portraits:      Map<Hero, Phaser.GameObjects.Graphics> = new Map();
  private portraitSprites: Map<Hero, Phaser.GameObjects.Image>   = new Map();
  private statusDots:     Map<Hero, Phaser.GameObjects.Graphics> = new Map();
  private nameLabels:     Map<Hero, Phaser.GameObjects.Text>     = new Map();
  private nextLabel!:  Phaser.GameObjects.Text;
  private bg: Phaser.GameObjects.Rectangle;
  private sep!: Phaser.GameObjects.Graphics;

  // Cooldown portrait elements (keyed by index since they're not Hero instances)
  private cdPortraits: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, heroes: Hero[], cooldownHeroes: CooldownHeroInfo[] = []) {
    this.scene = scene;
    this.heroes = heroes;
    this.cooldownHeroes = cooldownHeroes;

    // ── HUD bar background ─────────────────────────────────────────────────
    this.bg = scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT - HUD_BAR_HEIGHT / 2,
      GAME_WIDTH, HUD_BAR_HEIGHT,
      0x060b12, 0.92,
    ).setDepth(40);

    // Top separator line
    this.sep = scene.add.graphics().setDepth(40);
    this.sep.lineStyle(1, 0x1e3050, 0.8);
    this.sep.lineBetween(0, GAME_HEIGHT - HUD_BAR_HEIGHT, GAME_WIDTH, GAME_HEIGHT - HUD_BAR_HEIGHT);

    // "NEXT" label — floats above the queued hero portrait
    this.nextLabel = scene.add.text(0, 0, 'NEXT', {
      fontSize: '13px', fontFamily: 'Nunito, sans-serif',
      color: '#2ecc71', stroke: '#000', strokeThickness: 2,
      letterSpacing: 1,
    }).setOrigin(0.5).setDepth(44).setAlpha(0);

    this.buildPortraits();
  }

  private buildPortraits() {
    const totalSlots = this.heroes.length + this.cooldownHeroes.length;
    const totalW = totalSlots * (PORTRAIT_SIZE + PORTRAIT_PADDING) - PORTRAIT_PADDING;
    let startX = (GAME_WIDTH - totalW) / 2 + PORTRAIT_SIZE / 2;
    const cy = GAME_HEIGHT - HUD_BAR_HEIGHT / 2;

    for (const hero of this.heroes) {
      // ── Portrait background ──────────────────────────────────────────────
      const g = this.scene.add.graphics().setDepth(41);
      g.fillStyle(hero.stats.color, 1);
      g.fillRoundedRect(
        startX - PORTRAIT_SIZE / 2,
        cy - PORTRAIT_SIZE / 2,
        PORTRAIT_SIZE, PORTRAIT_SIZE, 7,
      );
      // Inner highlight sheen
      g.fillStyle(0xffffff, 0.07);
      g.fillRoundedRect(
        startX - PORTRAIT_SIZE / 2 + 3,
        cy - PORTRAIT_SIZE / 2 + 3,
        PORTRAIT_SIZE - 6, (PORTRAIT_SIZE - 6) * 0.45, 5,
      );
      // Border
      g.lineStyle(1, 0xffffff, 0.25);
      g.strokeRoundedRect(
        startX - PORTRAIT_SIZE / 2,
        cy - PORTRAIT_SIZE / 2,
        PORTRAIT_SIZE, PORTRAIT_SIZE, 7,
      );

      // ── Character portrait sprite ────────────────────────────────────────
      const charKey = hero.heroClass.toLowerCase();
      const portraitSprite = this.scene.add.image(startX, cy - 2, `${charKey}_idle_1`)
        .setDisplaySize(PORTRAIT_SIZE - 8, PORTRAIT_SIZE - 8)
        .setDepth(42);

      // ── Short class tag below portrait ────────────────────────────────────
      const nameTag = this.scene.add.text(
        startX, cy + PORTRAIT_SIZE / 2 - 14,
        hero.heroClass.slice(0, 3),
        { fontSize: '13px', fontFamily: 'Nunito, sans-serif', color: '#a0b8d0' },
      ).setOrigin(0.5).setDepth(43);

      // ── Status dot ───────────────────────────────────────────────────────
      const dot = this.scene.add.graphics().setDepth(43);
      this.drawStatusDot(dot, startX + PORTRAIT_SIZE / 2 - 8, cy - PORTRAIT_SIZE / 2 + 8, hero);

      this.portraits.set(hero, g);
      this.portraitSprites.set(hero, portraitSprite);
      this.nameLabels.set(hero, nameTag);
      this.statusDots.set(hero, dot);

      startX += PORTRAIT_SIZE + PORTRAIT_PADDING;
    }

    // ── Cooldown hero portraits ───────────────────────────────────────────
    for (const cd of this.cooldownHeroes) {
      this.buildCooldownPortrait(cd, startX, cy);
      startX += PORTRAIT_SIZE + PORTRAIT_PADDING;
    }
  }

  private buildCooldownPortrait(cd: CooldownHeroInfo, cx: number, cy: number) {
    const stats = HERO_STATS[cd.heroClass];
    const charKey = cd.heroClass.toLowerCase();

    // Dimmed portrait background
    const g = this.scene.add.graphics().setDepth(41);
    g.fillStyle(stats.color, 0.15);
    g.fillRoundedRect(cx - PORTRAIT_SIZE / 2, cy - PORTRAIT_SIZE / 2, PORTRAIT_SIZE, PORTRAIT_SIZE, 7);
    g.lineStyle(1, 0x555555, 0.4);
    g.strokeRoundedRect(cx - PORTRAIT_SIZE / 2, cy - PORTRAIT_SIZE / 2, PORTRAIT_SIZE, PORTRAIT_SIZE, 7);
    this.cdPortraits.push(g);

    // Grayed-out character sprite
    const sprite = this.scene.add.image(cx, cy - 2, `${charKey}_idle_1`)
      .setDisplaySize(PORTRAIT_SIZE - 8, PORTRAIT_SIZE - 8)
      .setDepth(42).setTint(0x444444).setAlpha(0.3);
    this.cdPortraits.push(sprite);

    // Dark overlay
    const overlay = this.scene.add.graphics().setDepth(42);
    overlay.fillStyle(0x000000, 0.45);
    overlay.fillRoundedRect(cx - PORTRAIT_SIZE / 2, cy - PORTRAIT_SIZE / 2, PORTRAIT_SIZE, PORTRAIT_SIZE, 7);
    this.cdPortraits.push(overlay);

    // Cooldown number
    const cdNum = this.scene.add.text(cx, cy - 4, `${cd.cooldownRemaining}`, {
      fontSize: '22px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#e74c3c', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(43);
    this.cdPortraits.push(cdNum);

    // "nodes" label
    const nodesLabel = this.scene.add.text(cx, cy + 12, 'nodes', {
      fontSize: '9px', fontFamily: 'Nunito, sans-serif',
      color: '#aa5555',
    }).setOrigin(0.5).setDepth(43);
    this.cdPortraits.push(nodesLabel);

    // Class tag at bottom
    const tag = this.scene.add.text(cx, cy + PORTRAIT_SIZE / 2 - 14, cd.heroClass.slice(0, 3), {
      fontSize: '13px', fontFamily: 'Nunito, sans-serif', color: '#555',
    }).setOrigin(0.5).setDepth(43).setAlpha(0.7);
    this.cdPortraits.push(tag);
  }

  private drawStatusDot(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number,
    hero: Hero,
  ) {
    g.clear();
    const col = STATUS_COLOR[hero.state] ?? 0x7f8c8d;
    // Outer glow ring
    g.fillStyle(col, 0.25);
    g.fillCircle(x, y, 8);
    // Inner solid dot
    g.fillStyle(col, 1);
    g.fillCircle(x, y, 5);
  }

  update() {
    const totalW = this.heroes.length * (PORTRAIT_SIZE + PORTRAIT_PADDING) - PORTRAIT_PADDING;
    const cy = GAME_HEIGHT - HUD_BAR_HEIGHT / 2;

    // Find the first queued hero — that's the "NEXT" to launch
    const nextHero = this.heroes.find(h => h.state === 'queued');

    for (let i = 0; i < this.heroes.length; i++) {
      const hero = this.heroes[i];
      const g      = this.portraits.get(hero);
      const dot    = this.statusDots.get(hero);
      const sprite = this.portraitSprites.get(hero);
      const tag    = this.nameLabels.get(hero);
      if (!g || !dot || !sprite || !tag) continue;

      const isDead   = hero.state === 'dead';
      const isFlying = hero.state === 'flying';

      // Portrait opacity
      const targetAlpha = isDead ? 0.22 : isFlying ? 0.55 : 1;
      g.setAlpha(targetAlpha);
      sprite.setAlpha(isDead ? 0.22 : 1);
      tag.setAlpha(isDead ? 0.22 : 0.7);

      // Redraw status dot
      const startX = (GAME_WIDTH - totalW) / 2 + PORTRAIT_SIZE / 2 + i * (PORTRAIT_SIZE + PORTRAIT_PADDING);
      this.drawStatusDot(
        dot,
        startX + PORTRAIT_SIZE / 2 - 8,
        cy - PORTRAIT_SIZE / 2 + 8,
        hero,
      );

      // Show NEXT label above the next-to-launch hero
      if (hero === nextHero) {
        this.nextLabel
          .setPosition(startX, cy - PORTRAIT_SIZE / 2 - 10)
          .setAlpha(1);
      }
    }

    // Hide NEXT label if no queued hero
    if (!nextHero) this.nextLabel.setAlpha(0);
  }

  destroy() {
    this.bg.destroy();
    this.sep.destroy();
    this.nextLabel.destroy();
    this.portraits.forEach(g => g.destroy());
    this.portraitSprites.forEach(s => s.destroy());
    this.nameLabels.forEach(t => t.destroy());
    this.statusDots.forEach(g => g.destroy());
    this.cdPortraits.forEach(o => o.destroy());
  }
}
