# Drone Heat persists across targets and cools only while idle

A Drone Beam's damage is now driven by **Heat**, a quantity owned by the *Drone* rather than by its lock on one enemy. Heat builds the whole time the Beam fires — through kills and target switches alike — and drains only while the Drone is **idle**, with no enemy in range at all. Cooling is **exponential** (proportional to current Heat), so it outpaces the build at every level that matters.

This **reverses the central targeting decision of ADR-0019**, which deliberately chose per-target charge and reset the ramp whenever the locked enemy died or left range. ADR-0019's other decisions — the orbit, per-drone independent targeting, the shield-ignoring single-target beam, the uncapped ramp, the dedicated drone manager — all stand.

## Context

ADR-0019 tied the ramp to *this lock on this target*: kill the enemy and the Beam dropped back to `baseDps`. Its stated reason for rejecting state-based charge was the Wave-25+ relentless endgame (ADR-0016) — with a Mini-boss on the field every Wave, a state-based ramp "would essentially never reset and ramp toward oblivion."

In play the per-target reset turned out to be the weapon's main frustration rather than its identity. Because the ramp was the *only* thing that made a Drone dangerous and it took ~10s of unbroken fire to matter, the Drone was near-useless in exactly the situations the player spends most of their time in: any wave with more than one enemy. Every Swarmer that popped — the fastest, most common death in the game — threw the whole investment away, so a legendary-tier Upgrade spent most of a Run outputting close to `baseDps`. Worse, the reset was invisible: the beam snapping from orange-red back to thin cyan read as a bug, not as a rule.

The fix keeps the ramp as the identity but changes what interrupts it: not *a kill*, but *a lull*.

## Decision

Replace the per-lock `lockSeconds` counter with a per-drone `heat`, stored **in dps** (not seconds — the quantity is no longer a linear function of a clock).

- **Damage:** `dps = DRONE.baseDps + heat`. Heat starts at 0 for every new Drone, so `baseDps` remains the floor.
- **Build:** while the Beam has a target, `heat += DRONE.heatPerSec * dt`. Unchanged rate, **still uncapped** — ADR-0019's "capped damage" rejection stands, and the runaway endgame it warned about is accepted as the price of the change (see Consequences).
- **Persist:** neither a kill nor a re-acquire touches Heat. The three sites that zeroed the ramp — on kill, on re-acquire, and while idle — collapse to a single decay path. Targeting logic itself is untouched: still nearest-enemy-within-range-of-this-drone, sticky while that enemy lives and stays in range.
- **Cool:** while the Drone has no target, `heat *= 0.5 ** (dt / DRONE.coolHalfLife)` with `coolHalfLife = 0.75`. Half-life is stored directly rather than a time constant — it is the number a designer actually reasons in. Proportional decay is the deliberate pairing with the uncapped build: the brake scales with the thing it has to brake. A 3s Breather takes a 1800-dps Drone down to ~130.
- **Frozen with the game:** `GameScene.update` returns early on an open Upgrade Prompt, a pause, or a lost pointer lock, so Heat neither builds nor cools while frozen. Free, and correct — deliberating over a card must not cost spin-up.
- **Survives a lost Life.** Death costs a Life and full HP; it does not cost the Drones. This also avoids plumbing a life-loss signal from `Player.takeHit` into `DroneSwarm`, which does not exist today.
- **Visual:** two changes, both because Heat is now persistent state the player must be able to read.
  - The heat gradient maps **logarithmically** — `t = log1p(heat / visualHeatKnee) / log1p(visualHeatFull / visualHeatKnee)`, knee 60 — instead of the old linear `dps / visualMaxDps` ratio, so it stays vivid in the first seconds *and* keeps creeping past 1000 dps rather than pinning. The old `visualMaxDps = 300` becomes `visualHeatFull = 3000`: with Heat persisting across a Wave, 300 is now reached within ~10s and is no longer anywhere near the top of the range.
  - The **Drone sprite itself is tinted** by the same gradient, firing or not — the only way to see that an idle Drone is still scorching, and to watch the cooling clock run. The tint blends from *untinted* toward the beam colour by `t`, rather than being set to the beam colour outright, or a stone-cold Drone would sit permanently washed cyan.

## Considered options

- **Linear decay at a fixed multiple of the build rate (rejected).** The obvious reading of "decrease faster than the increase," and a one-line subtraction that keeps Heat in seconds. But at 3× (90 dps/s) a 3s Breather shaves only 270 dps off an 1800-dps Drone — once hot, effectively permanent, which is no brake at all. Pushing the multiple high enough to matter at the top (~8×) wipes a fresh Drone almost instantly. Only a proportional rate is fast at both ends.
- **Capping the damage (rejected again).** Re-litigated, because removing the per-target reset removes the only bound ADR-0019 had. Rejected for the same reason as originally: the uncapped climb *is* the weapon, and a ceiling would make a legendary stop scaling exactly when the Waves do not.
- **Resetting Heat on a lost Life (rejected).** A legible penalty that would blunt "die freely, the Drones carry you." Rejected as re-introducing precisely the kind of hard, invisible reset this ADR removes — and the respawn teleport already buys an incidental cool-down, since the Drones lag behind the ship and usually go briefly out of range.
- **A minimum decay floor (rejected).** Because decay is proportional, cooling is *slower* than the 30 dps/s build below ~32 dps of Heat — a real violation of the requirement, confined to the bottom 2% of the range. A `max(proportional, floor)` would close it, but the band is where the Drone deals 20–52 dps against 24-HP Swarmers; not worth a constant and a special case.
- **Heat shared across the swarm (rejected).** Attractive once Heat is persistent — one number to read, and the 3-Drone build would spin up as a unit. But it fights ADR-0019's independent per-arc targeting, and it would mean a Drone idling on an empty flank drags down the two melting a Boss.

## Consequences

- **The Drone's identity changes from *tank-melter* to *sustained-fire*.** ADR-0019 sold it as fierce on lone high-HP enemies and gentle on fast-dying swarms. That is now false in both halves: a Drone chewing through a Swarmer flock keeps every point of Heat it earns, so swarms *feed* it. The new axis is time-without-a-lull, not target size. `CONTEXT.md` records `tank-melter` on the Avoid list for exactly this reason.
- **The endgame runaway ADR-0019 predicted is now real, and accepted.** Past Wave 25 something is almost always in range, so Heat trends up across a whole Wave; three Drones at ~1800 dps each delete a Boss in seconds. This was chosen with the arithmetic on the table. If it proves too strong, the cheapest levers in order are: shorten `coolHalfLife`, lower `heatPerSec`, then reconsider the cap — *not* restoring the per-target reset.
- **The Breather becomes a balance lever.** The ~3s enemy-free pause between Waves is the one guaranteed idle window, so it is now the de-facto ceiling on carry-over between Waves. Changing the Breather's length silently retunes the Drones.
- **A Drone is weakest exactly when it is picked up**, and a second or third Drone joins cold beside hot siblings. Both fall out of the model rather than being designed; both are fine (a fresh legendary that has to be *earned up* reads well), but a player who takes Drones during a Breather sees nothing happen for a few seconds.
- **`lockSeconds` was renamed, not just retyped.** The old name lied twice over — the quantity is neither per-lock nor in seconds. Heat's unit is dps, which makes `dps = baseDps + heat` read directly.
