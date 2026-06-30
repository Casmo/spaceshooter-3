import { Container, Sprite, Graphics, Texture } from "pixi.js";
import {
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
  ENEMY_HP_BAR,
  SWARMER,
  GUNNER,
  ASTEROID,
  MINIBOSS,
  BOSS,
  MINE,
  WARDEN,
  BOMBER,
  SPACESTATION,
  ENEMY_BULLET,
  WAVES,
  XP,
  SCORE,
  type AsteroidSize,
} from "../config";
import { getTexture, getFrames, type AssetAlias } from "../assets";

export type EnemyKind =
  | "swarmer"
  | "gunner"
  | "asteroid"
  | "miniboss"
  | "boss"
  | "mine"
  | "warden"
  | "bomber"
  | "station";

/** Hard cap on Shield Nodes per enemy (WARDEN.nodeCount must not exceed it). The
 *  sprites are pre-allocated per pooled enemy, so this stays small. */
const SHIELD_NODE_CAPACITY = 6;

/**
 * One destructible circle in a Warden's Shield (ADR-0012). It orbits the body at
 * a fixed radius, spins on its own axis for flavour, has its own HP, and can be
 * burned down. A shot striking a live Node is stopped there; the body is reached
 * only through a gap (or by an Explosive blast, which bypasses the Shield).
 */
export class ShieldNode {
  readonly sprite: Sprite;
  alive = false;
  hp = 0;
  maxHp = 0;
  /** Orbit phase offset (radians) from the Shield's shared base angle. */
  phaseOffset = 0;
  /** Cosmetic self-spin (rad/s). */
  spin = 0;
  /** Collision radius (virtual px), captured at spawn from the scaled sprite. */
  radius = 0;
  private burnTimer = 0;
  private burnDps = 0;

  constructor() {
    this.sprite = new Sprite(getTexture("shieldNode"));
    this.sprite.anchor.set(0.5);
    this.sprite.visible = false;
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  /** Apply (or refresh) a burn DoT, like the body's burn. */
  applyBurn(dps: number, duration: number): void {
    this.burnDps += dps;
    this.burnTimer = Math.max(this.burnTimer, duration);
  }

  /** Advance burn; returns true if this tick destroyed the Node. */
  tickBurn(dt: number): boolean {
    if (this.burnTimer <= 0) return false;
    this.hp -= this.burnDps * dt;
    this.burnTimer -= dt;
    this.sprite.tint = 0xff7a3d;
    if (this.hp <= 0) {
      this.destroy();
      return true;
    }
    if (this.burnTimer <= 0) this.sprite.tint = 0xffffff;
    return false;
  }

  destroy(): void {
    this.alive = false;
    this.sprite.visible = false;
  }

  /** Clear burn + tint for reuse. */
  clearBurn(): void {
    this.burnTimer = 0;
    this.burnDps = 0;
    this.sprite.tint = 0xffffff;
  }
}

/** Per-frame context passed to enemies so they can shoot at the player. */
export interface EnemyContext {
  playerX: number;
  playerY: number;
  /** Spawn an enemy bullet. */
  fire(x: number, y: number, vx: number, vy: number, damage: number): void;
}

/** Per-wave stat scaling applied at spawn time. */
export interface WaveMods {
  hpMult: number;
  speedMult: number;
  splitBonus: number;
}

const NO_MODS: WaveMods = { hpMult: 1, speedMult: 1, splitBonus: 0 };

/** Random float in [min, max). */
function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** A pooled enemy. Behavior is selected by `kind`, configured at spawn. */
export class Enemy {
  readonly sprite: Sprite;
  /**
   * The HP Bar: a thin flat-red bar drawn above the sprite once damaged. It is a
   * sibling of the sprite (not a child) so the asteroid/mine spin never rotates
   * it. Geometry is drawn at the bar's local origin (centered on x); the bar is
   * positioned each frame via its own x/y. Hidden while at full HP.
   */
  readonly bar = new Graphics();
  active = false;
  /**
   * Monotonic id, bumped on every spawn. Lets a Homing bullet tell "my target
   * is gone" from "my target's pooled slot was reused for a new enemy".
   */
  generation = 0;
  kind: EnemyKind = "swarmer";
  hp = 0;
  /** HP at spawn; the HP Bar shows once hp drops below it. */
  maxHp = 0;
  contactDamage = 0;
  radius = 0;
  /** XP awarded to the player when this enemy is destroyed. */
  xpValue = 0;
  /** Score awarded when this enemy is destroyed. */
  scoreValue = 0;
  /** Set when a burn DoT (not a bullet/contact) lands the killing blow. */
  killedByBurn = false;

  // Burn damage-over-time state.
  private burnTimer = 0;
  private burnDps = 0;

  private speed = 0;
  private mods: WaveMods = NO_MODS;

  // Swarmer sine sway.
  private baseX = 0;
  private swayAmplitude = 0;
  private swayFrequency = 0;
  private phase = 0;

  // Asteroid drift + spin + splitting.
  private driftVx = 0;
  private spin = 0;
  splitInto: AsteroidSize | null = null;
  splitCount = 0;

  // Mine aimed dash: velocity is locked on the first update() (the spawn frame)
  // toward the player's position then; `aimed` guards that one-time lock.
  private aimed = false;
  private mineVx = 0;
  private mineVy = 0;

  // Animated sprite (ADR-0013): when set, update() cycles these frames on the
  // sprite. Null for the static-texture enemies (every kind but the Bomber).
  private animFrames: Texture[] | null = null;
  private animInterval = 0;
  private animTimer = 0;
  private animIndex = 0;

