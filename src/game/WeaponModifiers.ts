/** The six bullet modifiers. They stack orthogonally on the single weapon. */
export type ModifierId =
  | "multishot"
  | "pierce"
  | "homing"
  | "explosive"
  | "burn"
  | "bounce";

/** Current level of each modifier (0 = not taken). */
export type WeaponModifiers = Record<ModifierId, number>;

export function createModifiers(): WeaponModifiers {
  return {
    multishot: 0,
    pierce: 0,
    homing: 0,
    explosive: 0,
    burn: 0,
    bounce: 0,
  };
}
