import Phaser from 'phaser';

/**
 * Spawns a floating number at (x, y) that rises and fades.
 * Call statically — no instance needed.
 */
export class DamageNumber {
  static show(
    scene: Phaser.Scene,
    x: number,
    y: number,
    amount: number,
    opts: { color?: string; prefix?: string; suffix?: string; text?: string; fontSize?: number } = {},
  ) {
    const { color = '#ffffff', prefix = '-', suffix = '', text, fontSize = 22 } = opts;
    const label = text ?? `${prefix}${Math.round(amount)}${suffix}`;
    const jitter = Phaser.Math.Between(-18, 18);

    const txt = scene.add.text(x + jitter, y - 8, label, {
      fontSize: `${fontSize}px`,
      fontStyle: 'bold',
      fontFamily: 'Nunito, sans-serif',
      color,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(50);

    scene.tweens.add({
      targets: txt,
      y: y - 65,
      alpha: 0,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 750,
      ease: 'Power2',
      onComplete: () => txt.destroy(),
    });
  }

  static damage(scene: Phaser.Scene, x: number, y: number, amount: number) {
    DamageNumber.show(scene, x, y, amount, { color: '#ff6b6b', prefix: '-' });
  }

  static blockDamage(scene: Phaser.Scene, x: number, y: number, amount: number) {
    DamageNumber.show(scene, x, y, amount, { color: '#f39c12', prefix: '-', fontSize: 18 });
  }

  static heal(scene: Phaser.Scene, x: number, y: number, amount: number) {
    DamageNumber.show(scene, x, y, amount, { color: '#2ecc71', prefix: '+', fontSize: 20 });
  }

  static bigHit(scene: Phaser.Scene, x: number, y: number, amount: number) {
    DamageNumber.show(scene, x, y, amount, { color: '#e74c3c', prefix: '-', fontSize: 32 });
  }

  /** Floating label for rare trigger procs (crit, backstab, revive, etc.) */
  static proc(scene: Phaser.Scene, x: number, y: number, label: string, color: string) {
    DamageNumber.show(scene, x, y, 0, { text: label, color, fontSize: 16 });
  }
}
