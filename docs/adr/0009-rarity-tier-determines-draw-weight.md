# Rarity tier determines draw weight

Upgrade rarity is no longer cosmetic. Each rarity tier now maps to a fixed draw `weight`, and that mapping *is* the rule for how often a card appears:

| Tier | Weight |
|---|---|
| common | 12 |
| uncommon | 8 |
| rare | 4 |
| epic | 2 |
| legendary | 1 |

This **supersedes the "rarity is purely cosmetic" claim in ADR-0007.** Under 0007 the card color and the draw frequency were independent — `weight` was hand-tuned per card and the tier was just a label. In practice the two had drifted into a confusing state where the color a player saw did not reliably predict how rare the card was, and balancing meant juggling twelve free `weight` numbers by hand.

Tying weight to tier collapses the problem: a card's color now truthfully tells the player how rare it is ("orange = jackpot" is *true*), and balancing the pool reduces to assigning each card a tier plus a small number of deliberate exceptions. New upgrades only need a tier, not a bespoke weight.

We chose a **gentle, roughly-halving ladder** (12/8/4/2/1) over a steeper one (e.g. 24/12/6/3/1) so that the rarer tiers still show up often enough to build around within a single run, rather than legendaries being near-mythical. Only the *ratios* matter — the draw normalizes the running total of live (not-yet-maxed) cards — so the absolute numbers were chosen to stay integers across all five tiers.

**Intra-tier exceptions are expressed through `cap`, not weight.** When two cards share a tier but one needs to be more tightly bounded (e.g. Bounce and Multishot are both legendary, but Bounce is far more explosive in its combinatorics — ADR-0005), we keep their draw weight identical and differentiate them with a lower `cap`. This keeps the tier→weight mapping a clean invariant with no per-card weight overrides.

One consequence to keep in mind when assigning tiers: total draw odds also depend on **how many cards sit in a tier**. A populous tier collectively crowds the pool more than a sparse one, so tier assignment — not just the ladder — is where pool balance actually lives. The current distribution is 4 common / 2 uncommon / 2 rare / 2 epic / 2 legendary (12 cards, total live weight 78 when none are maxed).

The five-tier scale and its colors are unchanged from ADR-0007; only the meaning of the tier (now mechanical, not cosmetic) changed here.
