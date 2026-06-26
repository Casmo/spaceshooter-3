import { Container, Graphics, Sprite, Text } from "pixi.js";
import {
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
  RARITY_COLORS,
  type Rarity,
} from "../config";
import { getTexture } from "../assets";
import type { UpgradeChoice, UpgradeDef } from "../game/upgrades";

const RARITY_LABEL: Record<Rarity, string> = {
  common: "COMMON",
  uncommon: "UNCOMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};

const CARD_W = 380;
const CARD_H = 460;
const GAP = 60;
/** Pixel-art pack convention: draw the 32px cursor at 2x so it reads on-field. */
const CURSOR_SCALE = 2;

/** One card's hit rect, the upgrade it grants, and its bg (for hover tinting). */
interface Card {
  def: UpgradeDef;
  bg: Graphics;
  x: number;
  y: number;
}

/**
 * The level-up overlay: a dimmed backdrop and three rarity-colored upgrade
 * cards. The pointer stays locked here (ADR-0008), so this owns a Menu Cursor
 * sprite and hit-tests it against the cards itself — Pixi's pointer coordinates
 * are frozen under the lock. GameScene feeds it motion via moveCursor() and a
 * left-click via press().
 */
export class UpgradePrompt {
  readonly view = new Container();
  private readonly onPick: (def: UpgradeDef) => void;
  private readonly cards: Card[] = [];
  private readonly cursor: Sprite;
  private hovered?: Card;

  constructor(choices: UpgradeChoice[], onPick: (def: UpgradeDef) => void) {
    this.onPick = onPick;
    const backdrop = new Graphics()
      .rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT)
      .fill({ color: 0x000010, alpha: 0.78 });
    this.view.addChild(backdrop);

    const title = new Text({
      text: "LEVEL UP — choose an upgrade",
      style: {
        fill: 0xffffff,
        fontSize: 52,
        fontWeight: "bold",
        fontFamily: "Arial",
      },
    });
    title.anchor.set(0.5);
    title.position.set(VIRTUAL_WIDTH / 2, 220);
    this.view.addChild(title);

    const totalW = choices.length * CARD_W + (choices.length - 1) * GAP;
    const startX = (VIRTUAL_WIDTH - totalW) / 2;
    const cardY = VIRTUAL_HEIGHT / 2 - CARD_H / 2 + 40;

    choices.forEach((choice, i) => {
      const cx = startX + i * (CARD_W + GAP);
      this.view.addChild(this.makeCard(choice, cx, cardY));
    });

    // Menu Cursor sits above the cards; tip is the top-left pixel, so anchor at
    // (0,0) makes the click point the visual tip (ADR-0008). Start centered and
    // resolve the initial hover so a still mouse still highlights a card.
    this.cursor = new Sprite(getTexture("cursor"));
    this.cursor.anchor.set(0, 0);
    this.cursor.scale.set(CURSOR_SCALE);
    this.view.addChild(this.cursor);
    this.moveCursor(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
  }

  /** Place the Menu Cursor at a virtual-space point and refresh the hover. */
  moveCursor(x: number, y: number): void {
    this.cursor.position.set(x, y);
    const hit = this.cardAt(x, y);
    if (hit === this.hovered) return;
    if (this.hovered) this.hovered.bg.alpha = 1;
    this.hovered = hit;
    if (this.hovered) this.hovered.bg.alpha = 0.8;
  }

  /** Left-click: pick the hovered card, if the cursor is over one. */
  press(): void {
    if (this.hovered) this.onPick(this.hovered.def);
  }

  /** The card whose rect contains the cursor tip, or undefined over the gaps. */
  private cardAt(x: number, y: number): Card | undefined {
    return this.cards.find(
      (c) => x >= c.x && x <= c.x + CARD_W && y >= c.y && y <= c.y + CARD_H,
    );
  }

  private makeCard(choice: UpgradeChoice, x: number, y: number): Container {
    const { def, nextLevel } = choice;
    const color = RARITY_COLORS[def.rarity];
    const card = new Container();
    card.position.set(x, y);

    const bg = new Graphics()
      .roundRect(0, 0, CARD_W, CARD_H, 18)
      .fill(0x14141f)
      .stroke({ color, width: 6 });
    card.addChild(bg);

    const rarity = new Text({
      text: RARITY_LABEL[def.rarity],
      style: {
        fill: color,
        fontSize: 26,
        fontWeight: "bold",
        fontFamily: "Arial",
      },
    });
    rarity.anchor.set(0.5);
    rarity.position.set(CARD_W / 2, 48);
    card.addChild(rarity);

    const name = new Text({
      text: def.name,
      style: {
        fill: 0xffffff,
        fontSize: 40,
        fontWeight: "bold",
        fontFamily: "Arial",
      },
    });
    name.anchor.set(0.5);
    name.position.set(CARD_W / 2, 130);
    card.addChild(name);

    const level = new Text({
      text: `Level ${nextLevel}`,
      style: { fill: 0xcfcfe0, fontSize: 30, fontFamily: "Arial" },
    });
    level.anchor.set(0.5);
    level.position.set(CARD_W / 2, 190);
    card.addChild(level);

    const desc = new Text({
      text: def.description,
      style: {
        fill: 0xe6e6f0,
        fontSize: 28,
        fontFamily: "Arial",
        align: "center",
        wordWrap: true,
        wordWrapWidth: CARD_W - 60,
      },
    });
    desc.anchor.set(0.5, 0);
    desc.position.set(CARD_W / 2, 250);
    card.addChild(desc);

    // Hover/click is hit-tested manually against the Menu Cursor (the pointer is
    // locked, so Pixi's coords are frozen) — see moveCursor/press.
    this.cards.push({ def, bg, x, y });

    return card;
  }
}
