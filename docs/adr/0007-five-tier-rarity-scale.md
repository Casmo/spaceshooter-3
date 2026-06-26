# Upgrade rarity is a five-tier cosmetic scale, not six

Upgrade rarity is now a fixed ladder of five tiers, low to high: **common (gray), uncommon (green), rare (blue), epic (purple), legendary (orange).** The previous scheme had six tiers and an extra `veryRare` sitting between rare and epic. We collapsed that to five to match the convention most players already carry from other loot games (gray → green → blue → purple → orange), where the in-between "very rare" tier simply does not exist.

`veryRare` was dropped and everything on it was promoted into **epic**. In practice that was a single upgrade — **Extra Life** — which now shares the epic tier with **Homing**. Rarity itself is purely cosmetic: draw frequency is governed entirely by each upgrade type's own `weight` (see `pickWeighted` in `upgrades.ts`), not by its tier. But because the promotion put Extra Life in the same tier as Homing, we also bumped its `weight` from 1 to **3 to match Homing**, so the two epic upgrades draw at a consistent rate rather than Extra Life staying the single rarest card in the pool. That is the one balance change bundled with this rename; broader weight rebalancing remains out of scope and deferred to a future balance pass.

The colors **rotated** rather than just being renamed, so the on-screen palette shifts even for tiers that kept their name:

| Tier | Old color | New color |
|---|---|---|
| common | gray `0x9aa0a6` | gray `0x9aa0a6` (unchanged) |
| uncommon | green `0x57d957` | green `0x57d957` (unchanged) |
| rare | orange `0xff9933` | **blue `0x4aa3ff`** |
| epic | magenta `0xff5fd0` | **purple `0xb066ff`** (the old veryRare purple) |
| legendary | gold `0xffd24a` | **orange `0xff9933`** (the old rare orange) |

So epic inherits the purple that veryRare used to wear, legendary inherits the orange that rare used to wear, rare takes a brand-new blue, and the old epic magenta and gold legendary are retired. We reused the existing purple and orange hexes rather than hand-picking fresh ones to keep the look consistent with art that already shipped.

The scale lives in one place — `RARITY_COLORS` and the `Rarity` union in `config.ts`, with matching `RARITY_LABEL` strings in `UpgradePrompt.ts`. These are the only two consumers; rarity never feeds drop logic, so there is no third place to keep in sync.
