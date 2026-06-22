import { Container, Text } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from "../config";
import { type Scene, SceneManager } from "../core/SceneManager";
import { Starfield } from "../game/Starfield";
import { makeButton } from "../ui/Button";
import { GameOverScene } from "./GameOverScene";

/**
 * Gameplay scene stub. Owns the scrolling starfield that gameplay sits on top
 * of. Later issues add the player, enemies, waves, and HUD here.
 */
export class GameScene implements Scene {
  readonly view = new Container();
  private readonly starfield = new Starfield();

  constructor(private readonly manager: SceneManager) {
    this.view.addChild(this.starfield.view);

    const label = new Text({
      text: "GAME",
      style: { fill: 0xffffff, fontSize: 64, fontFamily: "Arial" },
    });
    label.anchor.set(0.5);
    label.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 80);
    this.view.addChild(label);

    const end = makeButton("End run (stub)", () =>
      this.manager.changeScene(new GameOverScene(this.manager)),
    );
    end.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 40);
    this.view.addChild(end);
  }

  update(dt: number): void {
    this.starfield.update(dt);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
