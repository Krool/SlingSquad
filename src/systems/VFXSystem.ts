import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config/constants';

/**
 * VFXSystem — Ambient atmosphere + combat visual effects.
 * Instantiated per BattleScene.create(), destroyed on scene shutdown.
 */
export class VFXSystem {
  private scene: Phaser.Scene;
  private difficulty: number;

  // ── Twinkling Stars ─────────────────────────────────────────────────────────
  private stars: { gfx: Phaser.GameObjects.Graphics; phase: number; speed: number }[] = [];

  // ── Shooting Stars ──────────────────────────────────────────────────────────
  private shootingStarTimer = 0;
  private shootingStarInterval = 0;
  private shootingStarActive = false;

  // ── Floating Particles ──────────────────────────────────────────────────────
  private floatingParticles: {
    gfx: Phaser.GameObjects.Graphics;
    baseX: number;
    y: number;
    startY: number;
    drift: number;
    phase: number;
    lifetime: number;
    elapsed: number;
    riseSpeed: number;
  }[] = [];
  private floatSpawnTimer = 0;
  private readonly MAX_FLOAT_PARTICLES = 15;

  constructor(scene: Phaser.Scene, difficulty: number) {
    this.scene = scene;
    this.difficulty = difficulty;
    this.shootingStarInterval = Phaser.Math.Between(3000, 8000);
    this.initStars();
    scene.events.once('shutdown', () => this.destroy());
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AMBIENT — driven by update(delta)
  // ═══════════════════════════════════════════════════════════════════════════

  private initStars() {
    for (let i = 0; i < 60; i++) {
      const sx = Phaser.Math.Between(0, GAME_WIDTH);
      const sy = Phaser.Math.Between(0, GAME_HEIGHT * 0.55);
      const r = Math.random() < 0.15 ? 2 : 1;
      const gfx = this.scene.add.graphics().setDepth(1);
      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(sx, sy, r);
      this.stars.push({
        gfx,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 1.8,     // radians per second
      });
    }
  }

  private updateStars(delta: number) {
    const dt = delta / 1000;
    for (const s of this.stars) {
      s.phase += s.speed * dt;
      const alpha = 0.2 + 0.5 * ((Math.sin(s.phase) + 1) / 2);
      s.gfx.setAlpha(alpha);
    }
  }

  // ── Shooting Stars ──────────────────────────────────────────────────────────
  private updateShootingStars(delta: number) {
    if (this.shootingStarActive) return;
    this.shootingStarTimer += delta;
    if (this.shootingStarTimer < this.shootingStarInterval) return;

    this.shootingStarTimer = 0;
    this.shootingStarInterval = Phaser.Math.Between(3000, 8000);
    this.shootingStarActive = true;

    const isBoss = this.difficulty >= 4;
    const color = isBoss ? 0xff4444 : 0xccddff;

    // Start position: upper portion of sky
    const startX = Phaser.Math.Between(50, GAME_WIDTH - 200);
    const startY = Phaser.Math.Between(20, GAME_HEIGHT * 0.3);
    const endX = startX + Phaser.Math.Between(200, 400);
    const endY = startY + Phaser.Math.Between(80, 200);

    const g = this.scene.add.graphics().setDepth(2);
    const duration = Phaser.Math.Between(400, 700);
    const tailLen = 10;

    this.scene.tweens.add({
      targets: { t: 0 },
      t: 1,
      duration,
      onUpdate: (_tw, obj) => {
        const t = (obj as any).t as number;
        const cx = startX + (endX - startX) * t;
        const cy = startY + (endY - startY) * t;
        g.clear();
        for (let i = 0; i < tailLen; i++) {
          const tt = Math.max(0, t - i * 0.015);
          const tx = startX + (endX - startX) * tt;
          const ty = startY + (endY - startY) * tt;
          const r = Math.max(0.5, 3 - i * 0.3);
          const a = Math.max(0, 1 - i / tailLen) * (1 - t * 0.3);
          g.fillStyle(color, a);
          g.fillCircle(tx, ty, r);
        }
        // Bright head
        g.fillStyle(0xffffff, 1 - t * 0.4);
        g.fillCircle(cx, cy, 2.5);
      },
      onComplete: () => {
        g.destroy();
        this.shootingStarActive = false;
      },
    });
  }

  // ── Floating Particles (fireflies / embers) ─────────────────────────────────
  private updateFloatingParticles(delta: number) {
    // Spawn new particles at intervals
    this.floatSpawnTimer += delta;
    if (this.floatSpawnTimer > 500 && this.floatingParticles.length < this.MAX_FLOAT_PARTICLES) {
      this.floatSpawnTimer = 0;
      this.spawnFloatingParticle();
    }

    // Update existing
    const dt = delta / 1000;
    for (let i = this.floatingParticles.length - 1; i >= 0; i--) {
      const p = this.floatingParticles[i];
      p.elapsed += delta;
      if (p.elapsed >= p.lifetime) {
        p.gfx.destroy();
        this.floatingParticles.splice(i, 1);
        continue;
      }
      const prog = p.elapsed / p.lifetime;
      p.y -= p.riseSpeed * dt * 0.15;
      p.phase += dt * 1.5;
      const sx = p.baseX + Math.sin(p.phase) * p.drift;
      p.gfx.setPosition(sx, p.y);
      // Fade in briefly, hold, fade out
      const alpha = prog < 0.1 ? prog / 0.1 : prog > 0.7 ? (1 - prog) / 0.3 : 1;
      p.gfx.setAlpha(alpha * 0.7);
    }
  }

  private spawnFloatingParticle() {
    const isFirefly = this.difficulty < 3;
    const color = isFirefly
      ? [0x88ff88, 0x66ee66, 0xaaff77][Phaser.Math.Between(0, 2)]
      : [0xff8844, 0xff6622, 0xffaa33][Phaser.Math.Between(0, 2)];
    const groundY = GAME_HEIGHT - 100;
    const x = Phaser.Math.Between(50, GAME_WIDTH - 50);
    const y = groundY - Phaser.Math.Between(0, 30);
    const gfx = this.scene.add.graphics().setDepth(3);
    const r = isFirefly ? Phaser.Math.Between(1, 3) : Phaser.Math.Between(2, 4);
    gfx.fillStyle(color, 1);
    gfx.fillCircle(0, 0, r);
    gfx.setPosition(x, y);

    this.floatingParticles.push({
      gfx,
      baseX: x,
      y,
      startY: y,
      drift: Phaser.Math.Between(10, 30),
      phase: Math.random() * Math.PI * 2,
      lifetime: Phaser.Math.Between(4000, 7000),
      elapsed: 0,
      riseSpeed: 120 + Math.random() * 80,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC update — call from BattleScene.update()
  // ═══════════════════════════════════════════════════════════════════════════

  update(delta: number) {
    this.updateStars(delta);
    this.updateShootingStars(delta);
    this.updateFloatingParticles(delta);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMBAT VFX — called via events
  // ═══════════════════════════════════════════════════════════════════════════

  /** Wood block break — brown dust cloud overlay */
  dustCloud(x: number, y: number) {
    const g = this.scene.add.graphics().setDepth(14);
    g.fillStyle(0x8B5E3C, 0.25);
    g.fillCircle(0, 0, 10);
    g.setPosition(x, y);
    this.scene.tweens.add({
      targets: g,
      scaleX: 5,
      scaleY: 5,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => g.destroy(),
    });
  }

  /** Stone block break — bright sparks shower */
  stoneSparkShower(x: number, y: number) {
    for (let i = 0; i < 5; i++) {
      const g = this.scene.add.graphics().setDepth(16);
      const color = Math.random() > 0.5 ? 0xffffff : 0xffee88;
      g.fillStyle(color, 1);
      g.fillCircle(0, 0, Phaser.Math.Between(1, 3));
      g.setPosition(x, y);

      const vx = Phaser.Math.Between(-60, 60);
      const vy = Phaser.Math.Between(-120, -30);
      const dur = Phaser.Math.Between(350, 550);

      // x drift + fade (full duration)
      this.scene.tweens.add({
        targets: g,
        x: x + vx,
        alpha: 0,
        duration: dur,
        ease: 'Power1',
        onComplete: () => g.destroy(),
      });
      // y parabolic arc: rise quickly, then fall with gravity
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: dur,
        onUpdate: (tw: Phaser.Tweens.Tween) => {
          if (!g.active || !tw) return;
          const t = tw.progress;
          // Parabolic: rises to peak at t≈0.4, falls back down
          const rise = vy * t;                          // upward motion (vy is negative)
          const gravity = 200 * t * t;                  // downward pull
          g.setY(y + rise + gravity);
        },
      });
    }
  }

  /** Multi-layered fire explosion replacing flat purple circle for mage */
  mageExplosion(x: number, y: number, radius: number) {
    // Inner white-yellow core flash
    const core = this.scene.add.graphics().setDepth(25);
    core.fillStyle(0xffffcc, 0.8);
    core.fillCircle(0, 0, radius * 0.3);
    core.setPosition(x, y);
    this.scene.tweens.add({
      targets: core,
      alpha: 0,
      scaleX: 2.5,
      scaleY: 2.5,
      duration: 150,
      onComplete: () => core.destroy(),
    });

    // Orange fire ring expanding to radius
    const fireRing = this.scene.add.graphics().setDepth(22);
    this.scene.tweens.add({
      targets: { r: 0 },
      r: radius,
      duration: 350,
      onUpdate: (_tw, obj) => {
        const t = _tw.progress;
        const curR = (obj as any).r as number;
        fireRing.clear();
        fireRing.lineStyle(4, 0xff8800, (1 - t) * 0.8);
        fireRing.strokeCircle(x, y, curR);
        fireRing.fillStyle(0xff6600, (1 - t) * 0.15);
        fireRing.fillCircle(x, y, curR);
      },
      onComplete: () => fireRing.destroy(),
    });

    // Purple secondary ring, delayed 80ms — keeps mage identity
    this.scene.time.delayedCall(80, () => {
      const purpleRing = this.scene.add.graphics().setDepth(21);
      this.scene.tweens.add({
        targets: { r: 0 },
        r: radius * 1.1,
        duration: 400,
        onUpdate: (_tw, obj) => {
          const t = _tw.progress;
          const curR = (obj as any).r as number;
          purpleRing.clear();
          purpleRing.lineStyle(3, 0x8e44ad, (1 - t) * 0.6);
          purpleRing.strokeCircle(x, y, curR);
        },
        onComplete: () => purpleRing.destroy(),
      });
    });

    // 18 fire-colored radial particles
    const fireColors = [0xff8800, 0xff6600, 0xffaa33, 0xffcc00, 0xff4400, 0xcc3300];
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const dist = radius * (0.5 + Math.random() * 0.6);
      const g = this.scene.add.graphics().setDepth(20);
      const col = fireColors[Phaser.Math.Between(0, fireColors.length - 1)];
      g.fillStyle(col, 1);
      g.fillCircle(0, 0, Phaser.Math.Between(2, 5));
      g.setPosition(x, y);
      this.scene.tweens.add({
        targets: g,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: Phaser.Math.Between(250, 450),
        ease: 'Power2',
        onComplete: () => g.destroy(),
      });
    }

    // 6 rising ember particles after 200ms delay
    this.scene.time.delayedCall(200, () => {
      for (let i = 0; i < 6; i++) {
        const g = this.scene.add.graphics().setDepth(20);
        const col = [0xff6600, 0xff8844, 0xffaa33][Phaser.Math.Between(0, 2)];
        g.fillStyle(col, 0.8);
        g.fillCircle(0, 0, Phaser.Math.Between(1, 3));
        const ex = x + Phaser.Math.Between(-radius * 0.5, radius * 0.5);
        const ey = y + Phaser.Math.Between(-10, 10);
        g.setPosition(ex, ey);
        this.scene.tweens.add({
          targets: g,
          y: ey - Phaser.Math.Between(60, 130),
          x: ex + Phaser.Math.Between(-20, 20),
          alpha: 0,
          duration: Phaser.Math.Between(600, 900),
          ease: 'Power1',
          onComplete: () => g.destroy(),
        });
      }
    });
  }

  /** Fire-colored trail dot for mage during flight */
  mageTrailDot(x: number, y: number) {
    const fireColors = [0xff8800, 0xff5522, 0xffaa33, 0x8e44ad];
    const col = fireColors[Phaser.Math.Between(0, fireColors.length - 1)];
    const g = this.scene.add.graphics().setDepth(7);
    const r = Phaser.Math.Between(2, 5);
    g.fillStyle(col, 0.7);
    g.fillCircle(0, 0, r);
    g.setPosition(
      x + Phaser.Math.Between(-4, 4),
      y + Phaser.Math.Between(-4, 4),
    );
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      scaleX: 0.15,
      scaleY: 0.15,
      duration: 350,
      ease: 'Linear',
      onComplete: () => g.destroy(),
    });

    // Every 3rd dot: bonus rising ember
    if (Math.random() < 0.33) {
      const ember = this.scene.add.graphics().setDepth(7);
      ember.fillStyle(0xff6600, 0.6);
      ember.fillCircle(0, 0, Phaser.Math.Between(1, 2));
      ember.setPosition(x, y);
      this.scene.tweens.add({
        targets: ember,
        y: y - Phaser.Math.Between(15, 35),
        x: x + Phaser.Math.Between(-8, 8),
        alpha: 0,
        duration: Phaser.Math.Between(300, 500),
        ease: 'Power1',
        onComplete: () => ember.destroy(),
      });
    }
  }

