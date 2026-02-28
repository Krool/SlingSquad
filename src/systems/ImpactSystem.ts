import Phaser from 'phaser';
import { Hero } from '@/entities/Hero';
import { Enemy } from '@/entities/Enemy';
import { Block } from '@/entities/Block';
import { Barrel } from '@/entities/Barrel';
import { Projectile } from '@/entities/Projectile';
import { CombatSystem } from './CombatSystem';
import { HERO_STATS, BARREL_EXPLOSION_FORCE } from '@/config/constants';
import { getRelicModifiers } from '@/systems/RunState';

type MatterScene = Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics };

export class ImpactSystem {
  private scene: MatterScene;
  private combatSystem: CombatSystem;
  private readonly relicMods: ReturnType<typeof getRelicModifiers>;
  private _impactForce = 0;
  private heroes: Hero[] = [];

  onDamageEvent?: () => void;
  /** Emit 'blockDamage' or 'unitDamage' events so BattleScene shows floating numbers */
  private emitDamage(x: number, y: number, amount: number, isUnit = false) {
    this.scene.events.emit(isUnit ? 'unitDamage' : 'blockDamage', x, y, Math.round(amount));
  }

  constructor(scene: MatterScene, combatSystem: CombatSystem, heroes?: Hero[]) {
    this.scene = scene;
    this.combatSystem = combatSystem;
    this.relicMods = getRelicModifiers();
    this.heroes = heroes ?? [];
  }

  /** Wake a sleeping Matter.js body (isSleeping/sleepCounter are valid but not always in Phaser's type defs). */
  private wakeBody(body: MatterJS.BodyType) {
    const b = body as MatterJS.BodyType & { isSleeping: boolean; sleepCounter: number };
    if (b.isSleeping) {
      b.isSleeping = false;
      b.sleepCounter = 0;
    }
  }

  /** Floor: 20 * mult. Cap: 70 * mult. Force-scaled landing damage helper. */
  private calcImpact(multiplier: number, materialBonus = 0): number {
    const base = Math.min(70, this._impactForce * 0.4 + 20) * multiplier;
    return base * (1 + this.relicMods.impactDamageBonus) * (1 + materialBonus);
  }

  /**
   * Called when a flying hero body collides with something.
   * Returns true if impact was handled (hero should enter combat).
   */
  handleHeroImpact(
    hero: Hero,
    impactForce: number,
    blocks: Block[],
    enemies: Enemy[],
    barrels: Barrel[],
  ): boolean {
    if (hero.state !== 'flying') return false;
    hero.lastImpactTime = this.scene.time.now;

    this._impactForce = impactForce;
    switch (hero.heroClass) {
      case 'WARRIOR': this.warriorImpact(hero, blocks, enemies); break;
      case 'RANGER':  this.rangerImpact(hero, blocks, enemies); break;
      case 'MAGE':    this.mageImpact(hero, blocks, enemies, barrels); break;
      case 'PRIEST':  this.priestImpact(hero, blocks, enemies); break;
      case 'BARD':    this.bardImpact(hero, blocks, enemies); break;
      case 'ROGUE':   this.rogueImpact(hero, blocks, enemies); break;
      case 'PALADIN': this.paladinImpact(hero, blocks, enemies); break;
      case 'DRUID':   this.druidImpact(hero, blocks, enemies); break;
    }

    this.onDamageEvent?.();
    return true;
  }