  // Bomber: re-aims at the player every dodgeInterval. Between bursts the heading
  // is fixed and bombSpeed eases down to the slow drift floor. dodgeTimer drives
  // the cadence; the burst's max speed (bombDashSpeed) is the wave-ramped cap.
  private bombDodgeTimer = 0;
  private bombHeadX = 0;
  private bombHeadY = 1;
  private bombSpeed = 0;
  private bombDashSpeed = 0;

  // Shooting (gunner / mini-boss / warden).
  private canShoot = false;
  private shootInterval = 0;
  private shootTimer = 0;
  private bulletDamage = 0;
  private fanCount = 1;
  private fanSpreadDeg = 0;

  // Gunner burst (wave 15+): a short volley aimed once at burst start. burstCount
  // 1 = the plain single shot. burstRemaining/burstTimer drive the volley.
  private burstCount = 1;
  private burstInterval = 0;
  private burstRemaining = 0;
  private burstTimer = 0;
  private burstAngle = 0;

  // Warden descent + one mid-field dodge.
  private dodgeTriggered = false;
  private dodgeTimer = 0;
  private dodgeDir = 1;

  // Warden Shield: a ring of orbiting Shield Nodes (ADR-0012). shieldCount > 0
  // marks an active shield; the first shieldCount entries of `nodes` are in use.
  readonly nodes: ShieldNode[] = [];
  private shieldCount = 0;
  private shieldAngle = 0;
  private orbitRadius = 0;
  private shieldRotationSpeed = 0;

  // SpaceStation side-rake (ADR-0015): fires a vertical comb of pure-horizontal
  // bullets out both flanks on the fireInterval cadence (driven in updateStation,
  // so canShoot stays false). stationPerSide is the wave-ramped count per side.
  private stationFireTimer = 0;
  private stationPerSide = 0;

  // Mini-boss strafing.
  private settled = false;
  private targetY = 0;
  private strafeSpeed = 0;
  private strafeDir = 1;

  // Boss dash + curtain. Between dashes it drifts slowly (driftDir); a dash
  // accelerates bossVx toward the dash velocity, then it decays back to drift.
  private driftDir = 1;
  private bossVx = 0;
  private dashTimer = 0;
  private dashing = false;
  private dashTime = 0;
  private dashDir = 1;
  private fireTimer = 0;
  private shotsRemaining = 0;

  // HP Bar geometry, captured at spawn (unrotated, scale-aware) so a spinning
  // sprite never wobbles the bar. lastBarFrac avoids redrawing an unchanged bar.
  private barW = 0;
  private barOffsetY = 0;
  private lastBarFrac = -1;

  constructor() {
    this.sprite = new Sprite(getTexture("swarmer"));
    this.sprite.anchor.set(0.5);
    this.sprite.visible = false;
    this.bar.visible = false;
    for (let i = 0; i < SHIELD_NODE_CAPACITY; i++) {
      this.nodes.push(new ShieldNode());
    }
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  /** Reset all behavior flags to a clean baseline before configuring a kind. */
  private reset(tex: AssetAlias, scale: number): void {
    this.active = true;
    this.generation++;
    this.sprite.visible = true;
    this.sprite.texture = getTexture(tex);
    this.sprite.scale.set(scale);
    this.sprite.rotation = 0;
    this.sprite.alpha = 1;
    this.sprite.tint = 0xffffff;
    this.killedByBurn = false;
    this.burnTimer = 0;
    this.burnDps = 0;
    this.phase = 0;
    this.driftVx = 0;
    this.spin = 0;
    this.splitInto = null;
    this.splitCount = 0;
    this.aimed = false;
    this.animFrames = null;
    this.animTimer = 0;
    this.animIndex = 0;
    this.bombDodgeTimer = 0;
    this.bombSpeed = 0;
    this.canShoot = false;
    this.shootTimer = 0;
    this.fanCount = 1;
    this.fanSpreadDeg = 0;
    this.burstCount = 1;
    this.burstRemaining = 0;
    this.burstTimer = 0;
    this.dodgeTriggered = false;
    this.dodgeTimer = 0;
    this.stationFireTimer = 0;
    this.stationPerSide = 0;
    this.shieldCount = 0;
    for (const node of this.nodes) node.destroy();
    this.settled = false;
    this.dashing = false;
    this.dashTime = 0;
    this.bossVx = 0;
    this.fireTimer = 0;
    this.shotsRemaining = 0;
    // Capture bar geometry while the sprite is unrotated and freshly scaled.
    this.barW = this.sprite.width * ENEMY_HP_BAR.widthFactor;
    this.barOffsetY = this.sprite.height / 2;
    this.bar.visible = false;
    this.lastBarFrac = -1;
  }

  spawnSwarmer(x: number, mods: WaveMods): void {
    this.reset("swarmer", SWARMER.scale);
    this.kind = "swarmer";
    this.mods = mods;
    this.xpValue = XP.swarmer;
    this.scoreValue = SCORE.swarmer;
    this.hp = SWARMER.hp * mods.hpMult;
    this.maxHp = this.hp;
    this.contactDamage = SWARMER.contactDamage;
    this.speed = SWARMER.speed * mods.speedMult;
    this.baseX = x;
    this.swayAmplitude = SWARMER.swayAmplitude;
    this.swayFrequency = SWARMER.swayFrequency;
    this.radius = (this.sprite.width / 2) * SWARMER.radiusFactor;
    this.sprite.position.set(x, -this.sprite.height / 2);
  }

  spawnGunner(x: number, mods: WaveMods, wave: number): void {
    this.reset("gunner", GUNNER.scale);
    this.kind = "gunner";
    this.mods = mods;
    this.xpValue = XP.gunner;
    this.scoreValue = SCORE.gunner;
    this.hp = GUNNER.hp * mods.hpMult;
    this.maxHp = this.hp;
    this.contactDamage = GUNNER.contactDamage;
    this.speed = GUNNER.speed * mods.speedMult;
    this.canShoot = true;
    this.shootInterval = GUNNER.shootInterval;
    this.shootTimer = GUNNER.shootInterval;
    this.bulletDamage = GUNNER.bulletDamage;
    // Late-game Gunners burst-fire (a single aimed shot before burstStartWave).
    if (wave >= GUNNER.burstStartWave) {
      this.burstCount = GUNNER.burstCount;
      this.burstInterval = GUNNER.burstInterval;
    }
    this.radius = (this.sprite.width / 2) * GUNNER.radiusFactor;
    this.sprite.position.set(x, -this.sprite.height / 2);
  }

  /**
   * Spawn a Warden: a slow descending shooter ringed by an orbiting Shield of
   * destructible Nodes (ADR-0012). Fires a single aimed shot (canShoot) and makes
   * one slow lateral dodge at mid-field. The Shield is initialised here.
   */
  spawnWarden(x: number, mods: WaveMods): void {
    this.reset("warden", WARDEN.scale);
    this.kind = "warden";
    this.mods = mods;
    this.xpValue = XP.warden;
    this.scoreValue = SCORE.warden;
    this.hp = WARDEN.hp * mods.hpMult;
    this.maxHp = this.hp;
    this.contactDamage = WARDEN.contactDamage;
    this.speed = WARDEN.speed * mods.speedMult;
    this.canShoot = true;
    this.shootInterval = WARDEN.shootInterval;
    this.shootTimer = WARDEN.shootInterval;
    this.bulletDamage = WARDEN.bulletDamage;
    this.radius = (this.sprite.width / 2) * WARDEN.radiusFactor;
    this.initShield(mods);
    this.sprite.position.set(x, -this.sprite.height / 2);
  }

  /** Set up the orbiting Shield: the first WARDEN.nodeCount Nodes go live, evenly
   *  spaced, each with its own HP (scaled by hpMult) and a random self-spin. */
  private initShield(mods: WaveMods): void {
    this.shieldCount = Math.min(WARDEN.nodeCount, SHIELD_NODE_CAPACITY);
    this.orbitRadius = WARDEN.orbitRadius;
    this.shieldRotationSpeed = WARDEN.rotationSpeed;
    this.shieldAngle = Math.random() * Math.PI * 2;
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      if (i >= this.shieldCount) {
        node.destroy();
        continue;
      }
      node.alive = true;
      node.hp = WARDEN.nodeHp * mods.hpMult;
      node.maxHp = node.hp;
      node.phaseOffset = (i / this.shieldCount) * Math.PI * 2;
      node.spin = (Math.random() < 0.5 ? -1 : 1) * WARDEN.nodeSpin;
      node.sprite.scale.set(WARDEN.nodeScale);
      node.radius = (node.sprite.width / 2) * WARDEN.nodeRadiusFactor;
      node.sprite.visible = true;
      node.clearBurn();
    }
  }

