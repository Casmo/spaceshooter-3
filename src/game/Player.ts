import { Sprite } from "pixi.js";
import {
  PLAYER,
  WEAPON,
  MODIFIERS,
  MODIFIER_FX,
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
} from "../config";
import { getTexture } from "../assets";
import { ProjectilePool } from "./ProjectilePool";
import { createModifiers, type WeaponModifiers } from "./WeaponModifiers";
import { resolveBulletVisual } from "./weaponVisual";

/**
 * The player ship. Eased-follows the cursor (smoothed, capped by a max speed so
 * it visibly "chases" a far cursor), fires the base weapon on a cooldown while
 * the trigger is held, and tracks HP / lives with invulnerability frames.
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
  maxSpeed: number = PLAYER.maxSpeed;
  followResponse: number = PLAYER.followResponse;
  pickupRange: number = PLAYER.basePickupRange;
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

  update(dt: number, targetX: number, targetY: number, firing: boolean): void {
    this.move(dt, targetX, targetY);
    this.shoot(dt, firing);
    this.tickInvulnerability(dt);
  }

  /**
   * Apply contact/enemy damage. No-op while invulnerable. On reaching 0 HP,
   * consumes a life and respawns at full HP (or ends the run at 0 lives).
   */
  takeHit(damage: number): void {
    if (this.invulnTimer > 0 || this.gameOver) return;
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
    this.invulnTimer = PLAYER.iframesRespawn;
  }

  private move(dt: number, targetX: number, targetY: number): void {
    const dx = targetX - this.sprite.x;
    const dy = targetY - this.sprite.y;

    // Frame-rate independent exponential smoothing toward the cursor.
    const ease = 1 - Math.exp(-this.followResponse * dt);
    let stepX = dx * ease;
    let stepY = dy * ease;

    // Clamp the step to the max speed so a far cursor is chased, not teleported.
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
  }

  private shoot(dt: number, firing: boolean): void {
    this.fireTimer -= dt;
    if (!firing || this.fireTimer > 0) return;
    this.fireTimer = this.cooldown;
    this.fireVolley();
  }

  /** Fire one volley, applying every active modifier. */
  private fireVolley(): void {
    const m = this.modifiers;
    const count = 1 + m.multishot * MODIFIERS.multishotPerLevel;
    const pierce = m.pierce * MODIFIERS.piercePerLevel;

    const visual = resolveBulletVisual(m);
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
    const fragmentCount = m.bounce;
    const fragmentDamage = this.damage * MODIFIER_FX.bounce.damageFactor;

    // Arc widens with Spread; even without it, multiple shots get a small gap.
    const spreadArc = m.spread * MODIFIERS.spreadDegPerLevel;
    const minArc = count > 1 ? MODIFIERS.multishotMinGapDeg * (count - 1) : 0;
    const arcRad = (Math.max(spreadArc, minArc) * Math.PI) / 180;

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
        fragmentCount,
        fragmentDamage,
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
