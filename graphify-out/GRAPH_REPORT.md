# Graph Report - obsidian-pokedex  (2026-07-29)

## Corpus Check
- 108 files · ~73,600 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 556 nodes · 1151 edges · 40 communities (32 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7cbd7761`
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
- tableColumns.ts
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
- PokeApiClient.ts
- constants.ts
- types.ts
- 0001-two-generation-membership-checks.md
- 0002-mega-form-cache-not-on-getOrFetch.md
- 0003-pokedexview-stays-untested.md
- resolveGenerationId
- PokedexTableRow
- quickJump.ts
- GENERATIONS
- moveRows.ts
- imageBounds.ts

## God Nodes (most connected - your core abstractions)
1. `PokedexRepository` - 47 edges
2. `PokedexTableRow` - 30 edges
3. `DiskCache` - 25 edges
4. `RawPokemon` - 18 edges
5. `PokeApiClient` - 15 edges
6. `compilerOptions` - 14 edges
7. `toTableRow()` - 13 edges
8. `resolveGenerationId()` - 12 edges
9. `createFakeDataAdapter()` - 11 edges
10. `PokedexPlugin` - 11 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `evolutionFamilyDepth()`  [EXTRACTED]
  scripts/generate-evolution-stages.ts → src/data/normalize.ts
- `row()` --calls--> `resolveGenerationId()`  [EXTRACTED]
  src/utils/filterPokemon.test.ts → src/data/constants.ts
- `GenerationScope` --references--> `PokedexTableRow`  [EXTRACTED]
  src/utils/generationScope.ts → src/data/types.ts
- `PokedexPlugin` --references--> `DiskCache`  [EXTRACTED]
  src/main.ts → src/data/Cache.ts
- `FakePokeApiClient` --inherits--> `PokeApiClient`  [EXTRACTED]
  src/data/__fixtures__/fakes.ts → src/data/PokeApiClient.ts

## Import Cycles
- 1-file cycle: `src/view/components/EvolutionChain.svelte -> src/view/components/EvolutionChain.svelte`

## Communities (40 total, 8 thin omitted)

### Community 0 - "constants.ts"
Cohesion: 0.18
Nodes (17): FOSSIL_IDS, EMPTY_FILTERS, filterPokemon(), matchesAbilities(), matchesEvStats(), matchesQuirk(), matchesQuirks(), matchesRarities() (+9 more)

### Community 1 - "DetailScreen.svelte"
Cohesion: 0.06
Nodes (42): ./AbilitiesPanel.svelte, popover, ./BarRow.svelte, active, retry(), startLoad(), ./EvolutionChain.svelte, ./FilterBar.svelte (+34 more)

### Community 2 - "types.ts"
Cohesion: 0.09
Nodes (39): collectMemberIds(), idFromUrl(), main(), mapWithConcurrency(), EVOLUTION_STAGES, MEGA_VARIETY_KEYS, MOVE_DESCRIPTION_VERSION_GROUPS, buildEvolutionNode() (+31 more)

### Community 3 - "PokedexRepository"
Cohesion: 0.10
Nodes (17): ADR-0002, ADR-0006, ALL_IMAGE_SUFFIXES, imagePath(), ImageSuffix, pokemonPath(), speciesPath(), Generation (+9 more)

### Community 4 - "devDependencies"
Cohesion: 0.05
Nodes (40): builtin-modules, esbuild, esbuild-svelte, eslint, eslint-plugin-obsidianmd, description, devDependencies, builtin-modules (+32 more)

### Community 6 - "main.ts"
Cohesion: 0.08
Nodes (12): DEFAULT_ENABLED_GENERATIONS, DEFAULT_VISIBLE_COLUMNS, PluginSettings, PokedexPlugin, DEFAULT_SETTINGS, PokedexSettingTab, formatBytes(), GenerationToggleResult (+4 more)

### Community 7 - "tableColumns.ts"
Cohesion: 0.15
Nodes (14): STAT_COLUMNS, STAT_OVERRIDES, StatBlock, PokedexFilters, SortColumn, SortDirection, sortPokemon(), valueOf() (+6 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (20): DOM, DOM.Iterable, ES2020, ES2021.String, src/**/*.ts, compilerOptions, allowJs, importHelpers (+12 more)

### Community 9 - "Multi-Generation Expansion Plan"
Cohesion: 0.12
Nodes (16): Current state (baseline), Design principle: generation is a first-class axis, not bolted on later, Explicitly deferred — needs its own go/no-go, not a default yes, Goal, Log, Multi-Generation Expansion Plan, Open questions — none blocking Phase 1 start, Phase 1 — Gen 4 (Sinnoh, #387-493), no forms/Mega/Gigantamax (+8 more)

### Community 10 - "PokeApiClient"
Cohesion: 0.10
Nodes (15): arrayBufferToBase64(), DiskCache, extOf(), MIME_BY_EXT, makeCache(), createFakeDataAdapter(), FakePokeApiClient, makeRepository() (+7 more)

### Community 11 - "manifest.json"
Cohesion: 0.25
Nodes (7): author, description, id, isDesktopOnly, minAppVersion, name, version

### Community 12 - "Domain glossary"
Cohesion: 0.29
Nodes (6): Domain glossary, Evolution requirement, Generation fallback, Quick jump, Variety toggle, View history

### Community 13 - "viewHistory.ts"
Cohesion: 0.26
Nodes (6): pushHistory(), stepBack(), stepForward(), ViewHistoryStep, DetailNavigationState, ScrollInstruction

### Community 14 - "VarietyToggleState"
Cohesion: 0.16
Nodes (10): toGigantamaxFormDetail(), GigantamaxFormDetail, MegaFormDetail, PortraitImageSource, basePortrait(), resolvePortrait(), shinyPortrait(), full (+2 more)

### Community 15 - "Pokedex"
Cohesion: 0.20
Nodes (8): Gotchas, Development, Disclosures, Features, Installation, License, Pokedex, Usage

### Community 17 - "hoverPopover.svelte.ts"
Cohesion: 0.53
Nodes (3): relativeRect, createHoverDescription(), createHoverPopover()

### Community 28 - "PokeApiClient.ts"
Cohesion: 0.17
Nodes (9): HttpError, PokeApiClient, RawAbility, RawItem, RawPokemonListResponse, isRetryableHttpError(), RetryOptions, sleep() (+1 more)

### Community 29 - "constants.ts"
Cohesion: 0.13
Nodes (14): FLAVOR_TEXT_TABS_BY_GEN, FLAVOR_TEXT_VERSION_GROUPS, MOVE_VERSION_GROUPS, MOVE_VERSION_TABS_BY_GEN, QuirkDef, QUIRKS, RARITIES, REGIONAL_FORMS (+6 more)

### Community 30 - "types.ts"
Cohesion: 0.19
Nodes (9): EvolutionChainVisual, EvYieldEntry, GigantamaxFormSummary, MegaFormSummary, NamedApiResource, PokemonRarity, matchesGenerations(), GenerationScope (+1 more)

### Community 34 - "resolveGenerationId"
Cohesion: 0.25
Nodes (8): resolveGenerationId(), DexNavEntry, getAdjacentDexEntries(), row(), toNavEntry(), row(), row(), rows

### Community 35 - "PokedexTableRow"
Cohesion: 0.36
Nodes (4): TableLoadResult, PokedexTableRow, isIdInGenerations(), PokedexLoadState

### Community 36 - "quickJump.ts"
Cohesion: 0.36
Nodes (6): quickJumpMatches(), QuickJumpNavResult, stepQuickJumpNav(), onKeydown(), registerGlobalHotkey(), createQuickJumpDropdown()

### Community 37 - "GENERATIONS"
Cohesion: 0.33
Nodes (5): GENERATIONS, resolveTabsForGen(), FLAVOR_TABS_BY_GEN, LATEST_GEN, MOVE_TABS_BY_GEN

### Community 38 - "moveRows.ts"
Cohesion: 0.53
Nodes (4): MoveEntry, buildMoveRows(), MoveRow, move()

### Community 39 - "imageBounds.ts"
Cohesion: 0.67
Nodes (3): cache, contentScale(), decode()

## Knowledge Gaps
- **130 isolated node(s):** `id`, `name`, `version`, `minAppVersion`, `description` (+125 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PokedexRepository` connect `PokedexRepository` to `PokeApiClient`, `PokedexTableRow`, `VarietyToggleState`, `main.ts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `DiskCache` connect `PokeApiClient` to `PokedexTableRow`, `PokedexRepository`, `main.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `PokedexTableRow` connect `PokedexTableRow` to `constants.ts`, `types.ts`, `PokedexRepository`, `resolveGenerationId`, `quickJump.ts`, `tableColumns.ts`, `types.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `id`, `name`, `version` to the rest of the system?**
  _130 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DetailScreen.svelte` be split into smaller, more focused modules?**
  _Cohesion score 0.06233766233766234 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08953900709219859 - nodes in this community are weakly interconnected._
- **Should `PokedexRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.09800362976406533 - nodes in this community are weakly interconnected._