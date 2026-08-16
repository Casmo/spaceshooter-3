import { describe, expect, it } from "vitest";
import {
  anchorFor,
  degToRad,
  easeInOut,
  stepArc,
  travelSeconds,
  turnToward,
  type ArcBounds,
} from "./duelist";
import { DUELIST, PLAYER, VIRTUAL_WIDTH } from "../config";

/**
 * Invariant tests for the Duelist's pure spot-picking math (ADR-0024). These
 * assert the properties the enemy's whole design rests on — every spot it picks
 * is in the top band and a standoff away from the player, consecutive picks land
 * somewhere new, and its nose tracking can be outrun — rather than any
 * particular eyeballed position.
 *
 * `anchorFor` runs once per move, not per frame: the Duelist commits to the spot
 * it returns and flies there regardless of where the player goes next. So these
 * are properties of the spot AT THE MOMENT IT IS CHOSEN.
 */

const BOUNDS: ArcBounds = {
  minX: DUELIST.xMargin,
  maxX: VIRTUAL_WIDTH - DUELIST.xMargin,
  minY: DUELIST.bandMinY,
  maxY: DUELIST.bandMaxY,
};
const R = DUELIST.standoffRadius;
const HALF_RANGE = degToRad(DUELIST.arcHalfRangeDeg);

/** Arc angles spanning the legal range, ends included. */
const ARCS = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map(
  (f) => f * HALF_RANGE,
);

/** Player positions worth stressing: the home row, mid-field, up inside the
 *  band, and every corner the ship can reach. */
const PLAYERS = [
  { x: 960, y: 864 },
  { x: 960, y: 540 },
  { x: 960, y: 200 },
  { x: 0, y: 1080 },
  { x: 1920, y: 1080 },
  { x: 0, y: 0 },
  { x: 1920, y: 0 },
  { x: 1780, y: 200 },
  { x: 140, y: 200 },
];

const dist = (
  a: { x: number; y: number },
  b: { x: number; y: number },
): number => Math.hypot(a.x - b.x, a.y - b.y);

describe("anchorFor", () => {
  it("keeps the anchor inside the band and margins from anywhere on the field", () => {
    for (const p of PLAYERS) {
      for (const arc of ARCS) {
        const a = anchorFor(p.x, p.y, arc, R, BOUNDS);
        expect(a.x).toBeGreaterThanOrEqual(BOUNDS.minX);
        expect(a.x).toBeLessThanOrEqual(BOUNDS.maxX);
        expect(a.y).toBeGreaterThanOrEqual(BOUNDS.minY);
        expect(a.y).toBeLessThanOrEqual(BOUNDS.maxY);
      }
    }
  });

  it("never places the anchor nearer the player than the standoff radius", () => {
    // No spot is ever picked on top of the player. It has to hold at EVERY
    // player position, including the ones a player would deliberately fly to in
    // order to close the gap: up inside the band, and pinned into a top corner.
    // (A player who charges AFTER the pick can still close on a committed
    // Duelist — that is the cost of the spot being frozen, and it is the
    // player's reward for reading the move.)
    for (const p of PLAYERS) {
      for (const arc of ARCS) {
        const a = anchorFor(p.x, p.y, arc, R, BOUNDS);
        expect(dist(a, p)).toBeGreaterThanOrEqual(R - 1e-6);
      }
    }
  });

  it("sits directly above a player on the home row at arc zero", () => {
    const a = anchorFor(960, 864, 0, R, BOUNDS);
    expect(a.x).toBeCloseTo(960);
    expect(a.y).toBeCloseTo(864 - R);
  });

  it("resolves the standoff sideways when the player climbs into the band", () => {
    // Arc zero wants to be straight above, but a player at y=200 leaves no room
    // above — so the separation has to become horizontal instead of collapsing.
    const p = { x: 960, y: 200 };
    const a = anchorFor(p.x, p.y, 0, R, BOUNDS);
    // Asserted as "mostly sideways" rather than a fraction of R, so it stays
    // meaningful whatever the band and the standoff are tuned to.
    expect(Math.abs(a.x - p.x)).toBeGreaterThan(Math.abs(a.y - p.y));
    expect(dist(a, p)).toBeGreaterThanOrEqual(R - 1e-6);
  });

  it("gives every arc step a distinct position while the player stays low", () => {
    // If arcs collapsed onto the same point, half the Duelist's moves would be
    // no-ops — it would arrive where it already was and just sit there shooting.
    const seen = ARCS.map((arc) => anchorFor(960, 864, arc, R, BOUNDS));
    for (let i = 1; i < seen.length; i++) {
      expect(dist(seen[i], seen[i - 1])).toBeGreaterThan(1);
    }
  });

  it("mirrors to the other side rather than clamping in at the field edge", () => {
    // Player pinned to the right edge, arc pointing further right: clamping x
    // would collapse the standoff, so the anchor must appear on the left.
    const p = { x: 1850, y: 864 };
    const a = anchorFor(p.x, p.y, HALF_RANGE, R, BOUNDS);
    expect(a.x).toBeLessThan(p.x);
    expect(dist(a, p)).toBeGreaterThanOrEqual(R - 1e-6);
  });

  it("picks its spot relative to wherever the player is at that moment", () => {
    const a = anchorFor(600, 864, 0, R, BOUNDS);
    const b = anchorFor(1200, 864, 0, R, BOUNDS);
    expect(b.x - a.x).toBeCloseTo(600);
  });
});

