# Kill Burst: a central death flash on clean kills

A **clean** enemy death (Swarmer, Gunner, Warden, Station, Mini-boss, Boss) now plays a single central explosion burst — the **Kill Burst** — at the death point, layered on top of the existing Debris shower. It is purely cosmetic: no collision, no damage, no sound of its own.

## Before

A clean kill produced two things in `destroyEnemy`'s `else` branch: the kill boom (`playSound("explosion", 0.4)`) and a **Debris** shower (fragments flung outward, each popping into a small `Explosion02` at the end of its drift). There was **no central burst at the death point**. Animated central bursts existed only for the **Hit Spark** (every bullet→enemy impact), the **Explosive Modifier** blast, and the Mine/Bomber **detonation** (`explosionBig`). So the moment of destruction read *softer* than a mere bullet graze: an impact sparked, but the kill itself only threw debris and made a noise — the center went dark.

## After

The clean-kill branch also fires a one-shot `Explosion02` burst centred on the enemy:

```ts
this.effects.explode(enemy.x, enemy.y, enemy.sprite.scale.x);
```

Untinted (`0xffffff`), silent, drawn on the `effects` layer (topmost — in front of the Debris, which sits deliberately in back). It reuses `EffectsPool.explode` with the default `explosion` alias (`Explosion02-Sheet`), so there is **no new asset and no new pooling**. Its scale is the enemy's own `sprite.scale.x`, so the burst matches the dead ship's footprint across the whole Swarmer→Boss size range.

It fires on **exactly the Debris set** — clean whole-enemy kills. Explosives (Mine, Bomber) keep their own `detonateExplosive` blast; asteroids keep their split into smaller asteroids; a shot-off Shield Node gets nothing (whole-enemy deaths only).

## Why

The death point deserved a focal flash. Debris gives periphery motion but leaves the center empty; a real explosion has both a bright core and flung fragments. Matching the burst to `sprite.scale.x` keeps it proportionate — small on a Swarmer, massive on the Boss — without a per-kind size table. Keeping it untinted and silent places it squarely in the game's existing cosmetic-burst language (it looks like a bigger sibling of the Hit Spark and the Debris pops, which share the same sheet), and honours the "visuals only" intent: the kill boom already covers the audio beat.

## Alternatives rejected

- **Replace Debris with the burst.** Rejected: Debris is the periphery and the burst is the center — they are complementary, not competing. Debris is also freshly built and carefully documented; tearing it out to swap in a flash would lose the fragment motion that sells a ship coming apart.
- **Fire on *every* death, including explosives and asteroids.** Rejected: explosives already detonate a large central blast, so a second burst on top would just muddy it; asteroids visibly break into smaller asteroids, which is their own death read. The burst is scoped to where no central effect already exists.
- **Size it bigger than the ship (≈1.5–2×) for extra punch.** Considered during design; rejected in favour of a footprint match (≈1×) so the burst stays grounded on the ship and never dwarfs the field on a Boss. A single scale multiplier on `sprite.scale.x` is the one knob if this is ever revisited.
- **Add a second SFX for the burst.** Rejected: the kill boom already fires on every clean kill, and the request was visuals only. A second per-kill sound would stack awkwardly on the already-busy explosion SFX pool.
- **Ship a dedicated new explosion asset.** Rejected: `Explosion02` is already the game's generic burst sheet (Explosive Modifier blast, Debris pops). Reusing it keeps the visual family coherent and adds zero plumbing.

## Consequences

- The `explosion` `FrameAlias` `AnimatedSprite` pool in `EffectsPool` is now shared by three callers: the Explosive Modifier blast, the Debris chunk pops, and the Kill Burst. The pool grows on demand; there is no cap concern.
- A clean kill now stacks one footprint-sized central `Explosion02` plus N smaller `Explosion02` Debris-chunk pops — all the same sheet, so the death reads as one coherent burst-and-scatter rather than two unrelated effects.
- The Boss and Mini-boss get a large Kill Burst (their sprite scale is large) — intended; the capstone deaths should feel the biggest.
- Purely cosmetic: no collision, no damage, no gameplay effect. Safe to retune (the one multiplier) or remove without touching combat.
