# Spaceshooter 3

A browser-based, vertical-scrolling roguelike shoot-'em-up built with PixiJS. Each run starts fresh; the depth comes from stacking bullet **Modifiers** into emergent combinations. This file is the shared vocabulary — terms only, no implementation.

## Language

### Controls

**Steering**:
How the player moves the ship: by the mouse's *motion*, not its position. Moving the mouse nudges the ship a proportional distance and it eases to a stop when the hand stops — there is no on-screen point the ship "goes to." The mouse only ever moves the ship; the weapon always fires straight up. Improved by the Engine Upgrade.
_Avoid_: aiming (there is no aim), cursor-follow, point-and-go.

**Menu Cursor**:
The drawn pointer the player uses to pick a card on the Upgrade Prompt. It exists only while a prompt is open: because the mouse stays captured (so the every-pick browser lock notice never re-fires — see ADR-0008), the system cursor is hidden, so the game draws its own and moves it by the same mouse motion that Steers. It tracks an on-screen position — unlike Steering, here position is the whole point. It never appears during normal play.
_Avoid_: reticle, crosshair (there is none in play — see ADR-0006), system cursor, pointer.

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
The tier of an Upgrade type, shown by card color across five levels: **gray** = common, **green** = uncommon, **blue** = rare, **purple** = epic, **orange** = legendary. Rarity is cosmetic — draw frequency is governed by each type's `weight`, not its tier. See ADR-0007.

### Combat & waves

**Wave**:
A discrete batch of enemies with a defined spawn budget. Cleared by destroying (or letting flee) all its enemies; difficulty escalates each Wave. Runs are endless — Waves keep coming until game over.

**Breather**:
The ~3-second enemy-free pause between Waves, announced by the "Wave N" banner. A deliberate rest beat in the interest curve.
_Avoid_: intermission, break.

**Mini-boss**:
The single high-HP enemy that caps Waves on the every-5-but-not-10 cadence (5, 15, 25…) with a simple attack pattern. Guarantees a Star drop on death. Distinct from the Boss, which owns the every-10th Wave.
_Avoid_: boss (the Boss is its own, larger thing — see below).

**Boss**:
The marquee high-HP enemy that caps every 10th Wave (10, 20, 30…), replacing the Mini-boss on those Waves. Larger, tougher, and with a more elaborate attack pattern than a Mini-boss: it settles near the top of the field, drifts slowly, and periodically Dashes sideways while firing a Curtain. The wave-10 Boss is the first; later milestones add or swap which Boss appears (and may add escorts). Guarantees a Star drop on death.
_Avoid_: Mini-boss (a Boss is the every-10th capstone, not the every-5th).

**Dash**:
The Boss's signature move: a sudden accelerated sideways lunge (left or right, chosen at random but biased away from a near edge) that ramps up from the slow drift, then decays back. The Boss fires its Curtain *during* the Dash, so its lateral motion smears the shots into a sweeping wall — the core thing the player must read and dodge.
_Avoid_: strafe (the Mini-boss strafes at constant speed; a Dash accelerates), charge.

**Curtain**:
The Boss's attack: two side-by-side vertical streams of straight-down bullets, fired as a fixed burst kicked off by a Dash (never aimed at the player — unlike the Mini-boss fan). The burst outlasts the Dash movement — the Boss keeps firing for a moment as it decays back to its drift. The Dash's lateral motion sweeps the two lines across the field. Dodged by reading the Dash and repositioning, not by out-running aimed fire.
_Avoid_: fan (reserve "fan" for the Mini-boss's aimed spread), spread (that's a player Modifier).

**Swarmer**:
A small, fast, low-HP enemy that flies in formations/sine paths and deals contact damage only. (`fighter1`)

