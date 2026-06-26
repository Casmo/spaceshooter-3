import { Container, Sprite } from "pixi.js";
import {
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
  SWARMER,
  GUNNER,
  ASTEROID,
  MINIBOSS,
  ENEMY_BULLET,
  WAVES,
  XP,
  SCORE,
  type AsteroidSize,
} from "../config";
import { getTexture, type AssetAlias } from "../assets";

export type EnemyKind = "swarmer" | "gunner" | "asteroid" | "miniboss";

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

/** A pooled enemy. Behavior is selected by `kind`, configured at spawn. */
export class Enemy {
  readonly sprite: Sprite;
  active = false;
  /**
   * Monotonic id, bumped on every spawn. Lets a Homing bullet tell "my target
   * is gone" from "my target's pooled slot was reused for a new enemy".
   */
  generation = 0;
  kind: EnemyKind = "swarmer";
  hp = 0;
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

  // Shooting (gunner / mini-boss).
  private canShoot = false;
  private shootInterval = 0;
  private shootTimer = 0;
  private bulletDamage = 0;
  private fanCount = 1;
  private fanSpreadDeg = 0;

  // Mini-boss strafing.
  private settled = false;
  private targetY = 0;
  private strafeSpeed = 0;
  private strafeDir = 1;

  constructor() {
    this.sprite = new Sprite(getTexture("swarmer"));
    this.sprite.anchor.set(0.5);
    this.sprite.visible = false;
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
    this.canShoot = false;
    this.shootTimer = 0;
    this.fanCount = 1;
    this.fanSpreadDeg = 0;
    this.settled = false;
  }

  spawnSwarmer(x: number, mods: WaveMods): void {
    this.reset("swarmer", SWARMER.scale);
    this.kind = "swarmer";
    this.mods = mods;
    this.xpValue = XP.swarmer;
    this.scoreValue = SCORE.swarmer;
    this.hp = SWARMER.hp * mods.hpMult;
    this.contactDamage = SWARMER.contactDamage;
    this.speed = SWARMER.speed * mods.speedMult;
    this.baseX = x;
    this.swayAmplitude = SWARMER.swayAmplitude;
    this.swayFrequency = SWARMER.swayFrequency;
    this.radius = (this.sprite.width / 2) * SWARMER.radiusFactor;
    this.sprite.position.set(x, -this.sprite.height / 2);
  }

  spawnGunner(x: number, mods: WaveMods): void {
    this.reset("gunner", GUNNER.scale);
    this.kind = "gunner";
    this.mods = mods;
    this.xpValue = XP.gunner;
    this.scoreValue = SCORE.gunner;
    this.hp = GUNNER.hp * mods.hpMult;
    this.contactDamage = GUNNER.contactDamage;
    this.speed = GUNNER.speed * mods.speedMult;
    this.canShoot = true;
    this.shootInterval = GUNNER.shootInterval;
    this.shootTimer = GUNNER.shootInterval;
    this.bulletDamage = GUNNER.bulletDamage;
    this.radius = (this.sprite.width / 2) * GUNNER.radiusFactor;
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
    this.reset("gunner", MINIBOSS.scale);
    this.kind = "miniboss";
    this.mods = mods;
    this.xpValue = XP.miniboss;
    this.scoreValue = SCORE.miniboss;
    this.hp =
      MINIBOSS.hp * mods.hpMult * (1 + appearance * MINIBOSS.hpPerAppearance);
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
    }
    if (this.canShoot) this.updateShooting(dt, ctx);
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

  private updateShooting(dt: number, ctx: EnemyContext): void {
    // Hold fire until on-screen so shots aren't lobbed from above the field.
    if (this.sprite.y < 0) return;
    this.shootTimer -= dt;
    if (this.shootTimer > 0) return;
    this.shootTimer = this.shootInterval;
    this.fireAtPlayer(ctx);
  }

  private fireAtPlayer(ctx: EnemyContext): void {
    const baseAngle = Math.atan2(ctx.playerY - this.y, ctx.playerX - this.x);
    const speed = ENEMY_BULLET.speed;
    if (this.fanCount <= 1) {
      ctx.fire(
        this.x,
        this.y,
        Math.cos(baseAngle) * speed,
        Math.sin(baseAngle) * speed,
        this.bulletDamage,
      );
      return;
    }
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

  kill(): void {
    this.active = false;
    this.sprite.visible = false;
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

  spawnGunner(mods: WaveMods): void {
    const e = this.obtain();
    e.spawnGunner(this.randomTopX(), mods);
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
      if (e.sprite.y > VIRTUAL_HEIGHT + e.sprite.height) {
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
