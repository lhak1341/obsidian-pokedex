# Domain glossary

## Generation fallback

The rule "scope to the currently Active Gen's data, fall back to the latest supported generation's data when Active Gen predates this entry" (e.g. viewing a Gen 4 mon with Active Gen set to Gen 3, which has no data for it at all).

Implemented once, generically, as `resolveTabsForGen` in `src/utils/generationFallback.ts` — tested in `generationFallback.test.ts`. It returns the tabs, the generation they actually came from (`gen`, null when no generation has data) and the caller's remembered tab key resolved to a selection ("remembered key, else first tab"). `MoveBrowser`'s heading reads `gen` so it names the generation it shows (`Moves (G4 · no G3 data)` after a fallback); `FlavorTextPanel` has no label and ignores it. Used by:
- `MoveBrowser.svelte`'s `moveVersionTabs` (move version-group tabs)
- `FlavorTextPanel.svelte`'s `flavorTabs` (flavor-text version tabs)

Not the same rule as `resolveStatsForGen` in `src/utils/stats.ts`, despite the similar English description — that function has the opposite control-flow direction: it defaults to `current` (already the latest-gen-correct stat line) and conditionally patches it *backward* for a finite list of species keyed by `pokemonId`, with a `validThroughGen` ceiling. It isn't a gen-indexed tab list with a filter-then-fallback shape, so it stays a separate implementation.

## Quick jump

