import { Container, Text, type FederatedPointerEvent } from "pixi.js";
import { PLAYER, WEAPON, ENEMY_BULLET, VIRTUAL_WIDTH } from "../config";
import { type Scene, SceneManager } from "../core/SceneManager";
import { getTexture } from "../assets";
import { Starfield } from "../game/Starfield";
import { Player } from "../game/Player";
import { ProjectilePool } from "../game/ProjectilePool";
import { EnemyPool, type EnemyContext } from "../game/EnemyPool";
import { WaveManager } from "../game/WaveManager";
import { damageTierColor } from "../game/colors";
import { GameOverScene } from "./GameOverScene";

/**
 * Gameplay scene. Owns the starfield, player ship, both projectile pools, the
 * enemy pool, and the wave manager; resolves collisions and ends the run when
 * lives are spent. The real HUD arrives in #7 — for now a small debug readout
 * shows HP / lives / wave so the loop is verifiable.
 */
export class GameScene implements Scene {
  readonly view = new Container();
  private readonly starfield = new Starfield();
  private readonly enemies = new EnemyPool();
  private readonly bullets: ProjectilePool;
  private readonly enemyBullets: ProjectilePool;
  private readonly player: Player;
  private readonly waves = new WaveManager(this.enemies);
  private readonly banner: Text;
  private readonly debug: Text;

  // Reused each frame so enemies can shoot at the player.
  private readonly enemyCtx: EnemyContext = {
    playerX: 0,
    playerY: 0,
    fire: (x, y, vx, vy, damage) =>
      this.enemyBullets.spawn(x, y, vx, vy, damage, damageTierColor(damage)),
  };

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

    this.enemyBullets = new ProjectilePool(
      getTexture("enemyBullet"),
      ENEMY_BULLET.scale,
      ENEMY_BULLET.radiusFactor,
    );
    this.view.addChild(this.enemyBullets.view);

    this.player = new Player(this.bullets);
    this.view.addChild(this.player.sprite);

    this.banner = new Text({
      text: "",
      style: {
        fill: 0xffffff,
        fontSize: 72,
        fontWeight: "bold",
        fontFamily: "Arial",
      },
    });
    this.banner.anchor.set(0.5);
    this.banner.position.set(VIRTUAL_WIDTH / 2, 160);
    this.view.addChild(this.banner);

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
    this.waves.update(dt);

    this.player.update(dt, this.targetX, this.targetY, this.firing);

    this.enemyCtx.playerX = this.player.x;
    this.enemyCtx.playerY = this.player.y;
    this.enemies.update(dt, this.enemyCtx);
    this.bullets.update(dt);
    this.enemyBullets.update(dt);

    this.resolveBulletHits();
    this.resolveEnemyBulletHits();
    this.resolveContactHits();

    this.updateOverlay();

    if (this.player.isGameOver) {
      this.manager.changeScene(new GameOverScene(this.manager));
    }
  }

  /** Player bullets damage enemies; a bullet is consumed on its first hit. */
  private resolveBulletHits(): void {
    for (const enemy of this.enemies.activeEnemies) {
      if (!enemy.active) continue;
      for (const bullet of this.bullets.activeProjectiles) {
        if (!bullet.active) continue;
        if (circlesOverlap(bullet, enemy)) {
          bullet.kill();
          if (enemy.takeDamage(bullet.damage)) {
            this.enemies.handleDeath(enemy);
            break;
          }
        }
      }
    }
  }

  /** Enemy bullets damage the player (ignored while invulnerable). */
  private resolveEnemyBulletHits(): void {
    if (this.player.isInvulnerable) return;
    for (const bullet of this.enemyBullets.activeProjectiles) {
      if (!bullet.active) continue;
      if (pointInRadius(bullet.x, bullet.y, bullet.radius, this.player)) {
        bullet.kill();
        this.player.takeHit(bullet.damage);
        return;
      }
    }
  }

  /** Enemy contact damages the player and destroys the enemy. */
  private resolveContactHits(): void {
    if (this.player.isInvulnerable) return;
    for (const enemy of this.enemies.activeEnemies) {
      if (!enemy.active) continue;
      if (pointInRadius(enemy.x, enemy.y, enemy.radius, this.player)) {
        enemy.kill();
        this.player.takeHit(enemy.contactDamage);
        return;
      }
    }
  }

  private updateOverlay(): void {
    this.banner.visible = this.waves.inBreather;
    if (this.waves.inBreather) this.banner.text = this.waves.bannerText;
    this.debug.text = `HP ${Math.max(0, Math.ceil(this.player.hp))}   Lives ${this.player.lives}   Wave ${this.waves.currentWave}`;
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

interface Circle {
  x: number;
  y: number;
  radius: number;
}

function circlesOverlap(a: Circle, b: Circle): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.radius + b.radius;
  return dx * dx + dy * dy <= r * r;
}

function pointInRadius(
  x: number,
  y: number,
  radius: number,
  target: { x: number; y: number; hitRadius: number },
): boolean {
  const dx = x - target.x;
  const dy = y - target.y;
  const r = radius + target.hitRadius;
  return dx * dx + dy * dy <= r * r;
}
