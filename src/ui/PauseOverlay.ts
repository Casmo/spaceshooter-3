import { Container, Graphics, Text } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, FONT_FAMILY } from "../config";
import { makeButton } from "./Button";
import { AudioControls } from "./AudioControls";

/** Callbacks for the three pause-menu actions. */
export interface PauseActions {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

/** The pause overlay: a dimmed backdrop, title, Resume/Restart/Quit, and inline
 *  audio volume controls (adjustable mid-run, ADR-0014). */
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
        fontFamily: FONT_FAMILY,
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

    const audio = new AudioControls();
    audio.view.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 230);
    this.view.addChild(audio.view);

    const hint = new Text({
      text: "Click Resume to recapture the mouse",
      style: { fill: 0x9aa0a6, fontSize: 26, fontFamily: FONT_FAMILY },
    });
    hint.anchor.set(0.5);
    hint.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 380);
    this.view.addChild(hint);
  }
}
