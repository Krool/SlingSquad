import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config/constants';
import type { ZoneTheme } from '@/config/zoneThemes';

/**
 * VFXSystem — Ambient atmosphere + combat visual effects.
 * Instantiated per BattleScene.create(), destroyed on scene shutdown.
 */
export class VFXSystem {
  private scene: Phaser.Scene;
  private difficulty: number;
  private theme: ZoneTheme;

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

  constructor(scene: Phaser.Scene, difficulty: number, theme?: ZoneTheme) {
    this.scene = scene;
    this.difficulty = difficulty;
    this.theme = theme ?? {
      skyColor: 0x1a1a3e, skyLowerColor: 0x2d1b35,
      groundColor: 0x2d5a1b, grassColor: 0x3d7a28,
      soilColor: 0x4a3010, hillGrassColor: 0x3d7a28,
      celestial: 'crescent_moon', celestialColor: 0xe8d5a3,
      particleType: 'firefly',
      particleColors: [0x88ff88, 0x66ee66, 0xaaff77],
      shootingStarColor: 0xccddff,
      bgElements: [],
    };
    this.shootingStarInterval = Phaser.Math.Between(3000, 8000);
    this.initStars();
    scene.events.once('shutdown', () => this.destroy());
  }

  private initStars() {
    for (let i = 0; i < 60; i++) {
      const sx = Phaser.Math.Between(0, GAME_WIDTH);
      const sy = Phaser.Math.Between(0, GAME_HEIGHT * 0.55);
      const r = Math.random() < 0.15 ? 2 : 1;
      const gfx = this.scene.add.graphics().setDepth(1);
      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(sx, sy, r);
      this.stars.push({ gfx, phase: Math.random() * Math.PI * 2, speed: 0.8 + Math.random() * 1.8 });
    }
  }

  private updateStars(delta: number) {
    const dt = delta / 1000;
    for (const s of this.stars) {
      s.phase += s.speed * dt;
      s.gfx.setAlpha(0.2 + 0.5 * ((Math.sin(s.phase) + 1) / 2));
    }
  }

  private updateShootingStars(delta: number) {
    if (this.shootingStarActive) return;
    this.shootingStarTimer += delta;
    if (this.shootingStarTimer < this.shootingStarInterval) return;
    this.shootingStarTimer = 0;
    this.shootingStarInterval = Phaser.Math.Between(3000, 8000);
    this.shootingStarActive = true;
    const color = this.theme.shootingStarColor;
    const startX = Phaser.Math.Between(50, GAME_WIDTH - 200);
    const startY = Phaser.Math.Between(20, GAME_HEIGHT * 0.3);
    const endX = startX + Phaser.Math.Between(200, 400);
    const endY = startY + Phaser.Math.Between(80, 200);
    const g = this.scene.add.graphics().setDepth(2);
    const duration = Phaser.Math.Between(400, 700);
    const tailLen = 10;
    this.scene.tweens.add({
      targets: { t: 0 }, t: 1, duration,
      onUpdate: (_tw, obj) => {
        const t = (obj as any).t as number;
        const cx = startX + (endX - startX) * t;
        const cy = startY + (endY - startY) * t;
        g.clear();
        for (let i = 0; i < tailLen; i++) {
          const tt = Math.max(0, t - i * 0.015);
          g.fillStyle(color, Math.max(0, 1 - i / tailLen) * (1 - t * 0.3));
          g.fillCircle(startX + (endX - startX) * tt, startY + (endY - startY) * tt, Math.max(0.5, 3 - i * 0.3));
        }
        g.fillStyle(0xffffff, 1 - t * 0.4);
        g.fillCircle(cx, cy, 2.5);
      },
      onComplete: () => { g.destroy(); this.shootingStarActive = false; },
    });
  }

