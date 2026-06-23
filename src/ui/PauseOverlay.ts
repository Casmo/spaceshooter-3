import { Container, Graphics, Text } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from "../config";
import { makeButton } from "./Button";

/** Callbacks for the three pause-menu actions. */
export interface PauseActions {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

/** The pause overlay: a dimmed backdrop, title, and Resume/Restart/Quit. */
export class PauseOverlay {
  readonly view = new Container();

  constructor(actions: PauseActions) {
    const backdrop = new Graphics()
      .rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT)
      .fill({ color: 0x000010, alpha: 0.72 });
    backdrop.eventMode = "static";
    this.view.addChild(backdrop);

    const title = new Text({
      text: "PAUSED",
      style: {
        fill: 0xffffff,
        fontSize: 84,
        fontWeight: "bold",
        fontFamily: "Arial",
      },
    });
    title.anchor.set(0.5);
    title.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 160);
    this.view.addChild(title);

    const items: [string, () => void][] = [
      ["Resume", actions.onResume],
      ["Restart", actions.onRestart],
      ["Quit to Menu", actions.onQuit],
    ];
    items.forEach(([labelText, onClick], i) => {
      const btn = makeButton(labelText, onClick);
      btn.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 - 20 + i * 90);
      this.view.addChild(btn);
    });

    const hint = new Text({
      text: "Press Esc or P to resume",
      style: { fill: 0x9aa0a6, fontSize: 26, fontFamily: "Arial" },
    });
    hint.anchor.set(0.5);
    hint.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 280);
    this.view.addChild(hint);
  }
}
