# The Duelist — design

A new enemy (`fighter3.png`) entering the spawn budget from wave 35: a standoff
duelist that holds the top of the field, keeps its nose pointed at the player,
and every 3 seconds fires a tracking 3-shot burst before stepping sideways along
an arc around the player.

## Identity

The Duelist owns the top of the field. It never descends into the player's zone
and never flees — a wave does not clear until it is dead. It holds a fixed
distance from the player, faces them at all times, and cycles on a fixed
3-second rhythm: telegraph, burst, slide, settle.

Two things make it new:

- **It rotates to face the player.** Every other enemy is fixed-orientation or
  spins cosmetically. The Duelist's nose is a live read on where its next shot
  goes.
- **Its position is defined relative to the player**, not by a fixed path. If
  the player moves, the Duelist's whole arc moves with them. It cannot be
  escaped, only out-timed.

The player beats it by reading the rhythm: it is stationary and vulnerable for
the back half of each cycle, and a moving, firing problem for the front half.

The distance it holds is protection from **ramming and contact** — not from the
player's gun. It may sit directly above the player, and lining up under it to
fire straight up (ADR-0006) is exactly how it is meant to be killed.

## Behaviour

### Entry

Spawns above the top edge at a random x (`randomTopX()`, the Swarmer/Gunner
precedent) and descends straight down at `descentSpeed`. It does not fire while
descending. On reaching `bandMaxY` it latches on: its arc angle is initialised
from its current position relative to the player, and the cycle begins.

If a second Duelist is already live, the newcomer's angle is initialised on the
opposite side of the player's arc, so the pair produce crossfire from two angles
and the player can only line up under one at a time.

### The standoff anchor

Each frame the Duelist derives an anchor point:

```
anchor = playerPos + (cos θ, sin θ) * standoffRadius
```

θ is the arc angle measured from the player (0 = to the player's right,
−90° = straight above). The anchor is then clamped into the top band
(`bandMinY`..`bandMaxY`) and inside `xMargin` of both side edges.

The Duelist **eases** toward that anchor (exponential decay at
`followResponse`, capped at `maxSpeed`) rather than snapping to it, so it lags
and swings behind the player's movement instead of teleporting.

This is what makes it structurally un-rammable, with no special "flee" state:
if the player charges, the anchor is pushed away from them and the Duelist
slides off. When the player is high in the field, the geometry resolves the
standoff radius almost entirely horizontally — it slides to the far side rather
than descending.

### The 3-second cycle

Once latched, the Duelist runs a fixed 3-second loop:

| Phase | Duration | Behaviour |
|---|---|---|
| Telegraph | 0.3s | Parked at the anchor. Tint pulse (`telegraphTint`) — the Bomber/Station precedent |
| Burst | ~0.3s | 3 shots, `burstInterval` apart, each fired **along the nose** |
| Slide | 1.2s | θ eases to a new angle, sweeping the Duelist along the arc. Still facing the player |
| Settle | 1.2s | Parked, facing the player. The player's clean window to line up and shoot back |

Firing is driven inside `updateDuelist` (the Boss/Station precedent), so the
shared `canShoot` aimed-fire path is not used.

Shots are held until the body is fully on-screen, matching every other shooter.

### Facing and the tracking burst

The nose turns toward the player at a limited rate (`turnRate`), and shots fire
**along the nose**, not at the player's exact position.

This is what "re-aimed on each shot" means in practice: the volley genuinely
bends toward the player mid-burst, so a slow drift out of the line gets
punished — but a hard, committed lateral break outruns the turn rate and the
last two shots trail behind. The re-aim is real, and beating it is a skill
rather than a dice roll.

The sprite art faces down, so the rendered rotation is
`atan2(dy, dx) − π/2` — with the player directly below, rotation is 0 and the
sprite is unrotated.

### The arc step

Each slide steps θ by a random `arcStepDeg` amount in the currently-held
direction. The direction is held between moves and flips when a step would push
the anchor outside the top band or past an edge margin, so the Duelist paces
back and forth across the player's arc rather than orbiting in one direction
forever.

### Death and departure

It never leaves the field — the only exit is being destroyed. It is a "clean"
kill: Kill Burst plus Debris, like every ship. No `GameScene` change is needed,
because clean kills are defined there as everything except the Asteroid, the
Mine and the Bomber.

## Tuning (`DUELIST` in `config.ts`)