  /**
   * Spawn a SpaceStation: a slow, heavy fortress that descends straight and rakes
   * a vertical comb of pure-horizontal bullets out both flanks on a telegraphed
   * cadence (ADR-0015). The per-side bullet count ramps with the wave. Firing is
   * driven inside updateStation (like the Boss), so canShoot stays false.
   */
  spawnStation(x: number, mods: WaveMods, wave: number): void {
    this.reset("station", SPACESTATION.scale);
    this.kind = "station";
    this.mods = mods;
    this.xpValue = XP.station;
    this.scoreValue = SCORE.station;
    this.hp = SPACESTATION.hp * mods.hpMult;
    this.maxHp = this.hp;
    this.contactDamage = SPACESTATION.contactDamage;
    this.speed = SPACESTATION.speed * mods.speedMult;
    this.bulletDamage = SPACESTATION.bulletDamage;
    // Per-side count ramps with the wave (Mine/Bomber-style step), capped.
    const steps = Math.floor(
      (wave - SPACESTATION.startWave) / SPACESTATION.countRampEveryWaves,
    );
    this.stationPerSide = Math.min(
      SPACESTATION.maxPerSide,
      SPACESTATION.basePerSide + Math.max(0, steps),
    );
    this.stationFireTimer = SPACESTATION.fireInterval;
    this.radius = (this.sprite.width / 2) * SPACESTATION.radiusFactor;
    this.sprite.position.set(x, -this.sprite.height / 2);
  }

  spawnAsteroid(
    size: AsteroidSize,
    x: number,
    y: number,
    mods: WaveMods,
  ): void {
    const c = ASTEROID[size];
    this.reset(c.tex, c.scale);
    this.kind = "asteroid";
    this.mods = mods;
    this.xpValue =
      size === "large"
        ? XP.asteroidLarge
        : size === "medium"
          ? XP.asteroidMedium
          : XP.asteroidSmall;
    this.scoreValue =
      size === "large"
        ? SCORE.asteroidLarge
        : size === "medium"
          ? SCORE.asteroidMedium
          : SCORE.asteroidSmall;
    this.hp = c.hp * mods.hpMult;
    this.maxHp = this.hp;
    this.contactDamage = c.contactDamage;
    this.speed = c.speed * mods.speedMult;
    this.driftVx = (Math.random() * 2 - 1) * 60;
    this.spin = (Math.random() * 2 - 1) * c.spin;
    this.splitInto = c.splitInto;
    this.splitCount =
      c.splitCount > 0
        ? Math.min(WAVES.maxAsteroidSplit, c.splitCount + mods.splitBonus)
        : 0;
    this.radius = (this.sprite.width / 2) * c.radiusFactor;
    this.sprite.position.set(x, y);
  }

