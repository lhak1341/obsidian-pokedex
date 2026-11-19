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
  rows; the streamed rows, `load()` and `retry()` all go through it. `getRowsForIds` adds regional-form
  rows next to every base id, so `retry()` once merged a disabled generation's Alolan Rattata
  into the table. A new path that adds rows must cross `admit`. `retry()`'s recovered count
  is ids (`attempted - failedIds.length`), not `result.rows.length`; `retry()` now returns that
  as `{ attempted, recovered, stillFailing }` and `load()` returns `{ loaded, failed }` (null
  when nothing failed), so `PokedexApp` only maps them through `loadNotices.ts`. The class owns
  the streamed rows and calls `onUpdate(snapshot)` (a fresh `rows` array each time, which
  `TableScreen`'s deriveds need) — not after `cancel()`.
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
- Favourites, the Fields selection and the layout per width class live in `PokedexPlugin.preferences` (`utils/localPreferences.ts`,
  ADR-0012), one holder shared by every open Pokédex leaf. `PokedexApp` mirrors it (`prefs`, refreshed by `subscribe`) and
  writes through it. The table, Card view and the detail screen take `favoriteIds`/`onToggleFavorite` from there and draw
  `FavoriteToggle.svelte`. A new layout or panel reads the same props; it must not keep its own copy (two leaves then save
  over each other: reproduced before ADR-0012).
- The browse screen is one list drawn two ways. `TableScreen.svelte` owns filters (search included) and one `SortState`,
  takes the Fields as a live prop, and renders either the `<table>` or `CardGrid.svelte` from the same `visibleRows`,
  so a layout switch keeps all of them; both sort through `nextSort`, and an effect resets the sort through
  `sortAfterFieldsChange` whichever leaf unchose the Field. `PokedexApp` picks the layout for the leaf's width class
  (`utils/browseLayout.ts`), fed by a `ResizeObserver` on the leaf
  (`PokedexView` passes `containerEl`). Card view's derivations (corners, stat strip, sort chips, grid columns,
  sprite fit) are pure in `utils/cardView.ts`; `CardGrid` keeps only drawing glue (an EV yield as one dot per point, and
  the canvas-centred placement of a sprite whose bounds are not decoded yet).
