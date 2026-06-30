# SpaceStation rakes pure-horizontal side combs

The **SpaceStation** (`SpaceStation.png`) is a late-game enemy (wave 20+): a slow,
heavy fortress that drifts straight down and, on a telegraphed cadence, fires a
vertical **comb** of bullets out *both* flanks at once. The comb bullets travel
**purely horizontally** (`vy = 0`) — never downward. The per-side count ramps with
the wave (5 → 10).

## The non-obvious choice

In this game the player is anchored near the bottom and enemies descend from the
top, so a *purely horizontal* barrage looks wrong on paper: the bullets stay at the
station's altitude and sweep out to the screen edges — they never come down toward
the player. A future reader will see `ctx.fire(x, y, ±speed, 0, …)` and reasonably
ask "how does this ever threaten anyone?"

The answer is **lingering, not geometry**: the station is the slowest descender in
the roster (base 40 px/s), so it spends a long time crossing the lower screen where
the player lives. While it's down there, every volley rakes the player's row. The
threat is the station dragging a *standing wall* through the danger zone, and the
counterplay is positional — be clear of the station's vertical band, or thread the
gaps between comb bullets. The comb is built with **threadable spacing**
(`combSpacing`, ~160px tall at 5 bullets → ~360px at 10), not a solid wall, so
there is always a way through.

## Why pure-horizontal (alternatives rejected)

- **Downward-arcing fans out each side.** Spray each flank into the lower quadrant
  so bullets chase the player down. Rejected: this collapses the SpaceStation into
  "another spread shooter" alongside the Mini-boss fan and Boss curtain. The
  horizontal rake is a *distinct* archetype — area-denial you out-position rather
  than out-dodge — and that distinctiveness is the point of adding the enemy.
- **Hover-and-camp at a low altitude.** Keep pure-horizontal but stop descending
  near the player so the walls always bite. Rejected: a stationary turret removes
  the "slow drift through your zone" tension and needs a bespoke hover state; the
  slow continuous descent already guarantees a long, fair threat window for free.

## Mechanics

- **Firing lives in `updateStation`, not the aimed `canShoot` path.** Like the
  Boss's curtain, the station drives its own cadence (`fireInterval`) and never aims
  — `canShoot` stays false. A short `telegraphTime` charge-up tints the body before
  each volley (a burn tint takes precedence, mirroring the Bomber).
- **One collider, standard lifecycle.** Unlike the Warden (ADR-0012) the station is
  a single circle with no child colliders. It deals contact damage, takes damage,
  drops a Star on the normal roll, and despawns off the bottom like any descender —
  so it needs **no** `GameScene` changes. The horizontal bullets are ordinary enemy
  projectiles and self-despawn off the left/right edges (`despawnMargin`).
- **Tuning seam.** The `SPACESTATION` config block is the single knob set: body
  stats, `fireInterval`/`telegraphTime`, the per-side count ramp
  (`basePerSide`/`maxPerSide`/`countRampEveryWaves`), `combSpacing`, `bulletSpeed`,
  and `muzzleOffset`. Difficulty otherwise rides the existing `WaveMods` (`hpMult`,
  `speedMult`) plus the wave-driven count ramp.

This is a structural-but-contained addition in the spirit of ADR-0011/0012/0013:
the behavior lives behind the config seam, and the only new logic is one `Enemy`
update branch plus its spawn/pick/spawn-method wiring.
