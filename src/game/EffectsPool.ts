import { Container, Sprite } from "pixi.js";
import { getTexture, type AssetAlias } from "../assets";

/** A short-lived visual: a sprite that fades out (and optionally grows). */
class Effect {
  readonly sprite: Sprite;
  active = false;
  life = 0;
  maxLife = 1;
  fromScale = 1;
  toScale = 1;

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
 * Pooled, non-interactive decorative effects: explosion flashes and the trail
 * puffs dropped by Homing/Burn bullets. Purely cosmetic — no collision.
 */
export class EffectsPool {
  readonly view = new Container();
  private readonly all: Effect[] = [];
  private readonly live: Effect[] = [];

  private obtain(): Effect {
    const found = this.all.find((e) => !e.active);
    if (found) return found;
    const e = new Effect();
    this.all.push(e);
    this.view.addChild(e.sprite);
    return e;
  }

  /** Spawn a fading (and optionally growing) sprite at (x, y). */
  spawn(
    alias: AssetAlias,
    x: number,
    y: number,
    fromScale: number,
    toScale: number,
    life: number,
    tint: number,
  ): void {
    const e = this.obtain();
    e.active = true;
    e.sprite.visible = true;
    e.sprite.texture = getTexture(alias);
    e.sprite.tint = tint;
    e.sprite.position.set(x, y);
    e.sprite.scale.set(fromScale);
    e.sprite.alpha = 1;
    e.life = life;
    e.maxLife = life;
    e.fromScale = fromScale;
    e.toScale = toScale;
    this.live.push(e);
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const e = this.live[i];
      e.life -= dt;
      if (e.life <= 0) {
        e.kill();
        this.live.splice(i, 1);
        continue;
      }
      const t = e.life / e.maxLife; // 1 -> 0
      e.sprite.alpha = t;
      e.sprite.scale.set(e.toScale + (e.fromScale - e.toScale) * t);
    }
  }
}
