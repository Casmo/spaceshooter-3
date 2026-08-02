# Stars sink, and can be launched

Every **Star** in the game now drifts gently downward for its whole life, and a Star may optionally be spawned with an initial velocity that decays into that drift. This applies to every pickup in every Wave from Wave 1 — it is not a Lode-specific variant.

## Before

A Star was pinned to the point where its kill happened. It span in place for its 5-second lifetime, blinked near expiry, and eased toward the ship once inside the player's pickup range. Position never changed otherwise. A Star dropped high on the field by a high-flying enemy was, in practice, a Star the player would never collect.

## After

- Every Star sinks at a constant `STAR.sinkSpeed` (~70 px/s → ~350px over its 5s lifetime).
- A Star may be spawned with an optional `(vx, vy)` impulse. That impulse decays exponentially at `STAR.burstDamping` into the constant sink, so it drifts ≈ `speed / damping` (≈70-125px at the burst speeds) and then settles.
- A Star spawned **without** an impulse is a pure sinker, so every existing call site keeps working unchanged — the two new parameters default to zero.
- A Star that sinks past the bottom edge is killed early rather than lingering invisibly below the field.
- Lifetime stays 5s globally; the magnet and collect radius are untouched. Once inside pickup range the existing eased attraction still applies *on top of* the drift.

## Why this, and why globally

The Lode (ADR-0021) needed two things a static pickup could not give it: a high-lane drip that is actually reachable from the player's zone, and a death payout that visibly *bursts out* of the explosion rather than quietly appearing at a point.

The obvious scoped fix was a second Star variant — a Lode-specific pickup that moves. That was rejected. The glossary is explicit that there is exactly one collectible in v1, and a second kind would have to be told apart on sight, given its own XP value, its own lifetime, and its own drop rules; the player would have to learn a distinction that carries no gameplay meaning. Making the *one* Star capable of motion, with the impulse optional, gets both behaviours with no new vocabulary and no new art: a Lode's burst Stars are ordinary Stars that happen to be launched.

Giving the sink to every Star rather than only to launched ones is the deliberate half of this. A pickup that hangs motionless where a ship exploded reads as a decal pinned to the screen; one that drifts reads as an object in a moving world, which is what the rest of the field already does. It also quietly fixes a long-standing annoyance — kill drops that expired untouched because they landed above the player's usual position now sink toward it.

## Consequences

- **This is the wider-reaching half of the Lode work.** It touches every pickup, in every Wave, from Wave 1 — which is why it gets its own ADR rather than being buried in the Lode's.
- **Slightly more XP reaches the player**, since fewer drops expire untouched. Small, accepted, and not compensated for: no retune of the Star's XP value, lifetime, drop chance, or collect radius ships with this, and the Level-up threshold curve is untouched.
- **Partial collection of a large burst is an accepted outcome.** A Lode's shower is deliberately wider than the base collect radius; sweeping it is the moment that gives Pickup Range levels (the "Tractor Beam" card) their obvious value.
- The off-bottom cull is a small behaviour change for ordinary drops too: a Star dropped very low can now expire by leaving the field slightly before its 5s is up. This is the correct read — it is gone either way, and culling keeps it out of the live list.
- `STAR.sinkSpeed`, `burstSpeedMin`/`burstSpeedMax`, and `burstDamping` are the knobs. The damping was originally tuned so a burst's outward drift (~140-250px) matched the Kill Burst's footprint at the Lode's then-sprite scale of 5.

  **Amended:** the Lode went to scale 2.5 and then, with its dedicated art (ADR-0021), to **scale 2** — a 64px Kill Burst half-footprint against a shower that was still flinging 140-250px, so the loot read as scattering *from* the burst rather than riding it. The halving flagged here has now been done: `burstSpeedMin`/`burstSpeedMax` are **125/225**, settling at ~70-125px. The playtest call this note was waiting on came down on the side of the match — a shower that visibly bursts open out of the explosion beats a wider sweep, and Pickup Range still has plenty to reach for across a 10+ Star cluster. Retune the **speeds**, not the damping, if the Lode's scale moves again.
