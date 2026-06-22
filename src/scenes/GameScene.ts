import { Container, type FederatedPointerEvent } from "pixi.js";
import { VIRTUAL_WIDTH, PLAYER, WEAPON } from "../config";
import { type Scene, SceneManager } from "../core/SceneManager";
import { getTexture } from "../assets";
import { Starfield } from "../game/Starfield";
import { Player } from "../game/Player";
import { ProjectilePool } from "../game/ProjectilePool";
import { makeButton } from "../ui/Button";
import { GameOverScene } from "./GameOverScene";

/**
 * Gameplay scene. Owns the scrolling starfield, the player ship, and the
 * projectile pool, and feeds mouse input to the ship each frame. Later issues
 * add enemies, waves, XP, and the HUD.
 */
export class GameScene implements Scene {
  readonly view = new Container();
  private readonly starfield = new Starfield();
  private readonly bullets: ProjectilePool;
  private readonly player: Player;

  // Input state, in virtual coordinates.
  private targetX = PLAYER.startX;
  private targetY = PLAYER.startY;
  private firing = false;

  // Bound handlers, kept so they can be detached on destroy.
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

    this.bullets = new ProjectilePool(getTexture("bullet"), WEAPON.bulletScale);
    this.view.addChild(this.bullets.view);

    this.player = new Player(this.bullets);
    this.view.addChild(this.player.sprite);

    // Stub: end the run to reach the game-over screen (real death lands in #3).
    const end = makeButton("End run (stub)", () =>
      this.manager.changeScene(new GameOverScene(this.manager)),
    );
    end.style.fontSize = 28;
    end.position.set(VIRTUAL_WIDTH - 160, 40);
    this.view.addChild(end);

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

  /** Map a pointer event's screen position into virtual coordinates. */
  private aimAt(e: FederatedPointerEvent): void {
    const local = this.view.toLocal(e.global);
    this.targetX = local.x;
    this.targetY = local.y;
  }

  update(dt: number): void {
    this.starfield.update(dt);
    this.player.update(dt, this.targetX, this.targetY, this.firing);
    this.bullets.update(dt);
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
