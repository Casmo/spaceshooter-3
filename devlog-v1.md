# Spaceshooter 3 — A Dev Log (v1.0)

*How a browser shoot-'em-up went from empty folder to feature-complete in
eleven days — every line of code written by Claude, every decision made by the
engineer.*

Spaceshooter 3 is a fast, endless, vertical-scrolling roguelike you play right in
your browser. Dodge, blast, and survive escalating waves — then stack bullet
powerups into combos that make your single weapon do gloriously ridiculous
things. It was built between **June 22 and July 2, 2026**, entirely in
conversation with Claude (Opus 4.8, via Claude Code).

The method mattered as much as the model. Almost every version began the same
way: a **`/grill-with-docs` session** — the engineer being interviewed hard about
the design *before* any code existed, with the decisions written down as ADRs and
the game's vocabulary pinned in a living `CONTEXT.md`. Claude proposed and wrote;
the engineer set the scope, interrogated the plan, tuned the balance, filed the
issues, and made the final call on every feature. The 16 ADRs and the glossary in
this repo are the paper trail of that control.

Each version below shows what shipped, the session(s) behind it, and the credits
those sessions consumed (token value at Opus 4.8 list prices — the build ran
through Claude Code, so these are value estimates, not invoices).

---

## Genesis — the whole game in one sitting

**Jun 22–23 · 3 sessions · ≈ $91**

The project opened with a single `/grill-with-docs` session whose brief was
blunt: *"Create a roguelike shoot-'em-up in space using these assets, pure JS
with PixiJS — main menu, waves, upgrades, the works."* After the grilling settled
the shape, Claude built it in one marathon run — app shell, parallax starfield,
the combat loop, the full enemy roster and mini-boss, XP and the 3-card upgrade
prompt, the bullet-modifier framework (Multishot, Pierce, Homing, Explosive,
Burn, Bounce), HUD, persistence, menus, and audio hooks. That one session alone
accounts for **≈ $90** (692K output tokens, 122.7M cache reads) — the signature
of a long session re-reading the growing codebase turn after turn. Two short
follow-ups wired up a GitHub Actions build-and-ship pipeline.

By the end of day two, the game was playable end to end. Everything after this is
the *refinement* era — one release at a time, each grilled first.

---

## The versioned arc

### v0.1.0 — Feel · Jun 26 · 5 sessions · ≈ $71
The engineer spent a day sharpening the core. Sessions, in order: reworking
**Homing** to lock the first enemy and hold it; making **Bounce** spawn full
inheriting clones instead of weak scatter; a large **asset refactor** to the
pixel-art pack (the $44 session — a sweeping change across the codebase); a
decorative **hit spark** on every impact; and the headline — swapping to
**relative mouse steering** so the ship is nudged by mouse *motion* and eases to
a stop. This is the release where the game started to feel right.

### v0.2.0 — The Mine · Jun 26 · 5 sessions · ≈ $24
Five tight sessions: collapsing rarities to a clean five-tier scale
(gray→orange), keeping **Pointer Lock through the upgrade menu** with a drawn
menu cursor, a gamer-friendly README, a HUD-on-resize fix, and the star of the
release — the **Mine**, a flying explosive (from wave 6) that locks one course at
spawn and is only a threat if you fail to dodge it.

### v0.3.0 — The Boss · Jun 27 · 1 session · ≈ $12
A single focused session added the **Boss**: a marquee capstone every 10th wave
that drifts, then *dashes* sideways while firing a curtain of bullets, smearing
the shots into a sweeping wall you must read and dodge.

### v0.4.0 — Balance & polish · Jun 27 · 4 sessions · ≈ $14
The **Asimovian** display font, and a balance pass driven off **GitHub issue
#10** — the engineer explicitly asked to work the issue *without closing it*,
tuning every powerup weight, rarity, and max-upgrade count by hand. (Two of the
four sessions were near-zero-cost touch-ups.)

### v0.5.0 — Legibility · Jun 27 · 2 sessions · ≈ $8
A cosmetic pass (3× bigger XP pickups, an "UPCOMING WAVE" banner) and enemy
**HP bars** that appear on first damage — "subtle but clear," per the brief.

