import { Container, TilingSprite } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, STARFIELD } from "../config";
import { getTexture, type AssetAlias } from "../assets";

interface Layer {
  sprite: TilingSprite;
  speed: number;
}

/**
 * Parallax scrolling space background. Three tiling layers scroll top->bottom
 * at different speeds to give a sense of depth and forward motion.
 */
export class Starfield {
  readonly view = new Container();
  private readonly layers: Layer[] = [];

  constructor() {
    const defs: { tex: AssetAlias; speed: number }[] = [
      { tex: "bg", speed: STARFIELD.bgSpeed },
      { tex: "starsA", speed: STARFIELD.starsASpeed },
      { tex: "starsB", speed: STARFIELD.starsBSpeed },
    ];

    for (const def of defs) {
      const sprite = new TilingSprite({
        texture: getTexture(def.tex),
        width: VIRTUAL_WIDTH,
        height: VIRTUAL_HEIGHT,
      });
      this.view.addChild(sprite);
      this.layers.push({ sprite, speed: def.speed });
    }
  }

  update(dt: number): void {
    for (const layer of this.layers) {
      layer.sprite.tilePosition.y += layer.speed * dt;
    }
  }
}
