import { Container } from "pixi.js";
import { AUDIO, PLAYER } from "../config";
import { makeStepperRow } from "./StepperRow";
import {
  getMusicVolume,
  getSfxVolume,
  setMusicVolume,
  setSfxVolume,
} from "../game/audio";
import { getSensitivity, setSensitivity } from "../game/settings";

const ROW_GAP = 76;

/**
 * The player settings block: Music, SFX, and Mouse Sensitivity rows. Volumes
 * route through game/audio (which applies them live); sensitivity routes
 * through game/settings and is picked up by GameScene on the next resume.
 *
 * Position `view` by the top row's center; rows lay out downward from the
 * container origin, so the block spans roughly [0 .. 2 * ROW_GAP] in Y.
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
  }

  private addRow(row: Container, y: number): void {
    row.position.set(0, y);
    this.view.addChild(row);
  }
}
