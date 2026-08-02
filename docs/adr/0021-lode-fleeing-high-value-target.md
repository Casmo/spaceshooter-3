# The Lode: a fleeing high-value target, not a capstone

A new enemy, the **Lode**, enters from Wave 15 and returns every third Wave. It is a heavy golden rock — tougher than a Mini-boss, short of a Boss — that drives horizontally across the **top** of the field, leaks Stars as it passes, and bursts into a shower of ten or more if the player kills it before it leaves the far side. It never fires, never descends, and always leaves.

## The problem

By Wave 15 a Run has settled into a rhythm the player already knows. Every enemy on the field is a *threat to survive*; nothing is an *opportunity to chase*, and nothing ever asks the player to deliberately ignore danger for a moment because something more valuable showed up. The late game also has no moment where accumulated damage output is put on the clock — HP is checked against patience (a Mini-boss never flees), never against a deadline. A player who has built enormous DPS has no event that pays them specifically for it.

## The archetype

Every high-HP enemy so far has been a **capstone** (ADR-0011, ADR-0016): it anchors the Wave, never flees, and the Wave cannot clear until it dies. The Lode inverts every one of those properties.

- **It flees.** The Wave clears whether or not it died. A Lode that escapes costs the player nothing but the loot, so declining the opportunity is a legitimate play when survival is the smarter call. There is no penalty, no message, and no sound on its escape — consistent with every other enemy that flees.
- **It is on a clock.** ~20 seconds edge to edge, at a slow ~100 px/s drift. That deadline is the entire design: it converts "do I have enough DPS?" from a question about patience into a question about *sustained output under distraction*.
- **It is not a gate but it does hold the clear.** The existing rule (queue empty *and* field clear) means a Lode still crossing keeps the Wave open. That is intended — it guarantees the player always gets the whole window even after clearing the adds — and it is bounded by the ~20s traverse.

## The decisions

### A fixed window that ignores `speedMult`

Traverse speed is derived from `LODE.traverseSeconds` and the field width, and deliberately **ignores the Wave `speedMult`** (the Mine and Bomber precedent). If it scaled, the window would shrink as the Run progressed and what the player learned at Wave 15 would stop applying at Wave 45. The window is the contract; it stays constant. Ramping it by Wave was considered and rejected for exactly that reason.

**Amended after playtest:** the window was originally 8s and the sprite scale 5 (a 320px footprint). Both were halved — a 160px rock at ~130 px/s over ~16s. The Lode is no longer the biggest thing on the field, so the **gold shimmer, not the silhouette, now carries the telegraph**; and the DPS the check asks for is halved (see Consequences). The window is still the single knob, and it is still constant across every Wave.

**Amended again, with the dedicated art (below):** the window went 16s → **20s** (~100 px/s). This was not a difficulty adjustment for its own sake — it is the aim correction the smaller sprite forced. A bullet takes ~0.5s to reach the top lane, so the player must aim *ahead* of a crossing Lode; at 160px that lead (~65px) fitted inside the hit window (68px) and could be ignored, while at 72px the window is 32px and the lead has to be deliberate. Slowing the drift pulls the required lead down to ~50px. `traverseSeconds` is still the one knob and the window is still constant across every Wave.

### HP on `hpMult` only — never per-appearance

HP is `LODE.hp × hpMult`, with **no per-appearance multiplier**. ADR-0016 already established that per-appearance compounding outruns any build's DPS. There, the failure mode was a soft-lock (a Mini-boss that never flees and cannot be killed). Here the Lode flees, so it cannot lock a Run — but a permanently un-cashable event is just as bad a bug: the feature would still be *on screen* every third Wave while being mathematically impossible, which teaches the player to stop looking up. Per-appearance stacking was rejected.

**Amended with the dedicated art:** `LODE.hp` was cut 2000 → **1400**. At 72px a real share of the player's shots now miss, and the base HP is where that is paid for. The Lode therefore no longer sits at Boss parity — it is between a Mini-boss's 900 and a Boss's 2000 — so **"boss-HP" has been dropped from the vocabulary** (`CONTEXT.md` now says "heavy"). XP and Score stay at Boss parity: they reward beating the deadline, not the size of the HP pool.

### Spliced on top of the budget, and never suppressed by a capstone

Lode Waves are `wave >= startWave && (wave - startWave) % everyWaves === 0` — derived from the Wave number, holding no state, so the schedule and the payout curve (`lodeBurstCount`) are both pure functions of the same input and cannot drift apart. Probability-roll spawning (the Mine/Warden/Bomber pattern) was rejected: this event should be learnable and preparable, and a roll can neither guarantee exactly one nor guarantee it appears at all.

The Lode is spliced at fraction **0.5** of the adds and is **added on top of the budget** rather than consuming an enemy slot — the capstone-splice pattern of ADR-0011, so a Lode Wave is not quietly easier in adds. Arriving mid-Wave while adds are still coming is what makes chasing it cost something.

It is **not** suppressed by capstones. From Wave 27 every Lode Wave also carries a Mini-boss (ADR-0016), and Waves 30/60 carry a Boss as well. Suppressing on any capstone Wave would delete the feature from the entire endgame — precisely where the payout matters most. On Wave 30 the field can carry a Boss, a Mini-boss and a Lode at once; splitting DPS between a marquee fight and a treasure is the interesting decision, and it is the busiest moment the game produces.

### Unrammable, like the Boss

Contact deals Mini-boss-grade damage and **the Lode survives it**, joining the Boss as the second enemy exempt from die-on-contact. This is required, not cosmetic: without it a player could ram the Lode for one hit of HP and collect the entire payout, bypassing the damage check that is the whole point of the enemy.

### Its own art: the Mine's rock, in gold