  spawnMiniBoss(mods: WaveMods, appearance: number): void {
    this.reset("miniboss", MINIBOSS.scale);
    this.kind = "miniboss";
    this.mods = mods;
    this.xpValue = XP.miniboss;
    this.scoreValue = SCORE.miniboss;
    this.hp =
      MINIBOSS.hp * mods.hpMult * (1 + appearance * MINIBOSS.hpPerAppearance);
    this.maxHp = this.hp;
    this.contactDamage = MINIBOSS.contactDamage;
    this.speed = MINIBOSS.speed;
    this.targetY = MINIBOSS.targetY;
    this.strafeSpeed = MINIBOSS.strafeSpeed;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.canShoot = true;
    this.shootInterval = MINIBOSS.shootInterval;
    this.shootTimer = MINIBOSS.shootInterval;
    this.bulletDamage = MINIBOSS.bulletDamage;
    this.fanCount = MINIBOSS.fanCount;
    this.fanSpreadDeg = MINIBOSS.fanSpreadDeg;
    this.radius = (this.sprite.width / 2) * MINIBOSS.radiusFactor;
    this.sprite.position.set(VIRTUAL_WIDTH / 2, -this.sprite.height / 2);
  }

  /**
   * Spawn the Boss: descends from center-top to settle near the top, then drifts
   * slowly and periodically Dashes sideways while firing a Curtain. HP scales per
   * appearance (like the Mini-boss). Firing is driven inside updateBoss (tied to
   * the dash), so canShoot stays false.
   */
  spawnBoss(mods: WaveMods, appearance: number): void {
    this.reset("boss", BOSS.scale);
    this.kind = "boss";
    this.mods = mods;
    this.xpValue = XP.boss;
    this.scoreValue = SCORE.boss;
    this.hp = BOSS.hp * mods.hpMult * (1 + appearance * BOSS.hpPerAppearance);
    this.maxHp = this.hp;
    this.contactDamage = BOSS.contactDamage;
    this.speed = BOSS.speed;
    this.targetY = BOSS.targetY;
    this.bulletDamage = BOSS.bulletDamage;
    this.driftDir = Math.random() < 0.5 ? -1 : 1;
    this.dashTimer = randRange(BOSS.dashIntervalMin, BOSS.dashIntervalMax);
    this.radius = (this.sprite.width / 2) * BOSS.radiusFactor;
    this.sprite.position.set(VIRTUAL_WIDTH / 2, -this.sprite.height / 2);
  }

  /**
   * Spawn a Mine at a pre-chosen off-screen point (x, y). Its aimed velocity is
   * locked on the first update(), toward the player's position that frame. Speed
   * ramps by wave to a hard cap and deliberately ignores the wave speedMult so
   * the cap stays exact.
   */
  spawnMine(x: number, y: number, wave: number, mods: WaveMods): void {
    this.reset("mine", MINE.scale);
    this.kind = "mine";
    this.mods = mods;
    this.xpValue = XP.mine;
    this.scoreValue = SCORE.mine;
    this.hp = MINE.hp * mods.hpMult;
    this.maxHp = this.hp;
    // Contact routes through detonation in the scene; this is parity only.
    this.contactDamage = MINE.explosionDamage;
    const steps = Math.floor(
      (wave - MINE.startWave) / MINE.speedRampEveryWaves,
    );
    this.speed = Math.min(
      MINE.maxSpeed,
      MINE.baseSpeed + Math.max(0, steps) * MINE.speedRampAmount,
    );
    this.spin = (Math.random() < 0.5 ? -1 : 1) * MINE.spin;
    this.radius = (this.sprite.width / 2) * MINE.radiusFactor;
    this.sprite.position.set(x, y);
  }

  /**
   * Spawn a Bomber at a pre-chosen off-screen point (x, y). Unlike the Mine it
   * re-aims at the player every dodgeInterval: a telegraph, then a fast burst
   * that eases down to a slow drift along that heading. The first burst is locked
   * on the first update() (toward the player then), like the Mine's aim. Burst
   * speed ramps by wave to a hard cap and ignores speedMult (Mine-style). It is
   * animated — its sprite cycles the Bombe frames (ADR-0013).
   */
  spawnBomber(x: number, y: number, wave: number, mods: WaveMods): void {
    this.reset("bomber", BOMBER.scale);
    this.kind = "bomber";
    this.mods = mods;
    this.xpValue = XP.bomber;
    this.scoreValue = SCORE.bomber;
    this.hp = BOMBER.hp * mods.hpMult;
    this.maxHp = this.hp;
    // Contact routes through detonation in the scene; this is parity only.
    this.contactDamage = BOMBER.contactDamage;
    const steps = Math.floor(
      (wave - BOMBER.startWave) / BOMBER.dashSpeedRampEveryWaves,
    );
    this.bombDashSpeed = Math.min(
      BOMBER.maxDashSpeed,
      BOMBER.baseDashSpeed + Math.max(0, steps) * BOMBER.dashSpeedRampAmount,
    );
    this.bombDodgeTimer = BOMBER.dodgeInterval;
    // Animate the 5-frame Bombe sheet.
    this.animFrames = getFrames("bomber");
    this.animInterval = BOMBER.frameInterval;
    this.radius = (this.sprite.width / 2) * BOMBER.radiusFactor;
    this.sprite.position.set(x, y);
  }

  /** Apply (or refresh) a burn DoT. Burns stack their dps and refresh duration. */
  applyBurn(dps: number, duration: number): void {
    this.burnDps += dps;
    this.burnTimer = Math.max(this.burnTimer, duration);
  }

