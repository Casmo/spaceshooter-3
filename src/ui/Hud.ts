import { Container, Graphics, Sprite, Text } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, FONT_FAMILY } from "../config";
import { getTexture } from "../assets";

/** Live values the HUD renders each frame. */
export interface HudState {
  score: number;
  bestScore: number;
  wave: number;
  lives: number;
  hp: number;
  maxHp: number;
  level: number;
  xpProgress: number;
}

const RIGHT = VIRTUAL_WIDTH - 24;
const LIVES_Y = 40;
const LIFE_ICON = 44;
const LIFE_GAP = 10;
const HP_BAR = { w: 360, h: 26, y: 78 };
const XP_BAR_H = 14;

/**
 * The heads-up display: score + best (top-left), wave (top-center), lives as
 * ship icons (top-right) with the HP bar beneath them and the level in front of
 * it, and a full-width XP bar at the very bottom. Overlays the playfield.
 */
export class Hud {
  readonly view = new Container();

  private readonly score: Text;
  private readonly best: Text;
  private readonly wave: Text;
  private readonly livesIcons = new Container();
  private readonly level: Text;
  private readonly hpBar = new Graphics();
  private readonly xpBar = new Graphics();

  private shownLives = -1;

  constructor() {
    this.score = label(0xffffff, 34, "bold");
    this.score.position.set(30, 22);
    this.best = label(0xb8c0d0, 22);
    this.best.position.set(30, 66);

    this.wave = label(0xffffff, 30, "bold");
    this.wave.anchor.set(0.5, 0);
    this.wave.position.set(VIRTUAL_WIDTH / 2, 24);

    // Level sits in front of (left of) the HP bar, vertically centered.
    this.level = label(0xcfe0ff, 24, "bold");
    this.level.anchor.set(1, 0.5);
    this.level.position.set(RIGHT - HP_BAR.w - 16, HP_BAR.y + HP_BAR.h / 2);

    this.view.addChild(
      this.score,
      this.best,
      this.wave,
      this.livesIcons,
      this.level,
      this.hpBar,
      this.xpBar,
    );
  }

  update(s: HudState): void {
    this.score.text = `${s.score.toLocaleString()}`;
    this.best.text = `Best ${s.bestScore.toLocaleString()}`;
    this.wave.text = `Wave ${s.wave}`;
    this.level.text = `Lv ${s.level}`;

    if (s.lives !== this.shownLives) {
      this.rebuildLives(s.lives);
      this.shownLives = s.lives;
    }

    this.drawHpBar(Math.max(0, s.hp), s.maxHp);
    this.drawXpBar(Math.max(0, Math.min(1, s.xpProgress)));
  }

  /** One ship icon per life, right-aligned in the top-right corner. */
  private rebuildLives(lives: number): void {
    this.livesIcons.removeChildren();
    let x = RIGHT;
    for (let i = 0; i < lives; i++) {
      const icon = new Sprite(getTexture("ship"));
      icon.anchor.set(1, 0.5);
      icon.width = LIFE_ICON;
      icon.scale.y = icon.scale.x; // keep aspect
      icon.position.set(x, LIVES_Y);
      this.livesIcons.addChild(icon);
      x -= LIFE_ICON + LIFE_GAP;
    }
  }

  private drawHpBar(hp: number, maxHp: number): void {
    const x = RIGHT - HP_BAR.w;
    const { y, w, h } = HP_BAR;
    const frac = maxHp > 0 ? hp / maxHp : 0;
    const color = frac > 0.5 ? 0x5fdc6a : frac > 0.25 ? 0xe6c34a : 0xe05a4a;
    this.hpBar
      .clear()
      .roundRect(x, y, w, h, 6)
      .fill({ color: 0x000000, alpha: 0.45 })
      .roundRect(x, y, w * frac, h, 6)
      .fill(color)
      .roundRect(x, y, w, h, 6)
      .stroke({ color: 0xffffff, width: 2, alpha: 0.6 });
  }

  private drawXpBar(progress: number): void {
    const y = VIRTUAL_HEIGHT - XP_BAR_H;
    this.xpBar
      .clear()
      .rect(0, y, VIRTUAL_WIDTH, XP_BAR_H)
      .fill({ color: 0x000000, alpha: 0.5 })
      .rect(0, y, VIRTUAL_WIDTH * progress, XP_BAR_H)
      .fill(0x4aa3ff);
  }
}

function label(color: number, size: number, weight?: "bold"): Text {
  return new Text({
    text: "",
    style: {
      fill: color,
      fontSize: size,
      fontFamily: FONT_FAMILY,
      fontWeight: weight ?? "normal",
    },
  });
}
