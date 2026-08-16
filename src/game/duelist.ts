/**
 * Pure standoff math for the Duelist (ADR-0024). Deliberately free of PixiJS so
 * the invariants can be unit-tested directly; the Enemy owns *when* these run,
 * this module owns only the arithmetic.
 *
 * Three rules define the behaviour:
 *  - The Duelist's position is derived from the PLAYER's, not from a path of its
 *    own: an arc angle plus a fixed standoff radius. Move the player and the
 *    whole arc moves with them, so the Duelist cannot be escaped, only out-timed.
 *  - The arc ANGLE is what gets bounded (to `halfRange` either side of straight
 *    above), not the resulting point. That keeps the Duelist in the player's
 *    upper half at every player position; the band clamp afterwards is only
 *    about staying on-screen and out of the player's zone.
 *  - Facing turns at a limited rate and shots leave along the nose, so the burst
 *    tracks a drifting player but can be outrun by a committed break. The
 *    tracking is honest: what you see the nose doing is what the gun does.
 *
 * Angle convention throughout: `arc` is measured from straight ABOVE the player,
 * positive toward the player's right. `facing` is a standard atan2 heading (0 =
 * +x, +y = down), which is what the renderer needs.
 */

/** A point in virtual space. */
export interface Point {
  x: number;
  y: number;
}

/** The rectangle the Duelist's anchor is confined to (virtual px). */
export interface ArcBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Where the Duelist wants to be: arc angle `arc` at standoff `radius` from the
 * player, confined to `bounds`, and never closer to the player than `radius`.
 *
 * The obvious implementation — take the point on the circle and clamp each axis
 * into the band — is wrong, and wrong in the one way that matters: a player who
 * flies up into the top band would drag the anchor down onto themselves (the
 * y-clamp cuts the vertical separation, and nothing replaces it), handing them a
 * free ram. So the band clamp is applied to y first, and whatever separation
 * that cost is then spent SIDEWAYS:
 *
 *   |dx| = max(|radius * sin(arc)|, sqrt(radius^2 - dy^2))
 *
 * The first term is the arc's own horizontal offset — it is what makes each
 * step around the arc land somewhere new. The second is the floor that keeps the
 * standoff intact once the ceiling has eaten into dy. Taking the larger keeps
 * both properties at once: distinct positions per arc step while the player
 * stays low, and a hard "never nearer than radius" once they climb.
 *
 * That is the whole un-rammable property, falling out of the geometry with no
 * flee state anywhere: charge the Duelist and its own anchor slides off sideways.
 *
 * The side is the arc's, unless that would put the anchor outside the field, in
 * which case it mirrors to the other side rather than being clamped inward —
 * clamping x is the same trap as clamping y, and mirroring always fits (the
 * field is wider than 2 * radius).
 */
export function anchorFor(
  playerX: number,
  playerY: number,
  arc: number,
  radius: number,
  bounds: ArcBounds,
): Point {
  const y = clamp(playerY - Math.cos(arc) * radius, bounds.minY, bounds.maxY);
  const dy = y - playerY;

  const spare = radius * radius - dy * dy;
  const floor = spare > 0 ? Math.sqrt(spare) : 0;
  const offset = Math.max(Math.abs(Math.sin(arc) * radius), floor);
  const side = Math.sin(arc) >= 0 ? 1 : -1;

  const preferred = playerX + offset * side;
  const mirrored = playerX - offset * side;
  const fits = (v: number): boolean => v >= bounds.minX && v <= bounds.maxX;
  const x = fits(preferred)
    ? preferred
    : fits(mirrored)
      ? mirrored
      : clamp(preferred, bounds.minX, bounds.maxX);

  return { x, y };
}

/**
 * Step the arc angle one move in `dir`, reflecting off +/-`halfRange`.
 *
 * Reflection (rather than clamping) is what stops the Duelist from parking at a
 * limit and re-picking the same spot forever: overshoot is folded back into the
 * range and the direction flips, so it paces across the player's arc. The fold
 * is applied repeatedly so a step wider than the whole range still lands inside
 * it — cheap insurance against a future tuning value nobody re-checked.
 */
export function stepArc(
  arc: number,
  dir: 1 | -1,
  step: number,
  halfRange: number,
): { arc: number; dir: 1 | -1 } {
  let next = arc + dir * step;
  let nextDir = dir;
  // A degenerate range has no interior to bounce in; pin to it and stop.
  if (halfRange <= 0) return { arc: 0, dir };
  while (next > halfRange || next < -halfRange) {
    next = next > halfRange ? 2 * halfRange - next : -2 * halfRange - next;
    nextDir = nextDir === 1 ? -1 : 1;
  }
  return { arc: next, dir: nextDir };
}

/**
 * Turn `facing` toward `target` by at most `maxStep`, taking the short way
 * round.
 *
 * This is the whole reason the burst is dodgeable: shots leave along the nose,
 * so a player who breaks laterally faster than `maxStep` per second drags the
 * nose behind them and the later shots of a volley trail into empty space.
 */
export function turnToward(
  facing: number,
  target: number,
  maxStep: number,
): number {
  // Shortest signed difference, wrapped into (-PI, PI].
  let delta = (target - facing) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return facing + clamp(delta, -maxStep, maxStep);
}

/**
 * Smoothstep over 0..1: the eased progress of one move between two Spots.
 *
 * Its derivative is zero at both ends, which is the whole point — the Duelist
 * pulls away from the Spot it is leaving and settles into the one it is taking,
 * instead of starting and stopping at full speed. Peak speed is 1.5x the average,
 * so a move's `moveSpeed` reads as its average pace, not its maximum.
 */
export function easeInOut(k: number): number {
  const t = clamp(k, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * How long one move should take: distance at `speed`, but never less than
 * `minSeconds`.
 *
 * Deriving the duration from the distance (rather than fixing it) keeps a short
 * hop and a long repositioning at the same apparent pace. The floor stops a
 * near-zero move — two consecutive Spots that resolve close together — from
 * collapsing into a teleport with no ease at all.
 */
export function travelSeconds(
  distance: number,
  speed: number,
  minSeconds: number,
): number {
  return Math.max(minSeconds, distance / speed);
}
