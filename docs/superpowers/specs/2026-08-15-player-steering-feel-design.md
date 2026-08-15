# Player Steering Feel — Design

**Date:** 2026-08-15
**Status:** Approved, not yet implemented

## Problem

Player movement feels laggy/floaty (rubber-banding) and inconsistent in speed
between machines.

Two independent causes, both structural:

1. **Unbounded chase lag.** The mouse does not move the ship. It moves a
   free-floating target the ship eased-follows (ADR-0006). With exponential
   smoothing, a target moving at velocity `v` leaves the ship trailing `v /
   followResponse` behind. At the current `followResponse: 12`, a fast flick
   leaves the ship ~200px behind on a 1920-wide field — and on reversal the
   target must travel all of that back before the ship visibly turns. That is
   the rubber band.

2. **Sensitivity varies per machine with no way to correct it.** There is no
   user-facing sensitivity setting; `PLAYER.sensitivity` is a hardcoded `0.8`.
   Mouse DPI alone gives a 4× spread across common hardware. Window size also
   silently changes it: `GameScene.update` divides deltas by the letterbox
   scale, so a half-size window moves the ship twice as far in world terms.

A third, smaller contributor to (2): the `maxSpeed` teleport-guard clamps a
frame's step to `maxSpeed × dt`, which engages whenever the target is more than
~147px away — reachable on any decent flick. The ship then switches from eased
motion to flat 1600px/s and back, a discontinuity in the motion law mid-gesture.

## What can and cannot be made computer-independent

| Source of variance | Fixable | How |
| --- | --- | --- |
| Window size / letterbox scale | Yes, fully | Map hand motion to world px, not screen px |
| Refresh rate (60/144/240Hz) | Already fixed | `1 - exp(-r·dt)` is frame-rate independent |
| OS pointer acceleration (Chromium) | Yes | `unadjustedMovement: true`, already requested |
| OS pointer acceleration (Firefox/Safari) | **No** | Browser delivers pre-accelerated deltas; curve not exposed |
| Mouse DPI | **No** | No web API exposes it |

The achievable target is **deterministic given a sensitivity value** — not
identical out of the box. Once a player sets their slider, the feel is then
identical across their windows, monitors, and refresh rates. DPI is why every
FPS ships a sensitivity slider instead of a magic constant.

Because the two unfixable rows exist, the game should *disclose* them rather
than hide them: record whether raw input was granted and surface it in the
settings UI.

## Design

### 1. Input pipeline

```
movementX/Y (CSS px; raw on Chromium, OS-accelerated elsewhere)
  → × effectiveSensitivity          [no /scale — world mapping]
  → accumulate into pendingDx/Dy
  → drained once per frame → advance steer target
  → cap target's lead over the ship
  → clamp target to play bounds
  → ship eases toward target, dt-scaled
```

The `/scale` division is removed **for steering only**. It stays for the Menu
Cursor (`GameScene.onMouseMove`, the `this.prompt` branch): that is a genuine
screen-space cursor picking screen-space cards, so screen-consistent motion is
correct there.

Consequence: `sensitivity: 0.8` was tuned *with* the division in play. At
fullscreen 1080p (`scale = 1`) nothing changes; at any other window size the
effective sensitivity shifts. `0.8` is retained as the fullscreen-equivalent
default and becomes the 100% point of the new slider.

### 2. Lead cap replaces the teleport-guard

If the target can never sit more than `maxLead` ahead of the ship, then ship
velocity is `followResponse × lead`, bounded by `followResponse × maxLead`. The
speed limit emerges from the easing itself — one motion law, no second regime.

Therefore **`PLAYER.maxSpeed` and the step clamp in `Player.move` are deleted.**
The guard's real job (a violent flick must not warp the ship) is served better
by bounding the target than by clamping the step, and deleting it removes the
eased→linear kink.

Degenerate case checked: at the 10fps dt floor (`dt = 0.1`, Pixi's `minFPS`
clamp), ease is `1 - exp(-2)` = 0.86 at base response and `1 - exp(-3)` = 0.95
at maxed. Since ease is always below 1, a single step can never exceed `maxLead`
— worst case ≈ 71px. Bounded; nothing teleports.

**The two knobs are coupled.** Top speed is `followResponse × maxLead`, so a
small lead cap (tight reversals) requires a higher `followResponse` to keep
traversal speed. They must move together.

