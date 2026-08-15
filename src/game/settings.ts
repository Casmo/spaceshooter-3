/**
 * Player settings and their persistence (localStorage). Two independent
 * volumes — Music and SFX, each 0..1 — mirroring Stats.ts: a versioned key, a
 * partial merged over defaults, and try/catch fallbacks so corrupt or blocked
 * storage degrades to defaults instead of throwing. This module is the source
 * of truth for the *values*; game/audio.ts applies them to playback (ADR-0014).
 */
import { AUDIO, PLAYER } from "../config";

const STORAGE_KEY = "spaceshooter3.settings.v1";
const VERSION = 1;

export interface Settings {
  version: number;
  /** Background-music volume, 0 (off) .. 1. */
  musicVolume: number;
  /** Sound-effects master volume, 0 (off) .. 1. Scales each effect's weight. */
  sfxVolume: number;
  /** Mouse sensitivity, an absolute value in
   *  PLAYER.sensitivityMin..sensitivityMax. Not a 0..1 fraction like the
   *  volumes, so it needs clampRange rather than clamp01. */
  sensitivity: number;
}

const DEFAULTS: Settings = {
  version: VERSION,
  musicVolume: AUDIO.musicDefault,
  sfxVolume: AUDIO.sfxDefault,
  sensitivity: PLAYER.sensitivityDefault,
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

const clampRange = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

function read(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      version: VERSION,
      musicVolume: clamp01(parsed.musicVolume ?? DEFAULTS.musicVolume),
      sfxVolume: clamp01(parsed.sfxVolume ?? DEFAULTS.sfxVolume),
      sensitivity: clampRange(
        parsed.sensitivity ?? DEFAULTS.sensitivity,
        PLAYER.sensitivityMin,
        PLAYER.sensitivityMax,
      ),
    };
  } catch {
    // Corrupt/unavailable storage — fall back to defaults.
    return { ...DEFAULTS };
  }
}

let current = read();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage full or blocked — the setting just won't persist this session.
  }
}

export function getMusicVolume(): number {
  return current.musicVolume;
}

export function getSfxVolume(): number {
  return current.sfxVolume;
}

/** Set + persist music volume (clamped). Returns the stored value. */
export function setMusicVolume(v: number): number {
  current = { ...current, musicVolume: clamp01(v) };
  persist();
  return current.musicVolume;
}

/** Set + persist SFX volume (clamped). Returns the stored value. */
export function setSfxVolume(v: number): number {
  current = { ...current, sfxVolume: clamp01(v) };
  persist();
  return current.sfxVolume;
}

export function getSensitivity(): number {
  return current.sensitivity;
}

/** Set + persist mouse sensitivity (clamped to the slider range). Returns the
 *  stored value. */
export function setSensitivity(v: number): number {
  current = {
    ...current,
    sensitivity: clampRange(v, PLAYER.sensitivityMin, PLAYER.sensitivityMax),
  };
  persist();
  return current.sensitivity;
}
