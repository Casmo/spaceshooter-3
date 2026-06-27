# Glossary — upgrade & draw vocabulary

The shared language for the upgrade system. Capitalized terms here are used consistently in `config.ts`, `upgrades.ts`, `DESIGN.md`, and the ADRs.

- **Upgrade** — one offerable improvement (a "card"). There are 12: six stat/utility upgrades and six bullet Modifiers. Defined in `UPGRADE_DEFS`.

- **Modifier** — a bullet upgrade that layers onto the single weapon (Multishot, Pierce, Homing, Explosive, Burn, Bounce). Modifiers stack orthogonally (ADR-0001). Spread was a seventh Modifier, removed in ADR-0010.

- **Draw** — the act of offering 3 distinct, not-yet-maxed Upgrades on a Level-up (`Upgrades.draw`). Weighted-random by each card's `weight`; the player picks one.

- **Rarity / Tier** — an Upgrade's class on the five-step ladder: common, uncommon, rare, epic, legendary (colors in `RARITY_COLORS`, ADR-0007). The Tier **is** the draw Weight (ADR-0009) — it is no longer cosmetic.

- **Weight** — the relative likelihood a card appears in a Draw, normalized against the running total of live (not-yet-maxed) cards. Derived from Tier: common 12 / uncommon 8 / rare 4 / epic 2 / legendary 1.

- **Cap** — the maximum number of levels of an Upgrade a run can take. `0` means **unlimited**. A maxed Upgrade is filtered out of the Draw. Caps (not Weight) express intra-tier differences in power (e.g. Bounce 3 vs. Multishot 10, both legendary).

- **Unlimited-pool invariant** — at least 3 Upgrades must have `cap: 0` so a Draw can always fill 3 distinct cards even when everything else is maxed. The guaranteed three are Damage, Fire Rate, and HP.

- **Level / Level-up** — the player level; each Level-up triggers one Draw. Run targets: ~30 Level-ups average, ~50 great (issue #10).

- **Dead level / dead card** — a level or card that has no mechanical effect (e.g. Spread without Multishot; Homing past its turn-rate ceiling). These are design defects, fixed by removal (Spread) or by matching the Cap to where the effect actually stops (Homing → 3).
