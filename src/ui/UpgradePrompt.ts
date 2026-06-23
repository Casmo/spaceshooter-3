import { Container, Graphics, Text } from "pixi.js";
import {
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
  RARITY_COLORS,
  type Rarity,
} from "../config";
import type { UpgradeChoice, UpgradeDef } from "../game/upgrades";

const RARITY_LABEL: Record<Rarity, string> = {
  common: "COMMON",
  uncommon: "UNCOMMON",
  rare: "RARE",
  veryRare: "VERY RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};

const CARD_W = 380;
const CARD_H = 460;
const GAP = 60;

/**
 * The level-up overlay: a dimmed backdrop and three rarity-colored upgrade
 * cards. Clicking a card invokes onPick with its upgrade.
 */
export class UpgradePrompt {
  readonly view = new Container();

  constructor(choices: UpgradeChoice[], onPick: (def: UpgradeDef) => void) {
    const backdrop = new Graphics()
      .rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT)
      .fill({ color: 0x000010, alpha: 0.78 });
    backdrop.eventMode = "static"; // swallow clicks behind the cards
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
      this.view.addChild(this.makeCard(choice, cx, cardY, onPick));
    });
  }

  private makeCard(
    choice: UpgradeChoice,
    x: number,
    y: number,
    onPick: (def: UpgradeDef) => void,
  ): Container {
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

    card.eventMode = "static";
    card.cursor = "pointer";
    card.on("pointerover", () => (bg.alpha = 0.8));
    card.on("pointerout", () => (bg.alpha = 1));
    card.on("pointertap", () => onPick(def));

    return card;
  }
}
