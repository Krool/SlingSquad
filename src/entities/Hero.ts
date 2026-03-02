import Phaser from 'phaser';
import {
  HERO_STATS, HeroClass, HERO_FRICTION_AIR, GAME_WIDTH, GAME_HEIGHT, SLING_X, SLING_Y,
  HERO_RESTITUTION_RANGER, HERO_RESTITUTION_DEFAULT,
  HERO_COMBAT_FRICTION_AIR, HERO_COMBAT_FRICTION,
} from '@/config/constants';
import type { GameBody } from '@/config/types';
import { mergeSkillEffects } from '@/data/skills';
import { hasRunState, getRunState } from '@/systems/RunState';

export type HeroState = 'queued' | 'flying' | 'combat' | 'dead';

export class Hero {
  readonly scene: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics };
  readonly heroClass: HeroClass;
  readonly stats: typeof HERO_STATS[HeroClass];
  body: GameBody | null = null;
  sprite: Phaser.GameObjects.Sprite | null = null;
  hpBarBg: Phaser.GameObjects.Graphics | null = null;
  hpBarFill: Phaser.GameObjects.Graphics | null = null;

  state: HeroState = 'queued';
  private _hp: number;
  maxHp: number;
  lastImpactTime = 0;   // cooldown guard — prevents multi-trigger within same frame
  combatTarget: import('./Enemy').Enemy | null = null;
  lastAttackTime = 0;

  // Walking AI state (managed by CombatSystem)
  walkDir = 1;         // +1 = right, -1 = left
  walkStuckMs = 0;     // accumulated ms without meaningful x movement
  lastWalkX = 0;       // x position at last movement update

  // Death save (relic: DEATH_SAVE)
  deathSavesRemaining = 0;

  // Slow state (ICE_MAGE projectile)
  slowUntil = 0;

  // Damage reduction (relic + Paladin innate)
  damageReduction = 0;

  // Divine Shield (Paladin passive — survives one lethal hit)
  hasDivineShield = false;

  // Rogue piercing — number of blocks remaining to pierce through
  piercing = 0;

  // Skill tree effect modifiers (merged from selected skills)
  skillMods: Record<string, number> = {};

  // Vanguard passive: true if this hero was the first launched in the battle
  isFirstLaunch = false;

  // Off-screen recovery (teleport back instead of dying)
  recoveryCount = 0;
  private static readonly MAX_RECOVERIES = 3;

  // Per-battle performance stats (auto-reset each battle since Hero instances are recreated)
  battleDamageDealt = 0;    // total enemy damage (impact + combat + projectile + thorns)
  battleImpactDamage = 0;   // enemy damage from sling impact only (ImpactSystem)
  battleBlockDamage = 0;
  battleEnemiesKilled = 0;
  battleHealingDone = 0;

  // Warrior gravity listener (applied via beforeupdate for correct timing)
  private _gravityListener: (() => void) | null = null;

  // Last known position (saved before body is destroyed on death, used by revive)
  private _lastX = SLING_X;
  private _lastY = SLING_Y;

  /** Persistent tint for heroes that reuse another class's sprite folder */
  static readonly CLASS_TINT: Partial<Record<HeroClass, number>> = {
    BARD:    0xffcc66,  // warm amber (shares SORCERESS with MAGE)
    ROGUE:   0xbb88ff,  // shadow purple (shares ASSASIN with RANGER)
    PALADIN: 0x77bbff,  // holy blue (shares WARRIOR with WARRIOR)
    DRUID:   0x77dd77,  // nature green (shares NECROMANCER with PRIEST)
  };

  constructor(
    scene: Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics },
    heroClass: HeroClass,
  ) {
    this.scene = scene;
    this.heroClass = heroClass;
    this.stats = HERO_STATS[heroClass];
    this._hp = this.stats.hp;
    this.maxHp = this.stats.hp;

    // Load skill tree bonuses from run state
    if (hasRunState()) {
      try {
        const heroData = getRunState().squad.find(h => h.heroClass === heroClass);
        this.skillMods = mergeSkillEffects(heroData?.selectedSkills ?? []);
      } catch { /* no run state */ }
    }
    if (this.skillMods.maxHpBonus) this.maxHp += this.skillMods.maxHpBonus;
    if (this.skillMods.damageReduction) this.damageReduction += this.skillMods.damageReduction;
  }

  /** Restore the persistent class tint (or clear if none). Call after temporary flash effects. */
  restoreTint() {
    const tint = Hero.CLASS_TINT[this.heroClass];
    if (tint) this.sprite?.setTint(tint);
    else this.sprite?.clearTint();
  }

  /** Increase max HP (relic bonus). Does not change current HP — call setStartHp after. */
  applyHpBonus(bonus: number) {
    this.maxHp += bonus;
  }

  setDeathSaves(n: number) {
    this.deathSavesRemaining = n;
  }

  applySlow(durationMs: number) {
    this.slowUntil = this.scene.time.now + durationMs;
  }

  get isSlowed(): boolean {
    return this.scene.time.now < this.slowUntil;
  }

  /** Set starting HP for this battle (persisted from RunState). Clamped to [1, maxHp]. */
  setStartHp(hp: number) {
    this._hp = Math.max(1, Math.min(hp, this.maxHp));
  }

  get hp() { return this._hp; }
  get x() { return this.body?.position.x ?? 0; }
  get y() { return this.body?.position.y ?? 0; }

  /** Spawn physics body at position with velocity */
  launch(x: number, y: number, vx: number, vy: number) {
    this.state = 'flying';
    const r = this.stats.radius;

    const restitution = this.heroClass === 'RANGER' ? HERO_RESTITUTION_RANGER : HERO_RESTITUTION_DEFAULT;
    this.body = this.scene.matter.add.circle(x, y, r, {
      density: 0.002 * this.stats.mass,
      restitution,
      friction: 0.5,
      frictionAir: HERO_FRICTION_AIR, // must match HERO_FRICTION_AIR for accurate trajectory preview
      label: `hero_${this.heroClass}`,
      // Heroes must NOT collide with each other — prevents hero #2 spawning inside
      // static hero #1 body at the sling and triggering an instant impact event.
      // Category 0x0002 = "hero". Mask ~0x0002 = everything except other heroes.
      // Ground (0x0001), blocks (0x0001), enemies (0x0001) all still collide normally.
      collisionFilter: { category: 0x0002, mask: ~0x0002 },
    }) as GameBody;
    this.body.__hero = this;

    // Warrior battering ram: skip engine gravity, apply reduced gravity via beforeupdate
    // event so the force is available in the same physics step (not 1 frame late).
    // This keeps the actual flight arc aligned with the trajectory preview.
    if (this.heroClass === 'WARRIOR') {
      (this.body as any).ignoreGravity = true;
      const warriorBody = this.body;
      const gravScale = HERO_STATS.WARRIOR.gravityScale + (this.skillMods?.gravityScaleBonus ?? 0);
      this._gravityListener = () => {
        if (warriorBody && this.state === 'flying') {
          warriorBody.force.y += warriorBody.mass * 1.08 * 0.001 * gravScale;
        }
      };
      this.scene.matter.world.on('beforeupdate', this._gravityListener);
    }

    this.scene.matter.setVelocity(this.body, vx, vy);

    // Spin proportional to launch speed; direction based on horizontal travel
    const spinDir = vx >= 0 ? 1 : -1;
    this.scene.matter.setAngularVelocity(this.body, spinDir * Math.hypot(vx, vy) * 0.08);

    const charKey = this.heroClass.toLowerCase();
    this.sprite = this.scene.add.sprite(x, y - r * 0.25, `${charKey}_idle_1`)
      .setDisplaySize(r * 2.5, r * 2.5);
    this.sprite.play(`${charKey}_jump`);
    this.restoreTint();
    this.initHpBar();
  }

  private initHpBar() {
    this.hpBarBg   = this.scene.add.graphics();
    this.hpBarFill = this.scene.add.graphics();
    this.drawHpBar();
  }

  private drawHpBar() {
    if (!this.hpBarBg || !this.hpBarFill) return;
    const w = 36, h = 5;
    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x2c3e50, 1);
    this.hpBarBg.fillRect(-w / 2, -this.stats.radius * 2 - 4, w, h);
    this.hpBarFill.clear();
    const pct = Math.max(0, this._hp / this.maxHp);
    const color = pct > 0.5 ? 0x2ecc71 : pct > 0.25 ? 0xf39c12 : 0xe74c3c;
    this.hpBarFill.fillStyle(color, 1);
    this.hpBarFill.fillRect(-w / 2, -this.stats.radius * 2 - 4, w * pct, h);
  }

  /** Remove warrior gravity listener when no longer flying */
  private _removeGravityListener() {
    if (this._gravityListener) {
      this.scene.matter.world.off('beforeupdate', this._gravityListener);
      this._gravityListener = null;
    }
  }

  /** Switch from flying projectile to grounded combat unit */
  enterCombat() {
    if (this.state !== 'flying' || !this.body) return;
    this.state = 'combat';
    this._removeGravityListener();
    this.scene.events.emit('heroLanded', this.body.position.x, this.body.position.y);
    // Increase friction so hero slows on rubble but stays dynamic — allows terrain traversal
    if (this.body) {
      this.body.frictionAir = HERO_COMBAT_FRICTION_AIR;
      this.body.friction = HERO_COMBAT_FRICTION;
    }
    const charKey = this.heroClass.toLowerCase();
    if (this.sprite) {
      this.sprite.setRotation(0);
      // Start with idle — CombatSystem switches to attack only when actually swinging
      this.sprite.play(`${charKey}_idle`);
    }
    this.drawHpBar();
  }

  /** Apply healing — updates HP bar and triggers a green flash */
  heal(amount: number) {
    if (this.state === 'dead') return;
    this._hp = Math.min(this.maxHp, this._hp + amount);
    this.drawHpBar();
    if (this.sprite) {
      this.sprite.setTint(0x44ff88);
      this.scene.time.delayedCall(200, () => {
        if (this.state !== 'dead') this.restoreTint();
      });
    }
  }

  applyDamage(amount: number) {
    if (this.state === 'dead') return;
    // Damage reduction (relic + Paladin innate). Negative values = curse (take MORE damage).
    let finalAmount = amount;
    if (this.damageReduction !== 0) {
      finalAmount = amount * (1 - this.damageReduction);
    }
    this._hp = Math.max(0, this._hp - finalAmount);
    this.drawHpBar();
    // Hit flash — red tint then clear
    if (this.sprite) {
      this.sprite.setTint(0xff4444);
      this.scene.time.delayedCall(120, () => {
        if (this.state !== 'dead') this.restoreTint();
      });
    }
    if (this._hp <= 0) {
      // Divine Shield (Paladin passive): survive one lethal hit
      if (this.hasDivineShield) {
        this._hp = 1;
        this.hasDivineShield = false;
        this.drawHpBar();
        // Gold flash to indicate shield consumed
        if (this.sprite) {
          this.sprite.setTint(0xf1c40f);
          this.scene.time.delayedCall(300, () => {
            if (this.state !== 'dead') this.restoreTint();
          });
        }
        return;
      }
      // Death save (relic): survive at 1 HP
      if (this.deathSavesRemaining > 0) {
        this._hp = 1;
        this.deathSavesRemaining--;
        this.drawHpBar();
        return;
      }
      this.die();
    }
  }

  die() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this._removeGravityListener();
    this.scene.events.emit('heroDied', this);
    if (this.body) {
      this._lastX = this.body.position.x;
      this._lastY = this.body.position.y;
      try { this.scene.matter.world.remove(this.body); } catch { /* */ }
      this.body = null;
    }
    if (this.sprite) {
      this.sprite.setRotation(0);
      this.sprite.play(`${this.heroClass.toLowerCase()}_defeat`);
      this.sprite.once('animationcomplete', () => {
        this.sprite?.destroy();
        this.sprite = null;
      });
    }
    this.hpBarBg?.destroy();
    this.hpBarFill?.destroy();
  }

  /** Revive a dead hero (Priest resurrect relic). Restores state, physics body, HP bar, and sprite. */
  revive(hp: number) {
    if (this.state !== 'dead') return;
    this._hp = Math.max(1, Math.min(hp, this.maxHp));
    // Use last known position (saved before body was destroyed)
    const rx = this._lastX;
    const ry = this._lastY;
    // Re-create physics body so hero can walk and take damage
    const r = this.stats.radius;
    this.body = this.scene.matter.add.circle(rx, ry, r, {
      density: 0.002 * this.stats.mass,
      restitution: 0.25,
      friction: 0.9,
      frictionAir: 0.07,
      label: `hero_${this.heroClass}`,
      collisionFilter: { category: 0x0002, mask: ~0x0002 },
    }) as GameBody;
    this.body.__hero = this;
    // Re-create sprite
    const charKey = this.heroClass.toLowerCase();
    this.sprite = this.scene.add.sprite(rx, ry - r * 0.25, `${charKey}_idle_1`)
      .setDisplaySize(r * 2.5, r * 2.5);
    this.sprite.play(`${charKey}_idle`);
    // Green flash on revive, then restore class tint
    this.sprite.setTint(0x44ff88);
    this.scene.time.delayedCall(400, () => {
      if (this.state !== 'dead') this.restoreTint();
    });
    this.initHpBar();
    this.state = 'combat';
  }

  /** Teleport hero back to ground instead of dying when off-screen */
  recover() {
    this.recoveryCount++;
    if (this.recoveryCount > Hero.MAX_RECOVERIES) {
      this.die();
      return;
    }
    this._removeGravityListener();
    const groundY = GAME_HEIGHT - 100;
    const safeX = SLING_X + 60 + this.recoveryCount * 30;
    const safeY = groundY - this.stats.radius;
    if (this.body) {
      this.scene.matter.body.setPosition(this.body, { x: safeX, y: safeY });
      this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 });
      this.scene.matter.body.setAngularVelocity(this.body, 0);
    }
    if (this.state === 'flying') {
      this.enterCombat();
    }
    // Blue flash to signal recovery teleport
    if (this.sprite) {
      this.sprite.setTint(0x5dade2);
      this.scene.time.delayedCall(300, () => {
        if (this.state !== 'dead') this.restoreTint();
      });
    }
  }

  update() {
    if (!this.body || this.state === 'dead') return;
    const { x, y } = this.body.position;
    const angle = this.body.angle;

    // Offset sprite up so feet align with the bottom of the physics circle
    this.sprite?.setPosition(x, y - this.stats.radius * 0.25);
    if (this.state === 'flying') this.sprite?.setRotation(angle);
    this.hpBarBg?.setPosition(x, y);
    this.hpBarFill?.setPosition(x, y);

    // Out-of-bounds handling — recover instead of dying
    if (this.state === 'flying') {
      if (y > GAME_HEIGHT + 80) {
        this.recover();
        return;
      }
      if (x < -300 || x > GAME_WIDTH + 300) {
        this.recover();
        return;
      }
    }

    // Non-static combat heroes can slide off the world
    if (this.state === 'combat') {
      if (y > GAME_HEIGHT + 120 || x < -400 || x > GAME_WIDTH + 400) {
        this.recover();
        return;
      }
    }

    // Check if hero has settled (low velocity) — enter combat
    if (this.state === 'flying') {
      const speed = Math.hypot(this.body.velocity.x, this.body.velocity.y);
      if (speed < 0.5) this.enterCombat();
    }
  }

  /** Used by combat system to apply a melee attack to nearest enemy */
  canAttack(now: number): boolean {
    return now - this.lastAttackTime >= this.stats.combatSpeed;
  }
}
