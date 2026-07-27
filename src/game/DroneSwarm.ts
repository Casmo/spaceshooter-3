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
 * the beam damage borrows the Burn model (`hp -= dps * dt` each frame).
 *
 * Damage is driven by per-drone **Heat** (ADR-0020, which reversed ADR-0019's
 * per-target ramp): Heat climbs, uncapped, the whole time a beam fires — a kill or
 * a switch to a new target costs nothing — and decays exponentially ONLY while the
 * drone is idle with nothing in range. So the weapon rewards sustained fire rather
 * than big targets, and the one thing that cools it is a lull.
 *
 * The scene owns the count via `player.droneLevel`; this class reconciles its live
 * drones to that each frame (spawn on level-up; none ever despawn — indestructible)
 * and never touches the player's HP: collision is one-directional, drone → enemy.
 * Because `GameScene.update` early-returns while the Upgrade Prompt, the pause
 * overlay, or a lost pointer lock is up, Heat is frozen whenever the game is.
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
  /** Heat: dps this drone's beam deals ON TOP of DRONE.baseDps. Survives kills,
   *  target switches, and a lost Life; only idle time sheds it (ADR-0020). */
  heat: number;
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
        // Firing is the only thing that builds Heat, and nothing caps it.
        drone.heat += DRONE.heatPerSec * dt;
        aim = Math.atan2(target.y - drone.y, target.x - drone.x);
        // Continuous damage (Burn model). A kill routes through the shared reward
        // path and drops the lock, but the Heat rides on into the next enemy.
        if (target.takeDamage((DRONE.baseDps + drone.heat) * dt)) {
          ctx.destroyEnemy(target);
          drone.target = undefined;
        }
        this.drawBeam(drone, target);
      } else {
        // Idle: the one and only way Heat comes off, and it comes off in
        // proportion — a scorching drone sheds far more per second than a
        // lukewarm one, so the brake keeps up with the uncapped climb.
        drone.heat *= Math.pow(0.5, dt / DRONE.coolHalfLife);
        // Neutral: watch outward, away from the ship.
        aim = Math.atan2(drone.y - ctx.y, drone.x - ctx.x);
      }

      // Ease the sprite's rotation toward its aim (shortest way round). Gun.png
      // points down, so the muzzle aligns at `aim - artFacing`.
      const desiredRot = aim - DRONE.artFacing;
      drone.rotation += shortestAngle(desiredRot - drone.rotation) * aimEase;
      drone.sprite.position.set(drone.x, drone.y);
      drone.sprite.rotation = drone.rotation;
      // The drone glows with its own Heat whether it is firing or not — with the
      // beam off, this is the only way to see that an idle drone is still
      // scorching, and to watch it cool.
      drone.sprite.tint = heatTint(drone.heat);
    }
  }

  /**
   * Return the drone's target for this frame. Keep the locked enemy while it is
   * alive, in its pool slot, and still in range. Otherwise (dead or fled the range)
   * drop it and lock the nearest enemy within range, if any. Heat is deliberately
   * untouched here — switching targets is free; only finding NOTHING costs the
   * drone, and it pays that in the idle branch of `update` (ADR-0020).
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

    // Target gone or out of range → re-acquire the nearest in range.
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
   *  sized from the drone's Heat. */
  private drawBeam(drone: Drone, target: Enemy): void {
    const t = heatProgress(drone.heat);
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
        // A drone won from a later Upgrade level joins cold beside hot siblings.
        heat: 0,
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

/**
 * Map Heat onto visual progress t∈[0,1]. Logarithmic, not the linear ratio the
 * per-target ramp used: because Heat now persists across a whole Wave it routinely
 * reaches four figures, and a linear map would pin at max within ~10s and stay
 * there. The log curve is vivid inside the first second and still visibly creeping
 * past 1000 dps (ADR-0020).
 */
function heatProgress(heat: number): number {
  const knee = DRONE.visualHeatKnee;
  const t =
    Math.log1p(Math.max(0, heat) / knee) /
    Math.log1p(DRONE.visualHeatFull / knee);
  return Math.min(1, t);
}

/**
 * The drone sprite's own tint: blended from untinted toward its beam's colour by
 * the same progress, so a cold drone shows its natural art and only a hot one
 * visibly smoulders. (Tinting straight to `heatColor` would leave even a stone-cold
 * drone washed cyan.)
 */
function heatTint(heat: number): number {
  const t = heatProgress(heat);
  return lerpColor(0xffffff, heatColor(t), t);
}

/** Map heat progress t∈[0,1] onto the cool→mid→hot gradient. */
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
