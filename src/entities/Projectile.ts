import Phaser from 'phaser';
import type { GameBody } from '@/config/types';
import type { Hero } from './Hero';

/** Short-lived sub-projectile (Ranger arrows, etc.) */
export class Projectile {
  readonly scene: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics };
  readonly body: GameBody;
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly damage: number;
  source: 'hero' | 'enemy' = 'hero';
  sourceHero: Hero | null = null;
  private lifetime = 3000; // ms
  destroyed = false;

  constructor(
    scene: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics },
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    color = 0xecf0f1,
  ) {
    this.scene = scene;
    this.damage = damage;

    this.body = scene.matter.add.circle(x, y, 5, {
      isSensor: true,   // fly through blocks and ground; hits checked by distance
      label: 'projectile',
      frictionAir: 0.001,
      restitution: 0,
    }) as GameBody;
    this.body.__projectile = this;

    scene.matter.setVelocity(this.body, vx, vy);

    this.graphics = scene.add.graphics();
    this.graphics.fillStyle(color, 1);
    this.graphics.fillRect(-8, -2, 16, 4);
  }

  update(delta: number) {
    if (this.destroyed) return;
    this.lifetime -= delta;
    if (this.lifetime <= 0) { this.destroy(); return; }
    const { x, y } = this.body.position;
    const angle = Math.atan2(this.body.velocity.y, this.body.velocity.x);
    this.graphics.setPosition(x, y);
    this.graphics.setRotation(angle);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    try { this.scene.matter.world.remove(this.body); } catch { /* already removed */ }
    this.graphics.destroy();
  }
}
