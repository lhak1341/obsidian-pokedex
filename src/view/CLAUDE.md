# src/view

Scoped to the Svelte components, view-state classes, and table/detail-screen UI.

## Domain rules

- Never recompute a generation from `dexNumber` via `resolveGenerationId()` in UI code —
  use the row/entry's precomputed `generationId`. `resolveGenerationId(dexNumber)` is wrong
  for every regional form (Alolan Rattata: dexNumber 19/Gen 1, real generationId 7).
  `DetailScreen.svelte` did this and showed the wrong Roman numeral.
  Stays prose: confirmed once (`DetailScreen.svelte`), and a lint rule would not have caught
  it anyway — `bun run lint` globs `src/**/*.ts`, and eslint parses no `.svelte` file here.
  The mechanism if a second instance lands is a scan test over `src/view/**/*.svelte` for
  `resolveGenerationId`, with a liveness assertion that it found files to scan.
- `PokedexLoadState.admit()` is the one place the generation scope is applied to fetched
  rows; `onRow`, `load()` and `retry()` all go through it. `getRowsForIds` adds regional-form
  rows next to every base id, so `retry()` once merged a disabled generation's Alolan Rattata
  into the table. A new path that adds rows must cross `admit`. `retry()`'s recovered count
  is ids (`attempted - failedIds.length`), not `result.rows.length`.
- Roman numerals come from `romanNumeral()` (`utils/romanNumeral.ts`) applied to
  `entry.generationId` — a generic algorithm, so it cannot drift the way the old
  hand-curated `ROMAN_NUMERALS` array did (it stopped at "VII" and rendered a blank `()`
  on every Gen 8 detail page).
- Names are capitalized purely via CSS `text-transform` — `.textContent` returns the raw
  lowercase value (`"ivysaur"`). Match lowercase when locating elements via eval.
- `heldItemsAllGens` and `encounterLocationsAllGens` (on `PokedexTableRow`/`PokedexEntry`)
  carry every supported generation's data unfiltered by design, tagged with `generationId`.
  The name is the guard: a consumer has to type "AllGens" to reach unscoped data, then scope
  it with `filterHeldItemsForGen` (`utils/heldItemGen.ts`) or `describeEncounters`
  (`utils/encounters.ts`) using the current Active Gen. It used to be a plain `heldItems`
  field and was missed independently for the table cell, its tooltip, the detail page and the
  Quirks filter in one session. `filterPokemon`'s `FilterContext.activeGen` is required for the
  same reason (no silent any-generation fallback).
