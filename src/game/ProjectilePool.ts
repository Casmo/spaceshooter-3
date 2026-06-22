import { Container, Sprite, type Texture } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, PROJECTILES } from "../config";

/** A single pooled projectile: a sprite plus its velocity and live flag. */
class Projectile {
  readonly sprite: Sprite;
  vx = 0;
  vy = 0;
  active = false;

  constructor(texture: Texture, scale: number) {
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(scale);
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

  constructor(
    private readonly texture: Texture,
    private readonly scale: number,
  ) {
    for (let i = 0; i < PROJECTILES.poolInitial; i++) {
      this.create();
    }
  }

  private create(): Projectile {
    const p = new Projectile(this.texture, this.scale);
    this.all.push(p);
    this.view.addChild(p.sprite);
    return p;
  }

  /** Spawn a projectile at (x, y) with the given velocity (virtual px/s). */
  spawn(x: number, y: number, vx: number, vy: number): void {
    // Enforce the hard cap by recycling the oldest live projectile.
    if (this.live.length >= PROJECTILES.maxLive) {
      const oldest = this.live.shift();
      if (oldest) this.deactivate(oldest);
    }

    const p = this.all.find((q) => !q.active) ?? this.create();
    p.active = true;
    p.sprite.visible = true;
    p.sprite.position.set(x, y);
    p.vx = vx;
    p.vy = vy;
    this.live.push(p);
  }

  private deactivate(p: Projectile): void {
    p.active = false;
    p.sprite.visible = false;
  }

  /** Advance all live projectiles; despawn those that leave the playfield. */
  update(dt: number): void {
    const m = PROJECTILES.despawnMargin;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;

      if (
        p.sprite.y < -m ||
        p.sprite.y > VIRTUAL_HEIGHT + m ||
        p.sprite.x < -m ||
        p.sprite.x > VIRTUAL_WIDTH + m
      ) {
        this.deactivate(p);
        this.live.splice(i, 1);
      }
    }
  }

  /** Number of currently live projectiles (for HUD/debug later). */
  get liveCount(): number {
    return this.live.length;
  }
}
