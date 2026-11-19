# src/view

Scoped to the Svelte components, view-state classes, and table/detail-screen UI.

## Domain rules

- A row's generation is its precomputed `generationId`, drawn with `romanNumeral()` (`utils/romanNumeral.ts`). Never
  `resolveGenerationId(dexNumber)` in UI code: it is wrong for every regional form (Alolan Rattata: dexNumber 19/Gen 1,
  real generationId 7), and `DetailScreen.svelte` once showed the wrong numeral that way. eslint parses no `.svelte`
  here, so nothing catches it.
- `PokedexLoadState.admit()` is the one place the generation scope is applied to fetched rows; the streamed rows,
  `load()` and `retry()` all go through it, and a new path that adds rows must too (`getRowsForIds` adds regional-form
  rows next to every base id, so `retry()` once merged a disabled generation's Alolan Rattata into the table).
  `onUpdate(snapshot)` hands a fresh `rows` array each time, which `TableScreen`'s deriveds need.
- Active Gen data is unscoped at its source and scoped once before anything shows it, so a new reader takes the scoped
  form. Stats: `scopeRowsToGen` (`utils/stats.ts`), applied once as `TableScreen`'s `scopedRows` (`row.stats` is
  latest-game). Held items and encounters: `heldItemsAllGens`/`encounterLocationsAllGens` carry every generation, the
  "AllGens" name being the guard, scoped by `filterHeldItemsForGen` (`utils/heldItemGen.ts`) or `describeEncounters`
  (`utils/encounters.ts`); missed independently for the table cell, its tooltip, the detail page and the Quirks filter
  in one session. `filterPokemon`'s `FilterContext.activeGen` is required (no any-generation fallback), and a custom
  Field gets no text `render` (it could only show every generation's data).
- Saved preferences are never a local copy. Favourites, the Fields selection and the layout per width class live in
  `PokedexPlugin.preferences` (`utils/localPreferences.ts`, ADR-0012), one holder shared by every open Pokédex leaf;
  `PokedexApp` mirrors it (`prefs`, refreshed by `subscribe`) and writes through it, and every layout or panel takes
  `favoriteIds`/`onToggleFavorite` from there. The single-Pokémon views (detail screen, tap panel) draw
  `FavoriteToggle.svelte`; lists mark favourites only (the table with the dot `FavoriteMark.svelte`, Card view with an accent outline on the tile) and toggle
  through `view/favoriteMenu.ts` (right-click or press and hold; rules in `utils/pressHold.ts`). A `$state` seeded once via
  `untrack(() => initialX)` (TableScreen's `sort`) never re-seeds from its prop, which is right for view state and wrong
  for anything saved: two leaves then save over each other (reproduced for favourites and Fields before ADR-0012).
- The browse screen is one list drawn two ways. `TableScreen.svelte` owns filters (search included) and one `SortState`
  and renders the `<table>` or `CardGrid.svelte` from the same `visibleRows`, so a layout switch keeps them; both sort
  through `nextSort`, and an effect resets the sort through `sortAfterFieldsChange` whichever leaf unchose the Field.
  `PokedexApp` picks the layout per width class (`utils/browseLayout.ts`) from a `ResizeObserver` on the leaf; CSS reads
  the same leaf as the `pane` container, so a Narrow pane query is `@container pane (width < 600px)`, never a width
  converted to an inner container (`paneBreakpoint.test.ts`). Card
  view's derivations (tile, grid, the tap panel's placement, columns and chips) are pure in `utils/cardView.ts`; a tile
  tap opens `CardPanel.svelte` (open id held in `CardGrid`), whose held item uses TableScreen's `itemPopover`.
- `tsc` (`bun run typecheck`) skips `.svelte` and the build only catches compile errors, so a stale field or export
  builds clean and reads `undefined` live: after renaming or removing one, grep `src/**/*.svelte` by hand.
- Fields (`utils/fields.ts`, `FIELDS`) are `{ render }` text Fields or `{ custom: CustomCell }` Fields the layout draws
  itself; the table's geometry per Field is `TABLE_GEOMETRY` (`utils/tableColumns.ts`). A new custom Field needs a
  `col.custom === …` branch in `TableScreen.svelte` and a `field.custom === …` branch in `CardPanel.svelte`; neither
  has a default (an empty `<td>`, a bare icon chip), so `tableColumns.test.ts` and `cardView.test.ts` scan the
  templates (imported with `?raw`) for one branch per `custom` value.
- `vitest.config.ts` has no Svelte plugin or jsdom, so a `.svelte.ts` rune module (`infoPopover.svelte.ts`,
  `quickJumpDropdown.svelte.ts`) can't be tested (the Info popover's pin rules are therefore `utils/infoPopoverPin.ts`;
  press and hold's are `utils/pressHold.ts`, bound by `view/favoriteMenu.ts` and the portrait's `view/portraitPress.ts`, which share the timer and scroll watch in
  `view/pressWatch.ts`).
  Put the branching in `utils/` and inject the DOM-bound piece: `resolvePortraitScale(…, measure)` takes DetailScreen's
  `measurePortrait`, and the decode's memo is `contentBounds = memoizeByCachePath(decode)` (`imageBounds.ts`, read by
  `contentScale` and Card view's `fitSprite`). ADR-0003 covers adding jsdom itself.