A small always-visible search box (FilterBar's main search input, QuickSearch on the detail screen) that offers a live dropdown of up to 8 matching Pokemon, navigable with Up/Down/Enter, opened from anywhere via Cmd/Ctrl+Shift+L. Distinct from the browse table's own live filtering (`filters.search`) — quick jump is a fast way to jump straight into a result's detail page, not the table's row filter, even on FilterBar where both live in the same input.

Match derivation and Up/Down/Enter nav are implemented once in `src/utils/quickJump.ts` (`quickJumpMatches`, `stepQuickJumpNav` — tested in `quickJump.test.ts`). The dropdown orchestration built on top of those primitives — open/activeIndex state, DOM event wiring, the Cmd/Ctrl+Shift+L hotkey registration — used to be duplicated between `QuickSearch.svelte` and `FilterBar.svelte`; it's now a single shared seam, `createQuickJumpDropdown` in `src/view/quickJumpDropdown.svelte.ts` (runes-based, untested by convention — same DOM-bound category as `hoverPopover.svelte.ts`), paired with a shared `QuickJumpDropdown.svelte` for the list markup itself.

The two callers diverge in exactly two caller-supplied places, both taken as callbacks by the hook rather than hardcoded:
- **On Select** — QuickSearch's `onSelect` blurs the input (so `isEditableTarget` doesn't block PokedexApp's `"["`/`"]"` view-history hotkey right after navigating, since QuickSearch stays mounted on the same detail screen); FilterBar's `onSelect` navigates away to the detail screen entirely, so it doesn't need to blur at all — the search input leaves the DOM anyway.
- **On Escape** — the hook itself does the (identical, unconditional) blur; only the text-clearing is caller-specific, via `onEscape` (QuickSearch clears its ephemeral `query`; FilterBar's `onEscape` is a no-op, since `filters.search` is the table's real live filter, not an ephemeral query).

The search text itself (`query()` in the hook's options) also stays caller-owned rather than moving into the hook — QuickSearch's is a local ephemeral string, FilterBar's is `filters.search`, which the table's own live filter also reads.

## Evolution requirement

The human-readable description of what triggers a node's own evolution (e.g. "Lv. 16", "Thunder Stone", "Trade (metal coat)", "Lv. 30 (Female)") — shown as the method line on `EvolutionChain.svelte`'s card for that node.

Computed by `describeEvolutionRequirement` in `src/data/normalize.ts`, tested in `normalize.test.ts` alongside every other pure function derived from `EvolutionNode` (`normalizeEvolutionChain`, `normalizeEvolutionChainForViewed`, `collectChainIds`, `nextEvolutionLevels`). `normalizeEvolutionChainForViewed(chain, { id, pokemonName, speciesName })` is the entry the repository calls: it picks the regional-variant path (the viewed Pokemon's own suffix, else the gating ancestor's suffix as for Obstagoon, else the default view) and builds the context. Priority-ordered base label (minLevel > item > minHappiness > minBeauty > knownMove > partySpecies > location > trigger), then relativePhysicalStats/trade+heldItem-override/gender/timeOfDay layered on top in that fixed order — see the function's own comment for why trade+heldItem is a hard override rather than a suffix.

## View history

A browser-style back/forward stack of previously-viewed Pokemon on the detail screen, bound to `[`/`]`. Stepping back past the oldest entry exits to the table (same destination as the "Back to list" button); stepping forward from the table re-enters detail at wherever the stack was last pointing. Distinct from Quick jump: quick jump searches and jumps into a result, view history steps through Pokemon already visited.

Opening a mon from the table always starts a fresh chain (like navigating to a new page from the browser's home page) — it does not resume whatever was left over from an earlier chain you'd already stepped out of. Opening from inside detail (evolution card, quick search, or resuming into detail via `]`) continues the current chain instead: truncate-then-push, same as a browser tab's forward history being dropped once you navigate somewhere new mid-stack.

Implemented as `DetailNavigationState` in `src/view/DetailNavigationState.ts` — a plain, non-reactive class (same shape as `PokedexLoadState`) owning `screen`/`selectedId`/`history`/`historyIndex`/the saved table scroll position, exposing `openDetail`/`goBack`/`goForward`/`backToTable`. It stays DOM-free on purpose: each method returns a `ScrollInstruction` (`reset`/`restore`/`none`) that `PokedexApp.svelte`'s `applyNavigation` executes against `rootEl`, since only the `.svelte` layer touches `tick()`/`scrollTo`. Internally still uses the pure index math `pushHistory`/`stepBack`/`stepForward` from `src/utils/viewHistory.ts` (tested separately in `viewHistory.test.ts`); the class's own orchestration is tested in `DetailNavigationState.test.ts`.

## Variety toggle

The detail screen's Mega/Gigantamax display state: which variety (if any) is currently shown in place of the base species, and the session-lifetime cache of forms already fetched. In-game, Mega and Gigantamax/Dynamax are mutually exclusive on the same Pokemon — selecting one always deactivates the other, even for a species (e.g. Venusaur) with both available to toggle independently.

Implemented as `VarietyToggleState` in `src/view/VarietyToggleState.ts` — a plain, non-reactive class (same shape as `DetailLoadState`/`DetailNavigationState`), exposing `selectMega`/`selectGigantamax`/`resetSelection`/`snapshot`. `DetailScreen.svelte` mirrors `snapshot()` into its own `$state` after every `onUpdate` callback, same reasoning as `entryLoad`/`DetailLoadState`. `resetSelection()` (called from `startLoad` on every id change, same spot as `showShiny`'s reset) clears only the active selection — never the caches, since a variety key (e.g. `"charizard-mega-x"`) is globally unique across species and never needs discarding. The fetch behind `selectMega`/`selectGigantamax` is fire-and-forget and swallows a rejection explicitly (a dropped connection just leaves the toggle unpopulated until a retry click succeeds) rather than leaving an unhandled promise rejection. Tested in `VarietyToggleState.test.ts`.

`GigantamaxFormDetail` (`src/data/types.ts`) is only `PortraitImageSource` — no `types`/`stats`/`abilities` fields at all, since Gigantamax changes none of those (verified live, Gengar vs. gengar-gmax). This means `DetailScreen.svelte` has two genuinely different priority chains that read as one duplicated rule but aren't: `activeMegaData ?? activeGigantamaxData ?? entry` (3-way, portrait/shiny display only) vs `activeMegaData ?? entry` (2-way, accentColor/types/stats/abilities — gigantamax deliberately excluded, since it structurally lacks those fields). Don't unify them. Only the 3-way sites are true duplication — already deduped by reusing the `activePortraitSource` `$derived` rather than re-deriving the ternary.

## Evolution stage

How many evolution stages a row's family has (`evolutionStages`: 0 = none, 1, 2+) and whether nothing evolves from that row (`isFinalStage`, the "Last Stage" trait). Both are judged **per form**, not per species: only the evolution routes that row's own form can actually take count. Plain Kanto Farfetch'd, Mr. Mime, Qwilfish, Corsola and Linoone are final (their only evolution is Galarian/Hisuian-gated), while the Galarian rows keep theirs. `evolutionStages` is still a whole-family depth, not "stages remaining": a branch off the same parent stays open (Flapple reads 2 because of Applin's Dipplin -> Hydrapple line), only a branch gated on another regional form closes.

Two sources, in this order, read by `toTableRow` in `src/data/normalize.ts`:
- `EVOLUTION_STAGE_OVERRIDES` (`evolutionStageOverrides.json`, keyed by `pokemon.name`): only the rows whose own form differs from their species.
- `EVOLUTION_STAGES` / `IS_FINAL_EVOLUTION_STAGE`, indexed by species id: every other row, including regional rows with no gating (Alolan Rattata).

All three are written by one pass of `scripts/generate-evolution-stages.ts`, which calls `evolutionReachByForm` (`normalize.ts`) so the rule is unit-tested offline. Only a gate on a form in `REGIONAL_FORMS` counts. A gate on a cosmetic form (Deerling's seasons, Shellos' sea, Basculin's white stripe) is treated as open to every form, same filter as `inferAncestorFormSuffix`.

PokeAPI renamed `base_form` -> `required_pokemon_form` and `evolved_form` -> `evolved_pokemon_form` on `evolution_details`. `canonicalizeEvolutionChain` copies the new names onto the old ones at the repository seam (`getOrFetchEvolutionChain`, fresh fetch and cache read), so every reader keeps using `base_form`/`evolved_form`.

## Active Gen scoping

Generation-tagged row data (wild held items, capture locations) is stored for every supported generation and shown for the Active Gen only. The unscoped fields are named `heldItemsAllGens` and `encounterLocationsAllGens`, so reading one without scoping is visible at the call site.

Held items are scoped by `filterHeldItemsForGen` (`src/utils/heldItemGen.ts`). Capture locations go through one module, `describeEncounters(locations, activeGen)` in `src/utils/encounters.ts`, which returns everything the UI shows from a single scoped list: `summary` (table cell), `tooltip` (table title), `groups` (detail page lines) and `showRegion`. `showRegion` is the one rule for "a line needs its region header": more than one distinct region, not merely more than one line (a single-region Pokemon with a wild line and a trade line has two lines and one region). The helpers inside `encounters.ts` are exported only for their own regression tests (Mirage Tower, compass/bike slugs); callers use `describeEncounters`.

Base stats are scoped too, but by overlay rather than filter: `resolveStatsForGen` (`src/utils/stats.ts`) patches a finite list of buffed species (`STAT_OVERRIDES`) back to their pre-buff values. The detail page calls it per entry; the browse table calls `scopeRowsToGen` once over its rows in `TableScreen.svelte`, so stat columns, Total, stat sort and the stat-range filter read the Active Gen's numbers. `row.stats` on a `PokedexTableRow` is always the latest-game line; only the `scopedRows` derived in `TableScreen` is scoped.

Not the same as Generation fallback: that rule picks a different generation's tabs when the Active Gen has no data; Active Gen scoping just filters.


## Quirk and Trait

The two checkbox groups in FilterBar. Each option is one entry in `src/utils/quirksAndTraits.ts` (`QUIRKS`, `TRAITS`) carrying its key, label, icon and `matches(row, ctx)` predicate, so an option cannot exist without its predicate. `filterPokemon` only decides how a selection combines: **Quirks** are OR'd (a personal shortlist that can overlap on one Pokemon: "pickup OR holds an item"), **Traits** are AND'd (independent yes/no properties of the Pokemon: "Baby AND Fossil"). `ctx` carries Active Gen; `held-item` uses it (see Active Gen scoping), the rest ignore it. A selected key with no entry matches nothing. `quirksAndTraits.test.ts` fails if an entry has no fixture row that matches it.