  // ── Floating Particles (zone-aware) ────────────────────────────────────────
  private updateFloatingParticles(delta: number) {
    this.floatSpawnTimer += delta;
    if (this.floatSpawnTimer > 500 && this.floatingParticles.length < this.MAX_FLOAT_PARTICLES) {
      this.floatSpawnTimer = 0;
      this.spawnFloatingParticle();
    }
    const dt = delta / 1000;
    for (let i = this.floatingParticles.length - 1; i >= 0; i--) {
      const p = this.floatingParticles[i];
      p.elapsed += delta;
      if (p.elapsed >= p.lifetime) { p.gfx.destroy(); this.floatingParticles.splice(i, 1); continue; }
      const prog = p.elapsed / p.lifetime;
      if (this.theme.particleType === 'snowflake') {
        p.y += p.riseSpeed * dt * 0.12; // drift down
      } else if (this.theme.particleType === 'ember') {
        p.y -= p.riseSpeed * dt * 0.12; // rise up
      } else {
        p.y -= p.riseSpeed * dt * 0.15; // firefly gentle rise
      }
      p.phase += dt * (this.theme.particleType === 'snowflake' ? 2.0 : 1.5);
      p.gfx.setPosition(p.baseX + Math.sin(p.phase) * p.drift, p.y);
      const alpha = prog < 0.1 ? prog / 0.1 : prog > 0.7 ? (1 - prog) / 0.3 : 1;
      p.gfx.setAlpha(alpha * 0.7);
    }
  }

  private spawnFloatingParticle() {
    const colors = this.theme.particleColors;
    const color = colors[Phaser.Math.Between(0, colors.length - 1)];
    const groundY = GAME_HEIGHT - 100;
    let x: number, y: number;
    if (this.theme.particleType === 'snowflake') {
      x = Phaser.Math.Between(50, GAME_WIDTH - 50);
      y = Phaser.Math.Between(-20, 50);
    } else if (this.theme.particleType === 'ember') {
      x = Phaser.Math.Between(50, GAME_WIDTH - 50);
      y = groundY - Phaser.Math.Between(-10, 20);
    } else {
      x = Phaser.Math.Between(50, GAME_WIDTH - 50);
      y = groundY - Phaser.Math.Between(0, 30);
    }
    const r = Phaser.Math.Between(1, this.theme.particleType === 'ember' ? 4 : 3);
    const gfx = this.scene.add.graphics().setDepth(3);
    gfx.fillStyle(color, 1);
    gfx.fillCircle(0, 0, r);
    gfx.setPosition(x, y);
    this.floatingParticles.push({
      gfx, baseX: x, y, startY: y,
      drift: Phaser.Math.Between(10, 30),
      phase: Math.random() * Math.PI * 2,
      lifetime: Phaser.Math.Between(4000, 7000),
      elapsed: 0, riseSpeed: 120 + Math.random() * 80,
    });
  }

