import { Text } from "pixi.js";

/**
 * A minimal text button. Returns a Text (a Container) with anchor centered, so
 * callers position it by its center. Hover dims it slightly.
 */
export function makeButton(label: string, onClick: () => void): Text {
  const text = new Text({
    text: label,
    style: { fill: 0xffffff, fontSize: 48, fontFamily: "Arial" },
  });
  text.anchor.set(0.5);
  text.eventMode = "static";
  text.cursor = "pointer";
  text.on("pointertap", onClick);
  text.on("pointerover", () => (text.alpha = 0.7));
  text.on("pointerout", () => (text.alpha = 1));
  return text;
}
