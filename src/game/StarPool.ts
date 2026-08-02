import { AnimatedSprite, Container } from "pixi.js";
import { STAR, XP, VIRTUAL_HEIGHT } from "../config";
import { getFrames } from "../assets";

/** A pooled XP star: a spinning coin that sinks gently, eases toward the ship
 *  within range, and may carry a decaying launch impulse (ADR-0022). */
class Star {
  readonly sprite: AnimatedSprite;
  active = false;
  life = 0;
  radius = 0;
  /** Launch impulse (virtual px/s), decaying toward zero. The constant sink is
   *  added on top of it, so a Star spawned without one is a pure sinker. */
  vx = 0;
  vy = 0;

  constructor() {
    this.sprite = new AnimatedSprite(getFrames("star"));
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(STAR.scale);
    this.sprite.animationSpeed = 0.15;
    this.sprite.visible = false;
    this.sprite.play();
    this.radius = (this.sprite.width / 2) * 0.8;
  }

  kill(): void {
    this.active = false;
    this.sprite.visible = false;
  }
}

/**
 * XP star pickups. Stars drop on kills, sink gently downward for their lifetime,
 * expire when it runs out (or when they sink past the bottom edge), and are
 * pulled toward the ship once inside the player's pickup range (the Pickup Range
 * upgrade grows that range). update() returns the XP collected this frame.
 */
export class StarPool {
  readonly view = new Container();
  private readonly all: Star[] = [];
  private readonly live: Star[] = [];

  /**
   * Drop a Star at (x, y), optionally launched with an initial velocity that
   * decays into the universal sink (ADR-0022) — that is how a Lode's death burst
   * rides outwards on its explosion. Omit vx/vy for an ordinary kill drop.
   */
  spawn(x: number, y: number, vx = 0, vy = 0): void {
    const s = this.all.find((q) => !q.active) ?? this.create();
    s.active = true;
    s.sprite.visible = true;
    s.sprite.alpha = 1;
    s.life = STAR.lifetime;
    s.vx = vx;
    s.vy = vy;
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
    // The launch impulse bleeds off exponentially; the sink never does.
    const decay = Math.exp(-STAR.burstDamping * dt);
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

      // Drift: any remaining impulse plus the constant downward sink. The magnet
      // below still applies on top, so pickup behaviour is unchanged.
      s.sprite.x += s.vx * dt;
      s.sprite.y += (s.vy + STAR.sinkSpeed) * dt;
      s.vx *= decay;
      s.vy *= decay;
      // A Star that sinks off the bottom is gone — don't leave it drifting
      // invisibly below the field for the rest of its lifetime.
      if (s.sprite.y > VIRTUAL_HEIGHT + s.sprite.height / 2) {
        s.kill();
        this.live.splice(i, 1);
        continue;
      }

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
