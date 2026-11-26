# Domain glossary

## Generation fallback

The rule "scope to the currently Active Gen's data, fall back to the latest supported generation's data when Active Gen predates this entry" (e.g. viewing a Gen 4 mon with Active Gen set to Gen 3, which has no data for it at all).

Implemented once, generically, as `resolveTabsForGen` in `src/utils/generationFallback.ts` — tested in `generationFallback.test.ts`. It returns the tabs, the generation they actually came from (`gen`, null when no generation has data) and the caller's Remembered tab resolved to a selection. `MoveBrowser`'s heading reads `gen` (as `resolveMoveView`'s `shownGen`) so it names the generation it shows (`Moves (G4 · no G3 data)` after a fallback); `FlavorTextPanel` has no label and ignores it. Used by:
- `resolveMoveView` in `src/utils/moveRows.ts` (move version-group tabs; `MoveBrowser` renders its result)
- `FlavorTextPanel.svelte`'s `flavorTabs` (flavor-text version tabs)

Not the same rule as `resolveStatsForGen` in `src/utils/stats.ts`, despite the similar English description — that function has the opposite control-flow direction: it defaults to `current` (already the latest-gen-correct stat line) and conditionally patches it *backward* for a finite list of species keyed by `pokemonId`, with a `validThroughGen` ceiling. It isn't a gen-indexed tab list with a filter-then-fallback shape, so it stays a separate implementation.

## Remembered tab

A tab choice kept across navigation and Active Gen switches (move version, move method, flavor-text version). A view shows the remembered tab when it has it, else its first tab; the choice itself is never overwritten, so a later view that has the tab again shows it again. `pickRemembered` in `src/utils/generationFallback.ts`, used by `resolveTabsForGen` and by `resolveMoveView` for move method tabs, the one Remembered tab with no Generation fallback (Champions teaches only by Train, so it opens there whatever is remembered).

## Quick jump

A small always-visible search box (FilterBar's main search input, QuickSearch on the detail screen) that offers a live dropdown of up to 8 matching Pokemon, navigable with Up/Down/Enter, focused with Cmd/Ctrl+Shift+L while the Pokédex tab is the active one (a Leaf hotkey). Distinct from the browse table's own live filtering (`filters.search`) — quick jump is a fast way to jump straight into a result's detail page, not the table's row filter, even on FilterBar where both live in the same input.

Match derivation and Up/Down/Enter nav are implemented once in `src/utils/quickJump.ts` (`quickJumpMatches`, `stepQuickJumpNav` — tested in `quickJump.test.ts`). The dropdown orchestration built on top of those primitives — open/activeIndex state, DOM event wiring, registering the Cmd/Ctrl+Shift+L focus handler under its screen — used to be duplicated between `QuickSearch.svelte` and `FilterBar.svelte`; it's now a single shared seam, `createQuickJumpDropdown` in `src/view/quickJumpDropdown.svelte.ts` (runes-based, untested by convention — same DOM-bound category as `infoPopover.svelte.ts`), paired with a shared `QuickJumpDropdown.svelte` for the list markup itself.

The two callers diverge in exactly two caller-supplied places, both taken as callbacks by the hook rather than hardcoded:
- **On Select** — QuickSearch's `onSelect` blurs the input (so the editable-target rule doesn't block the `"["`/`"]"` Leaf hotkey right after navigating, since QuickSearch stays on the same detail screen); FilterBar's `onSelect` switches to the detail screen, so it doesn't need to blur: TableScreen stays mounted but goes `display:none`, which drops the input's focus.
- **On Escape** — the hook itself does the (identical, unconditional) blur; only the text-clearing is caller-specific, via `onEscape` (QuickSearch clears its ephemeral `query`; FilterBar's `onEscape` is a no-op, since `filters.search` is the table's real live filter, not an ephemeral query).

The search text itself (`query()` in the hook's options) also stays caller-owned rather than moving into the hook — QuickSearch's is a local ephemeral string, FilterBar's is `filters.search`, which the table's own live filter also reads.

## Leaf hotkeys

The keys a Pokédex tab answers: `[`/`]` step its View history, ←/→ step to the adjacent Pokémon on the detail screen, and Cmd/Ctrl+Shift+L focuses the showing screen's Quick jump box. Only the active Pokédex tab answers; in every other tab, a note included, the key is left to Obsidian. The plain keys don't fire while typing in an input or with Cmd/Ctrl held (Mod+`[`/`]` are Obsidian's own back/forward). Distinct from Quick jump's Up/Down/Enter/Escape, which are the search box's own handlers.

Each leaf has one keydown listener, `PokedexView`'s, registered on `window` in the capture phase (why: its comment; Mod+Shift+L has to beat Obsidian's HotkeyManager). It asks `resolveLeafHotkey` (`src/utils/leafHotkeys.ts`, tested in `leafHotkeys.test.ts`), which takes the key, the modifiers, whether the target is editable, the screen and whether this leaf is active, and returns a command or nothing. An event it returns nothing for is left untouched (no `preventDefault`). History steps go to the leaf's own history. The other two commands go to a `LeafCommandRegistry` (`src/view/LeafCommandRegistry.ts`, tested), owned by the view and handed to the screens through Svelte context: DetailScreen registers `adjacent` (it owns `adjacent`, ADR-0009), and FilterBar and QuickSearch register `focusSearch` under their screen, so only the showing screen's box takes focus. A handler that did nothing (an arrow at either end of the dex) leaves the key alone too. `leafHotkeyListener.test.ts` fails if any other file listens for keydown on the window or document.

Before this, each screen had its own window listener, and only `[`/`]` checked for the active tab (probed live with two tabs): ←/→ stepped every tab on a detail screen, background ones included; Mod+Shift+L focused a search box in whichever tab mounted last and swallowed Obsidian's insert-embed in notes; `[` was `preventDefault`-ed on a note.

## Evolution requirement

The human-readable description of what triggers a node's own evolution (e.g. "Lv. 16", "Thunder Stone", "Trade (metal coat)", "Lv. 30 (Female)") — shown as the method line on `EvolutionChain.svelte`'s card for that node.

Computed by `describeEvolutionRequirement` in `src/data/normalize.ts`, tested in `normalize.test.ts` alongside every other pure function derived from `EvolutionNode` (`normalizeEvolutionChain`, `normalizeEvolutionChainForViewed`, `collectChainIds`, `nextEvolutionLevels`). `normalizeEvolutionChainForViewed(chain, { id, pokemonName, speciesName })` is the entry the repository calls: it picks the regional-variant path (the viewed Pokemon's own suffix, else the gating ancestor's suffix as for Obstagoon, else the default view) and builds the context. Priority-ordered base label (minLevel > item > minHappiness > minBeauty > knownMove > partySpecies > location > trigger), then relativePhysicalStats/trade+heldItem-override/gender/timeOfDay layered on top in that fixed order — see the function's own comment for why trade+heldItem is a hard override rather than a suffix.

## View history

The back/forward record of the screens a Pokédex tab has shown: the table and each Pokemon viewed. It is the tab's own navigation history in Obsidian, the same one that holds the notes the tab showed before, so Obsidian's back/forward (the mobile navigation bar, the tab header arrows, mouse back buttons) and `[`/`]` all step through it. Distinct from Quick jump: quick jump searches and jumps into a result, view history steps through screens already shown.

Every Pokemon shown is an entry, including prev/next in dex order. "Back to list" adds a table entry rather than stepping back, so back from the table returns to the last Pokemon. Showing anything new drops the forward entries, as in a browser. Stepping back to the table restores its scroll position; stepping to a Pokemon opens it at the top. The screen and Pokemon are also what a restarted Obsidian reopens the tab on.

Implemented by `PokedexView` (`src/view/PokedexView.ts`): it sets `navigation = true` (without it `WorkspaceLeaf.recordHistory` ignores the view), `getState` returns the current `NavRecord` (`{ screen, pokemonId }`), and `setState` applies one and sets `result.history` when it changed anything. A new screen goes out through `leaf.setViewState`, so Obsidian records the screen being left; back/forward replay an entry into `setState` on the same live view, so filters and the table's scroll survive. `[`/`]` call the leaf's `history.back()`/`forward()`, only from the active Pokédex tab (see Leaf hotkeys). The screen, selected id and saved table scroll live in `DetailNavigationState` (`src/view/DetailNavigationState.ts`), a plain, DOM-free class owned by the view (so a settings remount keeps the screen) and tested in `DetailNavigationState.test.ts`: its `setState(record, scrollTop)` returns a `ScrollInstruction` (`reset` for a Pokémon, `restore` for the table, `none` for the record already showing) that `PokedexApp.svelte`'s `applyNavigation` executes against `rootEl`. `parseNavRecord` vets what Obsidian hands back (a saved layout, `{}` on a bare open). A step that leaves the Pokédex (to a note the tab showed earlier) and comes back builds a new view, so filters and the table's scroll survive only steps between Pokédex screens. Mouse back/forward buttons need no wiring: Obsidian steps the active leaf's history on their `mousedown` (probed live).

## Variety toggle

The detail screen's Mega/Gigantamax display state: which variety (if any) is currently shown in place of the base species, and the session-lifetime cache of forms already fetched. In-game, Mega and Gigantamax/Dynamax are mutually exclusive on the same Pokemon — selecting one always deactivates the other, even for a species (e.g. Venusaur) with both available to toggle independently.

Implemented as `VarietyToggleState` in `src/view/VarietyToggleState.ts` — a plain, non-reactive class (same shape as `DetailLoadState`/`DetailNavigationState`), exposing `selectMega`/`selectGigantamax`/`resetSelection`/`snapshot`. `DetailScreen.svelte` mirrors `snapshot()` into its own `$state` after every `onUpdate` callback, same reasoning as `entryLoad`/`DetailLoadState`. `resetSelection()` (called from `startLoad` on every id change, same spot as `showShiny`'s reset) clears only the active selection — never the caches, since a variety key (e.g. `"charizard-mega-x"`) is globally unique across species and never needs discarding. A cached generation has every form stored ahead (`cacheRange`, "Entry load"); otherwise the form is fetched on the click. The fetch behind `selectMega`/`selectGigantamax` is fire-and-forget. A failed load clears the selection and reports it (`onFailed`; DetailScreen raises "couldn't load the Mega X form"), so a selected badge always means its form loaded and one more click retries; a failure that a newer click, a switch to the other form or a deselect has superseded is dropped silently. Tested in `VarietyToggleState.test.ts`.

`GigantamaxFormDetail` (`src/data/types.ts`) is only `PortraitImageSource` — no `types`/`stats`/`abilities` fields at all, since Gigantamax changes none of those (verified live, Gengar vs. gengar-gmax). This means `DetailScreen.svelte` has two genuinely different priority chains that read as one duplicated rule but aren't: `activeMegaData ?? activeGigantamaxData ?? entry` (3-way, portrait/shiny display only) vs `activeMegaData ?? entry` (2-way, accentColor/types/stats/abilities — gigantamax deliberately excluded, since it structurally lacks those fields). Don't unify them. Only the 3-way sites are true duplication, and the chain is written twice: in `portraitUri`'s `$derived.by` and in the `portraitSource` prop passed to `PortraitPanel`.

## Evolution stage

How many evolution stages a row's family has (`evolutionStages`: 0 = none, 1, 2+) and whether nothing evolves from that row (`isFinalStage`, the "Last Stage" trait). Both are judged **per form**, not per species: only the evolution routes that row's own form can actually take count. Plain Kanto Farfetch'd, Mr. Mime, Qwilfish, Corsola and Linoone are final (their only evolution is Galarian/Hisuian-gated), while the Galarian rows keep theirs. `evolutionStages` is still a whole-family depth, not "stages remaining": a branch off the same parent stays open (Flapple reads 2 because of Applin's Dipplin -> Hydrapple line), only a branch gated on another regional form closes.

Two sources, in this order, read by `toTableRow` in `src/data/normalize.ts`:
- `EVOLUTION_STAGE_OVERRIDES` (`evolutionStageOverrides.json`, keyed by `pokemon.name`): only the rows whose own form differs from their species.
- `EVOLUTION_STAGES` / `IS_FINAL_EVOLUTION_STAGE`, indexed by species id: every other row, including regional rows with no gating (Alolan Rattata).

All three are written by one pass of `scripts/generate-evolution-stages.ts`, which calls `evolutionReachByForm` (`normalize.ts`) so the rule is unit-tested offline. Only a gate on a form in `REGIONAL_FORMS` counts. A gate on a cosmetic form (Deerling's seasons, Shellos' sea, Basculin's white stripe) is treated as open to every form, same filter as `inferAncestorFormSuffix`.

PokeAPI renamed `base_form` -> `required_pokemon_form` and `evolved_form` -> `evolved_pokemon_form` on `evolution_details`. `canonicalizeEvolutionChain` copies the new names onto the old ones at the repository seam (`getOrFetchEvolutionChain`, fresh fetch and cache read), so every reader keeps using `base_form`/`evolved_form`.

## Evolution layout

How the detail screen's evolution tree draws one chain in the width it has: compact (phone) cards or full-size ones, a node's final evolutions two to a row (paired branches, see `canPairBranches`), every compact label split onto two lines or none, and the stage widths and method/badge heights every card reserves so siblings and labels line up. Compact cards are forced on the phone band; elsewhere the tree falls back to them when the full-size chain doesn't fit one row.

Decided by `settleEvolutionLayout` (`src/utils/evolutionLayout.ts`, tested in `evolutionLayout.test.ts`, partly on readings captured live): `EvolutionTree.svelte` hands it a reader of the cards' part widths and heights and an apply that re-renders, and the loop reads, decides and applies until a reading changes nothing. Every reading depends on the layout shown, so the full-size width is read only while full-size cards show and kept while compact ones do: the choice never flips back and forth. A newer run (another chain, sprites arriving, a resize) stops an older one. The connector lines are drawn after it settles, by the component.

## Active Gen scoping

Generation-tagged row data (wild held items, capture locations) is stored for every supported generation and shown for the Active Gen only. One step does the scoping: `scopeToActiveGen(row, activeGen)` in `src/utils/activeGenScope.ts`, which turns a row into an **Active Gen row**.

Capture locations are then formatted by one module, `describeEncounters(row.encounterLocations)` in `src/utils/encounters.ts`, which returns everything the UI shows from the scoped list: `summary` (the Capture Field's text), `tooltip` (its hover title), `groups` (detail page lines) and `showRegion`. `showRegion` is the one rule for "a line needs its region header": more than one distinct region, not merely more than one line (a single-region Pokemon with a wild line and a trade line has two lines and one region). The helpers inside `encounters.ts` are exported only for their own regression tests (Mirage Tower, compass/bike slugs); callers use `describeEncounters`.

Base stats are scoped by overlay rather than filter: `resolveStatsForGen` (`src/utils/stats.ts`) patches a finite list of buffed species (`STAT_OVERRIDES`) back to their pre-buff values. `row.stats` on a `PokedexTableRow` is always the latest-game line; on an Active Gen row it is the Active Gen's.

Not the same as Generation fallback: that rule picks a different generation's tabs when the Active Gen has no data; Active Gen scoping just filters.

## Active Gen row

A row scoped to the Active Gen (`ActiveGenRow`, or `ActiveGen<T>` for a `PokedexEntry`): `stats` overlaid, and `heldItems` / `encounterLocations` in place of the `*AllGens` fields, holding the Active Gen's entries only. It has no `*AllGens` field, so a layout, Field, filter or sort that reads unscoped data fails typecheck. The browse screen scopes its rows once (`scopedRows` in `TableScreen.svelte`) and the table, Card view, Fields, Quirks, Traits, filter and sort all take Active Gen rows; the detail page scopes its entry once (`scopedEntry`). Memoized per source row, so the same row at the same Active Gen is the same object across streamed updates.


## Quirk and Trait

The two checkbox groups in FilterBar. Each option is one entry in `src/utils/quirksAndTraits.ts` (`QUIRKS`, `TRAITS`) carrying its key, label, icon and `matches(row)` predicate, so an option cannot exist without its predicate. `filterPokemon` only decides how a selection combines: **Quirks** are OR'd (a personal shortlist that can overlap on one Pokemon: "pickup OR holds an item"), **Traits** are AND'd (independent yes/no properties of the Pokemon: "Baby AND Fossil"). Each takes an Active Gen row, so `held-item` sees only the Active Gen's items. A selected key with no entry matches nothing. `quirksAndTraits.test.ts` fails if an entry has no fixture row that matches it.


## Entry load

What opening one Pokemon's detail screen loads, in order: the core (pokemon, species, sprite, a regional form's own text), then the move pool and the extras side by side (large images in the chosen render, the evolution chain with its variety ids), then the chain members' pokemon and sprites. Defined once, as `PokedexRepository.loadEntry`. It runs two ways, and only the images differ. `DetailLoadState.load` holds them as blob URLs and gets each stage through a callback. `cacheRange` (the settings "Cache" action) writes their bytes to the store and makes no URL. So a cached generation opens every detail screen with no network (ADR-0010 addendum). `cacheRange` also stores each species' Mega and Gigantamax forms after its Entry load (`storeVarietyForms`), so the Variety toggle works offline too; they are not part of the Entry load, since a detail open leaves them to the toggle's click. A Sprite style switch re-runs only the extras stage, `loadEntryExtras`, the same one `loadEntry` runs after the core. Ability and held-item descriptions load on hover and are not part of it.

## Image set

The up-to-four images a Pokemon (or a Mega/Gigantamax variety) can own: `sprite`, `artwork`, `shiny`, `shiny-artwork`. `IMAGE_SET` in `src/data/imageSet.ts` is the single table mapping each cache suffix to its `RawPokemon.sprites` field and its `ImageBundle` field; `ALL_IMAGE_SUFFIXES` is derived from it, so `clearRange`'s delete side cannot miss a suffix a fetch site writes. A `Record<ImageSuffix, …>`, so a new suffix without a row fails typecheck.

`PokedexRepository.fetchImages` fetches a chosen subset, each image caught independently to `null`. The core sprite (the Entry load's core, `entryCore`, and `getRowsForIds`) deliberately stays outside it: a failed core sprite must fail the whole id, the opposite policy. `ImageBundle` is the fetched shape; `PortraitImageSource` (`types.ts`) is the entry-side `*DataUri` shape and is intentionally separate.

## Card view

The browse screen showing each Pokemon as a card instead of a table row. Same rows, filters, sort, favourites and Active Gen scoping as the table; only the presentation differs. The table is the other layout of the same browse screen, not a separate screen.

## Card size

Card view's tile size: Small, Medium or Large (the S / M / L toggle at the right of the result count, Card view only), remembered per pane-width class like the layout. Each size sets the tile's minimum width (72, 96, 144px: four, three or two tiles at a 390px pane), the sprite's whole-number zoom (1×, 1×, 2×, so pixel art stays crisp; a sprite too big for its tile at that zoom is scaled down and smoothed), and how many stats the strip prints values under (4, 5, 6). The tile image is the sprite at every size (ADR-0021: artwork measured and declined). A size change keeps the tile at the top of the viewport in place (`settleTopTile`, `src/utils/cardView.ts`; a newer size change stops an older one's settling and keeps its tile while that one is pending, so a quick S→M→L ends on the tile it started from). `CARD_SIZE_SPECS` in `src/utils/cardView.ts`; `cardSizeByWidthClass` in settings.

## Card window

The tiles Card view actually draws: the ones in the viewport plus one viewport above and below, in whole grid rows. The rest of the list is the grid's padding, sized exactly from the two measured grid row heights (tall when a tile in the row has a form line) and the open tap panel, so the scroll offset always means the same place. Computed by `cardWindow` (`src/utils/cardView.ts`) and drawn by `CardGrid.svelte`, which hands the drawn tiles' heights to `cardRowHeights` for the two row heights; ADR-0016. The table has its own: the Table window.

## Table window

The rows the table actually draws: the ones in the viewport plus one viewport above and below (moved in steps of 16 rows), and each content-sized column's widest rows, drawn at their own places in the list so the auto table sizes every column as it would from all rows. Each run of undrawn rows is one spacer row of their exact height (every table row is one height). Computed by `tableWindow`, `widestRows` and `tableEntries` (`src/utils/tableWindow.ts`), with each column's widest rows picked by `tableWidestRows` (`src/utils/tableColumns.ts`), and drawn by `TableGrid.svelte`; the row height and the first and last rows' extras come from the drawn rows' rects through `tableRowMetrics` (tested on readings captured live). ADR-0019.

## Narrow pane

A Pokédex pane narrower than 600px, judged by the pane's own width, not the device (a phone, a split iPad pane, a thin desktop sidebar all count). Narrow and wide panes each remember their own choice of table or Card view; a narrow pane starts in Card view, a wide one in the table. Choosing a layout in one never changes the other, so picking cards on a phone leaves the desktop's table alone.

## Fields

The pieces of per-Pokemon data the user chooses to show on the browse screen (Total, EV yield, held items, catch rate, ...). Each layout keeps its own selection (ADR-0020): the table's says which columns it draws; Card view's says what the tile draws, and offers only the Tile Fields. Card view's tap panel shows every Field, with its exact value, whatever is chosen. "Columns" was the table-only name for the same thing and is retired as the user-facing term; the menu is "Fields", and it edits the shown layout's selection. In code, `FIELDS` (`src/utils/fields.ts`) is the one list every layout reads, and the settings are `visibleFields` (the table) and `cardFields` (Card view). The list is never sorted by a Field the layout does not show (`fieldsShown`): unchoosing the table's sorted Field, or switching to the table from a sort it lacks, resets the sort to No. ascending (`sortAfterFieldsChange`). Card view shows every Field, so it sorts by any of them.

## Tile Fields

The Fields a Card view tile has room for: the six stats (the stat strip), Total (the Σ corner) and EV yield (the EV corner). Card view's Fields menu offers these only. `TILE_FIELD_KEYS` in `src/utils/fields.ts`.

## Sort value

What a Card view tile shows in its top-left corner when the list is sorted by something the tile does not otherwise show: a stat's value with its colour dot (and the strip dims the other stats), or another Field's value with its menu icon. Height and weight drop their unit and keep one decimal. Sorted by No. or Name the corner is the dex number; by Total, the Σ corner shows instead, chosen or not. `tileSortValue` in `src/utils/cardView.ts`.

## Scroll-to-top button

The round arrow button floating at the bottom right of the browse screen (table or Card view) on Obsidian mobile only, once the list is scrolled more than one screen down. A tap scrolls back to the top: smoothly, or at once under Reduce motion. It sits above the phone's floating nav bar. Desktop has none (the scrollbar and Home key do it). In `PokedexApp.svelte`, which owns the scroller.

## Info popover

The small box that explains a name: an ability, held item, move, or a type icon's type name. Hovering with a mouse previews it; a tap or click pins it open. A pinned one closes on a second tap of the same name, a tap anywhere else (which still does its own job), a scroll, or Esc; tapping another name moves it there. Distinct from a native `title` tooltip (encounters, EV yield), which stays as it is.

## Art preview

The enlarged image of a Pokemon: the table sprite's preview and the detail portrait's. With a mouse it appears on hover. On touch, the portrait's appears on press-and-hold, and the table sprite has none (tapping the row opens the detail screen). Different from an Info popover, which explains a name rather than showing art.
