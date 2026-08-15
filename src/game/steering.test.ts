import { describe, expect, it } from "vitest";
import { advanceTarget, easeToward, type SteerBounds } from "./steering";
import { PLAYER } from "../config";

/**
 * Invariant tests for the pure steering math. These are the properties that
 * make the ship feel the same on every machine, so they assert exact
 * relationships rather than eyeballed tolerances.
 */

const BOUNDS: SteerBounds = { minX: 0, maxX: 1920, minY: 0, maxY: 1080 };
const MAX_LEAD = 75;

const leadOf = (t: { x: number; y: number }, sx: number, sy: number): number =>
  Math.hypot(t.x - sx, t.y - sy);

describe("advanceTarget", () => {
  it("never lets the target lead the ship by more than maxLead", () => {
    // A violent flick must not build unbounded debt for the ship to pay back.
    for (const delta of [1, 50, 500, 50_000]) {
      const t = advanceTarget(
        { x: 960, y: 864 },
        960,
        864,
        delta,
        delta,
        0.8,
        MAX_LEAD,
        BOUNDS,
      );
      expect(leadOf(t, 960, 864)).toBeLessThanOrEqual(MAX_LEAD + 1e-9);
    }
  });

  it("caps radially, preserving the gesture's direction", () => {
    // A 3:4 flick stays a 3:4 flick after capping — no axis is favoured.
    const t = advanceTarget(
      { x: 960, y: 540 },
      960,
      540,
      3000,
      4000,
      1,
      MAX_LEAD,
      BOUNDS,
    );
    expect(t.x - 960).toBeCloseTo(MAX_LEAD * 0.6, 6);
    expect(t.y - 540).toBeCloseTo(MAX_LEAD * 0.8, 6);
  });

  it("keeps the target inside the play bounds", () => {
    const low = advanceTarget(
      { x: 10, y: 10 },
      10,
      10,
      -9999,
      -9999,
      1,
      MAX_LEAD,
      BOUNDS,
    );
    expect(low.x).toBeGreaterThanOrEqual(BOUNDS.minX);
    expect(low.y).toBeGreaterThanOrEqual(BOUNDS.minY);

    // The lower-bound case above would still pass if the clamp's upper bound
    // were silently replaced by Infinity — pin the max side too.
    const high = advanceTarget(
      { x: 1910, y: 1070 },
      1910,
      1070,
      9999,
      9999,
      1,
      MAX_LEAD,
      BOUNDS,
    );
    expect(high.x).toBeLessThanOrEqual(BOUNDS.maxX);
    expect(high.y).toBeLessThanOrEqual(BOUNDS.maxY);
  });

  it("bounds clamping only ever shortens the lead", () => {
    // Ship near a corner, flick further into it: the clamp pins the target, and
    // the lead invariant must survive that second clamp.
    const t = advanceTarget(
      { x: 0, y: 0 },
      5,
      5,
      -500,
      -500,
      1,
      MAX_LEAD,
      BOUNDS,
    );
    expect(leadOf(t, 5, 5)).toBeLessThanOrEqual(MAX_LEAD + 1e-9);
  });

  it("scales displacement linearly with sensitivity", () => {
    // This is what makes the Engine upgrade's *relative* power identical for
    // every player regardless of their sensitivity setting: the multiplier
    // cancels out of the ratio.
    const engineMult = 2.25;
    const a = advanceTarget(
      { x: 960, y: 540 },
      960,
      540,
      10,
      0,
      0.4 * engineMult,
      MAX_LEAD,
      BOUNDS,
    );
    const b = advanceTarget(
      { x: 960, y: 540 },
      960,
      540,
      10,
      0,
      1.6 * engineMult,
      MAX_LEAD,
      BOUNDS,
    );
    expect((b.x - 960) / (a.x - 960)).toBeCloseTo(1.6 / 0.4, 10);
  });
});

