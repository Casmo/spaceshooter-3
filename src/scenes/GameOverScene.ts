import { Container, Text } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, FONT_FAMILY } from "../config";
import { type Scene, SceneManager } from "../core/SceneManager";
import { Starfield } from "../game/Starfield";
import { makeButton } from "../ui/Button";
import { type RunStats, type RunRecord } from "../game/Stats";
import { GameScene } from "./GameScene";
import { MenuScene } from "./MenuScene";

/** Game-over screen: this run's stats vs. persisted bests, and what to do next. */
export class GameOverScene implements Scene {
  readonly view = new Container();
  private readonly starfield = new Starfield();

  constructor(
    private readonly manager: SceneManager,
    run: RunStats,
    record: RunRecord,
  ) {
    this.view.addChild(this.starfield.view);

    const title = new Text({
      text: "GAME OVER",
      style: {
        fill: 0xff5555,
        fontSize: 88,
        fontWeight: "bold",
        fontFamily: FONT_FAMILY,
      },
    });
    title.anchor.set(0.5);
    title.position.set(VIRTUAL_WIDTH / 2, 200);
    this.view.addChild(title);

    this.addStats(run, record);

    const again = makeButton("Play Again", () =>
      this.manager.changeScene(new GameScene(this.manager)),
    );
    again.position.set(VIRTUAL_WIDTH / 2 - 180, VIRTUAL_HEIGHT - 160);
    this.view.addChild(again);

    const menu = makeButton("Main Menu", () =>
      this.manager.changeScene(new MenuScene(this.manager)),
    );
    menu.position.set(VIRTUAL_WIDTH / 2 + 180, VIRTUAL_HEIGHT - 160);
    this.view.addChild(menu);
  }

  private addStats(run: RunStats, record: RunRecord): void {
    const { stats, newBestScore, newBestWave } = record;
    const rows: [string, string, boolean][] = [
      ["Score", run.score.toLocaleString(), newBestScore],
      ["Wave", `${run.wave}`, newBestWave],
      ["Level", `${run.level}`, false],
      ["Kills", `${run.kills}`, false],
      ["Bullets fired", `${run.bulletsFired}`, false],
      ["Time survived", formatTime(run.timeSurvived), false],
    ];

    const startY = 320;
    const lineH = 58;
    rows.forEach(([k, v, isBest], i) => {
      const y = startY + i * lineH;
      const key = new Text({
        text: k,
        style: { fill: 0xaab2c2, fontSize: 34, fontFamily: FONT_FAMILY },
      });
      key.anchor.set(1, 0.5);
      key.position.set(VIRTUAL_WIDTH / 2 - 30, y);

      const val = new Text({
        text: isBest ? `${v}   ★ NEW BEST` : v,
        style: {
          fill: isBest ? 0xffd24a : 0xffffff,
          fontSize: 34,
          fontWeight: "bold",
          fontFamily: FONT_FAMILY,
        },
      });
      val.anchor.set(0, 0.5);
      val.position.set(VIRTUAL_WIDTH / 2 + 30, y);

      this.view.addChild(key, val);
    });

    const bests = new Text({
      text: `Best score ${stats.bestScore.toLocaleString()}   ·   Best wave ${stats.bestWave}   ·   Runs ${stats.runsPlayed}`,
      style: { fill: 0x8f97a8, fontSize: 26, fontFamily: FONT_FAMILY },
    });
    bests.anchor.set(0.5);
    bests.position.set(VIRTUAL_WIDTH / 2, startY + rows.length * lineH + 30);
    this.view.addChild(bests);
  }

  update(dt: number): void {
    this.starfield.update(dt);
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
