/**
 * Run stats and their cross-run persistence (localStorage). The shape is kept
 * flat and versioned so it can later be mapped onto Steam stats (v2).
 */

const STORAGE_KEY = "spaceshooter3.stats.v1";
const VERSION = 1;

/** Stats for a single run, accumulated during play. */
export interface RunStats {
  score: number;
  wave: number;
  level: number;
  kills: number;
  bulletsFired: number;
  /** Seconds survived. */
  timeSurvived: number;
}

/** Persisted bests + all-time totals. */
export interface PersistedStats {
  version: number;
  bestScore: number;
  bestWave: number;
  bestLevel: number;
  totalKills: number;
  totalBulletsFired: number;
  totalTimeSurvived: number;
  runsPlayed: number;
}

const EMPTY: PersistedStats = {
  version: VERSION,
  bestScore: 0,
  bestWave: 0,
  bestLevel: 0,
  totalKills: 0,
  totalBulletsFired: 0,
  totalTimeSurvived: 0,
  runsPlayed: 0,
};

export function emptyRun(): RunStats {
  return {
    score: 0,
    wave: 0,
    level: 0,
    kills: 0,
    bulletsFired: 0,
    timeSurvived: 0,
  };
}

export function loadStats(): PersistedStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<PersistedStats>) };
  } catch {
    // Corrupt/unavailable storage — fall back to empty stats.
    return { ...EMPTY };
  }
}

function saveStats(stats: PersistedStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Storage full or blocked — stats just won't persist this run.
  }
}

/** Whether each headline metric of a run beat the stored best. */
export interface RunRecord {
  stats: PersistedStats;
  newBestScore: boolean;
  newBestWave: boolean;
}

/** Merge a finished run into persisted stats, save, and report new bests. */
export function recordRun(run: RunStats): RunRecord {
  const prev = loadStats();
  const newBestScore = run.score > prev.bestScore;
  const newBestWave = run.wave > prev.bestWave;
  const stats: PersistedStats = {
    version: VERSION,
    bestScore: Math.max(prev.bestScore, run.score),
    bestWave: Math.max(prev.bestWave, run.wave),
    bestLevel: Math.max(prev.bestLevel, run.level),
    totalKills: prev.totalKills + run.kills,
    totalBulletsFired: prev.totalBulletsFired + run.bulletsFired,
    totalTimeSurvived: prev.totalTimeSurvived + run.timeSurvived,
    runsPlayed: prev.runsPlayed + 1,
  };
  saveStats(stats);
  return { stats, newBestScore, newBestWave };
}
