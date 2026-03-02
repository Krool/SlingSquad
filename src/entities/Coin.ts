import Phaser from 'phaser';

/**
 * A collectible sensor that heroes pick up on contact.
 * Types: 'gold' (coin), 'shard' (blue crystal), 'chest' (relic chest).
 * Physics: static sensor — no interaction forces, only collision events.
 */
type MatterScene = Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics };

export type CoinType = 'gold' | 'shard' | 'chest';

export class Coin {
  readonly scene: MatterScene;
  readonly body: MatterJS.BodyType;
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly value: number;
  readonly coinType: CoinType;
  readonly x: number;
  readonly y: number;
  collected = false;

  private bobTween!: Phaser.Tweens.Tween;
  private idleTimer!: Phaser.Time.TimerEvent;

  constructor(scene: MatterScene, x: number, y: number, value = 3, type: CoinType = 'gold') {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.value = value;
    this.coinType = type;

    const radius = type === 'chest' ? 18 : 13;
    const label = type === 'gold' ? 'coin' : type === 'shard' ? 'shard_crystal' : 'chest';

    // Static sensor — heroes pass through but collisions still fire
    this.body = scene.matter.add.circle(x, y, radius, {
      isSensor: true,
      isStatic: true,
      label,
    }) as MatterJS.BodyType;

    this.graphics = scene.add.graphics().setDepth(9);
    this.draw();
    this.graphics.setPosition(x, y);

    // Gentle bob
    const bobRange = type === 'chest' ? 4 : 6;
    this.bobTween = scene.tweens.add({
      targets: this.graphics,
      y: { from: y - bobRange, to: y + bobRange },
      duration: Phaser.Math.Between(800, 1100),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Slow idle sparkle pops
    this.idleTimer = scene.time.addEvent({
      delay: type === 'chest' ? 500 : 750,
      loop: true,
      callback: () => { if (!this.collected) this.spawnIdleSparkle(); },
    });
  }

  private draw() {
    switch (this.coinType) {
      case 'gold': this.drawCoin(); break;
      case 'shard': this.drawShard(); break;
      case 'chest': this.drawChest(); break;
    }
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

  private drawShard() {
    const g = this.graphics;
    g.clear();
    const s = 14;
    // Outer glow
    g.fillStyle(0x7ec8e3, 0.15);
    g.fillCircle(0, 0, 24);
    // 4-point diamond
    g.fillStyle(0x7ec8e3, 1);
    g.fillPoints([
      { x: 0, y: -s },
      { x: s * 0.7, y: 0 },
      { x: 0, y: s },
      { x: -s * 0.7, y: 0 },
    ], true);
    // Inner highlight
    const hs = s * 0.5;
    g.fillStyle(0xb8e8ff, 0.8);
    g.fillPoints([
      { x: 0, y: -hs },
      { x: hs * 0.7, y: 0 },
      { x: 0, y: hs },
      { x: -hs * 0.7, y: 0 },
    ], true);
    // Shine dot
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(-2, -4, 3);
    // Border
    g.lineStyle(1.5, 0x5aa8c8, 1);
    g.beginPath();
    g.moveTo(0, -s);
    g.lineTo(s * 0.7, 0);
    g.lineTo(0, s);
    g.lineTo(-s * 0.7, 0);
    g.closePath();
    g.strokePath();
  }

  private drawChest() {
    const g = this.graphics;
    g.clear();
    const w = 24;
    const h = 18;
    // Outer glow
    g.fillStyle(0xffd700, 0.12);
    g.fillCircle(0, 0, 30);
    // Chest body (dark wood)
    g.fillStyle(0x6B4020, 1);
    g.fillRect(-w / 2, -h / 2 + 2, w, h - 2);
    // Chest lid (lighter wood)
    g.fillStyle(0x8B5E3C, 1);
    g.fillRect(-w / 2, -h / 2, w, h / 2);
    // Lid edge highlight
    g.fillStyle(0xA07040, 1);
    g.fillRect(-w / 2, -h / 2, w, 3);
    // Gold trim
    g.lineStyle(1.5, 0xffd700, 1);
    g.strokeRect(-w / 2, -h / 2, w, h);
    // Lock/clasp
    g.fillStyle(0xffd700, 1);
    g.fillCircle(0, 0, 3.5);
    g.fillStyle(0xd4a017, 1);
    g.fillCircle(0, 0, 2);
    // Shine
    g.fillStyle(0xfff8c0, 0.6);
    g.fillCircle(-6, -5, 3);
  }

  private spawnIdleSparkle() {
    const angle  = Math.random() * Math.PI * 2;
    const dist   = Phaser.Math.Between(10, 22);
    const bobY   = this.graphics.y; // follow current bob position
    const sx     = this.x + Math.cos(angle) * dist;
    const sy     = bobY  + Math.sin(angle) * dist;

    const sparkleColor = this.coinType === 'shard' ? 0x7ec8e3
      : this.coinType === 'chest' ? 0xffd700 : 0xffe066;

    const g = this.scene.add.graphics().setDepth(10);
    g.fillStyle(sparkleColor, 1);
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
    this.scene.matter.world.remove(this.body);

    const bx = this.x;
    const by = this.graphics.y; // honour current bob offset

    const burstColors = this.coinType === 'shard'
      ? [0x7ec8e3, 0xb8e8ff, 0x5aa8c8, 0xddf4ff]
      : this.coinType === 'chest'
        ? [0xffd700, 0xf1c40f, 0xffe066, 0xfff8b0]
        : [0xf1c40f, 0xffe066, 0xffd700, 0xfff8b0];

    const burstCount = this.coinType === 'chest' ? 16 : 10;
    const burstSpd = this.coinType === 'chest' ? 160 : 130;

    for (let i = 0; i < burstCount; i++) {
      const angle = (i / burstCount) * Math.PI * 2;
      const spd   = Phaser.Math.Between(50, burstSpd);
      const g     = this.scene.add.graphics().setDepth(20);
      g.fillStyle(burstColors[i % burstColors.length], 1);
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

    // Coin/shard/chest expands and fades
    const expandScale = this.coinType === 'chest' ? 2.5 : 2.0;
    this.scene.tweens.add({
      targets: this.graphics,
      scaleX: expandScale, scaleY: expandScale,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => this.graphics.destroy(),
    });
  }
}
