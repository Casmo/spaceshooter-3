import { Container, Sprite } from "pixi.js";
import { STAR, XP } from "../config";
import { getTexture } from "../assets";

/** A pooled XP star: drifts in place, eases toward the ship within pickup range. */
class Star {
  readonly sprite: Sprite;
  active = false;
  life = 0;
  radius = 0;

  constructor() {
    this.sprite = new Sprite(getTexture("star"));
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(STAR.scale);
    this.sprite.visible = false;
    this.radius = (this.sprite.width / 2) * 0.8;
  }

  kill(): void {
    this.active = false;
    this.sprite.visible = false;
  }
}

/**
 * XP star pickups. Stars drop on kills, expire after a lifetime, and are pulled
 * toward the ship once inside the player's pickup range (the Pickup Range
 * upgrade grows that range). update() returns the XP collected this frame.
 */
export class StarPool {
  readonly view = new Container();
  private readonly all: Star[] = [];
  private readonly live: Star[] = [];

  spawn(x: number, y: number): void {
    const s = this.all.find((q) => !q.active) ?? this.create();
    s.active = true;
    s.sprite.visible = true;
    s.sprite.alpha = 1;
    s.life = STAR.lifetime;
    s.sprite.position.set(x, y);
    this.live.push(s);
  }

  private create(): Star {
    const s = new Star();
    this.all.push(s);
    this.view.addChild(s.sprite);
    return s;
  }

  /**
   * Advance stars; collect those reaching the ship and expire the rest.
   * @returns total XP collected this frame.
   */
  update(dt: number, px: number, py: number, pickupRange: number): number {
    let collected = 0;
    const ease = 1 - Math.exp(-STAR.magnetEase * dt);
    for (let i = this.live.length - 1; i >= 0; i--) {
      const s = this.live[i];
      s.life -= dt;
      if (s.life <= 0) {
        s.kill();
        this.live.splice(i, 1);
        continue;
      }
      // Blink near expiry.
      s.sprite.alpha =
        s.life < STAR.blinkBefore && Math.floor(s.life * 8) % 2 === 0 ? 0.3 : 1;

      const dx = px - s.sprite.x;
      const dy = py - s.sprite.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= STAR.collectRadius) {
        collected += XP.star;
        s.kill();
        this.live.splice(i, 1);
        continue;
      }
      if (dist <= pickupRange) {
        s.sprite.x += dx * ease;
        s.sprite.y += dy * ease;
      }
    }
    return collected;
  }
}
