import { Container, Text } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from "../config";
import { type Scene, SceneManager } from "../core/SceneManager";
import { Starfield } from "../game/Starfield";
import { makeButton } from "../ui/Button";
import { MenuScene } from "./MenuScene";

/** Game-over stub. Returns to the menu. Later issues add run stats here. */
export class GameOverScene implements Scene {
  readonly view = new Container();
  private readonly starfield = new Starfield();

  constructor(private readonly manager: SceneManager) {
    this.view.addChild(this.starfield.view);

    const label = new Text({
      text: "GAME OVER",
      style: {
        fill: 0xff5555,
        fontSize: 80,
        fontWeight: "bold",
        fontFamily: "Arial",
      },
    });
    label.anchor.set(0.5);
    label.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 80);
    this.view.addChild(label);

    const back = makeButton("Back to menu", () =>
      this.manager.changeScene(new MenuScene(this.manager)),
    );
    back.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 40);
    this.view.addChild(back);
  }

  update(dt: number): void {
    this.starfield.update(dt);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
