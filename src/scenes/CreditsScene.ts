import { Container, Text } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from "../config";
import { type Scene, SceneManager } from "../core/SceneManager";
import { Starfield } from "../game/Starfield";
import { makeButton } from "../ui/Button";
import { MenuScene } from "./MenuScene";

const LINES: [string, number][] = [
  ["SPACE SHOOTER 3", 72],
  ["", 20],
  ["Created by Mathieu", 40],
  ["", 14],
  ["Art by Lil Cthulhu", 36],
  ["lil-cthulhu.itch.io", 28],
  ["", 14],
  ["Built with PixiJS", 32],
];

/** Static credits panel with a Back button to the main menu. */
export class CreditsScene implements Scene {
  readonly view = new Container();
  private readonly starfield = new Starfield();

  constructor(private readonly manager: SceneManager) {
    this.view.addChild(this.starfield.view);

    let y = 220;
    for (const [text, size] of LINES) {
      if (text) {
        const line = new Text({
          text,
          style: {
            fill: size >= 60 ? 0xffffff : 0xcfd6e6,
            fontSize: size,
            fontWeight: size >= 60 ? "bold" : "normal",
            fontFamily: "Arial",
          },
        });
        line.anchor.set(0.5);
        line.position.set(VIRTUAL_WIDTH / 2, y);
        this.view.addChild(line);
      }
      y += size + 24;
    }

    const back = makeButton("Back", () =>
      this.manager.changeScene(new MenuScene(this.manager)),
    );
    back.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT - 160);
    this.view.addChild(back);
  }

  update(dt: number): void {
    this.starfield.update(dt);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
