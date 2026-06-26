import { Assets, Rectangle, Texture } from "pixi.js";

/**
 * Shared asset loader for the SpaceShooter pixel-art pack. Aliases map a stable
 * name to a file under /public/assets/SpaceShooter; gameplay code references
 * aliases via getTexture()/getFrames(), never raw paths.
 *
 * The pack is low-res pixel art rendered at native size on the 1920x1080 field
 * (no upscaling — see the asset-refactor session), so every source is sampled
 * nearest-neighbour to stay crisp. Several assets ship as horizontal sprite
 * sheets; loadAssets() slices those into per-frame Textures.
 *
 * The background is a 2-layer parallax built from BG_Nebula and BG_Stars1
 * (halves split out of the Space_xx sheets — see the Backgrounds folder).
 */

/** Base files loaded by the Assets system (sheets included, sliced below). */
const MANIFEST = {
  ship: "./assets/SpaceShooter/Player/Player01-Sheet.png",
  swarmer: "./assets/SpaceShooter/Enemies/fighter1.png",
  gunner: "./assets/SpaceShooter/Enemies/Gunship.png",
  miniboss: "./assets/SpaceShooter/Enemies/Pirate_Boss.png",
  asteroids: "./assets/SpaceShooter/Enemies/Asteroids-Sheet.png",
  bullet: "./assets/SpaceShooter/ProjectilesAndExplosions/Projectile04.png",
  enemyBullet:
    "./assets/SpaceShooter/ProjectilesAndExplosions/Projectile03.png",
  explosion:
    "./assets/SpaceShooter/ProjectilesAndExplosions/Explosion02-Sheet.png",
  explosionSmall:
    "./assets/SpaceShooter/ProjectilesAndExplosions/Explosion01-Sheet.png",
  star: "./assets/SpaceShooter/Powerup/Credits-Sheet.png",
  // Parallax background layers (nebula = slow/far, stars = faster/near).
  nebula: "./assets/SpaceShooter/Backgrounds/BG_Nebula.png",
  starsA: "./assets/SpaceShooter/Backgrounds/BG_Stars1.png",
  // Menu Cursor: drawn pointer for the (lock-held) Upgrade Prompt. Lives outside
  // the SpaceShooter pack as a placeholder art (see ADR-0008).
  cursor: "./assets/cursor.png",
} as const;

/** Every texture alias gameplay code can resolve via getTexture(). */
export type AssetAlias =
  | "ship"
  | "swarmer"
  | "gunner"
  | "miniboss"
  | "asteroidLarge"
  | "asteroidMedium"
  | "asteroidSmall"
  | "bullet"
  | "enemyBullet"
  | "star"
  | "smoke"
  | "nebula"
  | "starsA"
  | "cursor"
  | "explosion";

/** Aliases backed by an animation sheet (resolved via getFrames()). */
export type FrameAlias = "ship" | "star" | "explosion" | "explosionSmall";

const textures = new Map<AssetAlias, Texture>();
const frameSets = new Map<FrameAlias, Texture[]>();

/** Slice a horizontal sprite sheet into `count` equal frames (full height). */
function sliceFrames(
  base: Texture,
  frameWidth: number,
  count: number,
): Texture[] {
  const frames: Texture[] = [];
  for (let i = 0; i < count; i++) {
    frames.push(
      new Texture({
        source: base.source,
        frame: new Rectangle(i * frameWidth, 0, frameWidth, base.height),
      }),
    );
  }
  return frames;
}

/** Load every manifest asset, then derive frames and named textures. */
export async function loadAssets(): Promise<void> {
  await Assets.load(
    Object.entries(MANIFEST).map(([alias, src]) => ({ alias, src })),
  );

  // Pixel art: sample everything nearest-neighbour so it stays crisp. Frames
  // share their sheet's source, so setting it on the base covers them too.
  for (const alias of Object.keys(MANIFEST)) {
    (Assets.get(alias) as Texture).source.scaleMode = "nearest";
  }

  // Direct single-texture mappings.
  textures.set("swarmer", Assets.get("swarmer"));
  textures.set("gunner", Assets.get("gunner"));
  textures.set("miniboss", Assets.get("miniboss"));
  textures.set("bullet", Assets.get("bullet"));
  textures.set("enemyBullet", Assets.get("enemyBullet"));
  textures.set("nebula", Assets.get("nebula"));
  textures.set("starsA", Assets.get("starsA"));
  textures.set("cursor", Assets.get("cursor"));

  // Player ship: 5 banking frames (48x48). The HUD life-icon uses the centre.
  const shipFrames = sliceFrames(Assets.get("ship"), 48, 5);
  frameSets.set("ship", shipFrames);
  textures.set("ship", shipFrames[2]);

  // XP pickup: spinning coin, 5 frames (16x16).
  frameSets.set("star", sliceFrames(Assets.get("star"), 16, 5));

  // Explosion burst: 10 frames (64x64). A late, smoky frame doubles as the
  // Burn/Homing trail puff so trails don't each spawn a full animation.
  const explosionFrames = sliceFrames(Assets.get("explosion"), 64, 10);
  frameSets.set("explosion", explosionFrames);
  textures.set("smoke", explosionFrames[6]);

  // Hit Spark burst: small 5-frame (32x32) flash played on every bullet hit.
  frameSets.set(
    "explosionSmall",
    sliceFrames(Assets.get("explosionSmall"), 32, 5),
  );

  // Asteroids: one 12-frame sheet (64x64); pick three distinct sizes.
  const asteroidFrames = sliceFrames(Assets.get("asteroids"), 64, 12);
  textures.set("asteroidLarge", asteroidFrames[0]);
  textures.set("asteroidMedium", asteroidFrames[2]);
  textures.set("asteroidSmall", asteroidFrames[4]);
}

/** Resolve a loaded texture by alias. */
export function getTexture(alias: AssetAlias): Texture {
  const tex = textures.get(alias);
  if (!tex) throw new Error(`Texture not loaded: ${alias}`);
  return tex;
}

/** Resolve the frame array for an animated (sheet-backed) alias. */
export function getFrames(alias: FrameAlias): Texture[] {
  const frames = frameSets.get(alias);
  if (!frames) throw new Error(`Frames not loaded: ${alias}`);
  return frames;
}
