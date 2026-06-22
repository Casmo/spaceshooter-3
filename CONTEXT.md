# Space Shooter 3

A browser-based, vertical-scrolling roguelike shoot-'em-up built with PixiJS. Each run starts fresh; the depth comes from stacking bullet **Modifiers** into emergent combinations. This file is the shared vocabulary — terms only, no implementation.

## Language

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
A persistent improvement chosen during a Run. One of 13 types across stats (Damage, HP, Move Speed, Fire Rate, Extra Life, Pickup Range) and the 7 bullet Modifiers. Each type has its own level cap, rarity weight, and per-level effect.
_Avoid_: powerup (reserve "powerup" for casual talk only), perk.

**Upgrade Prompt**:
The paused, 3-card choice shown on Level-up. Cards are a weighted-random draw of distinct, not-yet-maxed Upgrade types.
_Avoid_: level screen.

**Modifier**:
A bullet Upgrade that changes how the single weapon fires or what its projectiles do. The seven: Multishot, Spread, Pierce, Homing, Explosive, Burn, Bounce. Modifiers stack orthogonally — their effects combine rather than replace.
_Avoid_: weapon, gun (there is only one weapon).

**Fragment**:
The short-range secondary projectile spawned by the Bounce modifier on any hit. Flies in a random direction, deals 50% of the parent bullet's damage, hits once, and never spawns more Fragments.
_Avoid_: ricochet, bounce-bullet, shrapnel (in code; "fragmentation" is fine in prose).

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
A small, fast, low-HP enemy that flies in formations/sine paths and deals contact damage only. (`insect-1`)

**Gunner**:
A larger, slower, higher-HP enemy that periodically fires at the player. (`insect-2`)

**Asteroid**:
A non-shooting hazard that drifts down dealing contact damage and, when destroyed, splits into smaller Asteroids per its split count. (`small/medium/large-A/B`)

**Star**:
The XP pickup that occasionally drops on kill and must be collected before it expires. The only collectible pickup in v1. Attracted by the Pickup Range upgrade. (`star.png`)
_Avoid_: gem, orb, XP drop.
