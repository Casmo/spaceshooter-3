import { WAVES, MINE, BOSS } from "../config";
import { EnemyPool, type WaveMods } from "./EnemyPool";

type SpawnKind =
  | "swarmer"
  | "gunner"
  | "asteroid"
  | "miniboss"
  | "boss"
  | "mine";

/**
 * Drives discrete, escalating waves. Each wave spawns a budget of enemies over
 * time; once the budget is spent and the field is clear, a ~3s breather plays
 * (with a "Wave N" banner) before the next, harder wave begins. A mini-boss
 * caps every Nth wave. Difficulty scales via count, stats, and asteroid splits.
 */
export class WaveManager {
  private waveNumber = 0;
  private phase: "breather" | "spawning" = "breather";
  private timer: number = WAVES.breatherSeconds;
  private queue: SpawnKind[] = [];
  private spawnInterval: number = WAVES.baseSpawnInterval;
  private mods: WaveMods = { hpMult: 1, speedMult: 1, splitBonus: 0 };
  /** How many mini-bosses have appeared (for HP scaling). */
  private miniBossAppearances = 0;
  /** How many bosses have appeared (for HP scaling). */
  private bossAppearances = 0;

  /** @param onWaveCleared called with the wave number when a wave is cleared. */
  constructor(
    private readonly enemies: EnemyPool,
    private readonly onWaveCleared?: (wave: number) => void,
  ) {}

  /** Current wave (0 before the first wave begins). */
  get currentWave(): number {
    return this.waveNumber;
  }
  get inBreather(): boolean {
    return this.phase === "breather";
  }
  /** Text for the breather banner ("WAVE N" for the wave about to start). */
  get bannerText(): string {
    return `WAVE ${this.waveNumber + 1}`;
  }

  update(dt: number): void {
    if (this.phase === "breather") {
      this.timer -= dt;
      if (this.timer <= 0) this.beginWave();
      return;
    }
    // Spawning phase.
    if (this.queue.length > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.spawnNext();
        this.timer = this.spawnInterval;
      }
    } else if (this.enemies.liveCount === 0) {
      this.onWaveCleared?.(this.waveNumber);
      this.phase = "breather";
      this.timer = WAVES.breatherSeconds;
    }
  }

  private beginWave(): void {
    this.waveNumber++;
    const n = this.waveNumber;
    const earlyWaves = Math.min(n - 1, WAVES.hpRampWave - 1);
    const lateWaves = Math.max(0, n - WAVES.hpRampWave);
    this.mods = {
      hpMult:
        1 +
        earlyWaves * WAVES.hpMultPerWave +
        lateWaves * WAVES.hpMultPerWaveLate,
      speedMult:
        1 +
        Math.floor((n - 1) / WAVES.speedStepEveryWaves) * WAVES.speedStepAmount,
      splitBonus: Math.floor((n - 1) / WAVES.splitBonusEveryWaves),
    };
    this.spawnInterval = Math.max(
      WAVES.minSpawnInterval,
      WAVES.baseSpawnInterval - (n - 1) * WAVES.spawnIntervalDecayPerWave,
    );
    this.queue = this.composeWave(n);
    this.phase = "spawning";
    this.timer = 0;
  }

  private composeWave(n: number): SpawnKind[] {
    const queue: SpawnKind[] = [];
    // Milestone capstones: a Boss caps every bossEvery wave (replacing the
    // mini-boss there); a mini-boss caps the remaining every-miniBossEvery waves.
    // This is the single place to change which capstone a milestone spawns.
    if (n % WAVES.bossEvery === 0) {
      queue.push("boss");
      for (let i = 0; i < BOSS.escortCount; i++) queue.push("swarmer");
      return queue;
    }
    if (n % WAVES.miniBossEvery === 0) {
      queue.push("miniboss");
      for (let i = 0; i < WAVES.miniBossEscort; i++) queue.push("swarmer");
      return queue;
    }
    const budget = WAVES.baseBudget + (n - 1) * WAVES.budgetPerWave;
    for (let i = 0; i < budget; i++) {
      queue.push(this.pickKind(n));
    }
    return queue;
  }

  /** Weighted enemy pick; gunners enter wave 2+, asteroids wave 3+, mines wave 6+.
   *  Mines take a flat share off the top; the rest keep the original 25/25/50
   *  split (drawn from a second roll) so pre-mine waves are unchanged. */
  private pickKind(n: number): SpawnKind {
    if (n >= MINE.startWave && Math.random() < MINE.spawnChance) return "mine";
    const r = Math.random();
    if (n >= 3 && r < 0.25) return "asteroid";
    if (n >= 2 && r < 0.5) return "gunner";
    return "swarmer";
  }

  private spawnNext(): void {
    const kind = this.queue.shift();
    switch (kind) {
      case "swarmer":
        this.enemies.spawnSwarmer(this.mods);
        break;
      case "gunner":
        this.enemies.spawnGunner(this.mods);
        break;
      case "asteroid":
        this.enemies.spawnAsteroid(this.mods);
        break;
      case "miniboss":
        this.enemies.spawnMiniBoss(this.mods, this.miniBossAppearances++);
        break;
      case "boss":
        this.enemies.spawnBoss(this.mods, this.bossAppearances++);
        break;
      case "mine":
        this.enemies.spawnMine(this.mods, this.waveNumber);
        break;
    }
  }
}
