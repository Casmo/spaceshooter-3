# Spaceshooter 3 — Design Spec (v1)

A vertical-scrolling roguelike shmup in PixiJS v8 + TypeScript + Vite. Glossary lives in `/CONTEXT.md`; architectural decisions in `/docs/adr/`. This doc is the buildable spec — all numbers here are starting values and live in a single central `config.ts`.

## 1. Platform & rendering
- **Stack:** PixiJS v8, TypeScript, Vite. Add `@pixi/sound`. Browser-first; v2 packages as an nw.js executable.
- **Virtual resolution:** fixed **1920×1080 (16:9 landscape)**, scaled to fit the window with letterboxing (see ADR-0002). Vertical scroll: starfield top→bottom, enemies from the top, player near the bottom.
- **Target:** 60fps on a typical laptop.
- **Central tuning:** every tunable (caps, weights, curves, costs, lifetimes, percentages) lives in `config.ts`.

## 2. Controls
- **Mouse only, relative.** Under Pointer Lock, mouse *motion* shoves a free-floating target the ship eased-follows — not the cursor's position. The target may never lead the ship by more than `PLAYER.maxLead`, which bounds lag and caps top speed in one rule. Sensitivity is a persisted player setting; the Engine upgrade multiplies it. See docs/adr/0006 and docs/adr/0023.
- **Left mouse = fire**, hold-to-fire with a cooldown.
- **Esc / P** = toggle pause (Resume / Restart / Quit-to-Menu overlay).

## 3. Player
- Start of Run: **3 lives, 100 HP**, no upgrades.
- **Small core hitbox** (~20–30% of the 241×187 sprite).
- **I-frames:** ~1s after any hit, ~2s on respawn, with a blink.
- At 0 HP → consume a Life, respawn at full HP. At 0 Lives → game over.
- Death keeps all upgrades (they only reset on a brand-new Run).

## 4. Weapon & bullet modifiers
One weapon (ADR-0001). Base stats in `config.ts`. **Shooting Power = damage per shot.** **Fire Rate = cooldown.**

Six orthogonal, stacking **Modifiers** (Spread was removed — ADR-0010):

| Modifier | Effect |
|---|---|
| Multishot | +1 projectile per level; the volley auto-fans by a fixed per-bullet gap |
| Pierce | bullets pass through N enemies |
| Homing | bullets curve toward nearest enemy |
| Explosive | small AoE on impact (`fire.png`) |
| Burn | damage-over-time on hit |
| Bounce | on any hit (incl. pierce hits) spawn **1 Bounce-bullet** in a random direction: a **full clone** of the parent — full damage, unlimited range, all other Modifiers inherited — but **pierce stripped**. Level = **generational depth** (parent passes `level−1` down); chains until depth 0. Cannot hit the enemy just struck (Homing also skips it). Legendary, cap 3. See ADR-0005. |

**Projectile visuals (player):** styled by modifiers, NOT by damage. Base sprite chosen by priority — `Explosive/Homing → rocket` › `Pierce → laser-1/2/3` › `Burn → fire` › `Multishot → plasm` › none → `bullet`. Per-modifier trail/tint effects layer on top (Burn=orange flame, Homing=cyan, Explosive=red, Pierce=blue). Rocket is the headline look when several are active *(known tradeoff: rocket-look + pierce can mislead; revisit later)*.

## 5. Upgrades (12 types)
Drawn 3 at a time on Level-up, weighted-random, distinct, not-yet-maxed. Game pauses. `0` cap = unlimited. ≥3 unlimited types guarantee the draw never runs dry (Damage / Fire Rate / HP).

**Rarity tier *is* the draw weight** (ADR-0009): common 12 / uncommon 8 / rare 4 / epic 2 / legendary 1. Rarity is no longer cosmetic. Intra-tier exceptions are expressed via `cap`, not weight.

