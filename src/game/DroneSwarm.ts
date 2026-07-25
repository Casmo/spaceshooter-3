import { Container, Graphics, Sprite } from "pixi.js";
import { DRONE } from "../config";
import { getTexture } from "../assets";
import type { Enemy } from "./EnemyPool";

/**
 * The Drones weapon (ADR-0019): a scene-owned set of small, indestructible craft
 * that orbit the ship and each fire a continuous, damage-ramping beam at the
 * nearest enemy within range of their OWN position.
 *
 * It is the first friendly thing that follows the player and the first continuous
 * beam. The orbit borrows the Warden Shield-Node idiom (cos/sin around a parent);
 * the beam damage borrows the Burn model (`hp -= dps * dt` each frame). The ramp
 * is per-locked-target and uncapped — it climbs while a beam holds one enemy and
 * resets the moment that enemy dies or leaves range (then the drone re-acquires).
 *
 * The scene owns the count via `player.droneLevel`; this class reconciles its live
 * drones to that each frame (spawn on level-up; none ever despawn — indestructible)
 * and never touches the player's HP: collision is one-directional, drone → enemy.
 */
export interface DroneContext {
  /** Ship centre — the orbit origin. */
  x: number;
  y: number;
  /** Desired drone count (`player.droneLevel`), clamped to DRONE.maxCount here. */
  level: number;
  /** Live enemies to target and damage. */
  enemies: readonly Enemy[];
  /** Kill-reward path (XP / score / star / split), shared with every weapon. */
  destroyEnemy: (enemy: Enemy) => void;
}

interface Drone {
  readonly sprite: Sprite;
  /** Eased position (lags its orbit slot). */
  x: number;
  y: number;
  /** Eased sprite rotation. */
  rotation: number;
  /** The locked enemy, or undefined when idle. */
  target?: Enemy;
  /** Generation stamp of the lock — distinguishes "target gone" from "slot reused"
   *  (pooled enemies recycle, exactly as Homing's Lock does — see ADR-0004). */
  targetGen: number;
  /** Seconds the beam has held THIS target — the ramp input. Resets on re-lock. */
  lockSeconds: number;
}

export class DroneSwarm {
  readonly view = new Container();
  /** One shared Graphics for every beam, cleared and redrawn each frame. Sits
   *  under the drone sprites so each gun rides atop its own muzzle. */
  private readonly beams = new Graphics();
  private readonly drones: Drone[] = [];
  /** Current rotation of the whole orbit ring. */
  private ringAngle = 0;

  constructor() {
    this.view.addChild(this.beams);
  }

  update(dt: number, ctx: DroneContext): void {
    this.reconcile(ctx);
    this.beams.clear();
    if (this.drones.length === 0) return;

    this.ringAngle += DRONE.orbitSpeed * dt;
    const count = this.drones.length;
    const posEase = 1 - Math.exp(-DRONE.followResponse * dt);
    const aimEase = 1 - Math.exp(-DRONE.aimResponse * dt);

    for (let i = 0; i < count; i++) {
      const drone = this.drones[i];

      // Evenly-spaced slot on the rotating ring; the drone eased-follows it so it
      // floats and lags rather than welding to the ship.
      const slotAngle = this.ringAngle + (i * Math.PI * 2) / count;
      const slotX = ctx.x + Math.cos(slotAngle) * DRONE.orbitRadius;
      const slotY = ctx.y + Math.sin(slotAngle) * DRONE.orbitRadius;
      drone.x += (slotX - drone.x) * posEase;
      drone.y += (slotY - drone.y) * posEase;

      const target = this.acquire(drone, ctx);

      let aim: number;
      if (target) {
        drone.lockSeconds += dt;
        const dps = DRONE.baseDps + DRONE.rampPerSec * drone.lockSeconds;
        aim = Math.atan2(target.y - drone.y, target.x - drone.x);
        // Continuous damage (Burn model). A kill routes through the shared reward
        // path and breaks the lock, so the ramp restarts on the next target.
        if (target.takeDamage(dps * dt)) {
          ctx.destroyEnemy(target);
          drone.target = undefined;
          drone.lockSeconds = 0;
        }
        this.drawBeam(drone, target, dps);
      } else {
        drone.lockSeconds = 0;
        // Neutral: watch outward, away from the ship.
        aim = Math.atan2(drone.y - ctx.y, drone.x - ctx.x);
      }

      // Ease the sprite's rotation toward its aim (shortest way round). Gun.png
      // points down, so the muzzle aligns at `aim - artFacing`.
      const desiredRot = aim - DRONE.artFacing;
      drone.rotation += shortestAngle(desiredRot - drone.rotation) * aimEase;
      drone.sprite.position.set(drone.x, drone.y);
      drone.sprite.rotation = drone.rotation;
    }
  }