**Gunner**:
A larger, slower, higher-HP enemy that periodically fires an aimed shot at the player. From the late game (wave 15+) every Gunner instead fires a **burst** — a short volley of shots aimed once at burst start and sent down a single line, dodged by sidestepping the volley as a unit — then waits a longer cooldown before the next. The Mini-boss (a scaled Gunner) is unaffected; it keeps its aimed fan. (`Gunship`)
_Avoid_: fan (that's the Mini-boss's aimed spread), Curtain (the Boss's)._

**Asteroid**:
A non-shooting hazard that drifts down dealing contact damage and, when destroyed, splits into smaller Asteroids per its split count. (`Asteroids-Sheet` frames)

**Mine**:
A flying explosive enemy that enters from the top or either side and locks a single aimed course at the player's position the instant it spawns, then flies that straight line — never re-aiming — until it is destroyed or leaves the screen. It tumbles slowly for show only; the spin never bends its path. It detonates when **destroyed** (shot down, caught in an Explosive blast, or burned to death) and on **contact** with the player, dealing area damage to the player alone. An escaping Mine that flies off-screen does **not** detonate — dodging is the safe outcome. The first enemy whose death is itself a threat. Enters mid-run, not from wave 1. (`Asteroids_Explosive`)
_Avoid_: "stationary" (this Mine flies), Asteroid (Mines don't split), Kamikaze/suicide (a Mine can miss and sail off).

**Bomber**:
A late-game flying explosive and the Mine's **re-aiming** cousin: where the Mine locks one course at spawn, the Bomber re-targets the player's *current* position every ~3 seconds. Each cycle it briefly **telegraphs** (a tint pulse), then **bursts** toward the player, after which its speed eases down to a slow drift along that heading until the next burst. It is **clamped to the field** — it never escapes off-screen; the only exits are being shot down or hitting the player. On any destruction or on **contact** it detonates with the **Mine's exact blast** (same radius and damage), area-damaging the player alone if within range. It is the first **animated** enemy — its sprite cycles a 5-frame sheet (see ADR-0013). Enters at wave 15+ as a normal-budget pick. (`Bombe-Sheet`)
_Avoid_: Mine (the Bomber re-aims and never escapes), Dasher (no separate charge state — its burst *is* its movement), Homing (it bursts on a cadence, it doesn't continuously curve).

**Warden**:
A slow late-game enemy that descends straight down behind an orbiting Shield, firing aimed shots as it comes. Midway down it makes a single slow lateral dodge, then resumes its descent and flees off the bottom if it survives. Its threat is positional: you must out-time or break its Shield while dodging its fire. Distinct from the Gunner (no Shield) and the Mini-boss/Boss (the Warden is a normal-budget enemy, not a capstone).
_Avoid_: turret (it descends, never camps), tank, Boss.

**Shield** (Warden's Shield):
The ring of orbiting Shield Nodes that guards a Warden. Because the player's weapon only ever fires straight up, the Shield blocks shots while a Node covers the bottom and lets them through when a gap rotates into the line of fire. Beaten two ways, freely mixed: out-time the rotating gaps, or destroy Nodes to widen them permanently. Always refers to the Warden's Shield — never the player's HP.
_Avoid_: armor, force field, HP (HP is the player's damage buffer — see HP).

**Shield Node**:
One destructible circle in a Warden's Shield. It has its own small HP pool and orbits with the others; once destroyed it is gone for good, permanently widening the gap. A shot that strikes a live Node is stopped there and never reaches the body — except an Explosive blast, which wraps past the Shield to the body, and a Bounce-bullet, which can slip through a gap from an exposed angle.
_Avoid_: orb, segment, turret.

**Star**:
The XP pickup that occasionally drops on kill and must be collected before it expires. The only collectible pickup in v1. Attracted by the Pickup Range upgrade. Rendered as a spinning coin. (`Credits-Sheet`)
_Avoid_: gem, orb, XP drop.

### Effects

**Hit Spark**:
A small, untinted, decorative burst played at every player-bullet→enemy contact — including pierce, multishot, and Bounce-bullet hits, and whether or not the hit kills. Deals no damage and carries no Modifier meaning. Fixed native size, plays once. It carries the throttled impact sound (the `bulletHit` SFX), but is otherwise visual flair. Distinct from the Explosive Modifier's larger damaging burst, which stacks on top of it on Explosive hits. (`Explosion01-Sheet`)
_Avoid_: explosion, blast (reserve those for the Explosive Modifier's burst).

**Debris**:
The decorative shower of ship fragments flung out when a "clean" enemy is destroyed — Swarmer, Gunner, Warden, Station, Mini-boss, and Boss. Explicitly *not* the Mine or Bomber (they detonate their own blast) nor the Asteroid (it splits into smaller Asteroids), and *not* a shot-off Shield Node (only whole-enemy deaths). A handful of Debris chunks scatter from the death point, drift to rest, and each pops into a small explosion. Purely cosmetic — no collision, no damage, and silent (the single kill boom is the only death sound). Distinct from the Hit Spark (bullet-impact flash) and the Explosive/Mine blast (which deals damage). (`Debris-Sheet`)
_Avoid_: wreckage, gibs, particles.

**Debris chunk**:
One flying piece of Debris: a random one of the sheet's six fragment shapes, drawn at roughly half the source enemy's sprite scale, launched in a fully random 360° direction and eased to a near-stop over a 1–2s life while slowly tumbling. It stays fully opaque the whole drift, then vanishes into its end-of-life pop — the standard Explosion02 burst at scale 0.5, untinted and silent. How many spawn scales with the dead enemy's size (bigger enemy → more chunks, up to five).
_Avoid_: shard, fragment (both reserved near Bounce-bullets), shrapnel.

**HP Bar**:
A thin flat-red bar that appears above an enemy the instant it takes its first damage and tracks its remaining HP as a fill length — no number, the length *is* the percentage. Hidden while the enemy is at full HP (so a one-shot kill never shows one); once shown it never fades or hides until the enemy dies or flees. Its width matches the enemy's (unrotated) sprite width with a fixed thin height, and it stays horizontal above a spinning Asteroid or Mine. Applies to *every* enemy kind, the Boss included. Distinct from the player's HUD HP bar.
_Avoid_: health bar, lifebar, the player's HP bar (that's the HUD).

### Audio

**SFX**:
Every short one-shot sound the game plays in response to a discrete event — firing, enemy fire, kills, detonations, taking damage, picking up a Star, levelling up, game over. One of the two independently-controlled audio categories. Some effects draw a random take from a **variant pool** so a repeated event doesn't replay one identical sample; the per-bullet impact sound is the only one that is rate-limited.
_Avoid_: sound (ambiguous — could mean Music), audio (that's the whole system).

**Music**:
The single looping background track, played under everything from the title screen onward. The other of the two audio categories, controlled by its own volume independent of SFX.
_Avoid_: soundtrack, BGM, theme.

**Volume** (Music / SFX):
The player's persisted loudness setting for each category, adjusted in 10% steps from 0 (silent) to 100%. There is no separate mute — a Volume at 0 *is* off. SFX Volume scales the relative mix of effects; Music Volume applies live to the looping track.
_Avoid_: mute toggle (folded into Volume), gain, level.
