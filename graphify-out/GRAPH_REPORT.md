# Graph Report - obsidian-pokedex  (2026-07-29)

## Corpus Check
- 109 files · ~73,854 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 556 nodes · 1155 edges · 34 communities (26 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9ba6b2f8`
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
- 0001-two-generation-membership-checks.md
- 0002-mega-form-cache-not-on-getOrFetch.md
- 0003-pokedexview-stays-untested.md
- moveRows.ts
- imageBounds.ts

## God Nodes (most connected - your core abstractions)
1. `PokedexRepository` - 47 edges
2. `PokedexTableRow` - 30 edges
3. `DiskCache` - 26 edges
4. `RawPokemon` - 18 edges
5. `PokeApiClient` - 14 edges
6. `compilerOptions` - 14 edges
7. `toTableRow()` - 13 edges
8. `resolveGenerationId()` - 12 edges
9. `createFakeDataAdapter()` - 11 edges
10. `PokedexPlugin` - 11 edges

## Surprising Connections (you probably didn't know these)
- `fetchJson()` --calls--> `withRetry()`  [EXTRACTED]
  scripts/generate-evolution-stages.ts → src/utils/retry.ts
- `main()` --calls--> `mapWithConcurrency()`  [EXTRACTED]
  scripts/generate-evolution-stages.ts → src/utils/concurrency.ts
- `main()` --calls--> `evolutionFamilyDepth()`  [EXTRACTED]
  scripts/generate-evolution-stages.ts → src/data/normalize.ts
- `row()` --calls--> `resolveGenerationId()`  [EXTRACTED]
  src/utils/sortPokemon.test.ts → src/data/constants.ts
- `createQuickJumpDropdown()` --indirect_call--> `onKeydown()`  [INFERRED]
  src/view/quickJumpDropdown.svelte.ts → src/view/components/DetailScreen.svelte

## Import Cycles
- 1-file cycle: `src/view/components/EvolutionChain.svelte -> src/view/components/EvolutionChain.svelte`

## Communities (34 total, 8 thin omitted)

### Community 0 - "constants.ts"
Cohesion: 0.07
Nodes (40): FOSSIL_IDS, GENERATIONS, resolveGenerationId(), TableLoadResult, PokedexTableRow, DexNavEntry, getAdjacentDexEntries(), row() (+32 more)

### Community 1 - "DetailScreen.svelte"
Cohesion: 0.06
Nodes (44): ./AbilitiesPanel.svelte, popover, ./BarRow.svelte, active, onKeydown(), retry(), startLoad(), ./EvolutionChain.svelte (+36 more)

### Community 2 - "types.ts"
Cohesion: 0.10
Nodes (35): EVOLUTION_STAGES, MEGA_VARIETY_KEYS, MOVE_DESCRIPTION_VERSION_GROUPS, buildEvolutionNode(), collectChainIds(), deriveGigantamaxForms(), deriveMegaForms(), deriveRegionalForms() (+27 more)

### Community 3 - "PokedexRepository"
Cohesion: 0.10
Nodes (17): ADR-0002, ALL_IMAGE_SUFFIXES, imagePath(), ImageSuffix, pokemonPath(), speciesPath(), Generation, trimFlavorTextEntries() (+9 more)

### Community 4 - "devDependencies"
Cohesion: 0.05
Nodes (40): builtin-modules, esbuild, esbuild-svelte, eslint, eslint-plugin-obsidianmd, description, devDependencies, builtin-modules (+32 more)

### Community 6 - "main.ts"
Cohesion: 0.08
Nodes (12): DEFAULT_ENABLED_GENERATIONS, DEFAULT_VISIBLE_COLUMNS, PluginSettings, PokedexPlugin, DEFAULT_SETTINGS, PokedexSettingTab, formatBytes(), GenerationToggleResult (+4 more)

### Community 7 - "tableColumns.ts"
Cohesion: 0.08
Nodes (30): FLAVOR_TEXT_TABS_BY_GEN, FLAVOR_TEXT_VERSION_GROUPS, MOVE_VERSION_GROUPS, MOVE_VERSION_TABS_BY_GEN, QuirkDef, QUIRKS, RARITIES, REGIONAL_FORMS (+22 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (20): DOM, DOM.Iterable, ES2020, ES2021.String, src/**/*.ts, compilerOptions, allowJs, importHelpers (+12 more)

### Community 9 - "Multi-Generation Expansion Plan"
Cohesion: 0.12
Nodes (16): Current state (baseline), Design principle: generation is a first-class axis, not bolted on later, Explicitly deferred — needs its own go/no-go, not a default yes, Goal, Log, Multi-Generation Expansion Plan, Open questions — none blocking Phase 1 start, Phase 1 — Gen 4 (Sinnoh, #387-493), no forms/Mega/Gigantamax (+8 more)

### Community 10 - "PokeApiClient"
Cohesion: 0.07
Nodes (25): arrayBufferToBase64(), DiskCache, extOf(), MIME_BY_EXT, makeCache(), ADR-0006, createFakeDataAdapter(), FakePokeApiClient (+17 more)

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
Cohesion: 0.26
Nodes (9): collectMemberIds(), fetchJson(), idFromUrl(), main(), evolutionFamilyDepth(), isRetryableHttpError(), RetryOptions, sleep() (+1 more)

### Community 38 - "moveRows.ts"
Cohesion: 0.53
Nodes (4): MoveEntry, buildMoveRows(), MoveRow, move()

### Community 39 - "imageBounds.ts"
Cohesion: 0.67
Nodes (3): cache, contentScale(), decode()

## Knowledge Gaps
- **131 isolated node(s):** `id`, `name`, `version`, `minAppVersion`, `description` (+126 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PokedexRepository` connect `PokedexRepository` to `constants.ts`, `PokeApiClient`, `VarietyToggleState`, `main.ts`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `DiskCache` connect `PokeApiClient` to `PokedexRepository`, `main.ts`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `PokedexTableRow` connect `constants.ts` to `PokeApiClient`, `types.ts`, `PokedexRepository`, `tableColumns.ts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **What connects `id`, `name`, `version` to the rest of the system?**
  _131 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `constants.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0655367231638418 - nodes in this community are weakly interconnected._
- **Should `DetailScreen.svelte` be split into smaller, more focused modules?**
  _Cohesion score 0.060496067755595885 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09988385598141696 - nodes in this community are weakly interconnected._