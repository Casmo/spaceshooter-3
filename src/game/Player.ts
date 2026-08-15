import { Sprite, type Texture } from "pixi.js";
import {
  PLAYER,
  WEAPON,
  MISSILE,
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
import { advanceTarget, easeToward, type SteerBounds } from "./steering";

/**
 * The player ship. Steered by relative mouse motion (see docs/adr/0006): each
 * mouse delta shoves a free-floating target point, and the ship eased-follows
 * that point. The target may never lead the ship by more than PLAYER.maxLead,
 * which bounds trailing lag and caps top speed in one rule (ADR-0023). Fires the
 * base weapon on a cooldown while the trigger is held, and tracks HP / lives
 * with invulnerability frames.
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
  /** Steer-target travel per unit of mouse motion. The scene syncs this from the
   *  player's persisted setting; the Engine upgrade multiplies it separately. */
  sensitivity: number = PLAYER.sensitivityDefault;
  followResponse: number = PLAYER.followResponse;
  pickupRange: number = PLAYER.basePickupRange;
  /** How far the steer-target may lead the ship (ADR-0023). */
  private readonly maxLead: number = PLAYER.maxLead;

  /** Free-floating point the mouse shoves around; the ship eased-follows it. */
  private targetX: number = PLAYER.startX;
  private targetY: number = PLAYER.startY;
  /** Bullet-modifier levels; mutated by the upgrade system, read when firing. */
  readonly modifiers: WeaponModifiers = createModifiers();
  /** Missile Launcher level (0 = not unlocked). First "Missiles" Upgrade unlocks
   *  it and starts the 1s launch clock; each later level adds Missile damage. */
  missileLevel = 0;
  /** Countdown to the next Missile launch (ADR-0018). */
  private missileTimer = 0;
  /** Drone count (ADR-0019): +1 per "Drones" Upgrade, capped at DRONE.maxCount.
   *  The drones themselves live in the scene's DroneSwarm, which reconciles its
   *  live count to this each frame — Player just holds the number. */
  droneLevel = 0;
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
  /** Play area the steer-target is confined to. Derived from the sprite size, so
   *  it is fixed once the ship's texture is known. */
  private readonly bounds: SteerBounds;
  /** Banking frames: 0 = hard-left .. 2 = centre .. 4 = hard-right. */
  private readonly bankFrames: Texture[] = getFrames("ship");

  constructor(
    private readonly bullets: ProjectilePool,
    private readonly missiles: ProjectilePool,
  ) {
    this.sprite = new Sprite(getTexture("ship"));
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(PLAYER.scale);
    this.sprite.position.set(PLAYER.startX, PLAYER.startY);
    this.halfWidth = this.sprite.width / 2;
    this.halfHeight = this.sprite.height / 2;
    this.hitRadius =
      Math.min(this.halfWidth, this.halfHeight) * PLAYER.hitboxRadiusFactor;
    this.bounds = {
      minX: this.halfWidth,
      maxX: VIRTUAL_WIDTH - this.halfWidth,
      minY: this.halfHeight,
      maxY: VIRTUAL_HEIGHT - this.halfHeight,
    };
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

  /** Damage each Missile deals in its blast (only meaningful once unlocked). */
  get missileDamage(): number {
    return (
      MISSILE.baseDamage + (this.missileLevel - 1) * MISSILE.damagePerLevel
    );
  }

  update(dt: number, firing: boolean): void {
    this.move(dt);
    this.shoot(dt, firing);
    this.fireMissiles(dt, firing);
    this.tickInvulnerability(dt);
  }

  /**
   * Shove the steer-target by a mouse delta (in virtual px), bounded by the lead
   * cap and the play area. The ship then chases the target in `move`.
   */
  steer(dx: number, dy: number): void {
    const next = advanceTarget(
      { x: this.targetX, y: this.targetY },
      this.sprite.x,
      this.sprite.y,
      dx,
      dy,
      this.sensitivity,
      this.maxLead,
      this.bounds,
    );
    this.targetX = next.x;
    this.targetY = next.y;
  }

  /**
   * Apply contact/enemy damage. No-op while invulnerable. On reaching 0 HP,
   * consumes a life and respawns at full HP (or ends the run at 0 lives).
   */
  takeHit(damage: number): void {
    if (this.invulnTimer > 0 || this.gameOver) return;
    playSound("playerHit");
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
    const prevX = this.sprite.x;

    // No position clamp is needed: easeToward always lands between the current
    // position and the target, and the target is already bounds-clamped in
    // steer(), so a ship starting in bounds can never leave them.
    this.sprite.x = easeToward(
      this.sprite.x,
      this.targetX,
      this.followResponse,
      dt,
    );
    this.sprite.y = easeToward(
      this.sprite.y,
      this.targetY,
      this.followResponse,
      dt,
    );

    // Bank into the horizontal movement: lean left/right by speed, level at rest.
    const vx = dt > 0 ? (this.sprite.x - prevX) / dt : 0;
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

  /**
   * Missile Launcher (ADR-0018): once unlocked, launch one Missile straight up
   * every MISSILE.fireInterval seconds *while the trigger is held*. Mirrors the
   * gun's timer (counts down always, fires only when held), so the first Missile
   * after a lull launches immediately, but tap-firing can't beat the interval
   * because the timer resets to the full interval on each launch. Independent of
   * Fire Rate and untouched by any bullet Modifier.
   */
  private fireMissiles(dt: number, firing: boolean): void {
    if (this.missileLevel <= 0) return;
    this.missileTimer -= dt;
    if (!firing || this.missileTimer > 0) return;
    this.missileTimer = MISSILE.fireInterval;
    this.missiles.spawn({
      x: this.sprite.x,
      y: this.sprite.y - this.halfHeight,
      vx: 0,
      vy: -MISSILE.startSpeed,
      damage: this.missileDamage,
      rotation: Math.PI, // the art points down; flip it to point up
    });
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
