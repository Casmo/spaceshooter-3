# Space Shooter 3

A browser-based, vertical-scrolling roguelike shoot-'em-up built with PixiJS. Each run starts fresh; the depth comes from stacking bullet **Modifiers** into emergent combinations. This file is the shared vocabulary — terms only, no implementation.

## Language

### Controls

**Steering**:
How the player moves the ship: by the mouse's *motion*, not its position. Moving the mouse nudges the ship a proportional distance and it eases to a stop when the hand stops — there is no on-screen point the ship "goes to." The mouse only ever moves the ship; the weapon always fires straight up. Improved by the Engine Upgrade.
_Avoid_: aiming (there is no aim), cursor-follow, point-and-go.

### Run & progression

**Run**:
A single playthrough, from starting a new game to game over. Always begins fresh — 3 lives, 100 HP, no upgrades. Nothing about a ship's power carries between runs.
_Avoid_: game, session, attempt.

**Life**:
A retry within a Run. Reaching 0 HP consumes one Life and respawns the ship at full HP; at 0 Lives the Run ends. Lives are gained only from the rare Extra Life Upgrade.
_Avoid_: continue.

**HP**:
The ship's damage buffer within a single Life. Drained by enemy contact and enemy fire; refilled to full on respawn.
_Avoid_: health, shield, armor.

**XP**:
Progress toward the next Upgrade Prompt. Awarded on every kill (scaled by enemy type) and in larger chunks from collecting a Star.
_Avoid_: experience points, score (Score is separate).

**Score**:
The persisted performance metric for a Run, accumulated from kills and wave bonuses. The primary cross-run record. Distinct from XP.

**Level-up**:
The moment accumulated XP crosses the current threshold, triggering an Upgrade Prompt. Thresholds grow each Level-up.

### Upgrades

**Upgrade**:
A persistent improvement chosen during a Run. One of 13 types across stats (Damage, HP, Engine, Fire Rate, Extra Life, Pickup Range) and the 7 bullet Modifiers. Each type has its own level cap, rarity weight, and per-level effect.
_Avoid_: powerup (reserve "powerup" for casual talk only), perk.

**Engine**:
The stat Upgrade that improves Steering: each level raises sensitivity (the ship travels farther per unit of hand motion — the player's sense of "ship speed") and makes the ship's chase of its target snappier.
_Avoid_: Move Speed (the ship has no speed stat — the mouse sets the pace), thrusters.

**Upgrade Prompt**:
The paused, 3-card choice shown on Level-up. Cards are a weighted-random draw of distinct, not-yet-maxed Upgrade types.
_Avoid_: level screen.

**Modifier**:
A bullet Upgrade that changes how the single weapon fires or what its projectiles do. The seven: Multishot, Spread, Pierce, Homing, Explosive, Burn, Bounce. Modifiers stack orthogonally — their effects combine rather than replace.
_Avoid_: weapon, gun (there is only one weapon).

**Bounce**:
The Modifier that, on every enemy a bullet hits, spawns one Bounce-bullet. The Bounce level is a generational depth, not a count: each Bounce-bullet spawns one of its own a generation shallower, and so on until the depth runs out. A higher level only makes the chain go deeper — it never spawns more than one Bounce-bullet per hit.
_Avoid_: ricochet, scatter, fragmentation, shrapnel.

**Bounce-bullet**:
A full clone of its parent bullet spawned by the Bounce modifier on an enemy hit. Identical to the parent — full damage, unlimited range, same look, and every other Modifier inherited — except it flies in a random direction and never pierces. It cannot hit the enemy it spawned from (Homing also skips that enemy when acquiring a Lock; if that enemy is the only one present, the Bounce-bullet flies straight). Bounce-bullets that still have depth left spawn their own when they hit.
_Avoid_: Fragment, shard, ricochet, shrapnel.

**Homing**:
The Modifier that makes a bullet curve toward a single enemy it locks onto. The lock is acquired once, when the bullet is born, on the closest enemy present at that instant; it never switches to another enemy afterwards. A higher Homing level only turns the bullet faster — it does not change what or when it locks.
_Avoid_: tracking, seeking, guided.

**Lock** (Target Lock):
The bond between a Homing bullet and the one enemy it steers toward. A Lock lasts until that enemy is gone — destroyed or fled off the bottom of the field. The bullet does not re-lock; once its Locked enemy is gone it simply keeps flying in its current direction.
_Avoid_: aim, target (as a verb), retarget.

**Rarity**:
The weight class governing how often an Upgrade type appears in the draw, shown by card color: **gray** = common, **green** = uncommon, **orange** = rare, **purple** = very rare.

### Combat & waves

**Wave**:
A discrete batch of enemies with a defined spawn budget. Cleared by destroying (or letting flee) all its enemies; difficulty escalates each Wave. Runs are endless — Waves keep coming until game over.

**Breather**:
The ~3-second enemy-free pause between Waves, announced by the "Wave N" banner. A deliberate rest beat in the interest curve.
_Avoid_: intermission, break.

**Mini-boss**:
The single high-HP enemy that caps every 5th Wave with a simple attack pattern. Guarantees a Star drop on death.
_Avoid_: boss (no full bosses in v1).

**Swarmer**:
A small, fast, low-HP enemy that flies in formations/sine paths and deals contact damage only. (`fighter1`)

**Gunner**:
A larger, slower, higher-HP enemy that periodically fires at the player. (`Gunship`)

**Asteroid**:
A non-shooting hazard that drifts down dealing contact damage and, when destroyed, splits into smaller Asteroids per its split count. (`Asteroids-Sheet` frames)

**Star**:
The XP pickup that occasionally drops on kill and must be collected before it expires. The only collectible pickup in v1. Attracted by the Pickup Range upgrade. Rendered as a spinning coin. (`Credits-Sheet`)
_Avoid_: gem, orb, XP drop.

### Effects

**Hit Spark**:
A small, untinted, decorative burst played at every player-bullet→enemy contact — including pierce, multishot, and Bounce-bullet hits, and whether or not the hit kills. Purely cosmetic; deals no damage and carries no Modifier meaning. Fixed native size, plays once. Distinct from the Explosive Modifier's larger damaging burst, which stacks on top of it on Explosive hits. (`Explosion01-Sheet`)
_Avoid_: explosion, blast (reserve those for the Explosive Modifier's burst).
