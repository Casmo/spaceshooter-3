import { Application, Container, Graphics } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from "../config";

/**
 * A screen of the game. Scenes author their content in virtual coordinates
 * (0..VIRTUAL_WIDTH, 0..VIRTUAL_HEIGHT); the SceneManager handles scaling.
 */
export interface Scene {
  /** Root display object for this scene. */
  readonly view: Container;
  /** Per-frame update. dt is seconds since the last frame. */
  update?(dt: number): void;
  /** Tear down the scene and free its resources. */
  destroy(): void;
}

/**
 * Owns the PixiJS application, the fixed virtual-resolution root container, and
 * the active scene. Scales the root to fit the window with letterboxing and
 * drives the active scene's update loop.
 */
export class SceneManager {
  /** Container scaled/positioned to letterbox the virtual resolution. */
  private readonly root: Container;
  private readonly mask: Graphics;
  private current?: Scene;

  constructor(public readonly app: Application) {
    this.root = new Container();
    this.app.stage.addChild(this.root);

    // Clip anything outside the virtual area so content never bleeds into the
    // letterbox bars.
    this.mask = new Graphics()
      .rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT)
      .fill(0xffffff);
    this.root.addChild(this.mask);
    this.root.mask = this.mask;

    window.addEventListener("resize", () => this.resize());
    this.resize();

    this.app.ticker.add((ticker) => {
      this.current?.update?.(ticker.deltaMS / 1000);
    });
  }

  /** Current letterbox scale (CSS px per virtual px). Used to normalize raw
   *  mouse-movement deltas into virtual space so steering feels window-size
   *  independent (see docs/adr/0006). */
  get scale(): number {
    return this.root.scale.x;
  }

  /** Recompute scale + offset to fit the virtual resolution in the window. */
  private resize(): void {
    const { width, height } = this.app.screen;
    const scale = Math.min(width / VIRTUAL_WIDTH, height / VIRTUAL_HEIGHT);
    this.root.scale.set(scale);
    this.root.x = (width - VIRTUAL_WIDTH * scale) / 2;
    this.root.y = (height - VIRTUAL_HEIGHT * scale) / 2;
  }

  /** Swap to a new scene, destroying the previous one. */
  changeScene(next: Scene): void {
    if (this.current) {
      this.root.removeChild(this.current.view);
      this.current.destroy();
    }
    this.current = next;
    // Keep the mask topmost in the child list; scene content sits below it.
    this.root.addChildAt(next.view, this.root.getChildIndex(this.mask));
  }
}
