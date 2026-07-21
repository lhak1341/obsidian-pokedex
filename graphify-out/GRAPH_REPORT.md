# Graph Report - obsidian-pokedex  (2026-07-22)

## Corpus Check
- 88 files · ~52,162 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 466 nodes · 942 edges · 34 communities (28 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `faafefeb`
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
- mirrorState.test.ts
- Pokedex
- loadNotices.ts
- hoverPopover.svelte.ts
- CLAUDE.md
- generationFallback.test.ts
- PokedexTableRow
- resolveGenerationId
- generationScope.ts
- dexNav.test.ts
- 0001-two-generation-membership-checks.md
- 0002-mega-form-cache-not-on-getOrFetch.md
- 0003-pokedexview-stays-untested.md

## God Nodes (most connected - your core abstractions)
1. `PokedexRepository` - 41 edges
2. `PokedexTableRow` - 29 edges
3. `DiskCache` - 23 edges
4. `RawPokemon` - 16 edges
5. `PokeApiClient` - 15 edges
6. `compilerOptions` - 14 edges
7. `resolveGenerationId()` - 12 edges
8. `toTableRow()` - 11 edges
9. `PokedexPlugin` - 11 edges
10. `filterPokemon()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `row()` --calls--> `resolveGenerationId()`  [EXTRACTED]
  src/utils/filterPokemon.test.ts → src/data/constants.ts
- `GenerationScope` --references--> `PokedexTableRow`  [EXTRACTED]
  src/utils/generationScope.ts → src/data/types.ts
- `PokedexPlugin` --references--> `DiskCache`  [EXTRACTED]
  src/main.ts → src/data/Cache.ts
- `FakePokeApiClient` --inherits--> `PokeApiClient`  [EXTRACTED]
  src/data/__fixtures__/fakes.ts → src/data/PokeApiClient.ts
- `PokedexPlugin` --references--> `PokedexRepository`  [EXTRACTED]
  src/main.ts → src/data/PokedexRepository.ts

## Import Cycles
- 1-file cycle: `src/view/components/EvolutionChain.svelte -> src/view/components/EvolutionChain.svelte`

## Communities (34 total, 6 thin omitted)

### Community 0 - "constants.ts"
Cohesion: 0.18
Nodes (16): FOSSIL_IDS, StatBlock, EMPTY_FILTERS, filterPokemon(), matchesAbilities(), matchesEvStats(), matchesQuirk(), matchesQuirks() (+8 more)

### Community 1 - "DetailScreen.svelte"
Cohesion: 0.07
Nodes (38): ./AbilitiesPanel.svelte, ./BarRow.svelte, accentColor, adjacent, evolvesAtLevels, malePct, retry(), startLoad() (+30 more)

### Community 2 - "types.ts"
Cohesion: 0.11
Nodes (32): ADR-0002, MOVE_DESCRIPTION_VERSION_GROUPS, buildEvolutionNode(), deriveMegaForms(), deriveRegionalForms(), describeEvolutionRequirement(), extractFlavorTexts(), extractFormSuffix() (+24 more)

### Community 3 - "PokedexRepository"
Cohesion: 0.12
Nodes (10): collectChainIds(), normalizeMoveDetail(), trimMovesToVersionGroups(), PokedexRepository, MoveDetail, PokedexEntry, RawPokemon, mapWithConcurrency() (+2 more)

### Community 4 - "devDependencies"
Cohesion: 0.05
Nodes (38): builtin-modules, esbuild, esbuild-svelte, eslint, eslint-plugin-obsidianmd, description, devDependencies, builtin-modules (+30 more)

### Community 5 - "DiskCache"
Cohesion: 0.11
Nodes (11): arrayBufferToBase64(), DiskCache, extOf(), MIME_BY_EXT, makeCache(), createFakeDataAdapter(), FakePokeApiClient, makeRepository() (+3 more)

### Community 6 - "main.ts"
Cohesion: 0.10
Nodes (10): DEFAULT_ENABLED_GENERATIONS, DEFAULT_VISIBLE_COLUMNS, PluginSettings, PokedexPlugin, DEFAULT_SETTINGS, PokedexSettingTab, formatBytes(), GenerationToggleResult (+2 more)

### Community 7 - "tableColumns.ts"
Cohesion: 0.17
Nodes (12): STAT_COLUMNS, STAT_OVERRIDES, SortColumn, SortDirection, sortPokemon(), valueOf(), resolveStatsForGen(), totalStat() (+4 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (20): DOM, DOM.Iterable, ES2020, ES2021.String, src/**/*.ts, compilerOptions, allowJs, importHelpers (+12 more)

### Community 9 - "Multi-Generation Expansion Plan"
Cohesion: 0.12
Nodes (16): Current state (baseline), Design principle: generation is a first-class axis, not bolted on later, Explicitly deferred — needs its own go/no-go, not a default yes, Goal, Log, Multi-Generation Expansion Plan, Open questions — none blocking Phase 1 start, Phase 1 — Gen 4 (Sinnoh, #387-493), no forms/Mega/Gigantamax (+8 more)

### Community 10 - "PokeApiClient"
Cohesion: 0.12
Nodes (18): HttpError, PokeApiClient, MoveEntry, NamedApiResource, PokemonRarity, RawAbility, RawEvolutionChain, RawItem (+10 more)

### Community 11 - "manifest.json"
Cohesion: 0.25
Nodes (7): author, description, id, isDesktopOnly, minAppVersion, name, version

### Community 12 - "Domain glossary"
Cohesion: 0.33
Nodes (5): Domain glossary, Evolution requirement, Generation fallback, Quick jump, View history

### Community 13 - "viewHistory.ts"
Cohesion: 0.26
Nodes (6): pushHistory(), stepBack(), stepForward(), ViewHistoryStep, DetailNavigationState, ScrollInstruction

### Community 14 - "mirrorState.test.ts"
Cohesion: 0.14
Nodes (13): FLAVOR_TEXT_TABS_BY_GEN, FLAVOR_TEXT_VERSION_GROUPS, MOVE_VERSION_GROUPS, MOVE_VERSION_TABS_BY_GEN, QuirkDef, QUIRKS, RARITIES, REGIONAL_FORMS (+5 more)

### Community 15 - "Pokedex"
Cohesion: 0.50
Nodes (3): Disclosures, Pokedex, Usage

### Community 26 - "generationFallback.test.ts"
Cohesion: 0.32
Nodes (6): GENERATIONS, LATEST_GEN, resolveTabsForGen(), FLAVOR_TABS_BY_GEN, LATEST_GEN, MOVE_TABS_BY_GEN

### Community 27 - "PokedexTableRow"
Cohesion: 0.29
Nodes (4): TableLoadResult, PokedexTableRow, isIdInGenerations(), PokedexLoadState

### Community 28 - "resolveGenerationId"
Cohesion: 0.24
Nodes (9): resolveGenerationId(), row(), matchesSearch(), quickJumpMatches(), QuickJumpNavResult, stepQuickJumpNav(), row(), row() (+1 more)

### Community 29 - "generationScope.ts"
Cohesion: 0.47
Nodes (3): matchesGenerations(), GenerationScope, resolveGenerationScope()

### Community 30 - "dexNav.test.ts"
Cohesion: 0.60
Nodes (3): DexNavEntry, getAdjacentDexEntries(), toNavEntry()

## Knowledge Gaps
- **115 isolated node(s):** `id`, `name`, `version`, `minAppVersion`, `description` (+110 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PokedexRepository` connect `PokedexRepository` to `types.ts`, `PokedexTableRow`, `DiskCache`, `main.ts`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `DiskCache` connect `DiskCache` to `types.ts`, `PokedexRepository`, `main.ts`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `PokedexTableRow` connect `PokedexTableRow` to `constants.ts`, `types.ts`, `PokedexRepository`, `DiskCache`, `tableColumns.ts`, `PokeApiClient`, `resolveGenerationId`, `generationScope.ts`, `dexNav.test.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `id`, `name`, `version` to the rest of the system?**
  _115 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DetailScreen.svelte` be split into smaller, more focused modules?**
  _Cohesion score 0.06748911465892599 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1076923076923077 - nodes in this community are weakly interconnected._
- **Should `PokedexRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.1184939091915836 - nodes in this community are weakly interconnected._