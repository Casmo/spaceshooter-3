import { Container, Text, type FederatedPointerEvent } from "pixi.js";
import { PLAYER, WEAPON, SWARMER } from "../config";
import { type Scene, SceneManager } from "../core/SceneManager";
import { getTexture } from "../assets";
import { Starfield } from "../game/Starfield";
import { Player } from "../game/Player";
import { ProjectilePool } from "../game/ProjectilePool";
import { EnemyPool } from "../game/EnemyPool";
import { GameOverScene } from "./GameOverScene";

/**
 * Gameplay scene. Owns the starfield, player ship, projectile pool, and enemy
 * pool; resolves collisions and ends the run when lives are spent. Waves, XP,
 * and the real HUD arrive in later issues — for now a small debug readout shows
 * HP / lives so the loop is verifiable.
 */
export class GameScene implements Scene {
  readonly view = new Container();
  private readonly starfield = new Starfield();
  private readonly bullets: ProjectilePool;
  private readonly enemies = new EnemyPool();
  private readonly player: Player;
  private readonly debug: Text;

  private spawnTimer = 0;

  // Input state, in virtual coordinates.
  private targetX = PLAYER.startX;
  private targetY = PLAYER.startY;
  private firing = false;

  private readonly onPointerMove = (e: FederatedPointerEvent) => this.aimAt(e);
  private readonly onPointerDown = (e: FederatedPointerEvent) => {
    this.aimAt(e);
    if (e.button === 0) this.firing = true;
  };
  private readonly onPointerUp = (e: FederatedPointerEvent) => {
    if (e.button === 0) this.firing = false;
  };

  constructor(private readonly manager: SceneManager) {
    this.view.addChild(this.starfield.view);
    this.view.addChild(this.enemies.view);

    this.bullets = new ProjectilePool(
      getTexture("bullet"),
      WEAPON.bulletScale,
      WEAPON.bulletRadiusFactor,
    );
    this.view.addChild(this.bullets.view);

    this.player = new Player(this.bullets);
    this.view.addChild(this.player.sprite);

    this.debug = new Text({
      text: "",
      style: { fill: 0xffffff, fontSize: 28, fontFamily: "Arial" },
    });
    this.debug.position.set(24, 20);
    this.view.addChild(this.debug);

    this.bindInput();
  }

  private bindInput(): void {
    const stage = this.manager.app.stage;
    stage.eventMode = "static";
    stage.hitArea = this.manager.app.screen;
    stage.on("pointermove", this.onPointerMove);
    stage.on("pointerdown", this.onPointerDown);
    stage.on("pointerup", this.onPointerUp);
    stage.on("pointerupoutside", this.onPointerUp);
  }

  private aimAt(e: FederatedPointerEvent): void {
    const local = this.view.toLocal(e.global);
    this.targetX = local.x;
    this.targetY = local.y;
  }

  update(dt: number): void {
    this.starfield.update(dt);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.enemies.spawnSwarmer();
      this.spawnTimer = SWARMER.spawnInterval;
    }

    this.player.update(dt, this.targetX, this.targetY, this.firing);
    this.enemies.update(dt);
    this.bullets.update(dt);

    this.resolveBulletHits();
    this.resolvePlayerHits();

    this.debug.text = `HP ${Math.max(0, Math.ceil(this.player.hp))}   Lives ${this.player.lives}`;

    if (this.player.isGameOver) {
      this.manager.changeScene(new GameOverScene(this.manager));
    }
  }

  /** Bullets damage enemies they overlap; a bullet is consumed on the first hit. */
  private resolveBulletHits(): void {
    for (const enemy of this.enemies.activeEnemies) {
      if (!enemy.active) continue;
      for (const bullet of this.bullets.activeProjectiles) {
        if (!bullet.active) continue;
        if (
          overlaps(
            bullet.x,
            bullet.y,
            bullet.radius,
            enemy.x,
            enemy.y,
            enemy.radius,
          )
        ) {
          bullet.kill();
          if (enemy.takeDamage(WEAPON.damage)) break;
        }
      }
    }
  }

  /** Enemy contact damages the player (respecting i-frames) and destroys the enemy. */
  private resolvePlayerHits(): void {
    if (this.player.isInvulnerable) return;
    for (const enemy of this.enemies.activeEnemies) {
      if (!enemy.active) continue;
      if (
        overlaps(
          this.player.x,
          this.player.y,
          this.player.hitRadius,
          enemy.x,
          enemy.y,
          enemy.radius,
        )
      ) {
        enemy.kill();
        this.player.takeHit(enemy.contactDamage);
        break;
      }
    }
  }

  destroy(): void {
    const stage = this.manager.app.stage;
    stage.off("pointermove", this.onPointerMove);
    stage.off("pointerdown", this.onPointerDown);
    stage.off("pointerup", this.onPointerUp);
    stage.off("pointerupoutside", this.onPointerUp);
    stage.hitArea = null;
    this.view.destroy({ children: true });
  }
}

/** Circle-vs-circle overlap test. */
function overlaps(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}
