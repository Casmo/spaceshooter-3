import { Container, Sprite } from "pixi.js";
import { DEBRIS } from "../config";
import { getFrames } from "../assets";
import type { EffectsPool } from "./EffectsPool";

/** A pooled Debris chunk: a ship fragment that drifts to rest, tumbling, then
 *  pops into a small explosion at end of life. Purely cosmetic — no collision. */
class DebrisChunk {
  readonly sprite: Sprite;
  active = false;
  life = 0;
  maxLife = 1;
  vx = 0;
  vy = 0;
  spin = 0;

  constructor() {
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.sprite.visible = false;
  }

  kill(): void {
    this.active = false;
    this.sprite.visible = false;
  }
}

/**
 * Debris: the ship-fragment shower flung out on a "clean" enemy kill (see
 * CONTEXT.md and the DEBRIS config). A handful of chunks scatter in random
 * directions, ease out to a near-stop while tumbling, then each vanishes into a
 * standard Explosion02 burst (delegated to EffectsPool, half size). Pooled and
 * non-interactive; silent — the kill boom is the only death sound.
 */
export class DebrisPool {
  readonly view = new Container();
  private readonly all: DebrisChunk[] = [];
  private readonly live: DebrisChunk[] = [];

  constructor(private readonly effects: EffectsPool) {}

  /**
   * Spawn a shower of chunks at (x, y). The count derives from the source
   * enemy's sprite scale so bigger enemies shed more; each chunk gets a random
   * fragment texture, 360° direction, launch speed, tumble, and life.
   */
  spawn(x: number, y: number, enemyScale: number): void {
    const base = Math.round(enemyScale / DEBRIS.countDivisor);
    const jitter = Math.round((Math.random() * 2 - 1) * DEBRIS.countJitter);
    const count = Math.max(
      DEBRIS.minCount,
      Math.min(DEBRIS.maxCount, base + jitter),
    );
    const frames = getFrames("debris");
    const chunkScale = enemyScale * DEBRIS.scaleFactor;
    for (let i = 0; i < count; i++) {
      const c = this.obtain();
      c.active = true;
      c.sprite.visible = true;
      c.sprite.texture = frames[(Math.random() * frames.length) | 0];
      c.sprite.position.set(x, y);
      c.sprite.scale.set(chunkScale);
      c.sprite.rotation = Math.random() * Math.PI * 2;
      c.sprite.alpha = 1;
      const angle = Math.random() * Math.PI * 2;
      const speed =
        DEBRIS.minSpeed + Math.random() * (DEBRIS.maxSpeed - DEBRIS.minSpeed);
      c.vx = Math.cos(angle) * speed;
      c.vy = Math.sin(angle) * speed;
      c.spin =
        (DEBRIS.minSpin + Math.random() * (DEBRIS.maxSpin - DEBRIS.minSpin)) *
        (Math.random() < 0.5 ? -1 : 1);
      c.life =
        DEBRIS.minLife + Math.random() * (DEBRIS.maxLife - DEBRIS.minLife);
      c.maxLife = c.life;
      this.live.push(c);
    }
  }

  private obtain(): DebrisChunk {
    const found = this.all.find((c) => !c.active);
    if (found) return found;
    // Soft cap: when flooded, recycle the oldest live chunk (dropped without its
    // pop) instead of growing the pool without bound.
    if (this.all.length >= DEBRIS.maxLive && this.live.length > 0) {
      const oldest = this.live.shift()!;
      oldest.kill();
      return oldest;
    }
    const c = new DebrisChunk();
    this.all.push(c);
    this.view.addChild(c.sprite);
    return c;
  }

  update(dt: number): void {
    const damp = Math.exp(-DEBRIS.damping * dt);
    for (let i = this.live.length - 1; i >= 0; i--) {
      const c = this.live[i];
      c.life -= dt;
      if (c.life <= 0) {
        // End-of-life pop: reuse the standard Explosion02 burst, half size.
        this.effects.explode(c.sprite.x, c.sprite.y, DEBRIS.popScale);
        c.kill();
        this.live.splice(i, 1);
        continue;
      }
      c.sprite.x += c.vx * dt;
      c.sprite.y += c.vy * dt;
      c.vx *= damp;
      c.vy *= damp;
      c.sprite.rotation += c.spin * dt;
      // Slight fade over life: 1 -> fadeTo (not to invisible).
      const t = c.life / c.maxLife; // 1 -> 0
      c.sprite.alpha = DEBRIS.fadeTo + (1 - DEBRIS.fadeTo) * t;
    }
  }
}
