# Graph Report - obsidian-pokedex  (2026-07-24)

## Corpus Check
- 102 files · ~70,250 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 523 nodes · 1091 edges · 31 communities (23 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dec3b7ec`
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
- 0001-two-generation-membership-checks.md
- 0002-mega-form-cache-not-on-getOrFetch.md
- 0003-pokedexview-stays-untested.md

## God Nodes (most connected - your core abstractions)
1. `PokedexRepository` - 45 edges
2. `PokedexTableRow` - 30 edges
3. `DiskCache` - 25 edges
4. `RawPokemon` - 17 edges
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
- `PokedexPlugin` --references--> `DiskCache`  [EXTRACTED]
  src/main.ts → src/data/Cache.ts
- `FakePokeApiClient` --inherits--> `PokeApiClient`  [EXTRACTED]
  src/data/__fixtures__/fakes.ts → src/data/PokeApiClient.ts
- `PokedexPlugin` --references--> `PokedexRepository`  [EXTRACTED]
  src/main.ts → src/data/PokedexRepository.ts

## Import Cycles
- 1-file cycle: `src/view/components/EvolutionChain.svelte -> src/view/components/EvolutionChain.svelte`

## Communities (31 total, 8 thin omitted)

### Community 0 - "constants.ts"
Cohesion: 0.09
Nodes (30): FOSSIL_IDS, TableLoadResult, PokedexTableRow, EMPTY_FILTERS, filterPokemon(), isIdInGenerations(), matchesAbilities(), matchesEvStats() (+22 more)

### Community 1 - "DetailScreen.svelte"
Cohesion: 0.07
Nodes (38): ./AbilitiesPanel.svelte, ./BarRow.svelte, retry(), startLoad(), ./EvolutionChain.svelte, ./FilterBar.svelte, activeFlavorIndex, currentFlavorTab (+30 more)

### Community 2 - "types.ts"
Cohesion: 0.09
Nodes (38): collectMemberIds(), idFromUrl(), main(), mapWithConcurrency(), EVOLUTION_STAGES, MEGA_VARIETY_KEYS, MOVE_DESCRIPTION_VERSION_GROUPS, buildEvolutionNode() (+30 more)

### Community 3 - "PokedexRepository"
Cohesion: 0.10
Nodes (16): ADR-0002, ALL_IMAGE_SUFFIXES, imagePath(), ImageSuffix, pokemonPath(), speciesPath(), trimFlavorTextEntries(), trimMovesToVersionGroups() (+8 more)

### Community 4 - "devDependencies"
Cohesion: 0.05
Nodes (39): builtin-modules, esbuild, esbuild-svelte, eslint, eslint-plugin-obsidianmd, description, devDependencies, builtin-modules (+31 more)

### Community 5 - "DiskCache"
Cohesion: 0.13
Nodes (10): HttpError, PokeApiClient, RawAbility, RawItem, RawPokemonListResponse, Semaphore, isRetryableHttpError(), RetryOptions (+2 more)

### Community 6 - "main.ts"
Cohesion: 0.10
Nodes (10): DEFAULT_ENABLED_GENERATIONS, DEFAULT_VISIBLE_COLUMNS, PluginSettings, PokedexPlugin, DEFAULT_SETTINGS, PokedexSettingTab, formatBytes(), GenerationToggleResult (+2 more)

### Community 7 - "tableColumns.ts"
Cohesion: 0.06
Nodes (41): FLAVOR_TEXT_TABS_BY_GEN, FLAVOR_TEXT_VERSION_GROUPS, GENERATIONS, MOVE_VERSION_GROUPS, MOVE_VERSION_TABS_BY_GEN, QuirkDef, QUIRKS, RARITIES (+33 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (20): DOM, DOM.Iterable, ES2020, ES2021.String, src/**/*.ts, compilerOptions, allowJs, importHelpers (+12 more)

### Community 9 - "Multi-Generation Expansion Plan"
Cohesion: 0.12
Nodes (16): Current state (baseline), Design principle: generation is a first-class axis, not bolted on later, Explicitly deferred — needs its own go/no-go, not a default yes, Goal, Log, Multi-Generation Expansion Plan, Open questions — none blocking Phase 1 start, Phase 1 — Gen 4 (Sinnoh, #387-493), no forms/Mega/Gigantamax (+8 more)

### Community 10 - "PokeApiClient"
Cohesion: 0.12
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
Cohesion: 0.11
Nodes (19): toGigantamaxFormDetail(), EvYieldEntry, GigantamaxFormDetail, GigantamaxFormSummary, MegaFormDetail, MegaFormSummary, MoveEntry, NamedApiResource (+11 more)

### Community 15 - "Pokedex"
Cohesion: 0.50
Nodes (3): Disclosures, Pokedex, Usage

## Knowledge Gaps
- **119 isolated node(s):** `id`, `name`, `version`, `minAppVersion`, `description` (+114 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PokedexRepository` connect `PokedexRepository` to `constants.ts`, `DiskCache`, `main.ts`, `PokeApiClient`, `VarietyToggleState`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `DiskCache` connect `PokeApiClient` to `PokedexRepository`, `DiskCache`, `main.ts`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `PokedexTableRow` connect `constants.ts` to `types.ts`, `PokedexRepository`, `tableColumns.ts`, `PokeApiClient`, `VarietyToggleState`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `id`, `name`, `version` to the rest of the system?**
  _119 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `constants.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `DetailScreen.svelte` be split into smaller, more focused modules?**
  _Cohesion score 0.06894049346879536 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09158186864014801 - nodes in this community are weakly interconnected._