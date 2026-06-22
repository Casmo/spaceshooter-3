import { Container, Sprite } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, SWARMER } from "../config";
import { getTexture } from "../assets";

/**
 * A pooled enemy. For #3 the only kind is the Swarmer: enters from the top,
 * drifts down a gentle sine path, deals contact damage, and does not shoot.
 */
export class Enemy {
  readonly sprite: Sprite;
  active = false;
  hp = 0;
  contactDamage = 0;
  radius = 0;

  private speed = 0;
  private baseX = 0;
  private swayAmplitude = 0;
  private swayFrequency = 0;
  private phase = 0;

  constructor() {
    this.sprite = new Sprite(getTexture("swarmer"));
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(SWARMER.scale);
    this.sprite.visible = false;
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  /** (Re)initialise this enemy as a Swarmer entering at horizontal position x. */
  spawnSwarmer(x: number): void {
    this.active = true;
    this.sprite.visible = true;
    this.hp = SWARMER.hp;
    this.contactDamage = SWARMER.contactDamage;
    this.speed = SWARMER.speed;
    this.baseX = x;
    this.swayAmplitude = SWARMER.swayAmplitude;
    this.swayFrequency = SWARMER.swayFrequency;
    this.phase = 0;
    this.radius = (this.sprite.width / 2) * SWARMER.radiusFactor;
    this.sprite.position.set(x, -this.sprite.height / 2);
  }

  update(dt: number): void {
    this.phase += this.swayFrequency * dt;
    this.sprite.y += this.speed * dt;
    this.sprite.x = this.baseX + Math.sin(this.phase) * this.swayAmplitude;
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

  private obtain(): Enemy {
    const found = this.all.find((e) => !e.active);
    if (found) return found;
    const e = new Enemy();
    this.all.push(e);
    this.view.addChild(e.sprite);
    return e;
  }

  /** Spawn a Swarmer at a random horizontal position near the top. */
  spawnSwarmer(): void {
    const margin = 120;
    const x = margin + Math.random() * (VIRTUAL_WIDTH - margin * 2);
    const e = this.obtain();
    e.spawnSwarmer(x);
    this.live.push(e);
  }

  /** Advance enemies; drop the dead and those that flew off the bottom. */
  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const e = this.live[i];
      if (!e.active) {
        this.live.splice(i, 1);
        continue;
      }
      e.update(dt);
      if (e.sprite.y > VIRTUAL_HEIGHT + e.sprite.height) {
        e.kill();
        this.live.splice(i, 1);
      }
    }
  }

  /** Live enemies, for collision tests. Do not mutate the array. */
  get activeEnemies(): readonly Enemy[] {
    return this.live;
  }
}
