import { Container, Text, type FederatedPointerEvent } from "pixi.js";
import {
  WEAPON,
  ENEMY_BULLET,
  STAR,
  XP,
  SCORE,
  MINE,
  MODIFIER_FX,
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
  FONT_FAMILY,
} from "../config";
import { type Scene, SceneManager } from "../core/SceneManager";
import { getTexture } from "../assets";
import { Starfield } from "../game/Starfield";
import { Player } from "../game/Player";
import { ProjectilePool, type Projectile } from "../game/ProjectilePool";
import {
  EnemyPool,
  type Enemy,
  type EnemyContext,
  type EnemyKind,
} from "../game/EnemyPool";
import { WaveManager } from "../game/WaveManager";
import { StarPool } from "../game/StarPool";
import { EffectsPool } from "../game/EffectsPool";
import { Leveling } from "../game/Leveling";
import { Upgrades, UPGRADE_DEFS, type UpgradeDef } from "../game/upgrades";
import { emptyRun, loadStats, recordRun, type RunStats } from "../game/Stats";
import { playSound } from "../game/audio";
import { UpgradePrompt } from "../ui/UpgradePrompt";
import { PauseOverlay } from "../ui/PauseOverlay";
import { Hud } from "../ui/Hud";
import { damageTierColor } from "../game/colors";
import { GameOverScene } from "./GameOverScene";
import { MenuScene } from "./MenuScene";

/**
 * Gameplay scene. Owns the playfield (player, pools, waves), the XP/upgrade
 * loop, scoring, and the HUD; resolves collisions, shows the paused level-up
 * prompt, and ends the run — recording stats — when lives are spent.
 */
export class GameScene implements Scene {
  readonly view = new Container();
  private readonly starfield = new Starfield();
  private readonly enemies = new EnemyPool();
  private readonly stars = new StarPool();
  private readonly effects = new EffectsPool();
  private readonly bullets: ProjectilePool;
  private readonly enemyBullets: ProjectilePool;
  private readonly player: Player;
  private readonly waves: WaveManager;
  private readonly leveling = new Leveling(
    XP.baseThreshold,
    XP.growth,
    XP.lateLevel,
    XP.lateGrowth,
  );
  private readonly upgrades = new Upgrades(UPGRADE_DEFS);
  private readonly hud = new Hud();
  private readonly banner: Text;

  /** This run's accumulating stats; the best score is loaded once for the HUD. */
  private readonly run: RunStats = emptyRun();
  private readonly bestScore = loadStats().bestScore;

  /** Throttle for emitting Homing/Burn trail puffs. */
  private trailTimer = 0;

  /** Level-ups awaiting an upgrade choice (a big XP gain can stack several). */
  private pendingLevelUps = 0;
  private prompt?: UpgradePrompt;

  /** Player-initiated pause (Esc / P). */
  private paused = false;
  private pauseOverlay?: PauseOverlay;

  private readonly enemyCtx: EnemyContext = {
    playerX: 0,
    playerY: 0,
    fire: (x, y, vx, vy, damage) => {
      playSound("enemyShoot", 0.35);
      this.enemyBullets.spawn({
        x,
        y,
        vx,
        vy,
        damage,
        tint: damageTierColor(damage),
      });
    },
  };

  // Input state. Steering is relative (ADR-0006): raw mouse-movement deltas
  // accumulate here (CSS px) and are applied each frame.
  private pendingDx = 0;
  private pendingDy = 0;
  private firing = false;
  /** Menu Cursor position (virtual px) while an Upgrade Prompt is open. The lock
   *  stays held through the prompt (ADR-0008), so the mouse drives this instead
   *  of steering, and a left-click picks the hovered card. */
  private cursorX = 0;
  private cursorY = 0;

