import { describe, expect, it } from "vitest";
import { UPGRADE_DEFS } from "./upgrades";
import type { Player } from "./Player";
import { UPGRADES } from "../config";

/**
 * Engine upgrade tests. upgrades.ts imports Player only in type position, so
 * this file pulls in no PixiJS — a plain object stub stands in for the player,
 * the same trick WaveManager.test.ts uses for EnemyPool.
 */

const engine = UPGRADE_DEFS.find((d) => d.id === "moveSpeed")!;

/** Only the fields the Engine upgrade touches. */
interface EngineStub {
  sensitivityMult: number;
  followResponse: number;
}

const applyEngine = (levels: number): EngineStub => {
  const stub: EngineStub = { sensitivityMult: 1, followResponse: 20 };
  for (let i = 0; i < levels; i++) engine.apply(stub as unknown as Player);
  return stub;
};

describe("Engine upgrade", () => {
  it("multiplies sensitivity rather than adding to it", () => {
    // Multiplicative is what keeps the upgrade's relative power identical for
    // every player, whatever sensitivity setting they chose.
    expect(applyEngine(1).sensitivityMult).toBeCloseTo(1.125, 10);
    expect(applyEngine(2).sensitivityMult).toBeCloseTo(1.25, 10);
  });

  it("reaches exactly x2.25 at its cap, preserving the pre-setting ratio", () => {
    // 1.8 / 0.8 was the old maxed ratio when sensitivity was a fixed constant.
    expect(applyEngine(UPGRADES.moveSpeed.cap).sensitivityMult).toBeCloseTo(
      2.25,
      10,
    );
    expect(
      1 + UPGRADES.moveSpeed.cap * UPGRADES.moveSpeed.sensitivityFactor,
    ).toBeCloseTo(2.25, 10);
  });

  it("still raises follow response additively", () => {
    expect(applyEngine(UPGRADES.moveSpeed.cap).followResponse).toBe(
      20 + UPGRADES.moveSpeed.cap * UPGRADES.moveSpeed.responseAmount,
    );
  });
});
