import Phaser from 'phaser';
import { MATERIAL, MaterialType } from '@/config/constants';

export class Block {
  readonly scene: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics };
  readonly body: MatterJS.BodyType;
  readonly graphics: Phaser.GameObjects.Graphics;
  private _hp: number;
  readonly maxHp: number;
  readonly material: MaterialType;
  private readonly w: number;
  private readonly h: number;
  destroyed = false;

  // Pre-generated crack endpoints (local coords, relative to block center)
  private readonly cracks: Array<[number, number, number, number]>;

  private static FILL: Record<MaterialType, number> = {
    WOOD:  0x8B5E3C,
    STONE: 0x7f8c8d,
  };
  private static STROKE: Record<MaterialType, number> = {
    WOOD:  0x5D3A1A,
    STONE: 0x4a5568,
  };

  constructor(
    scene: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics },
    x: number,
    y: number,
    w: number,
    h: number,
    material: MaterialType,
  ) {
    this.scene = scene;
    this.material = material;
    this.w = w;
    this.h = h;
    const mat = MATERIAL[material];
    this._hp = mat.hp;
    this.maxHp = mat.hp;

    this.body = scene.matter.add.rectangle(x, y, w, h, {
      density: mat.density,
      restitution: mat.restitution,
      friction: mat.friction,
      frictionStatic: mat.frictionStatic,
      frictionAir: mat.frictionAir,
      slop: mat.slop,
      label: `block_${material}`,
      isSleeping: true,  // start asleep — wakes on collision (prevents jitter)
    } as Phaser.Types.Physics.Matter.MatterBodyConfig) as MatterJS.BodyType;

    // Generate 5 crack lines once — randomised but stable per block
    this.cracks = [];
    for (let i = 0; i < 5; i++) {
      const sx = (Math.random() - 0.5) * w * 0.75;
      const sy = (Math.random() - 0.5) * h * 0.75;
      const ex = sx + (Math.random() - 0.5) * w * 0.6;
      const ey = sy + (Math.random() - 0.5) * h * 0.6;
      this.cracks.push([sx, sy, ex, ey]);
    }

    this.graphics = scene.add.graphics();
    this.draw();
  }

  private draw() {
    this.graphics.clear();
    const pct  = this._hp / this.maxHp;
    const lost = 1 - pct;

    // Darken fill progressively as HP drops
    let fill = Block.FILL[this.material];
    if (lost > 0.6) {
      const r = Math.round(((fill >> 16) & 0xff) * 0.62);
      const g = Math.round(((fill >> 8)  & 0xff) * 0.62);
      const b = Math.round(( fill        & 0xff) * 0.62);
      fill = (r << 16) | (g << 8) | b;
    } else if (lost > 0.3) {
      const r = Math.round(((fill >> 16) & 0xff) * 0.80);
      const g = Math.round(((fill >> 8)  & 0xff) * 0.80);
      const b = Math.round(( fill        & 0xff) * 0.80);
      fill = (r << 16) | (g << 8) | b;
    }

    this.graphics.fillStyle(fill, 1);
    this.graphics.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    this.graphics.lineStyle(2, Block.STROKE[this.material], 1);
    this.graphics.strokeRect(-this.w / 2, -this.h / 2, this.w, this.h);

    // ── 4 damage-state crack overlays ──────────────────────────────────────
    // State 1 — light crack (above 85% HP remaining)
    if (pct < 0.85) {
      this.graphics.lineStyle(1, 0x000000, 0.35);
      const [sx, sy, ex, ey] = this.cracks[0];
      this.graphics.lineBetween(sx, sy, ex, ey);
    }
    // State 2 — heavy fractures (HP 40-60% remaining)
    if (pct < 0.6) {
      this.graphics.lineStyle(1, 0x000000, 0.50);
      const [sx1, sy1, ex1, ey1] = this.cracks[1];
      this.graphics.lineBetween(sx1, sy1, ex1, ey1);
      const [sx2, sy2, ex2, ey2] = this.cracks[2];
      this.graphics.lineBetween(sx2, sy2, ex2, ey2);
    }
    // State 3 — barely holding (below 30% HP)
    if (pct < 0.3) {
      this.graphics.lineStyle(1.5, 0x111111, 0.70);
      const [sx3, sy3, ex3, ey3] = this.cracks[3];
      this.graphics.lineBetween(sx3, sy3, ex3, ey3);
      const [sx4, sy4, ex4, ey4] = this.cracks[4];
      this.graphics.lineBetween(sx4, sy4, ex4, ey4);
    }
  }

  get hp() { return this._hp; }
  get halfW() { return this.w / 2; }
  get halfH() { return this.h / 2; }

  applyDamage(amount: number) {
    if (this.destroyed) return;
    this._hp = Math.max(0, this._hp - amount);
    this.draw();
    if (this._hp <= 0) this.destroy();
  }

  update() {
    if (this.destroyed) return;
    const pos = this.body.position;
    this.graphics.setPosition(pos.x, pos.y);
    this.graphics.setRotation(this.body.angle);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.emit('blockDestroyed', this.body.position.x, this.body.position.y, this.material);
    this.scene.matter.world.remove(this.body);
    this.graphics.destroy();
  }
}
