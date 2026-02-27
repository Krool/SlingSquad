import Phaser from 'phaser';
import { ENEMY_STATS, EnemyClass } from '@/config/constants';
import type { Hero } from './Hero';

export type EnemyState = 'idle' | 'combat' | 'dead';

export class Enemy {
  readonly scene: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics };
  readonly enemyClass: EnemyClass;
  readonly stats: typeof ENEMY_STATS[EnemyClass];
  readonly body: MatterJS.BodyType;
  sprite: Phaser.GameObjects.Sprite;
  hpBarBg: Phaser.GameObjects.Graphics;
  hpBarFill: Phaser.GameObjects.Graphics;

  state: EnemyState = 'idle';
  private _hp: number;
  readonly maxHp: number;
  combatTarget: import('./Hero').Hero | null = null;
  lastAttackTime = 0;
  // For ranged: projectile cooldown
  lastShotTime = 0;
  // Bomber: rushing toward a hero
  isRushing = false;
  rushTarget: import('./Hero').Hero | null = null;
  // Healer: last heal timestamp
  lastHealTime = 0;
  // Charmed: attacks other enemies instead of heroes
  charmed = false;
  charmEndTime = 0;
  // Last hero that dealt damage — used for kill attribution
  lastDamagedBy: Hero | null = null;

  constructor(
    scene: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics },
    x: number,
    y: number,
    enemyClass: EnemyClass,
    hpMult = 1.0,
  ) {
    this.scene = scene;
    this.enemyClass = enemyClass;
    this.stats = ENEMY_STATS[enemyClass];
    this._hp = Math.round(this.stats.hp * hpMult);
    this.maxHp = this._hp;

    const r = this.stats.radius;
    this.body = scene.matter.add.circle(x, y, r, {
      isStatic: true,
      label: `enemy_${enemyClass}`,
      isSensor: false,
    }) as MatterJS.BodyType;
    (this.body as any).__enemy = this;

    const charKey = enemyClass.toLowerCase();
    this.sprite = scene.add.sprite(x, y - r * 0.25, `${charKey}_idle_1`)
      .setFlipX(true)
      .setDisplaySize(r * 2.5, r * 2.5);
    this.sprite.play(`${charKey}_idle`);

    // Visual differentiation for reused sprite folders
    if (enemyClass === 'SHIELD') this.sprite.setTint(0x5588cc);
    if (enemyClass === 'BOMBER') this.sprite.setTint(0xbb66dd);
    if (enemyClass === 'HEALER') this.sprite.setTint(0x55cc88);
    if (enemyClass === 'ICE_MAGE') this.sprite.setTint(0x74b9ff);
    if (enemyClass === 'YETI') this.sprite.setTint(0xdfe6e9);
    if (enemyClass === 'FROST_ARCHER') this.sprite.setTint(0xa29bfe);
    if (enemyClass === 'FIRE_IMP') this.sprite.setTint(0xfd79a8);
    if (enemyClass === 'DEMON_KNIGHT') this.sprite.setTint(0xd63031);
    if (enemyClass === 'INFERNAL_BOSS') {
      this.sprite.setTint(0x6c5ce7);
      this.sprite.setDisplaySize(r * 2.8, r * 2.8);
    }
    if (enemyClass === 'BOSS_GRUNT') {
      this.sprite.setTint(0xff4444);
      this.sprite.setDisplaySize(r * 2.8, r * 2.8); // bigger sprite for boss variant
    }

    this.hpBarBg   = scene.add.graphics();
    this.hpBarFill = scene.add.graphics();
    this.drawHpBar();
  }

  get hp() { return this._hp; }
  get x() { return this.body.position.x; }
  get y() { return this.body.position.y; }

  private drawHpBar() {
    const w = 36, h = 5;
    const { x, y } = this.body.position;
    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x2c3e50, 1);
    this.hpBarBg.fillRect(x - w / 2, y - this.stats.radius * 2 - 4, w, h);
    this.hpBarFill.clear();
    const pct = Math.max(0, this._hp / this.maxHp);
    const color = pct > 0.5 ? 0xe74c3c : pct > 0.25 ? 0xe67e22 : 0xf39c12;
    this.hpBarFill.fillStyle(color, 1);
    this.hpBarFill.fillRect(x - w / 2, y - this.stats.radius * 2 - 4, w * pct, h);
  }

  /** Apply damage. sourceX is the attacker x position (for shield direction check). */
  applyDamage(amount: number, sourceX?: number, sourceHero?: Hero) {
    if (this.state === 'dead') return;
    if (sourceHero) this.lastDamagedBy = sourceHero;

    let finalAmount = amount;
    // Shield: reduces frontal damage (from the left / hero side)
    if (this.enemyClass === 'SHIELD' && sourceX !== undefined) {
      const fromLeft = sourceX < this.x;
      if (fromLeft) {
        const reduction = (this.stats as any).frontDamageReduction ?? 0;
        finalAmount = amount * (1 - reduction);
      }
    }

    this._hp = Math.max(0, this._hp - finalAmount);
    this.drawHpBar();
    // Hit flash — red tint then clear
    this.sprite.setTint(0xff4444);
    this.scene.time.delayedCall(120, () => {
      if (this.state !== 'dead') this.restoreTint();
    });
    // DEMON_KNIGHT thorns: reflect a fraction of damage taken back to attacker
    if (this.enemyClass === 'DEMON_KNIGHT' && finalAmount > 0) {
      const thornsFraction = (this.stats as any).thornsReflect ?? 0;
      if (thornsFraction > 0) {
        this.scene.events.emit('thornsReflect', this.x, this.y, finalAmount * thornsFraction);
      }
    }
    if (this.state === 'idle') this.enterCombat();
    if (this._hp <= 0) this.die();
  }

  /** Restore the class-specific tint after hit flash */
  restoreTint() {
    const tintMap: Partial<Record<EnemyClass, number>> = {
      SHIELD: 0x5588cc, BOMBER: 0xbb66dd, HEALER: 0x55cc88, BOSS_GRUNT: 0xff4444,
      ICE_MAGE: 0x74b9ff, YETI: 0xdfe6e9, FROST_ARCHER: 0xa29bfe,
      FIRE_IMP: 0xfd79a8, DEMON_KNIGHT: 0xd63031, INFERNAL_BOSS: 0x6c5ce7,
    };
    const tint = tintMap[this.enemyClass];
    if (tint) this.sprite?.setTint(tint);
    else this.sprite?.clearTint();
  }

  die() {
    if (this.state === 'dead') return;
    this.state = 'dead';

    // Bomber / Fire Imp: explode on death dealing AoE damage
    if (this.enemyClass === 'BOMBER' || this.enemyClass === 'FIRE_IMP') {
      const stats = this.stats as typeof this.stats & { explosionRadius: number; explosionDamage: number };
      this.scene.events.emit('bomberExploded', this.x, this.y, stats.explosionRadius, stats.explosionDamage);
    }

    this.scene.events.emit('enemyDied', this, this.lastDamagedBy);
    try { this.scene.matter.world.remove(this.body); } catch { /* */ }

    // Destroy HP bars immediately
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();

    // Burst particles
    this.spawnDeathParticles();

    // Play defeat anim; flash white and pop-scale to zero
    this.sprite.play(`${this.enemyClass.toLowerCase()}_defeat`);
    this.sprite.setTintFill(0xffffff);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 380,
      ease: 'Power2',
      onComplete: () => this.sprite.destroy(),
    });
  }

  private spawnDeathParticles() {
    const { x, y } = this.body.position;
    const col = this.stats.color;
    for (let i = 0; i < 8; i++) {
      const g = this.scene.add.graphics().setDepth(20);
      g.fillStyle(col, 1);
      g.fillCircle(0, 0, Phaser.Math.Between(3, 6));
      g.setPosition(x, y);
      const angle = (i / 8) * Math.PI * 2;
      const dist = Phaser.Math.Between(40, 110);
      this.scene.tweens.add({
        targets: g,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: Phaser.Math.Between(280, 480),
        ease: 'Power2',
        onComplete: () => g.destroy(),
      });
    }
  }

  /** Heal this enemy by the given amount, clamped to maxHp. */
  heal(amount: number) {
    if (this.state === 'dead') return;
    this._hp = Math.min(this.maxHp, this._hp + amount);
    this.drawHpBar();
    // Green flash
    this.sprite?.setTint(0x44ff88);
    this.scene.time.delayedCall(200, () => {
      if (this.state !== 'dead') this.restoreTint();
    });
  }

  /** Switch from idle stance to active combat — CombatSystem controls attack anim */
  enterCombat() {
    if (this.state !== 'idle') return;
    this.state = 'combat';
    // Stay on idle anim — CombatSystem switches to attack only when actually swinging
    this.sprite.play(`${this.enemyClass.toLowerCase()}_idle`);
  }

  canAttack(now: number): boolean {
    return now - this.lastAttackTime >= this.stats.combatSpeed;
  }

  update() {
    if (this.state === 'dead') return;
    const { x, y } = this.body.position;
    this.sprite.setPosition(x, y - this.stats.radius * 0.25);
    this.drawHpBar();
  }
}
