import Phaser from 'phaser';
import { Hero } from '@/entities/Hero';
import { PORTRAIT_SIZE, PORTRAIT_PADDING, HUD_BAR_HEIGHT, GAME_WIDTH, GAME_HEIGHT, HERO_STATS, type HeroClass } from '@/config/constants';

export interface CooldownHeroInfo {
  heroClass: HeroClass;
  cooldownRemaining: number;
}

/** One slot in the HUD bar: either a live hero or a cooldown placeholder. */
export type SquadSlot =
  | { type: 'hero'; hero: Hero }
  | { type: 'cooldown'; info: CooldownHeroInfo };

const STATUS_COLOR: Record<string, number> = {
  queued:  0x2ecc71,  // green  — ready to launch
  flying:  0xf39c12,  // amber  — airborne
  combat:  0x3498db,  // blue   — fighting
  dead:    0x7f8c8d,  // gray   — eliminated
};


export class SquadUI {
  private scene: Phaser.Scene;
  private heroes: Hero[];
  private slots: SquadSlot[];

  private portraits:      Map<Hero, Phaser.GameObjects.Graphics> = new Map();
  private portraitSprites: Map<Hero, Phaser.GameObjects.Image>   = new Map();
  private statusDots:     Map<Hero, Phaser.GameObjects.Graphics> = new Map();
  private nameLabels:     Map<Hero, Phaser.GameObjects.Text>     = new Map();
  private goldBorder!: Phaser.GameObjects.Graphics;
  private prevNextHero: Hero | null = null;
  private borderPulseTween: Phaser.Tweens.Tween | null = null;
  private borderTransitioning = false;
  private bg: Phaser.GameObjects.Rectangle;
  private sep!: Phaser.GameObjects.Graphics;

  // Cooldown portrait elements (keyed by index since they're not Hero instances)
  private cdPortraits: Phaser.GameObjects.GameObject[] = [];

  // Positions of each slot for update()
  private slotPositions: number[] = [];

  constructor(scene: Phaser.Scene, heroes: Hero[], cooldownHeroes: CooldownHeroInfo[] = [], squadOrder?: HeroClass[]) {
    this.scene = scene;
    this.heroes = heroes;

    // Build interleaved slots in original squad order
    if (squadOrder && squadOrder.length > 0) {
      const heroMap = new Map<HeroClass, Hero[]>();
      for (const h of heroes) {
        const list = heroMap.get(h.heroClass) || [];
        list.push(h);
        heroMap.set(h.heroClass, list);
      }
      const cdMap = new Map<HeroClass, CooldownHeroInfo[]>();
      for (const cd of cooldownHeroes) {
        const list = cdMap.get(cd.heroClass) || [];
        list.push(cd);
        cdMap.set(cd.heroClass, list);
      }

      this.slots = [];
      for (const cls of squadOrder) {
        const heroList = heroMap.get(cls);
        if (heroList && heroList.length > 0) {
          this.slots.push({ type: 'hero', hero: heroList.shift()! });
        } else {
          const cdList = cdMap.get(cls);
          if (cdList && cdList.length > 0) {
            this.slots.push({ type: 'cooldown', info: cdList.shift()! });
          }
        }
      }
      // Append any extra heroes (from extraLaunches relic) not in squadOrder
      for (const [, list] of heroMap) {
        for (const h of list) this.slots.push({ type: 'hero', hero: h });
      }
    } else {
      // Fallback: heroes first, then cooldown
      this.slots = [
        ...heroes.map(h => ({ type: 'hero' as const, hero: h })),
        ...cooldownHeroes.map(info => ({ type: 'cooldown' as const, info })),
      ];
    }

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

    // Gold border — highlights the next-to-launch hero
    this.goldBorder = scene.add.graphics().setDepth(44).setAlpha(0);

    this.buildPortraits();
  }