  private readonly onMouseMove = (e: MouseEvent) => {
    if (!this.isLocked) return;
    // Lock held through the prompt: motion drives the Menu Cursor, not steering.
    if (this.prompt) {
      const scale = this.manager.scale || 1;
      this.cursorX = clamp(
        this.cursorX + e.movementX / scale,
        0,
        VIRTUAL_WIDTH,
      );
      this.cursorY = clamp(
        this.cursorY + e.movementY / scale,
        0,
        VIRTUAL_HEIGHT,
      );
      this.prompt.moveCursor(this.cursorX, this.cursorY);
      return;
    }
    this.pendingDx += e.movementX;
    this.pendingDy += e.movementY;
  };
  private readonly onPointerDown = (e: FederatedPointerEvent) => {
    if (e.button !== 0) return;
    // While the prompt is up a left-click selects the hovered card — but not
    // while paused over it: the PauseOverlay's Resume click bubbles to the stage
    // and would otherwise pick a card behind the overlay.
    if (this.prompt) {
      if (!this.paused) this.prompt.press();
      return;
    }
    this.firing = true;
  };
  private readonly onPointerUp = (e: FederatedPointerEvent) => {
    if (e.button === 0) this.firing = false;
  };
  /** Single source of truth for entering/leaving active gameplay: losing the
   *  lock (Esc, alt-tab, OS steal) pauses; (re)acquiring it resumes. The only
   *  release we ever initiate now is at game-over (ADR-0008), so every loss
   *  seen here is unexpected — no expected/unexpected bookkeeping needed. */
  private readonly onPointerLockChange = () => {
    if (this.isLocked) {
      this.onLockAcquired();
    } else {
      this.pauseFromLockLoss();
    }
  };

  constructor(private readonly manager: SceneManager) {
    this.waves = new WaveManager(this.enemies, (wave) => {
      this.run.score += SCORE.waveClearBase * wave;
    });

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

    this.view.addChild(this.effects.view);

    this.banner = new Text({
      text: "",
      style: {
        fill: 0xffffff,
        fontSize: 72,
        fontWeight: "bold",
        fontFamily: FONT_FAMILY,
      },
    });
    this.banner.anchor.set(0.5);
    this.banner.position.set(VIRTUAL_WIDTH / 2, 160);

    this.view.addChild(this.hud.view);
    this.view.addChild(this.banner);

    this.bindInput();
  }

  private bindInput(): void {
    const stage = this.manager.app.stage;
    stage.eventMode = "static";
    stage.hitArea = this.manager.app.screen;
    // Firing stays on Pixi pointer events (works under pointer lock); steering
    // reads raw movement deltas from the DOM (Pixi's global coords freeze while
    // locked, but movementX/Y keep flowing).
    stage.on("pointerdown", this.onPointerDown);
    stage.on("pointerup", this.onPointerUp);
    stage.on("pointerupoutside", this.onPointerUp);
    window.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    // Capture the cursor for relative steering. This runs inside the click that
    // started/restarted the run, so it counts as the required user gesture.
    this.requestLock();
  }

  private get isLocked(): boolean {
    return document.pointerLockElement === this.manager.app.canvas;
  }

  /**
   * Request relative-mouse capture, preferring raw (un-accelerated) deltas and
   * falling back to OS-accelerated where `unadjustedMovement` is unsupported
   * (ADR-0006).
   */
  private requestLock(): void {
    const el = this.manager.app.canvas as HTMLCanvasElement;
    const request = el.requestPointerLock as (options?: {
      unadjustedMovement?: boolean;
    }) => Promise<void> | void;
    const result = request.call(el, { unadjustedMovement: true });
    if (result && typeof (result as Promise<void>).catch === "function") {
      (result as Promise<void>).catch(() => el.requestPointerLock());
    }
  }

  /** Lock (re)acquired — back in active gameplay; clear stale input and any
   *  pause overlay. */
  private onLockAcquired(): void {
    this.pendingDx = 0;
    this.pendingDy = 0;
    this.firing = false;
    if (this.paused) {
      this.pauseOverlay?.view.destroy({ children: true });
      this.pauseOverlay = undefined;
      this.paused = false;
    }
  }

  /** Lock lost without us asking (Esc, alt-tab, OS steal) → pause. Resume
   *  re-locks, which resumes gameplay via onLockAcquired. */
  private pauseFromLockLoss(): void {
    if (this.paused) return;
    // A lock loss with a prompt open (player hit Esc mid-menu) pauses over it;
    // Resume re-locks and the still-open prompt is there to finish (ADR-0008).
    this.firing = false;
    this.paused = true;
    this.pauseOverlay = new PauseOverlay({
      onResume: () => this.requestLock(),
      onRestart: () => this.manager.changeScene(new GameScene(this.manager)),
      onQuit: () => this.manager.changeScene(new MenuScene(this.manager)),
    });
    this.view.addChild(this.pauseOverlay.view);
  }