describe("stepArc", () => {
  it("steps in the held direction while inside the range", () => {
    const step = degToRad(30);
    const r = stepArc(0, 1, step, HALF_RANGE);
    expect(r.arc).toBeCloseTo(step);
    expect(r.dir).toBe(1);
  });

  it("reflects off the limit and flips direction", () => {
    const step = degToRad(30);
    const from = HALF_RANGE - degToRad(10);
    const r = stepArc(from, 1, step, HALF_RANGE);
    // Overshoots by 20deg, so it folds back to 20deg inside the limit.
    expect(r.arc).toBeCloseTo(HALF_RANGE - degToRad(20));
    expect(r.dir).toBe(-1);
  });

  it("stays inside the range for any step size", () => {
    // Guards a future tuning value nobody re-checked: even a step wider than
    // the whole arc must not escape it.
    let arc = 0;
    let dir: 1 | -1 = 1;
    for (const deg of [10, 55, 150, 400, 25, 90]) {
      const r = stepArc(arc, dir, degToRad(deg), HALF_RANGE);
      arc = r.arc;
      dir = r.dir;
      expect(Math.abs(arc)).toBeLessThanOrEqual(HALF_RANGE + 1e-9);
    }
  });

  it("paces back and forth rather than orbiting one way forever", () => {
    // Over many steps in a fixed direction it must reverse at least once.
    let arc = 0;
    let dir: 1 | -1 = 1;
    const dirs: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = stepArc(arc, dir, degToRad(40), HALF_RANGE);
      arc = r.arc;
      dir = r.dir;
      dirs.push(dir);
    }
    expect(dirs).toContain(1);
    expect(dirs).toContain(-1);
  });
});

describe("turnToward", () => {
  const maxStep = DUELIST.turnRate * (1 / 60);

  it("never turns further than the rate allows in one frame", () => {
    const after = turnToward(0, Math.PI, maxStep);
    expect(Math.abs(after)).toBeCloseTo(maxStep);
  });

  it("takes the short way round the wrap", () => {
    // Facing just under +PI, target just over -PI: the short way is forward.
    const after = turnToward(Math.PI - 0.05, -Math.PI + 0.05, 1);
    expect(after).toBeGreaterThan(Math.PI - 0.05);
  });

  it("snaps exactly onto a target inside the step", () => {
    const after = turnToward(1, 1 + maxStep / 2, maxStep);
    expect(after).toBeCloseTo(1 + maxStep / 2);
  });

  /**
   * Run a player laterally away from a parked Duelist through one full burst,
   * and report how far each shot lands to the side of them (virtual px).
   *
   * Measuring per SHOT rather than at the end of the burst is the point: the
   * nose's lag peaks early and then closes again as the widening range lowers
   * the angular demand, so an end-of-burst reading understates the dodge by
   * roughly a factor of five.
   */
  function shotMisses(playerSpeed: number): number[] {
    // Fire from a spot the Duelist would really pick, resolved through the same
    // geometry the game uses — so moving the standoff or the band re-tunes this
    // test automatically instead of leaving it asserting a stale distance.
    const playerY = 864;
    const from = anchorFor(960, playerY, 0, R, BOUNDS);
    const dt = 1 / 60;
    let playerX = 960;
    let facing = Math.atan2(playerY - from.y, playerX - from.x);

    const misses: number[] = [];
    const shotAt = Array.from({ length: DUELIST.burstCount }, (_, i) =>
      Math.round((i * DUELIST.burstInterval) / dt),
    );
    const frames = shotAt[shotAt.length - 1];
    for (let f = 0; f <= frames; f++) {
      if (shotAt.includes(f)) {
        const range = Math.hypot(playerX - from.x, playerY - from.y);
        const target = Math.atan2(playerY - from.y, playerX - from.x);
        let lag = (target - facing) % (Math.PI * 2);
        if (lag > Math.PI) lag -= Math.PI * 2;
        if (lag < -Math.PI) lag += Math.PI * 2;
        misses.push(Math.abs(lag) * range);
      }
      playerX += playerSpeed * dt;
      const target = Math.atan2(playerY - from.y, playerX - from.x);
      facing = turnToward(facing, target, DUELIST.turnRate * dt);
    }
    return misses;
  }

  /** The player's core hitbox: half the 96px ship sprite, times the forgiving
   *  hitboxRadiusFactor. A shot landing further to the side than this misses. */
  const HITBOX = 48 * PLAYER.hitboxRadiusFactor;

  it("lands its first shot on a player who was standing still", () => {
    // The volley is never a free dodge — commit late and the opener still hits.
    expect(shotMisses(1500)[0]).toBeLessThan(HITBOX);
  });

  it("has its later shots trail a committed lateral break", () => {
    // The dodge the whole burst design rests on: crossing at the ship's top
    // speed (~1500px/s at 60Hz, ADR-0023) demands more of the nose than it can
    // give, so shots two and three land clearly wide.
    const misses = shotMisses(1500);
    for (const miss of misses.slice(1)) {
      expect(miss).toBeGreaterThan(HITBOX * 2);
    }
  });

  it("is slow enough that the nose has not caught up by the last shot", () => {
    // The close-range trap this rate was re-derived for: a player running
    // sideways opens the range fast, so the angle the nose owes collapses
    // mid-volley. A rate that only trails during the burst is not enough — it
    // must still be behind at the end, or the final shot lands for free.
    const misses = shotMisses(1500);
    expect(misses[misses.length - 1]).toBeGreaterThan(HITBOX * 2);
  });

  it("tracks a drifting player, so easing out of the line does not work", () => {
    // The other half of the design. If this ever starts failing, the turn rate
    // has been tuned into uselessness and the burst is a pure movement check.
    for (const miss of shotMisses(400)) {
      expect(miss).toBeLessThan(HITBOX);
    }
  });
});

