/**
 * Central tuning config — the single home for all tunable game values.
 * Later issues (waves, upgrades, modifiers, balance) extend this file.
 */

/** Fixed virtual resolution. The world is authored at this size and scaled to
 *  fit the window with letterboxing (see docs/adr/0002). */
export const VIRTUAL_WIDTH = 1920;
export const VIRTUAL_HEIGHT = 1080;

/** The font family for all on-screen text. Asimovian (a smooth sci-fi display
 *  face) is loaded in loadAssets() and registered under the family "Asimovian";
 *  the chain falls back per-glyph and whole-font if it's ever unavailable. A
 *  future body-font pairing would split this into display/body constants. */
export const FONT_FAMILY = "Asimovian, Arial, sans-serif";

/** Parallax background scroll speed (virtual px/second, top -> bottom). A star
 *  layer (split out of the Space_xx sheets) scrolls over a solid black base. */
export const STARFIELD = {
  starsASpeed: 40,
} as const;

/** Audio: out-of-the-box volume defaults and the SFX rate-limits (ADR-0014).
 *  Music and SFX are two independent volumes (0..1), each adjusted in 10% steps;
 *  0 is the off switch (no separate mute). Persisted via Settings. Sample-to-
 *  event mapping and per-call weights live in game/audio.ts and the call sites. */
export const AUDIO = {
  /** First-launch volumes (0..1). Quiet by default — music is a bed under SFX. */
  musicDefault: 0.3,
  sfxDefault: 0.5,
  /** Step size for the +/- controls (fraction of full). */
  volumeStep: 0.1,
  /** Per-id minimum gap between plays (ms) for the frequent effects, so a dense
   *  volley doesn't machine-gun one sample. 0 / absent = never throttled. */
  throttleMs: {
    /** The per-bullet Hit Spark sound fires on every impact — heavily gated. */
    bulletHit: 80,
    /** Enemy fire can burst (Gunner volleys, Mini-boss fans) — lightly gated. */
    enemyShoot: 60,
  },
} as const;

/** Player ship movement, placement, and survival. */
export const PLAYER = {
  /** Display scale. 2x native size (bullets stay at native size). */
  scale: 2,
  /** Spawn position (virtual coords). */
  startX: VIRTUAL_WIDTH / 2,
  startY: VIRTUAL_HEIGHT * 0.8,
  /** Mouse sensitivity: how far the steer-target moves per unit of mouse motion.
   *  Deltas are normalized by the letterbox scale first, so this is window-size
   *  independent; 1.0 means the ship tracks the hand 1:1 on screen. The Engine
   *  upgrade raises it (see docs/adr/0006). */
  sensitivity: 0.8,
  /** Eased-follow smoothing toward the steer-target, per second (higher =
   *  snappier). The Engine upgrade raises it. */
  followResponse: 12,
  /** Teleport-guard: caps a single frame's step so a violent mouse flick can't
   *  warp the ship across the field. Fixed — not raised by the Engine upgrade. */
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
  /** Seconds between shots. Deliberately slow at the start; Fire Rate upgrades
   *  bring it down over a run. */
  cooldown: 0.3,
  /** Bullet travel speed upward, virtual px/second. */
  bulletSpeed: 1400,
  /** Display scale applied to the bullet sprite. Native size (1.0). */
  bulletScale: 1,
  /** Damage per bullet. Shooting Power upgrade raises this later. */
  damage: 12,
  /** Collision radius of a bullet as a fraction of its half-width. */
  bulletRadiusFactor: 0.8,
} as const;

/** Swarmer enemy (insect-1): fast, low HP, contact-only. */
export const SWARMER = {
  scale: 2,
  hp: 24,
  /** HP removed from the player on contact. */
  contactDamage: 20,
  /** Downward travel speed, virtual px/second (ramps via WAVES speed steps). */
  speed: 135,
  /** Horizontal sine sway amplitude (virtual px) and frequency (Hz-ish). */
  swayAmplitude: 130,
  swayFrequency: 1.4,
  /** Collision radius as a fraction of the sprite half-width. */
  radiusFactor: 0.7,
} as const;

/** Gunner enemy (insect-2): tougher, slower, fires aimed shots at the player.
 *  From burstStartWave on, every Gunner fires a burst instead of a single shot:
 *  burstCount shots burstInterval apart, all aimed once at burst start (one
 *  dodgeable line), then the normal shootInterval cooldown before the next. */
