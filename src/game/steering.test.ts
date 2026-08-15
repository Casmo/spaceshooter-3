import { describe, expect, it } from "vitest";
import { advanceTarget, easeToward, type SteerBounds } from "./steering";

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
    const t = advanceTarget(
      { x: 10, y: 10 },
      10,
      10,
      -9999,
      -9999,
      1,
      MAX_LEAD,
      BOUNDS,
    );
    expect(t.x).toBeGreaterThanOrEqual(BOUNDS.minX);
    expect(t.y).toBeGreaterThanOrEqual(BOUNDS.minY);
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
