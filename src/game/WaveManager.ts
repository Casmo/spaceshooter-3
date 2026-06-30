import { WAVES, MINE, WARDEN, BOMBER, SPACESTATION } from "../config";
import { EnemyPool, type WaveMods } from "./EnemyPool";

type SpawnKind =
  | "swarmer"
  | "gunner"
  | "asteroid"
  | "miniboss"
  | "boss"
  | "mine"
  | "warden"
  | "bomber"
  | "station";

/**
 * Drives discrete, escalating waves. Each wave spawns a budget of enemies over
 * time; once the budget is spent and the field is clear, a ~3s breather plays
 * (with a "NEXT WAVE" banner) before the next, harder wave begins. A boss or
 * mini-boss is spliced mid-wave into the budget on milestone waves. Difficulty
 * scales via count, stats, and asteroid splits.
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
  /** Text for the breather banner shown before the next wave starts. */
  get bannerText(): string {
    return "NEXT WAVE";
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
    // Every wave gets a normal enemy budget that scales with n.
    const budget = WAVES.baseBudget + (n - 1) * WAVES.budgetPerWave;
    const queue: SpawnKind[] = [];
    for (let i = 0; i < budget; i++) queue.push(this.pickKind(n));

    // Milestone capstones: a Boss anchors every bossEvery wave (overriding the
    // mini-boss there); a mini-boss anchors the remaining every-miniBossEvery
    // waves. The capstone is spliced into the budget mid-wave (it no longer
    // replaces the budget). This is the single place to change which capstone a
    // milestone spawns.
    const capstone: SpawnKind | null =
      n % WAVES.bossEvery === 0
        ? "boss"
        : n % WAVES.miniBossEvery === 0
          ? "miniboss"
          : null;
    if (capstone) {
      const at = Math.floor(budget * WAVES.capstoneSpawnFraction);
      queue.splice(at, 0, capstone);
    }
    return queue;
  }

  /** Weighted enemy pick; gunners enter wave 2+, asteroids wave 3+, mines wave 6+,
   *  wardens and bombers wave 15+, stations wave 20+. Mines, then wardens, bombers,
   *  and stations each take a flat share off the top; the rest keep the original
   *  25/25/50 split (drawn from a second roll) so pre-mine waves are unchanged. */
  private pickKind(n: number): SpawnKind {
    if (n >= MINE.startWave && Math.random() < MINE.spawnChance) return "mine";
    if (n >= WARDEN.startWave && Math.random() < WARDEN.spawnChance)
      return "warden";
    if (n >= BOMBER.startWave && Math.random() < BOMBER.spawnChance)
      return "bomber";
    if (n >= SPACESTATION.startWave && Math.random() < SPACESTATION.spawnChance)
      return "station";
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
        this.enemies.spawnGunner(this.mods, this.waveNumber);
        break;
      case "warden":
        this.enemies.spawnWarden(this.mods);
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
      case "bomber":
        this.enemies.spawnBomber(this.mods, this.waveNumber);
        break;
      case "station":
        this.enemies.spawnStation(this.mods, this.waveNumber);
        break;
    }
  }
}
