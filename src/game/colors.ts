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