  update(dt: number, ctx: EnemyContext): void {
    if (this.burnTimer > 0) {
      this.hp -= this.burnDps * dt;
      this.burnTimer -= dt;
      this.sprite.tint = 0xff7a3d;
      if (this.hp <= 0) {
        this.killedByBurn = true;
        this.kill();
        return;
      }
      if (this.burnTimer <= 0) this.sprite.tint = 0xffffff;
    }
    // Animated enemies (the Bomber) cycle their frame set on the sprite (ADR-0013).
    if (this.animFrames) {
      this.animTimer += dt;
      if (this.animTimer >= this.animInterval) {
        this.animTimer -= this.animInterval;
        this.animIndex = (this.animIndex + 1) % this.animFrames.length;
        this.sprite.texture = this.animFrames[this.animIndex];
      }
    }
    switch (this.kind) {
      case "swarmer":
        this.phase += this.swayFrequency * dt;
        this.sprite.y += this.speed * dt;
        this.sprite.x = this.baseX + Math.sin(this.phase) * this.swayAmplitude;
        break;
      case "gunner":
        this.sprite.y += this.speed * dt;
        break;
      case "asteroid":
        this.sprite.y += this.speed * dt;
        this.sprite.x += this.driftVx * dt;
        this.sprite.rotation += this.spin * dt;
        break;
      case "miniboss":
        this.updateMiniBoss(dt);
        break;
      case "boss":
        this.updateBoss(dt, ctx);
        break;
      case "warden":
        this.updateWarden(dt);
        break;
      case "station":
        this.updateStation(dt, ctx);
        break;
      case "bomber":
        this.updateBomber(dt, ctx);
        break;
      case "mine":
        if (!this.aimed) {
          const dx = ctx.playerX - this.sprite.x;
          const dy = ctx.playerY - this.sprite.y;
          const len = Math.hypot(dx, dy) || 1;
          this.mineVx = (dx / len) * this.speed;
          this.mineVy = (dy / len) * this.speed;
          this.aimed = true;
        }
        this.sprite.x += this.mineVx * dt;
        this.sprite.y += this.mineVy * dt;
        this.sprite.rotation += this.spin * dt; // cosmetic; path is unaffected
        break;
    }
    if (this.canShoot) this.updateShooting(dt, ctx);
    this.updateBar();
  }

  /**
   * Position and (when the fraction changed) redraw the HP Bar. Hidden while at
   * full HP, so an undamaged or one-shot enemy never shows one. Tracks the
   * sprite's position each frame but uses the unrotated offset so the bar floats
   * a fixed gap above the sprite's top edge without spinning.
   */
  private updateBar(): void {
    if (this.hp >= this.maxHp) {
      this.bar.visible = false;
      return;
    }
    const frac = Math.max(0, this.hp / this.maxHp);
    this.bar.visible = true;
    this.bar.x = this.sprite.x;
    this.bar.y =
      this.sprite.y - this.barOffsetY - ENEMY_HP_BAR.gap - ENEMY_HP_BAR.height;
    if (frac !== this.lastBarFrac) {
      this.drawBar(frac);
      this.lastBarFrac = frac;
    }
  }

  /** Draw the bar geometry at the local origin, centered on x: a translucent
   *  dark track with a flat-red fill scaled to `frac`. */
  private drawBar(frac: number): void {
    const w = this.barW;
    const h = ENEMY_HP_BAR.height;
    this.bar
      .clear()
      .rect(-w / 2, 0, w, h)
      .fill({ color: ENEMY_HP_BAR.trackColor, alpha: ENEMY_HP_BAR.trackAlpha })
      .rect(-w / 2, 0, w * frac, h)
      .fill(ENEMY_HP_BAR.fillColor);
  }

  /**
   * Warden: descend straight, fire its aimed shot (via updateShooting), and make
   * one slow lateral dodge at mid-field for flair. The orbiting Shield is updated
   * each frame regardless.
   */
  private updateWarden(dt: number): void {
    this.sprite.y += this.speed * dt;

    // One-time dodge: at mid-field, pick a direction (biased away from a near
    // edge) and drift it for dodgeDuration, then resume straight descent.
    if (
      !this.dodgeTriggered &&
      this.sprite.y >= VIRTUAL_HEIGHT * WARDEN.dodgeAtYFactor
    ) {
      this.dodgeTriggered = true;
      this.dodgeTimer = WARDEN.dodgeDuration;
      const m = WARDEN.dodgeEdgeMargin;
      this.dodgeDir =
        this.sprite.x < m
          ? 1
          : this.sprite.x > VIRTUAL_WIDTH - m
            ? -1
            : Math.random() < 0.5
              ? -1
              : 1;
    }
    if (this.dodgeTimer > 0) {
      this.dodgeTimer -= dt;
      this.sprite.x += this.dodgeDir * WARDEN.dodgeSpeed * dt;
      const margin = this.sprite.width / 2;
      if (this.sprite.x < margin) this.sprite.x = margin;
      else if (this.sprite.x > VIRTUAL_WIDTH - margin)
        this.sprite.x = VIRTUAL_WIDTH - margin;
    }

    this.updateShield(dt);
  }

  /**
   * SpaceStation: descend straight and, on the fireInterval cadence, rake a
   * vertical comb of pure-horizontal bullets out both flanks (ADR-0015). Each
   * volley is preceded by a short charge-up tint. Firing is held until the body is
   * fully on-screen so the comb never rakes from above the field.
   */
  private updateStation(dt: number, ctx: EnemyContext): void {
    this.sprite.y += this.speed * dt;
    if (this.sprite.y < this.sprite.height / 2) return;

    this.stationFireTimer -= dt;
    // Charge-up telegraph in the final telegraphTime before a volley (a burn tint
    // takes precedence, mirroring the Bomber).
    if (
      this.stationFireTimer <= SPACESTATION.telegraphTime &&
      this.burnTimer <= 0
    ) {
      this.sprite.tint = SPACESTATION.telegraphTint;
    }
    if (this.stationFireTimer <= 0) {
      this.fireSideRake(ctx);
      this.stationFireTimer = SPACESTATION.fireInterval;
      if (this.burnTimer <= 0) this.sprite.tint = 0xffffff;
    }
  }