| Upgrade | Cap | Rarity (weight) | Notes |
|---|---|---|---|
| Damage | ∞ | common (12) | +6 damage per level |
| Engine | 10 | common (12) | mouse sensitivity (x2.25 at cap) + follow responsiveness, which also raises top speed (~1500 → ~2080px/s at 60Hz; frame-rate dependent, see ADR-0023) |
| Fire Rate | ∞ | common (12) | **diminishing**: `cooldown *= 0.95`/lvl, asymptotic, never 0 |
| Tractor Beam | 5 | common (12) | larger star pickup range (maxes usefulness by lvl 5) |
| Pierce | 5 | uncommon (8) | bullets pass through +1 enemy/lvl |
| Burn | 10 | uncommon (8) | damage-over-time on hit |
| HP | ∞ | rare (4) | +25 max HP per level |
| Explosive | 10 | rare (4) | AoE cleave on impact; scales with Damage |
| Extra Life | 3 | epic (2) | +1 life (capped so a run can't trend to immortality) |
| Homing | 3 | epic (2) | curve toward locked enemy; turn rate 4/8/12 (no dead levels) |
| Multishot | 10 | legendary (1) | +1 projectile per level |
| Bounce | 3 | legendary (1) | spawns full clone bullets that chain (ADR-0005) |

Per-upgrade `cap` and effect curve remain configurable; `weight` is derived from the rarity tier.

## 6. XP & leveling
- XP auto-granted per kill, scaled by enemy type (small → least, elite → most).
- **Plus** an occasional **Star** pickup (XP-only collectible).
- **Growing threshold** (geometric, ~+20–25%/level). Tuned so an average Run ≈ **30** Level-ups, a great Run ≈ **50**.
- First Level-up comes fast (hook), then they space out.

## 7. Star pickup
- ~5% drop chance per kill (tunable per enemy type; elites higher; **mini-boss guaranteed**).
- Lifetime ~5s then fades/expires.
- Worth ~5–10 normal kills of XP.
- Collected by flying within radius; **Pickup Range** upgrade (uncommon green, cap 10) enlarges the radius and **eases the Star toward the ship** within range.

## 8. Waves & enemies
- **Discrete, endless Waves.** Each Wave = a spawn budget; clear all → **~3s Breather + "Wave N" banner** → next, harder Wave.
- **Capstones are embedded, not standalone** (ADR-0011): every milestone Wave runs its normal scaling budget **plus** a single Capstone spliced in mid-wave (after ~⅓ of the adds). A **Mini-boss** anchors every 5th Wave; a **Boss** anchors every 10th (overriding the mini-boss there). Guaranteed Star on the capstone's death.
- Difficulty scales via enemy count, HP, speed, mix, and **higher Asteroid split counts** in later Waves.

| Enemy | Sprite | Behavior |
|---|---|---|
| Swarmer | `insect-1` | small, fast, low HP, formations/sine, contact damage, no shooting |
| Gunner | `insect-2` | bigger, slower, more HP, fires at player |
| Asteroid | `small/medium/large-A/B` | drifts down, contact damage, splits per `splitCount` (large→medium→small) |
| Mini-boss | scaled `insect-2`/`large` | every-5th-wave capstone (embedded in the budget), high HP, simple pattern |

- **Enemy bullets:** recolored `plasm.png`, **tinted by damage tier** (white→yellow→orange→red→purple) so threat is readable.
- Contact with any enemy = damage to player.

## 9. HUD (overlaid on 16:9 field)
- Top-left: Score (+ best under it). Top-center: Wave # / banner. Top-right: Lives (ship icons) + counter.
- Bottom full-width: XP bar. Bottom-left/above XP: HP bar + current Level.

## 10. Screens & flow
- **Main menu:** Start, Credits, Exit. **Exit = `window.close()`** (works under nw.js / script-opened windows; no-op in a normal tab).
- **Credits:** "Spaceshooter 3" · Created by Mathieu · Art by **Lil Cthulhu** (lil-cthulhu.itch.io) · Built with PixiJS · Back button.
- **Game over:** this Run's stats vs. persisted bests + Play Again.

## 11. Persistence (localStorage)
- Track & persist: **Score** (primary), **best Wave**, kills, time survived, level reached, **bullets fired**.
- Structure the stats store so it can feed **Steam stats later** (v2, not now).
- No power meta-progression — Runs stay pure roguelike.

## 12. Performance
- **Object pooling** for projectiles/enemies/particles.
- **Hard cap on live projectiles** (~1500) as a named `config.ts` variable; oldest despawn if exceeded.

## 13. Audio
- Build a sound system with named hooks (shoot, hit, explosion, level-up, game-over, menu music) via `@pixi/sound`. **Silent until files are supplied** — no external assets sourced.

## 14. Assets
- **In use:** `SpaceShip`, `insect-1/2`, `small/medium/large-A/B`, `bullet`/`plasm`/`laser-1/2/3`/`rocket`/`fire`, `bg`/`Stars-A/B`, `star.png` (copy of `bunny.png`, real art TBD).
- **Spare:** `bullet-1/2` (possible multishot visual tiers).
- **Parked for v2:** `bonus_life`, `bonus_shield`, `bonus_time`, `shield`, `support`.

## Build order (suggested)
1. Scaffold: virtual-resolution canvas + letterbox scaler, scene/state manager (Menu → Game → GameOver), central `config.ts`, asset loader, `star.png` copy.
2. Player: relative mouse steering (Pointer Lock), hold-to-fire base weapon, HP/lives/i-frames, small hitbox.
3. Enemies + waves: Swarmer/Gunner/Asteroid (with splitting), wave budget + breather + banner, mini-boss every 5th. Object pooling.
4. XP & upgrades: kill XP, Star pickup + magnet, Level-up prompt (3 weighted cards, rarity colors), the 13 upgrade types.
5. Bullet modifiers: all 7, stacking, priority sprite + layered trails, projectile cap.
6. HUD + persistence + game-over stats vs bests.
7. Menu + Credits + Exit, pause overlay, audio hooks (silent).
8. Balance pass against the 30/50 Level-up targets.