  /**
   * Return the drone's target for this frame. Keep the locked enemy while it is
   * alive, in its pool slot, and still in range — that is what lets the ramp build.
   * Otherwise (dead or fled the range) drop it, reset the ramp, and lock the
   * nearest enemy within range, if any.
   */
  private acquire(drone: Drone, ctx: DroneContext): Enemy | undefined {
    const range2 = DRONE.range * DRONE.range;
    const current = drone.target;
    if (
      current &&
      current.active &&
      current.generation === drone.targetGen &&
      sqDist(drone, current) <= range2
    ) {
      return current;
    }

    // Target gone or out of range → the ramp resets; re-acquire nearest in range.
    drone.lockSeconds = 0;
    let best: Enemy | undefined;
    let bestD = range2;
    for (const enemy of ctx.enemies) {
      if (!enemy.active) continue;
      const d = sqDist(drone, enemy);
      if (d <= bestD) {
        bestD = d;
        best = enemy;
      }
    }
    drone.target = best;
    drone.targetGen = best ? best.generation : 0;
    return best;
  }

  /** Draw one beam: a low-alpha glow underlay plus a hot core, both coloured and
   *  sized from the current dps (saturating cosmetically at DRONE.visualMaxDps). */
  private drawBeam(drone: Drone, target: Enemy, dps: number): void {
    const t = Math.min(1, dps / DRONE.visualMaxDps);
    const color = heatColor(t);
    const width =
      DRONE.beamWidthMin + (DRONE.beamWidthMax - DRONE.beamWidthMin) * t;
    this.beams
      .moveTo(drone.x, drone.y)
      .lineTo(target.x, target.y)
      .stroke({
        width: width * DRONE.glowWidthMult,
        color,
        alpha: DRONE.glowAlpha,
      });
    this.beams
      .moveTo(drone.x, drone.y)
      .lineTo(target.x, target.y)
      .stroke({ width, color, alpha: DRONE.coreAlpha });
  }

  /** Grow the live drone count up to `level` (capped). Drones never despawn within
   *  a run — the count only rises via Upgrades. New drones start at the ship and
   *  ease out to their slot. */
  private reconcile(ctx: DroneContext): void {
    const desired = Math.min(ctx.level, DRONE.maxCount);
    while (this.drones.length < desired) {
      const sprite = new Sprite(getTexture("drone"));
      sprite.anchor.set(0.5);
      sprite.scale.set(DRONE.scale);
      sprite.position.set(ctx.x, ctx.y);
      this.view.addChild(sprite);
      this.drones.push({
        sprite,
        x: ctx.x,
        y: ctx.y,
        rotation: 0,
        target: undefined,
        targetGen: 0,
        lockSeconds: 0,
      });
    }
  }
}

/** Squared distance between a drone and an enemy (both expose x/y). */
function sqDist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Normalise an angle difference to [-π, π] for shortest-arc easing. */
function shortestAngle(diff: number): number {
  let d = diff;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Map ramp progress t∈[0,1] onto the cool→mid→hot heat gradient. */
function heatColor(t: number): number {
  return t <= 0.5
    ? lerpColor(DRONE.colorCool, DRONE.colorMid, t / 0.5)
    : lerpColor(DRONE.colorMid, DRONE.colorHot, (t - 0.5) / 0.5);
}

/** Linear-interpolate two 0xRRGGBB colours. */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const r = Math.round(ar + (((b >> 16) & 0xff) - ar) * t);
  const g = Math.round(ag + (((b >> 8) & 0xff) - ag) * t);
  const bl = Math.round(ab + ((b & 0xff) - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