*Added in the art pass; supersedes the tint machinery below.*

The Lode originally shipped with **no new art** — frame 1 of `Asteroids-Sheet` at scale 2.5, tinted gold and pulsed between `baseTint` and `shimmerTint`. It now has a dedicated sprite, `Asteroids_Lode.png`, drawn untinted at scale 2, and the shimmer is gone entirely. The colour lives in the pixels.

The sprite is **`Asteroids_Explosive.png` recoloured** — the Mine's rock, gold instead of red, the same 36×32 art at the same scale 2. So on screen a Lode and a Mine are the same silhouette at the same size, separated by hue alone. This is the one uncomfortable part of the change and it is deliberate:

- The pack ships the two as a matched pair, and honouring that keeps the field's visual language consistent — a rock is a rock, and its colour says what kind.
- Red reads as danger everywhere else in the game; gold reads as loot. Hue is doing work here, not just decoration.
- The two are never confusable *in motion*: a Mine flies at the player on an aimed line and detonates, a Lode ignores them and crosses the top lane horizontally. The behaviours diverge within a second of a Mine spawning.

The alternative — keeping a shimmer pulse so the Lode moves differently from a Mine even at rest — was rejected as unnecessary once the art carries the gold. **If a Lode is misread as a Mine in playtest, that is the finding this section exists to catch**, and reinstating a pulse (or a distinct silhouette) is the fix.

### A remembered base tint

*Superseded in practice by the section above: the Lode is no longer tinted, so `baseTint` is `0xffffff` for every kind today. The facility was kept anyway — "restore this enemy's own colour" is the right rule for the next kind that wants one, and it costs a single field.*

The gold is the Lode's identity, and the shimmer needs somewhere to return to. Today a Burn expiring — and the Bomber/SpaceStation telegraphs — reset the sprite tint to hardcoded white, which would erase the gold the moment a Burn wore off. Each pooled enemy now remembers a `baseTint` and those resets restore it, defaulting to white for every existing kind so their behaviour is unchanged.

### Rewards

- **Drip:** one Star roughly every 3.2s (~6 across the 20s traverse), emitted only while the body is fully on screen so nothing spawns outside the field (the SpaceStation's hold-fire precedent). The count falls out of `dripInterval` against `traverseSeconds`, so every window extension inflates the consolation payout unless it is paid for: 4-5 at the original 8s, ~9 once the window doubled to 16s, and it would have been ~11 at 20s. `dripInterval` was doubled 1.6 → 3.2 to claw that back, putting the drip near where it started. **A Lode that escapes should pay for the attention spent, not substitute for killing it** — that gap is what makes the burst worth chasing, and `dripInterval` is the knob that holds it open. The dripped Stars sink out of the high lane on their own (ADR-0022), so a consolation prize dropped near the top is actually collectable.
- **Burst:** `10 + floor((wave - startWave) / everyWaves)` Stars — 10 at Wave 15, 15 at Wave 30, 20 at Wave 45, uncapped. A **pure exported function of the Wave number**, which is what makes the payout testable with no rendering. It replaces the ordinary per-kill Star roll; a Lode does not also roll the 5% chance.
- **Kill award:** XP and Score at Boss parity.
- **Death effects:** a "clean kill" under ADR-0017 — it does not split, so it gets the untinted Kill Burst sized to its sprite scale plus Debris chunks (~1-2 from the existing count-from-scale rule), and the standard kill boom at slightly raised volume. It never splits into Asteroids.

## Consequences

- **The DPS the check asks for:** at Wave 15 the Lode asks for roughly **188** sustained DPS across its 20s window, and ~356 at Wave 30 where HP has climbed but the window has not. (The figures have fallen twice: 670 across 8s originally, then ~335/~635 when the window doubled, now ~188/~356 after the HP cut and the slowdown.) Those numbers assume every shot connects, which the smaller target makes less true than it was — the *felt* ask is higher than the arithmetic. `LODE.hp` and `LODE.traverseSeconds` are the two knobs; HP is the one to reach for if the event becomes free loot.
- **It is now one of the smaller things on the field.** At 72px it is tied with the Mine and beaten by everything except a Swarmer or a Bomber (64px) — where it was originally the biggest thing but the Boss. Nothing about its size telegraphs it any more; the gold does all of it, unaided by a shimmer. This is the change most likely to need reverting after playtest: if a Lode goes unnoticed on a busy Wave, `LODE.scale` is the knob, and reinstating the shimmer is the fallback.
- Two effects size themselves off `sprite.scale.x` and so shrank again: the Kill Burst (128px footprint) and the Debris count (~1-2 chunks). The collision radius is now ~25px, matching the Mine's. `STAR.burstSpeedMin`/`Max` were halved to 125/225 so the death shower still rides the Kill Burst outward rather than scattering past it (see ADR-0022).
- Drones (400px range) cannot reach the top lane from the player's usual position, so the Lode is primarily a gun-and-Missile check. This is a consequence of geometry, not a special case — it is a normal target for every weapon and Modifier.
- Enemies previously despawned only off the bottom, with the Mine as the sole exception. The Lode joins it in the side-exit case.
- `LODE.startWave` and `LODE.everyWaves` are the two knobs that move the whole event. The scheduling *decision* — which waves carry a Lode and where it is spliced — lives entirely in the one `composeWave` method, keeping ADR-0011's single-seam property; `isLodeWave` and `lodeBurstCount` sit beside the `LODE` block in `config.ts` because both are pure reads of those knobs, and keeping the cadence and the payout curve next to each other is what stops them drifting apart.
- The Lode's XP share is acknowledged to shrink relative to the late Level-up thresholds. Accepted, not fixed here; no broader rebalance ships with this change.