| Knob | Value | Reasoning |
|---|---|---|
| `scale` | 3 | 32×32 native → 96px. Bigger than a Swarmer (64px), well under the Boss (192px) — reads as elite |
| `hp` | 130 | × the wave `hpMult` = ~765 at wave 35. Between the Warden (~470) and the Station (~1058). The first knob to tune |
| `contactDamage` | 30 | Parity only — the player will almost never touch it |
| `bulletDamage` | 14 | Just above the Gunner's 12. A full 3-shot burst that all connects is 42 |
| `startWave` | 35 | First wave Duelists appear in the spawn budget |
| `spawnChance` | 0.10 | A flat share off the top, the Bomber's value. The live cap does the real limiting |
| `maxLive` | 2 | Hard cap on simultaneously-live Duelists |
| `descentSpeed` | 140 | Entry descent, until it reaches the band |
| `standoffRadius` | 620 | From the player's home row (y ≈ 864) this puts it at y ≈ 250 — inside the top band |
| `bandMinY` / `bandMaxY` | 150 / 380 | The top strip it is confined to |
| `xMargin` | 140 | Keeps the anchor off the side edges |
| `turnRate` | 1.8 rad/s | ~103°/s. Tracks a drift; outrun above ~1100 px/s, about 75% of top speed. **Corrected during implementation** — the 4.0 rad/s first proposed here is above the ~2.4 rad/s a player at top speed can ever demand at this range, so the burst would have been un-outrunnable. See ADR-0024 |
| `arcStepMinDeg` / `arcStepMaxDeg` | 25 / 55 | Per-move angular step |
| `followResponse` / `maxSpeed` | 3.2 /s, 520 px/s | Eased chase of the anchor, so it lags and swings rather than snapping |
| `cycleSeconds` | 3 | The full loop |
| `telegraphTime` / `telegraphTint` | 0.3s / `0x6fe3ff` | Wind-up pulse before each burst |
| `burstCount` / `burstInterval` | 3 / 0.15s | The tracking volley |
| `slideDuration` | 1.2 | How long the arc sweep takes |
| `radiusFactor` | 0.7 | Collision radius as a fraction of sprite half-width, matching the other ships |

`XP.duelist` = 18 and `SCORE.duelist` = 140 — between the Warden (14/100) and
the Station (16/130).

Speed values follow the Mine/Bomber/Lode precedent and ignore the wave
`speedMult`: the cycle rhythm is the thing the player learns, and it should read
identically at wave 35 and wave 60. HP takes the wave `hpMult` and nothing else
— no per-appearance stacking, since a never-fleeing enemy that outgrows the
player's DPS is a soft-lock risk (ADR-0016's reasoning).

## Code seams

1. **`src/assets.ts`** — add the `duelist` alias for
   `./assets/SpaceShooter/Enemies/fighter3.png`. The file is already in
   `public/assets` and currently unused.
2. **`src/config.ts`** — the `DUELIST` block next to `WARDEN`/`BOMBER`, plus
   `XP.duelist` and `SCORE.duelist`.
3. **`src/game/duelist.ts` — new pure module.** The arc-anchor math, the
   angular step-and-flip, and the turn-rate limiter, free of PixiJS. This is the
   `steering.ts` precedent: the module owns only the arithmetic, `Enemy` owns
   when it runs. It is where the interesting logic lives and where it is
   unit-tested directly.
4. **`src/game/EnemyPool.ts`** — `"duelist"` added to `EnemyKind`; a small state
   block (arc angle, direction, cycle timer, phase, facing, burst counters);
   `spawnDuelist()`; `updateDuelist()`; the fields cleared in `reset()`; a
   pool-level `spawnDuelist()` and a `countLive(kind)` query for the cap.
   `EnemyPool` is already 1350 lines with all per-kind state flattened into one
   class. This change matches the existing structure rather than starting an
   extraction — that is a separate piece of work and out of scope here.
5. **`src/game/WaveManager.ts`** — `"duelist"` in `SpawnKind` and the wave-35
   gate in `pickKind`. **The cap must be enforced in `spawnNext`, not
   `composeWave`**: the whole wave queue is built up front, when nothing is live
   yet, so a spawn-chance roll cannot see the live count. A `duelist` token that
   would exceed `maxLive` spawns a Gunner instead.
6. **`src/scenes/GameScene.ts`** — no change.
7. **Docs** — ADR-0024 recording the relative-position/turn-to-face decision, a
   CONTEXT.md glossary entry (with `_Avoid_`: Gunner, Bomber, Mini-boss), and a
   CONTRIBUTION.md row.

## Testing

**`src/game/duelist.test.ts`** — the pure math:

- the anchor always lands inside the top band and the x margins, for player
  positions across the field including the corners;
- closing on the Duelist pushes the anchor away from the player (the
  un-rammable invariant);
- with the player high in the field, the anchor resolves horizontally rather
  than descending;
- the arc direction flips when a step would leave the band or cross an edge
  margin;
- the turn-rate limiter never turns further than `turnRate * dt` in a frame, and
  a lateral break faster than the turn rate leaves the nose trailing the player.

**`src/game/WaveManager.test.ts`** — wave composition:

- no Duelist appears before wave 35;
- Duelists appear from wave 35;
- a `duelist` spawn token spawns a Gunner instead when `maxLive` are already
  live.

## Known risk

The Duelist never leaves, so a wave cannot clear until every live one is dead.
With the cap at 2 the worst case is bounded, but if playtesting shows waves
dragging, the fix is `hp` — not the cap, which is what keeps the crossfire
readable.
