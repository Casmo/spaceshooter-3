# Drones: an orbiting companion weapon with a per-target ramping beam

> **Amended by ADR-0020:** the ramp is no longer per-target. It is now per-*drone* **Heat** that persists through kills and target switches and decays exponentially only while the drone is idle. Everything else here — the orbit, independent per-drone targeting, the uncapped single-target shield-ignoring beam, the dedicated drone manager — still stands. The "charge tied to the target, not the firing state" option below was reversed; read ADR-0020 for why.

The **Drones** Upgrade (legendary, "+1 drone per level", cap 3) adds a third independent weapon: small **Drones** that orbit the ship and, fully autonomously, fire a continuous **Drone Beam** at the nearest enemy within range. Each beam's damage climbs the longer it holds a single target and **resets when that target dies or leaves range**. It follows ADR-0018's "independent weapon" template but adds two things the game has never had — a *persistent entity that follows the player* and a *continuous beam*.

## Context

ADR-0018 established that new weapons (it named "drones, beams" explicitly) get their own template: own state, own pool, own resolution pass in `GameScene` — never folded into the bullet Modifier system. The Missile is the first such weapon, but it *fires and leaves*: it reads the ship position once at spawn and never follows.

A Drone is different in kind again: it is a **long-lived entity that orbits the ship**, targets independently, and deals **continuous per-frame damage** rather than discrete projectile hits. Nothing in the codebase follows the player (the closest pattern is the Warden's orbiting Shield Nodes) and nothing draws a beam (the closest pattern is Burn's `hp -= dps*dt` tick — but with no renderer).

## Decision

Model Drones as a **scene-owned set of orbiting emitters**, reconciled to `player.droneLevel` each frame (spawn on level-up; none ever despawn; indestructible).

- **Orbit:** evenly spaced on a ring, slow constant rotation, each drone *soft-follows* (exponential ease) toward its orbit slot so it floats and lags rather than welding to the ship. Same easing idiom as player Steering and the Shield-Node positioning.
- **Targeting:** each drone independently locks the nearest enemy within `DRONE.range` **of its own position** (via the existing `nearestEnemy` scan), giving natural per-arc coverage. No target → idle, beam off.
- **Beam:** a single-target continuous beam. Per frame the locked enemy takes `currentDps * dt` (the Burn model). `currentDps = baseDps + rampPerSec * secondsLocked`, **linear and uncapped**. The charge is a property of *this lock on this target*: when the enemy dies or leaves range the drone re-acquires the new nearest and the ramp restarts from `baseDps`.
- **Rendering:** a net-new `Graphics` beam (core line + low-alpha glow underlay), drone → target, with width, brightness, and a **cyan→white→orange-red heat color** all driven by `currentDps`. A cosmetic `visualMaxDps` saturates the look (max width/hottest color) while real damage keeps climbing past it.
- **Resolution:** a dedicated `resolveDroneHits`-style pass in `GameScene`, reusing the shared `destroyEnemy` reward path. Drone → enemy only; enemies never damage drones.
- No bullet Modifier touches it; Fire Rate and the gun's cadence are irrelevant (it is not trigger-gated).

## Considered options

- **Charge tied to the drone's firing *state* vs. the *specific target* (chose target).** State-based charge would keep climbing as long as *any* enemy is in range — so in the relentless endgame (a Mini-boss every wave, ADR-0016) the beam would essentially never reset and ramp toward oblivion. We chose **per-target** charge instead: killing the locked enemy or letting it leave range drops the beam back to `baseDps`. This makes the Drone a *tank-melter* — it spins up hard on lone high-HP targets (Wardens, Boss, Mini-boss, SpaceStation) and stays gentle against fast-dying swarms — a cleaner, more legible identity than an ever-climbing global beam, and it needs no grace-window hack to avoid flickering to zero as swarm enemies pop.
- **Charge shared per-target across drones (rejected).** Simpler-sounding, but each drone targets independently (nearest to *its* arc), so there is no single shared lock. Each drone owns its own lock and its own ramp; two drones on the same boss each climb separately and stack.
- **Beam damage capped (rejected).** The uncapped linear ramp is the point — "no limit," and it is what lets the weapon scale into the endgame against high-HP capstones. The cap is purely cosmetic (`visualMaxDps`), never on the damage.
- **Reuse `ProjectilePool` like the Missile (rejected).** Drones are persistent, position-bound to the ship, and deal continuous (not on-contact) damage — none of which the projectile pool models. A small dedicated drone manager is the right seam; the beam renderer has no precedent to reuse and is built fresh.

## Consequences

- **Drones hard-counter the Warden — deliberately.** The beam ignores the Warden's Shield and damages the body directly (matching the Missile's shield-agnostic AoE, ADR-0018). A legendary companion trivializing one enemy's gimmick is an accepted, priced-in payoff; teaching the beam to chew Shield Nodes first is noted as a possible future refinement, not built now.
- **"Follows the player" is a new capability.** The Drone is the first friendly entity that tracks the ship each frame. Future companions can copy the orbit-slot + soft-follow pattern.
- **First continuous beam.** The `Graphics` beam renderer (charge-driven width/glow/heat-color) is net-new and reusable by any future beam weapon.
- **Coverage vs. concentration is emergent.** Because targeting is per-drone-nearest, three drones in a swarm fan out to three enemies (coverage); against a lone boss all three lock it and triple the melt (concentration). No code enforces either — it falls out of the targeting rule.