### v0.6.0 — The Warden · Jun 27 · 2 sessions · ≈ $24
First, **capstones embedded** into normal waves (a mini-boss from wave 15, bosses
from 20 escorted by more enemies). Then the **Warden** (built off issue #13) — a
shielded descent enemy whose orbiting ring of destructible nodes you must
out-time or break, since the weapon only fires straight up.

### v0.7.0 — The Bomber · Jun 27–29 · 2 sessions · ≈ $14
A README screenshots section, then the **Bomber** (also from issue #13) — the
Mine's re-aiming cousin and the first *animated* enemy, telegraphing and bursting
toward your current position on a cadence, never escaping the field.

### v0.8.0 — Sound & Fury · Jun 29 · 2 sessions · ≈ $19
The game found its voice: full SFX, a looping music track, and independent
Music / SFX volume controls that persist across sessions. (The engineer's first
attempt was continued in a second, larger session — the $17 bulk of the work.)

### v0.9.0 — Debris & the Fortress · Jun 29 – Jul 2 · 3 sessions · ≈ $22
It opened with the engineer *auditing* Claude's work — asking whether
`WaveManager.pickKind()` had an out-of-balance selection — before building the
**SpaceStation** (a slow fortress that rakes horizontal bullet combs out both
flanks) and the cosmetic **Debris** shower on clean kills.

### v1.0.0 — Relentless · Jul 2 · 1 session · ≈ $8
A deliberately small-scope finale: from wave 25 on, *every* wave carries a
mini-boss, and boss waves field a boss and a mini-boss together — tuned to stay
hard-but-beatable so a run can never soft-lock. Feature-complete, and shipped.

---

## Session log (verified)

Reconstructed from the session transcripts — each entry is what the session
*actually did* (files touched, ADRs recorded, releases cut), not just its opening
ask. The pattern repeats: grill the design, record it, implement, test, ship.

**Genesis — Jun 22–23**
- **S1 · Jun 22 · $90** — The founding session. Grilled the entire design in one
  sitting (controls, all six modifiers and Bounce's clone mechanics, stat caps,
  lives, the five rarities, XP vs. pickups, wave pacing, the mini-boss, i-frames),
  captured it as `CONTEXT.md` + `DESIGN.md` + ADRs 0001–0002, broke the plan into
  GitHub issues, then implemented issues #1–#9 one at a time — merging each to
  main only after you tested it — and closed with a relentless balance pass on
  issue #10, tuning fire rate, enemy speed, and the level curve while playing.
  (42 files, 75 commands.)
- **S2 · Jun 23 · $1** — Rebuilt the itch.io deploy workflow (npm build → zip
  `dist` → run on push to main, with a SHA version fallback); fixed an
  `eslint: not found` CI error.
- **S3 · Jun 23 · $0** — Fixed a YAML syntax error in the deploy workflow.

**v0.1.0 — Jun 26**
- **S4 · $4** — Reworked **Homing** to lock the closest enemy at birth and hold
  it until gone; ADR-0004.
- **S5 · $7** — Redesigned **Bounce** (via domain-modeling) to spawn a
  full-powered clone on each hit — random direction, no pierce, cap 3, skipping
  its source enemy; ADR-0005.
- **S6 · $44** — The big **asset refactor** to the pixel-art pack: PNG-only,
  1920×1080 kept, player/enemies scaled 2×, background fixed to cover from frame
  one, 2-layer parallax (stars + nebula).
- **S7 · $3** — Added the decorative **Hit Spark** on every bullet contact
  (scale 1.0, no tint, play-once).
- **S8 · $14** — The headline: **relative mouse steering** under Pointer Lock
  (raw input + fallback, smoothing kept, default sensitivity halved, lock
  released in menus); ADR-0006; **tagged v0.1.0** and wrote the release notes.

**v0.2.0 — Jun 26**
- **S9 · $3** — Rarities refactored to the five-tier gray→orange scale
  (ADR-0007); art credit changed to Lil Cthulhu.
- **S10 · $7** — Kept Pointer Lock through the upgrade menu with a custom cursor
  (click-only, manual hover, UpgradePrompt owns the hit-test); ADR-0008; fixed a
  menu-vanishes-on-resume bug.
- **S11 · $2** — Wrote the gamer-friendly README.
- **S12 · $2** — Fixed the HUD/XP bar drifting to mid-screen on resize.
- **S13 · $10** — The **Mine** (wave 6): locks one course at spawn, detonates on
  death/contact for AoE, spawns top and sides; tuned speed/spawn/blast; **tagged
  v0.2.0**.

**v0.3.0 — Jun 27**
- **S14 · $12** — The **Boss** (wave 10, 3× scale): drifts, then accelerates into
  a sideways dash while firing a 5-shot twin-line burst that outlasts the dash,
  never hitting the walls; HP scales per appearance; ran a fast-boss test, then
  reverted `bossEvery` to 10 and **released v0.3.0**.

**v0.4.0 — Jun 27**
- **S15, S16 · $0** — Empty sessions, no work recorded.
- **S17 · $6** — Implemented the **Asimovian font** across every UI surface with
  a fallback chain and same-batch loading.
- **S18 · $7** — Balance pass on **issue #10** (kept open): rarity = weight
  (12/8/4/2/1, gentled), retiered several modifiers, capped Homing/Pierce,
  **removed the Spread modifier** entirely (ADR-0010) and folded its fan into
  Multishot; ADR-0009; **released v0.4.0**.

**v0.5.0 — Jun 27**
- **S19 · $3** — Cosmetic pass: 3× XP pickups, an "UPCOMING WAVE" banner,
  loading/nebula touches.
- **S20 · $5** — Enemy **HP bars** — a thin flat-red bar (`0xe05a4a`) revealed on
  first damage, no numerals, no fade; **released v0.5.0**.

**v0.6.0 — Jun 27**
- **S21 · $5** — **Embedded capstones** into normal waves (mini-boss from 15,
  bosses from 20 with escorts); ADR-0011; closed issue #11, opened #13.
- **S22 · $20** — The **Warden** (from issue #13, grilled + modeled): slow
  descending shooter behind a breakable rotating shield of nodes (cut from
  Debris-Sheet), with explosive-bypass / burn / pierce rules; also gave all
  Gunners a 3-round burst from wave 15; ADR-0012; **released v0.6.0**.

**v0.7.0 — Jun 27 / 29**
- **S23 · $0** — Added a README screenshots section.
- **S24 · $14** — The **Bomber** (issue #13): the first animated enemy, re-aiming
  to the player's current position, clamped to the field; tuned hitbox and dodge;
  **released v0.7.0**.

**v0.8.0 — Jun 29**
- **S25 · $2** — The audio design session (grill + domain-model only; no code).
- **S26 · $17** — Implemented that design in full: SFX for every event, looping
  music, independent Music/SFX volumes (menu + pause), persisted settings; new
  `audio.ts` / `settings.ts` / `AudioControls.ts`; ADR-0014; **released v0.8.0**.

**v0.9.0 — Jun 29 / 30 / Jul 2**
- **S27 · $1** — An audit: you asked whether `WaveManager.pickKind()` had an
  out-of-balance selection (analysis, no code).
- **S28 · $12** — The **SpaceStation** fortress (wave 20+): slow descent,
  telegraphed pure-horizontal bullet rake out both flanks; ADR-0015; tested from
  wave 20, then reverted the start level.
- **S29 · $10** — The **Debris** shower on clean kills (random fragments, slower
  ease + fade), backed by a debris-scan script; **released v0.9.0**.

**v1.0.0 — Jul 2**
- **S30 · $8** — The **relentless endgame**: from wave 25 every wave embeds a
  mini-boss, boss waves field both; scoped small against the prior releases;
  ADR-0016; a wave-verification script; **released v1.0.0**.

---

## Credits used

The entire build ran on **Claude Opus 4.8** via **Claude Code**, across **30
sessions** and eleven days:

| Version | Date | Sessions | Output tokens | Cache-read tokens | ≈ Credits |
|---|---|--:|--:|--:|--:|
| Genesis | Jun 22–23 | 3 | 692K | 122.7M | $91 |
| v0.1.0 | Jun 26 | 5 | 1,019K | 68.8M | $71 |
| v0.2.0 | Jun 26 | 5 | 312K | 24.8M | $24 |
| v0.3.0 | Jun 27 | 1 | 117K | 15.0M | $12 |
| v0.4.0 | Jun 27 | 4 | 204K | 12.9M | $14 |
| v0.5.0 | Jun 27 | 2 | 90K | 9.1M | $8 |
| v0.6.0 | Jun 27 | 2 | 264K | 27.6M | $24 |
| v0.7.0 | Jun 27–29 | 2 | 155K | 15.6M | $14 |
| v0.8.0 | Jun 29 | 2 | 223K | 20.9M | $19 |
| v0.9.0 | Jun 29 – Jul 2 | 3 | 252K | 23.5M | $22 |
| v1.0.0 | Jul 2 | 1 | 104K | 7.2M | $8 |
| **Total** | | **30** | **3.43M** | **348M** | **≈ $307** |

In aggregate that's **3.43M output** tokens and **348M cache-read** tokens
— the huge cache reuse being the fingerprint of long, context-heavy coding
sessions that re-read the same files and `CONTEXT.md` turn after turn. A complete,
released game for the token value of a nice dinner for four. (This dev log was
written in a separate ~$14 session, not counted above.)

## Tools used

- **Claude (Opus 4.8) via Claude Code** — all code, from the app shell to the
  endgame tuning.
- **PixiJS 8**, **TypeScript**, **Vite** — render, language, build.
- **ESLint + Prettier** on a pre-commit path; **GitHub Actions** to build and
  publish the ZIP to itch.io.
- **`/grill-with-docs` (grilling + domain modeling)** as the standard workflow:
  grill the design first, record it as ADRs, keep the vocabulary in `CONTEXT.md`.
  That discipline — the engineer steering, Claude implementing — is what kept ten
  releases coherent with each other.

## Asset credits

All code was LLM-generated; the art and audio were not. With thanks to:

- Art — [Lil Cthulhu](https://lil-cthulhu.itch.io)
- Sound effects — [Phoenix1291](https://phoenix1291.itch.io/sound-effects-pack-2)
- Music — [Creative Core Studio (Mr.Cat)](https://creative-core-studio.itch.io/free-mrcat-bit-piano-music)

---

*[▶ Play Spaceshooter 3 in your browser](https://casmo.itch.io/spaceshooter-3)*
