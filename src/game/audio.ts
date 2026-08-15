import { sound, type IMediaInstance } from "@pixi/sound";
import { AUDIO } from "../config";
import {
  getMusicVolume as readMusicVolume,
  getSfxVolume as readSfxVolume,
  setMusicVolume as writeMusicVolume,
  setSfxVolume as writeSfxVolume,
} from "./settings";

/**
 * Game audio (ADR-0014). Each SoundId names an event, not a file: it maps to one
 * sample or a *pool* of takes (one picked at random per play, so a repeated event
 * doesn't machine-gun a single sample). SFX volume scales each call's weight;
 * Music volume applies live to the one looping instance. Browsers block audio
 * until a user gesture, so the first music start is deferred behind a one-time
 * unlock listener. Missing files are skipped per-sound, so the game stays silent
 * and throw-free if an asset is absent.
 */
export type SoundId =
  | "shoot" // player gun
  | "enemyShoot" // enemy fire
  | "playerHit" // player takes damage
  | "bulletHit" // per-bullet Hit Spark (frequent — throttled)
  | "explosion" // enemy destroyed / detonation
  | "pickup" // Star collected
  | "levelup"
  | "gameover"
  | "music";

/** A SoundId maps to one file or a pool of takes. Paths are relative (`./`) to
 *  match the `--base=./` build (e.g. an itch.io zip), like assets.ts. */
const MANIFEST: Record<SoundId, string | string[]> = {
  shoot: "./assets/Sounds/laser-1.wav",
  enemyShoot: "./assets/Sounds/laser-2.wav",
  playerHit: "./assets/Sounds/hit-9.mp3",
  bulletHit: "./assets/Sounds/hit-6.mp3",
  explosion: [
    "./assets/Sounds/explosion-3.mp3",
    "./assets/Sounds/explosion-8.mp3",
    "./assets/Sounds/explosion-9.mp3",
  ],
  pickup: "./assets/Sounds/coins.wav",
  levelup: "./assets/Sounds/1up.wav",
  gameover: "./assets/Sounds/lose.wav",
  music: "./assets/Sounds/music.mp3",
};

/** Per-id list of aliases that loaded successfully — only these ever play. */
const pools = new Map<SoundId, string[]>();
/** Last play time (ms) per throttled id, for the rate-limit gate. */
const lastPlayed = new Map<SoundId, number>();

const throttleFor = (id: SoundId): number =>
  (AUDIO.throttleMs as Record<string, number>)[id] ?? 0;

/**
 * Load every sample (each take of a pool under its own alias). Missing files are
 * skipped per-sample. Also installs the one-time autoplay-unlock listener.
 */
export async function initAudio(): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const id of Object.keys(MANIFEST) as SoundId[]) {
    const urls = ([] as string[]).concat(MANIFEST[id]);
    pools.set(id, []);
    urls.forEach((url, i) => {
      const alias = urls.length > 1 ? `${id}#${i}` : id;
      tasks.push(
        new Promise<void>((resolve) => {
          sound.add(alias, {
            url,
            preload: true,
            loaded: (err) => {
              if (!err) pools.get(id)!.push(alias);
              resolve();
            },
          });
        }),
      );
    });
  }
  await Promise.all(tasks);
  installUnlockListener();
}

/**
 * Play a one-shot effect at `weight` × the SFX volume. No-op when muted, when no
 * take loaded, or while the id's throttle window is still open.
 */
export function playSound(id: SoundId, weight = 1): void {
  const volume = weight * readSfxVolume();
  if (volume <= 0) return;
  const aliases = pools.get(id);
  if (!aliases || aliases.length === 0) return;

  const throttle = throttleFor(id);
  if (throttle > 0) {
    const now = performance.now();
    if (now - (lastPlayed.get(id) ?? -Infinity) < throttle) return;
    lastPlayed.set(id, now);
  }

  const alias =
    aliases.length === 1
      ? aliases[0]
      : aliases[Math.floor(Math.random() * aliases.length)];
  sound.play(alias, { volume });
}

// --- Music: a single looping track, started once on the first user gesture. ---

let musicInstance: IMediaInstance | undefined;
let musicWanted = false;
let unlocked = false;

function applyMusicVolume(): void {
  if (musicInstance) musicInstance.volume = readMusicVolume();
}

function startMusic(): void {
  if (!unlocked || !musicWanted || musicInstance) return;
  if (!pools.get("music")?.length) return;
  const res = sound.play("music", { loop: true, volume: readMusicVolume() });
  if (res instanceof Promise) {
    res.then((inst) => {
      musicInstance = inst;
      applyMusicVolume();
    });
  } else {
    musicInstance = res;
  }
}

/** Request the looping music. Starts now if the audio context is unlocked,
 *  otherwise as soon as the player first interacts. Idempotent. */
export function playMusic(): void {
  musicWanted = true;
  startMusic();
}

export function stopMusic(): void {
  musicWanted = false;
  musicInstance = undefined;
  sound.stop("music");
}

/** First pointer/key event unlocks audio and kicks off any wanted music. */
function installUnlockListener(): void {
  const unlock = (): void => {
    if (unlocked) return;
    unlocked = true;
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    startMusic();
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

// --- Volume controls (used by the SettingsControls UI). Setters persist via
//     settings and apply live to music; SFX is read fresh on each playSound. ---

export function getMusicVolume(): number {
  return readMusicVolume();
}

export function getSfxVolume(): number {
  return readSfxVolume();
}

export function setMusicVolume(v: number): number {
  const stored = writeMusicVolume(v);
  applyMusicVolume();
  return stored;
}

export function setSfxVolume(v: number): number {
  return writeSfxVolume(v);
}
