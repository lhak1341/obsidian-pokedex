# Graph Report - obsidian-pokedex  (2026-10-11)

## Corpus Check
- 150 files · ~95,733 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 746 nodes · 1565 edges · 53 communities (39 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `658c3a7e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- constants.ts
- DetailScreen.svelte
- types.ts
- PokedexRepository
- devDependencies
- DiskCache
- main.ts
- PokeApiClient.ts
- compilerOptions
- Multi-Generation Expansion Plan
- PokeApiClient
- manifest.json
- Domain glossary
- viewHistory.ts
- VarietyToggleState
- Pokedex
- loadNotices.ts
- hoverPopover.svelte.ts
- CLAUDE.md
- 0004-repository-cache-fields-not-a-slot-registry.md
- 0005-evolution-node-branch-selection-not-extracted.md
- PokedexView
- sortPokemon.ts
- moveRows.ts
- 0001-two-generation-membership-checks.md
- 0002-mega-form-cache-not-on-getOrFetch.md
- 0003-pokedexview-stays-untested.md
- tableColumns.ts
- quirksAndTraits.ts
- PokedexTableRow
- GENERATIONS
- GENERATIONS
- imageBounds.ts
- abilityOptions.ts
- src/view
- deploy.mjs
- lint-ratchet.mjs
- generationScope.ts
- pokedollar.ts
- generationScope.ts
- 0007-local-preference-callbacks-stay-plumbed.md
- 0008-font-picker-stays-the-shared-recipe-shape.md
- 0009-detail-screen-derivations-stay-in-the-component.md
- raw-imports.d.ts
- pokemonDisplay.ts
- 0010-per-species-cache-footprint-stays-two-questions.md

## God Nodes (most connected - your core abstractions)
1. `PokedexRepository` - 52 edges
2. `PokedexTableRow` - 36 edges
3. `DiskCache` - 27 edges
4. `RawPokemon` - 21 edges
5. `PokeApiClient` - 14 edges
6. `toTableRow()` - 14 edges
7. `filterPokemon()` - 14 edges
8. `compilerOptions` - 14 edges
9. `scripts` - 13 edges
10. `makeRow()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `fetchJson()` --calls--> `withRetry()`  [EXTRACTED]
  scripts/generate-evolution-stages.ts → src/utils/retry.ts
- `main()` --calls--> `evolutionReachByForm()`  [EXTRACTED]
  scripts/generate-evolution-stages.ts → src/data/normalize.ts
- `fetchJson()` --calls--> `withRetry()`  [EXTRACTED]
  scripts/generate-encounters.ts → src/utils/retry.ts
- `buildAreaRegionMap()` --calls--> `mapWithConcurrency()`  [EXTRACTED]
  scripts/generate-encounters.ts → src/utils/concurrency.ts
- `main()` --calls--> `mapWithConcurrency()`  [EXTRACTED]
  scripts/generate-encounters.ts → src/utils/concurrency.ts

## Import Cycles
- 1-file cycle: `src/view/components/EvolutionChain.svelte -> src/view/components/EvolutionChain.svelte`

## Communities (53 total, 14 thin omitted)

### Community 0 - "constants.ts"
Cohesion: 0.20
Nodes (16): EMPTY_FILTERS, FilterContext, filterPokemon(), matchesAbilities(), matchesEvStats(), matchesFavorite(), matchesFlag(), matchesQuirks() (+8 more)

### Community 1 - "DetailScreen.svelte"
Cohesion: 0.05
Nodes (49): ./AbilitiesPanel.svelte, popover, ./BarRow.svelte, onKeydown(), retry(), startLoad(), ./EvolutionChain.svelte, ./FilterBar.svelte (+41 more)

### Community 2 - "types.ts"
Cohesion: 0.07
Nodes (55): DEFAULT_ENABLED_GENERATIONS, DEFAULT_VISIBLE_COLUMNS, ENCOUNTER_LOCATIONS, EVOLUTION_STAGE_OVERRIDES, EVOLUTION_STAGES, FLAVOR_TEXT_TABS_BY_GEN, FLAVOR_TEXT_VERSION_GROUPS, FOSSIL_IDS (+47 more)

### Community 3 - "PokedexRepository"
Cohesion: 0.07
Nodes (31): ADR-0002, gigantamaxFormPath(), imagePath(), ImageSuffix, megaFormPath(), pokemonPath(), speciesPath(), Generation (+23 more)

### Community 4 - "devDependencies"
Cohesion: 0.05
Nodes (43): builtin-modules, esbuild, esbuild-svelte, eslint, eslint-plugin-obsidianmd, description, devDependencies, builtin-modules (+35 more)

### Community 6 - "main.ts"
Cohesion: 0.06
Nodes (25): ADR-0007, FontChoice, PluginSettings, PokedexPlugin, DEFAULT_SETTINGS, FONT_OPTIONS, PokedexSettingTab, FONT_CHOICES (+17 more)

### Community 7 - "PokeApiClient.ts"
Cohesion: 0.08
Nodes (27): acquisitionFromEncounterDetails(), buildAreaRegionMap(), fetchJson(), main(), RawEncounter, RawLocation, RawPokemonMinimal, collectMembers() (+19 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (20): DOM, DOM.Iterable, ES2020, ES2021.String, src/**/*.ts, compilerOptions, allowJs, importHelpers (+12 more)

### Community 9 - "Multi-Generation Expansion Plan"
Cohesion: 0.12
Nodes (16): Current state (baseline), Design principle: generation is a first-class axis, not bolted on later, Explicitly deferred — needs its own go/no-go, not a default yes, Goal, Log, Multi-Generation Expansion Plan, Open questions — none blocking Phase 1 start, Phase 1 — Gen 4 (Sinnoh, #387-493), no forms/Mega/Gigantamax (+8 more)

### Community 10 - "PokeApiClient"
Cohesion: 0.09
Nodes (18): arrayBufferToBase64(), DiskCache, extOf(), MIME_BY_EXT, makeCache(), ADR-0006, createFakeDataAdapter(), FakePokeApiClient (+10 more)

### Community 11 - "manifest.json"
Cohesion: 0.25
Nodes (7): author, description, id, isDesktopOnly, minAppVersion, name, version

### Community 12 - "Domain glossary"
Cohesion: 0.18
Nodes (10): Active Gen scoping, Domain glossary, Evolution requirement, Evolution stage, Generation fallback, Image set, Quick jump, Quirk and Trait (+2 more)

### Community 13 - "viewHistory.ts"
Cohesion: 0.26
Nodes (6): pushHistory(), stepBack(), stepForward(), ViewHistoryStep, DetailNavigationState, ScrollInstruction

### Community 14 - "VarietyToggleState"
Cohesion: 0.43
Nodes (6): PortraitImageSource, basePortrait(), resolvePortrait(), resolvePortraitScale(), shinyPortrait(), full

### Community 15 - "Pokedex"
Cohesion: 0.18
Nodes (9): obsidian-pokedex, Repo-specific toolchain, Development, Disclosures, Features, Installation, License, Pokedex (+1 more)

### Community 17 - "hoverPopover.svelte.ts"
Cohesion: 0.19
Nodes (8): describeHoverStatus(), HoverDescriptionStatus, formatPokedollarSigns(), sideAnchoredPreviewPosition(), computeSideAnchoredPreviewPosition(), relativeRect, createHoverDescription(), createHoverPopover()

### Community 28 - "PokedexView"
Cohesion: 0.23
Nodes (9): resolveGenerationId(), makeRegionalFormRow(), makeRow(), DexNavEntry, getAdjacentDexEntries(), toNavEntry(), row(), row() (+1 more)

### Community 29 - "sortPokemon.ts"
Cohesion: 0.18
Nodes (17): STAT_COLUMNS, StatBlock, PokedexFilters, SortColumn, SortDirection, sortPokemon(), valueOf(), resolveStatsForGen() (+9 more)

### Community 30 - "moveRows.ts"
Cohesion: 0.24
Nodes (9): EvYieldEntry, GigantamaxFormSummary, MegaFormSummary, MoveEntry, NamedApiResource, PokemonRarity, buildMoveRows(), MoveRow (+1 more)

### Community 34 - "tableColumns.ts"
Cohesion: 0.33
Nodes (4): failures, manifest, tag, versions

### Community 35 - "quirksAndTraits.ts"
Cohesion: 0.22
Nodes (8): filterHeldItemsForGen(), FlagContext, FlagDef, QUIRKS, ALL, FIXTURES, GEN_3_ITEM, TRAITS

### Community 36 - "PokedexTableRow"
Cohesion: 0.23
Nodes (6): PokedexTableRow, GenerationScope, LoadOutcome, LoadSnapshot, PokedexLoadState, RetryOutcome

### Community 37 - "GENERATIONS"
Cohesion: 0.33
Nodes (5): Cache, Data layer, Debugging normalize.ts, PokeAPI, src/data (and the utils/view code that touches its cache)

### Community 38 - "GENERATIONS"
Cohesion: 0.33
Nodes (5): ResolvedTabs, resolveTabsForGen(), FLAVOR_TABS_BY_GEN, LATEST_GEN, MOVE_TABS_BY_GEN

### Community 39 - "imageBounds.ts"
Cohesion: 0.67
Nodes (3): cache, contentScale(), decode()

### Community 41 - "src/view"
Cohesion: 0.33
Nodes (5): Domain rules, Live-verify recipes, PokeAPI-driven rendering, src/view, Table layout

### Community 42 - "deploy.mjs"
Cohesion: 0.40
Nodes (3): OPTIONAL, REQUIRED, targets

### Community 43 - "lint-ratchet.mjs"
Cohesion: 0.40
Nodes (4): report, run, start, warningLines

### Community 44 - "generationScope.ts"
Cohesion: 0.16
Nodes (22): ACQUISITION_LABEL_ORDER, ActiveEncounterLocation, allNumeric(), capitalizeLocationWord(), describeEncounters(), EncounterLocationGroup, EncounterView, expandFusedCompassBikeWord() (+14 more)

### Community 45 - "pokedollar.ts"
Cohesion: 0.39
Nodes (6): matchesSearch(), quickJumpMatches(), QuickJumpNavResult, stepQuickJumpNav(), registerGlobalHotkey(), createQuickJumpDropdown()

### Community 46 - "generationScope.ts"
Cohesion: 0.39
Nodes (6): GENERATIONS, isIdInGenerations(), matchesGenerations(), resolveGenerationScope(), ADR-0001, ADR-0001

### Community 51 - "pokemonDisplay.ts"
Cohesion: 0.60
Nodes (4): formatDexNumber(), formatHeight(), formatPokemonDisplayName(), formatWeight()

## Knowledge Gaps
- **185 isolated node(s):** `id`, `name`, `version`, `minAppVersion`, `description` (+180 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PokedexRepository` connect `PokedexRepository` to `PokeApiClient`, `PokedexTableRow`, `main.ts`, `PokeApiClient.ts`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `PokedexTableRow` connect `PokedexTableRow` to `constants.ts`, `types.ts`, `PokedexRepository`, `quirksAndTraits.ts`, `PokeApiClient`, `generationScope.ts`, `pokedollar.ts`, `generationScope.ts`, `PokedexView`, `sortPokemon.ts`, `moveRows.ts`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `PokedexSettingTab` connect `main.ts` to `hoverPopover.svelte.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `id`, `name`, `version` to the rest of the system?**
  _185 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DetailScreen.svelte` be split into smaller, more focused modules?**
  _Cohesion score 0.053555750658472345 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06597222222222222 - nodes in this community are weakly interconnected._
- **Should `PokedexRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.06851851851851852 - nodes in this community are weakly interconnected._