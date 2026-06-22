import { Container, Text } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from "../config";
import { type Scene, SceneManager } from "../core/SceneManager";
import { Starfield } from "../game/Starfield";
import { makeButton } from "../ui/Button";
import { GameScene } from "./GameScene";

/** Main menu stub. Start navigates into the game. */
export class MenuScene implements Scene {
  readonly view = new Container();
  private readonly starfield = new Starfield();

  constructor(private readonly manager: SceneManager) {
    this.view.addChild(this.starfield.view);

    const title = new Text({
      text: "SPACE SHOOTER 3",
      style: {
        fill: 0xffffff,
        fontSize: 96,
        fontWeight: "bold",
        fontFamily: "Arial",
      },
    });
    title.anchor.set(0.5);
    title.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 120);
    this.view.addChild(title);

    const start = makeButton("Start", () =>
      this.manager.changeScene(new GameScene(this.manager)),
    );
    start.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 60);
    this.view.addChild(start);
  }

  update(dt: number): void {
    this.starfield.update(dt);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
