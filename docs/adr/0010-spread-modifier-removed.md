# Spread modifier removed

The **Spread** bullet modifier is gone. The modifier roster drops from seven to six: Multishot, Pierce, Homing, Explosive, Burn, Bounce. This amends ADR-0001 (which listed Spread among the original seven) and ADR-0004 (which used "Multishot/Spread" as an example).

Spread widened the angular fan of a volley. We removed it because it was a **dead card in the overwhelming majority of runs** and a feel-bad in the rest, for three compounding reasons:

1. **Useless without Multishot.** A single projectile has no fan to widen — the firing code sends one bullet straight up regardless of Spread level (`count === 1 → theta = 0`). Spread only does anything once you also have Multishot, which is a legendary (weight 1) that most runs never roll. So most runs that were offered Spread could never benefit from it.
2. **Voided by Homing.** The fan only sets each bullet's *initial* velocity. Homing then curves every bullet onto its locked target within a fraction of a second, washing the spread out entirely. Investing picks in Spread and later taking Homing threw the investment away.
3. **Redundant with Multishot's built-in fan.** Multishot already auto-spaces its own volley via `multishotMinGapDeg` (8° per extra projectile — an 80° fan at Multishot 10), so even when Spread "worked" it was mostly widening an already-wide fan.

A modifier that is conditional on a legendary, redundant with that same legendary, and erased by another modifier cannot be fixed with a weight or a cap — so we cut it rather than carry a card that lowers the average quality of every 3-card draw.

**Multishot keeps its built-in fan.** The `multishotMinGapDeg` spacing stays; only the separate Spread card and its `spreadDegPerLevel` knob were removed. We considered salvaging Spread by giving it a baseline projectile (making it work solo) but that just turns it into Multishot-lite, reintroducing redundancy from the other direction.

This is the one structural (non-numeric) change in the issue-#10 balance pass; the rest of that pass was tier/weight/cap tuning.
