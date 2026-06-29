import { Container, Graphics, Text } from "pixi.js";
import { FONT_FAMILY, AUDIO } from "../config";
import { makeButton } from "./Button";
import {
  getMusicVolume,
  getSfxVolume,
  setMusicVolume,
  setSfxVolume,
} from "../game/audio";

const BAR_WIDTH = 200;
const BAR_HEIGHT = 16;
const ROW_GAP = 76;

/** Read/write pair for one volume row. */
interface VolumeAccess {
  get: () => number;
  set: (v: number) => number;
}

/**
 * Two stepped volume rows (Music, SFX) — the audio settings UI (ADR-0014).
 * Stepped −/+ buttons (not a drag-slider) so the control works under pointer-
 * lock in the Pause overlay. Self-contained: it reads and persists volumes via
 * game/audio. Position `view` by the row block's center; rows lay out around the
 * container origin. The two-row block spans roughly [-half..+half] in Y so a
 * caller can center it: total height ≈ ROW_GAP.
 */
export class AudioControls {
  readonly view = new Container();

  constructor() {
    this.addRow("Music", 0, { get: getMusicVolume, set: setMusicVolume });
    this.addRow("SFX", ROW_GAP, { get: getSfxVolume, set: setSfxVolume });
  }

  private addRow(label: string, y: number, vol: VolumeAccess): void {
    const name = new Text({
      text: label,
      style: { fill: 0xffffff, fontSize: 34, fontFamily: FONT_FAMILY },
    });
    name.anchor.set(1, 0.5);
    name.position.set(-200, y);
    this.view.addChild(name);

    const bar = new Graphics();
    bar.position.set(0, y);
    this.view.addChild(bar);

    const pct = new Text({
      text: "",
      style: { fill: 0xcfd6e6, fontSize: 28, fontFamily: FONT_FAMILY },
    });
    pct.anchor.set(0, 0.5);
    pct.position.set(BAR_WIDTH / 2 + 110, y);
    this.view.addChild(pct);

    const redraw = (): void => {
      const v = vol.get();
      bar
        .clear()
        .rect(-BAR_WIDTH / 2, -BAR_HEIGHT / 2, BAR_WIDTH, BAR_HEIGHT)
        .fill({ color: 0x000000, alpha: 0.45 })
        .rect(-BAR_WIDTH / 2, -BAR_HEIGHT / 2, BAR_WIDTH * v, BAR_HEIGHT)
        .fill({ color: 0x57d957 });
      pct.text = `${Math.round(v * 100)}%`;
    };

    const step = (dir: number) => (): void => {
      // Round to a clean step so 0.1 increments don't drift on float error.
      const next = Math.round((vol.get() + dir * AUDIO.volumeStep) * 100) / 100;
      vol.set(next);
      redraw();
    };

    const minus = makeButton("−", step(-1));
    minus.position.set(-BAR_WIDTH / 2 - 50, y);
    this.view.addChild(minus);

    const plus = makeButton("+", step(1));
    plus.position.set(BAR_WIDTH / 2 + 50, y);
    this.view.addChild(plus);

    redraw();
  }
}
