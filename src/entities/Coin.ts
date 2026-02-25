import Phaser from 'phaser';

/**
 * A floating gold coin that heroes collect mid-flight.
 * Physics: static sensor — no interaction forces, only collision events.
 * Visual: golden circle that bobs up/down and emits idle sparkles.
 */
export class Coin {
  readonly scene: Phaser.Scene;
  readonly body: MatterJS.BodyType;
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly value: number;
  readonly x: number;
  readonly y: number;
  collected = false;

  private bobTween!: Phaser.Tweens.Tween;
  private idleTimer!: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, x: number, y: number, value = 3) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.value = value;

    // Static sensor — heroes pass through but collisions still fire
    this.body = (scene as any).matter.add.circle(x, y, 13, {
      isSensor: true,
      isStatic: true,
      label: 'coin',
    }) as MatterJS.BodyType;

    this.graphics = scene.add.graphics().setDepth(9);
    this.drawCoin();
    this.graphics.setPosition(x, y);

    // Gentle bob
    this.bobTween = scene.tweens.add({
      targets: this.graphics,
      y: { from: y - 6, to: y + 6 },
      duration: Phaser.Math.Between(800, 1100),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Slow idle sparkle pops
    this.idleTimer = scene.time.addEvent({
      delay: 750,
      loop: true,
      callback: () => { if (!this.collected) this.spawnIdleSparkle(); },
    });
  }

  private drawCoin() {
    const g = this.graphics;
    g.clear();
    // Soft outer glow
    g.fillStyle(0xf1c40f, 0.12);
    g.fillCircle(0, 0, 22);
    // Main body
    g.fillStyle(0xf1c40f, 1);
    g.fillCircle(0, 0, 12);
    // Inner face
    g.fillStyle(0xd4a017, 1);
    g.fillCircle(0, 0, 8);
    // Shine
    g.fillStyle(0xfff8c0, 0.85);
    g.fillCircle(-3, -3, 4);
    // Rim
    g.lineStyle(1.5, 0xffd700, 1);
    g.strokeCircle(0, 0, 12);
  }

  private spawnIdleSparkle() {
    const angle  = Math.random() * Math.PI * 2;
    const dist   = Phaser.Math.Between(10, 22);
    const bobY   = this.graphics.y; // follow current bob position
    const sx     = this.x + Math.cos(angle) * dist;
    const sy     = bobY  + Math.sin(angle) * dist;

    const g = this.scene.add.graphics().setDepth(10);
    g.fillStyle(0xffe066, 1);
    g.fillCircle(0, 0, Phaser.Math.Between(1, 2));
    g.setPosition(sx, sy).setAlpha(0.9);

    this.scene.tweens.add({
      targets: g,
      y: sy - 14,
      alpha: 0,
      scaleX: 0.1, scaleY: 0.1,
      duration: Phaser.Math.Between(380, 550),
      ease: 'Power1',
      onComplete: () => g.destroy(),
    });
  }

  /** Call from BattleScene when a hero collision is detected. */
  collect() {
    if (this.collected) return;
    this.collected = true;

    this.bobTween.stop();
    this.idleTimer.destroy();

    const bx = this.x;
    const by = this.graphics.y; // honour current bob offset
    const cols = [0xf1c40f, 0xffe066, 0xffd700, 0xfff8b0];

    // Burst of 10 gold particles
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const spd   = Phaser.Math.Between(50, 130);
      const g     = this.scene.add.graphics().setDepth(20);
      g.fillStyle(cols[i % 4], 1);
      g.fillCircle(0, 0, Phaser.Math.Between(2, 5));
      g.setPosition(bx, by);
      this.scene.tweens.add({
        targets: g,
        x: bx + Math.cos(angle) * spd,
        y: by + Math.sin(angle) * spd,
        alpha: 0,
        scaleX: 0.1, scaleY: 0.1,
        duration: Phaser.Math.Between(270, 420),
        ease: 'Power2',
        onComplete: () => g.destroy(),
      });
    }

    // Coin expands and fades
    this.scene.tweens.add({
      targets: this.graphics,
      scaleX: 2.0, scaleY: 2.0,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => this.graphics.destroy(),
    });
  }
}
