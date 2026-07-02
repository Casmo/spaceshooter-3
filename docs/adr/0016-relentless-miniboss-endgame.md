# Every wave carries a Mini-boss from wave 25 on

From **wave 25 onward every wave embeds a Mini-boss** in its normal budget, not just the every-5th waves. On the every-10th **Boss** waves (30, 40, 50…) the wave carries **both** the Boss and a Mini-boss. This turns the deep endgame relentless: past wave 25 there is a high-HP capstone on the field in every single wave.

## Before

`composeWave` picked at most one capstone per wave (ADR-0011): a Boss on `n % bossEvery === 0`, else a Mini-boss on `n % miniBossEvery === 0`, else none. So the late game still had capstone-free waves (26, 27, 28, 29, 31, 32…), and a Boss wave never also carried a Mini-boss.

## After

- A new threshold `WAVES.miniBossEveryWaveFrom` (= 25). For `n >= miniBossEveryWaveFrom`, a Mini-boss is always spliced in.
- The every-5th cadence (`miniBossEvery`) still governs waves *below* the threshold (waves 5, 15).
- On Boss waves at or past the threshold, the Boss **and** a Mini-boss both spawn (the Boss no longer suppresses the Mini-boss there). Below the threshold the Boss still stands alone.
- At most one filler Mini-boss is ever alive at once: a wave does not advance until it is cleared and a Mini-boss never flees, so it must die before the next wave — except a Boss wave, which fields the two capstones together.

## HP scaling — the key trade-off

Mini-boss HP is `MINIBOSS.hp × waveHpMult × (1 + appearance × hpPerAppearance)`. If every per-wave Mini-boss kept incrementing the shared `appearance` counter, the `(1 + appearance × 0.5)` factor would snowball past ~100,000 HP by wave 50 — beyond most builds' DPS. Because a Mini-boss never flees, an unkillable one **soft-locks the run**: the wave can never clear.

So the per-wave (threshold+) Mini-bosses **do not use the per-appearance bonus** — they scale on `waveHpMult` alone (~3,850 HP at wave 25, ~7,450 at wave 50: tanky but bounded and killable). The classic milestone Mini-bosses below the threshold (waves 5, 15) keep their appearance stacking unchanged.

### Considered and rejected

- **Full compounding (leave the appearance counter incrementing).** Rejected: snowballs to a soft-lock in most deep runs.
- **Cap the appearance bonus at a ceiling.** A viable compromise, but `waveHpMult`-only is simpler, already scales with the wave, and needs no new cap constant.
- **A flee/timeout guard so the wave always clears.** Rejected to preserve the Mini-boss's kill-to-clear identity (glossary; ADR-0011) and keep the scope small — reaching wave 25 already implies real DPS, and HP is bounded. It also let players trivially wait out the capstone.

## Consequences

- **The deep game is markedly harder from wave 25.** Intended — this is the v1.0.0 endgame escalation. No broader balance retune ships with it (still deferred, per the asset-refactor memo).
- **A guaranteed Star every wave from 25** (the Mini-boss always drops one; Boss waves drop two). A small, accepted XP/pickup uptick — the late XP curve already steepens (`XP.lateGrowth`).
- `miniBossEveryWaveFrom` is the single seam for the threshold; the Boss/Mini overlap lives in the one `composeWave` method (in the spirit of ADR-0011).
