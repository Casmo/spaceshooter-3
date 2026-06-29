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
 * The background is a parallax star layer built from BG_Stars1 (split out of
 * the Space_xx sheets — see the Backgrounds folder).
 */

/** Base files loaded by the Assets system (sheets included, sliced below). */
const MANIFEST = {
  ship: "./assets/SpaceShooter/Player/Player01-Sheet.png",
  swarmer: "./assets/SpaceShooter/Enemies/fighter1.png",
  gunner: "./assets/SpaceShooter/Enemies/Gunship.png",
  miniboss: "./assets/SpaceShooter/Enemies/Pirate_Boss.png",
  boss: "./assets/SpaceShooter/Enemies/fighter2.png",
  mine: "./assets/SpaceShooter/Enemies/Asteroids_Explosive.png",
  warden: "./assets/SpaceShooter/Enemies/CrabShip.png",
  // Bomber: a 5-frame animation sheet (16x16 each). The first animated enemy —
  // the Enemy cycles these frames in update() (ADR-0013).
  bomber: "./assets/SpaceShooter/ProjectilesAndExplosions/Bombe-Sheet.png",
  asteroids: "./assets/SpaceShooter/Enemies/Asteroids-Sheet.png",
  // Debris atlas (6 irregular chunks). The Warden's Shield Nodes are cut from
  // the 3rd chunk (31x31 at 210,19) — not an even-frame slice.
  debris: "./assets/SpaceShooter/Enemies/Debris-Sheet.png",
  bullet: "./assets/SpaceShooter/ProjectilesAndExplosions/Projectile04.png",
  enemyBullet:
    "./assets/SpaceShooter/ProjectilesAndExplosions/Projectile03.png",
  explosion:
    "./assets/SpaceShooter/ProjectilesAndExplosions/Explosion02-Sheet.png",
  explosionBig:
    "./assets/SpaceShooter/ProjectilesAndExplosions/Explosion04-Sheet.png",
  explosionSmall:
    "./assets/SpaceShooter/ProjectilesAndExplosions/Explosion01-Sheet.png",
  star: "./assets/SpaceShooter/Powerup/Credits-Sheet.png",
  // Parallax background star layer.
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
  | "boss"
  | "mine"
  | "warden"
  | "bomber"
  | "shieldNode"
  | "asteroidLarge"
  | "asteroidMedium"
  | "asteroidSmall"
  | "bullet"
  | "enemyBullet"
  | "star"
  | "smoke"
  | "starsA"
  | "cursor"
  | "explosion";

/** Aliases backed by an animation sheet (resolved via getFrames()). */
export type FrameAlias =
  | "ship"
  | "star"
  | "bomber"
  | "explosion"
  | "explosionBig"
  | "explosionSmall";

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
  // Textures plus the UI font, in one batch so a failure of either is fatal
  // alike. The font is registered under the family "Asimovian" (referenced via
  // FONT_FAMILY in config); it is NOT a Texture, so it stays out of MANIFEST and
  // the nearest-neighbour scaleMode loop below.
  await Assets.load([
    ...Object.entries(MANIFEST).map(([alias, src]) => ({ alias, src })),
    {
      alias: "font-asimovian",
      src: "./assets/Fonts/Asimovian-Regular.ttf",
      data: { family: "Asimovian" },
    },
  ]);

  // Pixel art: sample everything nearest-neighbour so it stays crisp. Frames
  // share their sheet's source, so setting it on the base covers them too.
  for (const alias of Object.keys(MANIFEST)) {
    (Assets.get(alias) as Texture).source.scaleMode = "nearest";
  }

  // Direct single-texture mappings.
  textures.set("swarmer", Assets.get("swarmer"));
  textures.set("gunner", Assets.get("gunner"));
  textures.set("miniboss", Assets.get("miniboss"));
  textures.set("boss", Assets.get("boss"));
  textures.set("mine", Assets.get("mine"));
  textures.set("warden", Assets.get("warden"));
  // Shield Node: one irregular chunk cut from the Debris atlas (31x31 at 210,19).
  textures.set(
    "shieldNode",
    new Texture({
      source: (Assets.get("debris") as Texture).source,
      frame: new Rectangle(210, 19, 31, 31),
    }),
  );
  textures.set("bullet", Assets.get("bullet"));
  textures.set("enemyBullet", Assets.get("enemyBullet"));
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

  // Mine detonation: a large 11-frame burst (480x480). At native scale its
  // half-height (240) is exactly the Mine's blast radius — the art is the hitbox.
  frameSets.set(
    "explosionBig",
    sliceFrames(Assets.get("explosionBig"), 480, 11),
  );

  // Hit Spark burst: small 5-frame (32x32) flash played on every bullet hit.
  frameSets.set(
    "explosionSmall",
    sliceFrames(Assets.get("explosionSmall"), 32, 5),
  );

  // Bomber: a 5-frame animation sheet (16x16). The Enemy cycles these in
  // update() (ADR-0013); the body texture defaults to the first frame.
  const bomberFrames = sliceFrames(Assets.get("bomber"), 16, 5);
  frameSets.set("bomber", bomberFrames);
  textures.set("bomber", bomberFrames[0]);

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
