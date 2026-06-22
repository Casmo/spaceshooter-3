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
  /** Base star-attraction radius (virtual px). Pickup Range upgrade raises it. */
  basePickupRange: 90,
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
} as const;

/** Gunner enemy (insect-2): tougher, slower, fires aimed shots at the player. */
export const GUNNER = {
  scale: 0.8,
  hp: 70,
  contactDamage: 25,
  speed: 120,
  bulletDamage: 12,
  shootInterval: 1.6,
  radiusFactor: 0.7,
} as const;

/** Asteroid hazards. Each size drifts down, deals contact damage, and splits
 *  into smaller ones (large -> medium -> small). */
export type AsteroidSize = "large" | "medium" | "small";
export const ASTEROID: Record<
  AsteroidSize,
  {
    tex: "asteroidLarge" | "asteroidMedium" | "asteroidSmall";
    hp: number;
    contactDamage: number;
    speed: number;
    scale: number;
    spin: number;
    splitInto: AsteroidSize | null;
    splitCount: number;
    radiusFactor: number;
  }
> = {
  large: {
    tex: "asteroidLarge",
    hp: 90,
    contactDamage: 30,
    speed: 130,
    scale: 0.9,
    spin: 0.5,
    splitInto: "medium",
    splitCount: 2,
    radiusFactor: 0.78,
  },
  medium: {
    tex: "asteroidMedium",
    hp: 45,
    contactDamage: 22,
    speed: 175,
    scale: 0.9,
    spin: 0.8,
    splitInto: "small",
    splitCount: 2,
    radiusFactor: 0.78,
  },
  small: {
    tex: "asteroidSmall",
    hp: 20,
    contactDamage: 15,
    speed: 220,
    scale: 0.9,
    spin: 1.2,
    splitInto: null,
    splitCount: 0,
    radiusFactor: 0.78,
  },
};

/** Mini-boss: scaled-up Gunner, wave-5 capstone, fires a fan at the player. */
export const MINIBOSS = {
  scale: 2.2,
  hp: 900,
  /** HP scaling per mini-boss appearance (gets tougher each time). */
  hpPerAppearance: 0.5,
  contactDamage: 40,
  /** Descent speed until it settles. */
  speed: 90,
  /** Y it settles at, then strafes horizontally. */
  targetY: 240,
  strafeSpeed: 170,
  bulletDamage: 18,
  shootInterval: 1.1,
  fanCount: 3,
  fanSpreadDeg: 26,
  radiusFactor: 0.7,
} as const;

/** Enemy projectile (recolored plasm.png, tinted by damage tier). */
export const ENEMY_BULLET = {
  scale: 0.45,
  speed: 540,
  radiusFactor: 0.7,
} as const;

/** Damage-tier colors (low -> high) for tinting enemy bullets so the threat is
 *  readable at a glance. `max` is the inclusive upper bound for that tier. */
export const DAMAGE_TIERS: readonly { max: number; color: number }[] = [
  { max: 10, color: 0xffffff }, // white
  { max: 20, color: 0xffe066 }, // yellow
  { max: 30, color: 0xff9933 }, // orange
  { max: 45, color: 0xff4444 }, // red
  { max: Infinity, color: 0xb066ff }, // purple
];