  /** One side-rake volley: a vertical comb of pure-horizontal bullets out BOTH
   *  flanks at once, centred on the body. The bullets travel only sideways — the
   *  threat is the standing wall the slow station drags through the player's zone,
   *  not any downward motion. */
  private fireSideRake(ctx: EnemyContext): void {
    const n = this.stationPerSide;
    const speed = SPACESTATION.bulletSpeed;
    const mid = (n - 1) / 2;
    for (let i = 0; i < n; i++) {
      const y = this.y + (i - mid) * SPACESTATION.combSpacing;
      // Left flank fires left, right flank fires right (vy = 0: pure horizontal).
      ctx.fire(
        this.x - SPACESTATION.muzzleOffset,
        y,
        -speed,
        0,
        this.bulletDamage,
      );
      ctx.fire(
        this.x + SPACESTATION.muzzleOffset,
        y,
        speed,
        0,
        this.bulletDamage,
      );
    }
  }

  /**
   * Bomber: re-aim at the player every dodgeInterval. On the spawn frame it locks
   * an entry burst toward the player (like the Mine's aim). Each cycle it
   * telegraphs (a tint pulse in the final telegraphTime), then bursts — heading
   * re-aimed at the player's current position at the wave-ramped dash speed.
   * Between bursts the heading holds and bombSpeed eases down to the slow drift
   * floor. It is clamped to the arena on every edge, so it never escapes.
   */
  private updateBomber(dt: number, ctx: EnemyContext): void {
    const aimAtPlayer = (): void => {
      const dx = ctx.playerX - this.sprite.x;
      const dy = ctx.playerY - this.sprite.y;
      const len = Math.hypot(dx, dy) || 1;
      this.bombHeadX = dx / len;
      this.bombHeadY = dy / len;
      this.bombSpeed = this.bombDashSpeed;
    };

    // Entry burst: aim once on the first frame (player position is known here).
    if (!this.aimed) {
      aimAtPlayer();
      this.aimed = true;
    }

    // Cadence: telegraph in the final telegraphTime, then burst (re-aim).
    this.bombDodgeTimer -= dt;
    if (this.bombDodgeTimer <= BOMBER.telegraphTime && this.burnTimer <= 0) {
      this.sprite.tint = BOMBER.telegraphTint;
    }
    if (this.bombDodgeTimer <= 0) {
      aimAtPlayer();
      this.bombDodgeTimer = BOMBER.dodgeInterval;
      if (this.burnTimer <= 0) this.sprite.tint = 0xffffff;
    }

    // Ease the burst speed down to the slow drift floor along the held heading.
    this.bombSpeed = Math.max(
      BOMBER.driftSpeed,
      this.bombSpeed - BOMBER.decel * dt,
    );
    this.sprite.x += this.bombHeadX * this.bombSpeed * dt;
    this.sprite.y += this.bombHeadY * this.bombSpeed * dt;

    // Clamp to the arena on every edge — the Bomber never leaves the field; the
    // next re-aim pulls it back toward the player.
    const hw = this.sprite.width / 2;
    const hh = this.sprite.height / 2;
    this.sprite.x = Math.min(VIRTUAL_WIDTH - hw, Math.max(hw, this.sprite.x));
    this.sprite.y = Math.min(VIRTUAL_HEIGHT - hh, Math.max(hh, this.sprite.y));
  }

  /** Advance the orbiting Shield: rotate the ring, tick each live Node's burn,
   *  and place it at its orbit position with its cosmetic self-spin. */
  private updateShield(dt: number): void {
    if (this.shieldCount <= 0) return;
    this.shieldAngle += this.shieldRotationSpeed * dt;
    for (let i = 0; i < this.shieldCount; i++) {
      const node = this.nodes[i];
      if (!node.alive) continue;
      if (node.tickBurn(dt)) continue; // burned to death this frame
      const a = this.shieldAngle + node.phaseOffset;
      node.sprite.x = this.sprite.x + Math.cos(a) * this.orbitRadius;
      node.sprite.y = this.sprite.y + Math.sin(a) * this.orbitRadius;
      node.sprite.rotation += node.spin * dt;
    }
  }

  private updateMiniBoss(dt: number): void {
    if (!this.settled) {
      this.sprite.y += this.speed * dt;
      if (this.sprite.y >= this.targetY) this.settled = true;
      return;
    }
    this.sprite.x += this.strafeDir * this.strafeSpeed * dt;
    const margin = this.sprite.width / 2;
    if (this.sprite.x < margin) {
      this.sprite.x = margin;
      this.strafeDir = 1;
    } else if (this.sprite.x > VIRTUAL_WIDTH - margin) {
      this.sprite.x = VIRTUAL_WIDTH - margin;
      this.strafeDir = -1;
    }
  }

  /**
   * Boss: descend to settle, then drift slowly and Dash sideways every few
   * seconds. A dash accelerates bossVx toward the dash velocity (decaying back to
   * the slow drift afterwards) and fires the Curtain — two downward fan volleys —
   * during the lunge, so the lateral motion smears the shots into a sweep.
   */
  private updateBoss(dt: number, ctx: EnemyContext): void {
    if (!this.settled) {
      this.sprite.y += this.speed * dt;
      if (this.sprite.y >= this.targetY) {
        this.sprite.y = this.targetY;
        this.settled = true;
      }
      return;
    }

    // Trigger a dash on the timer (only when not already dashing).
    if (!this.dashing) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) this.startDash();
    }

    // Horizontal velocity eases toward the dash target (during a dash) or the
    // slow drift (otherwise); the same accel ramps up and decays back.
    const target = this.dashing
      ? this.dashDir * BOSS.dashSpeed
      : this.driftDir * BOSS.driftSpeed;
    const dv = target - this.bossVx;
    const step = BOSS.dashAccel * dt;
    this.bossVx += Math.max(-step, Math.min(step, dv));
    this.sprite.x += this.bossVx * dt;

