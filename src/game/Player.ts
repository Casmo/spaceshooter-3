import { Sprite, type Texture } from "pixi.js";
import {
  PLAYER,
  WEAPON,
  MODIFIERS,
  MODIFIER_FX,
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
} from "../config";
import { getTexture, getFrames } from "../assets";
import { ProjectilePool } from "./ProjectilePool";
import { createModifiers, type WeaponModifiers } from "./WeaponModifiers";
import { resolveBulletVisual } from "./weaponVisual";
import { playSound } from "./audio";

/**
 * The player ship. Steered by relative mouse motion (see docs/adr/0006): each
 * mouse delta shoves a free-floating target point, and the ship eased-follows
 * that point (smoothed, capped by a teleport-guard step). Fires the base weapon
 * on a cooldown while the trigger is held, and tracks HP / lives with
 * invulnerability frames.
 */
export class Player {
  readonly sprite: Sprite;

  hp: number = PLAYER.maxHp;
  maxHp: number = PLAYER.maxHp;
  lives: number = PLAYER.startLives;
  /** Core collision radius — much smaller than the sprite. */
  readonly hitRadius: number;

  // Upgradable stats (mutated by the upgrade system).
  damage: number = WEAPON.damage;
  cooldown: number = WEAPON.cooldown;
  /** Steer-target travel per unit of mouse motion; raised by the Engine upgrade. */
  sensitivity: number = PLAYER.sensitivity;
  followResponse: number = PLAYER.followResponse;
  pickupRange: number = PLAYER.basePickupRange;
  /** Fixed teleport-guard cap on a single frame's step (not upgrade-scaled). */
  private readonly maxSpeed: number = PLAYER.maxSpeed;

  /** Free-floating point the mouse shoves around; the ship eased-follows it. */
  private targetX: number = PLAYER.startX;
  private targetY: number = PLAYER.startY;
  /** Bullet-modifier levels; mutated by the upgrade system, read when firing. */
  readonly modifiers: WeaponModifiers = createModifiers();
  /** Total projectiles fired by the weapon this run (for run stats). */
  bulletsFired = 0;

  /** True once all lives are spent; the scene should end the run. */
  private gameOver = false;
  /** Seconds of invulnerability remaining. */
  private invulnTimer = 0;
  private blinkTimer = 0;

  private fireTimer = 0;
  private readonly halfWidth: number;
  private readonly halfHeight: number;
  /** Banking frames: 0 = hard-left .. 2 = centre .. 4 = hard-right. */
  private readonly bankFrames: Texture[] = getFrames("ship");

  constructor(private readonly bullets: ProjectilePool) {
    this.sprite = new Sprite(getTexture("ship"));
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(PLAYER.scale);
    this.sprite.position.set(PLAYER.startX, PLAYER.startY);
    this.halfWidth = this.sprite.width / 2;
    this.halfHeight = this.sprite.height / 2;
    this.hitRadius =
      Math.min(this.halfWidth, this.halfHeight) * PLAYER.hitboxRadiusFactor;
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }
  get isInvulnerable(): boolean {
    return this.invulnTimer > 0;
  }
  get isGameOver(): boolean {
    return this.gameOver;
  }

  update(dt: number, firing: boolean): void {
    this.move(dt);
    this.shoot(dt, firing);
    this.tickInvulnerability(dt);
  }

  /**
   * Shove the steer-target by a mouse delta (already converted to virtual px),
   * scaled by sensitivity and clamped to the play bounds. The ship then chases
   * the target in `move`.
   */
  steer(dx: number, dy: number): void {
    this.targetX = clamp(
      this.targetX + dx * this.sensitivity,
      this.halfWidth,
      VIRTUAL_WIDTH - this.halfWidth,
    );
    this.targetY = clamp(
      this.targetY + dy * this.sensitivity,
      this.halfHeight,
      VIRTUAL_HEIGHT - this.halfHeight,
    );
  }

  /**
   * Apply contact/enemy damage. No-op while invulnerable. On reaching 0 HP,
   * consumes a life and respawns at full HP (or ends the run at 0 lives).
   */
  takeHit(damage: number): void {
    if (this.invulnTimer > 0 || this.gameOver) return;
    playSound("hit");
    this.hp -= damage;
    if (this.hp > 0) {
      this.invulnTimer = PLAYER.iframesHit;
      return;
    }
    // Out of HP: spend a life.
    this.lives -= 1;
    if (this.lives <= 0) {
      this.hp = 0;
      this.gameOver = true;
      return;
    }
    this.hp = this.maxHp;
    this.sprite.position.set(PLAYER.startX, PLAYER.startY);
    // Reset the steer-target too, or the ship eases back toward where it died.
    this.targetX = PLAYER.startX;
    this.targetY = PLAYER.startY;
    this.invulnTimer = PLAYER.iframesRespawn;
  }

