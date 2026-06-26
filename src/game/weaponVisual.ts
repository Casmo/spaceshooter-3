import type { AssetAlias } from "../assets";

export interface BulletVisual {
  alias: AssetAlias;
  tint: number;
}

/**
 * The player bullet is always the same sprite: the Projectile04 circle, untinted.
 * Modifiers never change how the bullet looks — they express themselves through
 * added effects (e.g. Burn's smoke trail, Explosive's burst), wired in GameScene.
 * Kept as a function so callers stay unchanged if per-modifier looks ever return.
 */
export function resolveBulletVisual(): BulletVisual {
  return { alias: "bullet", tint: 0xffffff };
}
