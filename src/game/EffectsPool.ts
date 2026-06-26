import { AnimatedSprite, Container, Sprite } from "pixi.js";
import { getTexture, getFrames, type AssetAlias } from "../assets";

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
 * Pooled, non-interactive decorative effects: animated explosion bursts and the
 * fading trail puffs dropped by Homing/Burn bullets. Purely cosmetic — no
 * collision.
 *
 * Puffs are manually faded each update(). Explosions are AnimatedSprites that
 * play once on the shared ticker and recycle themselves via onComplete.
 */
export class EffectsPool {
  readonly view = new Container();
  private readonly all: Effect[] = [];
  private readonly live: Effect[] = [];
  private readonly explosions: AnimatedSprite[] = [];

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

  private obtainExplosion(): AnimatedSprite {
    const found = this.explosions.find((a) => !a.visible);
    if (found) return found;
    const a = new AnimatedSprite(getFrames("explosion"));
    a.anchor.set(0.5);
    a.loop = false;
    a.animationSpeed = 0.4;
    a.visible = false;
    a.onComplete = () => {
      a.visible = false;
    };
    this.explosions.push(a);
    this.view.addChild(a);
    return a;
  }

  /** Play a one-shot explosion burst centred at (x, y), sized by `scale`. */
  explode(x: number, y: number, scale: number, tint = 0xffffff): void {
    const a = this.obtainExplosion();
    a.visible = true;
    a.tint = tint;
    a.position.set(x, y);
    a.scale.set(scale);
    a.gotoAndPlay(0);
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
