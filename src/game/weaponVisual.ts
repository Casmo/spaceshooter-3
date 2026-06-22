import type { AssetAlias } from "../assets";
import type { WeaponModifiers } from "./WeaponModifiers";

export interface BulletVisual {
  alias: AssetAlias;
  tint: number;
}

/**
 * Resolve the player bullet's appearance from its active modifiers. Player
 * bullets are styled by modifiers (not by damage). The base sprite is chosen by
 * a fixed priority; #6b extends the high-priority end (Explosive/Homing ->
 * rocket, Burn -> fire). Trails/tints layer on top of this base.
 *
 * Priority (highest first): Explosive/Homing -> Pierce -> Burn ->
 * Multishot/Spread -> none.
 */
export function resolveBulletVisual(m: WeaponModifiers): BulletVisual {
  // #6b inserts rocket (Explosive/Homing) and fire (Burn) ahead of these.
  if (m.pierce > 0) {
    const tier = Math.min(3, m.pierce);
    const alias = (
      tier === 1 ? "laser1" : tier === 2 ? "laser2" : "laser3"
    ) as AssetAlias;
    return { alias, tint: 0x9fd0ff };
  }
  if (m.multishot > 0 || m.spread > 0) {
    return { alias: "plasm", tint: 0xffffff };
  }
  return { alias: "bullet", tint: 0xffffff };
}
