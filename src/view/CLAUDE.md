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
- Roman numerals come from `romanNumeral()` (`utils/romanNumeral.ts`) applied to
  `entry.generationId` — a generic algorithm, so it cannot drift the way the old
  hand-curated `ROMAN_NUMERALS` array did (it stopped at "VII" and rendered a blank `()`
  on every Gen 8 detail page).
- Names are capitalized purely via CSS `text-transform` — `.textContent` returns the raw
  lowercase value (`"ivysaur"`). Match lowercase when locating elements via eval.
- `heldItems` carries every supported generation's rarities unfiltered by design (tagged
  with `generationId`, not scoped) — a new consumer (display, filter, tooltip) must
  explicitly call `filterHeldItemsForGen` (`utils/heldItemGen.ts`) with the current Active
  Gen. The raw field silently ignores Active Gen otherwise; this was missed independently
  for the table cell, its tooltip, the detail page, and the Quirks "Held Item" filter in
  one session before the pattern was caught.

Adding a generation stales cached Moves/Flavor Text and needs a checklist walk — see
`docs/multi-gen-expansion-plan.md`'s Recipe section, not a bespoke fix here.

## PokeAPI-driven rendering

Official-artwork shiny PNGs crop up to 31% tighter than non-shiny for ~46 of 97 Mega
species (classic Gen 6 megas on a 475x475 canvas); newer fan-added megas (534x534) are
unaffected. `DetailScreen.svelte`'s `portraitScale`, via `imageBounds.ts`'s
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
  which Pokemon.
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
- To verify an unfamiliar Lucide icon name, render it via `<Icon name=… />` in a live
  component and check `el.querySelector('svg')?.innerHTML` (non-empty = valid) — do not
  probe the icon registry from eval.
- A `$state` field seeded once via `untrack(() => initialX)` (TableScreen.svelte's
  `visibleColumnKeys`, `sortColumn`, `favoriteIds`) never re-seeds when its prop changes —
  it owns the value locally and only pushes out via a callback. Verifying one live via eval
  needs a real remount (force `saveSettings()`'s refresh, or leaf detach+reopen), not just
  mutating `plugin.settings.X` in place.
