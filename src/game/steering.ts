/**
 * Pure steering math for the player ship (ADR-0023). Deliberately free of
 * PixiJS so the invariants can be unit-tested directly; Player owns *when*
 * these run, this module owns only the arithmetic.
 *
 * Two rules define the feel:
 *  - The steer target may never sit more than `maxLead` ahead of the ship. That
 *    bounds trailing lag, and — since ship velocity is `followResponse * lead` —
 *    it doubles as the speed limit, so there is no second motion law to switch
 *    into mid-gesture (which is what the old maxSpeed clamp did).
 *  - The ship approaches the target by exponential decay, which composes
 *    exactly across frames, so 60Hz and 144Hz produce identical motion.
 */

/** A point in virtual space. */
export interface Point {
  x: number;
  y: number;
}

/** Axis-aligned play area the steer target is confined to (virtual px). */
export interface SteerBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/**
 * Shove the steer target by a mouse delta, then bound it.
 *
 * `sensitivity` is the *effective* value — the player's setting already
 * multiplied by the Engine upgrade bonus. This module knows nothing of either.
 *
 * Order doesn't affect correctness here — the bounds box is convex and the
 * radial cap places the target on the segment between the (in-bounds) ship
 * and the raw target, so either order preserves both invariants. Cap-then-
 * clamp is done for feel instead: it keeps the target on the gesture's actual
 * direction until the bounds box forces a compromise, rather than letting an
 * edge-hugging bounds clamp skew the direction before the radial cap locks it in.
 */
export function advanceTarget(
  target: Point,
  shipX: number,
  shipY: number,
  dx: number,
  dy: number,
  sensitivity: number,
  maxLead: number,
  bounds: SteerBounds,
): Point {
  let x = target.x + dx * sensitivity;
  let y = target.y + dy * sensitivity;

  const leadX = x - shipX;
  const leadY = y - shipY;
  const dist = Math.hypot(leadX, leadY);
  if (dist > maxLead) {
    const k = maxLead / dist;
    x = shipX + leadX * k;
    y = shipY + leadY * k;
  }

  return {
    x: clamp(x, bounds.minX, bounds.maxX),
    y: clamp(y, bounds.minY, bounds.maxY),
  };
}

/**
 * Frame-rate independent exponential approach toward `target`, one axis at a
 * time. Written as "target plus decayed remainder" rather than "position plus
 * eased step" because the composition property is then self-evident: N steps of
 * dt land exactly where one step of N*dt does.
 */
export function easeToward(
  pos: number,
  target: number,
  response: number,
  dt: number,
): number {
  return target + (pos - target) * Math.exp(-response * dt);
}
