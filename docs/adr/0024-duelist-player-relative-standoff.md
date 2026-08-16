# The Duelist: an enemy that takes up positions against the player

A new enemy, the **Duelist** (`fighter3`), enters the spawn budget from Wave 35. It owns the space above the player: it never descends into the player's zone and never flees, it keeps its nose pointed at the player at all times, and it repeats a single loop — fly to a spot in the band above them, fire a nose-tracking 3-shot burst the instant it arrives, hold the spot a moment, then choose a new one. Each spot is chosen from where the player is at that instant and then **committed**. At most two are ever live at once.

## The problem

By Wave 35 every enemy the game has is positionally *fixed*. Each one either flies a path decided at spawn (Swarmer, Gunner, Asteroid, Mine, Warden, SpaceStation, Lode) or camps a spot the player's position had no part in choosing (Mini-boss, Boss). Even the two that re-aim — the Bomber, which re-targets every ~3s, and the Boss, which sweeps a Curtain — pick a *heading* from the player's position and then commit to it.

The consequence is that every threat in the game can be solved by moving somewhere else. That is the correct default, and it is what makes the field readable. But the endgame has no enemy that answers a repositioning player, so late-game skill expression is almost entirely about *route-finding through bullets* and never about *out-timing an opponent*.

Two capabilities were also entirely unused: no enemy rotates to face anything (the Drone is the only sprite in the game drawn rotated, and it is the player's), and no enemy derives its position from the player's.

## The archetype

The Duelist is defined by inverting the positional-fixity assumption:

- **Its destinations are chosen against the player**, as an arc angle plus a standoff radius resolved from where the ship is at that moment. It keeps answering the player's position, over and over, instead of committing once at spawn.
- **It faces the player, and its shots leave along its nose.** The facing is not decoration: it is a live, honest read on where the next bullet goes.
- **It never leaves.** Like a capstone, the Wave does not clear until it is dead — but it is a normal-budget pick, not a Wave anchor.

## The decisions

### Spots are committed, not tracked

The first implementation derived the Duelist's position from the player's *every frame*: an anchor point that the enemy continuously eased toward. It satisfied the brief on paper and was wrong in play. Continuous derivation makes the enemy read as **tethered to the ship** — it slides whenever the player slides, so it never appears to *decide* anything, and the player cannot tell the difference between the enemy repositioning and the enemy being dragged.

So the destination is chosen once per move and then frozen. Everything player-relative happens in a single call (`chooseDuelistSpot`), which is what keeps "it does not follow you" true by construction rather than by care. The consequences are all improvements:

- **The move reads as a decision.** It commits, travels, arrives, and shoots. The player can watch it pick a side.
- **Movement can be fast**, because it is a bounded trip rather than a permanent chase.
- **The player can bait it.** Moving right after it commits pulls it out of position for the rest of that beat — a real counterplay that a tracking anchor cannot offer.

The trip is played out as **eased interpolation between the two spots** — progress from a recorded departure point through a smoothstep — rather than a constant-speed step toward the target. Driving it off progress rather than proximity is what makes the ease exact at both ends and arrival exact at `k = 1`, which is what lets arrival *be* the firing trigger. Its duration is derived from the distance, so a short hop and a long repositioning keep the same apparent pace, with a floor so that two spots resolving close together still ease instead of teleporting.

The loop is therefore driven by **arrival**, not by a clock. An earlier fixed-timeline cycle (telegraph → burst → slide → settle, summing to 3s) had to assume how long the trip took; making arrival the trigger removes the assumption and the telegraph with it, since the visible stop *is* the wind-up.

### The standoff protects it from ramming, not from the gun

The distance it holds is protection from **contact**, and deliberately not from the player's weapon. It may sit directly above the player, and lining up under it to fire straight up (ADR-0006) is exactly how it is meant to die.

The alternative — an enemy that specifically avoids the player's firing line — was considered and rejected. The gun only ever fires straight up, so an enemy that dodges that line is not a duel, it is a denial of the player's entire offence: the only counter would be walking under it and waiting, which is what the enemy is built to prevent. The version that keeps its distance but can always be shot back at is a fight; the version that dodges the line is a chore.

### The band clamp is spent sideways, not thrown away

The obvious implementation of "arc angle plus radius, kept inside the band" is to take the point on the circle and clamp each axis into the band. It is wrong in the one way that matters. With the player up inside the band, the y-clamp cuts the vertical separation and nothing replaces it — so the Duelist would pick a spot right on top of them, handing them a free ram and deleting the enemy's defining property.

So the clamp is applied to `y` first, and whatever separation that cost is spent horizontally:

```
|dx| = max(|radius · sin(arc)|, sqrt(radius² − dy²))
```

The first term is the arc's own offset, which is what makes each step land somewhere new while the player stays low. The second is the floor that keeps the standoff intact once the band ceiling has eaten into `dy`. Taking the larger preserves both properties at once. **The standoff then falls out of the geometry with no flee state anywhere:** fly up at a Duelist and the next spot it picks is off to the side.

Because spots are committed, this bounds where it *goes*, not where it *is* — a player who charges after the pick can close on it, and takes contact damage for the privilege. That is the intended trade: the frozen spot is what makes the enemy readable, and being able to punish a bad spot is the player's half of the bargain.

**`standoffRadius` and the band move together.** The band is what binds at the player's home row: with the standoff at 620 and the band ending at 380, every wide arc clamped to the band floor and the true gap was 620–770px. Halving the standoff alone would therefore have barely moved the Duelist, because the band would still have held it at 484px. Both were halved together — a 310px standoff inside a 350–620px band — giving a real 310–390px gap. It follows that the Duelist no longer lives at the very top of the field; it sets up in the upper-middle, close enough to loom.

`x` is treated the same way — at a field edge the anchor mirrors to the other side rather than being clamped inward, because clamping `x` is the same trap as clamping `y`. Mirroring always fits, since the field is wider than twice the radius.

### The arc **angle** is bounded, not the resulting point

The arc is limited to ±75° either side of straight-above. Bounding the angle rather than the point is what keeps the Duelist in the player's upper half at every player position; the band clamp afterwards is only about staying on-screen. Steps reflect off the limits rather than clamping to them, so it paces back and forth across the player's arc instead of parking at a limit and re-picking the same spot forever.

### The turn rate is the dodge, and it is bounded by geometry

Shots leave along the nose, so `turnRate` is the single knob deciding whether the burst is dodgeable — and it has to be read against the geometry, not chosen by feel. A player crossing at speed `v` at distance `d` demands `v/d` rad/s of the nose. It sits inside a window with a wall on each side:

- **Too high and a break cannot be outrun**, which silently deletes the dodge and turns the burst into unavoidable damage. The first implementation used 4.0 rad/s against a 620px standoff, where the player can demand at most ~2.4 rad/s, and did exactly that.
- **Too low and a gentle drift outruns it too**, which makes the burst a pure movement check and deletes the punish for standing still.

Both walls are set by `standoffRadius`, and **they close in as the Duelist gets nearer**. That is the non-obvious part. At close range a player running sideways opens the distance quickly — over one burst the range grows from ~310px to ~550px — so the angle the nose owes *collapses mid-volley* and it catches back up before the last shot. A rate that trails during the burst is therefore not sufficient; it must still be behind at the **end**, or the final shot lands for free.

That failure appeared the moment the Duelist was moved closer, and the tests caught it. The window at the current 310px standoff is roughly 1.3–3.2 rad/s, and it ships at **2.6**.

The lag also peaks *early* in a burst and closes as the range widens, so the tests measure miss distance at each shot rather than at the end, where the effect is understated roughly five-fold.

### The live count is capped, and capped at spawn time

The Duelist never leaves, so a spawn chance cannot bound how many accumulate: at Wave 35 a 10% share of a 74-enemy budget rolls ~7 of them, and a Wave cannot clear until every one is dead. That is a Wave that never ends.

The cap is **two**, and it is enforced in `WaveManager.spawnNext` rather than in `composeWave`. This is forced by the existing design: the whole Wave queue is composed up front, when nothing is live yet, so composition physically cannot see the live count. An over-cap slot pays out a Gunner instead, so the Wave keeps its full enemy budget — it just isn't another Duelist.

Two rather than one is deliberate: a pair latches onto opposite sides of the player's arc, so the player takes crossfire from two angles and can only line up under one at a time. That is the enemy's ceiling of difficulty, and one would never produce it.

### HP on `hpMult` only, and speeds that ignore `speedMult`

HP is `DUELIST.hp × hpMult` with **no per-appearance multiplier** — ADR-0016's reasoning applies directly and with full force here, because the Duelist is a never-fleeing enemy and an un-killable one soft-locks the Run.

Every speed (travel, turn rate, dwell) deliberately ignores the Wave `speedMult`, following the Mine/Bomber/Lode precedent. The arrive-shoot-dwell-move rhythm is the thing the player learns to read, and it must beat identically at Wave 35 and Wave 60.

### The interesting math is a pure module

The standoff geometry, the arc stepping, the turn-rate limiter and the eased chase live in `src/game/duelist.ts`, free of PixiJS — the `steering.ts` precedent (ADR-0023). `EnemyPool` owns *when* they run; the module owns only the arithmetic.

This was not tidiness. Two of the design's load-bearing properties — the standoff and a dodgeable burst — are pure geometry, and both were wrong in the first implementation. Neither error is visible by reading the code, and finding them by playing would have meant flying to Wave 35 first. They were caught in milliseconds by tests that could only be written because the math had no renderer attached.

The seam also survived the move from tracking to committed spots without a change: `anchorFor` is the same function, called once per move instead of once per frame.

## Consequences

- A Wave from 35 on cannot clear until its Duelists are dead. Bounded by the cap at two, but real. If playtesting shows Waves dragging, the fix is `DUELIST.hp` — not the cap, which is what keeps the crossfire readable.
- The Duelist is the first enemy drawn rotated. `Enemy.updateBar` already positions the HP Bar from the unrotated offset (for spinning Asteroids and Mines), so the bar stays horizontal above it for free.
- It is a "clean" kill — Kill Burst plus Debris — with no `GameScene` change, because clean kills are defined there as everything except the Asteroid, the Mine and the Bomber.
- `EnemyPool` grows by another kind. The file is now past 1500 lines with all per-kind state flattened into one class; that is a real cost and a future extraction, deliberately not attempted here.
- `EnemyPool.countLive(kind)` is new. It is a linear scan of the live list, run once per Duelist spawn token — a handful of times per Wave, over a list of tens.