describe("easeToward", () => {
  it("is frame-rate independent: N small steps equal one large step", () => {
    // Remaining distance decays by exp(-response*dt) per call, and that
    // composes exactly — this is why 60Hz and 144Hz produce identical motion.
    let stepped = 0;
    for (let i = 0; i < 10; i++) stepped = easeToward(stepped, 100, 20, 0.01);
    expect(stepped).toBeCloseTo(easeToward(0, 100, 20, 0.1), 10);
  });

  it("never overshoots the target", () => {
    expect(easeToward(0, 100, 20, 0.1)).toBeLessThan(100);
    expect(easeToward(0, 100, 20, 10)).toBeLessThanOrEqual(100);
  });

  it("cannot cross the whole gap in one step, even at the 10fps dt floor", () => {
    // Pixi clamps deltaMS to 100ms (its minFPS default of 10), so dt=0.1 is the
    // worst case the ship will ever see. Response 30 is the maxed-Engine value.
    const gap = 75;
    expect(easeToward(0, gap, 30, 0.1)).toBeLessThan(gap);
  });
});

describe("advanceTarget + easeToward composed (the real per-frame loop)", () => {
  // The test above shows easeToward alone composes exactly across dt, because
  // it eases toward a FIXED target. In the real game loop the target isn't
  // fixed: advanceTarget re-pegs it to exactly maxLead ahead of the ship's
  // pre-move position every single frame (a violent flick saturates this).
  // That re-pegging breaks the composition property — each frame only closes
  // `1 - e^(-r*dt)` of a lead that gets reset before the next frame, so the
  // steady-state speed this loop converges to is NOT frame-rate independent.
  // It equals `maxLead * (1 - e^(-r*dt)) / dt`, approaching the naive
  // `r * maxLead` asymptote only as dt -> 0 (see config.ts PLAYER.maxLead and
  // ADR-0023). This test pins that true, frame-rate-dependent ceiling so a
  // future reader can't mistake the composed loop for inheriting easeToward's
  // frame-rate independence.
  // Bounds wide enough to never engage — this suite is about the lead cap
  // and the ease, not the bounds clamp (that's covered above).
  const WIDE_BOUNDS: SteerBounds = {
    minX: -1e9,
    maxX: 1e9,
    minY: -1e9,
    maxY: 1e9,
  };

  function saturatedSpeed(dt: number, response: number): number {
    let shipX = 0;
    let shipY = 0;
    let targetX = 0;
    let targetY = 0;
    // A flick large enough to peg the lead cap every single frame.
    const hugeDelta = 1e6;

    // Run long enough to reach steady state.
    for (let i = 0; i < 500; i++) {
      const next = advanceTarget(
        { x: targetX, y: targetY },
        shipX,
        shipY,
        hugeDelta,
        0,
        1,
        PLAYER.maxLead,
        WIDE_BOUNDS,
      );
      targetX = next.x;
      targetY = next.y;

      const nextShipX = easeToward(shipX, targetX, response, dt);
      const nextShipY = easeToward(shipY, targetY, response, dt);
      const speed = Math.hypot(nextShipX - shipX, nextShipY - shipY) / dt;
      shipX = nextShipX;
      shipY = nextShipY;

      if (i === 499) return speed;
    }
    throw new Error("unreachable");
  }

  it("saturates at maxLead * (1 - e^(-r*dt)) / dt, not the r*maxLead asymptote", () => {
    const dt = 1 / 60;
    const r = PLAYER.followResponse;
    const expected = (PLAYER.maxLead * (1 - Math.exp(-r * dt))) / dt;

    expect(saturatedSpeed(dt, r)).toBeCloseTo(expected, 6);
    // The true ceiling sits below the dt->0 asymptote r*maxLead — this is the
    // gap Finding 1 called out (the branch had documented the asymptote as if
    // it were the achieved speed).
    expect(expected).toBeLessThan(r * PLAYER.maxLead);
  });

  it("is NOT frame-rate independent: a smaller dt converges to a different speed", () => {
    const r = PLAYER.followResponse;
    const speed60 = saturatedSpeed(1 / 60, r);
    const speed144 = saturatedSpeed(1 / 144, r);

    // Both approach r*maxLead as dt shrinks, but they don't match each other —
    // unlike easeToward alone, which is exactly frame-rate independent.
    expect(speed144).toBeGreaterThan(speed60);
    expect(speed144).toBeLessThan(r * PLAYER.maxLead);
  });
});