- Stats in the browse table are Active Gen scoped by `scopeRowsToGen` (`utils/stats.ts`), applied once as `TableScreen`'s `scopedRows`; filter, sort and `col.render` take those rows. A new table reader must be fed `scopedRows`, not the raw `rows` prop, or it shows latest-game stats (`row.stats` itself is unscoped).
- Table columns are `{ render }` text columns or `{ custom: CustomCell }` columns TableScreen
  draws itself (`heldItems`, `encounterLocation`: they need the Active Gen; `ev`: it draws chips,
  its tooltip text is `formatEvYield`). A custom column has no `render`; do not add a text
  fallback (for the Active Gen columns it can only show every generation's data). A new custom
  column needs its own `col.custom === …` branch in `TableScreen.svelte`; there is no default
  (an unhandled value renders an empty `<td>`, and `tsc` cannot check the template), so
  `tableColumns.test.ts` scans the template for one branch per `custom` value in
  `TOGGLEABLE_COLUMNS` (imports the template with `?raw`, see root CLAUDE.md).
- `tsc` (`bun run typecheck`) skips `.svelte` files and the build only catches compile errors, so after renaming or removing a field/export, grep `src/**/*.svelte` for the old name by hand. A stale use builds clean and reads `undefined` live.
- `vitest.config.ts` has no Svelte plugin or jsdom, so a `.svelte.ts` rune module (`hoverPopover.svelte.ts`, `quickJumpDropdown.svelte.ts`) can't be tested. Put the branching in `utils/` and inject the DOM-bound piece: `resolvePortraitScale(…, measure)` takes `contentScale` as a parameter. ADR-0003 covers adding jsdom itself.

Adding a generation stales cached Moves/Flavor Text and needs a checklist walk — see
`docs/multi-gen-expansion-plan.md`'s Recipe section, not a bespoke fix here.

## PokeAPI-driven rendering

Official-artwork shiny PNGs crop up to 31% tighter than non-shiny for ~46 of 97 Mega
species (classic Gen 6 megas on a 475x475 canvas); newer fan-added megas (534x534) are
unaffected. `PortraitPanel.svelte`'s `portraitScale` (rule: `resolvePortraitScale` in `utils/portrait.ts`), via `imageBounds.ts`'s
`contentScale`, decodes each render's alpha bbox and scales the outlier down, shrink-only.
Treat "this sprite looks bigger/smaller" reports as a whole-variety-group bbox scan
before assuming a plugin bug.

## Table layout

- `table-layout: fixed` breaks "percentage width with a minimum floor" two ways silently:
  its sizing pass ignores `min-width`/`max-width` on `<col>`/`th`/`td` entirely, and it
  ignores `max()`/`calc()` on `<col>` width (falling back to equal splits). Use
  `table-layout: auto` with a plain `width: N%` on `<col>` for the extra-space share and a
  real `min-width` on the `<th>` as the floor — auto layout's never-shrink-below-content
  guarantee does the rest. Do **not** add `overflow: hidden; text-overflow: ellipsis` as a
  safety net: ellipsis collapses intrinsic min-content width to ~1 character and defeats
  that guarantee. Working pattern: `TableScreen.svelte`'s column widths.
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

## Live-verify recipes

- Focus first: `getLeavesOfType('pokedex-view')` + `setActiveLeaf(leaf, {focus:true})`. For
  a genuinely fresh Svelte mount, detach and reopen via
  `executeCommandById('obsidian-pokedex:open-pokedex')`.
- `.pokedex-view` — not `.workspace-leaf-content` or `.table-wrap`, both of which merely
  wrap it — is the actual `overflow-y: auto` scroll container for the table screen.
- Current screen: `.pokedex-view > div`'s `className` contains `hidden-screen` when the
  table is hidden (i.e. viewing detail); `.dex-eyebrow`'s `textContent` (`"No. 004"`) says
  which Pokemon. Both screens' DOM stay mounted regardless — a class name reused across a
  table cell and a detail-page component (e.g. `.held-item-name` in both `TableScreen.svelte`
  and `HeldItemsPanel.svelte`) can match the wrong (hidden) screen's element unless the
  selector is scoped to `.table-screen`/`.detail-screen` first.
- FilterBar's Type/Gen/Ability/Stats/Rarity/EV/Quirks dropdowns are native
  `<details>`/`<summary>`, not JS popovers — click the `<summary>` (match trimmed text with
  `startsWith`; some carry a live count badge like "Gen 1").
- Truncation/wrapping across the whole table:
  `[...containerEl.querySelectorAll('.name-cell')].filter(c => c.scrollWidth > c.clientWidth)`,
  and compare `getBoundingClientRect().top` across a flex-wrap container's children. A
  screenshot only covers visible rows.
- Fixtures: Venusaur has both Mega (single "M" badge) and Gigantamax ("G"); Charizard's Mega
  splits into X/Y badges and is the `portraitScale` fixture (shiny crops ~9% tighter);
  Farfetch'd always holds an item (Stick, 5%).
- Table rows stream in while loading, so a row count or before/after comparison taken right
  after a reload is meaningless: poll the `tbody tr` count until two reads 1.5s apart match
  before measuring.
- Open a detail page by clicking the row's `.name-cell`. Toggle `aria-label`s flip with state
  ("Show shiny sprite" / "Show normal sprite", "Show Mega X form" / "Show base Mega X form"),
  so find a button by its current label or the click throws. Charizard Mega X + shiny should
  read `scale(0.907)` on `.portrait-image` and on `.portrait-preview`.
- To verify an unfamiliar Lucide icon name, render it via `<Icon name=… />` in a live
  component and check `el.querySelector('svg')?.innerHTML` (non-empty = valid) — do not
  probe the icon registry from eval.
- A `$state` field seeded once via `untrack(() => initialX)` (TableScreen.svelte's
  `visibleColumnKeys`, `sortColumn`, `favoriteIds`) never re-seeds when its prop changes —
  it owns the value locally and only pushes out via a callback. Verifying one live via eval
  needs a real remount (force `saveSettings()`'s refresh, or leaf detach+reopen), not just
  mutating `plugin.settings.X` in place.
- Hover popovers (`.hover-popover-box`): dispatch `new MouseEvent('mouseenter', {bubbles:false})` on the element carrying `onmouseenter`; the body fills after an async fetch, so wait ~2.5s, then read the box scoped to `.table-screen` or `.detail-screen`, then dispatch `mouseleave`. Read right after the event and the box is not rendered yet, so the Loading state is not observable this way.
