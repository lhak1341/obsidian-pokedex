# Graph Report - obsidian-pokedex  (2026-07-15)

## Corpus Check
- 79 files · ~40,506 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 415 nodes · 793 edges · 26 communities (22 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c4760d96`
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

## God Nodes (most connected - your core abstractions)
1. `PokedexRepository` - 34 edges
2. `DiskCache` - 23 edges
3. `PokedexTableRow` - 22 edges
4. `PokeApiClient` - 14 edges
5. `compilerOptions` - 14 edges
6. `PokedexPlugin` - 11 edges
7. `RawPokemon` - 10 edges
8. `filterPokemon()` - 10 edges
9. `PokedexView` - 10 edges
10. `Multi-Generation Expansion Plan` - 10 edges

## Surprising Connections (you probably didn't know these)
- `PokedexPlugin` --references--> `DiskCache`  [EXTRACTED]
  src/main.ts → src/data/Cache.ts
- `FakePokeApiClient` --inherits--> `PokeApiClient`  [EXTRACTED]
  src/data/__fixtures__/fakes.ts → src/data/PokeApiClient.ts
- `PokedexPlugin` --references--> `PokedexRepository`  [EXTRACTED]
  src/main.ts → src/data/PokedexRepository.ts
- `PokedexFilters` --references--> `StatBlock`  [EXTRACTED]
  src/utils/filterPokemon.ts → src/data/types.ts
- `ColumnDef` --references--> `PokedexTableRow`  [EXTRACTED]
  src/utils/tableColumns.ts → src/data/types.ts

## Import Cycles
- 1-file cycle: `src/view/components/EvolutionChain.svelte -> src/view/components/EvolutionChain.svelte`

## Communities (26 total, 4 thin omitted)

### Community 0 - "constants.ts"
Cohesion: 0.06
Nodes (39): FLAVOR_TEXT_TABS_BY_GEN, FLAVOR_TEXT_VERSION_GROUPS, FOSSIL_IDS, GENERATIONS, MOVE_VERSION_GROUPS, MOVE_VERSION_TABS_BY_GEN, QuirkDef, QUIRKS (+31 more)

### Community 1 - "DetailScreen.svelte"
Cohesion: 0.07
Nodes (37): ./AbilitiesPanel.svelte, ./BarRow.svelte, accentColor, evolvesAtLevels, femalePct, malePct, portraitUri, retry() (+29 more)

### Community 2 - "types.ts"
Cohesion: 0.11
Nodes (36): MOVE_DESCRIPTION_VERSION_GROUPS, describeEvolutionRequirement(), extractFlavorTexts(), findEvolutionNode(), idFromUrl(), nextEvolutionLevels(), normalizeEvolutionChain(), normalizeEvYield() (+28 more)

### Community 3 - "PokedexRepository"
Cohesion: 0.12
Nodes (9): collectChainIds(), PokedexRepository, TableLoadResult, MoveDetail, PokedexEntry, PokedexTableRow, mapWithConcurrency(), DetailLoadState (+1 more)

### Community 4 - "devDependencies"
Cohesion: 0.05
Nodes (38): builtin-modules, esbuild, esbuild-svelte, eslint, eslint-plugin-obsidianmd, description, devDependencies, builtin-modules (+30 more)

### Community 5 - "DiskCache"
Cohesion: 0.12
Nodes (11): arrayBufferToBase64(), DiskCache, extOf(), MIME_BY_EXT, makeCache(), createFakeDataAdapter(), FakePokeApiClient, makeRepository() (+3 more)

### Community 6 - "main.ts"
Cohesion: 0.10
Nodes (10): DEFAULT_ENABLED_GENERATIONS, DEFAULT_VISIBLE_COLUMNS, PluginSettings, PokedexPlugin, DEFAULT_SETTINGS, PokedexSettingTab, formatBytes(), GenerationToggleResult (+2 more)

### Community 7 - "tableColumns.ts"
Cohesion: 0.14
Nodes (13): STAT_COLUMNS, STAT_OVERRIDES, SortColumn, SortDirection, sortPokemon(), rows, valueOf(), resolveStatsForGen() (+5 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (20): DOM, DOM.Iterable, ES2020, ES2021.String, src/**/*.ts, compilerOptions, allowJs, importHelpers (+12 more)

### Community 9 - "Multi-Generation Expansion Plan"
Cohesion: 0.12
Nodes (16): Current state (baseline), Design principle: generation is a first-class axis, not bolted on later, Explicitly deferred — needs its own go/no-go, not a default yes, Goal, Log, Multi-Generation Expansion Plan, Open questions — none blocking Phase 1 start, Phase 1 — Gen 4 (Sinnoh, #387-493), no forms/Mega/Gigantamax (+8 more)

### Community 10 - "PokeApiClient"
Cohesion: 0.19
Nodes (6): PokeApiClient, RawPokemonListResponse, isRetryableHttpError(), RetryOptions, sleep(), withRetry()

### Community 11 - "manifest.json"
Cohesion: 0.25
Nodes (7): author, description, id, isDesktopOnly, minAppVersion, name, version

### Community 12 - "Domain glossary"
Cohesion: 0.33
Nodes (5): Domain glossary, Evolution requirement, Generation fallback, Quick jump, View history

### Community 13 - "viewHistory.ts"
Cohesion: 0.53
Nodes (4): pushHistory(), stepBack(), stepForward(), ViewHistoryStep

### Community 15 - "Pokedex"
Cohesion: 0.50
Nodes (3): Disclosures, Pokedex, Usage

## Knowledge Gaps
- **109 isolated node(s):** `id`, `name`, `version`, `minAppVersion`, `description` (+104 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PokedexRepository` connect `PokedexRepository` to `types.ts`, `PokeApiClient`, `DiskCache`, `main.ts`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `DiskCache` connect `DiskCache` to `types.ts`, `PokeApiClient`, `main.ts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `PokedexTableRow` connect `PokedexRepository` to `constants.ts`, `types.ts`, `tableColumns.ts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `id`, `name`, `version` to the rest of the system?**
  _109 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `constants.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0636734693877551 - nodes in this community are weakly interconnected._
- **Should `DetailScreen.svelte` be split into smaller, more focused modules?**
  _Cohesion score 0.07180851063829788 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10505050505050505 - nodes in this community are weakly interconnected._