  update(dt: number): void {
    // The level-up prompt and pause overlay both freeze the game; so does not
    // holding the lock (mid re-lock transition, or the lock was just lost).
    if (this.prompt || this.paused || !this.isLocked) return;

    this.run.timeSurvived += dt;

    this.starfield.update(dt);
    this.waves.update(dt);

    // Convert accumulated mouse deltas (CSS px) to virtual px via the letterbox
    // scale, then steer; drain the accumulator for the next frame.
    const scale = this.manager.scale || 1;
    this.player.steer(this.pendingDx / scale, this.pendingDy / scale);
    this.pendingDx = 0;
    this.pendingDy = 0;
    this.player.update(dt, this.firing);

    this.enemyCtx.playerX = this.player.x;
    this.enemyCtx.playerY = this.player.y;
    this.enemies.update(dt, this.enemyCtx);

    // Enemies killed by burn DoT this frame still reward XP / stars / splits.
    for (const e of this.enemies.drainBurnKills()) this.destroyEnemy(e);

    this.steerHoming(dt);
    this.bullets.update(dt);
    this.enemyBullets.update(dt);
    this.effects.update(dt);
    this.emitTrails(dt);

    this.resolveBulletHits();
    this.resolveEnemyBulletHits();
    this.resolveContactHits();

    const starXp = this.stars.update(
      dt,
      this.player.x,
      this.player.y,
      this.player.pickupRange,
    );
    // One pickup chime per frame regardless of how many Stars landed at once.
    if (starXp > 0) playSound("pickup", 0.6);
    this.awardXp(starXp);

    this.updateOverlay();

    if (this.player.isGameOver) {
      this.endRun();
      return;
    }
    if (this.pendingLevelUps > 0) this.showPrompt();
  }

  /** Finalize run stats, persist them, and go to the game-over screen. */
  private endRun(): void {
    this.run.wave = this.waves.currentWave;
    this.run.level = this.leveling.level;
    this.run.bulletsFired = this.player.bulletsFired;
    // Release the cursor so the game-over screen is clickable.
    document.exitPointerLock();
    playSound("gameover");
    const record = recordRun(this.run);
    this.manager.changeScene(new GameOverScene(this.manager, this.run, record));
  }

  /**
   * Player bullets damage enemies. A bullet passes through up to its
   * `pierceRemaining` enemies (never hitting the same one twice) before it is
   * consumed. On each hit it also applies Burn and Explosive, and (if it has
   * Bounce left) queues a Bounce-bullet — spawned after the loop so the new
   * clones aren't collision-tested at their source this frame.
   */
  private resolveBulletHits(): void {
    const bounceSpawns: { bullet: Projectile; source: Enemy }[] = [];
    for (const bullet of this.bullets.activeProjectiles) {
      if (!bullet.active) continue;
      for (const enemy of this.enemies.activeEnemies) {
        if (!enemy.active) continue;
        // A Warden with a live Shield needs the node/gap/body resolution; a shot
        // in a gap passes through (not consumed) instead of hitting the body.
        if (enemy.hasLiveShield) {
          if (this.resolveShieldedHit(bullet, enemy, bounceSpawns)) break;
          continue;
        }
        if (bullet.hits.has(enemy)) continue;
        if (!circlesOverlap(bullet, enemy)) continue;

        bullet.hits.add(enemy);
        this.applyBulletHit(bullet, enemy);
        if (bullet.bounceRemaining > 0)
          bounceSpawns.push({ bullet, source: enemy });

        if (bullet.pierceRemaining > 0) {
          bullet.pierceRemaining -= 1;
        } else {
          bullet.kill();
          break;
        }
      }
    }
    for (const { bullet, source } of bounceSpawns)
      this.spawnBounce(bullet, source);
  }