  private move(dt: number): void {
    const dx = this.targetX - this.sprite.x;
    const dy = this.targetY - this.sprite.y;

    // Frame-rate independent exponential smoothing toward the steer-target.
    const ease = 1 - Math.exp(-this.followResponse * dt);
    let stepX = dx * ease;
    let stepY = dy * ease;

    // Teleport-guard: cap the step so a violent flick can't warp the ship.
    const stepLen = Math.hypot(stepX, stepY);
    const maxStep = this.maxSpeed * dt;
    if (stepLen > maxStep && stepLen > 0) {
      const k = maxStep / stepLen;
      stepX *= k;
      stepY *= k;
    }

    this.sprite.x = clamp(
      this.sprite.x + stepX,
      this.halfWidth,
      VIRTUAL_WIDTH - this.halfWidth,
    );
    this.sprite.y = clamp(
      this.sprite.y + stepY,
      this.halfHeight,
      VIRTUAL_HEIGHT - this.halfHeight,
    );

    // Bank into the horizontal movement: lean left/right by speed, level at rest.
    const vx = dt > 0 ? stepX / dt : 0;
    this.sprite.texture =
      this.bankFrames[
        vx <= -600 ? 0 : vx <= -120 ? 1 : vx >= 600 ? 4 : vx >= 120 ? 3 : 2
      ];
  }

  private shoot(dt: number, firing: boolean): void {
    this.fireTimer -= dt;
    if (!firing || this.fireTimer > 0) return;
    this.fireTimer = this.cooldown;
    this.fireVolley();
    playSound("shoot", 0.3);
  }

  /** Fire one volley, applying every active modifier. */
  private fireVolley(): void {
    const m = this.modifiers;
    const count = 1 + m.multishot * MODIFIERS.multishotPerLevel;
    const pierce = m.pierce * MODIFIERS.piercePerLevel;

    const visual = resolveBulletVisual();
    const texture = getTexture(visual.alias);

    // Effect parameters derived from modifier levels.
    const homing =
      m.homing > 0
        ? Math.min(
            MODIFIER_FX.homing.maxTurnRate,
            m.homing * MODIFIER_FX.homing.turnRatePerLevel,
          )
        : 0;
    const explosiveRadius =
      m.explosive > 0
        ? MODIFIER_FX.explosive.baseRadius +
          m.explosive * MODIFIER_FX.explosive.radiusPerLevel
        : 0;
    const explosiveDamage = this.damage * MODIFIER_FX.explosive.damageFactor;
    const burnDps = m.burn * MODIFIER_FX.burn.dpsPerLevel;
    // Bounce level is the generations a shot can chain (see ADR-0005).
    const bounceRemaining = m.bounce;

    // Multishot fans its volley out by a fixed gap per extra projectile.
    const arcDeg = count > 1 ? MODIFIERS.multishotMinGapDeg * (count - 1) : 0;
    const arcRad = (arcDeg * Math.PI) / 180;

    const originX = this.sprite.x;
    const originY = this.sprite.y - this.halfHeight;
    const speed = WEAPON.bulletSpeed;

    this.bulletsFired += count;

    for (let i = 0; i < count; i++) {
      // theta is the offset from straight-up (-y); 0 when a single shot.
      const theta = count === 1 ? 0 : -arcRad / 2 + arcRad * (i / (count - 1));
      this.bullets.spawn({
        x: originX,
        y: originY,
        vx: Math.sin(theta) * speed,
        vy: -Math.cos(theta) * speed,
        damage: this.damage,
        tint: visual.tint,
        pierce,
        texture,
        homing,
        explosiveRadius,
        explosiveDamage,
        burnDps,
        burnDuration: MODIFIER_FX.burn.duration,
        bounceRemaining,
      });
    }
  }

  private tickInvulnerability(dt: number): void {
    if (this.invulnTimer <= 0) {
      this.sprite.alpha = 1;
      return;
    }
    this.invulnTimer -= dt;
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = PLAYER.blinkInterval;
      this.sprite.alpha = this.sprite.alpha < 1 ? 1 : 0.35;
    }
    if (this.invulnTimer <= 0) this.sprite.alpha = 1;
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
