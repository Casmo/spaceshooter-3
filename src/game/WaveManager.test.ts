import { describe, expect, it } from "vitest";
import { WaveManager } from "./WaveManager";
import type { EnemyPool } from "./EnemyPool";
import { LODE, WAVES, lodeBurstCount } from "../config";

/**
 * Wave-composition tests, driven through WaveManager's public entry point
 * (`update`) against a stub enemy pool that just records what it was asked to
 * spawn. WaveManager imports EnemyPool as a type only and otherwise touches only
 * the central config, so no PixiJS, textures, or canvas are needed here.
 *
 * These assert the observable outcome — WHAT got spawned, in WHICH wave, and HOW
 * MANY times — never how the queue is composed internally.
 */

interface Spawn {
  wave: number;
  kind: string;
}

/** The capstone kinds, which (like the Lode) ride on top of the enemy budget.
 *  Both mini-boss variants route through spawnMiniBoss, so both record as
 *  "miniboss" — which is the observable outcome these tests care about. */
const CAPSTONES = ["miniboss", "boss"];

/**
 * Play the game forward through wave `upTo`, returning every spawn in order.
 * The stub pool reports an always-empty field, so each wave clears the moment
 * its queue drains and the next breather begins immediately.
 */
function runWaves(upTo: number): Spawn[] {
  const spawns: Spawn[] = [];
  let manager: WaveManager | null = null;
  const record = (kind: string) => (): void => {
    spawns.push({ wave: manager!.currentWave, kind });
  };
  const pool = {
    liveCount: 0,
    spawnSwarmer: record("swarmer"),
    spawnGunner: record("gunner"),
    spawnWarden: record("warden"),
    spawnAsteroid: record("asteroid"),
    spawnStation: record("station"),
    spawnMiniBoss: record("miniboss"),
    spawnBoss: record("boss"),
    spawnMine: record("mine"),
    spawnBomber: record("bomber"),
    spawnLode: record("lode"),
  };
  manager = new WaveManager(pool as unknown as EnemyPool);

  // Tick at a fixed 60fps until wave `upTo` has been cleared. The step bound is
  // only a runaway guard — reaching wave 30 takes well under 30k ticks.
  const dt = 1 / 60;
  for (let step = 0; step < 100_000; step++) {
    manager.update(dt);
    if (manager.currentWave >= upTo && manager.inBreather) break;
  }
  return spawns;
}

/** The spawns belonging to one wave, in spawn order. */
function waveSpawns(spawns: Spawn[], wave: number): string[] {
  return spawns.filter((s) => s.wave === wave).map((s) => s.kind);
}

/** The enemy budget a wave of number `n` draws, per the config curve. */
function budgetFor(n: number): number {
  return WAVES.baseBudget + (n - 1) * WAVES.budgetPerWave;
}

describe("Lode wave scheduling", () => {
  it("spawns no Lode in any wave before the start wave", () => {
    const spawns = runWaves(LODE.startWave - 1);
    expect(spawns.filter((s) => s.kind === "lode")).toEqual([]);
  });

  it("spawns a Lode on the cadence waves and in no wave between them", () => {
    const spawns = runWaves(30);
    const lodeWaves = spawns
      .filter((s) => s.kind === "lode")
      .map((s) => s.wave);
    expect(lodeWaves).toEqual([15, 18, 21, 24, 27, 30]);
  });

  it("spawns exactly one Lode per Lode wave — never zero, never two", () => {
    const spawns = runWaves(24);
    for (const wave of [15, 18, 21, 24]) {
      const count = waveSpawns(spawns, wave).filter((k) => k === "lode").length;
      expect(count).toBe(1);
    }
  });

  it("splices the Lode mid-wave, with regular adds both before and after", () => {
    const kinds = waveSpawns(runWaves(15), 15);
    const at = kinds.indexOf("lode");
    const isAdd = (k: string): boolean =>
      k !== "lode" && !CAPSTONES.includes(k);
    expect(kinds.slice(0, at).some(isAdd)).toBe(true);
    expect(kinds.slice(at + 1).some(isAdd)).toBe(true);
  });

  it("splices the Lode at roughly the middle of the wave's adds", () => {
    const kinds = waveSpawns(runWaves(15), 15);
    const at = kinds.indexOf("lode");
    // Around budget * spawnFraction, give or take the capstone spliced before it.
    const expected = budgetFor(15) * LODE.spawnFraction;
    expect(Math.abs(at - expected)).toBeLessThanOrEqual(2);
  });

  it("still spawns the Lode on a wave that also carries a mini-boss", () => {
    // Wave 27 is a Lode wave in the relentless endgame — a mini-boss every wave.
    const kinds = waveSpawns(runWaves(27), 27);
    expect(kinds).toContain("lode");
    expect(kinds).toContain("miniboss");
  });

  it("still spawns the Lode on a Boss wave", () => {
    const kinds = waveSpawns(runWaves(30), 30);
    expect(kinds).toContain("lode");
    expect(kinds).toContain("boss");
  });

  it("adds the Lode on top of the budget rather than consuming an enemy slot", () => {
    const spawns = runWaves(16);
    const adds = (wave: number): number =>
      waveSpawns(spawns, wave).filter(
        (k) => k !== "lode" && !CAPSTONES.includes(k),
      ).length;
    // A Lode wave draws exactly the same number of regular enemies as the
    // non-Lode wave that follows it draws for its own number.
    expect(adds(15)).toBe(budgetFor(15));
    expect(adds(16)).toBe(budgetFor(16));
  });
});

describe("lodeBurstCount", () => {
  it("pays the base count at the start wave", () => {
    expect(lodeBurstCount(LODE.startWave)).toBe(LODE.burstCountBase);
  });

  it("grows by one Star per cadence step", () => {
    expect(lodeBurstCount(30)).toBe(15);
    expect(lodeBurstCount(45)).toBe(20);
  });

  it("never pays less than the base count", () => {
    expect(lodeBurstCount(1)).toBe(LODE.burstCountBase);
  });
});
