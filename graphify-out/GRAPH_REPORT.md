# Graph Report - obsidian-pokedex  (2026-07-21)

## Corpus Check
- 85 files · ~51,200 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 455 nodes · 925 edges · 27 communities (23 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0ca898c6`
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
- `PokedexPlugin` --references--> `DiskCache`  [EXTRACTED]
  src/main.ts → src/data/Cache.ts
- `FakePokeApiClient` --inherits--> `PokeApiClient`  [EXTRACTED]
  src/data/__fixtures__/fakes.ts → src/data/PokeApiClient.ts
- `TableLoadResult` --references--> `PokedexTableRow`  [EXTRACTED]
  src/data/PokedexRepository.ts → src/data/types.ts
- `PokedexPlugin` --references--> `PokedexRepository`  [EXTRACTED]
  src/main.ts → src/data/PokedexRepository.ts
- `toTableRow()` --calls--> `resolveGenerationId()`  [EXTRACTED]
  src/data/normalize.ts → src/data/constants.ts

## Import Cycles
- 1-file cycle: `src/view/components/EvolutionChain.svelte -> src/view/components/EvolutionChain.svelte`

## Communities (27 total, 4 thin omitted)

### Community 0 - "constants.ts"
Cohesion: 0.07
Nodes (35): FOSSIL_IDS, GENERATIONS, resolveGenerationId(), PokedexTableRow, StatBlock, DexNavEntry, getAdjacentDexEntries(), row() (+27 more)

### Community 1 - "DetailScreen.svelte"
Cohesion: 0.07
Nodes (39): ./AbilitiesPanel.svelte, ./BarRow.svelte, accentColor, adjacent, evolvesAtLevels, malePct, retry(), startLoad() (+31 more)

### Community 2 - "types.ts"
Cohesion: 0.07
Nodes (42): FLAVOR_TEXT_TABS_BY_GEN, FLAVOR_TEXT_VERSION_GROUPS, MOVE_DESCRIPTION_VERSION_GROUPS, MOVE_VERSION_GROUPS, MOVE_VERSION_TABS_BY_GEN, QuirkDef, QUIRKS, RARITIES (+34 more)

### Community 3 - "PokedexRepository"
Cohesion: 0.12
Nodes (12): collectChainIds(), trimFlavorTextEntries(), trimMovesToVersionGroups(), PokedexRepository, TableLoadResult, EvolutionChainVisual, MegaFormDetail, MoveDetail (+4 more)

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
Cohesion: 0.53
Nodes (4): pushHistory(), stepBack(), stepForward(), ViewHistoryStep

### Community 15 - "Pokedex"
Cohesion: 0.50
Nodes (3): Disclosures, Pokedex, Usage

### Community 26 - "generationFallback.test.ts"
Cohesion: 0.33
Nodes (5): LATEST_GEN, resolveTabsForGen(), FLAVOR_TABS_BY_GEN, LATEST_GEN, MOVE_TABS_BY_GEN

## Knowledge Gaps
- **110 isolated node(s):** `id`, `name`, `version`, `minAppVersion`, `description` (+105 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PokedexRepository` connect `PokedexRepository` to `constants.ts`, `PokeApiClient`, `DiskCache`, `main.ts`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `DiskCache` connect `DiskCache` to `PokeApiClient`, `PokedexRepository`, `main.ts`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `PokedexTableRow` connect `constants.ts` to `types.ts`, `PokedexRepository`, `DiskCache`, `tableColumns.ts`, `PokeApiClient`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `id`, `name`, `version` to the rest of the system?**
  _110 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `constants.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06936026936026936 - nodes in this community are weakly interconnected._
- **Should `DetailScreen.svelte` be split into smaller, more focused modules?**
  _Cohesion score 0.06568832983927324 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07346938775510205 - nodes in this community are weakly interconnected._