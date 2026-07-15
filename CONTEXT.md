# Domain glossary

## Generation fallback

The rule "scope to the currently Active Gen's data, fall back to the latest supported generation's data when Active Gen predates this entry" (e.g. viewing a Gen 4 mon with Active Gen set to Gen 3, which has no data for it at all).

Implemented once, generically, as `resolveTabsForGen` in `src/utils/generationFallback.ts` — tested in `generationFallback.test.ts`. Used by:
- `MoveBrowser.svelte`'s `moveVersionTabs` (move version-group tabs)
- `FlavorTextPanel.svelte`'s `flavorTabs` (flavor-text version tabs)

Not the same rule as `resolveStatsForGen` in `src/utils/stats.ts`, despite the similar English description — that function has the opposite control-flow direction: it defaults to `current` (already the latest-gen-correct stat line) and conditionally patches it *backward* for a finite list of species keyed by `pokemonId`, with a `validThroughGen` ceiling. It isn't a gen-indexed tab list with a filter-then-fallback shape, so it stays a separate implementation.

## Quick jump

A small always-visible search box (FilterBar's main search input, QuickSearch on the detail screen) that offers a live dropdown of up to 8 matching Pokemon, navigable with Up/Down/Enter, opened from anywhere via Cmd/Ctrl+Shift+L. Distinct from the browse table's own live filtering (`filters.search`) — quick jump is a fast way to jump straight into a result's detail page, not the table's row filter, even on FilterBar where both live in the same input.

Match derivation and Up/Down/Enter nav are implemented once in `src/utils/quickJump.ts` (`quickJumpMatches`, `stepQuickJumpNav` — tested in `quickJump.test.ts`), used by `QuickSearch.svelte` and `FilterBar.svelte`. Escape stays caller-local — the two components deliberately diverge there (QuickSearch clears its ephemeral query; FilterBar's dropdown dismisses without touching `filters.search`).

The Cmd/Ctrl+Shift+L global hotkey registration is a separate shared seam, `registerGlobalHotkey` in `src/view/globalHotkey.ts` — DOM-bound, untested by convention (same as `domPosition.ts`'s `relativeRect`).

## Evolution requirement

The human-readable description of what triggers a node's own evolution (e.g. "Lv. 16", "Thunder Stone", "Trade (metal coat)", "Lv. 30 (Female)") — shown as the method line on `EvolutionChain.svelte`'s card for that node.

Computed by `describeEvolutionRequirement` in `src/data/normalize.ts`, tested in `normalize.test.ts` alongside every other pure function derived from `EvolutionNode` (`normalizeEvolutionChain`, `collectChainIds`, `nextEvolutionLevels`). Priority-ordered base label (minLevel > item > minHappiness > minBeauty > knownMove > partySpecies > location > trigger), then relativePhysicalStats/trade+heldItem-override/gender/timeOfDay layered on top in that fixed order — see the function's own comment for why trade+heldItem is a hard override rather than a suffix.

## View history

A browser-style back/forward stack of previously-viewed Pokemon on the detail screen, bound to `[`/`]`. Stepping back past the oldest entry exits to the table (same destination as the "Back to list" button); stepping forward from the table re-enters detail at wherever the stack was last pointing. Distinct from Quick jump: quick jump searches and jumps into a result, view history steps through Pokemon already visited.

Opening a mon from the table always starts a fresh chain (like navigating to a new page from the browser's home page) — it does not resume whatever was left over from an earlier chain you'd already stepped out of. Opening from inside detail (evolution card, quick search, or resuming into detail via `]`) continues the current chain instead: truncate-then-push, same as a browser tab's forward history being dropped once you navigate somewhere new mid-stack.

Implemented once, generically, as `pushHistory`/`stepBack`/`stepForward` in `src/utils/viewHistory.ts` — tested in `viewHistory.test.ts`. Used by `PokedexApp.svelte`'s `openDetail`/`goBack`/`goForward`, which apply the returned action (`select`/`exitToTable`/`none`) as `screen`/`selectedId`/scroll writes.