  /**
   * Resolve one bullet against a Shielded Warden (ADR-0012): test the outer ring
   * of live Shield Nodes first, then the body if the shot threaded a gap. A Node
   * hit chips that Node (Explosive still blasts through to the body; Burn lights
   * the Node); a body hit is the normal hit. Pierce treats a Node and the body as
   * separate hits. Returns true when the bullet is consumed (stop scanning).
   */
  private resolveShieldedHit(
    bullet: Projectile,
    enemy: Enemy,
    bounceSpawns: { bullet: Projectile; source: Enemy }[],
  ): boolean {
    for (const node of enemy.shieldNodes) {
      if (!node.alive || bullet.hits.has(node)) continue;
      if (!circlesOverlap(bullet, node)) continue;
      bullet.hits.add(node);
      this.effects.spark(bullet.x, bullet.y);
      playSound("bulletHit", 0.4);
      enemy.damageShieldNode(node, bullet.damage);
      if (bullet.burnDps > 0)
        node.applyBurn(bullet.burnDps, bullet.burnDuration);
      // Explosive bypasses the Shield (ADR-0012): detonate centred on the body
      // (not the outer Node) so the blast reliably reaches it at any Explosive
      // level — the orbit radius can exceed the base blast radius. No exclude, so
      // the body and any nearby enemies take the AoE.
      if (bullet.explosiveRadius > 0)
        this.explode(
          enemy.x,
          enemy.y,
          bullet.explosiveRadius,
          bullet.explosiveDamage,
        );
      if (bullet.pierceRemaining > 0) {
        bullet.pierceRemaining -= 1;
        return false;
      }
      bullet.kill();
      return true;
    }
    // No Node intercepted: a shot through a gap hits the body normally.
    if (!bullet.hits.has(enemy) && circlesOverlap(bullet, enemy)) {
      bullet.hits.add(enemy);
      this.applyBulletHit(bullet, enemy);
      if (bullet.bounceRemaining > 0)
        bounceSpawns.push({ bullet, source: enemy });
      if (bullet.pierceRemaining > 0) {
        bullet.pierceRemaining -= 1;
        return false;
      }
      bullet.kill();
      return true;
    }
    return false; // gap — pass through
  }

  /** Apply one bullet→enemy hit: direct damage, burn, and explosion. */
  private applyBulletHit(bullet: Projectile, enemy: Enemy): void {
    this.effects.spark(bullet.x, bullet.y);
    playSound("bulletHit", 0.4);
    if (enemy.takeDamage(bullet.damage)) this.destroyEnemy(enemy);
    if (bullet.burnDps > 0)
      enemy.applyBurn(bullet.burnDps, bullet.burnDuration);
    if (bullet.explosiveRadius > 0) {
      this.explode(
        bullet.x,
        bullet.y,
        bullet.explosiveRadius,
        bullet.explosiveDamage,
        enemy,
      );
    }
  }

  /** Explosive AoE: damage every enemy in radius except the directly-hit one.
   *  Called with no `exclude` when a blast is triggered on a Warden's Shield Node
   *  — then the body is *not* excluded, so the blast bypasses the Shield (ADR-0012). */
  private explode(
    x: number,
    y: number,
    radius: number,
    damage: number,
    exclude?: Enemy,
  ): void {
    playSound("explosion", 0.5);
    // Animated burst, sized from the AoE radius then scaled down to 0.2x.
    this.effects.explode(x, y, (radius / 32) * 0.2, MODIFIER_FX.tint.explosion);
    const r2 = radius * radius;
    for (const enemy of this.enemies.activeEnemies) {
      if (!enemy.active || enemy === exclude) continue;
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      if (dx * dx + dy * dy <= r2 && enemy.takeDamage(damage)) {
        this.destroyEnemy(enemy);
      }
    }
  }

