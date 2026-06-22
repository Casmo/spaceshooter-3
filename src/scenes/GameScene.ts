import { Container, Text, type FederatedPointerEvent } from "pixi.js";
import {
  PLAYER,
  WEAPON,
  ENEMY_BULLET,
  STAR,
  XP,
  VIRTUAL_WIDTH,
} from "../config";
import { type Scene, SceneManager } from "../core/SceneManager";
import { getTexture } from "../assets";
import { Starfield } from "../game/Starfield";
import { Player } from "../game/Player";
import { ProjectilePool } from "../game/ProjectilePool";
import { EnemyPool, type Enemy, type EnemyContext } from "../game/EnemyPool";
import { WaveManager } from "../game/WaveManager";
import { StarPool } from "../game/StarPool";
import { Leveling } from "../game/Leveling";
import { Upgrades, UPGRADE_DEFS, type UpgradeDef } from "../game/upgrades";
import { UpgradePrompt } from "../ui/UpgradePrompt";
import { damageTierColor } from "../game/colors";
import { GameOverScene } from "./GameOverScene";

/**
 * Gameplay scene. Owns the starfield, player ship, projectile/enemy/star pools,
 * the wave manager, and the XP/upgrade loop; resolves collisions, awards XP,
 * shows the (paused) level-up prompt, and ends the run when lives are spent.
 * The real HUD arrives in #7 — a small debug readout stands in for now.
 */
export class GameScene implements Scene {
  readonly view = new Container();
  private readonly starfield = new Starfield();
  private readonly enemies = new EnemyPool();
  private readonly stars = new StarPool();
  private readonly bullets: ProjectilePool;
  private readonly enemyBullets: ProjectilePool;
  private readonly player: Player;
  private readonly waves = new WaveManager(this.enemies);
  private readonly leveling = new Leveling(XP.baseThreshold, XP.growth);
  private readonly upgrades = new Upgrades(UPGRADE_DEFS);
  private readonly banner: Text;
  private readonly debug: Text;

  /** Level-ups awaiting an upgrade choice (a big XP gain can stack several). */
  private pendingLevelUps = 0;
  private prompt?: UpgradePrompt;

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
    this.view.addChild(this.stars.view);

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
    // While the level-up prompt is open the whole game is paused.
    if (this.prompt) return;

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

    this.awardXp(
      this.stars.update(
        dt,
        this.player.x,
        this.player.y,
        this.player.pickupRange,
      ),
    );

    this.updateOverlay();

    if (this.player.isGameOver) {
      this.manager.changeScene(new GameOverScene(this.manager));
      return;
    }
    if (this.pendingLevelUps > 0) this.showPrompt();
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
            this.destroyEnemy(enemy);
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
        this.destroyEnemy(enemy);
        this.player.takeHit(enemy.contactDamage);
        return;
      }
    }
  }

  /** Award XP, maybe drop a Star, and split asteroids when an enemy is killed. */
  private destroyEnemy(enemy: Enemy): void {
    this.awardXp(enemy.xpValue);
    const guaranteed = enemy.kind === "miniboss";
    if (guaranteed || Math.random() < STAR.dropChance) {
      this.stars.spawn(enemy.x, enemy.y);
    }
    this.enemies.handleDeath(enemy);
  }

  private awardXp(amount: number): void {
    if (amount > 0) this.pendingLevelUps += this.leveling.addXp(amount);
  }

  /** Open the level-up prompt for the next pending level-up (pauses the game). */
  private showPrompt(): void {
    const choices = this.upgrades.draw(3);
    this.prompt = new UpgradePrompt(choices, (def) => this.applyPick(def));
    this.view.addChild(this.prompt.view);
  }

  private applyPick(def: UpgradeDef): void {
    this.upgrades.apply(def, this.player);
    this.prompt?.view.destroy({ children: true });
    this.prompt = undefined;
    this.pendingLevelUps -= 1;
    if (this.pendingLevelUps > 0) this.showPrompt();
  }

  private updateOverlay(): void {
    this.banner.visible = this.waves.inBreather;
    if (this.waves.inBreather) this.banner.text = this.waves.bannerText;
    this.debug.text =
      `HP ${Math.max(0, Math.ceil(this.player.hp))}/${this.player.maxHp}   ` +
      `Lives ${this.player.lives}   Wave ${this.waves.currentWave}   ` +
      `Lv ${this.leveling.level}`;
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