- Fields (`utils/fields.ts`, `FIELDS`) are `{ render }` text Fields or `{ custom: CustomCell }`
  Fields the layout draws itself; the table's width/floor/alignment per Field is
  `TABLE_GEOMETRY` in `utils/tableColumns.ts` (keyed by `FieldKey`), joined as `TABLE_COLUMNS`. TableScreen
  draws custom cells itself (`heldItems`, `encounterLocation`: they need the Active Gen; `ev`: chips via `EvChips.svelte`,
  shared with the detail screen; its tooltip text is `formatEvYield`). A custom Field has no `render`; do not add a text
  fallback (for the Active Gen Fields it can only show every generation's data). A new custom
  Field needs its own `col.custom === …` branch in `TableScreen.svelte`; there is no default
  (an unhandled value renders an empty `<td>`, and `tsc` cannot check the template), so
  `tableColumns.test.ts` scans the template for one branch per `custom` value in
  `FIELDS` (imports the template with `?raw`, see root CLAUDE.md).
- `tsc` (`bun run typecheck`) skips `.svelte` files and the build only catches compile errors, so after renaming or removing a field/export, grep `src/**/*.svelte` for the old name by hand. A stale use builds clean and reads `undefined` live.
- `vitest.config.ts` has no Svelte plugin or jsdom, so a `.svelte.ts` rune module (`infoPopover.svelte.ts`, `quickJumpDropdown.svelte.ts`) can't be tested (the Info popover's pin rules are therefore `utils/infoPopoverPin.ts`, tested there). Put the branching in `utils/` and inject the DOM-bound piece: `resolvePortraitScale(…, measure)` takes a `measure` (DetailScreen's `measurePortrait`, over `contentScale`), and the decode's memo is `contentBounds = memoizeByCachePath(decode)` (`imageBounds.ts`; `contentScale` and Card view's `fitSprite` both read it). ADR-0003 covers adding jsdom itself.

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

- A live check fakes the plugin's slow or persistent I/O on the live instance, restored in a `finally` by `delete`-ing the own property (the prototype method shows through): `repo.getTableRows`/`retryRows` for the load, banner and Notice paths, since a real-vault load once took over 90 s (rows render, `.loading-more-banner` stays up, so a few-second sleep reads the banner and Notices as absent); `plugin.loadData`/`saveData` for a settings path or any control that persists (a favourite asterisk tap saves settings) (return the old-shape data, capture writes, `await plugin.loadSettings()`, then the leaf swap below), so `data.json` is never written. Poll for the banner to clear only when the real load is the thing under test.
- View history: read `leaf.history.backHistory`/`forwardHistory` (each entry's `state.state` is a `NavRecord`) and `leaf.view.getState()`. Step with the header arrows (`leaf.containerEl` `.view-header-nav-buttons button`), a `keydown` `[`/`]` on `document.body` (focused Pokédex tab only), or, in emulated mobile, `app.mobileNavbar.backButtonEl`/`forwardButtonEl`.click(): a `document.querySelector('[aria-label="Navigate back"]')` finds the tab header's arrow first, and the bar's `.mobile-navbar-action-back` wrapper ignores a click. The bar's dimming is its buttons' `aria-disabled`.
- Emulated mobile and the iPhone loop: `docs/mobile-verification.md` (CLI targets
  `pokedex-test-vault`; a hidden window throttles timers, so evals stall and Notices never
  time out (clear `.notice` before checking one shows); `dev:mobile` is global, turn it off).
- A "no visible change" refactor is proved by A/B against HEAD, not by eye: `git archive HEAD | tar -x -C <scratch>`, symlink `node_modules`, `bun run build`; copy each build into `pokedex-test-vault`, `plugin:reload`, and compare a hash of `JSON.stringify((await plugin.repository.getTableRows({start:1,end:1025})).rows)` with each `spriteDataUri` replaced by `plugin.repository.imagePathOf(it)` (blob URLs differ per load; a warm cache keeps it offline).
- Phone-width design needs no emulator: inject a throwaway overlay into the live `pokedex-view` leaf inside a fixed-width column (any width: `.pokedex-view{width:Npx}` also drives the detail screen's `@container detail` queries, at N − 46px since the pane pads 23px a side, so state which of the two widths a breakpoint means), take row order/filter/sort from the table DOM and raw records from `plugin.repository.pokemonMemCache` (by id, all 6 stats) / `speciesMemCache` (`capture_rate`), then remove it. If the leaf is on the detail screen the table measures 0px, so click `.detail-screen .back-button` first. To show motion, pause it at a set point with `animation-play-state: paused` plus a negative `animation-delay`, screenshot each frame (`dev:screenshot` takes seconds, too slow for a live animation), and combine frames with `ffmpeg` `hstack`/`vstack` (no PIL or `magick` here). The user may click the live overlay between shots, so return its state from each eval and check it before trusting a frame.
- Narrow-pane width budget: a 390px leaf leaves the browse content 319px (12px `.view-content` + 16px `.pokedex-view` padding a side, and a 15px scrollbar gutter that `dev:mobile` keeps). A real Narrow pane needs no emulation: `await app.workspace.getRightLeaf(false).setViewState({type:'pokedex-view'})`, then `rightSplit.expand()` and `revealLeaf` it, gives a ~300px leaf beside the wide one (detach it after). Unrevealed it measures 0 and shows the wide layout, and JS clicks still land in it, so a check against it silently tests the wrong width class.
- Focus first: `getLeavesOfType('pokedex-view')` + `setActiveLeaf(leaf, {focus:true})`. For
  a genuinely fresh Svelte mount, swap the same leaf's view: `setViewState({type:'empty'})`,
  then `setViewState({type:'pokedex-view',active:true})`. Detaching breaks emulated mobile
  (`docs/mobile-verification.md` step 5).
- `.pokedex-view` — not `.workspace-leaf-content` or `.table-wrap`, both of which merely
  wrap it — is the actual `overflow-y: auto` scroll container for the table screen.
- Current screen: `.pokedex-view > div`'s `className` contains `hidden-screen` when the
  table is hidden (i.e. viewing detail); `.dex-eyebrow`'s `textContent` (`"No. 004"`) says
  which Pokemon. Both screens' DOM stay mounted regardless, so whatever is tied to one screen
  still acts while it is hidden: a class name reused across a table cell and a detail-page
  component (e.g. `.held-item-name` in both `TableScreen.svelte` and `HeldItemsPanel.svelte`)
  matches the wrong (hidden) screen's element unless the selector is scoped to
  `.table-screen`/`.detail-screen` first, and state held outside a screen outlives it (a pin
  on the hidden table suppressed every hover preview until `infoPopover.svelte.ts` began
  dropping a pin whose target has no client rects).
- FilterBar's Type/Gen/Ability/Stats/Rarity/EV/Quirks dropdowns are native
  `<details>`/`<summary>`, not JS popovers — click the `<summary>` (match trimmed text with
  `startsWith`; some carry a live count badge like "Gen 1").
- Truncation, wrapping or touching text across every row or tile:
  `[...containerEl.querySelectorAll('.name-cell')].filter(c => c.scrollWidth > c.clientWidth)`,
  compare `getBoundingClientRect().top` across a flex-wrap container's children, and for neighbours running together compare each text's `Range.getBoundingClientRect()` with the previous one (Card view's `.strip-col b`). A
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
- `obsidian eval` cannot reach the `obsidian` module (`require('obsidian')` throws; there is
  no global `getIcon`/`setIcon`). To verify a Lucide name, render `<Icon name=… />` in a live
  component and check `el.querySelector('svg')?.innerHTML` is non-empty; an overlay takes icon
  SVGs from rendered table headers, inlines them, or harvests them from a remount with the
  setting flipped in memory only (`useTypeIcons` for type icons: badge mode renders none).
- A `$state` field seeded once via `untrack(() => initialX)` (TableScreen.svelte's `sort`) never re-seeds when its
  prop changes — it owns the value locally. Anything saved must not be such a copy: two Pokédex leaves then save over
  each other's change (reproduced for favourites and Fields; ADR-0012's holder fixed it). Verifying one live via eval
  needs a real remount (force `saveSettings()`'s refresh, or the leaf swap above), not just
  mutating `plugin.settings.X` in place.
- Info popovers (`.info-popover-box`, `.pinned` when pinned): targets are `.pkdx-info-target`. Preview with `new PointerEvent('pointerenter', {pointerType:'mouse'})` on the target (a `MouseEvent('mouseenter')` no longer opens it, and `pointerType:'touch'` must not); pin with `el.click()`; close with a `keydown` `Escape` on `document.body`. The body fills after an async fetch, so wait ~2s, then read the box scoped to `.table-screen` or `.detail-screen`. Only one box is open across every instance (the pin state is module-level in `infoPopover.svelte.ts`). Scroll the target into view before `focus()` + Enter: with an off-screen target, Enter's pin read as closed (inferred: `focus()` scrolled it into view and that scroll closed the pin; in view, 0 scrolls fired and it pinned).
