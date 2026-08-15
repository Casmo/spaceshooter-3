# Player Steering Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the rubber-band lag and per-machine inconsistency from player ship steering, by bounding how far the steer target may lead the ship and by making mouse sensitivity a persisted player setting.

**Architecture:** The ship is steered indirectly — mouse motion shoves a free-floating target point, and the ship eased-follows it (ADR-0006). Two structural changes: (1) the target's *lead* over the ship is capped, which bounds trailing lag and makes top speed emerge as `followResponse × maxLead`, letting the old `maxSpeed` teleport-guard and its velocity discontinuity be deleted outright; (2) mouse deltas map to world distance instead of screen distance, and a persisted sensitivity setting absorbs the mouse-DPI variance no web API exposes. The steering math is extracted into a pure, Pixi-free `game/steering.ts` so its invariants are directly unit-testable.

**Tech Stack:** TypeScript (strict), PixiJS 8, Vite, Vitest, ESLint + Prettier.

**Spec:** `docs/superpowers/specs/2026-08-15-player-steering-feel-design.md`

## Global Constraints

- **TypeScript is strict** with `noUnusedLocals` and `noUnusedParameters` enabled. An unused variable is a hard compile error, not a warning.
- **Tests must not require PixiJS, textures, or a canvas.** Vitest runs in the default `node` environment — there is no `document`, no `window`, no `localStorage`. Follow the pattern documented at the top of `src/game/WaveManager.test.ts`: test modules that import Pixi only as types.
- **All tunable numbers live in `src/config.ts`.** Never inline a magic number in game code; add a documented constant to the relevant config block.
- **Comments explain *why*, not *what*.** The existing codebase uses this style heavily (see `SceneManager.ts:40-47` for the tone). Match it.
- **ADR references in code comments use the form `(ADR-0023)` or `see docs/adr/0006`.** Both forms appear in the codebase; either is fine.
- **Virtual resolution is 1920×1080** (`VIRTUAL_WIDTH`, `VIRTUAL_HEIGHT`). All gameplay coordinates are in these "virtual px".
- **Commit after every task.** Use `feat:`, `refactor:`, `test:`, or `docs:` prefixes.

**Verification commands** used throughout:

| Purpose | Command |
| --- | --- |
| Run one test file | `npx vitest run src/game/<name>.test.ts` |
| Run all tests | `npm test` |
| Type-check | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Play the game | `npm run dev` (opens http://localhost:8080) |

---

## File Structure

**Created:**
- `src/game/steering.ts` — pure steering math (lead cap, exponential approach). No Pixi.
- `src/game/steering.test.ts` — invariant tests for the above.
- `src/game/settings.test.ts` — persistence tests for the sensitivity setting.
- `src/game/upgrades.test.ts` — Engine upgrade config invariant.
- `src/game/input.ts` — records whether the browser granted raw (un-accelerated) pointer input.
- `src/ui/StepperRow.ts` — reusable labelled row with bar + stepped −/+ buttons.
- `src/ui/SettingsControls.ts` — the settings block (replaces `AudioControls.ts`).
- `docs/adr/0023-configurable-sensitivity-and-lead-capped-steering.md`

**Modified:**
- `src/config.ts` — `PLAYER` steering constants, `UPGRADES.moveSpeed`.
- `src/game/Player.ts` — delegates to `steering.ts`; drops the teleport-guard; gains `sensitivityMult`.
- `src/game/settings.ts` — adds the persisted `sensitivity` field.
- `src/game/upgrades.ts` — Engine becomes multiplicative.
- `src/scenes/GameScene.ts` — world-space delta mapping, sensitivity sync, raw-input recording.
- `src/scenes/MenuScene.ts`, `src/ui/PauseOverlay.ts` — use `SettingsControls`.
- `docs/adr/0006-relative-mouse-control-under-pointer-lock.md`, `docs/DESIGN.md`, `CONTEXT.md`, `CONTRIBUTION.md`.

**Deleted:**
- `src/ui/AudioControls.ts` (becomes `SettingsControls.ts`).

---

### Task 1: Pure steering math

Builds `game/steering.ts` and its tests in isolation. Nothing consumes it yet, so this task cannot break the running game.

**Files:**
- Create: `src/game/steering.ts`
- Test: `src/game/steering.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Point { x: number; y: number }`
  - `interface SteerBounds { minX: number; maxX: number; minY: number; maxY: number }`
  - `advanceTarget(target: Point, shipX: number, shipY: number, dx: number, dy: number, sensitivity: number, maxLead: number, bounds: SteerBounds): Point`
  - `easeToward(pos: number, target: number, response: number, dt: number): number`

**Background for the implementer:** `advanceTarget` takes an *already-effective* sensitivity (the user's setting already multiplied by the Engine upgrade bonus). It deliberately knows nothing about upgrades or settings. `easeToward` operates on one axis at a time; the caller runs it once for x and once for y.

- [ ] **Step 1: Write the failing tests**

Create `src/game/steering.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { advanceTarget, easeToward, type SteerBounds } from "./steering";

/**
 * Invariant tests for the pure steering math. These are the properties that
 * make the ship feel the same on every machine, so they assert exact
 * relationships rather than eyeballed tolerances.
 */

const BOUNDS: SteerBounds = { minX: 0, maxX: 1920, minY: 0, maxY: 1080 };
const MAX_LEAD = 75;

const leadOf = (t: { x: number; y: number }, sx: number, sy: number): number =>
  Math.hypot(t.x - sx, t.y - sy);

describe("advanceTarget", () => {
  it("never lets the target lead the ship by more than maxLead", () => {
    // A violent flick must not build unbounded debt for the ship to pay back.
    for (const delta of [1, 50, 500, 50_000]) {
      const t = advanceTarget(
        { x: 960, y: 864 },
        960,
        864,
        delta,
        delta,
        0.8,
        MAX_LEAD,
        BOUNDS,
      );
      expect(leadOf(t, 960, 864)).toBeLessThanOrEqual(MAX_LEAD + 1e-9);
    }
  });

  it("caps radially, preserving the gesture's direction", () => {
    // A 3:4 flick stays a 3:4 flick after capping — no axis is favoured.
    const t = advanceTarget(
      { x: 960, y: 540 },
      960,
      540,
      3000,
      4000,
      1,
      MAX_LEAD,
      BOUNDS,
    );
    expect(t.x - 960).toBeCloseTo(MAX_LEAD * 0.6, 6);
    expect(t.y - 540).toBeCloseTo(MAX_LEAD * 0.8, 6);
  });

  it("keeps the target inside the play bounds", () => {
    const t = advanceTarget(
      { x: 10, y: 10 },
      10,
      10,
      -9999,
      -9999,
      1,
      MAX_LEAD,
      BOUNDS,
    );
    expect(t.x).toBeGreaterThanOrEqual(BOUNDS.minX);
    expect(t.y).toBeGreaterThanOrEqual(BOUNDS.minY);
  });

  it("bounds clamping only ever shortens the lead", () => {
    // Ship near a corner, flick further into it: the clamp pins the target, and
    // the lead invariant must survive that second clamp.
    const t = advanceTarget({ x: 0, y: 0 }, 5, 5, -500, -500, 1, MAX_LEAD, BOUNDS);
    expect(leadOf(t, 5, 5)).toBeLessThanOrEqual(MAX_LEAD + 1e-9);
  });

  it("scales displacement linearly with sensitivity", () => {
    // This is what makes the Engine upgrade's *relative* power identical for
    // every player regardless of their sensitivity setting: the multiplier
    // cancels out of the ratio.
    const engineMult = 2.25;
    const a = advanceTarget(
      { x: 960, y: 540 },
      960,
      540,
      10,
      0,
      0.4 * engineMult,
      MAX_LEAD,
      BOUNDS,
    );
    const b = advanceTarget(
      { x: 960, y: 540 },
      960,
      540,
      10,
      0,
      1.6 * engineMult,
      MAX_LEAD,
      BOUNDS,
    );
    expect((b.x - 960) / (a.x - 960)).toBeCloseTo(1.6 / 0.4, 10);
  });
});

describe("easeToward", () => {
  it("is frame-rate independent: N small steps equal one large step", () => {
    // Remaining distance decays by exp(-response*dt) per call, and that
    // composes exactly — this is why 60Hz and 144Hz produce identical motion.
    let stepped = 0;
    for (let i = 0; i < 10; i++) stepped = easeToward(stepped, 100, 20, 0.01);
    expect(stepped).toBeCloseTo(easeToward(0, 100, 20, 0.1), 10);
  });

  it("never overshoots the target", () => {
    expect(easeToward(0, 100, 20, 0.1)).toBeLessThan(100);
    expect(easeToward(0, 100, 20, 10)).toBeLessThanOrEqual(100);
  });

  it("cannot cross the whole gap in one step, even at the 10fps dt floor", () => {
    // Pixi clamps deltaMS to 100ms (its minFPS default of 10), so dt=0.1 is the
    // worst case the ship will ever see. Response 30 is the maxed-Engine value.
    const gap = 75;
    expect(easeToward(0, gap, 30, 0.1)).toBeLessThan(gap);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/steering.test.ts`
Expected: FAIL — `Failed to resolve import "./steering"`.

- [ ] **Step 3: Write the implementation**

Create `src/game/steering.ts`:

```ts
/**
 * Pure steering math for the player ship (ADR-0023). Deliberately free of
 * PixiJS so the invariants can be unit-tested directly; Player owns *when*
 * these run, this module owns only the arithmetic.
 *
 * Two rules define the feel:
 *  - The steer target may never sit more than `maxLead` ahead of the ship. That
 *    bounds trailing lag, and — since ship velocity is `followResponse * lead` —
 *    it doubles as the speed limit, so there is no second motion law to switch
 *    into mid-gesture (which is what the old maxSpeed clamp did).
 *  - The ship approaches the target by exponential decay, which composes
 *    exactly across frames, so 60Hz and 144Hz produce identical motion.
 */

/** A point in virtual space. */
export interface Point {
  x: number;
  y: number;
}

/** Axis-aligned play area the steer target is confined to (virtual px). */
export interface SteerBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/**
 * Shove the steer target by a mouse delta, then bound it.
 *
 * `sensitivity` is the *effective* value — the player's setting already
 * multiplied by the Engine upgrade bonus. This module knows nothing of either.
 *
 * Order matters: cap the lead radially first (preserving the gesture's
 * direction), then clamp to bounds. A bounds clamp can only ever pull the
 * target closer to the ship, so it cannot break the lead invariant; doing it
 * the other way round could.
 */
export function advanceTarget(
  target: Point,
  shipX: number,
  shipY: number,
  dx: number,
  dy: number,
  sensitivity: number,
  maxLead: number,
  bounds: SteerBounds,
): Point {
  let x = target.x + dx * sensitivity;
  let y = target.y + dy * sensitivity;

  const leadX = x - shipX;
  const leadY = y - shipY;
  const dist = Math.hypot(leadX, leadY);
  if (dist > maxLead) {
    const k = maxLead / dist;
    x = shipX + leadX * k;
    y = shipY + leadY * k;
  }

  return {
    x: clamp(x, bounds.minX, bounds.maxX),
    y: clamp(y, bounds.minY, bounds.maxY),
  };
}

/**
 * Frame-rate independent exponential approach toward `target`, one axis at a
 * time. Written as "target plus decayed remainder" rather than "position plus
 * eased step" because the composition property is then self-evident: N steps of
 * dt land exactly where one step of N*dt does.
 */
export function easeToward(
  pos: number,
  target: number,
  response: number,
  dt: number,
): number {
  return target + (pos - target) * Math.exp(-response * dt);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/game/steering.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/game/steering.ts src/game/steering.test.ts
git commit -m "feat: add pure steering math with lead cap and frame-rate-independent easing"
```

---

### Task 2: Wire Player to the steering module and delete the teleport-guard

Replaces the inline math in `Player.move`/`Player.steer` with calls into `steering.ts`, and retunes the two coupled constants.

**Files:**
- Modify: `src/config.ts` (the `PLAYER` block, around lines 50-60)
- Modify: `src/game/Player.ts` (class doc, fields around 33-45, constructor, `steer` at 118-129, `move` at 158-193)

**Interfaces:**
- Consumes: `advanceTarget`, `easeToward`, `SteerBounds` from Task 1.
- Produces: `Player.sensitivity` (public, mutable — Task 5 adds `Player.sensitivityMult` beside it); `PLAYER.maxLead` config constant. `PLAYER.maxSpeed` ceases to exist.

**Background:** top speed is now `followResponse × maxLead`, so the two constants must move together — a tighter lead cap needs faster easing to preserve traversal speed. `20 × 75 = 1500` base (vs the old flat 1600) and `30 × 75 = 2250` maxed. The ship position no longer needs its own bounds clamp: `easeToward` always returns a point *between* the current position and the target, and the target is already bounds-clamped, so a ship starting in bounds can never leave them.

- [ ] **Step 1: Retune the config constants**

In `src/config.ts`, inside the `PLAYER` block, replace the `followResponse` and `maxSpeed` entries with:

```ts
  /** Eased-follow smoothing toward the steer-target, per second (higher =
   *  snappier). The Engine upgrade raises it. Together with maxLead this sets
   *  the ship's top speed: followResponse * maxLead (ADR-0023). */
  followResponse: 20,
  /** How far the steer-target may lead the ship (virtual px). Bounds the
   *  trailing lag that caused rubber-banding on direction reversals, and — since
   *  ship velocity is followResponse * lead — doubles as the speed limit. This
   *  replaces the old maxSpeed teleport-guard, which capped the step instead and
   *  so switched the ship between two different motion laws mid-flick
   *  (ADR-0023). */
  maxLead: 75,
```

Note `maxSpeed` is **deleted**, not renamed — do not leave it behind.

- [ ] **Step 2: Verify the deletion breaks the build**

Run: `npx tsc --noEmit`
Expected: FAIL — `Property 'maxSpeed' does not exist on type ...` at `src/game/Player.ts`. This confirms `PLAYER.maxSpeed` had exactly one consumer.

- [ ] **Step 3: Update the Player class doc comment**

In `src/game/Player.ts`, replace the class doc block (lines 17-23) with:

```ts
/**
 * The player ship. Steered by relative mouse motion (see docs/adr/0006): each
 * mouse delta shoves a free-floating target point, and the ship eased-follows
 * that point. The target may never lead the ship by more than PLAYER.maxLead,
 * which bounds trailing lag and caps top speed in one rule (ADR-0023). Fires the
 * base weapon on a cooldown while the trigger is held, and tracks HP / lives
 * with invulnerability frames.
 */
```

- [ ] **Step 4: Swap the Player fields**

In `src/game/Player.ts`, add the import beneath the existing `./weaponVisual` import:

```ts
import { advanceTarget, easeToward, type SteerBounds } from "./steering";
```

Replace the `sensitivity` / `followResponse` / `maxSpeed` field block (lines 33-41) with:

```ts
  /** Steer-target travel per unit of mouse motion. The scene syncs this from the
   *  player's persisted setting; the Engine upgrade multiplies it separately. */
  sensitivity: number = PLAYER.sensitivityDefault;
  followResponse: number = PLAYER.followResponse;
  pickupRange: number = PLAYER.basePickupRange;
  /** How far the steer-target may lead the ship (ADR-0023). */
  private readonly maxLead: number = PLAYER.maxLead;
```

> `PLAYER.sensitivityDefault` does not exist yet — Task 4 renames `PLAYER.sensitivity` to it. **For this task only, keep writing `PLAYER.sensitivity`** and change it in Task 4. Everything else in this step is final.

Then declare the bounds field beside `halfWidth` / `halfHeight` (near line 67):

```ts
  /** Play area the steer-target is confined to. Derived from the sprite size, so
   *  it is fixed once the ship's texture is known. */
  private readonly bounds: SteerBounds;
```

- [ ] **Step 5: Populate bounds in the constructor**

In `src/game/Player.ts`, at the end of the constructor body (after `this.hitRadius = ...`), add:

```ts
    this.bounds = {
      minX: this.halfWidth,
      maxX: VIRTUAL_WIDTH - this.halfWidth,
      minY: this.halfHeight,
      maxY: VIRTUAL_HEIGHT - this.halfHeight,
    };
```

- [ ] **Step 6: Rewrite `steer`**

Replace the whole `steer` method (lines 113-129) with:

```ts
  /**
   * Shove the steer-target by a mouse delta (in virtual px), bounded by the lead
   * cap and the play area. The ship then chases the target in `move`.
   */
  steer(dx: number, dy: number): void {
    const next = advanceTarget(
      { x: this.targetX, y: this.targetY },
      this.sprite.x,
      this.sprite.y,
      dx,
      dy,
      this.sensitivity,
      this.maxLead,
      this.bounds,
    );
    this.targetX = next.x;
    this.targetY = next.y;
  }
```

- [ ] **Step 7: Rewrite `move`**

Replace the whole `move` method (lines 158-193) with:

```ts
  private move(dt: number): void {
    const prevX = this.sprite.x;

    // No position clamp is needed: easeToward always lands between the current
    // position and the target, and the target is already bounds-clamped in
    // steer(), so a ship starting in bounds can never leave them.
    this.sprite.x = easeToward(
      this.sprite.x,
      this.targetX,
      this.followResponse,
      dt,
    );
    this.sprite.y = easeToward(
      this.sprite.y,
      this.targetY,
      this.followResponse,
      dt,
    );

    // Bank into the horizontal movement: lean left/right by speed, level at rest.
    const vx = dt > 0 ? (this.sprite.x - prevX) / dt : 0;
    this.sprite.texture =
      this.bankFrames[
        vx <= -600 ? 0 : vx <= -120 ? 1 : vx >= 600 ? 4 : vx >= 120 ? 3 : 2
      ];
  }
```

- [ ] **Step 8: Type-check, lint, and run the full suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all clean. If `clamp` is now unused in `Player.ts`, remove it from the import list — `noUnusedLocals` will flag it.

- [ ] **Step 9: Verify by playing**

Run: `npm run dev`, click Play, and fly for ~30 seconds.
Expected: the ship feels tighter than before and reverses direction promptly. Confirm it still cannot be pushed off any edge of the play area, and that the ship art still banks left/right when moving horizontally.

- [ ] **Step 10: Commit**

```bash
git add src/config.ts src/game/Player.ts
git commit -m "refactor: bound the steer target's lead, replacing the maxSpeed teleport-guard

Top speed is now followResponse * maxLead, so the ship obeys one motion law
instead of switching to a flat clamp on large flicks. Retunes followResponse
12 -> 20 to preserve traversal speed under the 75px lead cap."
```

---

### Task 3: Map mouse deltas to world distance

**Files:**
- Modify: `src/scenes/GameScene.ts` (the steering block in `update`, lines 310-315)

**Interfaces:**
- Consumes: `Player.steer` from Task 2.
- Produces: nothing new.

**Background:** `GameScene.update` currently divides accumulated deltas by the letterbox scale, which makes hand motion consistent in *screen* px but means a half-size window moves the ship twice as far in world terms. The `/scale` division in `onMouseMove` (the `this.prompt` branch, lines 131-141) must **stay** — that one drives the Menu Cursor, which is a genuine screen-space cursor picking screen-space cards.

- [ ] **Step 1: Replace the steering block**

In `src/scenes/GameScene.ts`, replace lines 310-315 with:

```ts
    // Mouse deltas map to world distance, not screen distance (ADR-0023): the
    // ship covers the same in-game distance per unit of hand motion whatever the
    // window size, so muscle memory survives a resize or a jump to fullscreen.
    // The Menu Cursor in onMouseMove keeps its /scale — that one IS a
    // screen-space cursor, so screen-consistent motion is correct there.
    this.player.steer(this.pendingDx, this.pendingDy);
    this.pendingDx = 0;
    this.pendingDy = 0;
```

- [ ] **Step 2: Type-check to confirm the local is gone**

Run: `npx tsc --noEmit`
Expected: clean. If it reports `'scale' is declared but its value is never read`, the old `const scale = this.manager.scale || 1;` line was not removed — delete it.

- [ ] **Step 3: Lint and run the suite**

Run: `npm run lint && npm test`
Expected: clean.

- [ ] **Step 4: Verify by playing at two window sizes**

Run: `npm run dev`. Play once with the browser maximised, then again in a window roughly half that width.
Expected: the same physical hand movement now sweeps the ship across the same *fraction of the playfield* in both cases. Then open the upgrade prompt (level up once) and confirm the Menu Cursor still tracks the mouse comfortably — that path must be unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "fix: map steering deltas to world distance instead of screen distance"
```

---

### Task 4: Persist a mouse sensitivity setting

**Files:**
- Modify: `src/config.ts` (the `PLAYER` block)
- Modify: `src/game/settings.ts`
- Modify: `src/game/Player.ts` (one identifier, from Task 2's note)
- Test: `src/game/settings.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `PLAYER.sensitivityDefault: 0.8`, `PLAYER.sensitivityMin: 0.2`, `PLAYER.sensitivityMax: 2.4`, `PLAYER.sensitivityStep: 0.2`
  - `getSensitivity(): number` and `setSensitivity(v: number): number` from `src/game/settings.ts` (the setter returns the stored, clamped value — matching `setMusicVolume`).

**Background:** `settings.ts` reads storage once at module load (`let current = read()`), so tests must install a `localStorage` stand-in and then `vi.resetModules()` before importing it. Vitest runs in the `node` environment where `localStorage` is undefined entirely; the module's existing try/catch already degrades to defaults there, and there is a test below that pins that behaviour. **No `VERSION` bump** — the existing partial-merge (`parsed.x ?? DEFAULTS.x`) upgrades old stored blobs for free.

- [ ] **Step 1: Add the config constants**

In `src/config.ts`, inside the `PLAYER` block, replace the existing `sensitivity` entry with:

```ts
  /** Mouse sensitivity: how far the steer-target moves per unit of mouse motion.
   *  Deltas map to world px (ADR-0023), so this is window-size independent.
   *  This is the default; the player can change it in settings, and the Engine
   *  upgrade multiplies whatever they chose. */
  sensitivityDefault: 0.8,
  /** Sensitivity slider bounds and step, as absolute sensitivity values.
   *  0.2..2.4 in 0.2 steps is 25%..300% of the default in 25% steps — 12 stops,
   *  comparable clicking effort to the volume rows. The range exists because
   *  mouse DPI varies ~4x across common hardware and no web API exposes it. */
  sensitivityMin: 0.2,
  sensitivityMax: 2.4,
  sensitivityStep: 0.2,
```

- [ ] **Step 2: Fix the one reference in Player**

In `src/game/Player.ts`, change `sensitivity: number = PLAYER.sensitivity;` to:

```ts
  sensitivity: number = PLAYER.sensitivityDefault;
```

Run `npx tsc --noEmit` — expected clean. Any remaining error naming `PLAYER.sensitivity` points at a reference this plan missed; update it the same way.

- [ ] **Step 3: Write the failing tests**

Create `src/game/settings.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYER } from "../config";

/**
 * Persistence tests for player settings. settings.ts reads storage once at
 * module load, so each case installs a fresh localStorage stand-in and then
 * re-imports the module to get fresh state. Vitest runs in the node
 * environment, where localStorage does not exist at all — the last test pins
 * that the module degrades to defaults there rather than throwing.
 */

const KEY = "spaceshooter3.settings.v1";

/** Install a localStorage stand-in (optionally pre-seeded) and re-import. */
async function freshSettings(seed?: string) {
  const store = new Map<string, string>();
  if (seed !== undefined) store.set(KEY, seed);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  });
  vi.resetModules();
  return { settings: await import("./settings"), store };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("sensitivity setting", () => {
  it("defaults to the configured default", async () => {
    const { settings } = await freshSettings();
    expect(settings.getSensitivity()).toBe(PLAYER.sensitivityDefault);
  });

  it("round-trips through storage", async () => {
    const { settings, store } = await freshSettings();
    settings.setSensitivity(1.4);
    expect(settings.getSensitivity()).toBe(1.4);
    expect(JSON.parse(store.get(KEY)!).sensitivity).toBe(1.4);
  });

  it("clamps values outside the slider range", async () => {
    const { settings } = await freshSettings();
    expect(settings.setSensitivity(99)).toBe(PLAYER.sensitivityMax);
    expect(settings.setSensitivity(-5)).toBe(PLAYER.sensitivityMin);
  });

  it("clamps an out-of-range value already in storage", async () => {
    const { settings } = await freshSettings(
      JSON.stringify({ version: 1, sensitivity: 999 }),
    );
    expect(settings.getSensitivity()).toBe(PLAYER.sensitivityMax);
  });

  it("takes the default from a blob saved before the field existed", async () => {
    // No VERSION bump was needed; the partial merge handles the upgrade.
    const { settings } = await freshSettings(
      JSON.stringify({ version: 1, musicVolume: 0.7, sfxVolume: 0.2 }),
    );
    expect(settings.getSensitivity()).toBe(PLAYER.sensitivityDefault);
    expect(settings.getMusicVolume()).toBe(0.7);
  });

  it("falls back to defaults on corrupt storage", async () => {
    const { settings } = await freshSettings("{not json");
    expect(settings.getSensitivity()).toBe(PLAYER.sensitivityDefault);
  });

  it("works with no localStorage at all", async () => {
    vi.unstubAllGlobals();
    vi.resetModules();
    const settings = await import("./settings");
    expect(settings.getSensitivity()).toBe(PLAYER.sensitivityDefault);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/game/settings.test.ts`
Expected: FAIL — `settings.getSensitivity is not a function`.

- [ ] **Step 5: Implement the setting**

In `src/game/settings.ts`, change the import line to pull in `PLAYER`:

```ts
import { AUDIO, PLAYER } from "../config";
```

Add the field to the interface:

```ts
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
```

Add it to `DEFAULTS`:

```ts
const DEFAULTS: Settings = {
  version: VERSION,
  musicVolume: AUDIO.musicDefault,
  sfxVolume: AUDIO.sfxDefault,
  sensitivity: PLAYER.sensitivityDefault,
};
```

Add the clamp helper beside `clamp01`:

```ts
const clampRange = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));
```

Add the field to the merge inside `read()`, beside the two volumes:

```ts
      sensitivity: clampRange(
        parsed.sensitivity ?? DEFAULTS.sensitivity,
        PLAYER.sensitivityMin,
        PLAYER.sensitivityMax,
      ),
```

Append the accessors:

```ts
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
```

Finally, update the module doc comment's first line to say "Player settings and their persistence" rather than "Player audio settings", since it now holds a control setting too.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/game/settings.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 7: Type-check, lint, full suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/config.ts src/game/settings.ts src/game/settings.test.ts src/game/Player.ts
git commit -m "feat: persist a player-configurable mouse sensitivity setting"
```

---

### Task 5: Make the Engine upgrade multiplicative and sync sensitivity live

Without this, the setting from Task 4 is stored but never reaches the ship.

**Files:**
- Modify: `src/config.ts` (`UPGRADES.moveSpeed`)
- Modify: `src/game/Player.ts` (fields, `steer`)
- Modify: `src/game/upgrades.ts` (the `moveSpeed` def, around lines 36-46)
- Modify: `src/scenes/GameScene.ts` (after `new Player(...)` at line 208; `onLockAcquired` at 273-282)
- Test: `src/game/upgrades.test.ts`

**Interfaces:**
- Consumes: `getSensitivity` from Task 4; `advanceTarget` from Task 1.
- Produces: `Player.sensitivityMult: number` (public, starts at `1`); `UPGRADES.moveSpeed.sensitivityFactor: 0.125` replacing `sensitivityAmount: 0.1`.

**Background:** today Engine does `sensitivity += 0.1` on a base of `0.8`, reaching `1.8` at its cap of 10 — a ×2.25. Once the base is player-chosen, an additive bonus warps wildly (at a `0.2` setting `+1.0` is a 6× boost; at `2.4` it is barely 1.4×), so Engine's power would depend on the player's mouse. Multiplying instead keeps the ratio at exactly ×2.25 for everyone. `responseAmount` stays additive — there is no user setting for `followResponse`, so no such distortion arises.

`onLockAcquired` is the right sync point: it already fires on every resume and already clears stale input. The game is frozen while paused, so resume is the only moment the value can matter.

- [ ] **Step 1: Write the failing test**

Create `src/game/upgrades.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { UPGRADE_DEFS } from "./upgrades";
import type { Player } from "./Player";
import { UPGRADES } from "../config";

/**
 * Engine upgrade tests. upgrades.ts imports Player only in type position, so
 * this file pulls in no PixiJS — a plain object stub stands in for the player,
 * the same trick WaveManager.test.ts uses for EnemyPool.
 */

const engine = UPGRADE_DEFS.find((d) => d.id === "moveSpeed")!;

/** Only the fields the Engine upgrade touches. */
interface EngineStub {
  sensitivityMult: number;
  followResponse: number;
}

const applyEngine = (levels: number): EngineStub => {
  const stub: EngineStub = { sensitivityMult: 1, followResponse: 20 };
  for (let i = 0; i < levels; i++) engine.apply(stub as unknown as Player);
  return stub;
};

describe("Engine upgrade", () => {
  it("multiplies sensitivity rather than adding to it", () => {
    // Multiplicative is what keeps the upgrade's relative power identical for
    // every player, whatever sensitivity setting they chose.
    expect(applyEngine(1).sensitivityMult).toBeCloseTo(1.125, 10);
    expect(applyEngine(2).sensitivityMult).toBeCloseTo(1.25, 10);
  });

  it("reaches exactly x2.25 at its cap, preserving the pre-setting ratio", () => {
    // 1.8 / 0.8 was the old maxed ratio when sensitivity was a fixed constant.
    expect(applyEngine(UPGRADES.moveSpeed.cap).sensitivityMult).toBeCloseTo(
      2.25,
      10,
    );
    expect(
      1 + UPGRADES.moveSpeed.cap * UPGRADES.moveSpeed.sensitivityFactor,
    ).toBeCloseTo(2.25, 10);
  });

  it("still raises follow response additively", () => {
    expect(applyEngine(UPGRADES.moveSpeed.cap).followResponse).toBe(
      20 + UPGRADES.moveSpeed.cap * UPGRADES.moveSpeed.responseAmount,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/game/upgrades.test.ts`
Expected: FAIL — `Property 'sensitivityFactor' does not exist`, and `sensitivityMult` stays `1`.

- [ ] **Step 3: Change the config**

In `src/config.ts`, replace the `moveSpeed` block with:

```ts
  moveSpeed: {
    cap: 10,
    weight: 12,
    rarity: "common",
    /** Sensitivity is multiplied, not added, so the upgrade's relative power is
     *  the same for every player whatever sensitivity they set (ADR-0023).
     *  1 + 10 * 0.125 = x2.25 at cap — exactly the maxed ratio from back when
     *  sensitivity was a fixed 0.8 constant. */
    sensitivityFactor: 0.125,
    responseAmount: 1,
  },
```

- [ ] **Step 4: Add the multiplier field to Player**

In `src/game/Player.ts`, directly beneath the `sensitivity` field, add:

```ts
  /** Engine's sensitivity multiplier (1 = no Engine upgrades). Kept separate
   *  from `sensitivity` so the player's setting and the upgrade compose without
   *  either overwriting the other (ADR-0023). */
  sensitivityMult = 1;
```

Then in `steer`, change the sensitivity argument passed to `advanceTarget` from `this.sensitivity` to:

```ts
      this.sensitivity * this.sensitivityMult,
```

- [ ] **Step 5: Change the upgrade application**

In `src/game/upgrades.ts`, in the `moveSpeed` def, replace the `apply` body with:

```ts
    apply: (p) => {
      p.sensitivityMult += UPGRADES.moveSpeed.sensitivityFactor;
      p.followResponse += UPGRADES.moveSpeed.responseAmount;
    },
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/game/upgrades.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 7: Sync the setting into the live Player**

In `src/scenes/GameScene.ts`, add the import beside the other `../game/...` imports:

```ts
import { getSensitivity } from "../game/settings";
```

Immediately after `this.player = new Player(this.bullets, this.missiles);` (line 208), add:

```ts
    this.player.sensitivity = getSensitivity();
```

And inside `onLockAcquired`, after the `this.firing = false;` line, add:

```ts
    // Re-read the setting on every resume: the Pause overlay may have changed it
    // while the game was frozen, and resume is the first moment it can matter.
    this.player.sensitivity = getSensitivity();
```

- [ ] **Step 8: Type-check, lint, full suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/config.ts src/game/Player.ts src/game/upgrades.ts src/game/upgrades.test.ts src/scenes/GameScene.ts
git commit -m "feat: make the Engine upgrade multiplicative and sync sensitivity on resume

Engine now scales whatever sensitivity the player set, reaching x2.25 at cap
for everyone, instead of adding a fixed amount whose relative power depended
on the player's mouse."
```

---

### Task 6: Extract StepperRow and build SettingsControls

Makes the sensitivity setting adjustable in-game. Three stepper rows now exist across two scenes, so the row becomes a reusable primitive.

**Files:**
- Create: `src/ui/StepperRow.ts`
- Create: `src/ui/SettingsControls.ts`
- Delete: `src/ui/AudioControls.ts`
- Modify: `src/scenes/MenuScene.ts` (import at line 6, usage at 46-48)
- Modify: `src/ui/PauseOverlay.ts` (import at line 4, usage at 49-51, hint at 57-60)

**Interfaces:**
- Consumes: `getSensitivity`, `setSensitivity` (Task 4); `PLAYER.sensitivityStep`, `PLAYER.sensitivityMin`, `PLAYER.sensitivityMax`, `PLAYER.sensitivityDefault` (Task 4).
- Produces:
  - `interface StepperAccess { get: () => number; set: (v: number) => number }`
  - `makeStepperRow(opts: { label: string; access: StepperAccess; step: number; format: (v: number) => string; fill: (v: number) => number }): Container`
  - `class SettingsControls { readonly view: Container }` — constructed with no arguments, positioned by its origin.

**Background:** stepped −/+ buttons are used rather than a drag-slider because this block renders inside the Pause overlay *under pointer lock*, where dragging cannot work. Keep that. Sensitivity is displayed as a percentage of the default (100% = 0.8) because "0.8" means nothing to a player.

There is no UI test harness in this project (Pixi needs a canvas), so this task is verified by playing.

- [ ] **Step 1: Create the reusable row**

Create `src/ui/StepperRow.ts`:

```ts
import { Container, Graphics, Text } from "pixi.js";
import { FONT_FAMILY } from "../config";
import { makeButton } from "./Button";

const BAR_WIDTH = 200;
const BAR_HEIGHT = 16;

/** Read/write pair backing one row. `set` returns the stored (clamped) value. */
export interface StepperAccess {
  get: () => number;
  set: (v: number) => number;
}

export interface StepperRowOptions {
  label: string;
  access: StepperAccess;
  /** How much one −/+ press changes the value by. */
  step: number;
  /** The value text shown to the right of the bar, e.g. "80%". */
  format: (v: number) => string;
  /** Fraction of the bar to fill for a given value, 0..1. */
  fill: (v: number) => number;
}

/**
 * One labelled setting row: name, filled bar, value text, and stepped −/+
 * buttons. Stepped rather than a drag-slider because these render inside the
 * Pause overlay under pointer lock, where a drag cannot work (ADR-0014).
 * Position the returned container by the row's center.
 */
export function makeStepperRow(opts: StepperRowOptions): Container {
  const view = new Container();

  const name = new Text({
    text: opts.label,
    style: { fill: 0xffffff, fontSize: 34, fontFamily: FONT_FAMILY },
  });
  name.anchor.set(1, 0.5);
  name.position.set(-200, 0);
  view.addChild(name);

  const bar = new Graphics();
  view.addChild(bar);

  const value = new Text({
    text: "",
    style: { fill: 0xcfd6e6, fontSize: 28, fontFamily: FONT_FAMILY },
  });
  value.anchor.set(0, 0.5);
  value.position.set(BAR_WIDTH / 2 + 110, 0);
  view.addChild(value);

  const redraw = (): void => {
    const v = opts.access.get();
    bar
      .clear()
      .rect(-BAR_WIDTH / 2, -BAR_HEIGHT / 2, BAR_WIDTH, BAR_HEIGHT)
      .fill({ color: 0x000000, alpha: 0.45 })
      .rect(
        -BAR_WIDTH / 2,
        -BAR_HEIGHT / 2,
        BAR_WIDTH * opts.fill(v),
        BAR_HEIGHT,
      )
      .fill({ color: 0x57d957 });
    value.text = opts.format(v);
  };

  const step = (dir: number) => (): void => {
    // Round to a clean step so fractional increments don't drift on float error.
    const next = Math.round((opts.access.get() + dir * opts.step) * 100) / 100;
    opts.access.set(next);
    redraw();
  };

  const minus = makeButton("−", step(-1));
  minus.position.set(-BAR_WIDTH / 2 - 50, 0);
  view.addChild(minus);

  const plus = makeButton("+", step(1));
  plus.position.set(BAR_WIDTH / 2 + 50, 0);
  view.addChild(plus);

  redraw();
  return view;
}
```

- [ ] **Step 2: Create SettingsControls**

Create `src/ui/SettingsControls.ts`:

```ts
import { Container } from "pixi.js";
import { AUDIO, PLAYER } from "../config";
import { makeStepperRow } from "./StepperRow";
import {
  getMusicVolume,
  getSfxVolume,
  setMusicVolume,
  setSfxVolume,
} from "../game/audio";
import { getSensitivity, setSensitivity } from "../game/settings";

const ROW_GAP = 76;

/**
 * The player settings block: Music, SFX, and Mouse Sensitivity rows. Volumes
 * route through game/audio (which applies them live); sensitivity routes
 * through game/settings and is picked up by GameScene on the next resume.
 *
 * Position `view` by the top row's center; rows lay out downward from the
 * container origin, so the block spans roughly [0 .. 2 * ROW_GAP] in Y.
 */
export class SettingsControls {
  readonly view = new Container();

  constructor() {
    const pct = (v: number): string => `${Math.round(v * 100)}%`;

    this.addRow(
      makeStepperRow({
        label: "Music",
        access: { get: getMusicVolume, set: setMusicVolume },
        step: AUDIO.volumeStep,
        format: pct,
        fill: (v) => v,
      }),
      0,
    );

    this.addRow(
      makeStepperRow({
        label: "SFX",
        access: { get: getSfxVolume, set: setSfxVolume },
        step: AUDIO.volumeStep,
        format: pct,
        fill: (v) => v,
      }),
      ROW_GAP,
    );

    this.addRow(
      makeStepperRow({
        label: "Sensitivity",
        access: { get: getSensitivity, set: setSensitivity },
        step: PLAYER.sensitivityStep,
        // Shown relative to the default: "100%" is meaningful to a player in a
        // way that the raw 0.8 is not.
        format: (v) => `${Math.round((v / PLAYER.sensitivityDefault) * 100)}%`,
        fill: (v) =>
          (v - PLAYER.sensitivityMin) /
          (PLAYER.sensitivityMax - PLAYER.sensitivityMin),
      }),
      ROW_GAP * 2,
    );
  }

  private addRow(row: Container, y: number): void {
    row.position.set(0, y);
    this.view.addChild(row);
  }
}
```

- [ ] **Step 3: Delete AudioControls and update both call sites**

```bash
git rm src/ui/AudioControls.ts
```

In `src/scenes/MenuScene.ts`, change the import on line 6 to:

```ts
import { SettingsControls } from "../ui/SettingsControls";
```

and replace the three usage lines with:

```ts
    const settings = new SettingsControls();
    settings.view.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 250);
    this.view.addChild(settings.view);
```

In `src/ui/PauseOverlay.ts`, change the import on line 4 to:

```ts
import { SettingsControls } from "./SettingsControls";
```

replace the three usage lines with:

```ts
    const settings = new SettingsControls();
    settings.view.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 220);
    this.view.addChild(settings.view);
```

and move the hint text down so the third row and its raw-input note do not collide with it — change its position line to:

```ts
    hint.position.set(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2 + 470);
```

> These Y values are chosen so the block's three rows land clear of the buttons above and the hint below, in a 1080-tall virtual space. Both scenes place three 48px buttons at y = 520/610/700, so the lowest button's text reaches about y=724. Menu: rows at 790/866/942. Pause: rows at 760/836/912, the Task 7 raw-input note at 954, hint at 1010. Verify visually in Step 5 and nudge if anything crowds.

- [ ] **Step 4: Type-check, lint, full suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean. A dangling `AudioControls` import anywhere will surface here.

- [ ] **Step 5: Verify by playing**

Run: `npm run dev`.
- On the Menu: three rows appear (Music, SFX, Sensitivity). Sensitivity reads **100%**. Press − and + and confirm it steps by 25% and the bar fill moves. Confirm it stops at 25% and 300%.
- Reload the page: the sensitivity you left it at persists.
- Click Play, then press Esc to pause: the same three rows appear, not overlapping the buttons or the "Click Resume to recapture the mouse" hint.
- Set sensitivity to 200%, click Resume, and fly: the ship should be markedly more responsive to the same hand motion.

- [ ] **Step 6: Commit**

```bash
git add src/ui/StepperRow.ts src/ui/SettingsControls.ts src/scenes/MenuScene.ts src/ui/PauseOverlay.ts
git commit -m "feat: add a mouse sensitivity row to a reusable settings block

Extracts the stepper row out of AudioControls, which becomes SettingsControls
and now carries Music, SFX, and Sensitivity."
```

---

### Task 7: Disclose whether raw mouse input was granted

**Files:**
- Create: `src/game/input.ts`
- Modify: `src/scenes/GameScene.ts` (`requestLock`, lines 255-269)
- Modify: `src/ui/SettingsControls.ts`

**Interfaces:**
- Consumes: `SettingsControls` (Task 6).
- Produces: `setRawInputGranted(v: boolean): void` and `getRawInputGranted(): boolean | undefined` from `src/game/input.ts`.

**Background:** `requestPointerLock({ unadjustedMovement: true })` asks for raw, un-accelerated deltas. Chromium grants it; Firefox and Safari reject and hand back OS-accelerated motion instead. That acceleration cannot be removed or measured from JavaScript, and it is one of only two variance sources the design could not eliminate (mouse DPI is the other). `requestLock` currently `.catch()`es the rejection and silently retries — throwing away the one signal that explains why the game feels different on another browser. Record it and show it.

The value is `undefined` until the first lock request settles: in the Menu, before the first Play, the answer is genuinely not yet known, so the UI shows nothing rather than guessing.

- [ ] **Step 1: Create the input module**

Create `src/game/input.ts`:

```ts
/**
 * Pointer-lock input capability, recorded the first time the game captures the
 * mouse.
 *
 * We request `unadjustedMovement: true` to get raw, un-accelerated deltas
 * (ADR-0006). Chromium grants it; Firefox and Safari reject and hand us
 * OS-accelerated motion instead. That acceleration cannot be removed or even
 * measured from JavaScript, so rather than hide it we record the fact and let
 * the settings UI say so — otherwise a player has no way to understand why
 * aiming feels different in another browser.
 *
 * `undefined` until the first lock request settles: in the Menu, before the
 * first Play, the answer is genuinely not yet known.
 */
let granted: boolean | undefined;

export function setRawInputGranted(value: boolean): void {
  granted = value;
}

export function getRawInputGranted(): boolean | undefined {
  return granted;
}
```

- [ ] **Step 2: Record the result in GameScene**

In `src/scenes/GameScene.ts`, add the import beside the other `../game/...` imports:

```ts
import { setRawInputGranted } from "../game/input";
```

Replace the body of `requestLock` with:

```ts
  private requestLock(): void {
    const el = this.manager.app.canvas as HTMLCanvasElement;
    const request = el.requestPointerLock as (options?: {
      unadjustedMovement?: boolean;
    }) => Promise<void> | void;
    const result = request.call(el, { unadjustedMovement: true });
    if (result && typeof (result as Promise<void>).catch === "function") {
      (result as Promise<void>)
        .then(() => setRawInputGranted(true))
        .catch(() => {
          // No raw-input support: retry plain, and record that OS mouse
          // acceleration is now riding on top of every delta we receive.
          setRawInputGranted(false);
          el.requestPointerLock();
        });
    }
    // Older no-promise API: we cannot learn the answer, so leave it unrecorded
    // and the settings UI simply says nothing.
  }
```

- [ ] **Step 3: Show it in the settings block**

In `src/ui/SettingsControls.ts`, extend the imports:

```ts
import { Container, Text } from "pixi.js";
import { AUDIO, FONT_FAMILY, PLAYER } from "../config";
import { getRawInputGranted } from "../game/input";
```

Then at the end of the constructor, after the Sensitivity row, add:

```ts
    // Only shown once we know — in the Menu before the first Play, we don't.
    const raw = getRawInputGranted();
    if (raw !== undefined) {
      const note = new Text({
        text: raw
          ? "Raw input: on"
          : "Raw input: off (OS mouse acceleration active)",
        style: { fill: 0x9aa0a6, fontSize: 22, fontFamily: FONT_FAMILY },
      });
      note.anchor.set(0.5);
      note.position.set(0, ROW_GAP * 2 + 42);
      this.view.addChild(note);
    }
```

Also extend the class doc comment with a sentence noting the block gains a raw-input line once the status is known.

- [ ] **Step 4: Type-check, lint, full suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean.

- [ ] **Step 5: Verify by playing**

Run: `npm run dev` in Chrome.
- On the Menu before playing: **no** raw-input line (status unknown).
- Click Play, then Esc to pause: the line reads `Raw input: on`.
- If Firefox is available, repeat there: the line should read `Raw input: off (OS mouse acceleration active)` and the game must still be fully playable.

- [ ] **Step 6: Commit**

```bash
git add src/game/input.ts src/scenes/GameScene.ts src/ui/SettingsControls.ts
git commit -m "feat: record and disclose whether raw pointer input was granted"
```

---

### Task 8: Document the decisions

**Files:**
- Create: `docs/adr/0023-configurable-sensitivity-and-lead-capped-steering.md`
- Modify: `docs/adr/0006-relative-mouse-control-under-pointer-lock.md` (add banner at top)
- Modify: `docs/DESIGN.md` (lines 12 and 47)
- Modify: `CONTEXT.md` (lines 10 and 48)
- Modify: `CONTRIBUTION.md` (line 42)

**Interfaces:** none — documentation only.

**Background:** the repo's precedent is that ADR-0008 amended ADR-0006 with a banner at the top rather than rewriting it. Follow that exactly. `docs/GLOSSARY.md` was checked and contains no Steering/Sensitivity/Engine entries, so it needs no change.

- [ ] **Step 1: Write ADR-0023**

Create `docs/adr/0023-configurable-sensitivity-and-lead-capped-steering.md`:

```markdown
# Steering sensitivity is player-configurable, and the steer-target's lead over the ship is capped

> **Amends ADR-0006.** The relative-steering core of that ADR stands. What changes: mouse deltas now map to world distance rather than screen distance, `maxSpeed` is gone, and sensitivity is a player setting rather than a constant.

Movement felt laggy and inconsistent for two structurally separate reasons, and both are fixed here.

**The lag was unbounded chase debt.** The ship eased-follows a free-floating target, and with exponential smoothing a target moving at velocity `v` leaves the ship trailing `v / followResponse` behind — at the old `followResponse: 12`, roughly 200px on a fast flick. On a direction reversal the target had to travel all of that back before the ship visibly turned. That is the rubber band. We now cap how far the target may lead the ship (`PLAYER.maxLead`, 75px), so the debt is bounded no matter how violent the gesture.

That cap **subsumes the old `maxSpeed` teleport-guard**, which is deleted. Ship velocity is `followResponse * lead`, so bounding the lead bounds the speed — `followResponse * maxLead` — through the easing itself rather than through a separate clamp on the step. The old clamp engaged whenever the target was more than ~147px away, reachable on any decent flick, and switched the ship from eased motion to a flat 1600px/s and back: a discontinuity in the motion law, mid-gesture, which read as inconsistency. There is now one motion law. `followResponse` rises 12 → 20 to keep traversal speed under the tighter cap; the two constants are coupled and must be tuned together.

A consequence we accept: ADR-0006 deliberately froze `maxSpeed` so the Engine upgrade would not raise top speed. With top speed now emergent, **Engine does raise it** (1500 → 2250 across its 10 stacks). An "Engine" upgrade making you faster matches player expectation and gives a common-rarity upgrade a clearer identity.

**The inconsistency was per-machine variance with no correction available.** Three sources, of which we can only eliminate one. Window size was ours: deltas were divided by the letterbox scale, so a half-size window moved the ship twice as far in world terms — that division is dropped for steering, and hand motion now maps to world distance so muscle memory survives a resize. (The Menu Cursor keeps the division; it is a genuine screen-space cursor.) The two we cannot eliminate are **mouse DPI**, which no web API exposes and which varies ~4x across common hardware, and **OS pointer acceleration on Firefox and Safari**, where `unadjustedMovement` is rejected and the acceleration curve is not exposed. Both are why sensitivity becomes a persisted player setting (0.2..2.4, shown as 25%..300% of default): the achievable goal is *deterministic given a sensitivity value*, not identical out of the box. Since the browser difference is real and invisible, we record whether raw input was granted and say so in the settings UI rather than leaving a player to wonder.

**The Engine upgrade becomes multiplicative** as a direct consequence. It previously added 0.1 per stack to a fixed base of 0.8, reaching x2.25 at cap. Against a player-chosen base an additive bonus warps wildly — at a 0.2 setting, +1.0 is a 6x boost; at 2.4 it is barely 1.4x — so the upgrade's power would depend on the player's mouse. It now multiplies by `1 + stacks * 0.125`, holding that x2.25 for everyone. `responseAmount` stays additive; `followResponse` has no user setting, so no such distortion arises.

The steering arithmetic moved into a Pixi-free `game/steering.ts` so these invariants are unit-testable: that the lead cap holds under any delta, that the bounds clamp can only shorten the lead, and — the property that makes the game feel identical at 60, 144, and 240Hz — that N steps of `dt` compose exactly to one step of `N*dt`.

Considered and rejected: **replacing the target-chase with smoothed input deltas applied straight to the ship**, which would eliminate steady-state lag entirely rather than bounding it — the correct answer in the abstract, but it discards the eased chase ADR-0006 records as a deliberate choice, needs a full retune, and risks reading as twitchy for a ship meant to feel weighty; the lead cap can be tightened toward this later if wanted. **A second slider for `followResponse`** — one tuning knob is enough, and a second invites players to detune the game.
```

- [ ] **Step 2: Add the amendment banner to ADR-0006**

In `docs/adr/0006-relative-mouse-control-under-pointer-lock.md`, immediately after the existing ADR-0008 amendment blockquote, add a second one:

```markdown
> **Amended by ADR-0023.** Three changes: mouse deltas now map to world distance, not screen distance (the `/scale` normalization is dropped for steering); `maxSpeed` no longer exists — a cap on the steer-target's *lead* bounds speed instead, so the Engine upgrade now does raise top speed; and sensitivity is a persisted player setting that Engine multiplies rather than a constant it adds to. The relative-Steering core below still stands.
```

- [ ] **Step 3: Update DESIGN.md**

In `docs/DESIGN.md`, replace line 12 with:

```markdown
- **Mouse only, relative.** Under Pointer Lock, mouse *motion* shoves a free-floating target the ship eased-follows — not the cursor's position. The target may never lead the ship by more than `PLAYER.maxLead`, which bounds lag and caps top speed in one rule. Sensitivity is a persisted player setting; the Engine upgrade multiplies it. See docs/adr/0006 and docs/adr/0023.
```

and replace the Engine row on line 47 with:

```markdown
| Engine | 10 | common (12) | mouse sensitivity (x2.25 at cap) + follow responsiveness, which also raises top speed |
```

- [ ] **Step 4: Update CONTEXT.md**

In `CONTEXT.md`, append to the end of the Steering paragraph (line 10):

```markdown
 How far the ship travels per unit of hand motion is a player setting, adjustable from the Menu or the Pause overlay, because mouse DPI varies several-fold across hardware and no browser API exposes it.
```

and replace the Engine entry (line 48) with:

```markdown
The stat Upgrade that improves Steering: each level multiplies sensitivity (the ship travels farther per unit of hand motion — the player's sense of "ship speed") and makes the ship's chase of its target snappier, which also raises its top speed. Multiplying rather than adding keeps the Upgrade equally powerful for every player whatever sensitivity they set.
```

- [ ] **Step 5: Update CONTRIBUTION.md**

In `CONTRIBUTION.md`, replace the Engine row (line 42) with:

```markdown
| Engine | common | 12 | 14.8% | 10 | Faster, more responsive movement — x2.25 sensitivity and +10 follow response at cap, raising top speed 1500 → 2250 |
```

- [ ] **Step 6: Check the docs are consistent**

Run: `grep -rn "maxSpeed" docs CONTEXT.md CONTRIBUTION.md src --include=* | grep -v node_modules`
Expected: exactly two hits, both unrelated to the player — `MINE.maxSpeed` (`src/config.ts:359`) and `DEBRIS.maxSpeed` (`src/config.ts:769`). Any hit referring to the player ship means something was missed; update it.

- [ ] **Step 7: Final full verification**

Run: `npm run build && npm test`
Expected: lint, type-check, production build, and all tests clean.

- [ ] **Step 8: Commit**

```bash
git add docs CONTEXT.md CONTRIBUTION.md
git commit -m "docs: record the steering rework in ADR-0023 and update the balance references"
```

---

## Self-Review

**Spec coverage** — every spec section maps to a task:

| Spec section | Task |
| --- | --- |
| §1 Input pipeline (world mapping, Menu Cursor keeps `/scale`) | 3 |
| §2 Lead cap replaces teleport-guard; constant retune | 2 |
| §3 Storage, config, slider range | 4 |
| §3 Engine multiplicative | 5 |
| §3 Live application on resume | 5 |
| §3 Raw-input disclosure | 7 |
| §4 UI — StepperRow, SettingsControls, layout | 6 |
| §5 Module boundary — pure `steering.ts` | 1 |
| Testing 1-5 (lead, radial, bounds, frame-rate, dt floor) | 1 |
| Testing 6 (Engine mouse-independence) | 1 (linearity) + 5 (config invariant) |
| Testing 7 (settings persistence) | 4 |
| Docs and ADR | 8 |

**Type consistency** — checked across tasks: `advanceTarget`/`easeToward`/`SteerBounds` are defined in Task 1 and consumed with matching signatures in Task 2. `PLAYER.sensitivityDefault` is flagged in Task 2 as not-yet-existing and introduced in Task 4, with Task 4 Step 2 closing the gap. `sensitivityMult` is declared in Task 5 Step 4 and written by Task 5 Step 5. `StepperAccess.set` returns `number`, matching `setMusicVolume`/`setSensitivity`. `getRawInputGranted` returns `boolean | undefined` and is consumed with an `undefined` check.

**Ordering** — Task 2 deliberately leaves a known-broken reference (`PLAYER.sensitivity`) that Task 4 repairs; both tasks call this out. Every other task ends with a clean `npx tsc --noEmit && npm run lint && npm test`.

**Verified against the real toolchain before writing:** importing `upgrades.ts` under Vitest's node environment resolves without pulling in PixiJS (the `Player` import is type-only and gets elided), and the `vi.stubGlobal` + `vi.resetModules` + dynamic-import pattern in Task 4 was run against the actual `settings.ts` and passes, including the no-`localStorage` case.
