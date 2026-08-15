/**
 * Pointer-lock input capability, recorded the first time the game captures the
 * mouse.
 *
 * We request `unadjustedMovement: true` to get raw, un-accelerated deltas
 * (ADR-0006). Chromium grants it; Firefox and Safari reject and hand us
 * OS-accelerated motion instead. That acceleration cannot be removed or even
 * measured from JavaScript, so rather than hide it we record the fact and let
 * the settings UI say so — otherwise a player has no way to understand why
 * aiming feels different in another browser.
 *
 * `undefined` until the first lock request settles: in the Menu, before the
 * first Play, the answer is genuinely not yet known.
 */
let granted: boolean | undefined;

export function setRawInputGranted(value: boolean): void {
  granted = value;
}

export function getRawInputGranted(): boolean | undefined {
  return granted;
}