export const GUNNER = {
  scale: 2,
  hp: 70,
  contactDamage: 25,
  speed: 72,
  bulletDamage: 12,
  shootInterval: 1.6,
  radiusFactor: 0.7,
  /** First wave Gunners burst-fire (single aimed shot before it). */
  burstStartWave: 15,
  /** Shots per burst, and the gap between them (the burst's aim is locked at the
   *  first shot, so the volley travels down one line the player sidesteps). */
  burstCount: 3,
  burstInterval: 0.12,
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
    speed: 78,
    scale: 2,
    spin: 0.5,
    splitInto: "medium",
    splitCount: 2,
    radiusFactor: 0.78,
  },
  medium: {
    tex: "asteroidMedium",
    hp: 45,
    contactDamage: 22,
    speed: 104,
    scale: 2,
    spin: 0.8,
    splitInto: "small",
    splitCount: 2,
    radiusFactor: 0.78,
  },
  small: {
    tex: "asteroidSmall",
    hp: 20,
    contactDamage: 15,
    speed: 138,
    scale: 2,
    spin: 1.2,
    splitInto: null,
    splitCount: 0,
    radiusFactor: 0.78,
  },
};

/** Mini-boss: scaled-up Gunner, wave-5 capstone, fires a fan at the player. */
export const MINIBOSS = {
  scale: 2,
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

/** Boss: the every-10th-wave capstone (10, 20, 30…), replacing the Mini-boss on
 *  those waves. Descends in, settles near the top, drifts slowly, and every few
 *  seconds Dashes sideways (accelerated) while firing a downward Curtain. Tougher
 *  and more elaborate than a Mini-boss. Tuning here is the seam for future bosses:
 *  copy this block and tweak. (`fighter2`) */
export const BOSS = {
  scale: 6,
  hp: 2000,
  /** HP scaling per boss appearance (gets tougher each return). */
  hpPerAppearance: 0.5,
  contactDamage: 45,
  /** Descent speed until it settles at targetY. */
  speed: 110,
  /** Y it settles at (high — it lives on the top of the field). */
  targetY: 150,
  /** Slow constant horizontal drift between dashes (virtual px/s). */
  driftSpeed: 60,
  /** Dash cadence: a dash triggers every [min,max] seconds (random). */
  dashIntervalMin: 3,
  dashIntervalMax: 5,
  /** Dash kinematics: accelerate from drift up to dashSpeed over the lunge, hold
   *  for dashDuration, then decay back to drift. */
  dashSpeed: 900,
  dashAccel: 4000,
  dashDuration: 0.5,
  /** Don't pick a dash direction toward an edge within this margin (virtual px). */
  dashEdgeMargin: 360,
  /** Curtain: a fixed burst of curtainShots, each two side-by-side straight-down
   *  bullets, fired every curtainFireInterval. The burst is kicked off by a dash
   *  and deliberately outlasts the dash movement (curtainShots * interval can
   *  exceed dashDuration). The dash's lateral motion sweeps the lines across the
   *  field (never aimed at the player). */
  curtainShots: 5,
  curtainFireInterval: 0.2,
  /** Horizontal gap (virtual px) between the two bullet streams. */
  curtainColumnGap: 120,
  bulletDamage: 18,
  radiusFactor: 0.7,
} as const;

/** Mine: a flying explosive that enters from the top or a side, locks one aimed
 *  course at the player at spawn, flies it straight, and detonates when destroyed
 *  or on player contact (never when it escapes off-screen). Player-only AoE. */
export const MINE = {
  scale: 2,
  hp: 30,
  /** Flat AoE damage to the player on detonation (within explosionRadius). */
  explosionDamage: 40,
  /** Blast radius (virtual px). The detonation burst is scaled to match it
   *  (radius / EXPLOSION04_HALF), so the art footprint stays equal to the hitbox. */
  explosionRadius: 120,
  /** Native half-height of an Explosion04 frame (480/2) — its full-scale radius. */
  explosion04Half: 240,
  /** Aimed-dash speed at the entry wave; ramps by wave, ignoring speedMult. */
  baseSpeed: 150,
  speedRampAmount: 50,
  speedRampEveryWaves: 5,
  /** Hard speed ceiling (virtual px/s) — reached ~wave 36. */
  maxSpeed: 500,
  /** First wave Mines can appear in the spawn budget. */
  startWave: 6,
  /** Per-spawn share of budget spawns from startWave on (every wave, including
   *  capstone waves now that they carry a normal budget). */
  spawnChance: 0.15,
  /** Side spawns are confined to the top fraction of the field. */
  sideSpawnMaxYFactor: 0.6,
  /** Cosmetic tumble (rad/s, random direction) — never affects the flight path. */
  spin: 0.8,
  radiusFactor: 0.7,
} as const;

/** Bomber (Bombe-Sheet): a late-game flying explosive and the Mine's re-aiming
 *  cousin. Where the Mine locks ONE aimed course at spawn, the Bomber re-aims at
 *  the player's CURRENT position every ~3s: a brief telegraph, then a fast burst
 *  toward the player, after which its speed eases down to a slow drift along that
 *  heading until the next burst. It never leaves the field (clamped to the arena
 *  on every edge) — the only exits are being shot down or detonating on contact.
 *  Detonation reuses the Mine's blast exactly (MINE.explosionRadius/Damage). It
 *  is the first animated enemy — its sprite cycles a 5-frame sheet (see ADR-0013). */
export const BOMBER = {
  /** Display scale: 16x16 native frames at 4x = 64x64 on the field. */
  scale: 4,
  hp: 35,
  /** Contact routes through detonation in the scene (reusing the Mine's blast);
   *  this is parity only, mirroring how the Mine carries explosionDamage here. */
  contactDamage: 40,
  /** First wave Bombers appear in the spawn budget (with the Warden). */
  startWave: 15,
  /** Per-pick share of the budget from startWave on (a flat share off the top,
   *  like the Mine/Warden). Between the Mine (0.15) and the Warden (0.08). */
  spawnChance: 0.1,
  /** Side spawns are confined to the top fraction of the field (deeper than the
   *  Mine's 0.6 — a Bomber that re-aims is fair lower down, but never beside the
   *  player at the very bottom). */
  sideSpawnMaxYFactor: 0.8,
  /** Seconds between bursts: it re-aims at the player on this cadence. */
  dodgeInterval: 3,
  /** Wind-up before each burst: the sprite pulses to telegraph the lunge. */
  telegraphTime: 0.3,
  telegraphTint: 0xffcc33,
  /** Burst speed at the entry wave; ramps by wave to a hard cap, ignoring
   *  speedMult (Mine-style, so the lunge speed stays exactly tunable). */
  baseDashSpeed: 520,
  dashSpeedRampAmount: 60,
  dashSpeedRampEveryWaves: 5,
  maxDashSpeed: 860,
  /** Slow drift-speed floor the burst eases down to between dodges. */
  driftSpeed: 90,
  /** Ease-down rate from burst speed toward driftSpeed (virtual px/s^2). A gentle
   *  decay sustains the lunge longer, so each dodge covers more ground. */
  decel: 520,
  /** Seconds per animation frame (5 frames in Bombe-Sheet). */
  frameInterval: 0.12,
  /** Collision radius as a fraction of the sprite half-width — a touch larger
   *  than the other contact enemies so the lunge connects fairly. */
  radiusFactor: 0.85,
} as const;

/** Warden (CrabShip): a slow late-game enemy that descends straight, fires a
 *  single aimed shot, makes one slow lateral dodge at mid-field, and is ringed by
 *  an orbiting Shield of destructible Nodes. The player fires straight up, so a
 *  Node covering the bottom blocks shots and a rotating gap lets them through;
 *  Nodes can also be destroyed to widen the gap permanently. See ADR-0012. */
export const WARDEN = {
  scale: 2,
  hp: 80,
  contactDamage: 25,
  /** Descent speed (ramps via WAVES speed steps). */
  speed: 55,
  bulletDamage: 12,
  shootInterval: 1.6,
  radiusFactor: 0.7,
  /** First wave Wardens appear in the spawn budget. */
  startWave: 15,
  /** Per-pick share of the budget from startWave on (a flat share off the top,
   *  like the Mine). Deliberately low — Wardens are slow, tanky, and linger. */
  spawnChance: 0.08,
  // --- One slow lateral dodge, triggered once at mid-field for flair. ---
  /** Fraction of field height at which the single dodge triggers. */
  dodgeAtYFactor: 0.5,
  /** Lateral dodge speed (virtual px/s) and how long the nudge lasts. */
  dodgeSpeed: 120,
  dodgeDuration: 0.8,
  /** Don't dodge toward an edge within this margin (bias away, like the Boss). */
  dodgeEdgeMargin: 360,
  // --- Shield: a ring of orbiting, destructible Nodes (ADR-0012). ---
  /** Live Nodes at spawn. A knob, but ships at 3; more shrinks the timing window
   *  below what's fair. Must not exceed SHIELD_NODE_CAPACITY in EnemyPool. */
  nodeCount: 3,
  /** Per-Node HP (scales with the wave hpMult, like body HP). */
  nodeHp: 30,
  /** Distance (virtual px) from the body centre to each orbiting Node. */
  orbitRadius: 80,
  /** Node sprite scale and its collision radius as a fraction of half-width. */
  nodeScale: 2,
  nodeRadiusFactor: 0.6,
  /** Orbit angular speed (rad/s). NOT scaled by speedMult, so the gap-timing
   *  window stays readable across waves (~one revolution every ~4.5 s). */
  rotationSpeed: 1.4,
  /** Cosmetic per-Node self-spin (rad/s, random direction). */
  nodeSpin: 1.5,
} as const;

/** Enemy HP Bar: a thin flat-red bar that appears above an enemy once it has
 *  taken damage (hp < maxHp) and tracks remaining HP as a fill length — no
 *  number. Width tracks the enemy's unrotated sprite width; height and the gap
 *  above the sprite are fixed (scale-independent). Applies to every enemy kind. */
export const ENEMY_HP_BAR = {
  /** Bar width as a fraction of the enemy's unrotated sprite width. */
  widthFactor: 0.9,
  /** Bar thickness (virtual px), fixed regardless of enemy scale. */
  height: 6,
  /** Gap (virtual px) between the bar's bottom and the sprite's top edge. */
  gap: 10,
  /** Translucent dark track behind the fill. */
  trackColor: 0x000000,
  trackAlpha: 0.45,
  /** Flat red fill (matches the HUD's low-HP red). */
  fillColor: 0xe05a4a,
} as const;

/** Enemy projectile (Projectile03 circle, tinted by damage tier). */
export const ENEMY_BULLET = {
  scale: 1,
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
  /** HP scaling per wave up to hpRampWave, then hpMultPerWaveLate after it. */
  hpMultPerWave: 0.08,
  hpRampWave: 8,
  hpMultPerWaveLate: 0.16,
  /** Enemy speed ramps in steps: +speedStepAmount every speedStepEveryWaves. */
  speedStepEveryWaves: 3,
  speedStepAmount: 0.08,
  /** +1 asteroid split every N waves (capped). */
  splitBonusEveryWaves: 4,
  maxAsteroidSplit: 4,
  /** A mini-boss anchors every Nth wave (except boss waves — see bossEvery). */
  miniBossEvery: 5,
  /** A Boss anchors every Nth wave, replacing the mini-boss there. Must be a
   *  multiple of miniBossEvery so the boss check cleanly overrides it. */
  bossEvery: 10,
  /** On a capstone (boss/mini-boss) wave the capstone is spliced into the normal
   *  enemy budget after this fraction of the adds have spawned, so it enters
   *  mid-wave alongside the mix (0 = leads the wave, 1 = trails it). */
  capstoneSpawnFraction: 0.33,
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
 *  Tuned (#10) toward ~30 level-ups for an average run (~wave 9) and ~50 for a
 *  great run (~wave 19). Iterating from playtest feedback. */
export const XP = {
  swarmer: 2,
  gunner: 4,
  asteroidLarge: 4,
  asteroidMedium: 2,
  asteroidSmall: 1,
  miniboss: 30,
  boss: 60,
  mine: 4,
  warden: 14,
  bomber: 6,
  /** XP granted by collecting a Star. */
  star: 12,
  /** First level-up needs this much XP (front-loaded so the first few come
   *  fast — first hits ~mid-wave-2). */
  baseThreshold: 20,
  /** Threshold growth for the early levels (1..lateLevel). */
  growth: 1.1,
  /** From this level on, thresholds grow faster so the late-game enemy-count
   *  XP flood doesn't keep over-leveling the player. */
  lateLevel: 10,
  lateGrowth: 1.16,
} as const;

/** Score awarded per kill (by enemy type) plus the wave-clear bonus. */
export const SCORE = {
  swarmer: 10,
  gunner: 30,
  asteroidLarge: 25,
  asteroidMedium: 12,
  asteroidSmall: 5,
  miniboss: 250,
  boss: 600,
  mine: 25,
  warden: 100,
  bomber: 35,
  /** Wave-clear bonus = waveClearBase * wave number. */
  waveClearBase: 25,
} as const;

/** Star pickup: the only collectible in v1 (XP only). Native-size coin. */
export const STAR = {
  scale: 3,
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

/** Upgrade rarity tiers and their card colors (low -> high). */
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export const RARITY_COLORS: Record<Rarity, number> = {
  common: 0x9aa0a6, // gray
  uncommon: 0x57d957, // green
  rare: 0x4aa3ff, // blue
  epic: 0xb066ff, // purple
  legendary: 0xff9933, // orange
};

/** The non-modifier upgrade pool. Tier = draw weight (ADR-0009): common 12 /
 *  uncommon 8 / rare 4 / epic 2 / legendary 1. cap: 0 = unlimited; at least 3
 *  unlimited types keep the 3-card draw full (Damage/Rapid Fire/Reinforced Hull). */
export const UPGRADES = {
  damage: { cap: 0, weight: 12, rarity: "common", amount: 6 },
  moveSpeed: {
    cap: 10,
    weight: 12,
    rarity: "common",
    sensitivityAmount: 0.1,
    responseAmount: 1,
  },
  fireRate: { cap: 0, weight: 12, rarity: "common", mult: 0.95 },
  maxHp: { cap: 0, weight: 4, rarity: "rare", amount: 25 },
  // Capped at 3 so a long run can't trend toward immortality (starts at 3 lives).
  extraLife: { cap: 3, weight: 2, rarity: "epic" },
  pickupRange: { cap: 5, weight: 12, rarity: "common", amount: 120 },
} as const;

/** Bullet-modifier mechanics. All modifiers stack orthogonally on the one gun. */
export const MODIFIERS = {
  /** +N projectiles per Multishot level. */
  multishotPerLevel: 1,
  /** Minimum gap (degrees) between adjacent multishot projectiles so a volley
   *  fans out instead of perfectly overlapping (the built-in Multishot fan). */
  multishotMinGapDeg: 8,
  /** +N enemies pierced per Pierce level. */
  piercePerLevel: 1,
} as const;

/** The 6 bullet modifiers as upgrade cards. Tier = draw weight (ADR-0009):
 *  common 12 / uncommon 8 / rare 4 / epic 2 / legendary 1. Intra-tier
 *  exceptions are expressed via `cap`, not weight. Spread was removed (ADR-0010). */
export const MODIFIER_UPGRADES = {
  // Multishot multiplies the whole volley — the rarest top-tier drop.
  multishot: { cap: 10, weight: 1, rarity: "legendary" },
  pierce: { cap: 5, weight: 8, rarity: "uncommon" },
  // Homing tops out at level 3 (turn rate hits its ceiling) — capped to match
  // so there are no dead picks past the cap.
  homing: { cap: 3, weight: 2, rarity: "epic" },
  // Explosive adds AoE cleave that scales with Damage — the strongest modifier
  // below the legendaries, so it sits a tier above the other utility modifiers.
  explosive: { cap: 10, weight: 4, rarity: "rare" },
  burn: { cap: 10, weight: 8, rarity: "uncommon" },
  // Bounce spawns full clone bullets that chain (ADR-0005) — the strongest
  // modifier, so it's a hard-capped legendary drop.
  bounce: { cap: 3, weight: 1, rarity: "legendary" },
} as const;

/** Effect parameters for the #6b modifiers (Homing/Explosive/Burn/Bounce). */
export const MODIFIER_FX = {
  /** Homing turn rate (rad/s): 4/8/12 across its 3 levels. The cap matches the
   *  curve so every level contributes and none are dead (ADR-0009). */
  homing: { turnRatePerLevel: 4, maxTurnRate: 12 },
  /** Explosive AoE on impact. Damage is a fraction of the bullet's damage. */
  explosive: { baseRadius: 70, radiusPerLevel: 16, damageFactor: 0.6 },
  /** Burn damage-over-time. dps scales per level; duration is fixed. */
  burn: { dpsPerLevel: 7, duration: 2 },
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
    // Burn now reads as smoke (grey puffs), not orange flame.
    burnTrail: 0x9a9a9a,
    explosion: 0xff5533,
  },
} as const;
