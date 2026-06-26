import { Container, TilingSprite } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, STARFIELD } from "../config";
import { getTexture } from "../assets";

/**
 * Scrolling space background: one tiling layer (the pixel-art pack has no
 * separate star layers) scrolling top->bottom for a sense of forward motion.
 * The 500px-wide source is scaled to cover the full width (no horizontal
 * repeat), so the field is fully covered with art from the first frame; it
 * then drifts downward.
 */
export class Starfield {
  readonly view = new Container();
  private readonly bg: TilingSprite;

  constructor() {
    const texture = getTexture("bg");
    this.bg = new TilingSprite({
      texture,
      width: VIRTUAL_WIDTH,
      height: VIRTUAL_HEIGHT,
    });
    // Cover the full screen width with one column of the texture (no repeat).
    this.bg.tileScale.set(VIRTUAL_WIDTH / texture.width);
    this.view.addChild(this.bg);
  }

  update(dt: number): void {
    this.bg.tilePosition.y += STARFIELD.scrollSpeed * dt;
  }
}
