import Phaser from 'phaser';
import { STALL_TIMEOUT_MS, STALL_WARN_MS } from '@/config/constants';

export class TimeoutSystem {
  private scene: Phaser.Scene;
  private remaining = STALL_TIMEOUT_MS;
  private active = false;
  private countdownText: Phaser.GameObjects.Text;
  private warnBg: Phaser.GameObjects.Rectangle;

  onTimeout?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.warnBg = scene.add.rectangle(scene.scale.width / 2, 60, 300, 50, 0x8B0000, 0)
      .setDepth(50);
    this.countdownText = scene.add.text(scene.scale.width / 2, 60, '', {
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#e74c3c',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(51).setAlpha(0);
  }

  /** Call after last hero is launched */
  start() {
    this.active = true;
    this.remaining = STALL_TIMEOUT_MS;
  }

  /** Call on any damage event to reset the clock */
  resetOnDamage() {
    if (!this.active) return;
    this.remaining = STALL_TIMEOUT_MS;
    this.countdownText.setAlpha(0);
    this.warnBg.setFillStyle(0x8B0000, 0);
  }

  stop() {
    this.active = false;
    this.countdownText.destroy();
    this.warnBg.destroy();
  }

  update(delta: number) {
    if (!this.active) return;
    this.remaining = Math.max(0, this.remaining - delta);

    if (this.remaining <= STALL_WARN_MS) {
      const secs = Math.ceil(this.remaining / 1000);
      this.countdownText.setText(`Stalling! ${secs}s`).setAlpha(1);
      this.warnBg.setFillStyle(0x8B0000, 0.4);
      // Pulse
      const pulse = 0.8 + 0.2 * Math.sin(this.scene.time.now / 200);
      this.countdownText.setScale(pulse);
    }

    if (this.remaining <= 0) {
      this.active = false;
      this.onTimeout?.();
    }
  }
}