/** Wave structure, escalation, and pacing. */
export const WAVES = {
  /** Enemy-free breather between waves, seconds. */
  breatherSeconds: 3,
  /** Seconds between spawns within a wave (wave 1). */
  baseSpawnInterval: 0.7,
  /** Spawn interval shrinks by this each wave (faster spawns later). */
  spawnIntervalDecayPerWave: 0.02,
  minSpawnInterval: 0.25,
  /** Enemy count in wave 1, and growth per wave. */
  baseBudget: 6,
  budgetPerWave: 2,
  /** Stat scaling per wave. */
  hpMultPerWave: 0.08,
  speedMultPerWave: 0.03,
  /** +1 asteroid split every N waves (capped). */
  splitBonusEveryWaves: 4,
  maxAsteroidSplit: 4,
  /** A mini-boss caps every Nth wave. */
  miniBossEvery: 5,
  /** Extra swarmers spawned alongside the mini-boss. */
  miniBossEscort: 3,
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

/** XP awarded per kill (by enemy type) and the level-up threshold curve.
 *  NOTE: the curve constants are placeholders — issue #10 tunes them toward
 *  ~30 level-ups for an average run / ~50 for a great run. */
export const XP = {
  swarmer: 1,
  gunner: 3,
  asteroidLarge: 4,
  asteroidMedium: 2,
  asteroidSmall: 1,
  miniboss: 25,
  /** XP granted by collecting a Star. */
  star: 10,
  /** First level-up needs this much XP. */
  baseThreshold: 5,
  /** Each level multiplies the threshold by this (geometric growth). */
  growth: 1.18,
} as const;

/** Star pickup: the only collectible in v1 (XP only). */
export const STAR = {
  scale: 0.5,
  /** Seconds before an uncollected star expires. */
  lifetime: 5,
  /** Drop chance per normal kill (mini-boss always drops one). */
  dropChance: 0.05,
  /** Fly-over collection radius (virtual px). */
  collectRadius: 70,
  /** Attraction smoothing toward the ship while within pickup range, per sec. */
  magnetEase: 9,
  /** Blink during the final N seconds before expiry. */
  blinkBefore: 1.5,
} as const;

/** Upgrade rarity tiers and their card colors. */
export type Rarity = "common" | "uncommon" | "rare" | "veryRare";
export const RARITY_COLORS: Record<Rarity, number> = {
  common: 0x9aa0a6, // gray
  uncommon: 0x57d957, // green
  rare: 0xff9933, // orange
  veryRare: 0xb066ff, // purple
};

/** The non-modifier upgrade pool (bullet modifiers are added in #6).
 *  cap: 0 = unlimited. At least 3 unlimited types keep the 3-card draw full. */
export const UPGRADES = {
  damage: { cap: 0, weight: 10, rarity: "common", amount: 6 },
  moveSpeed: {
    cap: 10,
    weight: 10,
    rarity: "common",
    speedAmount: 120,
    responseAmount: 1,
  },
  fireRate: { cap: 0, weight: 10, rarity: "common", mult: 0.95 },
  maxHp: { cap: 0, weight: 3, rarity: "rare", amount: 25 },
  extraLife: { cap: 0, weight: 1, rarity: "veryRare" },
  pickupRange: { cap: 10, weight: 6, rarity: "uncommon", amount: 120 },
} as const;

/** Bullet-modifier mechanics. All modifiers stack orthogonally on the one gun. */
export const MODIFIERS = {
  /** +N projectiles per Multishot level. */
  multishotPerLevel: 1,
  /** Arc (degrees) added per Spread level. */
  spreadDegPerLevel: 12,
  /** Minimum gap (degrees) between adjacent multishot projectiles so they don't
   *  perfectly overlap even with no Spread. */
  multishotMinGapDeg: 8,
  /** +N enemies pierced per Pierce level. */
  piercePerLevel: 1,
} as const;

/** The 7 bullet modifiers as upgrade cards (all uncommon/green, cap 10).
 *  Multishot/Spread/Pierce ship in #6a; the rest are wired in #6b. */
export const MODIFIER_UPGRADES = {
  multishot: { cap: 10, weight: 8, rarity: "uncommon" },
  spread: { cap: 10, weight: 8, rarity: "uncommon" },
  pierce: { cap: 10, weight: 8, rarity: "uncommon" },
  homing: { cap: 10, weight: 8, rarity: "uncommon" },
  explosive: { cap: 10, weight: 8, rarity: "uncommon" },
  burn: { cap: 10, weight: 8, rarity: "uncommon" },
  bounce: { cap: 10, weight: 8, rarity: "uncommon" },
} as const;

/** Effect parameters for the #6b modifiers (Homing/Explosive/Burn/Bounce). */
export const MODIFIER_FX = {
  /** Homing turn rate (rad/s): scales per level up to a cap. */
  homing: { turnRatePerLevel: 2.5, maxTurnRate: 11 },
  /** Explosive AoE on impact. Damage is a fraction of the bullet's damage. */
  explosive: { baseRadius: 70, radiusPerLevel: 16, damageFactor: 0.6 },
  /** Burn damage-over-time. dps scales per level; duration is fixed. */
  burn: { dpsPerLevel: 7, duration: 2 },
  /** Bounce fragments: 1 per level, 50% damage, short-lived, non-recursive. */
  bounce: { damageFactor: 0.5, life: 0.35, speed: 760, scale: 0.32 },
  /** Trail puffs dropped by Homing (cyan) / Burn (orange) bullets. */
  trail: { interval: 0.03, life: 0.25, scale: 0.5 },
  /** Explosion flash visual. */
  explosionFlash: { life: 0.3, growth: 2.4 },
  /** Tints. */
  tint: {
    rocketExplosive: 0xff5544,
    rocketHoming: 0x66ddff,
    burn: 0xff8a3d,
    homingTrail: 0x66ddff,
    burnTrail: 0xff8a3d,
    explosion: 0xff5533,
    fragment: 0xcfd8ff,
  },
} as const;
