# Missile Launcher: an independent second weapon, not a bullet Modifier

The **Missiles** Upgrade adds a second, autonomous weapon — the **Missile Launcher** — that fires on its own 1-second clock (while the trigger is held) and detonates on contact for area damage. It is deliberately *not* a bullet Modifier: it does not ride the main gun's shots, does not inherit any Modifier, and is not affected by Fire Rate. This is the first thing in the game to break the long-standing "there is only one weapon" invariant.

## Context

Every offensive Upgrade so far has been either a stat bump on the one gun (Damage, Fire Rate) or a bullet **Modifier** (Multishot, Pierce, Homing, Explosive, Burn, Bounce) that stacks onto that gun's shots. `CONTEXT.md` codified this as an invariant — "there is only one weapon" — and the whole firing path (`Player.fireVolley`, the shared `ProjectilePool`, the modifier fields on `Projectile`) assumes it.

The Missiles request is different in kind: a projectile that fires on its *own* cadence, carries its *own* built-in AoE, and should scale on its *own* damage track — independent of how the gun is built.

## Decision

Model the Missile Launcher as a **separate weapon subsystem** running parallel to the gun:

- Its own fire timer on `Player` (fixed 1s, trigger-gated, independent of `cooldown`/Fire Rate), its own `missileLevel`/`missileDamage`, and its own dedicated `ProjectilePool`.
- The six bullet Modifiers never touch it. A Missile is not spawned by `fireVolley` and carries none of the modifier fields.
- Collision + AoE resolved in `GameScene` in a dedicated pass (`resolveMissileHits`), reusing the existing `destroyEnemy` reward path but with its own blast geometry.

## Considered options

- **Bullet Modifier on the gun (rejected).** Would reuse `fireVolley`, `Projectile`'s explosive fields, and the existing collision pass for near-zero new code. Rejected because a Modifier fires on the *gun's* cadence and inherits *other* Modifiers (Multishot would multiply Missiles, Homing would curve them, Fire Rate would speed them up) — none of which is wanted. The Missile's defining trait is a fixed independent 1s clock, which a gun-coupled Modifier cannot express.
- **A fully separate `Missile` class outside `ProjectilePool` (rejected).** More faithful to "it's not a bullet," but would duplicate pooling, off-screen despawn, and the live-cap safety net. `ProjectilePool` is already generic (texture + scale + radius injected); a dedicated instance of it is the cheaper seam. The one thing the pool doesn't model — distance-ramped acceleration — is handled by `GameScene` driving the missile's `vy` each frame from its travelled distance.

## Consequences

- **The "only one weapon" invariant is now scoped, not absolute.** `CONTEXT.md` is updated: the *gun* is still the only *gun*, but the Missile Launcher is a second, non-gun weapon. Future weapons (drones, beams) now have a template to copy: own timer on `Player`, own pool, own resolution pass — do **not** fold them into the Modifier system.
- **Warden Shield interaction chosen for simplicity (B2 + geometry).** A Missile detonates on the first live Shield Node *or* body in its path; Nodes are pure blockers (the blast never damages them, matching the Explosive Modifier's AoE, and Missiles alone can't grind a Shield down). Rather than add "spare the shielded body" logic, `WARDEN.orbitRadius` was widened 80→120 so a Node-blocked blast (110px radius) falls just short of the body — the Shield protects the Warden by pure geometry. The trade-off: the wider ring spreads the 3 Nodes farther apart, slightly widening the rotating gaps the *gun* must thread; a 4th Node (`WARDEN.nodeCount`, capped by `SHIELD_NODE_CAPACITY`) is the lever if that ever feels too soft.
- **AoE damages bodies only and never the player** — unlike the enemy Mine/Bomber blast, which is the mirror image (hurts the player, not enemies). The struck enemy is included in the blast (the Missile has no separate direct-hit component; the collision only triggers the detonation).
