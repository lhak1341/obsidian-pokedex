# Graph Report - obsidian-pokedex  (2026-07-22)

## Corpus Check
- 95 files · ~60,008 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 496 nodes · 1028 edges · 32 communities (26 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `446c44a2`
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
- resolveGenerationId
- Pokedex
- loadNotices.ts
- hoverPopover.svelte.ts
- CLAUDE.md
- PokedexTableRow
- GENERATIONS
- quickJump.ts
- generationScope.ts
- 0001-two-generation-membership-checks.md
- 0002-mega-form-cache-not-on-getOrFetch.md
- 0003-pokedexview-stays-untested.md

## God Nodes (most connected - your core abstractions)
1. `PokedexRepository` - 42 edges
2. `PokedexTableRow` - 30 edges
3. `DiskCache` - 23 edges
4. `RawPokemon` - 16 edges
5. `PokeApiClient` - 15 edges
6. `compilerOptions` - 14 edges
7. `toTableRow()` - 13 edges
8. `resolveGenerationId()` - 12 edges
9. `imagePath()` - 11 edges
10. `PokedexPlugin` - 11 edges

## Surprising Connections (you probably didn't know these)
- `GenerationScope` --references--> `PokedexTableRow`  [EXTRACTED]
  src/utils/generationScope.ts → src/data/types.ts
- `PokedexPlugin` --references--> `DiskCache`  [EXTRACTED]
  src/main.ts → src/data/Cache.ts
- `PokedexPlugin` --references--> `PokedexRepository`  [EXTRACTED]
  src/main.ts → src/data/PokedexRepository.ts
- `toTableRow()` --calls--> `resolveGenerationId()`  [EXTRACTED]
  src/data/normalize.ts → src/data/constants.ts
- `row()` --calls--> `resolveGenerationId()`  [EXTRACTED]
  src/utils/dexNav.test.ts → src/data/constants.ts

## Import Cycles
- 1-file cycle: `src/view/components/EvolutionChain.svelte -> src/view/components/EvolutionChain.svelte`

## Communities (32 total, 6 thin omitted)

### Community 0 - "constants.ts"
Cohesion: 0.23
Nodes (14): FOSSIL_IDS, filterPokemon(), matchesAbilities(), matchesEvStats(), matchesQuirk(), matchesQuirks(), matchesRarities(), matchesSearch() (+6 more)

### Community 1 - "DetailScreen.svelte"
Cohesion: 0.06
Nodes (43): ./AbilitiesPanel.svelte, ./BarRow.svelte, accentColor, activePortraitSource, adjacent, evolvesAtLevels, femalePct, malePct (+35 more)

### Community 2 - "types.ts"
Cohesion: 0.12
Nodes (31): MEGA_VARIETY_KEYS, MOVE_DESCRIPTION_VERSION_GROUPS, buildEvolutionNode(), collectChainIds(), deriveGigantamaxForms(), deriveMegaForms(), deriveRegionalForms(), describeEvolutionRequirement() (+23 more)

### Community 3 - "PokedexRepository"
Cohesion: 0.11
Nodes (15): ADR-0002, ALL_IMAGE_SUFFIXES, imagePath(), ImageSuffix, pokemonPath(), speciesPath(), toGigantamaxFormDetail(), trimFlavorTextEntries() (+7 more)

### Community 4 - "devDependencies"
Cohesion: 0.05
Nodes (38): builtin-modules, esbuild, esbuild-svelte, eslint, eslint-plugin-obsidianmd, description, devDependencies, builtin-modules (+30 more)

### Community 5 - "DiskCache"
Cohesion: 0.13
Nodes (14): FLAVOR_TEXT_TABS_BY_GEN, FLAVOR_TEXT_VERSION_GROUPS, MOVE_VERSION_GROUPS, MOVE_VERSION_TABS_BY_GEN, QuirkDef, QUIRKS, RARITIES, REGIONAL_FORMS (+6 more)

### Community 6 - "main.ts"
Cohesion: 0.10
Nodes (10): DEFAULT_ENABLED_GENERATIONS, DEFAULT_VISIBLE_COLUMNS, PluginSettings, PokedexPlugin, DEFAULT_SETTINGS, PokedexSettingTab, formatBytes(), GenerationToggleResult (+2 more)

### Community 7 - "tableColumns.ts"
Cohesion: 0.08
Nodes (31): STAT_COLUMNS, STAT_OVERRIDES, EvolutionChainVisual, EvYieldEntry, GigantamaxFormDetail, GigantamaxFormSummary, MegaFormDetail, MegaFormSummary (+23 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (20): DOM, DOM.Iterable, ES2020, ES2021.String, src/**/*.ts, compilerOptions, allowJs, importHelpers (+12 more)

### Community 9 - "Multi-Generation Expansion Plan"
Cohesion: 0.12
Nodes (16): Current state (baseline), Design principle: generation is a first-class axis, not bolted on later, Explicitly deferred — needs its own go/no-go, not a default yes, Goal, Log, Multi-Generation Expansion Plan, Open questions — none blocking Phase 1 start, Phase 1 — Gen 4 (Sinnoh, #387-493), no forms/Mega/Gigantamax (+8 more)

### Community 10 - "PokeApiClient"
Cohesion: 0.07
Nodes (22): arrayBufferToBase64(), DiskCache, extOf(), MIME_BY_EXT, makeCache(), createFakeDataAdapter(), FakePokeApiClient, HttpError (+14 more)

### Community 11 - "manifest.json"
Cohesion: 0.25
Nodes (7): author, description, id, isDesktopOnly, minAppVersion, name, version

### Community 12 - "Domain glossary"
Cohesion: 0.33
Nodes (5): Domain glossary, Evolution requirement, Generation fallback, Quick jump, View history

### Community 13 - "viewHistory.ts"
Cohesion: 0.26
Nodes (6): pushHistory(), stepBack(), stepForward(), ViewHistoryStep, DetailNavigationState, ScrollInstruction

### Community 14 - "resolveGenerationId"
Cohesion: 0.18
Nodes (11): resolveGenerationId(), DexNavEntry, getAdjacentDexEntries(), row(), toNavEntry(), EMPTY_FILTERS, row(), rows (+3 more)

### Community 15 - "Pokedex"
Cohesion: 0.50
Nodes (3): Disclosures, Pokedex, Usage

### Community 20 - "PokedexTableRow"
Cohesion: 0.32
Nodes (3): TableLoadResult, PokedexTableRow, PokedexLoadState

### Community 26 - "GENERATIONS"
Cohesion: 0.28
Nodes (7): GENERATIONS, isIdInGenerations(), LATEST_GEN, resolveTabsForGen(), FLAVOR_TABS_BY_GEN, LATEST_GEN, MOVE_TABS_BY_GEN

### Community 27 - "quickJump.ts"
Cohesion: 0.42
Nodes (5): quickJumpMatches(), QuickJumpNavResult, stepQuickJumpNav(), registerGlobalHotkey(), createQuickJumpDropdown()

### Community 28 - "generationScope.ts"
Cohesion: 0.47
Nodes (3): matchesGenerations(), GenerationScope, resolveGenerationScope()

## Knowledge Gaps
- **122 isolated node(s):** `id`, `name`, `version`, `minAppVersion`, `description` (+117 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PokedexRepository` connect `PokedexRepository` to `PokeApiClient`, `PokedexTableRow`, `main.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `DiskCache` connect `PokeApiClient` to `PokedexRepository`, `main.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `PokedexTableRow` connect `PokedexTableRow` to `constants.ts`, `types.ts`, `PokedexRepository`, `tableColumns.ts`, `PokeApiClient`, `resolveGenerationId`, `quickJump.ts`, `generationScope.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `id`, `name`, `version` to the rest of the system?**
  _122 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DetailScreen.svelte` be split into smaller, more focused modules?**
  _Cohesion score 0.058445353594389245 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11522048364153627 - nodes in this community are weakly interconnected._
- **Should `PokedexRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.10552061495457722 - nodes in this community are weakly interconnected._