import { AnimatedSprite, Container, Sprite } from "pixi.js";
import {
  getTexture,
  getFrames,
  type AssetAlias,
  type FrameAlias,
} from "../assets";

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
  /** One recycled AnimatedSprite pool per burst sheet (keyed by frame alias). */
  private readonly bursts = new Map<FrameAlias, AnimatedSprite[]>();

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

  private obtainBurst(alias: FrameAlias): AnimatedSprite {
    let pool = this.bursts.get(alias);
    if (!pool) {
      pool = [];
      this.bursts.set(alias, pool);
    }
    const found = pool.find((a) => !a.visible);
    if (found) return found;
    const a = new AnimatedSprite(getFrames(alias));
    a.anchor.set(0.5);
    a.loop = false;
    a.animationSpeed = 0.4;
    a.visible = false;
    a.onComplete = () => {
      a.visible = false;
    };
    pool.push(a);
    this.view.addChild(a);
    return a;
  }

  /** Play a one-shot explosion burst centred at (x, y), sized by `scale`. */
  explode(x: number, y: number, scale: number, tint = 0xffffff): void {
    const a = this.obtainBurst("explosion");
    a.visible = true;
    a.tint = tint;
    a.position.set(x, y);
    a.scale.set(scale);
    a.gotoAndPlay(0);
  }

  /**
   * Hit Spark: a small, untinted, decorative burst played at every player
   * bullet→enemy contact (see docs/DESIGN.md). Purely cosmetic — no damage.
   */
  spark(x: number, y: number): void {
    const a = this.obtainBurst("explosionSmall");
    a.visible = true;
    a.tint = 0xffffff;
    a.position.set(x, y);
    a.scale.set(1);
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