describe("easeInOut", () => {
  it("starts at 0 and ends at 1", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
  });

  it("clamps outside 0..1 so a late frame cannot overshoot the spot", () => {
    expect(easeInOut(-0.5)).toBe(0);
    expect(easeInOut(1.5)).toBe(1);
  });

  it("eases: it barely moves at both ends and is fastest in the middle", () => {
    // This IS the requirement — the move pulls away from the spot it is leaving
    // and settles into the one it is taking, rather than running at a flat rate.
    const step = (k: number): number => easeInOut(k + 0.05) - easeInOut(k);
    expect(step(0)).toBeLessThan(step(0.475));
    expect(step(0.95)).toBeLessThan(step(0.475));
  });

  it("is symmetric about the midpoint", () => {
    for (const k of [0.1, 0.25, 0.4]) {
      expect(easeInOut(k)).toBeCloseTo(1 - easeInOut(1 - k));
    }
  });

  it("never leaves 0..1, so the sprite stays on the segment", () => {
    for (let k = 0; k <= 1; k += 0.05) {
      expect(easeInOut(k)).toBeGreaterThanOrEqual(0);
      expect(easeInOut(k)).toBeLessThanOrEqual(1);
    }
  });
});

describe("travelSeconds", () => {
  it("scales with distance, so long and short moves share a pace", () => {
    const near = travelSeconds(900, 900, 0);
    const far = travelSeconds(1800, 900, 0);
    expect(near).toBeCloseTo(1);
    expect(far).toBeCloseTo(2);
  });

  it("floors a tiny move so it eases instead of teleporting", () => {
    // Two consecutive spots can resolve almost on top of each other; without
    // the floor that move would finish inside a frame with no ease to read.
    expect(travelSeconds(1, DUELIST.moveSpeed, DUELIST.travelMinSeconds)).toBe(
      DUELIST.travelMinSeconds,
    );
    expect(travelSeconds(0, DUELIST.moveSpeed, DUELIST.travelMinSeconds)).toBe(
      DUELIST.travelMinSeconds,
    );
  });

  it("keeps a real repositioning brisk enough to leave dwell time", () => {
    // The widest move the band allows must not eat the whole loop, or the
    // Duelist is never parked and never shootable.
    const widest = Math.hypot(
      BOUNDS.maxX - BOUNDS.minX,
      DUELIST.bandMaxY - DUELIST.bandMinY,
    );
    const trip = travelSeconds(
      widest,
      DUELIST.moveSpeed,
      DUELIST.travelMinSeconds,
    );
    expect(trip).toBeLessThan(DUELIST.dwellSeconds * 1.5);
  });
});