    // Keep on-screen: drift bounces off the edges; a dash that reaches one ends.
    const margin = this.sprite.width / 2;
    if (this.sprite.x < margin) {
      this.sprite.x = margin;
      this.driftDir = 1;
      if (this.dashing) this.endDash();
    } else if (this.sprite.x > VIRTUAL_WIDTH - margin) {
      this.sprite.x = VIRTUAL_WIDTH - margin;
      this.driftDir = -1;
      if (this.dashing) this.endDash();
    }

    // Dash movement lasts dashDuration, then decays back to the slow drift.
    if (this.dashing) {
      this.dashTime += dt;
      if (this.dashTime >= BOSS.dashDuration) this.endDash();
    }

    // Curtain: a fixed burst of curtainShots kicked off by the dash. It runs on
    // its own timer and deliberately outlasts the dash movement — the boss keeps
    // firing for a moment as it decays back to drift. fireTimer starts at 0 so
    // the first shot lands on the dash's first frame.
    if (this.shotsRemaining > 0) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireCurtain(ctx);
        this.shotsRemaining--;
        this.fireTimer = BOSS.curtainFireInterval;
      }
    }
  }

  /** Begin a dash: pick a direction (random, biased away from a near edge). */
  private startDash(): void {
    const margin = BOSS.dashEdgeMargin;
    if (this.sprite.x < margin) {
      this.dashDir = 1;
    } else if (this.sprite.x > VIRTUAL_WIDTH - margin) {
      this.dashDir = -1;
    } else {
      this.dashDir = Math.random() < 0.5 ? -1 : 1;
    }
    this.dashing = true;
    this.dashTime = 0;
    this.fireTimer = 0;
    this.shotsRemaining = BOSS.curtainShots;
    // The dash sets the drift heading for afterwards (decays out in this dir).
    this.driftDir = this.dashDir;
  }

  private endDash(): void {
    this.dashing = false;
    this.dashTimer = randRange(BOSS.dashIntervalMin, BOSS.dashIntervalMax);
  }

  /** One Curtain shot: two straight-down bullets side by side (the two vertical
   *  streams). The dash's lateral motion sweeps them across the field. */
  private fireCurtain(ctx: EnemyContext): void {
    const speed = ENEMY_BULLET.speed;
    const half = BOSS.curtainColumnGap / 2;
    ctx.fire(this.x - half, this.y, 0, speed, this.bulletDamage);
    ctx.fire(this.x + half, this.y, 0, speed, this.bulletDamage);
  }

  private updateShooting(dt: number, ctx: EnemyContext): void {
    // Hold fire until on-screen so shots aren't lobbed from above the field.
    if (this.sprite.y < 0) return;
    // A burst in progress fires its remaining shots down the locked-in line.
    if (this.burstRemaining > 0) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) {
        this.fireAtAngle(ctx, this.burstAngle);
        this.burstRemaining -= 1;
        this.burstTimer = this.burstInterval;
      }
      return;
    }
    this.shootTimer -= dt;
    if (this.shootTimer > 0) return;
    this.shootTimer = this.shootInterval;
    if (this.burstCount > 1) {
      // Start a burst: lock the aim now, fire the first shot, queue the rest.
      this.burstAngle = Math.atan2(ctx.playerY - this.y, ctx.playerX - this.x);
      this.fireAtAngle(ctx, this.burstAngle);
      this.burstRemaining = this.burstCount - 1;
      this.burstTimer = this.burstInterval;
    } else {
      this.fireAtPlayer(ctx);
    }
  }

  /** Fire one bullet along a fixed angle (used by the locked-aim burst). */
  private fireAtAngle(ctx: EnemyContext, angle: number): void {
    const speed = ENEMY_BULLET.speed;
    ctx.fire(
      this.x,
      this.y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      this.bulletDamage,
    );
  }

  private fireAtPlayer(ctx: EnemyContext): void {
    const baseAngle = Math.atan2(ctx.playerY - this.y, ctx.playerX - this.x);
    if (this.fanCount <= 1) {
      this.fireAtAngle(ctx, baseAngle);
      return;
    }
    const speed = ENEMY_BULLET.speed;
    const spread = (this.fanSpreadDeg * Math.PI) / 180;
    for (let i = 0; i < this.fanCount; i++) {
      const a = baseAngle - spread / 2 + spread * (i / (this.fanCount - 1));
      ctx.fire(
        this.x,
        this.y,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        this.bulletDamage,
      );
    }
  }

  /** Apply damage; returns true if this hit destroyed the enemy. */
  takeDamage(amount: number): boolean {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.kill();
      return true;
    }
    return false;
  }

  /** Wave mods this enemy spawned with (so splits inherit scaling). */
  get waveMods(): WaveMods {
    return this.mods;
  }

  /** True while at least one Shield Node still guards the body — the signal for
   *  the collision pass to run the shielded resolution (ADR-0012). */
  get hasLiveShield(): boolean {
    if (this.shieldCount <= 0) return false;
    for (let i = 0; i < this.shieldCount; i++) {
      if (this.nodes[i].alive) return true;
    }
    return false;
  }

  /** All Shield Node slots, for the collision pass to test before the body. Dead
   *  and unused slots have `alive === false`; callers skip those. Returned raw
   *  (no allocation) since this runs per bullet in the hot collision loop. */
  get shieldNodes(): readonly ShieldNode[] {
    return this.nodes;
  }

  /** Damage one Shield Node; returns true if this hit destroyed it. */
  damageShieldNode(node: ShieldNode, amount: number): boolean {
    node.hp -= amount;
    if (node.hp <= 0) {
      node.destroy();
      return true;
    }
    return false;
  }

  kill(): void {
    this.active = false;
    this.sprite.visible = false;
    this.bar.visible = false;
    for (const node of this.nodes) node.destroy();
  }
}

