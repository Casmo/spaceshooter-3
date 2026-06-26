import { Container, TilingSprite } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, STARFIELD } from "../config";
import { getTexture } from "../assets";

/**
 * Scrolling space background: one tiling layer (the pixel-art pack has no
 * separate star layers) scrolling top->bottom for a sense of forward motion.
 * The 500px-wide source is kept at native size and tiles horizontally to fill
 * the field (accepting the repeat), per the asset-refactor session.
 */
export class Starfield {
  readonly view = new Container();
  private readonly bg: TilingSprite;

  constructor() {
    this.bg = new TilingSprite({
      texture: getTexture("bg"),
      width: VIRTUAL_WIDTH,
      height: VIRTUAL_HEIGHT,
    });
    this.view.addChild(this.bg);
  }

  update(dt: number): void {
    this.bg.tilePosition.y += STARFIELD.scrollSpeed * dt;
  }
}
