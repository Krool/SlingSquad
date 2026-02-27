import Phaser from 'phaser';
import { Hero } from '@/entities/Hero';
import { Enemy } from '@/entities/Enemy';
import { Block } from '@/entities/Block';
import { Projectile } from '@/entities/Projectile';
import { COMBAT_TICK_MS, MELEE_BLOCK_DAMAGE_MULT } from '@/config/constants';
import { getRelicModifiers, type RelicModifiers } from '@/systems/RunState';

type MatterScene = Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics };

export class CombatSystem {
  private scene: MatterScene;
  private heroes: Hero[];
  private enemies: Enemy[];
  private projectiles: Projectile[] = [];
  private tickAccum = 0;
  private relicFlatDmg = 0;
  private relicCombatSpeedMult = 1.0;
  private metaDamageMult = 1.0;
  private relicMods: RelicModifiers;
  /** Accumulated gold-on-kill bonus for BattleScene to read */
  killGoldBonus = 0;

  onDamageEvent?: () => void;
  blocks: Block[] = [];

  constructor(scene: MatterScene, heroes: Hero[], enemies: Enemy[]) {
    this.scene = scene;
    this.heroes = heroes;
    this.enemies = enemies;
    const mods = getRelicModifiers();
    this.relicMods            = mods;
    this.relicFlatDmg         = mods.flatCombatDamage;
    this.relicCombatSpeedMult = mods.combatSpeedMult;
    this.metaDamageMult       = 1.0 + (mods.metaDamagePct ?? 0);
  }

  addProjectile(p: Projectile) {
    this.projectiles.push(p);
  }

  update(delta: number) {
    // Update sub-projectiles every frame
    for (const p of this.projectiles) p.update(delta);
    this.checkProjectileHits();
    this.projectiles = this.projectiles.filter(p => !p.destroyed);

    // Bomber rush AI — every frame
    this.updateBomberRush(delta);

    // Hero walking AI — every frame
    this.updateHeroMovement(delta);

    // Tick-based combat
    this.tickAccum += delta;
    if (this.tickAccum < COMBAT_TICK_MS) return;
    this.tickAccum -= COMBAT_TICK_MS;
    this.tick();
  }

