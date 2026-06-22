import { Assets, type Texture } from "pixi.js";

/**
 * Shared asset loader. Aliases map a stable name to a file under /public/assets.
 * Later issues add their sprites here; gameplay code references aliases via
 * getTexture(), never raw paths.
 */
const MANIFEST = {
  bg: "/assets/bg.png",
  starsA: "/assets/Stars-A.png",
  starsB: "/assets/Stars-B.png",
  ship: "/assets/SpaceShip.png",
  star: "/assets/star.png",
  bullet: "/assets/bullet.png",
  swarmer: "/assets/insect-1.png",
  gunner: "/assets/insect-2.png",
  enemyBullet: "/assets/plasm.png",
  asteroidLarge: "/assets/large-A.png",
  asteroidMedium: "/assets/medium-A.png",
  asteroidSmall: "/assets/small-A.png",
  // Player projectile skins selected by active modifiers.
  plasm: "/assets/plasm.png",
  laser1: "/assets/laser-1.png",
  laser2: "/assets/laser-2.png",
  laser3: "/assets/laser-3.png",
} as const;

export type AssetAlias = keyof typeof MANIFEST;

/** Load every manifest asset. Call once during boot, before any scene. */
export async function loadAssets(): Promise<void> {
  await Assets.load(
    Object.entries(MANIFEST).map(([alias, src]) => ({ alias, src })),
  );
}

/** Resolve a loaded texture by alias. */
export function getTexture(alias: AssetAlias): Texture {
  return Assets.get(alias);
}
