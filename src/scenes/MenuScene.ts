import { Container, Text } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from "../config";
import { type Scene, SceneManager } from "../core/SceneManager";
import { Starfield } from "../game/Starfield";
import { playMusic, stopMusic } from "../game/audio";
import { makeButton } from "../ui/Button";
import { GameScene } from "./GameScene";
import { CreditsScene } from "./CreditsScene";

/** Main menu: Start, Credits, Exit. Plays the menu music while shown. */
export class MenuScene implements Scene {
  readonly view = new Container();
  private readonly starfield = new Starfield();

  constructor(private readonly manager: SceneManager) {
    this.view.addChild(this.starfield.view);

    const title = new Text({
      text: "SPACESHOOTER 3",
      style: {
        fill: 0xffffff,
        fontSize: 96,
        fontWeight: "bold",
        fontFamily: "Arial",
      },
    });
    title.anchor.set(0.5);
    title.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 180);
    this.view.addChild(title);

    const items: [string, () => void][] = [
      ["Start", () => this.manager.changeScene(new GameScene(this.manager))],
      [
        "Credits",
        () => this.manager.changeScene(new CreditsScene(this.manager)),
      ],
      ["Exit", () => window.close()],
    ];
    items.forEach(([label, onClick], i) => {
      const btn = makeButton(label, onClick);
      btn.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 20 + i * 90);
      this.view.addChild(btn);
    });

    playMusic();
  }

  update(dt: number): void {
    this.starfield.update(dt);
  }

  destroy(): void {
    stopMusic();
    this.view.destroy({ children: true });
  }
}