| | Now | New |
| --- | --- | --- |
| `followResponse` base | 12 | **20** |
| `followResponse` maxed (Engine ×10) | 22 | **30** |
| `maxLead` | — (unbounded) | **75 px** |
| `maxSpeed` | 1600 (hard clamp) | **deleted** |
| Top speed, base | 1600 | 1500 (emergent) |
| Top speed, maxed | 1600 | 2250 (emergent) |
| Settle time constant | 83ms | 50ms |
| Worst-case trailing lag | unbounded | **75px, hard** |

Ordering inside the steer step matters — cap the lead radially (preserving
direction), *then* clamp to play bounds, since the bounds clamp can only ever
shorten the lead:

```
target += delta × effectiveSensitivity
lead = target - shipPos;  d = hypot(lead)
if (d > maxLead) target = shipPos + lead × (maxLead / d)
target = clampToPlayBounds(target)
```

**Balance consequence, accepted:** ADR-0006 deliberately froze `maxSpeed` so the
Engine upgrade would not raise top speed. With top speed now emergent from
`followResponse`, Engine *does* raise it (1500 → 2250 over 10 stacks). This is
intended: an "Engine" upgrade making you faster matches player expectation and
gives a common-rarity upgrade a clearer identity.

### 3. Player-configurable sensitivity

**Storage.** `settings.ts` gains a `sensitivity` field beside the two volumes,
using the existing versioned-key / partial-merge / try-catch shape. `clamp01`
does not fit a non-0..1 range, so a sibling `clampRange(v, min, max)` is added.
No `VERSION` bump: the partial merge already falls back via
`parsed.sensitivity ?? DEFAULTS.sensitivity`, so existing stored blobs upgrade
cleanly.

**Config.** `PLAYER.sensitivity` → `sensitivityDefault: 0.8`, plus
`sensitivityMin: 0.2`, `sensitivityMax: 2.4`, `sensitivityStep: 0.2` — 25%–300%
of default in 25% steps, 12 stops end to end (comparable clicking effort to the
volume rows). Displayed as a **percentage of default** (100% = 0.8), because
"0.8" means nothing to a player and "150%" does.

**Engine becomes multiplicative.** Today it is `sensitivity += 0.1` per stack on
a base of `0.8` (maxed `1.8`, a ×2.25). If a user slider replaces that base, an
additive bonus warps wildly — at a `0.2` setting `+1.0` is a 6× boost; at `2.4`
it is barely 1.4×. Engine's power would depend on the player's mouse. So:

```
effectiveSensitivity = userSensitivity × sensitivityMult
sensitivityMult = 1 + stacks × UPGRADES.moveSpeed.sensitivityFactor
```

with `sensitivityFactor: 0.125` (replacing `sensitivityAmount: 0.1`). At the cap
of 10, `1 + 1.25 = ×2.25` — exactly today's maxed ratio, now identical for every
player regardless of slider. `responseAmount: 1` stays additive and unchanged;
there is no user setting for `followResponse`, so no such distortion arises.

**Live application.** The sync point already exists: `GameScene.onLockAcquired`
fires on resume and already clears stale input. It also sets
`player.sensitivity = getSensitivity()`. Player stays decoupled from the
settings module, and since the game is frozen while paused, resume is the only
moment the value can matter. Tuning loop: pause → adjust → resume → feel.

**Raw-input disclosure.** `GameScene.requestLock` currently catches the
`unadjustedMovement` rejection and silently retries without it, discarding the
one signal that explains cross-browser difference. Instead, record it in a small
`game/input.ts` module as `rawInputGranted: boolean | undefined` (undefined
before the first lock — in `MenuScene` the status is genuinely not yet known).
`SettingsControls` renders a quiet line only when it is defined:
`Raw input: on` / `Raw input: off (OS mouse acceleration active)`.

### 4. UI

Three stepper rows now exist across two scenes, so the row is extracted from
`AudioControls` into a reusable `ui/StepperRow.ts` (label, bar, value text, −/+
buttons, a get/set pair, and a value formatter). The row logic is already
parameterised by a `VolumeAccess` get/set pair, so this is a small diff.

`AudioControls` is renamed `SettingsControls` and holds all three rows plus the
raw-input line. Both call sites (`MenuScene.ts:46`, `PauseOverlay.ts:49`) swap
one class name.

Stepped −/+ buttons are retained rather than a drag-slider, for the same reason
`AudioControls` uses them: a drag-slider cannot work under pointer lock in the
Pause overlay.

