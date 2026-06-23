import { sound } from "@pixi/sound";

/**
 * Named sound hooks. The game calls play(...) / music(...) at the right moments;
 * the system stays completely silent until matching files are dropped into
 * /public/assets/audio. No audio is bundled in v1.
 */
export type SoundId =
  | "shoot"
  | "hit"
  | "explosion"
  | "levelup"
  | "gameover"
  | "music";

const MANIFEST: Record<SoundId, string> = {
  shoot: "/assets/audio/shoot.wav",
  hit: "/assets/audio/hit.wav",
  explosion: "/assets/audio/explosion.wav",
  levelup: "/assets/audio/levelup.wav",
  gameover: "/assets/audio/gameover.wav",
  music: "/assets/audio/music.mp3",
};

/** Ids that loaded successfully — only these ever actually play. */
const loaded = new Set<SoundId>();

/**
 * Attempt to load every sound. Missing files are skipped per-sound so the game
 * runs silently (and without throwing) until real audio is supplied.
 */
export async function initAudio(): Promise<void> {
  await Promise.all(
    (Object.keys(MANIFEST) as SoundId[]).map(
      (id) =>
        new Promise<void>((resolve) => {
          sound.add(id, {
            url: MANIFEST[id],
            preload: true,
            loaded: (err) => {
              if (!err) loaded.add(id);
              resolve();
            },
          });
        }),
    ),
  );
}

/** Play a one-shot sound effect (no-op if its file isn't present). */
export function playSound(id: SoundId, volume = 1): void {
  if (loaded.has(id)) sound.play(id, { volume });
}

/** Start looping background music (no-op if absent). */
export function playMusic(volume = 0.5): void {
  if (loaded.has("music")) sound.play("music", { loop: true, volume });
}

export function stopMusic(): void {
  if (loaded.has("music")) sound.stop("music");
}