  // ─── Bomber rush AI ──────────────────────────────────────────────────────────
  private updateBomberRush(_delta: number) {
    const liveHeroes = this.heroes.filter(h => h.state === 'combat' || h.state === 'flying');
    for (const enemy of this.enemies) {
      if (enemy.state !== 'combat' || (enemy.enemyClass !== 'BOMBER' && enemy.enemyClass !== 'FIRE_IMP')) continue;
      if (!enemy.isRushing) {
        // Start rushing toward nearest hero
        const target = this.nearest(enemy.x, enemy.y, liveHeroes, Infinity);
        if (target) {
          enemy.isRushing = true;
          enemy.rushTarget = target;
          // Make bomber non-static so it can move
          this.scene.matter.body.setStatic(enemy.body, false);
          enemy.body.frictionAir = 0.05;
        }
      }
      if (enemy.isRushing && enemy.rushTarget) {
        const stats = enemy.stats as typeof enemy.stats & { rushSpeed: number };
        const dx = enemy.rushTarget.x - enemy.x;
        const dy = enemy.rushTarget.y - enemy.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
          const vx = (dx / dist) * stats.rushSpeed;
          this.scene.matter.setVelocity(enemy.body, vx, enemy.body.velocity.y);
          enemy.sprite?.setFlipX(vx > 0); // face direction of movement
        }
      }
    }
  }

  // ─── Hero walking AI ───────────────────────────────────────────────────────
  private updateHeroMovement(delta: number) {
    const liveHeroes  = this.heroes.filter(h => h.state === 'combat' && h.body);
    const liveEnemies = this.enemies.filter(e => e.state !== 'dead');

    for (const hero of liveHeroes) {
      const body = hero.body!;
      const hx = body.position.x;
      const hy = body.position.y;

      // ── 1. Enemy in attack range → stop (tick handles attack anim + damage) ─
      const enemyInRange = liveEnemies.some(
        e => Math.hypot(e.x - hx, e.y - hy) <= hero.stats.combatRange,
      );
      if (enemyInRange) {
        this.scene.matter.setVelocity(body, 0, body.velocity.y);
        // If we were walking, switch to idle. Don't interrupt active attack cycles.
        this.ensureNotWalking(hero);
        hero.walkStuckMs = 0;
        hero.lastWalkX   = hx;
        continue;
      }

      // ── 2. Block directly ahead → stop (tick handles attack anim + damage) ─
      const blockAhead = this.findBlockAhead(hx, hy, hero.walkDir, hero.stats.radius);
      if (blockAhead) {
        this.scene.matter.setVelocity(body, 0, body.velocity.y);
        // If we were walking, switch to idle. Don't interrupt active attack cycles.
        this.ensureNotWalking(hero);
        hero.walkStuckMs += delta;
        // Give up on indestructible / very tanky block after 3 s — turn around
        if (hero.walkStuckMs > 3000) {
          hero.walkDir    *= -1;
          hero.walkStuckMs = 0;
        }
        hero.lastWalkX = hx;
        continue;
      }

      // ── 3. Walk toward nearest enemy ─────────────────────────────────────
      const nearest = this.nearest(hx, hy, liveEnemies, Infinity);
      if (nearest) {
        hero.walkDir = nearest.x > hx ? 1 : -1;
      }

      const walkVx = hero.walkDir * hero.stats.walkSpeed;
      this.scene.matter.setVelocity(body, walkVx, body.velocity.y);
      hero.sprite?.setFlipX(hero.walkDir < 0);
      this.ensureAnim(hero, 'walk');

      // Stuck detection — no meaningful x movement for 1.5 s → flip
      const dxMoved = Math.abs(hx - hero.lastWalkX);
      if (dxMoved < 0.5) {
        hero.walkStuckMs += delta;
        if (hero.walkStuckMs > 1500) {
          hero.walkDir    *= -1;
          hero.walkStuckMs = 0;
        }
      } else {
        hero.walkStuckMs = 0;
      }
      hero.lastWalkX = hx;
    }
  }

  /** Play animation only if not already current (avoids restarting mid-frame). */
  private ensureAnim(hero: Hero, animName: string) {
    const key = `${hero.heroClass.toLowerCase()}_${animName}`;
    if (hero.sprite?.anims.currentAnim?.key !== key) {
      hero.sprite?.play(key);
    }
  }

  /** If hero is currently in walk anim, switch to idle. Leaves attack cycles untouched. */
  private ensureNotWalking(hero: Hero) {
    const walkKey = `${hero.heroClass.toLowerCase()}_walk`;
    if (hero.sprite?.anims.currentAnim?.key === walkKey) {
      hero.sprite.play(`${hero.heroClass.toLowerCase()}_idle`);
    }
  }

  /** Flash attack anim on a hero for one cycle, then revert to idle.
   *  Attack anims are defined with repeat:-1, so we override to repeat:0
   *  to get a single cycle that fires `animationcomplete`. */
  private flashAttackAnim(hero: Hero) {
    const charKey = hero.heroClass.toLowerCase();
    const atkKey = `${charKey}_attack`;
    const idleKey = `${charKey}_idle`;
    if (!hero.sprite) return;
    hero.sprite.play({ key: atkKey, repeat: 0 });
    hero.sprite.once('animationcomplete', () => {
      if (hero.state === 'combat' && hero.sprite?.anims.currentAnim?.key === atkKey) {
        hero.sprite.play(idleKey);
      }
    });
  }

  /** Flash attack anim on an enemy for one cycle, then revert to idle. */
  private flashEnemyAttackAnim(enemy: Enemy) {
    const charKey = enemy.enemyClass.toLowerCase();
    const atkKey = `${charKey}_attack`;
    const idleKey = `${charKey}_idle`;
    if (!enemy.sprite) return;
    enemy.sprite.play({ key: atkKey, repeat: 0 });
    enemy.sprite.once('animationcomplete', () => {
      if (enemy.state === 'combat' && enemy.sprite?.anims.currentAnim?.key === atkKey) {
        enemy.sprite.play(idleKey);
      }
    });
  }

  /**
   * Returns the nearest non-destroyed block that lies in the hero's walk direction
   * within a short look-ahead distance and at roughly the same height.
   */
  private findBlockAhead(hx: number, hy: number, dir: number, heroR: number): Block | null {
    const lookAheadX    = heroR + 55;
    const vertTolerance = 45;
    let best: Block | null = null;
    let bestDist = Infinity;
    for (const b of this.blocks) {
      if (b.destroyed) continue;
      const bx = b.body.position.x;
      const by = b.body.position.y;
      const dx = bx - hx;
      // Must be ahead in walk direction
      if (dir > 0 ? dx < 0 : dx > 0) continue;
      // Horizontally close enough
      if (Math.abs(dx) > lookAheadX + b.halfW) continue;
      // Vertically overlapping (same floor level)
      if (Math.abs(by - hy) > vertTolerance + b.halfH) continue;
      // Keep nearest
      const dist = Math.abs(dx);
      if (dist < bestDist) { bestDist = dist; best = b; }
    }
    return best;
  }

  private tick() {
    const now = this.scene.time.now;
    const liveHeroes  = this.heroes.filter(h => h.state === 'combat');
    const liveEnemies = this.enemies.filter(e => e.state !== 'dead');

    // Update charm timers
    for (const enemy of liveEnemies) {
      if (enemy.charmed && now >= enemy.charmEndTime) {
        enemy.charmed = false;
        (enemy as any).restoreTint?.();
      }
    }

    // Activate idle enemies when a hero moves within aggro range
    for (const enemy of liveEnemies) {
      if (enemy.state !== 'idle') continue;
      const nearest = this.nearest(enemy.x, enemy.y, liveHeroes, enemy.stats.aggroRange);
      if (nearest) enemy.enterCombat();
    }

    // Heroes attack enemies (AOE sweep); all classes hack blocks when no enemy in range
    for (const hero of liveHeroes) {
      // Bard aura: boost nearby hero attack speed
      let bardBoost = 1.0;
      for (const other of liveHeroes) {
        if (other.heroClass !== 'BARD' || other === hero || other.state === 'dead') continue;
        const d = Math.hypot(hero.x - other.x, hero.y - other.y);
        const auraR = (other.stats as any).auraRadius ?? 100;
        if (d <= auraR) bardBoost = Math.min(bardBoost, 1 - ((other.stats as any).auraSpeedBoost ?? 0.20));
      }
      const slowPenalty = hero.isSlowed ? 1.5 : 1.0;
      const effectiveSpeed = hero.stats.combatSpeed * this.relicCombatSpeedMult * bardBoost * slowPenalty;
      if (now - hero.lastAttackTime < effectiveSpeed) continue;
      let heroDmg = (hero.stats.combatDamage + this.relicFlatDmg) * this.metaDamageMult;
      // Crit chance
      if (this.relicMods.critChance > 0 && Math.random() < this.relicMods.critChance) heroDmg *= 2;
      // Low HP berserker bonus
      if (this.relicMods.lowHpDamageMult > 0 && hero.hp / hero.maxHp < 0.30) heroDmg *= this.relicMods.lowHpDamageMult;
      const targets = liveEnemies.filter(e =>
        Math.hypot(e.x - hero.x, e.y - hero.y) <= hero.stats.combatRange
      );
      if (targets.length > 0) {
        for (const t of targets) {
          t.applyDamage(heroDmg, hero.x, hero);
          hero.battleDamageDealt += heroDmg;
          this.spawnMeleeFlash(t.x, t.y);
          this.scene.events.emit('unitDamage', t.x, t.y, Math.round(heroDmg));
        }
        hero.lastAttackTime = now;
        this.flashAttackAnim(hero);
        this.onDamageEvent?.();
      } else {
        // Cap block-attack range at 140px for non-warriors so they don't reach across the map
        const blockRange = hero.heroClass === 'WARRIOR'
          ? hero.stats.combatRange * 1.5
          : Math.min(hero.stats.combatRange, 140);
        const nearestBlock = this.nearestBlock(hero.x, hero.y, blockRange);
        if (nearestBlock) {
          const blockDmg = heroDmg * MELEE_BLOCK_DAMAGE_MULT;
          nearestBlock.applyDamage(blockDmg);
          hero.battleBlockDamage += blockDmg;
          const bx = nearestBlock.body.position.x, by = nearestBlock.body.position.y;
          this.scene.events.emit('blockDamage', bx, by, Math.round(blockDmg));
          hero.lastAttackTime = now;
          this.flashAttackAnim(hero);
          this.onDamageEvent?.();
          this.spawnMeleeFlash(bx, by);
        }
      }
    }

    // Enemies attack heroes (or other enemies if charmed)
    for (const enemy of liveEnemies) {
      if (enemy.state !== 'combat') continue;

      // Healer: heals nearest injured ally instead of attacking
      if (enemy.enemyClass === 'HEALER' && !enemy.charmed) {
        if (now - enemy.lastHealTime >= enemy.stats.combatSpeed) {
          this.processHealerTick(enemy, liveEnemies, now);
        }
        continue;
      }

      // Charmed enemies attack other enemies
      if (enemy.charmed) {
        if (!enemy.canAttack(now)) continue;
        const others = liveEnemies.filter(e => e !== enemy && !e.charmed && e.state !== 'dead');
        const target = this.nearest(enemy.x, enemy.y, others, enemy.stats.combatRange);
        if (target) {
          target.applyDamage(enemy.stats.combatDamage, enemy.x);
          this.scene.events.emit('unitDamage', target.x, target.y, Math.round(enemy.stats.combatDamage));
          enemy.lastAttackTime = now;
          this.flashEnemyAttackAnim(enemy);
          this.onDamageEvent?.();
          this.spawnMeleeFlash(target.x, target.y);
        }
        continue;
      }

      if (!enemy.canAttack(now)) continue;
      if (enemy.enemyClass === 'RANGED' || enemy.enemyClass === 'ICE_MAGE' || enemy.enemyClass === 'FROST_ARCHER') {
        this.processRangedAttack(enemy, liveHeroes, now);
      } else {
        const target = this.nearest(enemy.x, enemy.y, liveHeroes, enemy.stats.combatRange);
        if (target) {
          const eDmg = enemy.stats.combatDamage;
          // Damage reduction is applied inside Hero.applyDamage() — do NOT reduce here to avoid double-dipping
          target.applyDamage(eDmg);
          this.scene.events.emit('unitDamage', target.x, target.y, Math.round(eDmg));
          enemy.lastAttackTime = now;
          this.flashEnemyAttackAnim(enemy);
          this.onDamageEvent?.();
          this.spawnMeleeFlash(target.x, target.y);
          // Thorns relic: reflect damage back
          if (this.relicMods.thorns > 0) {
            enemy.applyDamage(this.relicMods.thorns, target.x, target);
            target.battleDamageDealt += this.relicMods.thorns;
            this.scene.events.emit('unitDamage', enemy.x, enemy.y, this.relicMods.thorns);
          }
        }
      }
    }
  }

  /** Healer: heal nearest injured ally */
  private processHealerTick(healer: Enemy, allEnemies: Enemy[], now: number) {
    const stats = healer.stats as typeof healer.stats & { healAmount: number; healRange: number };
    let best: Enemy | null = null;
    let bestHpPct = 1;
    for (const other of allEnemies) {
      if (other === healer || other.state === 'dead') continue;
      const d = Math.hypot(other.x - healer.x, other.y - healer.y);
      if (d > stats.healRange) continue;
      const pct = other.hp / other.maxHp;
      if (pct < bestHpPct) { bestHpPct = pct; best = other; }
    }
    if (best && bestHpPct < 1) {
      best.heal(stats.healAmount);
      this.spawnHealFlash(best.x, best.y);
      healer.lastHealTime = now;
      this.flashEnemyAttackAnim(healer);
    }
  }

  private spawnHealFlash(x: number, y: number) {
    const g = this.scene.add.graphics().setDepth(20);
    g.fillStyle(0x2ecc71, 0.5);
    g.fillCircle(x, y, 20);
    this.scene.tweens.add({
      targets: g, alpha: 0, scaleX: 1.5, scaleY: 1.5,
      duration: 300, onComplete: () => g.destroy(),
    });
  }

  private processRangedAttack(enemy: Enemy, heroes: Hero[], now: number) {
    const stats = enemy.stats as typeof enemy.stats & { projectileSpeed: number };
    const target = this.nearest(enemy.x, enemy.y, heroes, enemy.stats.combatRange);
    if (!target) return;
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;
    const speed = stats.projectileSpeed / 60;
    const isIce = enemy.enemyClass === 'ICE_MAGE' || enemy.enemyClass === 'FROST_ARCHER';
    const color = isIce ? 0x74b9ff : 0xe67e22;
    const p = new Projectile(
      this.scene,
      enemy.x,
      enemy.y,
      (dx / dist) * speed,
      (dy / dist) * speed,
      enemy.stats.combatDamage,
      color,
    );
    p.source = 'enemy';
    if (isIce) (p as any).isIce = true;
    this.projectiles.push(p);
    enemy.lastAttackTime = now;
    this.flashEnemyAttackAnim(enemy);
  }

  private nearestBlock(ox: number, oy: number, maxRange: number): Block | null {
    let best: Block | null = null;
    let bestDist = maxRange;
    for (const b of this.blocks) {
      if (b.destroyed) continue;
      const d = Math.hypot(b.body.position.x - ox, b.body.position.y - oy);
      if (d < bestDist) { bestDist = d; best = b; }
    }
    return best;
  }

  private nearest<T extends { x: number; y: number }>(
    ox: number, oy: number, list: T[], maxRange: number,
  ): T | null {
    let best: T | null = null;
    let bestDist = maxRange;
    for (const item of list) {
      const d = Math.hypot(item.x - ox, item.y - oy);
      if (d < bestDist) { bestDist = d; best = item; }
    }
    return best;
  }

  private spawnMeleeFlash(x: number, y: number) {
    const g = this.scene.add.graphics().setDepth(20);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(x + Phaser.Math.Between(-10, 10), y + Phaser.Math.Between(-10, 10), 8);
    this.scene.time.delayedCall(120, () => g.destroy());
  }

  /** Check all projectiles against their targets (called every frame from update). */
  checkProjectileHits() {
    const liveHeroes  = this.heroes.filter(h => h.state !== 'dead');  // flying heroes can also be hit
    const liveEnemies = this.enemies.filter(e => e.state !== 'dead');

    for (const p of this.projectiles) {
      if (p.destroyed) continue;
      const px = p.body.position.x, py = p.body.position.y;

      if (p.source === 'enemy') {
        for (const hero of liveHeroes) {
          if (Math.hypot(px - hero.x, py - hero.y) < hero.stats.radius + 5) {
            hero.applyDamage(p.damage);
            // ICE_MAGE / FROST_ARCHER slow effect
            if ((p as any).isIce) hero.applySlow(2000);
            this.scene.events.emit('unitDamage', hero.x, hero.y, Math.round(p.damage));
            this.onDamageEvent?.();
            p.destroy();
            break;
          }
        }
      } else {
        for (const enemy of liveEnemies) {
          if (Math.hypot(px - enemy.x, py - enemy.y) < enemy.stats.radius + 5) {
            const srcHero = p.sourceHero;
            enemy.applyDamage(p.damage, undefined, srcHero ?? undefined);
            if (srcHero) srcHero.battleDamageDealt += p.damage;
            this.scene.events.emit('unitDamage', enemy.x, enemy.y, Math.round(p.damage));
            // Ranger poison DoT: deal poison damage per second for 3 seconds
            const poisonDmg = (p as any).poisonDamage as number | undefined;
            if (poisonDmg && poisonDmg > 0) {
              let ticks = 0;
              const interval = this.scene.time.addEvent({
                delay: 1000,
                repeat: 2,
                callback: () => {
                  if (enemy.state !== 'dead') {
                    enemy.applyDamage(poisonDmg, undefined, srcHero ?? undefined);
                    if (srcHero) srcHero.battleDamageDealt += poisonDmg;
                    this.scene.events.emit('unitDamage', enemy.x, enemy.y, Math.round(poisonDmg));
                  }
                  ticks++;
                  if (ticks >= 3) interval.destroy();
                },
              });
            }
            this.onDamageEvent?.();
            p.destroy();
            break;
          }
        }
      }
    }
  }
}
