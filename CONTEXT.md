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
A persistent improvement chosen during a Run. One of 14 types: stats (Damage, HP, Engine, Fire Rate, Extra Life, Pickup Range), the 6 bullet Modifiers, and the two independent weapons (Missile Launcher, Drones). Each type has its own level cap, rarity weight, and per-level effect.
_Avoid_: powerup (reserve "powerup" for casual talk only), perk.

**Engine**:
The stat Upgrade that improves Steering: each level raises sensitivity (the ship travels farther per unit of hand motion — the player's sense of "ship speed") and makes the ship's chase of its target snappier.
_Avoid_: Move Speed (the ship has no speed stat — the mouse sets the pace), thrusters.

**Upgrade Prompt**:
The paused, 3-card choice shown on Level-up. Cards are a weighted-random draw of distinct, not-yet-maxed Upgrade types.
_Avoid_: level screen.

**Modifier**:
A bullet Upgrade that changes how the single *main gun* fires or what its projectiles do. The seven: Multishot, Spread, Pierce, Homing, Explosive, Burn, Bounce. Modifiers stack orthogonally — their effects combine rather than replace. Modifiers touch only the main gun — never the Missile Launcher or the Drones, each of which is its own weapon.
_Avoid_: weapon, gun (the main gun is the *only gun* — the Missile Launcher and the Drones are separate, non-gun weapons).

**Missile Launcher**:
A second, autonomous weapon (distinct from the main gun and its Modifiers), unlocked by the epic Upgrade shown on the card as **"Missiles"**. While the fire button is held it launches one Missile straight up every second on its own fixed clock — it does not auto-fire when idle, and its cadence is independent of the gun's Fire Rate. The first pick of the Upgrade unlocks it; every later pick raises Missile damage only (unlimited). No bullet Modifier affects it.
_Avoid_: gun (the gun is the main weapon — the Launcher is separate), auto-fire (it is trigger-gated), turret.

**Missile**:
The projectile fired by the Missile Launcher: flies straight up and detonates on contact with an enemy, dealing area-of-effect damage to every enemy in the blast (see Missile Explosion). Harmless to the player. Damage rises per Missile Launcher Upgrade level; the blast radius is fixed. Distinct from a main-gun bullet (a Missile is not affected by Modifiers and carries its own AoE).
_Avoid_: bullet, rocket, the enemy Mine/Bomber blast (those hurt the player; a Missile never does).

**Drone**:
A third, autonomous weapon (distinct from the main gun and the Missile Launcher), unlocked by the legendary Upgrade shown on the card as **"Drones"**. Each Drone is a small indestructible craft that orbits the ship on a slow-rotating ring, floating and lagging as the ship moves. Fully on its own — no trigger, no Fire Rate, no Modifier — it fires a Drone Beam at the nearest enemy within its range. The Upgrade grants **one Drone per level** (cap 3) and nothing else; three Drones cover more of the field, that is the whole progression. See ADR-0019 and ADR-0020.
_Avoid_: turret (it orbits, never camps), Missile Launcher (a separate weapon), companion/pet (it is a weapon), gun (the gun is the main weapon).

**Drone Beam**:
The continuous laser a Drone fires at its locked enemy. It deals damage every frame (not discrete shots) to that **one** target — never anything else the line crosses — and **ignores the Warden's Shield**, striking the body directly. Its damage *is* its Drone's Heat. Killing the target or switching to a new one costs the Beam nothing — it carries its full strength straight into the next enemy; only going idle bleeds it away. The Beam and the Drone firing it visibly heat up together — the Beam thicker and shifting cyan → white → orange-red — and the look keeps creeping as the damage climbs, ever more slowly, never quite topping out. This makes a Drone a **sustained-fire** weapon: feeble the moment it is picked up, and terrifying once it has burned through a Wave without a break. See ADR-0020.
_Avoid_: Lock (reserve for Homing — a Drone re-acquires the nearest when its target is gone; a Homing Lock never re-locks), burst/shot (the Beam is continuous, not discrete), Burn (that is a bullet Modifier's DoT on the main gun), tank-melter (the Beam no longer restarts per target, so it is no longer gentle on swarms — sustained fire is what makes it fierce, not the size of the target).

**Heat** (Drone Heat):
The single quantity that sets a Drone Beam's damage. Each Drone owns its own — Heat is never shared or pooled between them. It climbs the whole time that Drone's Beam is firing, straight through kills and target switches, with **no ceiling**; it falls only while the Drone is **idle**, with no enemy at all in its range. Cooling is *proportional*, so a scorching Drone sheds far more per second than a lukewarm one — a hot Drone bleeds down fast, and the Breather between Waves is enough to take the edge off any of them. Nothing else moves it: Heat survives a lost Life, and it is frozen — neither building nor cooling — whenever the game itself is (an Upgrade Prompt, a pause, an alt-tab). A Drone gained from a later Upgrade level starts cold while its siblings stay hot. Read off the Drone's own glow and its Beam's thickness and colour.
_Avoid_: overheating (there is no maximum and no penalty — Heat is pure upside), charge / ammo (Heat is never spent: firing is what *builds* it), cooldown (that is a firing interval elsewhere in the game — Heat has no discrete cadence), Burn (a bullet Modifier's damage-over-time on the main gun).

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
A discrete batch of enemies with a defined spawn budget. Cleared by destroying (or letting flee) all its enemies; difficulty escalates each Wave. Runs are endless — Waves keep coming until game over. From **Wave 25 the endgame turns relentless**: every Wave embeds a Mini-boss (see Mini-boss, ADR-0016), so a high-HP capstone is always on the field.

**Breather**:
The ~3-second enemy-free pause between Waves, announced by the "Wave N" banner. A deliberate rest beat in the interest curve.
_Avoid_: intermission, break.

**Mini-boss**:
The single high-HP enemy that caps Waves with a simple attack pattern. Below Wave 25 it appears on the every-5-but-not-10 cadence (5, 15). From **Wave 25 on it appears in *every* Wave** — including the every-10th Boss Waves, where the Boss and a Mini-boss now share the field (see ADR-0016). It settles at the top, strafes, and never flees: a Wave clears only when it is killed. Guarantees a Star drop on death. The early milestone Mini-bosses toughen per appearance; the per-Wave ones from Wave 25 scale on the Wave's HP multiplier alone (kept killable so a Run can't soft-lock). Distinct from the Boss, which owns the every-10th Wave.
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
_Avoid_: "stationary" (this Mine flies), Asteroid (Mines don't split), Lode (the same rock and size in gold, but it is treasure, not a threat), Kamikaze/suicide (a Mine can miss and sail off).

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

**Lode**:
The golden drive-by treasure: a heavy rock — tougher than a Mini-boss, short of a Boss — that drifts slowly across the **top** of the field once every third Wave from Wave 15, entering from either side at a slightly different altitude each time and leaving ~20 seconds later. It never shoots and never descends into the player's zone, and it always leaves — a Wave clears whether or not it died, though a Lode still crossing holds the clear until it is gone. Its whole identity is **opportunity under a deadline**: for as long as it is on screen there is something on the field worth far more than the adds spawning around it, and the player must decide whether to look up and eat the risk from everything they are ignoring. It leaks a Star every so often as it passes, and bursts into a shower of ten or more if it is killed in time. Failing it costs nothing but the loot. It is a small gold rock, tumbling slowly — the **colour**, and nothing else, is what marks it out. Ramming it hurts and does **not** destroy it — the only way to cash it in is to out-damage it. See ADR-0021. (`Asteroids_Lode`)
_Avoid_: Mine (the Lode is the same rock in gold rather than red, and the two are the same size — but a Mine hunts the player and detonates, a Lode ignores them and pays out), Asteroid (a Lode never splits), capstone / Mini-boss / Boss (it flees and never gates a Wave clear), treasure chest, bonus enemy.

**Star**:
The XP pickup that occasionally drops on kill and must be collected before it expires. The only collectible pickup in v1 — there is exactly one kind, and a Lode's burst Stars are ordinary Stars that happen to be launched. Every Star **sinks** gently downward for its whole life, so pickups behave like objects in a moving world and drops drift toward the player's zone rather than expiring where the kill happened; one may also be spawned with an **initial impulse** that decays into that sink, which is what flings a Lode's payout outward through the explosion. Attracted by the Pickup Range upgrade once in range, on top of the drift. Rendered as a spinning coin. See ADR-0022. (`Credits-Sheet`)
_Avoid_: gem, orb, XP drop, falling (it sinks gently — it is not affected by gravity or thrown down).

### Effects

**Hit Spark**:
A small, untinted, decorative burst played at every player-bullet→enemy contact — including pierce, multishot, and Bounce-bullet hits, and whether or not the hit kills. Deals no damage and carries no Modifier meaning. Fixed native size, plays once. It carries the throttled impact sound (the `bulletHit` SFX), but is otherwise visual flair. Distinct from the Explosive Modifier's larger damaging burst, which stacks on top of it on Explosive hits, and from the Kill Burst (fired on death, not impact). (`Explosion01-Sheet`)
_Avoid_: explosion, blast (reserve those for the Explosive Modifier's burst), Kill Burst (that fires on the kill, not the hit).

**Kill Burst**:
The single central explosion burst played at the death point when a "clean" enemy is destroyed — the same set that sheds Debris (Swarmer, Gunner, Warden, Station, Mini-boss, and Boss). A one-shot burst centred where the ship was, sized to match its footprint (the enemy's own sprite scale), untinted, and *silent* — the kill boom is the only death sound. Purely cosmetic: no collision, no damage. It is the focal flash at the center; Debris is the shower of fragments around it, and the two play together on every clean kill. Explicitly *not* fired on an Asteroid (it splits), a Mine or Bomber (they detonate their own damaging blast — see ADR-0017), or a shot-off Shield Node (whole-enemy deaths only). Parallels the Hit Spark — where the Spark fires small on a bullet impact, the Burst fires big on the kill. Shares the `Explosion02` sheet with the Debris pops and the Explosive Modifier blast. (`Explosion02-Sheet`, the `explosion` alias)
_Avoid_: explosion (too generic), blast / detonation (those deal damage — Explosive Modifier and Mine/Bomber), Hit Spark (impact, not death), Debris (fragments, not the central flash).

**Debris**:
The decorative shower of ship fragments flung out when a "clean" enemy is destroyed — Swarmer, Gunner, Warden, Station, Mini-boss, and Boss. Explicitly *not* the Mine or Bomber (they detonate their own blast) nor the Asteroid (it splits into smaller Asteroids), and *not* a shot-off Shield Node (only whole-enemy deaths). A handful of Debris chunks scatter from the death point, drift to rest, and each pops into a small explosion. Purely cosmetic — no collision, no damage, and silent (the single kill boom is the only death sound). Plays alongside the Kill Burst on every clean kill: the Burst is the central flash, the Debris is the shower of fragments around it. Distinct from the Hit Spark (bullet-impact flash) and the Explosive/Mine blast (which deals damage). (`Debris-Sheet`)
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
