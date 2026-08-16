import {
  WAVES,
  MINE,
  WARDEN,
  BOMBER,
  SPACESTATION,
  DUELIST,
  LODE,
  isLodeWave,
} from "../config";
import type { EnemyPool, WaveMods } from "./EnemyPool";

type SpawnKind =
  | "swarmer"
  | "gunner"
  | "asteroid"
  | "miniboss"
  // A per-wave mini-boss from miniBossEveryWaveFrom on: spawns identically to a
  // "miniboss" but with NO per-appearance HP bonus (scales on hpMult only), so a
  // never-fleeing capstone on every wave can't outgrow the player. See ADR-0016.
  | "minibossFlat"
  | "boss"
  | "mine"
  | "warden"
  | "bomber"
  | "station"
  // The Duelist: the wave-35 standoff enemy. It NEVER leaves, so unlike every
  // other budget pick its live count has to be capped at spawn time — see
  // spawnNext (ADR-0024).
  | "duelist"
  // The Lode: a drive-by treasure, spliced on top of the budget every few waves
  // from LODE.startWave. Not a capstone — it flees, and the wave clears without
  // it (ADR-0021).
  | "lode";

/**
 * Drives discrete, escalating waves. Each wave spawns a budget of enemies over
 * time; once the budget is spent and the field is clear, a ~3s breather plays
 * (with a "NEXT WAVE" banner) before the next, harder wave begins. A boss or
 * mini-boss is spliced mid-wave into the budget on milestone waves, and a Lode
 * crosses the top on its own cadence. Difficulty scales via count, stats, and
 * asteroid splits.
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

    // Capstones spliced into the budget mid-wave (ADR-0011). A Boss anchors every
    // bossEvery wave. Below the relentless threshold a mini-boss anchors the
    // remaining every-miniBossEvery waves (5, 15) and the Boss stands alone. From
    // miniBossEveryWaveFrom on the endgame turns relentless (ADR-0016): EVERY wave
    // gets a mini-boss (the flat-HP variant), and a Boss wave carries both. This
    // is the single place to change which capstones a wave spawns.
    const relentless = n >= WAVES.miniBossEveryWaveFrom;
    const capstones: SpawnKind[] = [];
    if (n % WAVES.bossEvery === 0) {
      capstones.push("boss");
      if (relentless) capstones.push("minibossFlat");
    } else if (relentless) {
      capstones.push("minibossFlat");
    } else if (n % WAVES.miniBossEvery === 0) {
      capstones.push("miniboss");
    }
    // Everything that rides ON TOP of the budget, each at its own fraction of
    // the adds. Multiple capstones are spread apart (boss first, mini-boss
    // later) so they don't descend on the same spawn tick.
    const points = [WAVES.capstoneSpawnFraction, 0.66];
    const extras = capstones.map((kind, i) => ({
      kind,
      at: Math.floor(budget * points[i]),
    }));

    // The Lode is spliced in the same way but is NOT a capstone and is never
    // suppressed by one: from wave 27 every Lode wave also carries a mini-boss,
    // and waves 30/60 a Boss too — suppressing would delete the feature from the
    // whole endgame, which is exactly where the payout matters (ADR-0021).
    if (isLodeWave(n)) {
      extras.push({
        kind: "lode",
        at: Math.floor(budget * LODE.spawnFraction),
      });
    }

    // Splice from the last index back so earlier insertions don't shift later
    // ones — every `at` stays an offset into the original budget.
    extras.sort((a, b) => b.at - a.at);
    for (const extra of extras) queue.splice(extra.at, 0, extra.kind);
    return queue;
  }

  /** Weighted enemy pick; gunners enter wave 2+, asteroids wave 3+, mines wave 6+,
   *  wardens and bombers wave 15+, stations wave 20+, duelists wave 35+. Mines,
   *  then wardens, bombers, stations, and duelists each take a flat share off the
   *  top; the rest keep the original 25/25/50 split (drawn from a second roll) so
   *  pre-mine waves are unchanged.
   *
   *  This runs at wave composition, so it cannot see what is live — the
   *  Duelist's cap is applied later, in spawnNext. */
  private pickKind(n: number): SpawnKind {
    if (n >= MINE.startWave && Math.random() < MINE.spawnChance) return "mine";
    if (n >= DUELIST.startWave && Math.random() < DUELIST.spawnChance)
      return "duelist";
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
      case "minibossFlat":
        // Per-wave endgame mini-boss (ADR-0016): appearance 0 => no per-appearance
        // HP bonus, so it scales on the wave hpMult alone and stays killable.
        this.enemies.spawnMiniBoss(this.mods, 0);
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
      case "duelist":
        // The Duelist is the one budget pick that never leaves the field, so a
        // spawn chance cannot bound how many accumulate — and a wave cannot
        // clear until every one of them is dead. The cap has to be applied
        // HERE rather than at composition, because that runs up front when
        // nothing is live yet. Over the cap, the slot pays out a Gunner: the
        // wave keeps its full enemy budget, it just isn't another Duelist.
        if (this.enemies.countLive("duelist") >= DUELIST.maxLive) {
          this.enemies.spawnGunner(this.mods, this.waveNumber);
        } else {
          this.enemies.spawnDuelist(this.mods);
        }
        break;
      case "lode":
        this.enemies.spawnLode(this.mods);
        break;
    }
  }
}
