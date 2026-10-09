# DetailScreen's small derivations stay in the component

An architecture review flagged `DetailScreen.svelte` (769 lines) as hiding untested pure derivations inside the template: three hand-mirrored snapshots (`entryLoad`, `varietySnapshot`, `moveDetails`), `femalePct` / `malePct` / `accentColor`, the Capture & Breeding panel branching, the `startLoad` stale-response guard, and a repeated `padStart` for the dex number. It suggested a detail view-model of plain-TS derivations with the component only rendering.

On inspection most of that is either already extracted, already justified, or too small to be a module:

- **The real logic already lives in tested plain classes.** `DetailLoadState` (fetch orchestration and staleness), `VarietyToggleState` (Mega/Gigantamax selection and form cache) and `DetailNavigationState` (view history) each have their own `.test.ts`. The component mirrors their `snapshot()` into `$state` because Svelte 5's `$state` does not deep-proxy class instances; that reasoning is in the component's own comments and in CONTEXT.md ("Variety toggle", "View history").
- **The stale-response guard is not a correctness guard.** `id !== currentId || loadState.cancelled || !loadState.error` in `startLoad` only decides whether to show the failure `Notice`. Staleness of the loaded data itself is handled inside `DetailLoadState` by its generation counter (`stale()` checks), which is unit-tested.
- **The Capture & Breeding branching moved out already**, into `describeEncounters` (`utils/encounters.ts`), which also owns the one `showRegion` rule.
- **What is left is two lines each.** `femalePct` / `malePct` is eighths-to-percent arithmetic; `accentColor` is one `TYPE_COLORS` lookup over `(activeMegaData ?? entry)`, a chain CONTEXT.md protects (Gigantamax deliberately excluded because it carries no `types`). `evolvesAtLevels` and `adjacent` delegate to tested functions (`nextEvolutionLevels`, `getAdjacentDexEntries`). Extracting these would create shallow modules whose tests repeat the arithmetic.

The one genuinely repeated rule was a formatting rule, not view logic: the zero-padded dex number appeared seven times across five files, and the height / weight conversion in both `DetailScreen` and `tableColumns.ts`. Those are now `formatDexNumber`, `formatHeight` and `formatWeight` in `utils/pokemonDisplay.ts`, with direct tests.

**Decision:** leave the remaining derivations in `DetailScreen.svelte`. Rejected alternative: a detail view-model module wrapping the gender split, accent colour and panel state (moves two-line derivations, adds an interface as wide as its body).

**Reopen when** a derivation in the component grows real branching, or a bug originates in one of them. Don't re-flag `DetailScreen`'s size, the mirrored snapshots or the untested gender split on their own in a future review. ADR-0003 covers the untested Obsidian/Svelte lifecycle layer.
