# Graph Report - obsidian-pokedex  (2026-07-23)

## Corpus Check
- 97 files · ~68,484 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 509 nodes · 1055 edges · 27 communities (21 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `025a71f8`
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
- Pokedex
- loadNotices.ts
- hoverPopover.svelte.ts
- CLAUDE.md
- 0001-two-generation-membership-checks.md
- 0002-mega-form-cache-not-on-getOrFetch.md
- 0003-pokedexview-stays-untested.md

## God Nodes (most connected - your core abstractions)
1. `PokedexRepository` - 41 edges
2. `PokedexTableRow` - 30 edges
3. `DiskCache` - 24 edges
4. `PokeApiClient` - 15 edges
5. `RawPokemon` - 15 edges
6. `compilerOptions` - 14 edges
7. `toTableRow()` - 13 edges
8. `resolveGenerationId()` - 12 edges
9. `imagePath()` - 11 edges
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
- `PokedexPlugin` --references--> `PokedexRepository`  [EXTRACTED]
  src/main.ts → src/data/PokedexRepository.ts

## Import Cycles
- 1-file cycle: `src/view/components/EvolutionChain.svelte -> src/view/components/EvolutionChain.svelte`

## Communities (27 total, 6 thin omitted)

### Community 0 - "constants.ts"
Cohesion: 0.10
Nodes (25): FOSSIL_IDS, EMPTY_FILTERS, filterPokemon(), matchesAbilities(), matchesEvStats(), matchesGenerations(), matchesQuirk(), matchesQuirks() (+17 more)

### Community 1 - "DetailScreen.svelte"
Cohesion: 0.06
Nodes (43): ./AbilitiesPanel.svelte, ./BarRow.svelte, accentColor, activePortraitSource, adjacent, evolvesAtLevels, femalePct, malePct (+35 more)

### Community 2 - "types.ts"
Cohesion: 0.09
Nodes (37): collectMemberIds(), idFromUrl(), main(), mapWithConcurrency(), EVOLUTION_STAGES, MEGA_VARIETY_KEYS, MOVE_DESCRIPTION_VERSION_GROUPS, buildEvolutionNode() (+29 more)

### Community 3 - "PokedexRepository"
Cohesion: 0.09
Nodes (19): ADR-0002, ALL_IMAGE_SUFFIXES, imagePath(), ImageSuffix, pokemonPath(), speciesPath(), toGigantamaxFormDetail(), trimFlavorTextEntries() (+11 more)

### Community 4 - "devDependencies"
Cohesion: 0.05
Nodes (39): builtin-modules, esbuild, esbuild-svelte, eslint, eslint-plugin-obsidianmd, description, devDependencies, builtin-modules (+31 more)

### Community 5 - "DiskCache"
Cohesion: 0.14
Nodes (17): EvolutionChainVisual, EvYieldEntry, GigantamaxFormDetail, GigantamaxFormSummary, MegaFormDetail, MegaFormSummary, MoveEntry, NamedApiResource (+9 more)

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
Cohesion: 0.06
Nodes (25): arrayBufferToBase64(), DiskCache, extOf(), MIME_BY_EXT, makeCache(), createFakeDataAdapter(), FakePokeApiClient, HttpError (+17 more)

### Community 11 - "manifest.json"
Cohesion: 0.25
Nodes (7): author, description, id, isDesktopOnly, minAppVersion, name, version

### Community 12 - "Domain glossary"
Cohesion: 0.33
Nodes (5): Domain glossary, Evolution requirement, Generation fallback, Quick jump, View history

### Community 13 - "viewHistory.ts"
Cohesion: 0.26
Nodes (6): pushHistory(), stepBack(), stepForward(), ViewHistoryStep, DetailNavigationState, ScrollInstruction

### Community 15 - "Pokedex"
Cohesion: 0.50
Nodes (3): Disclosures, Pokedex, Usage

## Knowledge Gaps
- **123 isolated node(s):** `id`, `name`, `version`, `minAppVersion`, `description` (+118 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PokedexRepository` connect `PokedexRepository` to `PokeApiClient`, `main.ts`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `DiskCache` connect `PokeApiClient` to `PokedexRepository`, `main.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `PokedexTableRow` connect `PokedexRepository` to `constants.ts`, `types.ts`, `DiskCache`, `tableColumns.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `id`, `name`, `version` to the rest of the system?**
  _123 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `constants.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10420168067226891 - nodes in this community are weakly interconnected._
- **Should `DetailScreen.svelte` be split into smaller, more focused modules?**
  _Cohesion score 0.058445353594389245 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09371980676328502 - nodes in this community are weakly interconnected._