  private buildPortraits() {
    const totalSlots = this.slots.length;
    const totalW = totalSlots * (PORTRAIT_SIZE + PORTRAIT_PADDING) - PORTRAIT_PADDING;
    let startX = (GAME_WIDTH - totalW) / 2 + PORTRAIT_SIZE / 2;
    const cy = GAME_HEIGHT - HUD_BAR_HEIGHT / 2;

    for (const slot of this.slots) {
      this.slotPositions.push(startX);
      if (slot.type === 'hero') {
        this.buildHeroPortrait(slot.hero, startX, cy);
      } else {
        this.buildCooldownPortrait(slot.info, startX, cy);
      }
      startX += PORTRAIT_SIZE + PORTRAIT_PADDING;
    }
  }

  private buildHeroPortrait(hero: Hero, startX: number, cy: number) {
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
    const classTint = Hero.CLASS_TINT[hero.heroClass];
    if (classTint) portraitSprite.setTint(classTint);

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

  private drawGoldBorder(x: number, cy: number) {
    this.goldBorder.clear();
    // Draw centered at (0,0) so setScale pivots around the portrait center
    const expand = 3;
    const half = PORTRAIT_SIZE / 2 + expand;
    // Outer glow
    this.goldBorder.lineStyle(5, 0xffd700, 0.2);
    this.goldBorder.strokeRoundedRect(-half - 1, -half - 1, half * 2 + 2, half * 2 + 2, 9);
    // Main border
    this.goldBorder.lineStyle(3, 0xffd700, 1);
    this.goldBorder.strokeRoundedRect(-half, -half, half * 2, half * 2, 8);
    // Position at portrait center
    this.goldBorder.setPosition(x, cy);
  }

  private startPulseTween() {
    this.borderPulseTween?.stop();
    this.goldBorder.setAlpha(1);
    this.borderPulseTween = this.scene.tweens.add({
      targets: this.goldBorder,
      alpha: { from: 1, to: 0.7 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  update() {
    const cy = GAME_HEIGHT - HUD_BAR_HEIGHT / 2;

    // Find the first queued hero — that's the "NEXT" to launch
    const nextHero = this.heroes.find(h => h.state === 'queued') ?? null;

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.type !== 'hero') continue;

      const hero   = slot.hero;
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
      const startX = this.slotPositions[i];
      this.drawStatusDot(
        dot,
        startX + PORTRAIT_SIZE / 2 - 8,
        cy - PORTRAIT_SIZE / 2 + 8,
        hero,
      );

    }

    // ── Gold border transition ───────────────────────────────────────────
    if (nextHero !== this.prevNextHero && !this.borderTransitioning) {
      this.prevNextHero = nextHero;
      this.borderPulseTween?.stop();
      this.borderPulseTween = null;

      if (!nextHero) {
        // No queued hero — fade out
        this.scene.tweens.add({
          targets: this.goldBorder,
          alpha: 0,
          duration: 150,
          ease: 'Power2',
        });
      } else {
        // Find slot position for the next hero
        const idx = this.slots.findIndex(s => s.type === 'hero' && s.hero === nextHero);
        if (idx >= 0) {
          const slotX = this.slotPositions[idx];
          this.borderTransitioning = true;

          // Fade out old border, then pop in on new position
          this.scene.tweens.add({
            targets: this.goldBorder,
            alpha: 0,
            duration: 150,
            ease: 'Power2',
            onComplete: () => {
              this.drawGoldBorder(slotX, cy);
              this.goldBorder.setScale(1.15);
              this.scene.tweens.add({
                targets: this.goldBorder,
                alpha: 1,
                scale: 1,
                duration: 250,
                ease: 'Back.easeOut',
                onComplete: () => {
                  this.borderTransitioning = false;
                  this.startPulseTween();
                },
              });
            },
          });
        }
      }
    }
  }

  destroy() {
    this.bg.destroy();
    this.sep.destroy();
    this.scene.tweens.killTweensOf(this.goldBorder);
    this.goldBorder.destroy();
    this.portraits.forEach(g => g.destroy());
    this.portraitSprites.forEach(s => s.destroy());
    this.nameLabels.forEach(t => t.destroy());
    this.statusDots.forEach(g => g.destroy());
    this.cdPortraits.forEach(o => o.destroy());
  }
}