/** Object pool + container for enemies. */
export class EnemyPool {
  readonly view = new Container();
  private readonly all: Enemy[] = [];
  private readonly live: Enemy[] = [];
  /** Enemies that died to a burn DoT this frame, for the scene to reward. */
  private readonly burnKills: Enemy[] = [];

  private obtain(): Enemy {
    const found = this.all.find((e) => !e.active);
    if (found) return found;
    const e = new Enemy();
    this.all.push(e);
    this.view.addChild(e.sprite);
    // Shield Nodes render above the body; the HP Bar floats above them all.
    for (const node of e.nodes) this.view.addChild(node.sprite);
    this.view.addChild(e.bar);
    return e;
  }

  private randomTopX(margin = 120): number {
    return margin + Math.random() * (VIRTUAL_WIDTH - margin * 2);
  }

  spawnSwarmer(mods: WaveMods): void {
    const e = this.obtain();
    e.spawnSwarmer(this.randomTopX(), mods);
    this.live.push(e);
  }

  spawnGunner(mods: WaveMods, wave: number): void {
    const e = this.obtain();
    e.spawnGunner(this.randomTopX(), mods, wave);
    this.live.push(e);
  }

  spawnWarden(mods: WaveMods): void {
    const e = this.obtain();
    e.spawnWarden(this.randomTopX(), mods);
    this.live.push(e);
  }

  spawnStation(mods: WaveMods, wave: number): void {
    const e = this.obtain();
    e.spawnStation(this.randomTopX(), mods, wave);
    this.live.push(e);
  }

  spawnAsteroid(mods: WaveMods): void {
    const e = this.obtain();
    e.spawnAsteroid("large", this.randomTopX(), -120, mods);
    this.live.push(e);
  }

  spawnMiniBoss(mods: WaveMods, appearance: number): void {
    const e = this.obtain();
    e.spawnMiniBoss(mods, appearance);
    this.live.push(e);
  }

  spawnBoss(mods: WaveMods, appearance: number): void {
    const e = this.obtain();
    e.spawnBoss(mods, appearance);
    this.live.push(e);
  }

  /** Spawn a Mine just outside one of three edges (top / left / right, equal
   *  odds); side spawns are confined to the upper part of the field. */
  spawnMine(mods: WaveMods, wave: number): void {
    const e = this.obtain();
    // Spawn just off-screen — smaller than the despawn threshold (the sprite's
    // own size) so a Mine isn't culled before it dashes inward on frame one.
    const margin = 40;
    const edge = Math.floor(Math.random() * 3);
    let x: number;
    let y: number;
    if (edge === 0) {
      x = this.randomTopX();
      y = -margin;
    } else {
      y = Math.random() * VIRTUAL_HEIGHT * MINE.sideSpawnMaxYFactor;
      x = edge === 1 ? -margin : VIRTUAL_WIDTH + margin;
    }
    e.spawnMine(x, y, wave, mods);
    this.live.push(e);
  }

  /** Spawn a Bomber just outside the top, left, or right edge (equal odds); side
   *  spawns are confined to the upper part of the field. It clamps onto the field
   *  on its first update, then re-aims at the player every dodgeInterval. */
  spawnBomber(mods: WaveMods, wave: number): void {
    const e = this.obtain();
    const margin = 40;
    const edge = Math.floor(Math.random() * 3);
    let x: number;
    let y: number;
    if (edge === 0) {
      x = this.randomTopX();
      y = -margin;
    } else {
      y = Math.random() * VIRTUAL_HEIGHT * BOMBER.sideSpawnMaxYFactor;
      x = edge === 1 ? -margin : VIRTUAL_WIDTH + margin;
    }
    e.spawnBomber(x, y, wave, mods);
    this.live.push(e);
  }

  /** Handle an enemy destroyed by damage: split asteroids into children. */
  handleDeath(e: Enemy): void {
    if (!e.splitInto || e.splitCount <= 0) return;
    const size = e.splitInto;
    for (let i = 0; i < e.splitCount; i++) {
      const child = this.obtain();
      const offset = (i - (e.splitCount - 1) / 2) * 50;
      child.spawnAsteroid(size, e.x + offset, e.y, e.waveMods);
      this.live.push(child);
    }
  }

  /** Advance enemies; drop the dead and those that flew off the bottom. */
  update(dt: number, ctx: EnemyContext): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const e = this.live[i];
      if (!e.active) {
        this.live.splice(i, 1);
        continue;
      }
      e.update(dt, ctx);
      if (!e.active) {
        // Died during update — only burn does that here; the scene rewards it.
        if (e.killedByBurn) this.burnKills.push(e);
        this.live.splice(i, 1);
        continue;
      }
      // Everyone despawns off the bottom; a Mine flies a free aimed line, so it
      // can also exit the top or a side — escaping that way never detonates.
      const offBottom = e.sprite.y > VIRTUAL_HEIGHT + e.sprite.height;
      const offOther =
        e.kind === "mine" &&
        (e.sprite.y < -e.sprite.height ||
          e.sprite.x < -e.sprite.width ||
          e.sprite.x > VIRTUAL_WIDTH + e.sprite.width);
      if (offBottom || offOther) {
        e.kill();
        this.live.splice(i, 1);
      }
    }
  }

  /** Return (and clear) enemies killed by burn since the last call. */
  drainBurnKills(): Enemy[] {
    const out = this.burnKills.slice();
    this.burnKills.length = 0;
    return out;
  }

  get activeEnemies(): readonly Enemy[] {
    return this.live;
  }

  get liveCount(): number {
    return this.live.length;
  }
}
