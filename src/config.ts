/**
 * Central tuning config — the single home for all tunable game values.
 * Later issues (waves, upgrades, modifiers, balance) extend this file.
 */

/** Fixed virtual resolution. The world is authored at this size and scaled to
 *  fit the window with letterboxing (see docs/adr/0002). */
export const VIRTUAL_WIDTH = 1920;
export const VIRTUAL_HEIGHT = 1080;

/** Parallax starfield scroll speeds, in virtual px/second (top -> bottom). */
export const STARFIELD = {
  /** Far background nebula — slowest. */
  bgSpeed: 8,
  /** Mid star layer. */
  starsASpeed: 28,
  /** Near star layer — fastest, strongest parallax. */
  starsBSpeed: 55,
} as const;
