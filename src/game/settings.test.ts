import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYER } from "../config";

/**
 * Persistence tests for player settings. settings.ts reads storage once at
 * module load, so each case installs a fresh localStorage stand-in and then
 * re-imports the module to get fresh state. Vitest runs in the node
 * environment, where localStorage does not exist at all — the last test pins
 * that the module degrades to defaults there rather than throwing.
 */

const KEY = "spaceshooter3.settings.v1";

/** Install a localStorage stand-in (optionally pre-seeded) and re-import. */
async function freshSettings(seed?: string) {
  const store = new Map<string, string>();
  if (seed !== undefined) store.set(KEY, seed);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  });
  vi.resetModules();
  return { settings: await import("./settings"), store };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("sensitivity setting", () => {
  it("defaults to the configured default", async () => {
    const { settings } = await freshSettings();
    expect(settings.getSensitivity()).toBe(PLAYER.sensitivityDefault);
  });

  it("round-trips through storage", async () => {
    const { settings, store } = await freshSettings();
    settings.setSensitivity(1.4);
    expect(settings.getSensitivity()).toBe(1.4);
    expect(JSON.parse(store.get(KEY)!).sensitivity).toBe(1.4);
  });

  it("clamps values outside the slider range", async () => {
    const { settings } = await freshSettings();
    expect(settings.setSensitivity(99)).toBe(PLAYER.sensitivityMax);
    expect(settings.setSensitivity(-5)).toBe(PLAYER.sensitivityMin);
  });

  it("clamps an out-of-range value already in storage", async () => {
    const { settings } = await freshSettings(
      JSON.stringify({ version: 1, sensitivity: 999 }),
    );
    expect(settings.getSensitivity()).toBe(PLAYER.sensitivityMax);
  });

  it("takes the default from a blob saved before the field existed", async () => {
    // No VERSION bump was needed; the partial merge handles the upgrade.
    const { settings } = await freshSettings(
      JSON.stringify({ version: 1, musicVolume: 0.7, sfxVolume: 0.2 }),
    );
    expect(settings.getSensitivity()).toBe(PLAYER.sensitivityDefault);
    expect(settings.getMusicVolume()).toBe(0.7);
  });

  it("falls back to defaults on corrupt storage", async () => {
    const { settings } = await freshSettings("{not json");
    expect(settings.getSensitivity()).toBe(PLAYER.sensitivityDefault);
  });

  it("works with no localStorage at all", async () => {
    vi.unstubAllGlobals();
    vi.resetModules();
    const settings = await import("./settings");
    expect(settings.getSensitivity()).toBe(PLAYER.sensitivityDefault);
  });
});
