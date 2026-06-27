# Wardens carry multi-collider Shields

The **Warden** (a late-game enemy, wave 15+) is guarded by a **Shield**: a ring of orbiting, individually destructible **Shield Nodes**. To make this work, an enemy may now own **child colliders** that the player-bullet collision pass tests *before* the body. This generalizes an enemy from a single circle hitbox to **body + an optional ring of sub-hitboxes**.

## Before

Every enemy was one circle. `resolveBulletHits` tested `circlesOverlap(bullet, enemy)` against the enemy's single `radius`, and a hit always meant `applyBulletHit` on that enemy. `takeDamage(amount)` was a position-blind HP subtraction — a bullet either hit the enemy or it didn't, and where it struck never mattered.

## After

A Warden carries a small set of Shield Nodes orbiting at a fixed radius, each with its own HP. Because the player's weapon only ever fires straight up (ADR-0006), a Node covering the bottom blocks shots and a gap rotating into the line of fire lets them through. The collision pass gains a shielded branch:

- **Broad-phase to the outer orbit.** A shielded enemy's effective extent is `orbitRadius + nodeRadius`, not the body radius, since a Node can be struck before the body.
- **Resolve node / gap / body.** A shot overlapping a live Node is stopped there and chips that Node's HP — it never reaches the body. A shot that overlaps the outer extent but lands in a **gap passes through** (it is *not* consumed) and continues toward the body. A shot reaching the body damages it normally.
- **Destroyed Nodes are gone for good**, permanently widening the gap — so the Shield is beaten two ways, freely mixed: out-time the rotating gaps, or grind Nodes off.

The body keeps the ordinary enemy lifecycle (descends, fires a single aimed shot, flees off the bottom, shows the standard HP Bar once *the body* is damaged).

## Modifier interactions (deliberate)

- **Explosive bypasses the Shield.** An Explosive blast's AoE reaches the **body** even when the direct shot struck a Node — a blast wraps past the orbiting ring. This makes Explosive the signature anti-Warden modifier, the "that's how you crack them" discovery.
- **Bounce slips through.** Bounce-bullets fly in random directions, so they naturally enter through gaps and strike the body from exposed angles.
- **Pierce treats a Node and the body as separate hits** (one pierce consumed each).
- **Burn applies to whatever it strikes** — a Node hit burns that Node down; a body hit burns the body.

## Why

The fire-straight-up constraint is the most distinctive thing about the game's combat. A rotating, destructible Shield turns that constraint into the gimmick: the player must read the orbit and either thread the gap or break it open, all while dodging the Warden's fire. None of the existing roster asks for this positional, time-it-or-break-it skill.

## Alternatives rejected

- **Continuous arc + hit-angle threaded into `takeDamage`.** Keep one collider; compute the angle from the body centre to the hit point and compare against a rotating arc. Rejected: it bends the damage API around one enemy, the arc math is less readable than discrete colliders, and it offers no per-Node destruction reward — the "break it open" path disappears.
- **Flat, directionless absorb-pool.** A Shield value that soaks N damage from any angle, then drops. Rejected: it is just a second HP bar with no positional play — neither timing the gap nor flanking matters.

## Consequences

- `resolveBulletHits` carries a shielded-enemy branch with pass-through semantics; the contained complexity lives there and in `Enemy` (which exposes Node geometry and a hit-resolution method). Non-shielded enemies are unchanged.
- **Shield Nodes are not contact hazards.** Only the Warden's body deals contact damage; the orbiting ring is inert to the player's hull. Otherwise the spinning ring becomes a wide instant-death zone, unfair against the small player hitbox, and contact resolution would have to test every Node each frame.
- **No enemy-count cap is introduced.** Wardens are ordinary budget picks (a flat share off the top of `pickKind` from `startWave`, like the Mine), not spawners — the field can't chain-multiply them, so the projectile-cap-style safety net isn't needed here.
- The `WARDEN` config block (body stats, dodge, and the Shield: `nodeCount`, `nodeHp`, `orbitRadius`, `nodeRadius`, `nodeScale`, `rotationSpeed`) is the single tuning seam. `nodeCount` is a knob but ships fixed at 3; difficulty rides on `hpMult` (tougher Nodes/body), not on adding Nodes, which would shrink the timing window below what's fair.
- All Shield scaling hooks the existing `WaveMods` (`hpMult` scales body and Node HP); `rotationSpeed` is deliberately **not** scaled by `speedMult`, so the gap-timing window stays readable across waves.

This is a structural (non-numeric) change in the spirit of ADR-0011 and ADR-0010: the behavior lives behind the config seam, and the new collision logic is localized to the bullet-resolution pass and the `Enemy` class.
