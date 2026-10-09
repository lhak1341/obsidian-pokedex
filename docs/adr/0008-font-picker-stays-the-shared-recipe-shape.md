# The Heading/Body/Mono font picker keeps the shared recipe shape

An architecture review flagged the font picker as one concept (a font role) spread over six flat fields and five files: `settings.ts` (`DEFAULT_SETTINGS`, three `renderFontPicker` getter/setter blocks, `FONT_OPTIONS`), `utils/fonts.ts` (13-line `resolveFontVar`), `PokedexView.applyFontVars` (the `set("--pkx-fh", …)` triple), `data/types.ts` (`FontChoice`, `fontXxx` / `fontXxxCustom`) and `styles.css`. The review noted that `fonts.ts` is shallow (its interface is about as large as its body) and that adding a fourth role touches about five places.

On inspection this is not accidental duplication but the font-picker recipe shared with four sibling plugin repos (`obsidian-lhak-dashboard`, `obsidian-linear-calendar`, `obsidian-health`, `obsidian-lhak-task`), documented in the `obsidian-plugin-dev` skill's `workflows/font-customization.md`: a `FontChoice` union, six flat settings fields, one exhaustive `Record<FontChoice, (custom) => string | null>` resolver, one apply method per view root, one `renderFontPicker` helper called three times. Future scaffolding copies that shape, so a pokedex-only restructure would make this repo's font code diverge from what the recipe describes.

What the shape buys here:

- **The exhaustive `Record` is the point of `fonts.ts`.** Adding a `FontChoice` is a compile error in both `fonts.ts` and the `FONT_OPTIONS` record, not a silent no-op. The module is small because the recipe is small.
- **The duplication is bounded and mechanical.** Three getter/setter blocks (~25 lines) and one three-line `set(…)` triple; no bug has come from either.
- **The six flat fields live in the tracked, synced `data.json`.** Nesting them (`fonts: { heading: { choice, custom } }`) would need a settings migration for a gain of a few lines.

A `FONT_ROLES` table in `fonts.ts` (role, settings keys, CSS var, label, description) consumed by both `settings.ts` and `PokedexView.ts` was considered. It would cut a hypothetical fourth role from about five touch points to about two, but nothing needs a fourth role: Heading/Body/Mono is the cross-repo standard and none is planned.

**Decision:** leave the font code as-is. Rejected alternatives: a role table over the existing flat keys (real but small gain, diverges from the recipe), and nesting the settings (needs a `data.json` migration).

**Reopen when** a fourth font role or a per-role option (size, weight) is actually wanted, or when the recipe itself changes. Make that change in the skill's recipe and in all five repos together, not in pokedex alone. Don't re-flag the six flat fields or the shallow `fonts.ts` in a future review on size alone.
