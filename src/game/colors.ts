import { DAMAGE_TIERS } from "../config";

/**
 * Map a damage amount to its tier color (white -> yellow -> orange -> red ->
 * purple). Used to tint enemy bullets so the player can read incoming threat.
 */
export function damageTierColor(damage: number): number {
  for (const tier of DAMAGE_TIERS) {
    if (damage <= tier.max) return tier.color;
  }
  return DAMAGE_TIERS[DAMAGE_TIERS.length - 1].color;
}

/** Linear-interpolate two 0xRRGGBB colours. Shared by the Drone's heat gradient
 *  and the Lode's gold shimmer. */
export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const r = Math.round(ar + (((b >> 16) & 0xff) - ar) * t);
  const g = Math.round(ag + (((b >> 8) & 0xff) - ag) * t);
  const bl = Math.round(ab + ((b & 0xff) - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
