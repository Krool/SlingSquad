import Phaser from 'phaser';
import { Hero } from '@/entities/Hero';
import { getRelicModifiers, getRunState } from '@/systems/RunState';
import {
  LAUNCH_COOLDOWN_MS,
  SLING_X,
  SLING_Y,
  MAX_DRAG_DISTANCE,
  LAUNCH_POWER_MULTIPLIER,
  TRAJECTORY_POINTS,
  TRAJECTORY_SIM_FRAMES,
  TRAJECTORY_DOT_EVERY,
  GRAVITY_PER_FRAME,
  HERO_FRICTION_AIR,
  HERO_STATS,
  GAME_HEIGHT,
  SLING_ACTIVATION_RADIUS,
} from '@/config/constants';

type MatterScene = Phaser.Scene & { matter: Phaser.Physics.Matter.MatterPhysics };

export class LaunchSystem {
  private scene: MatterScene;
  private squad: Hero[];
  private currentIndex = 0;
  private cooldownRemaining = 0;
  private isDragging = false;
  private dragCurrent = new Phaser.Math.Vector2();
  private effectiveCooldownMs: number;
  private effectiveMaxDrag: number;
  private effectivePowerMult: number;
  private relicMods: ReturnType<typeof getRelicModifiers>;
  private airFrictionReduce: number;

  // Visuals
  private slingGraphics: Phaser.GameObjects.Graphics;
  private trajectoryGraphics: Phaser.GameObjects.Graphics;
  private cooldownRing: Phaser.GameObjects.Graphics;
  private readyText: Phaser.GameObjects.Text;
  private preview: Phaser.GameObjects.Graphics;
  private previewSprite: Phaser.GameObjects.Sprite | null = null;

  // Passives
  encoreActive = false;
  isFirstLaunch = true;

  onLaunch?: (hero: Hero) => void;

  constructor(scene: MatterScene, squad: Hero[]) {
    this.scene = scene;
    this.squad = squad;

    const mods = getRelicModifiers();
    this.relicMods           = mods;
    this.effectiveCooldownMs = Math.max(200, LAUNCH_COOLDOWN_MS - mods.cooldownReduceMs);
    this.effectiveMaxDrag    = MAX_DRAG_DISTANCE + mods.maxDragBonus;
    this.airFrictionReduce   = mods.airFrictionReduce;
    // Apply meta launch power bonus + launch power curse if present
    try {
      const run = getRunState();
      this.effectivePowerMult = LAUNCH_POWER_MULTIPLIER
        * (1 + (run.metaLaunchPowerPct ?? 0))
        * (1 - mods.launchPowerCurse);
    } catch {
      this.effectivePowerMult = LAUNCH_POWER_MULTIPLIER * (1 - mods.launchPowerCurse);
    }

    this.slingGraphics    = scene.add.graphics().setDepth(10);
    this.trajectoryGraphics = scene.add.graphics().setDepth(11);
    this.cooldownRing     = scene.add.graphics().setDepth(12);
    this.preview          = scene.add.graphics().setDepth(9);

    this.readyText = scene.add.text(SLING_X, SLING_Y - 70, 'READY', {
      fontSize: '18px',
      fontFamily: 'Nunito, sans-serif',
      fontStyle: 'bold',
      color: '#2ecc71',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(13).setAlpha(0);

    this.drawSling();
    this.drawPreview();
    this.setupInput();
  }

  // ─── Sling visual ──────────────────────────────────────────────────────────
  private drawSling() {
    this.slingGraphics.clear();
    // Post
    this.slingGraphics.fillStyle(0x6B3F1E, 1);
    this.slingGraphics.fillRect(SLING_X - 5, SLING_Y - 50, 10, 70);
    // Fork left arm
    this.slingGraphics.fillStyle(0x8B5E3C, 1);
    this.slingGraphics.fillRect(SLING_X - 18, SLING_Y - 50, 10, 28);
    // Fork right arm
    this.slingGraphics.fillRect(SLING_X + 8,  SLING_Y - 50, 10, 28);
  }

  // ─── Current-hero preview + queue bubbles at sling ────────────────────────
  private drawPreview() {
    this.preview.clear();
    // Destroy old preview sprite before creating a new one
    if (this.previewSprite?.scene) this.previewSprite.destroy();
    this.previewSprite = null;

    const hero = this.currentHero;
    if (!hero || hero.state !== 'queued') return;

    // Current hero: real sprite sitting in the sling
    const r = hero.stats.radius;
    const charKey = hero.heroClass.toLowerCase();
    this.previewSprite = this.scene.add.sprite(SLING_X, SLING_Y - r * 0.25, `${charKey}_idle_1`)
      .setDisplaySize(r * 2.5, r * 2.5)
      .setDepth(9);
    this.previewSprite.play(`${charKey}_idle`);
    // Apply class tint for heroes that reuse another class's sprite folder
    const classTint = Hero.CLASS_TINT[hero.heroClass];
    if (classTint) this.previewSprite.setTint(classTint);

    // Queue: next 2 heroes as smaller colored bubbles below the sling post
    for (let offset = 1; offset <= 2; offset++) {
      const next = this.squad[this.currentIndex + offset];
      if (!next || next.state !== 'queued') break;
      const qr = next.stats.radius * 0.6;
      const qy = SLING_Y + 52 + (offset - 1) * (qr * 2 + 6);
      this.preview.fillStyle(next.stats.color, 0.4);
      this.preview.fillCircle(SLING_X, qy, qr);
      this.preview.lineStyle(1, 0xffffff, 0.2);
      this.preview.strokeCircle(SLING_X, qy, qr);
    }
  }

  // ─── Getters ───────────────────────────────────────────────────────────────
  private get currentHero(): Hero | null {
    return this.squad[this.currentIndex] ?? null;
  }

  private get isReady(): boolean {
    return this.cooldownRemaining <= 0 && this.currentHero?.state === 'queued';
  }

  // ─── Launch velocity from current drag ────────────────────────────────────
  /** Returns velocity in px/frame (Matter.js px/step units). No *60. */
  private getLaunchVelocity(): { vx: number; vy: number } {
    const dx = SLING_X - this.dragCurrent.x;
    const dy = SLING_Y - this.dragCurrent.y;
    const mag = Math.hypot(dx, dy);
    if (mag < 1) return { vx: 0, vy: 0 };
    const dist = Math.min(mag, this.effectiveMaxDrag);
    return {
      vx: (dx / mag) * dist * this.effectivePowerMult,
      vy: (dy / mag) * dist * this.effectivePowerMult,
    };
  }

  // ─── Input ─────────────────────────────────────────────────────────────────
  private setupInput() {
    this.scene.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!this.isReady) return;
      // Use worldX/worldY so coordinates match game-space regardless of canvas scale
      const dx = ptr.worldX - SLING_X;
      const dy = ptr.worldY - SLING_Y;
      if (Math.hypot(dx, dy) > SLING_ACTIVATION_RADIUS) return; // only near the sling
      this.isDragging = true;
      this.dragCurrent.set(ptr.worldX, ptr.worldY);
    });