  /** Hero enters combat — ground dust puff */
  landingDust(x: number, y: number) {
    // Central puff
    const puff = this.scene.add.graphics().setDepth(8);
    puff.fillStyle(0xc8b080, 0.3);
    puff.fillCircle(0, 0, 8);
    puff.setPosition(x, y);
    this.scene.tweens.add({
      targets: puff,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => puff.destroy(),
    });

    // 7 horizontal dust particles
    for (let i = 0; i < 7; i++) {
      const g = this.scene.add.graphics().setDepth(8);
      const col = [0xc8b080, 0xb8a070, 0xd0c090][Phaser.Math.Between(0, 2)];
      g.fillStyle(col, 0.5);
      g.fillCircle(0, 0, Phaser.Math.Between(2, 4));
      g.setPosition(x, y);
      const vx = Phaser.Math.Between(-70, 70);
      const dur = Phaser.Math.Between(300, 500);
      this.scene.tweens.add({
        targets: g,
        x: x + vx,
        y: y + Phaser.Math.Between(-15, 5),
        alpha: 0,
        duration: dur,
        ease: 'Power2',
        onComplete: () => g.destroy(),
      });
    }
  }

  /** Melee hit sparks — replaces white circle flash */
  meleeHitSparks(x: number, y: number, type: string) {
    let colors: number[];
    if (type === 'WOOD') {
      colors = [0x8B5E3C, 0x6B4020, 0xA07040];
    } else if (type === 'STONE') {
      colors = [0x888888, 0x999999, 0xff8844, 0xbbbbbb];
    } else {
      // enemy — white/yellow sparks
      colors = [0xffffff, 0xffffaa, 0xffee88];
    }

    for (let i = 0; i < 4; i++) {
      const g = this.scene.add.graphics().setDepth(20);
      const col = colors[Phaser.Math.Between(0, colors.length - 1)];
      g.fillStyle(col, 0.9);
      g.fillCircle(0, 0, Phaser.Math.Between(1, 3));
      g.setPosition(
        x + Phaser.Math.Between(-12, 12),
        y + Phaser.Math.Between(-12, 12),
      );
      this.scene.tweens.add({
        targets: g,
        x: g.x + Phaser.Math.Between(-18, 18),
        y: g.y + Phaser.Math.Between(-22, 8),
        alpha: 0,
        duration: Phaser.Math.Between(150, 280),
        ease: 'Power2',
        onComplete: () => g.destroy(),
      });
    }
  }

  /** Cleanup persistent star objects */
  destroy() {
    for (const s of this.stars) s.gfx.destroy();
    this.stars = [];
    for (const p of this.floatingParticles) p.gfx.destroy();
    this.floatingParticles = [];
  }
}