  /**
   * Bounce (ADR-0005): spawn one full clone of `parent` in a random direction.
   * The clone keeps full damage, unlimited range, the same look, and every other
   * Modifier — but never pierces, and chains one generation shallower. It cannot
   * hit the enemy it spawned from (Homing acquisition skips it too).
   */
  private spawnBounce(parent: Projectile, source: Enemy): void {
    const angle = Math.random() * Math.PI * 2;
    const speed = WEAPON.bulletSpeed;
    this.bullets.spawn({
      x: parent.x,
      y: parent.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage: parent.damage,
      tint: parent.sprite.tint,
      texture: parent.sprite.texture,
      scale: parent.sprite.scale.x,
      // No `life`: unlimited range, like a normal bullet.
      homing: parent.homing,
      explosiveRadius: parent.explosiveRadius,
      explosiveDamage: parent.explosiveDamage,
      burnDps: parent.burnDps,
      burnDuration: parent.burnDuration,
      bounceRemaining: parent.bounceRemaining - 1,
      hitsExclude: source, // never re-hit the enemy that spawned it
    });
  }

  /**
   * Steer Homing bullets toward the one enemy they Locked at birth, preserving
   * their speed. A bullet acquires its Lock once, on its first steer frame, on
   * the closest enemy then present; it never re-locks. Once that enemy is gone
   * (destroyed or fled the field), the bullet keeps its last-known heading.
   */
  private steerHoming(dt: number): void {
    for (const bullet of this.bullets.activeProjectiles) {
      if (!bullet.active || bullet.homing <= 0) continue;
      if (!bullet.acquired) {
        // Skip already-excluded enemies (a Bounce-bullet's source) so it never
        // Locks back onto the enemy it spawned from.
        const acquired = this.nearestEnemy(bullet.x, bullet.y, bullet.hits);
        bullet.target = acquired;
        bullet.targetGen = acquired ? acquired.generation : 0;
        bullet.acquired = true;
      }
      const target = bullet.target as Enemy | undefined;
      // Lock is valid only while the same enemy is still alive in its slot.
      if (!target || !target.active || target.generation !== bullet.targetGen) {
        continue;
      }
      const desired = Math.atan2(target.y - bullet.y, target.x - bullet.x);
      const current = Math.atan2(bullet.vy, bullet.vx);
      let diff = desired - current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = bullet.homing * dt;
      const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
      const angle = current + turn;
      const speed = Math.hypot(bullet.vx, bullet.vy);
      bullet.vx = Math.cos(angle) * speed;
      bullet.vy = Math.sin(angle) * speed;
    }
  }

