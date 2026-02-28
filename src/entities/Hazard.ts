import Phaser from 'phaser';
import { GAME_HEIGHT, HAZARD } from '@/config/constants';
import type { HazardType } from '@/structures/types';

/**
 * Hazard — Environmental obstacles placed by structure templates.
 * 4 types: SPIKE_TRAP, ICE_PATCH, LAVA_PIT, FIRE_GEYSER.
 * All are static (no physics movement). Some are sensors (no collision).
 */
export class Hazard {
  readonly scene: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics };
  readonly type: HazardType;
  readonly x: number;
  readonly y: number;
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly body: MatterJS.BodyType | null;
  destroyed = false;

  // SPIKE_TRAP
  private _hp = 0;

  // FIRE_GEYSER eruption state
  private eruptTimer = 0;
  private eruptInterval = 0;
  private erupting = false;
  private eruptGfx: Phaser.GameObjects.Graphics | null = null;

  // LAVA_PIT DoT timer
  private dotTimer = 0;

  constructor(
    scene: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics },
    type: HazardType,
    x: number,
    y: number,
  ) {
    this.scene = scene;
    this.type = type;
    this.x = x;
    this.y = y;
    this.graphics = scene.add.graphics().setDepth(4);

    switch (type) {
      case 'SPIKE_TRAP': {
        const cfg = HAZARD.SPIKE_TRAP;
        this._hp = cfg.hp;
        this.body = scene.matter.add.rectangle(x, y, cfg.width, cfg.height, {
          isStatic: true,
          label: 'hazard_spike',
          isSensor: false,
        } as Phaser.Types.Physics.Matter.MatterBodyConfig) as MatterJS.BodyType;
        this.drawSpikeTrap();
        break;
      }
      case 'ICE_PATCH': {
        const cfg = HAZARD.ICE_PATCH;
        this.body = scene.matter.add.rectangle(x, y, cfg.width, cfg.height, {
          isStatic: true,
          label: 'hazard_ice_patch',
          isSensor: true,
        } as Phaser.Types.Physics.Matter.MatterBodyConfig) as MatterJS.BodyType;
        this.drawIcePatch();
        break;
      }
      case 'LAVA_PIT': {
        const cfg = HAZARD.LAVA_PIT;
        this.body = scene.matter.add.rectangle(x, y, cfg.width, cfg.height, {
          isStatic: true,
          label: 'hazard_lava_pit',
          isSensor: true,
        } as Phaser.Types.Physics.Matter.MatterBodyConfig) as MatterJS.BodyType;
        this.drawLavaPit();
        break;
      }
      case 'FIRE_GEYSER': {
        const cfg = HAZARD.FIRE_GEYSER;
        this.eruptInterval = Phaser.Math.Between(cfg.eruptIntervalMin, cfg.eruptIntervalMax);
        this.body = scene.matter.add.rectangle(x, y, cfg.ventWidth, cfg.ventHeight, {
          isStatic: true,
          label: 'hazard_fire_geyser',
          isSensor: true,
        } as Phaser.Types.Physics.Matter.MatterBodyConfig) as MatterJS.BodyType;
        this.drawFireGeyserVent();
        break;
      }
    }
  }

  // ─── Drawing ────────────────────────────────────────────────────────────────

  private drawSpikeTrap() {
    const { width: w, height: h } = HAZARD.SPIKE_TRAP;
    this.graphics.setPosition(this.x, this.y);

    // Base
    this.graphics.fillStyle(0x4a3010, 1);
    this.graphics.fillRect(-w / 2, -h / 2 + 6, w, h - 6);

    // Spike points
    const spikeCount = 5;
    const spikeW = w / spikeCount;
    for (let i = 0; i < spikeCount; i++) {
      const sx = -w / 2 + i * spikeW + spikeW / 2;
      this.graphics.fillStyle(0x6a5020, 1);
      this.graphics.fillTriangle(
        sx - spikeW / 3, -h / 2 + 6,
        sx + spikeW / 3, -h / 2 + 6,
        sx, -h / 2 - 4,
      );
    }
  }

  private drawIcePatch() {
    const { width: w, height: h } = HAZARD.ICE_PATCH;
    this.graphics.setPosition(this.x, this.y);

    // Translucent blue-white floor patch
    this.graphics.fillStyle(0x88ccff, 0.3);
    this.graphics.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
    this.graphics.lineStyle(1, 0xaaddff, 0.5);
    this.graphics.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);

    // Shimmer lines
    this.graphics.lineStyle(1, 0xffffff, 0.2);
    this.graphics.lineBetween(-w / 3, 0, w / 3, -2);
  }

  private drawLavaPit() {
    const { width: w, height: h } = HAZARD.LAVA_PIT;
    this.graphics.setPosition(this.x, this.y);

    // Dark pit outline
    this.graphics.fillStyle(0x1a0500, 1);
    this.graphics.fillRoundedRect(-w / 2 - 3, -h / 2 - 2, w + 6, h + 4, 4);

    // Orange-red lava fill
    this.graphics.fillStyle(0xff4400, 0.8);
    this.graphics.fillRoundedRect(-w / 2, -h / 2, w, h, 3);

    // Bright center
    this.graphics.fillStyle(0xffaa00, 0.5);
    this.graphics.fillRoundedRect(-w / 4, -h / 4, w / 2, h / 2, 2);
  }

  private drawFireGeyserVent() {
    const { ventWidth: w, ventHeight: h } = HAZARD.FIRE_GEYSER;
    this.graphics.setPosition(this.x, this.y);

    // Dark vent in ground
    this.graphics.fillStyle(0x0a0505, 1);
    this.graphics.fillRoundedRect(-w / 2, -h / 2, w, h, 3);
    this.graphics.lineStyle(1, 0xff4400, 0.4);
    this.graphics.strokeRoundedRect(-w / 2, -h / 2, w, h, 3);

    // Smoldering glow
    this.graphics.fillStyle(0xff6600, 0.2);
    this.graphics.fillCircle(0, 0, w / 3);
  }

  // ─── Update loop ──────────────────────────────────────────────────────────

  update(delta: number) {
    if (this.destroyed) return;

    if (this.type === 'FIRE_GEYSER') {
      this.updateGeyser(delta);
    }

    if (this.type === 'LAVA_PIT') {
      this.dotTimer += delta;
    }
  }

  private updateGeyser(delta: number) {
    const cfg = HAZARD.FIRE_GEYSER;
    this.eruptTimer += delta;

    if (!this.erupting && this.eruptTimer >= this.eruptInterval) {
      this.erupting = true;
      this.eruptTimer = 0;
      this.eruptInterval = Phaser.Math.Between(cfg.eruptIntervalMin, cfg.eruptIntervalMax);

      // Visual eruption column
      this.eruptGfx = this.scene.add.graphics().setDepth(18);
      this.eruptGfx.setPosition(this.x, this.y);

      // Fire column rising upward
      const colH = cfg.radius * 2;
      this.eruptGfx.fillStyle(0xff4400, 0.6);
      this.eruptGfx.fillRect(-12, -colH, 24, colH);
      this.eruptGfx.fillStyle(0xffaa00, 0.4);
      this.eruptGfx.fillRect(-8, -colH * 0.8, 16, colH * 0.6);
      this.eruptGfx.fillStyle(0xffffcc, 0.3);
      this.eruptGfx.fillRect(-4, -colH * 0.5, 8, colH * 0.3);

      // Emit eruption event for BattleScene to handle damage
      this.scene.events.emit('geyserErupted', this.x, this.y, cfg.radius, cfg.damage);

      // End eruption after duration
      this.scene.time.delayedCall(cfg.eruptDuration, () => {
        if (this.eruptGfx) {
          this.eruptGfx.destroy();
          this.eruptGfx = null;
        }
        this.erupting = false;
      });
    }
  }

  /** Check if lava DoT tick is ready, and reset timer. Returns true if should apply damage. */
  shouldApplyLavaDot(): boolean {
    if (this.type !== 'LAVA_PIT') return false;
    if (this.dotTimer >= HAZARD.LAVA_PIT.tickMs) {
      this.dotTimer = 0;
      return true;
    }
    return false;
  }

  /** Spike trap takes damage (from hero impact). */
  applyDamage(amount: number) {
    if (this.type !== 'SPIKE_TRAP' || this.destroyed) return;
    this._hp -= amount;
    if (this._hp <= 0) this.destroy();
  }

  get hp() { return this._hp; }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.body) this.scene.matter.world.remove(this.body);
    this.graphics.destroy();
    if (this.eruptGfx) this.eruptGfx.destroy();
  }
}
