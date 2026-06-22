/**
 * Central tuning config — the single home for all tunable game values.
 * Later issues (waves, upgrades, modifiers, balance) extend this file.
 */

/** Fixed virtual resolution. The world is authored at this size and scaled to
 *  fit the window with letterboxing (see docs/adr/0002). */
export const VIRTUAL_WIDTH = 1920;
export const VIRTUAL_HEIGHT = 1080;

/** Parallax starfield scroll speeds, in virtual px/second (top -> bottom). */
export const STARFIELD = {
  /** Far background nebula — slowest. */
  bgSpeed: 8,
  /** Mid star layer. */
  starsASpeed: 28,
  /** Near star layer — fastest, strongest parallax. */
  starsBSpeed: 55,
} as const;

/** Player ship movement, placement, and survival. */
export const PLAYER = {
  /** Display scale applied to SpaceShip.png. */
  scale: 0.5,
  /** Spawn position (virtual coords). */
  startX: VIRTUAL_WIDTH / 2,
  startY: VIRTUAL_HEIGHT * 0.8,
  /** Eased-follow smoothing toward the cursor, per second (higher = snappier).
   *  The Move Speed upgrade will raise this in a later issue. */
  followResponse: 12,
  /** Hard cap on how fast the ship can travel, virtual px/second. The ship
   *  "chases" a far cursor at this speed; the Move Speed upgrade raises it. */
  maxSpeed: 1600,
  /** Starting max HP for a fresh run. HP upgrade raises this later. */
  maxHp: 100,
  /** Starting lives for a fresh run. */
  startLives: 3,
  /** Core hitbox radius as a fraction of the ship's smaller half-dimension —
   *  much smaller than the sprite so grazing feels fair. */
  hitboxRadiusFactor: 0.28,
  /** Invulnerability after taking a hit, seconds. */
  iframesHit: 1.0,
  /** Invulnerability after respawning, seconds. */
  iframesRespawn: 2.0,
  /** Blink toggle interval while invulnerable, seconds. */
  blinkInterval: 0.1,
} as const;

/** Base weapon (the single gun; modifiers come in a later issue). */
export const WEAPON = {
  /** Seconds between shots. Fire Rate upgrade reduces this later. */
  cooldown: 0.16,
  /** Bullet travel speed upward, virtual px/second. */
  bulletSpeed: 1400,
  /** Display scale applied to bullet.png. */
  bulletScale: 0.4,
  /** Damage per bullet. Shooting Power upgrade raises this later. */
  damage: 12,
  /** Collision radius of a bullet as a fraction of its half-width. */
  bulletRadiusFactor: 0.8,
} as const;

/** Swarmer enemy (insect-1): fast, low HP, contact-only. */
export const SWARMER = {
  scale: 0.7,
  hp: 24,
  /** HP removed from the player on contact. */
  contactDamage: 20,
  /** Downward travel speed, virtual px/second. */
  speed: 260,
  /** Horizontal sine sway amplitude (virtual px) and frequency (Hz-ish). */
  swayAmplitude: 130,
  swayFrequency: 1.4,
  /** Collision radius as a fraction of the sprite half-width. */
  radiusFactor: 0.7,
  /** Seconds between spawns (temporary; replaced by waves in #4). */
  spawnInterval: 0.7,
} as const;

/** Projectile pooling and the safety cap. */
export const PROJECTILES = {
  /** Hard cap on simultaneously-live projectiles (frame-rate safety net).
   *  Bump this if heavy modifier builds ever clip it. */
  maxLive: 1500,
  /** How many projectile objects to pre-allocate in the pool. */
  poolInitial: 256,
  /** Off-screen margin (virtual px) beyond which a projectile despawns. */
  despawnMargin: 80,
} as const;
