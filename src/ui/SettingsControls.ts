import { Container, Text } from "pixi.js";
import { AUDIO, FONT_FAMILY, PLAYER } from "../config";
import { makeStepperRow } from "./StepperRow";
import {
  getMusicVolume,
  getSfxVolume,
  setMusicVolume,
  setSfxVolume,
} from "../game/audio";
import { getSensitivity, setSensitivity } from "../game/settings";
import { getRawInputGranted } from "../game/input";

const ROW_GAP = 76;

/**
 * The player settings block: Music, SFX, and Mouse Sensitivity rows. Volumes
 * route through game/audio (which applies them live); sensitivity routes
 * through game/settings and is picked up by GameScene on the next resume.
 *
 * Position `view` by the top row's center; rows lay out downward from the
 * container origin, so the block spans roughly [0 .. 2 * ROW_GAP] in Y. Once
 * the raw-input status is known (see game/input), the block gains a fourth
 * line below the Sensitivity row disclosing it.
 */
export class SettingsControls {
  readonly view = new Container();

  constructor() {
    const pct = (v: number): string => `${Math.round(v * 100)}%`;

    this.addRow(
      makeStepperRow({
        label: "Music",
        access: { get: getMusicVolume, set: setMusicVolume },
        step: AUDIO.volumeStep,
        format: pct,
        fill: (v) => v,
      }),
      0,
    );

    this.addRow(
      makeStepperRow({
        label: "SFX",
        access: { get: getSfxVolume, set: setSfxVolume },
        step: AUDIO.volumeStep,
        format: pct,
        fill: (v) => v,
      }),
      ROW_GAP,
    );

    this.addRow(
      makeStepperRow({
        label: "Sensitivity",
        access: { get: getSensitivity, set: setSensitivity },
        step: PLAYER.sensitivityStep,
        // Shown relative to the default: "100%" is meaningful to a player in a
        // way that the raw 0.8 is not.
        format: (v) => `${Math.round((v / PLAYER.sensitivityDefault) * 100)}%`,
        fill: (v) =>
          (v - PLAYER.sensitivityMin) /
          (PLAYER.sensitivityMax - PLAYER.sensitivityMin),
      }),
      ROW_GAP * 2,
    );

    // Only shown once we know — in the Menu before the first Play, we don't.
    const raw = getRawInputGranted();
    if (raw !== undefined) {
      const note = new Text({
        text: raw
          ? "Raw input: on"
          : "Raw input: off (OS mouse acceleration active)",
        style: { fill: 0x9aa0a6, fontSize: 22, fontFamily: FONT_FAMILY },
      });
      note.anchor.set(0.5);
      note.position.set(0, ROW_GAP * 2 + 42);
      this.view.addChild(note);
    }
  }

  private addRow(row: Container, y: number): void {
    row.position.set(0, y);
    this.view.addChild(row);
  }
}