  private nearestEnemy(
    x: number,
    y: number,
    exclude?: ReadonlySet<unknown>,
  ): Enemy | undefined {
    let best: Enemy | undefined;
    let bestD = Infinity;
    for (const enemy of this.enemies.activeEnemies) {
      if (!enemy.active || exclude?.has(enemy)) continue;
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = enemy;
      }
    }
    return best;
  }

  /** Drop fading puffs behind Homing (cyan) and Burn (orange) bullets. */
  private emitTrails(dt: number): void {
    this.trailTimer -= dt;
    if (this.trailTimer > 0) return;
    this.trailTimer = MODIFIER_FX.trail.interval;
    for (const bullet of this.bullets.activeProjectiles) {
      if (!bullet.active) continue;
      const tint =
        bullet.burnDps > 0
          ? MODIFIER_FX.tint.burnTrail
          : bullet.homing > 0
            ? MODIFIER_FX.tint.homingTrail
            : undefined;
      if (tint === undefined) continue;
      this.effects.spawn(
        "smoke",
        bullet.x,
        bullet.y,
        MODIFIER_FX.trail.scale,
        MODIFIER_FX.trail.scale * 0.4,
        MODIFIER_FX.trail.life,
        tint,
      );
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
        // Ramming the Boss hurts the player but never destroys it — otherwise a
        // suicide-ram would trivially one-shot the wave's marquee enemy.
        if (enemy.kind === "boss") {
          this.player.takeHit(enemy.contactDamage);
          return;
        }
        enemy.kill();
        // An explosive's detonation (in destroyEnemy) deals the player damage —
        // the player is at the blast centre — so don't also apply contact damage.
        this.destroyEnemy(enemy);
        if (!isExplosive(enemy.kind)) this.player.takeHit(enemy.contactDamage);
        return;
      }
    }
  }

  /** Award XP + score, maybe drop a Star, and split asteroids on a kill. */
  private destroyEnemy(enemy: Enemy): void {
    this.awardXp(enemy.xpValue);
    this.run.score += enemy.scoreValue;
    this.run.kills += 1;
    const guaranteed = enemy.kind === "miniboss" || enemy.kind === "boss";
    if (guaranteed || Math.random() < STAR.dropChance) {
      this.stars.spawn(enemy.x, enemy.y);
    }
    this.enemies.handleDeath(enemy);
    // A destroyed explosive (Mine or Bomber) detonates with its own louder blast
    // (detonateExplosive); every other enemy gets the standard kill boom. Both
    // draw from the explosion variant pool (ADR-0014).
    if (isExplosive(enemy.kind)) this.detonateExplosive(enemy);
    else playSound("explosion", 0.4);
  }

  /**
   * Explosive detonation (Mine or Bomber): a full-size Explosion04 burst at the
   * enemy's position whose native footprint (240px) matches the blast radius,
   * plus flat AoE damage to the player alone if within that radius. Fires on any
   * destruction (gunfire, Explosive AoE, Burn kill, or player contact) — the Mine
   * never on an off-screen escape; the Bomber is clamped on-screen so it always
   * dies in-bounds. Both reuse the Mine's blast tuning.
   */
  private detonateExplosive(enemy: Enemy): void {
    playSound("explosion", 0.6);
    // Scale the burst so its footprint matches the blast radius exactly.
    const scale = MINE.explosionRadius / MINE.explosion04Half;
    this.effects.explode(enemy.x, enemy.y, scale, 0xffffff, "explosionBig");
    const dx = this.player.x - enemy.x;
    const dy = this.player.y - enemy.y;
    if (dx * dx + dy * dy <= MINE.explosionRadius * MINE.explosionRadius) {
      this.player.takeHit(MINE.explosionDamage);
    }
  }

  private awardXp(amount: number): void {
    if (amount > 0) this.pendingLevelUps += this.leveling.addXp(amount);
  }

  /** Open the level-up prompt for the next pending level-up (pauses the game). */
  private showPrompt(): void {
    playSound("levelup");
    // Keep the lock held (ADR-0008): re-acquiring it on every pick is what
    // re-triggered the browser's pointer-lock notice. The Menu Cursor (drawn by
    // the prompt) handles selection instead. Start it centered.
    this.firing = false;
    this.cursorX = VIRTUAL_WIDTH / 2;
    this.cursorY = VIRTUAL_HEIGHT / 2;
    const choices = this.upgrades.draw(3);
    this.prompt = new UpgradePrompt(choices, (def) => this.applyPick(def));
    this.view.addChild(this.prompt.view);
  }

  private applyPick(def: UpgradeDef): void {
    this.upgrades.apply(def, this.player);
    this.prompt?.view.destroy({ children: true });
    this.prompt = undefined;
    this.pendingLevelUps -= 1;
    // The lock was never released, so there's nothing to re-acquire: showing the
    // next prompt or (queue empty) clearing it lets update() resume on its own.
    if (this.pendingLevelUps > 0) this.showPrompt();
  }

  private updateOverlay(): void {
    this.banner.visible = this.waves.inBreather;
    if (this.waves.inBreather) this.banner.text = this.waves.bannerText;
    this.hud.update({
      score: this.run.score,
      bestScore: this.bestScore,
      wave: this.waves.currentWave,
      lives: this.player.lives,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      level: this.leveling.level,
      xpProgress: this.leveling.progress,
    });
  }

  destroy(): void {
    const stage = this.manager.app.stage;
    stage.off("pointerdown", this.onPointerDown);
    stage.off("pointerup", this.onPointerUp);
    stage.off("pointerupoutside", this.onPointerUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    stage.hitArea = null;
    // Note: we deliberately don't exitPointerLock here. A restart constructs the
    // next GameScene (which re-requests the lock) before this runs; exiting here
    // would cancel that. Non-gameplay exits release the lock explicitly (endRun,
    // and the paused state is already unlocked for Quit).
    this.view.destroy({ children: true });
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Explosive enemies whose death is itself a threat — they detonate (Mine's
 *  blast) on any destruction or player contact, instead of dealing plain contact
 *  damage. Both share detonateExplosive. */
function isExplosive(kind: EnemyKind): boolean {
  return kind === "mine" || kind === "bomber";
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
