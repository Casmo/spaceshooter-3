import { Container, Graphics, Text } from "pixi.js";
import { FONT_FAMILY } from "../config";
import { makeButton } from "./Button";

const BAR_WIDTH = 200;
const BAR_HEIGHT = 16;

/** Read/write pair backing one row. `set` returns the stored (clamped) value. */
export interface StepperAccess {
  get: () => number;
  set: (v: number) => number;
}

export interface StepperRowOptions {
  label: string;
  access: StepperAccess;
  /** How much one −/+ press changes the value by. */
  step: number;
  /** The value text shown to the right of the bar, e.g. "80%". */
  format: (v: number) => string;
  /** Fraction of the bar to fill for a given value, 0..1. */
  fill: (v: number) => number;
}

/**
 * One labelled setting row: name, filled bar, value text, and stepped −/+
 * buttons. Stepped rather than a drag-slider because these render inside the
 * Pause overlay under pointer lock, where a drag cannot work (ADR-0014).
 * Position the returned container by the row's center.
 */
export function makeStepperRow(opts: StepperRowOptions): Container {
  const view = new Container();

  const name = new Text({
    text: opts.label,
    style: { fill: 0xffffff, fontSize: 34, fontFamily: FONT_FAMILY },
  });
  name.anchor.set(1, 0.5);
  name.position.set(-200, 0);
  view.addChild(name);

  const bar = new Graphics();
  view.addChild(bar);

  const value = new Text({
    text: "",
    style: { fill: 0xcfd6e6, fontSize: 28, fontFamily: FONT_FAMILY },
  });
  value.anchor.set(0, 0.5);
  value.position.set(BAR_WIDTH / 2 + 110, 0);
  view.addChild(value);

  const redraw = (): void => {
    const v = opts.access.get();
    bar
      .clear()
      .rect(-BAR_WIDTH / 2, -BAR_HEIGHT / 2, BAR_WIDTH, BAR_HEIGHT)
      .fill({ color: 0x000000, alpha: 0.45 })
      .rect(
        -BAR_WIDTH / 2,
        -BAR_HEIGHT / 2,
        BAR_WIDTH * opts.fill(v),
        BAR_HEIGHT,
      )
      .fill({ color: 0x57d957 });
    value.text = opts.format(v);
  };

  const step = (dir: number) => (): void => {
    // Round to a clean step so fractional increments don't drift on float error.
    const next = Math.round((opts.access.get() + dir * opts.step) * 100) / 100;
    opts.access.set(next);
    redraw();
  };

  const minus = makeButton("−", step(-1));
  minus.position.set(-BAR_WIDTH / 2 - 50, 0);
  view.addChild(minus);

  const plus = makeButton("+", step(1));
  plus.position.set(BAR_WIDTH / 2 + 50, 0);
  view.addChild(plus);

  redraw();
  return view;
}