Adding a generation stales cached Moves/Flavor Text and needs a checklist walk — see
`docs/multi-gen-expansion-plan.md`'s Recipe section, not a bespoke fix here.

## PokeAPI-driven rendering

PokeAPI images do not place or scale their content consistently inside the canvas, so any
layout that frames an image tightly must size and centre it by its alpha bbox, not its canvas.
- Official-artwork shiny PNGs crop up to 31% tighter than non-shiny for ~46 of 97 Mega
  species (classic Gen 6 megas on a 475x475 canvas); newer fan-added megas (534x534) are
  unaffected. `PortraitPanel.svelte`'s `portraitScale` (rule: `resolvePortraitScale` in `utils/portrait.ts`), via `imageBounds.ts`'s
  `contentScale`, decodes each render's alpha bbox and scales the outlier down, shrink-only.
  Treat "this sprite looks bigger/smaller" reports as a whole-variety-group bbox scan
  before assuming a plugin bug.
- 96px front sprites sit off-centre on their canvas: centring the canvas in an 85px Card view
  tile clipped Venusaur/Charizard; centring the bbox fixed all but 5 of 40, which then need a downscale.

## Table layout

- `table-layout: fixed` breaks "percentage width with a minimum floor" two ways silently:
  its sizing pass ignores `min-width`/`max-width` on `<col>`/`th`/`td` entirely, and it
  ignores `max()`/`calc()` on `<col>` width (falling back to equal splits). Use
  `table-layout: auto` with a plain `width: N%` on `<col>` for the extra-space share and a
  real `min-width` on the `<th>` as the floor — auto layout's never-shrink-below-content
  guarantee does the rest. Do **not** add `text-overflow: ellipsis` as a safety net: it
  collapses intrinsic min-content width to ~1 character and defeats that guarantee.
  `overflow: hidden` alone does not (the Info popover target cells clip their tap area with
  it; column widths measured identical). Working pattern: `TableScreen.svelte`'s column widths.
  A second line inside a cell can still ellipsize: `display: block; width: 0; min-width: 100%` keeps it out of the cell's min-content (the narrow table's `.form-line`).
- `tr:nth-child(odd)` striping breaks once a row can be conditionally inserted (a divider
  shifts parity for everything after it). Track alternation with an explicit index computed
  over real data rows only, applied as a class.
- A `<tr>`/`<td>` can take `height: 0` (with `position: relative; overflow: visible` on the
  `td`) and still show `position: absolute` content — absolutely positioned children do not
  contribute to auto-height. Used for `MoveBrowser`'s evolution-level divider overlay.
- `stroke-dasharray` with a dash shorter than `stroke-width` plus `stroke-linecap: round`
  (EvolutionTree's connector: width 3, dasharray "2 6") renders pill-shaped blobs, not
  circles — the two round caps overlap. CSS `radial-gradient`/dashed borders cannot
  reproduce it; reuse a real inline `<svg><line>`.

## Live verification

Driving the running plugin through `obsidian eval` (remounting, faking I/O, scoping selectors to the visible screen,
Info popover events, fixtures, A/B proofs, phone-width overlays) is in `docs/live-verification.md`; read it before a
live check.
