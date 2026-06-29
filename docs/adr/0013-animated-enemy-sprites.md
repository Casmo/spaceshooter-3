# Animated enemy sprites

The **Bomber** (a late-game enemy, wave 15+) is the first enemy whose sprite is **animated**: it cycles a 5-frame sheet (`Bombe-Sheet`, 16×16 frames) while it flies. To make this work, an `Enemy` may now own an **optional frame set** that `update()` advances on the sprite, generalizing the body from a single fixed `Texture` to **one static texture *or* a cycled animation**.

## Before

Every enemy was a static `Sprite` with one `Texture`, assigned once in `reset()` and never changed (the asteroid/mine "spin" only rotated that single texture; the Star and the explosion bursts were the only animated things, and those live in `StarPool`/`EffectsPool`, not `Enemy`). Animation never entered the enemy hot path.

## After

An `Enemy` carries `animFrames: Texture[] | null`. When non-null (only the Bomber sets it, via `getFrames("bomber")`), `update()` advances an interval-driven frame index and swaps `sprite.texture` each step — before the per-kind behavior switch, so it is kind-agnostic and any future enemy can opt in by setting `animFrames` in its `spawnX`. When null, the sprite keeps its one static texture exactly as before. The frame cadence (`BOMBER.frameInterval`) is config-driven like every other tunable.

The HP Bar geometry (captured once at spawn from `sprite.width`) is unaffected because all frames share a size; the bar never re-measures per frame.

## Why

The Bomber's art is shipped as an animation sheet, and a flat first-frame would read as a dead, static prop next to the lively explosion bursts. Threading an optional frame set through the existing single-`Sprite` enemy is far less invasive than swapping `Enemy.sprite` for an `AnimatedSprite` (which would change pooling, the HP-Bar sibling wiring in `EnemyPool`, and every `spawnX`). The static-texture path stays byte-for-byte unchanged.

## Alternatives rejected

- **Make `Enemy.sprite` an `AnimatedSprite` for everyone.** Rejected: it forces a frame array on every static enemy, ties enemy animation to Pixi's shared ticker (the bursts already do this in `EffectsPool`, but enemies advance on the game's own `dt`, which pause/iframe logic depends on), and churns the pool/HP-bar plumbing for one animated kind.
- **A separate `AnimatedSprite` overlay parented to the enemy.** Rejected: two display objects per enemy, double the position bookkeeping, and the HP Bar / collision radius would have to choose which to track.
- **Pre-bake the animation into the explosion only (keep the Bomber a static body).** Rejected: the body is the threat the player tracks for the full ~3s dodge cadence; a static body undersells it.

## Consequences

- `Enemy.update()` carries a small kind-agnostic frame-advance block guarded by `animFrames`; static enemies pay only a null check.
- The Bomber's behavior (re-aiming burst + eased drift, detonation) is **not** itself an ADR-level decision — it recombines the Mine's spawn/aim/detonation (it reuses `detonateExplosive` and the Mine's blast tuning) with the Boss's eased acceleration. The novel, structural piece is the animated sprite, recorded here.
- `getFrames`/`FrameAlias` now serve enemies too, not just `EffectsPool`/`StarPool` — the frame-set registry is the shared seam for any future animated enemy.