  // ─── WARRIOR ──────────────────────────────────────────────────────────────
  private warriorImpact(hero: Hero, blocks: Block[], enemies: Enemy[]) {
    const { x, y } = hero.body!.position;
    const stats = HERO_STATS.WARRIOR;
    // Vanguard passive: +25% impact on first launch
    const vanguardMult = hero.isFirstLaunch ? 1.25 : 1.0;
    const dmg = this.calcImpact(stats.impactMultiplier) * vanguardMult;
    const knockbackBonus = this.relicMods.warriorKnockback;

    // Extra force applied to nearby blocks
    for (const b of blocks) {
      const bx = b.body.position.x, by = b.body.position.y;
      const d = Math.hypot(bx - x, by - y);
      if (d > 80) continue;
      // Stone damage bonus relic
      const matBonus = b.material === 'STONE' ? this.relicMods.stoneDamageBonus : 0;
      const mult = stats.impactDamageBonus * this.relicMods.warriorImpactMult;
      const dealt = dmg * mult * (1 - d / 80) * (1 + matBonus);
      b.applyDamage(dealt);
      hero.battleBlockDamage += dealt;
      this.emitDamage(bx, by, dealt);
      // Push block outward (+ knockback relic bonus)
      if (!b.destroyed) {
        const nx = (bx - x) / Math.max(d, 1);
        const ny = (by - y) / Math.max(d, 1);
        const kb = 1 + knockbackBonus;
        this.scene.matter.applyForce(b.body, { x: nx * 0.08 * kb, y: ny * 0.06 * kb });
      }
    }
    // Damage nearby enemies (+ knockback)
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < 80) {
        const dealt = dmg * (1 - d / 80);
        e.applyDamage(dealt, undefined, hero);
        hero.battleDamageDealt += dealt;
        this.emitDamage(e.x, e.y, dealt, true);
      }
    }

    this.spawnImpactParticles(x, y, 0xc0392b, 12);
    this.spawnShockwave(x, y, 80, 0xc0392b);
  }

  // ─── RANGER ───────────────────────────────────────────────────────────────
  private rangerImpact(hero: Hero, blocks: Block[], enemies: Enemy[]) {
    const { x, y } = hero.body!.position;
    const stats = HERO_STATS.RANGER;

    // Body-crash landing damage (1x warrior baseline, 70px radius)
    const crashDmg = this.calcImpact(stats.impactMultiplier);
    for (const b of blocks) {
      const d = Math.hypot(b.body.position.x - x, b.body.position.y - y);
      if (d < 70) {
        const dealt = crashDmg * (1 - d / 70);
        b.applyDamage(dealt);
        hero.battleBlockDamage += dealt;
        this.emitDamage(b.body.position.x, b.body.position.y, dealt);
      }
    }
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < 70) {
        const dealt = crashDmg * (1 - d / 70);
        e.applyDamage(dealt, undefined, hero);
        hero.battleDamageDealt += dealt;
        this.emitDamage(e.x, e.y, dealt, true);
      }
    }

    const totalArrows = stats.arrowCount + this.relicMods.rangerArrowBonus;
    const spreadAngles = totalArrows === 1
      ? [0]
      : Array.from({ length: totalArrows }, (_, i) => -25 + (i / (totalArrows - 1)) * 50);

    // Aim toward nearest living enemy; default rightward if none
    let aimAngle = 0;
    let closestDist = Infinity;
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < closestDist) { closestDist = d; aimAngle = Math.atan2(e.y - y, e.x - x); }
    }

    const poisonDmg = this.relicMods.rangerPoisonDamage;
    for (const spreadDeg of spreadAngles) {
      const angleRad = aimAngle + Phaser.Math.DegToRad(spreadDeg);
      const speed = stats.arrowSpeed / 60;
      const vx = Math.cos(angleRad) * speed;
      const vy = Math.sin(angleRad) * speed;
      const p = new Projectile(this.scene, x, y, vx, vy, stats.arrowDamage, 0x27ae60);
      p.sourceHero = hero;
      if (poisonDmg > 0) (p as Projectile & { poisonDamage: number }).poisonDamage = poisonDmg;
      this.combatSystem.addProjectile(p);
    }

    this.spawnImpactParticles(x, y, 0x27ae60, 6);
  }

  // ─── MAGE ─────────────────────────────────────────────────────────────────
  private mageImpact(hero: Hero, blocks: Block[], enemies: Enemy[], barrels: Barrel[]) {
    const { x, y } = hero.body!.position;
    const stats = HERO_STATS.MAGE;
    const r = stats.aoeRadius + this.relicMods.mageAoeRadiusBonus;
    const mageDmg = this.calcImpact(stats.impactMultiplier);

    // Damage blocks in radius
    for (const b of blocks) {
      const d = Math.hypot(b.body.position.x - x, b.body.position.y - y);
      if (d < r) {
        const matBonus = b.material === 'STONE' ? this.relicMods.stoneDamageBonus : 0;
        const dealt = mageDmg * (1 - d / r) * (1 + matBonus);
        b.applyDamage(dealt);
        hero.battleBlockDamage += dealt;
        this.emitDamage(b.body.position.x, b.body.position.y, dealt);
      }
    }
    // Damage enemies in radius
    const hitEnemies: Enemy[] = [];
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < r) {
        const dealt = mageDmg * (1 - d / r);
        e.applyDamage(dealt, undefined, hero);
        hero.battleDamageDealt += dealt;
        this.emitDamage(e.x, e.y, dealt, true);
        hitEnemies.push(e);
      }
    }
    // Trigger barrels in radius
    for (const barrel of barrels) {
      if (barrel.exploded) continue;
      const d = Math.hypot(barrel.body.position.x - x, barrel.body.position.y - y);
      if (d < r) barrel.explode();
    }

    // Chain Lightning relic: chain to additional enemies outside the AoE
    if (this.relicMods.mageChainTargets > 0) {
      let chains = this.relicMods.mageChainTargets;
      const chainDmg = mageDmg * 0.5;
      for (const e of enemies) {
        if (chains <= 0) break;
        if (e.state === 'dead' || hitEnemies.includes(e)) continue;
        e.applyDamage(chainDmg, undefined, hero);
        hero.battleDamageDealt += chainDmg;
        this.emitDamage(e.x, e.y, chainDmg, true);
        this.spawnChainLightning(x, y, e.x, e.y);
        chains--;
      }
    }

    this.scene.events.emit('mageExplosion', x, y, r);

    // Cluster grenade: spawn bomblets that radiate outward from impact point
    this.scene.events.emit('mageClusterSpawn', x, y, hero);
  }

  private spawnChainLightning(fromX: number, fromY: number, toX: number, toY: number) {
    const g = this.scene.add.graphics().setDepth(21);
    g.lineStyle(2, 0x7ec8e3, 0.8);
    g.lineBetween(fromX, fromY, toX, toY);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() });
  }

  // ─── PRIEST ───────────────────────────────────────────────────────────────
  private priestImpact(hero: Hero, blocks: Block[], enemies: Enemy[]) {
    const { x, y } = hero.body!.position;
    const stats = HERO_STATS.PRIEST;

    // Small landing impact (0.5x warrior baseline, 90px radius)
    const crashDmg = this.calcImpact(stats.impactMultiplier);
    for (const b of blocks) {
      const d = Math.hypot(b.body.position.x - x, b.body.position.y - y);
      if (d < 90) {
        const dealt = crashDmg * (1 - d / 90);
        b.applyDamage(dealt);
        hero.battleBlockDamage += dealt;
        this.emitDamage(b.body.position.x, b.body.position.y, dealt);
      }
    }
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < 90) {
        const dealt = crashDmg * (1 - d / 90);
        e.applyDamage(dealt, undefined, hero);
        hero.battleDamageDealt += dealt;
        this.emitDamage(e.x, e.y, dealt, true);
      }
    }
    this.spawnImpactParticles(x, y, 0xffe066, 8);  // gold particles

    const healRadius = stats.healRadius + this.relicMods.priestHealRadiusBonus;
    const healAmount = stats.healAmount + this.relicMods.priestHealBonus;
    this.scene.events.emit('priestHealAura', x, y, healRadius, healAmount, hero);
    this.spawnHealAura(x, y, healRadius);

    // Priest resurrect relic: revive dead heroes within heal radius
    if (this.relicMods.priestResurrectPct > 0) {
      for (const h of this.heroes) {
        if (h.state !== 'dead') continue;
        // Approximate position check — dead heroes may not have a body
        const hx = h.body?.position.x ?? h.x;
        const hy = h.body?.position.y ?? h.y;
        const d = Math.hypot(hx - x, hy - y);
        if (d < healRadius) {
          h.revive(Math.round(h.maxHp * this.relicMods.priestResurrectPct));
        }
      }
    }
  }

  // ─── BARD ────────────────────────────────────────────────────────────────
  private bardImpact(hero: Hero, blocks: Block[], enemies: Enemy[]) {
    const { x, y } = hero.body!.position;
    const bardStats = HERO_STATS.BARD;
    const charmRadius = bardStats.charmRadius + this.relicMods.bardCharmBonus;
    const charmDuration = bardStats.charmDurationMs;

    // Small landing damage (0.8x base, 80px radius)
    const crashDmg = this.calcImpact(bardStats.impactMultiplier);
    for (const b of blocks) {
      const d = Math.hypot(b.body.position.x - x, b.body.position.y - y);
      if (d < 80) {
        const dealt = crashDmg * (1 - d / 80);
        b.applyDamage(dealt);
        hero.battleBlockDamage += dealt;
        this.emitDamage(b.body.position.x, b.body.position.y, dealt);
      }
    }
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < 80) {
        const dealt = crashDmg * (1 - d / 80);
        e.applyDamage(dealt, undefined, hero);
        hero.battleDamageDealt += dealt;
        this.emitDamage(e.x, e.y, dealt, true);
      }
    }

    // Charm: enemies in radius attack other enemies for duration
    const now = this.scene.time.now;
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < charmRadius) {
        e.charmed = true;
        e.charmEndTime = now + charmDuration;
        // Visual: purple tint while charmed
        e.sprite?.setTint(0xcc66ff);
      }
    }

    this.spawnCharmWave(x, y, charmRadius);
    this.spawnImpactParticles(x, y, 0x1abc9c, 10);
  }

  private spawnCharmWave(x: number, y: number, radius: number) {
    const g = this.scene.add.graphics().setDepth(19);
    const target = { r: 0 };
    this.scene.tweens.add({
      targets: target,
      r: radius,
      duration: 400,
      onUpdate: (t) => {
        g.clear();
        g.fillStyle(0xcc66ff, 0.15 * (1 - t.progress));
        g.fillCircle(x, y, target.r);
        g.lineStyle(2, 0xcc66ff, 0.6 * (1 - t.progress));
        g.strokeCircle(x, y, target.r);
      },
      onComplete: () => g.destroy(),
    });
  }

  // ─── ROGUE ───────────────────────────────────────────────────────────────
  private rogueImpact(hero: Hero, blocks: Block[], enemies: Enemy[]) {
    const { x, y } = hero.body!.position;
    const stats = HERO_STATS.ROGUE;
    const crashDmg = this.calcImpact(stats.impactMultiplier);

    // Piercing flag is set in LaunchSystem.doLaunch() so it's active before the first collision.
    // rogueImpact fires on the collision that triggers impact; by then piercing has already been
    // consumed by processCollisionPair. No need to set it here.

    // Landing damage in small radius
    for (const b of blocks) {
      const d = Math.hypot(b.body.position.x - x, b.body.position.y - y);
      if (d < 60) {
        const dealt = crashDmg * (1 - d / 60);
        b.applyDamage(dealt);
        hero.battleBlockDamage += dealt;
        this.emitDamage(b.body.position.x, b.body.position.y, dealt);
      }
    }
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < 60) {
        // Backstab passive: 2x damage if Rogue lands behind the enemy.
        // Enemies face left (flipX=true) by default. "Behind" = Rogue is to the enemy's right.
        const isBehind = x > e.x;
        const backstab = isBehind ? 2.0 : 1.0;
        const dealt = crashDmg * (1 - d / 60) * backstab;
        e.applyDamage(dealt, undefined, hero);
        hero.battleDamageDealt += dealt;
        this.emitDamage(e.x, e.y, dealt, true);
      }
    }
    this.spawnImpactParticles(x, y, 0x2c3e50, 8);
    this.spawnShockwave(x, y, 60, 0x2c3e50);
  }

  // ─── PALADIN ─────────────────────────────────────────────────────────────
  private paladinImpact(hero: Hero, blocks: Block[], enemies: Enemy[]) {
    const { x, y } = hero.body!.position;
    const stats = HERO_STATS.PALADIN;
    const crashDmg = this.calcImpact(stats.impactMultiplier);

    // Heavy impact in 80px radius
    for (const b of blocks) {
      const d = Math.hypot(b.body.position.x - x, b.body.position.y - y);
      if (d < 80) {
        const dealt = crashDmg * (1 - d / 80);
        b.applyDamage(dealt);
        hero.battleBlockDamage += dealt;
        this.emitDamage(b.body.position.x, b.body.position.y, dealt);
      }
    }
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < 80) {
        const dealt = crashDmg * (1 - d / 80);
        e.applyDamage(dealt, undefined, hero);
        hero.battleDamageDealt += dealt;
        this.emitDamage(e.x, e.y, dealt, true);
      }
    }

    // Spawn temporary shield wall (3 blocks in front)
    const wallCount = stats.shieldWallBlocks;
    for (let i = 0; i < wallCount; i++) {
      const wx = x + 30 + i * 28;
      const wy = y - 20;
      // Spawn a temporary wood block via scene event
      this.scene.events.emit('spawnTempBlock', wx, wy, 'WOOD');
    }

    this.spawnImpactParticles(x, y, 0xf1c40f, 12);
    this.spawnShockwave(x, y, 80, 0xf1c40f);
  }

  // ─── DRUID ──────────────────────────────────────────────────────────────
  private druidImpact(hero: Hero, blocks: Block[], enemies: Enemy[]) {
    const { x, y } = hero.body!.position;
    const stats = HERO_STATS.DRUID;
    const crashDmg = this.calcImpact(stats.impactMultiplier);

    // Landing damage — Nature's Wrath passive: +30% to wood blocks
    for (const b of blocks) {
      const d = Math.hypot(b.body.position.x - x, b.body.position.y - y);
      if (d < 70) {
        const woodBonus = b.material === 'WOOD' ? 1.3 : 1.0;
        const dealt = crashDmg * (1 - d / 70) * woodBonus;
        b.applyDamage(dealt);
        hero.battleBlockDamage += dealt;
        this.emitDamage(b.body.position.x, b.body.position.y, dealt);
      }
    }
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < 70) {
        const dealt = crashDmg * (1 - d / 70);
        e.applyDamage(dealt, undefined, hero);
        hero.battleDamageDealt += dealt;
        this.emitDamage(e.x, e.y, dealt, true);
      }
    }

    // Spawn wolf minions — emitted to BattleScene for entity creation
    const wolfCount = stats.wolfCount;
    for (let i = 0; i < wolfCount; i++) {
      const wx = x + Phaser.Math.Between(-40, 40);
      const wy = y - Phaser.Math.Between(10, 30);
      this.scene.events.emit('spawnWolf', wx, wy, stats.wolfDamage, stats.wolfHp, hero);
    }

    this.spawnImpactParticles(x, y, 0x16a085, 10);
    this.spawnShockwave(x, y, 70, 0x16a085);
  }

  // ─── Barrel explosion handler ──────────────────────────────────────────────
  handleBarrelExplosion(
    bx: number, by: number, radius: number, damage: number,
    blocks: Block[], enemies: Enemy[], heroes: Hero[], barrels: Barrel[],
  ) {
    for (const b of blocks) {
      if (b.destroyed) continue;
      const d = Math.hypot(b.body.position.x - bx, b.body.position.y - by);
      if (d < radius) b.applyDamage(damage * (1 - d / radius));
    }
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const d = Math.hypot(e.x - bx, e.y - by);
      if (d < radius) e.applyDamage(damage * (1 - d / radius));
    }
    for (const h of heroes) {
      if (h.state === 'dead') continue;
      const d = Math.hypot(h.x - bx, h.y - by);
      if (d < radius) h.applyDamage(damage * 0.5 * (1 - d / radius));
    }
    // ── Explosion force: launch blocks and enemies outward ──────────────────
    for (const b of blocks) {
      if (b.destroyed) continue;
      const dx = b.body.position.x - bx;
      const dy = b.body.position.y - by;
      const d = Math.hypot(dx, dy);
      if (d < radius && d > 1) {
        // Wake sleeping bodies so they actually receive the force
        this.wakeBody(b.body);
        const nx = dx / d;
        const ny = dy / d;
        const falloff = (1 - d / radius) ** 2;
        const forceMag = BARREL_EXPLOSION_FORCE * falloff;
        this.scene.matter.applyForce(b.body, { x: nx * forceMag, y: (ny - 0.3) * forceMag });
      }
    }
    for (const e of enemies) {
      if (e.state === 'dead' || !e.body) continue;
      const dx = e.x - bx;
      const dy = e.y - by;
      const d = Math.hypot(dx, dy);
      if (d < radius && d > 1) {
        this.wakeBody(e.body);
        const nx = dx / d;
        const ny = dy / d;
        const falloff = (1 - d / radius) ** 2;
        const forceMag = BARREL_EXPLOSION_FORCE * 0.6 * falloff;
        this.scene.matter.applyForce(e.body as MatterJS.BodyType, { x: nx * forceMag, y: (ny - 0.3) * forceMag });
      }
    }

    // Chain-detonate adjacent barrels
    for (const barrel of barrels) {
      if (barrel.exploded) continue;
      const d = Math.hypot(barrel.body.position.x - bx, barrel.body.position.y - by);
      if (d < radius) {
        this.scene.time.delayedCall(150, () => barrel.explode());
      }
    }
    this.spawnExplosion(bx, by, radius, 0xe74c3c);
    this.onDamageEvent?.();
  }

  // ─── Environmental crush ──────────────────────────────────────────────────
  handleBlockCrush(block: Block, heroes: Hero[], enemies: Enemy[]) {
    // Ignore spawn-time overlaps — only crush when the block is actually moving
    const blockSpeed = Math.hypot(block.body.velocity.x, block.body.velocity.y);
    if (blockSpeed < 0.8) return;

    const { x, y } = block.body.position;
    const crushRadius = 55;
    const crushDmg = 40;
    for (const h of heroes) {
      if (h.state === 'dead') continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < crushRadius) {
        h.applyDamage(crushDmg);
        this.emitDamage(h.x, h.y, crushDmg, true);
        this.onDamageEvent?.();
      }
    }
    for (const e of enemies) {
      if (e.state === 'dead') continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < crushRadius) { e.applyDamage(crushDmg); this.onDamageEvent?.(); }
    }
  }

  // ─── Particle helpers ─────────────────────────────────────────────────────
  private spawnImpactParticles(x: number, y: number, color: number, count: number) {
    for (let i = 0; i < count; i++) {
      const g = this.scene.add.graphics().setDepth(20);
      g.fillStyle(color, 1);
      const px = x + Phaser.Math.Between(-20, 20);
      const py = y + Phaser.Math.Between(-20, 20);
      g.fillCircle(px, py, Phaser.Math.Between(2, 6));
      this.scene.tweens.add({
        targets: g,
        alpha: 0,
        y: py - 30,
        duration: 400,
        ease: 'Power2',
        onComplete: () => g.destroy(),
      });
    }
  }

  private spawnShockwave(x: number, y: number, radius: number, color: number) {
    const g = this.scene.add.graphics().setDepth(19);
    const target = { r: 0 };
    this.scene.tweens.add({
      targets: target,
      r: radius,
      duration: 300,
      onUpdate: (t) => {
        g.clear();
        g.lineStyle(3, color, 1 - t.progress);
        g.strokeCircle(x, y, target.r);
      },
      onComplete: () => g.destroy(),
    });
  }

  private spawnExplosion(x: number, y: number, radius: number, color: number) {
    // Flash
    const flash = this.scene.add.graphics().setDepth(25);
    flash.fillStyle(color, 0.5);
    flash.fillCircle(x, y, radius);
    this.scene.tweens.add({
      targets: flash, alpha: 0, duration: 300, onComplete: () => flash.destroy(),
    });
    // Particles
    this.spawnImpactParticles(x, y, color, 20);
    this.spawnShockwave(x, y, radius, color);
  }

  private spawnHealAura(x: number, y: number, radius: number) {
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 150, () => {
        const g = this.scene.add.graphics().setDepth(20);
        g.fillStyle(0x2ecc71, 0.3);
        g.fillCircle(x, y, radius);
        this.scene.tweens.add({
          targets: g, alpha: 0, scaleX: 1.3, scaleY: 1.3, duration: 600,
          onComplete: () => g.destroy(),
        });
      });
    }
  }
}
