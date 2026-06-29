# Audio playback and volume settings

The game ships its first real audio: a **SFX** layer (Phoenix1291's pack) and a single looping **Music** track (Creative Core Studio / Mr.Cat). The two are controlled by **independent persisted volumes**, exposed as stepped controls inline in the Menu and Pause overlay. Several smaller decisions hang off this — variant pools, role-split samples, a throttled impact sound, and a deferred-unlock for autoplay — recorded together here because they only make sense as one design.

## Volume model

Two independent volumes, **Music** and **SFX**, each a 0–1 value adjusted in 10% steps (0 = silent — there is no separate mute toggle, a slider that reaches zero *is* the off switch). They persist to `localStorage` under `spaceshooter3.settings.v1`, mirroring `Stats.ts` (versioned, try/catch fallback, defaults merged over a stored partial). Defaults: **Music 0.30, SFX 0.50**.

The two masters route differently because the sources differ:

- **SFX master multiplies the per-call weight.** Call sites already pass relative weights (`shoot` 0.3, `explosion` 0.5/0.6); the master scales that mix rather than replacing it, so the hand-tuned balance between effects survives a volume change.
- **Music master applies live to the one looping instance.** `playMusic` keeps a handle to the playing instance so a mid-run volume step updates it immediately, with no restart.

## Asset and variant strategy

Source files are **renamed in place** to clean kebab-case names under `public/assets/Sounds/` (`laser-1.wav`, `explosion-3.mp3`, …). Attribution lives in the Credits scene and an asset note, never in filenames.

The pack ships multiple takes of some effects, used deliberately rather than shelved:

- **Variant pools.** A `SoundId` may map to an *array* of files; `playSound` picks one at random per play. Explosions (3/8/9) and the impact sound draw from pools so repeated events don't machine-gun a single sample.
- **Role-split samples.** Where two takes exist for one concept, they are split by *role* instead of pooled, so the two roles never sound alike:
  - `laser-1` = the player's gun, `laser-2` = enemy fire (the new `enemyShoot`). A consistent player-weapon sound is part of the ship's identity; a distinct enemy-shot improves threat readability.
  - `hit-9` = the player taking damage (rare, important, must be unmistakable), `hit-6` = the per-bullet impact spark (frequent, quiet).

## Throttled impact

The Hit Spark fires on *every* bullet→enemy contact — dozens per second under Multishot + Rapid Fire — so its sound (`bulletHit`, `hit-6`) is **rate-limited** in the audio layer (≤1 play per ~80 ms) and played quietly. It is the only frequency-gated effect; every other sound maps to an event the player perceives as discrete.

## Autoplay unlock

Browsers suppress audio until a user gesture, and the menu's `playMusic()` runs at startup with none — so naive autoplay yields a silent title screen. The audio layer holds a **one-time `pointerdown`/`keydown` listener**: a music request made before the context is unlocked is remembered and started on the first interaction. After unlock, scene transitions start/stop music normally.

## Alternatives rejected

- **Single master volume / a mute checkbox.** Rejected: players expect to duck music under SFX independently, and the scaffold already split `playMusic`/`playSound`. A zero-reaching slider subsumes a mute toggle.
- **Drag-slider widget.** Rejected: it needs live pointer coordinates, which **pointer-lock** denies mid-game (ADR-0006) — the slider would work on the menu but not in the Pause overlay, exactly where mid-run adjustment is wanted. Stepped +/- click buttons reuse `makeButton`, work under lock, and are controller-friendly later.
- **One sample per event (shelve the extras).** Rejected: a single repeated explosion/hit grows grating fast; pooling is nearly free.
- **Pooling the hit samples across both roles.** Rejected: getting hit would sound identical to hitting an enemy, destroying the game's primary negative-feedback cue.
- **A sound on every Hit Spark, unthrottled.** Rejected: unbearable under heavy fire. Throttling keeps it as a texture, not noise.
- **Leaving `playMusic()` in the constructor as-is.** Rejected: silently broken on first load in every modern browser.

## Consequences

- `MANIFEST` values widen from `string` to `string | string[]`; `playSound` gains pool-pick + per-id throttle, and `SoundId` gains `enemyShoot` and `pickup`.
- A new `AudioControls` container renders the two stepped rows and is mounted inline in both `MenuScene` and `PauseOverlay`; a small settings module owns the persisted volumes and the live music handle.
- The **Hit Spark** (glossary) is no longer purely cosmetic-silent — it now carries the throttled `bulletHit` sound, while staying damage-free.
- Two attributions now ship: Phoenix1291 (SFX) and Creative Core Studio / Mr.Cat (music).
