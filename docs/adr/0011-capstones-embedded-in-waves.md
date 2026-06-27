# Capstones are embedded in a normal wave, not standalone

A **capstone** (Boss or Mini-boss) no longer *replaces* a wave's enemy budget — it is **spliced into** it. Every milestone wave now spawns the same scaling budget a normal wave of that number would (`baseBudget + (n−1)·budgetPerWave`) **plus** a single capstone, which enters mid-wave.

## Before

`composeWave` had three exclusive branches:

- Boss wave (`n % bossEvery === 0`, i.e. 10, 20, 30…): a boss + `BOSS.escortCount` swarmers (escortCount was `0`), and **no budget**.
- Mini-boss wave (`n % miniBossEvery === 0`, i.e. 5, 15, 25…): a mini-boss + `miniBossEscort` swarmers (`3`), and **no budget**.
- Normal wave: the scaling budget, no capstone.

So capstone waves were quiet 1-v-1 (or 1-v-few) set-pieces while the normal budget grew around them.

## After

One unified path: build the normal budget for `n`, then if `n` is a milestone, splice in the capstone.

- The capstone is inserted after `floor(budget · WAVES.capstoneSpawnFraction)` adds (`capstoneSpawnFraction = 0.33`) — roughly a third of the adds spawn, then the boss/mini-boss descends, then the rest. `0` would make it lead the wave, `1` trail it.
- Boss still overrides mini-boss on multiples of `bossEvery` (must stay a multiple of `miniBossEvery`).
- The budget draws the **full normal mix**, including Mines and Asteroids. This retires the previous invariant that Mines never appeared on mini-boss waves; the `MINE.startWave` gate now applies uniformly to every wave's budget.

## Why

The standalone capstone waves read as a difficulty *dip* in the late game: the field emptied out for the set-piece just as normal waves were getting dense. Folding the capstone into a live wave keeps the pressure continuous and makes the marquee enemy a complication on top of the wave rather than a break from it. Inserting it mid-wave (rather than first or last) means the player is already engaged with adds when it arrives, and still has adds to deal with after — no single-threat lull on either side.

## Consequences

- **Both escort knobs are removed.** `WAVES.miniBossEscort` and `BOSS.escortCount` are deleted — the wave budget is now the only source of adds, so dedicated escorts were redundant. Hand-picked escorts on top of the budget are a deliberate non-feature (YAGNI); reintroduce a knob only if a future capstone needs a *specific* companion the random mix can't provide.
- **Capstone waves are meaningfully harder**, especially boss waves (which previously had zero adds). This is intended. No HP/count rebalancing ships with this change — balance retuning is deferred (see the asset-refactor direction memo).
- `capstoneSpawnFraction` is the seam for tuning capstone timing without touching `WaveManager`.

This is a structural (non-numeric) change, in the spirit of ADR-0010: the relevant config block is the seam, and capstone composition lives in the single `composeWave` method.
