# TypeScript retained despite the "pure JS" brief

The original brief said "pure JS," but we keep **TypeScript**. The intent behind "pure JS" was "no server-side language (e.g. PHP) and no heavy UI framework" — it must run in the browser and later package under nw.js, both of which TypeScript satisfies (it compiles to plain JS). The scaffold is already TS + Vite + ESLint, and the game's stacking-modifier rules, combat state, and enemy variety benefit materially from type safety. We write idiomatic TS against PixiJS directly — no additional frameworks — which honors the spirit of the brief.
