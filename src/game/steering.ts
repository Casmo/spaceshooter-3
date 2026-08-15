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
 * Order matters: cap the lead radially first (preserving the gesture's
 * direction), then clamp to bounds. A bounds clamp can only ever pull the
 * target closer to the ship, so it cannot break the lead invariant; doing it
 * the other way round could.
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