  update(delta: number) {
    this.updateStars(delta);
    this.updateShootingStars(delta);
    this.updateFloatingParticles(delta);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMBAT VFX
  // ═══════════════════════════════════════════════════════════════════════════

  dustCloud(x: number, y: number) {
    const g = this.scene.add.graphics().setDepth(14);
    g.fillStyle(0x8B5E3C, 0.25); g.fillCircle(0, 0, 10); g.setPosition(x, y);
    this.scene.tweens.add({ targets: g, scaleX: 5, scaleY: 5, alpha: 0, duration: 500, ease: 'Power2', onComplete: () => g.destroy() });
  }

  stoneSparkShower(x: number, y: number) {
    for (let i = 0; i < 5; i++) {
      const g = this.scene.add.graphics().setDepth(16);
      g.fillStyle(Math.random() > 0.5 ? 0xffffff : 0xffee88, 1);
      g.fillCircle(0, 0, Phaser.Math.Between(1, 3)); g.setPosition(x, y);
      const vx = Phaser.Math.Between(-60, 60);
      const vy = Phaser.Math.Between(-120, -30);
      const dur = Phaser.Math.Between(350, 550);
      this.scene.tweens.add({ targets: g, x: x + vx, alpha: 0, duration: dur, ease: 'Power1', onComplete: () => g.destroy() });
      this.scene.tweens.addCounter({ from: 0, to: 1, duration: dur, onUpdate: (tw) => { if (!g.active) return; const t = tw.progress; g.setY(y + vy * t + 200 * t * t); } });
    }
  }

  iceShatter(x: number, y: number) {
    const flash = this.scene.add.graphics().setDepth(16);
    flash.fillStyle(0xcceeFF, 0.6); flash.fillCircle(0, 0, 12); flash.setPosition(x, y);
    this.scene.tweens.add({ targets: flash, scaleX: 3, scaleY: 3, alpha: 0, duration: 300, ease: 'Power2', onComplete: () => flash.destroy() });
    const shardColors = [0xb0d4e8, 0x88ccff, 0xddeeFF, 0xffffff];
    for (let i = 0; i < 7; i++) {
      const g = this.scene.add.graphics().setDepth(16);
      g.fillStyle(shardColors[Phaser.Math.Between(0, 3)], 0.9);
      g.fillRect(-2, -4, Phaser.Math.Between(2, 5), Phaser.Math.Between(4, 8)); g.setPosition(x, y);
      const angle = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(30, 80);
      this.scene.tweens.add({ targets: g, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, angle: Phaser.Math.Between(-180, 180), alpha: 0, duration: Phaser.Math.Between(300, 500), ease: 'Power2', onComplete: () => g.destroy() });
    }
  }

  obsidianCrack(x: number, y: number) {
    const flash = this.scene.add.graphics().setDepth(16);
    flash.fillStyle(0xff6600, 0.5); flash.fillCircle(0, 0, 10); flash.setPosition(x, y);
    this.scene.tweens.add({ targets: flash, scaleX: 4, scaleY: 4, alpha: 0, duration: 350, ease: 'Power2', onComplete: () => flash.destroy() });
    for (let i = 0; i < 8; i++) {
      const g = this.scene.add.graphics().setDepth(16);
      g.fillStyle(Math.random() > 0.4 ? 0xff6600 : 0xff4400, 1);
      g.fillCircle(0, 0, Phaser.Math.Between(1, 3)); g.setPosition(x, y);
      const angle = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(20, 70);
      this.scene.tweens.add({ targets: g, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist - 20, alpha: 0, duration: Phaser.Math.Between(250, 450), ease: 'Power2', onComplete: () => g.destroy() });
    }
    for (let i = 0; i < 4; i++) {
      const g = this.scene.add.graphics().setDepth(15);
      g.fillStyle(0x1a0808, 1); g.fillCircle(0, 0, Phaser.Math.Between(3, 6)); g.setPosition(x, y);
      this.scene.tweens.add({ targets: g, x: x + Phaser.Math.Between(-50, 50), y: y + Phaser.Math.Between(-60, -10), alpha: 0, duration: Phaser.Math.Between(400, 600), ease: 'Power2', onComplete: () => g.destroy() });
    }
  }

  mageExplosion(x: number, y: number, radius: number) {
    const core = this.scene.add.graphics().setDepth(25);
    core.fillStyle(0xffffcc, 0.8); core.fillCircle(0, 0, radius * 0.3); core.setPosition(x, y);
    this.scene.tweens.add({ targets: core, alpha: 0, scaleX: 2.5, scaleY: 2.5, duration: 150, onComplete: () => core.destroy() });
    const fireRing = this.scene.add.graphics().setDepth(22);
    this.scene.tweens.add({ targets: { r: 0 }, r: radius, duration: 350, onUpdate: (_tw, obj) => { const t = _tw.progress; const curR = (obj as any).r as number; fireRing.clear(); fireRing.lineStyle(4, 0xff8800, (1 - t) * 0.8); fireRing.strokeCircle(x, y, curR); fireRing.fillStyle(0xff6600, (1 - t) * 0.15); fireRing.fillCircle(x, y, curR); }, onComplete: () => fireRing.destroy() });
    this.scene.time.delayedCall(80, () => { const pr = this.scene.add.graphics().setDepth(21); this.scene.tweens.add({ targets: { r: 0 }, r: radius * 1.1, duration: 400, onUpdate: (_tw, obj) => { const t = _tw.progress; const curR = (obj as any).r as number; pr.clear(); pr.lineStyle(3, 0x8e44ad, (1 - t) * 0.6); pr.strokeCircle(x, y, curR); }, onComplete: () => pr.destroy() }); });
    const fireColors = [0xff8800, 0xff6600, 0xffaa33, 0xffcc00, 0xff4400, 0xcc3300];
    for (let i = 0; i < 18; i++) { const angle = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.3; const dist = radius * (0.5 + Math.random() * 0.6); const g = this.scene.add.graphics().setDepth(20); g.fillStyle(fireColors[Phaser.Math.Between(0, 5)], 1); g.fillCircle(0, 0, Phaser.Math.Between(2, 5)); g.setPosition(x, y); this.scene.tweens.add({ targets: g, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, alpha: 0, duration: Phaser.Math.Between(250, 450), ease: 'Power2', onComplete: () => g.destroy() }); }
    this.scene.time.delayedCall(200, () => { for (let i = 0; i < 6; i++) { const g = this.scene.add.graphics().setDepth(20); g.fillStyle([0xff6600, 0xff8844, 0xffaa33][Phaser.Math.Between(0, 2)], 0.8); g.fillCircle(0, 0, Phaser.Math.Between(1, 3)); const ex = x + Phaser.Math.Between(-radius * 0.5, radius * 0.5); const ey = y + Phaser.Math.Between(-10, 10); g.setPosition(ex, ey); this.scene.tweens.add({ targets: g, y: ey - Phaser.Math.Between(60, 130), x: ex + Phaser.Math.Between(-20, 20), alpha: 0, duration: Phaser.Math.Between(600, 900), ease: 'Power1', onComplete: () => g.destroy() }); } });
  }

  mageTrailDot(x: number, y: number) {
    const col = [0xff8800, 0xff5522, 0xffaa33, 0x8e44ad][Phaser.Math.Between(0, 3)];
    const g = this.scene.add.graphics().setDepth(7);
    g.fillStyle(col, 0.7); g.fillCircle(0, 0, Phaser.Math.Between(2, 5));
    g.setPosition(x + Phaser.Math.Between(-4, 4), y + Phaser.Math.Between(-4, 4));
    this.scene.tweens.add({ targets: g, alpha: 0, scaleX: 0.15, scaleY: 0.15, duration: 350, ease: 'Linear', onComplete: () => g.destroy() });
    if (Math.random() < 0.33) { const ember = this.scene.add.graphics().setDepth(7); ember.fillStyle(0xff6600, 0.6); ember.fillCircle(0, 0, Phaser.Math.Between(1, 2)); ember.setPosition(x, y); this.scene.tweens.add({ targets: ember, y: y - Phaser.Math.Between(15, 35), x: x + Phaser.Math.Between(-8, 8), alpha: 0, duration: Phaser.Math.Between(300, 500), ease: 'Power1', onComplete: () => ember.destroy() }); }
  }

  landingDust(x: number, y: number) {
    const puff = this.scene.add.graphics().setDepth(8);
    puff.fillStyle(0xc8b080, 0.3); puff.fillCircle(0, 0, 8); puff.setPosition(x, y);
    this.scene.tweens.add({ targets: puff, scaleX: 3, scaleY: 3, alpha: 0, duration: 400, ease: 'Power2', onComplete: () => puff.destroy() });
    for (let i = 0; i < 7; i++) { const g = this.scene.add.graphics().setDepth(8); g.fillStyle([0xc8b080, 0xb8a070, 0xd0c090][Phaser.Math.Between(0, 2)], 0.5); g.fillCircle(0, 0, Phaser.Math.Between(2, 4)); g.setPosition(x, y); this.scene.tweens.add({ targets: g, x: x + Phaser.Math.Between(-70, 70), y: y + Phaser.Math.Between(-15, 5), alpha: 0, duration: Phaser.Math.Between(300, 500), ease: 'Power2', onComplete: () => g.destroy() }); }
  }

  meleeHitSparks(x: number, y: number, type: string) {
    let colors: number[];
    if (type === 'WOOD') colors = [0x8B5E3C, 0x6B4020, 0xA07040];
    else if (type === 'STONE') colors = [0x888888, 0x999999, 0xff8844, 0xbbbbbb];
    else if (type === 'ICE') colors = [0x88ccff, 0xb0d4e8, 0xffffff, 0xddeeFF];
    else if (type === 'OBSIDIAN') colors = [0xff6600, 0xff4400, 0x1a0808, 0xffaa00];
    else colors = [0xffffff, 0xffffaa, 0xffee88];
    for (let i = 0; i < 4; i++) { const g = this.scene.add.graphics().setDepth(20); g.fillStyle(colors[Phaser.Math.Between(0, colors.length - 1)], 0.9); g.fillCircle(0, 0, Phaser.Math.Between(1, 3)); g.setPosition(x + Phaser.Math.Between(-12, 12), y + Phaser.Math.Between(-12, 12)); this.scene.tweens.add({ targets: g, x: g.x + Phaser.Math.Between(-18, 18), y: g.y + Phaser.Math.Between(-22, 8), alpha: 0, duration: Phaser.Math.Between(150, 280), ease: 'Power2', onComplete: () => g.destroy() }); }
  }

  destroy() {
    for (const s of this.stars) s.gfx.destroy();
    this.stars = [];
    for (const p of this.floatingParticles) p.gfx.destroy();
    this.floatingParticles = [];
  }
}
