import { Container, Sprite, type Texture } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, PROJECTILES } from "../config";

/** Options for spawning a projectile. Only x/y/vx/vy are required. */
export interface SpawnOptions {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage?: number;
  tint?: number;
  /** Enemies this shot can pass through before being consumed. */
  pierce?: number;
  /** Sprite override (modifier visual system); defaults to the pool texture. */
  texture?: Texture;
  /** Sprite scale override; defaults to the pool scale (radius scales with it). */
  scale?: number;
  /** Lifetime in seconds; <= 0 means it lives until it leaves the field. */
  life?: number;
  /** Homing turn rate (rad/s); 0 = no homing. Steered externally. */
  homing?: number;
  /** Explosive AoE on impact. */
  explosiveRadius?: number;
  explosiveDamage?: number;
  /** Burn damage-over-time applied on hit. */
  burnDps?: number;
  burnDuration?: number;
  /** Bounce: generations of Bounce-bullets this shot can still spawn. */
  bounceRemaining?: number;
  /** A target to pre-exclude from this shot's hits (e.g. a Bounce-bullet's source). */
  hitsExclude?: unknown;
}

/** A single pooled projectile: a sprite plus its motion, effects, and flags. */
export class Projectile {
  readonly sprite: Sprite;
  vx = 0;
  vy = 0;
  active = false;
  /** Collision radius in virtual px (set from the sprite size at spawn). */
  radius = 0;
  damage = 0;
  pierceRemaining = 0;
  /** Lifetime remaining (s); <= 0 means no lifetime limit. */
  life = 0;
  // Modifier effects carried by this shot (0 = inactive).
  homing = 0;
  /** Homing lock state. Acquired once on the first steer frame, never re-acquired. */
  acquired = false;
  /** The locked enemy this shot steers toward, or undefined if none/gone. */
  target: unknown;
  /** The target's generation at lock time; guards against pooled-slot reuse. */
  targetGen = 0;
  explosiveRadius = 0;
  explosiveDamage = 0;
  burnDps = 0;
  burnDuration = 0;
  /** Bounce generations remaining: each hit spawns a Bounce-bullet at this minus one. */
  bounceRemaining = 0;
  /** Targets already hit, so a piercing shot never double-hits the same one. */
  readonly hits = new Set<unknown>();

  constructor(
    private readonly baseTexture: Texture,
    private readonly baseScale: number,
  ) {
    this.sprite = new Sprite(baseTexture);
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(baseScale);
    this.sprite.visible = false;
  }

  get defaultTexture(): Texture {
    return this.baseTexture;
  }
  get defaultScale(): number {
    return this.baseScale;
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  /** Mark for removal and hide immediately (no one-frame ghost). */
  kill(): void {
    this.active = false;
    this.sprite.visible = false;
  }
}

/**
 * Object pool for projectiles. Reuses sprites instead of allocating per shot
 * (avoids GC stutter), and enforces a hard cap on live projectiles by recycling
 * the oldest when the cap is hit.
 */
export class ProjectilePool {
  readonly view = new Container();
  private readonly all: Projectile[] = [];
  /** Live projectiles, oldest first (so recycling drops the oldest). */
  private readonly live: Projectile[] = [];
  private readonly baseRadius: number;

  constructor(
    private readonly texture: Texture,
    private readonly scale: number,
    radiusFactor: number,
  ) {
    for (let i = 0; i < PROJECTILES.poolInitial; i++) {
      this.create();
    }
    this.baseRadius = this.texture.width * this.scale * 0.5 * radiusFactor;
  }

  private create(): Projectile {
    const p = new Projectile(this.texture, this.scale);
    this.all.push(p);
    this.view.addChild(p.sprite);
    return p;
  }

  spawn(o: SpawnOptions): void {
    // Enforce the hard cap by recycling the oldest live projectile.
    if (this.live.length >= PROJECTILES.maxLive) {
      const oldest = this.live.shift();
      if (oldest) oldest.kill();
    }

    const p = this.all.find((q) => !q.active) ?? this.create();
    p.active = true;
    p.sprite.visible = true;
    p.sprite.position.set(o.x, o.y);
    p.vx = o.vx;
    p.vy = o.vy;
    p.damage = o.damage ?? 0;
    p.sprite.tint = o.tint ?? 0xffffff;
    p.sprite.texture = o.texture ?? p.defaultTexture;

    const scale = o.scale ?? p.defaultScale;
    p.sprite.scale.set(scale);
    p.radius = this.baseRadius * (scale / p.defaultScale);

    p.pierceRemaining = o.pierce ?? 0;
    p.life = o.life ?? 0;
    p.homing = o.homing ?? 0;
    p.acquired = false;
    p.target = undefined;
    p.targetGen = 0;
    p.explosiveRadius = o.explosiveRadius ?? 0;
    p.explosiveDamage = o.explosiveDamage ?? 0;
    p.burnDps = o.burnDps ?? 0;
    p.burnDuration = o.burnDuration ?? 0;
    p.bounceRemaining = o.bounceRemaining ?? 0;

    p.hits.clear();
    if (o.hitsExclude !== undefined) p.hits.add(o.hitsExclude);

    this.live.push(p);
  }

  /** Advance live projectiles; drop those killed, expired, or off-screen. */
  update(dt: number): void {
    const m = PROJECTILES.despawnMargin;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      if (!p.active) {
        this.live.splice(i, 1);
        continue;
      }
      if (p.life > 0) {
        p.life -= dt;
        if (p.life <= 0) {
          p.kill();
          this.live.splice(i, 1);
          continue;
        }
      }
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      if (
        p.sprite.y < -m ||
        p.sprite.y > VIRTUAL_HEIGHT + m ||
        p.sprite.x < -m ||
        p.sprite.x > VIRTUAL_WIDTH + m
      ) {
        p.kill();
        this.live.splice(i, 1);
      }
    }
  }

  /** Live projectiles, for collision tests. Do not mutate the array. */
  get activeProjectiles(): readonly Projectile[] {
    return this.live;
  }

  get liveCount(): number {
    return this.live.length;
  }
}
