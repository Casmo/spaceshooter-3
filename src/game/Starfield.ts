import { Container, Graphics, TilingSprite } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, STARFIELD } from "../config";
import { getTexture, type AssetAlias } from "../assets";

interface Layer {
  sprite: TilingSprite;
  speed: number;
}

/**
 * Parallax space background. A solid black base fills the field from the first
 * frame; over it, two transparent layers (a far nebula and a nearer star layer,
 * split out of the Space_xx sheets) tile to fill and scroll top->bottom at
 * different speeds to give depth and forward motion.
 */
export class Starfield {
  readonly view = new Container();
  private readonly layers: Layer[] = [];

  constructor() {
    const black = new Graphics()
      .rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT)
      .fill(0x000000);
    this.view.addChild(black);

    const defs: { tex: AssetAlias; speed: number }[] = [
      { tex: "nebula", speed: STARFIELD.nebulaSpeed },
      { tex: "starsA", speed: STARFIELD.starsASpeed },
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