    this.scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      this.dragCurrent.set(ptr.worldX, ptr.worldY);
      this.previewSprite?.setPosition(ptr.worldX, ptr.worldY);
      this.drawTrajectory();
    });

    this.scene.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      const releaseX = ptr.worldX, releaseY = ptr.worldY;
      this.trajectoryGraphics.clear();
      this.dragCurrent.set(ptr.worldX, ptr.worldY);
      // Destroy preview sprite — hero.launch() creates the real one
      if (this.previewSprite?.scene) this.previewSprite.destroy();
      this.previewSprite = null;
      this.doLaunch();
      this.animateSlingSnapback(releaseX, releaseY);
    });
  }

  // ─── Launch ────────────────────────────────────────────────────────────────
  private doLaunch() {
    const hero = this.currentHero;
    if (!hero || hero.state !== 'queued') return;
    let { vx, vy } = this.getLaunchVelocity();
    if (Math.hypot(vx, vy) < 0.3) return; // drag too short

    // Encore passive (Bard): +15% launch power for the next hero after a Bard kill
    if (this.encoreActive) {
      vx *= 1.15;
      vy *= 1.15;
      this.encoreActive = false;
    }

    hero.launch(SLING_X, SLING_Y, vx, vy);

    // Apply air friction reduction from relic
    if (this.airFrictionReduce > 0 && hero.body) {
      hero.body.frictionAir = Math.max(0.0005, HERO_FRICTION_AIR - this.airFrictionReduce);
    }

    // Track first launch for Vanguard passive (Warrior)
    if (this.isFirstLaunch) {
      hero.isFirstLaunch = true;
      this.isFirstLaunch = false;
    }

    // Rogue piercing: set flag before first collision so processCollisionPair can use it
    if (hero.heroClass === 'ROGUE') {
      hero.piercing = true;
    }

    // Ranger triple split: emit event so BattleScene spawns flanking arrow projectiles
    if (hero.heroClass === 'RANGER') {
      this.scene.events.emit('rangerSplitLaunch', hero, vx, vy);
    }

    this.onLaunch?.(hero);
    this.currentIndex++;
    this.cooldownRemaining = this.effectiveCooldownMs;
    this.readyText.setAlpha(0);
    this.preview.clear();
    this.drawPreview();
  }

  // ─── Trajectory arc ────────────────────────────────────────────────────────
  private drawTrajectory() {
    this.trajectoryGraphics.clear();
    if (!this.isDragging) return;

    const { vx, vy } = this.getLaunchVelocity();
    const dragDist = Math.hypot(SLING_X - this.dragCurrent.x, SLING_Y - this.dragCurrent.y);

    // Rubber band lines (sling prongs to drag point)
    this.trajectoryGraphics.lineStyle(2, 0xD4A853, 0.9);
    this.trajectoryGraphics.lineBetween(
      SLING_X - 13, SLING_Y - 36,
      this.dragCurrent.x, this.dragCurrent.y,
    );
    this.trajectoryGraphics.lineBetween(
      SLING_X + 13, SLING_Y - 36,
      this.dragCurrent.x, this.dragCurrent.y,
    );

    // ── Frame-by-frame simulation (matches actual physics exactly) ──
    // Warrior gravityScale: nearly flat trajectory
    const gravScale = this.currentHero?.heroClass === 'WARRIOR' ? HERO_STATS.WARRIOR.gravityScale : 1.0;

    let px = SLING_X, py = SLING_Y;
    let pvx = vx, pvy = vy;
    let dotsDrawn = 0;
    // Track last above-ground position for Mage AoE preview
    let landX = SLING_X, landY = SLING_Y;

    // Trajectory dot count: reduced by curse, boosted by Eagle Eye (Ranger)
    let effectiveDots = Math.max(5, TRAJECTORY_POINTS - this.relicMods.trajectoryReduce);
    if (this.currentHero?.heroClass === 'RANGER') effectiveDots = Math.round(effectiveDots * 1.3);

    for (let frame = 0; frame < TRAJECTORY_SIM_FRAMES && dotsDrawn < effectiveDots; frame++) {
      // Match Matter.js Body.update: frictionAir on both axes, then gravity
      pvx *= (1 - HERO_FRICTION_AIR);
      pvy *= (1 - HERO_FRICTION_AIR);
      pvy += GRAVITY_PER_FRAME * gravScale;
      px += pvx;
      py += pvy;

      if (py < GAME_HEIGHT - 100) { landX = px; landY = py; } // update until near ground

      if (frame % TRAJECTORY_DOT_EVERY === 0) {
        const alpha = (1 - dotsDrawn / TRAJECTORY_POINTS) * 0.85;
        const size = Math.max(2, 4.5 - dotsDrawn * 0.1);
        const dotColor = this.currentHero?.stats.color ?? 0xf39c12;
        this.trajectoryGraphics.fillStyle(dotColor, alpha);
        this.trajectoryGraphics.fillCircle(px, py, size);
        dotsDrawn++;
      }

      if (py > GAME_HEIGHT + 20) break;
    }

    // Ranger: draw 2 flanking trajectory trails at ±splitSpreadDeg
    if (this.currentHero?.heroClass === 'RANGER') {
      const spreadDeg = HERO_STATS.RANGER.splitSpreadDeg;
      const launchAngle = Math.atan2(vy, vx);
      const launchSpeed = Math.hypot(vx, vy) * 0.85; // flanking arrows 85% speed
      for (const sign of [-1, 1]) {
        const angle = launchAngle + Phaser.Math.DegToRad(spreadDeg * sign);
        let fx = SLING_X, fy = SLING_Y;
        let fvx = Math.cos(angle) * launchSpeed;
        let fvy = Math.sin(angle) * launchSpeed;
        let fDots = 0;
        for (let frame = 0; frame < TRAJECTORY_SIM_FRAMES && fDots < effectiveDots; frame++) {
          fvx *= (1 - HERO_FRICTION_AIR);
          fvy *= (1 - HERO_FRICTION_AIR);
          fvy += GRAVITY_PER_FRAME;
          fx += fvx;
          fy += fvy;
          if (frame % TRAJECTORY_DOT_EVERY === 0) {
            const alpha = (1 - fDots / TRAJECTORY_POINTS) * 0.5;
            this.trajectoryGraphics.fillStyle(0x27ae60, alpha);
            this.trajectoryGraphics.fillCircle(fx, fy, 2.5);
            fDots++;
          }
          if (fy > GAME_HEIGHT + 20) break;
        }
      }
    }

    // Mage: draw AoE impact preview at projected landing point
    if (this.currentHero?.heroClass === 'MAGE') {
      const mageAoeRadius = 150 + this.relicMods.mageAoeRadiusBonus; // matches HERO_STATS.MAGE.aoeRadius
      this.trajectoryGraphics.fillStyle(0x8e44ad, 0.10);
      this.trajectoryGraphics.fillCircle(landX, landY, mageAoeRadius);
      this.trajectoryGraphics.lineStyle(2, 0x8e44ad, 0.50);
      this.trajectoryGraphics.strokeCircle(landX, landY, mageAoeRadius);
      // Inner ring at half-radius for depth cue
      this.trajectoryGraphics.lineStyle(1, 0xb065e0, 0.22);
      this.trajectoryGraphics.strokeCircle(landX, landY, mageAoeRadius * 0.5);
      // Cluster bomblet indicator: 5 small dots in a ring around the landing point
      const clusterCount = HERO_STATS.MAGE.clusterCount;
      for (let i = 0; i < clusterCount; i++) {
        const angle = (i / clusterCount) * Math.PI * 2;
        const cx = landX + Math.cos(angle) * 40;
        const cy = landY + Math.sin(angle) * 40;
        this.trajectoryGraphics.fillStyle(0x8e44ad, 0.4);
        this.trajectoryGraphics.fillCircle(cx, cy, 3);
      }
    }

    // Power indicator: subtle scale of drag distance
    const powerPct = Math.min(dragDist / this.effectiveMaxDrag, 1);
    const barW = 50 * powerPct;
    this.trajectoryGraphics.fillStyle(0xf39c12, 0.6);
    this.trajectoryGraphics.fillRect(SLING_X - 25, SLING_Y + 30, barW, 5);
    this.trajectoryGraphics.lineStyle(1, 0xffffff, 0.3);
    this.trajectoryGraphics.strokeRect(SLING_X - 25, SLING_Y + 30, 50, 5);
  }

  // ─── Sling snap-back ───────────────────────────────────────────────────────
  private animateSlingSnapback(fromX: number, fromY: number) {
    const tweenObj = { t: 0 };
    this.scene.tweens.add({
      targets: tweenObj,
      t: 1,
      duration: 200,
      ease: 'Power2',
      onUpdate: () => {
        const t = tweenObj.t;
        const bx = Phaser.Math.Linear(fromX, SLING_X, t);
        const by = Phaser.Math.Linear(fromY, SLING_Y, t);
        this.trajectoryGraphics.clear();
        this.trajectoryGraphics.lineStyle(3, 0xD4A853, 0.9 * (1 - t));
        this.trajectoryGraphics.lineBetween(SLING_X - 13, SLING_Y - 36, bx, by);
        this.trajectoryGraphics.lineBetween(SLING_X + 13, SLING_Y - 36, bx, by);
      },
      onComplete: () => this.trajectoryGraphics.clear(),
    });
  }

  // ─── Cooldown ring ─────────────────────────────────────────────────────────
  private drawCooldownRing(pct: number) {
    this.cooldownRing.clear();
    const x = SLING_X, y = SLING_Y - 20;
    const r = 30;
    this.cooldownRing.lineStyle(4, 0x1a2535, 0.8);
    this.cooldownRing.strokeCircle(x, y, r);
    if (pct > 0) {
      this.cooldownRing.lineStyle(4, pct >= 1 ? 0x2ecc71 : 0xf39c12, 1);
      this.cooldownRing.beginPath();
      this.cooldownRing.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      this.cooldownRing.strokePath();
    }
  }

  // ─── Update ────────────────────────────────────────────────────────────────
  update(delta: number) {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - delta);
      const pct = 1 - this.cooldownRemaining / this.effectiveCooldownMs;
      this.drawCooldownRing(pct);
      if (this.cooldownRemaining === 0) {
        this.readyText.setAlpha(1);
        this.scene.tweens.add({
          targets: this.readyText,
          alpha: 0,
          duration: 600,
          ease: 'Power2',
          delay: 400,
        });
        this.drawPreview();
      }
    } else if (this.isReady) {
      this.drawCooldownRing(1);
    } else if (!this.currentHero) {
      this.cooldownRing.clear();
    }
  }

  get launchesRemaining(): number {
    return this.squad.filter(h => h.state === 'queued').length;
  }

  get allLaunched(): boolean {
    return this.currentIndex >= this.squad.length;
  }
}
