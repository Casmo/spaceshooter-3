import { Sprite } from "pixi.js";
import { PLAYER, WEAPON, VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from "../config";
import { getTexture } from "../assets";
import { ProjectilePool } from "./ProjectilePool";

/**
 * The player ship. Eased-follows the cursor (smoothed, capped by a max speed so
 * it visibly "chases" a far cursor) and fires the base weapon on a cooldown
 * while the trigger is held.
 */
export class Player {
  readonly sprite: Sprite;
  /** Time remaining (s) until the weapon can fire again. */
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
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  /**
   * @param dt       seconds since last frame
   * @param targetX  cursor position in virtual coords
   * @param targetY  cursor position in virtual coords
   * @param firing   whether the trigger (left mouse) is held
   */
  update(dt: number, targetX: number, targetY: number, firing: boolean): void {
    this.move(dt, targetX, targetY);
    this.shoot(dt, firing);
  }

  private move(dt: number, targetX: number, targetY: number): void {
    const dx = targetX - this.sprite.x;
    const dy = targetY - this.sprite.y;

    // Frame-rate independent exponential smoothing toward the cursor.
    const ease = 1 - Math.exp(-PLAYER.followResponse * dt);
    let stepX = dx * ease;
    let stepY = dy * ease;

    // Clamp the step to the max speed so a far cursor is chased, not teleported.
    const stepLen = Math.hypot(stepX, stepY);
    const maxStep = PLAYER.maxSpeed * dt;
    if (stepLen > maxStep && stepLen > 0) {
      const k = maxStep / stepLen;
      stepX *= k;
      stepY *= k;
    }

    // Keep the whole ship inside the playfield.
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
    if (firing && this.fireTimer <= 0) {
      // Fire from the ship's nose, straight up.
      this.bullets.spawn(
        this.sprite.x,
        this.sprite.y - this.halfHeight,
        0,
        -WEAPON.bulletSpeed,
      );
      this.fireTimer = WEAPON.cooldown;
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
