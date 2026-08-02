# The Lode: a fleeing high-value target, not a capstone

A new enemy, the **Lode**, enters from Wave 15 and returns every third Wave. It is a boss-HP golden rock that drives horizontally across the **top** of the field, leaks Stars as it passes, and bursts into a shower of ten or more if the player kills it before it leaves the far side. It never fires, never descends, and always leaves.

## The problem

By Wave 15 a Run has settled into a rhythm the player already knows. Every enemy on the field is a *threat to survive*; nothing is an *opportunity to chase*, and nothing ever asks the player to deliberately ignore danger for a moment because something more valuable showed up. The late game also has no moment where accumulated damage output is put on the clock — HP is checked against patience (a Mini-boss never flees), never against a deadline. A player who has built enormous DPS has no event that pays them specifically for it.

## The archetype

Every high-HP enemy so far has been a **capstone** (ADR-0011, ADR-0016): it anchors the Wave, never flees, and the Wave cannot clear until it dies. The Lode inverts every one of those properties.

- **It flees.** The Wave clears whether or not it died. A Lode that escapes costs the player nothing but the loot, so declining the opportunity is a legitimate play when survival is the smarter call. There is no penalty, no message, and no sound on its escape — consistent with every other enemy that flees.
- **It is on a clock.** ~8 seconds edge to edge. That deadline is the entire design: it converts "do I have enough DPS?" from a question about patience into a question about *burst*.
- **It is not a gate but it does hold the clear.** The existing rule (queue empty *and* field clear) means a Lode still crossing keeps the Wave open. That is intended — it guarantees the player always gets the whole window even after clearing the adds — and it is bounded by the ~8s traverse.

## The decisions

### A fixed window that ignores `speedMult`

Traverse speed is derived from `LODE.traverseSeconds` and the field width, and deliberately **ignores the Wave `speedMult`** (the Mine and Bomber precedent). If it scaled, the window would shrink as the Run progressed and what the player learned at Wave 15 would stop applying at Wave 45. The window is the contract; it stays constant. Ramping it by Wave was considered and rejected for exactly that reason.

### HP on `hpMult` only — never per-appearance

HP is `LODE.hp × hpMult`, with **no per-appearance multiplier**. ADR-0016 already established that per-appearance compounding outruns any build's DPS. There, the failure mode was a soft-lock (a Mini-boss that never flees and cannot be killed). Here the Lode flees, so it cannot lock a Run — but a permanently un-cashable event is just as bad a bug: the feature would still be *on screen* every third Wave while being mathematically impossible, which teaches the player to stop looking up. Per-appearance stacking was rejected.

### Spliced on top of the budget, and never suppressed by a capstone

Lode Waves are `wave >= startWave && (wave - startWave) % everyWaves === 0` — derived from the Wave number, holding no state, so the schedule and the payout curve (`lodeBurstCount`) are both pure functions of the same input and cannot drift apart. Probability-roll spawning (the Mine/Warden/Bomber pattern) was rejected: this event should be learnable and preparable, and a roll can neither guarantee exactly one nor guarantee it appears at all.

The Lode is spliced at fraction **0.5** of the adds and is **added on top of the budget** rather than consuming an enemy slot — the capstone-splice pattern of ADR-0011, so a Lode Wave is not quietly easier in adds. Arriving mid-Wave while adds are still coming is what makes chasing it cost something.

It is **not** suppressed by capstones. From Wave 27 every Lode Wave also carries a Mini-boss (ADR-0016), and Waves 30/60 carry a Boss as well. Suppressing on any capstone Wave would delete the feature from the entire endgame — precisely where the payout matters most. On Wave 30 the field can carry a Boss, a Mini-boss and a Lode at once; splitting DPS between a marquee fight and a treasure is the interesting decision, and it is the busiest moment the game produces.

### Unrammable, like the Boss

Contact deals Mini-boss-grade damage and **the Lode survives it**, joining the Boss as the second enemy exempt from die-on-contact. This is required, not cosmetic: without it a player could ram the Lode for one hit of HP and collect the entire payout, bypassing the damage check that is the whole point of the enemy.

### A remembered base tint

The gold is the Lode's identity, and the shimmer needs somewhere to return to. Today a Burn expiring — and the Bomber/SpaceStation telegraphs — reset the sprite tint to hardcoded white, which would erase the gold the moment a Burn wore off. Each pooled enemy now remembers a `baseTint` and those resets restore it, defaulting to white for every existing kind so their behaviour is unchanged.

### Rewards

- **Drip:** one Star roughly every 1.6s (~4-5 per traverse), held until the body is fully on screen so nothing spawns outside the field (the SpaceStation's hold-fire precedent). Even a failed attempt pays for the damage dealt and the attention spent. The dripped Stars sink out of the high lane on their own (ADR-0022), so a consolation prize dropped near the top is actually collectable.
- **Burst:** `10 + floor((wave - startWave) / everyWaves)` Stars — 10 at Wave 15, 15 at Wave 30, 20 at Wave 45, uncapped. A **pure exported function of the Wave number**, which is what makes the payout testable with no rendering. It replaces the ordinary per-kill Star roll; a Lode does not also roll the 5% chance.
- **Kill award:** XP and Score at Boss parity.
- **Death effects:** a "clean kill" under ADR-0017 — it does not split, so it gets the untinted Kill Burst sized to its sprite scale plus Debris chunks (~3 from the existing count-from-scale rule), and the standard kill boom at slightly raised volume. It never splits into Asteroids.

## Consequences

- **The known tuning risk:** at Wave 15 the Lode asks for roughly 670 sustained DPS across the 8s window while adds keep spawning. Early Lodes will often escape. That is the intended design — a check the player can fail, with the drip as consolation — but `LODE.hp` is a single knob and is the first thing to reach for if playtesting says it is too steep.
- Drones (400px range) cannot reach the top lane from the player's usual position, so the Lode is primarily a gun-and-Missile check. This is a consequence of geometry, not a special case — it is a normal target for every weapon and Modifier.
- Enemies previously despawned only off the bottom, with the Mine as the sole exception. The Lode joins it in the side-exit case.
- `LODE.startWave` and `LODE.everyWaves` are the two knobs that move the whole event. The scheduling *decision* — which waves carry a Lode and where it is spliced — lives entirely in the one `composeWave` method, keeping ADR-0011's single-seam property; `isLodeWave` and `lodeBurstCount` sit beside the `LODE` block in `config.ts` because both are pure reads of those knobs, and keeping the cadence and the payout curve next to each other is what stops them drifting apart.
- The Lode's XP share is acknowledged to shrink relative to the late Level-up thresholds. Accepted, not fixed here; no broader rebalance ships with this change.