**Layout note:** the block grows from two rows to three (plus the raw-input
line), so total height goes from ≈`ROW_GAP` to ≈`2 × ROW_GAP` plus the note.
Both call sites center the block by its own origin, so their vertical placement
must be re-checked, not assumed.

### 5. Module boundary

`Player.ts` is 302 lines and imports Pixi (`Sprite`, `getTexture`, `playSound`),
so its movement math cannot be unit-tested in place. The math moves to a pure
`game/steering.ts`:

```
advanceTarget(target, shipX, shipY, dx, dy, sensitivity, maxLead, bounds) → {x, y}
easeToward(pos, target, response, dt) → number
```

`advanceTarget` takes an **already-effective** sensitivity; Player computes
`this.sensitivity * this.sensitivityMult`. Player keeps owning *when* to call
these; `steering.ts` owns the math. Player's class doc comment also needs
rewording — it currently advertises "capped by a teleport-guard step," which is
being deleted.

## Testing

`src/game/steering.test.ts` (pure, no Pixi):

1. **Lead invariant** — after any delta, however violent, `|target − ship| ≤ maxLead`.
2. **Direction preserved** — a diagonal flick caps radially, holding its angle.
3. **Bounds** — the target never leaves the play area, and the bounds clamp only
   ever shortens the lead (the ordering guarantee from §2).
4. **Frame-rate independence** — exactly assertable, not approximately. Toward a
   stationary target, remaining distance is `exp(-r·dt)` per step, so N steps of
   `dt` compose to precisely `exp(-r·N·dt)`. Ten steps at `dt=0.01` must equal
   one step at `dt=0.1` to float tolerance.
5. **No teleport at the dt floor** — a single step at `dt=0.1` moves at most `maxLead`.
6. **Engine is mouse-independent** — `advanceTarget` called with `u₁ × m` and
   `u₂ × m` yields target displacements whose ratio is exactly `u₁/u₂`, proving
   Engine's relative effect does not depend on the player's slider. Plus a config
   invariant: `1 + UPGRADES.moveSpeed.cap × sensitivityFactor === 2.25`.

`src/game/settings.test.ts`:

7. **Settings** — sensitivity round-trips; out-of-range values clamp to
   `[sensitivityMin, sensitivityMax]`; corrupt JSON falls back to defaults; a
   stored blob predating the field takes the default without a version bump.

Tests 4 and 6 directly encode "computer independent" and are the two that must
not be skipped.

## Docs to update

Precedent: ADR-0008 amended ADR-0006 with a banner rather than a rewrite. Follow
that.

- **New `docs/adr/0023-configurable-sensitivity-and-lead-capped-steering.md`** —
  covering world-space mapping, the lead cap replacing `maxSpeed`, configurable
  sensitivity, and multiplicative Engine.
- **`docs/adr/0006`** — add an amendment banner pointing at 0023.
- **`docs/DESIGN.md:12`** (control description), **`:47`** (Engine row).
- **`CONTEXT.md:10`** (Steering entry — "nudges a proportional distance" stays
  true), **`:48`** (Engine entry — now also raises top speed).
- **`CONTRIBUTION.md:42`** (Engine balance row).
- `docs/GLOSSARY.md` — checked, contains no Steering/Sensitivity/Engine entries.
  No change needed.

## Non-goals

Deliberately excluded, to be reconsidered separately if they ever matter:

- **Bank-frame hysteresis.** `Player.move` picks bank textures from hard `vx`
  thresholds (±120, ±600) with no hysteresis, so a steady drift near a threshold
  strobes between two frames. Real, but a *visual* defect, not the feel problem
  in scope here.
- **An FPS cap.** The game is uncapped by design and runs at display refresh;
  Pixi's `minFPS: 10` already clamps `dt` to 100ms. No cap is needed, and the
  frame-rate independence test pins the property that made one seem attractive.
- **Swept collision.** Discrete `circlesOverlap` can tunnel at the 10fps dt
  floor. A real edge, but only on hardware already at 10fps.
- **A `followResponse` user setting.** One tuning knob is enough; a second
  invites players to detune the game.

## Tuning

The numbers above (`followResponse: 20`, `maxLead: 75`, the slider range and
step) are considered starting values, chosen to preserve current base traversal
speed while bounding lag. They are expected to be adjusted by feel after the
mechanism is in place; the mechanism, not the constants, is what this spec
fixes.
