import Phaser from 'phaser';
import { BARREL_HP, BARREL_EXPLOSION_RADIUS, BARREL_EXPLOSION_DAMAGE } from '@/config/constants';
import type { GameBody } from '@/config/types';

export class Barrel {
  readonly scene: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics };
  readonly body: GameBody;
  readonly graphics: Phaser.GameObjects.Graphics;
  private _hp = BARREL_HP;
  exploded = false;

  // Danger glow radius indicator
  private glowCircle: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics },
    x: number,
    y: number,
  ) {
    this.scene = scene;

    this.body = scene.matter.add.circle(x, y, 18, {
      density: 0.002,
      restitution: 0.4,
      friction: 0.5,
      frictionStatic: 2.0,
      slop: 0.01,
      label: 'barrel',
      isSleeping: true,  // start asleep — wakes on collision (prevents jitter)
    } as Phaser.Types.Physics.Matter.MatterBodyConfig) as GameBody;
    this.body.__barrel = this;

    // Danger glow
    this.glowCircle = scene.add.graphics();
    this.glowCircle.fillStyle(0xe74c3c, 0.12);
    this.glowCircle.fillCircle(0, 0, BARREL_EXPLOSION_RADIUS);
    this.glowCircle.lineStyle(1, 0xe74c3c, 0.4);
    this.glowCircle.strokeCircle(0, 0, BARREL_EXPLOSION_RADIUS);

    this.graphics = scene.add.graphics();
    this.drawBarrel();
  }

  private drawBarrel() {
    this.graphics.clear();
    // Body
    this.graphics.fillStyle(0x5d4037, 1);
    this.graphics.fillEllipse(0, 0, 36, 40);
    this.graphics.lineStyle(2, 0x3e2723, 1);
    this.graphics.strokeEllipse(0, 0, 36, 40);
    // Bands
    this.graphics.lineStyle(3, 0x795548, 1);
    this.graphics.lineBetween(-16, -8, 16, -8);
    this.graphics.lineBetween(-16,  8, 16,  8);
    // Danger X
    this.graphics.lineStyle(2, 0xe74c3c, 0.9);
    this.graphics.lineBetween(-8, -10, 8, 10);
    this.graphics.lineBetween(8, -10, -8, 10);
  }

  applyDamage(amount: number) {
    if (this.exploded) return;
    this._hp -= amount;
    if (this._hp <= 0) this.explode();
  }

  explode() {
    if (this.exploded) return;
    this.exploded = true;
    const { x, y } = this.body.position;
    this.scene.events.emit('barrelExploded', x, y, BARREL_EXPLOSION_RADIUS, BARREL_EXPLOSION_DAMAGE);
    this.scene.matter.world.remove(this.body);
    this.graphics.destroy();
    this.glowCircle.destroy();
  }

  update() {
    if (this.exploded) return;
    const { x, y } = this.body.position;
    const angle = this.body.angle;
    this.graphics.setPosition(x, y);
    this.graphics.setRotation(angle);
    this.glowCircle.setPosition(x, y);
  }
}
