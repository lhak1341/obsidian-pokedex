# Graph Report - obsidian-pokedex  (2026-09-10)

## Corpus Check
- 122 files · ~75,491 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 607 nodes · 1218 edges · 44 communities (35 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `49bd6d98`
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
- sortPokemon.ts
- resolveGenerationId
- 0001-two-generation-membership-checks.md
- 0002-mega-form-cache-not-on-getOrFetch.md
- 0003-pokedexview-stays-untested.md
- tableColumns.ts
- PokedexTableRow
- quickJump.ts
- GENERATIONS
- moveRows.ts
- imageBounds.ts
- abilityOptions.ts
- src/view
- deploy.mjs
- lint-ratchet.mjs

## God Nodes (most connected - your core abstractions)
1. `PokedexRepository` - 48 edges
2. `PokedexTableRow` - 30 edges
3. `DiskCache` - 27 edges
4. `RawPokemon` - 18 edges
5. `PokeApiClient` - 14 edges
6. `compilerOptions` - 14 edges
7. `scripts` - 13 edges
8. `toTableRow()` - 13 edges
9. `resolveGenerationId()` - 12 edges
10. `createFakeDataAdapter()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `fetchJson()` --calls--> `withRetry()`  [EXTRACTED]
  scripts/generate-evolution-stages.ts → src/utils/retry.ts
- `main()` --calls--> `evolutionFamilyDepth()`  [EXTRACTED]
  scripts/generate-evolution-stages.ts → src/data/normalize.ts
- `main()` --calls--> `mapWithConcurrency()`  [EXTRACTED]
  scripts/generate-evolution-stages.ts → src/utils/concurrency.ts
- `row()` --calls--> `resolveGenerationId()`  [EXTRACTED]
  src/utils/quickJump.test.ts → src/data/constants.ts
- `GenerationScope` --references--> `PokedexTableRow`  [EXTRACTED]
  src/utils/generationScope.ts → src/data/types.ts

## Import Cycles
- 1-file cycle: `src/view/components/EvolutionChain.svelte -> src/view/components/EvolutionChain.svelte`

## Communities (44 total, 9 thin omitted)

### Community 0 - "constants.ts"
Cohesion: 0.23
Nodes (14): FOSSIL_IDS, filterPokemon(), matchesAbilities(), matchesEvStats(), matchesQuirk(), matchesQuirks(), matchesRarities(), matchesSearch() (+6 more)

### Community 1 - "DetailScreen.svelte"
Cohesion: 0.06
Nodes (44): ./AbilitiesPanel.svelte, popover, ./BarRow.svelte, retry(), startLoad(), ./EvolutionChain.svelte, ./FilterBar.svelte, activeFlavorIndex (+36 more)

### Community 2 - "types.ts"
Cohesion: 0.07
Nodes (53): ADR-0002, EVOLUTION_STAGES, MEGA_VARIETY_KEYS, MOVE_DESCRIPTION_VERSION_GROUPS, REGIONAL_FORMS, buildEvolutionNode(), collectChainIds(), deriveGigantamaxForms() (+45 more)

### Community 3 - "PokedexRepository"
Cohesion: 0.09
Nodes (11): ALL_IMAGE_SUFFIXES, imagePath(), ImageSuffix, pokemonPath(), speciesPath(), Generation, PokedexRepository, MoveDetail (+3 more)

### Community 4 - "devDependencies"
Cohesion: 0.05
Nodes (43): builtin-modules, esbuild, esbuild-svelte, eslint, eslint-plugin-obsidianmd, description, devDependencies, builtin-modules (+35 more)

### Community 6 - "main.ts"
Cohesion: 0.08
Nodes (14): DEFAULT_ENABLED_GENERATIONS, DEFAULT_VISIBLE_COLUMNS, PluginSettings, PokedexPlugin, DEFAULT_SETTINGS, PokedexSettingTab, formatBytes(), describeGenerationAction() (+6 more)

### Community 7 - "tableColumns.ts"
Cohesion: 0.10
Nodes (18): FLAVOR_TEXT_TABS_BY_GEN, FLAVOR_TEXT_VERSION_GROUPS, GENERATIONS, MOVE_VERSION_GROUPS, MOVE_VERSION_TABS_BY_GEN, QuirkDef, QUIRKS, RARITIES (+10 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (20): DOM, DOM.Iterable, ES2020, ES2021.String, src/**/*.ts, compilerOptions, allowJs, importHelpers (+12 more)

### Community 9 - "Multi-Generation Expansion Plan"
Cohesion: 0.12
Nodes (16): Current state (baseline), Design principle: generation is a first-class axis, not bolted on later, Explicitly deferred — needs its own go/no-go, not a default yes, Goal, Log, Multi-Generation Expansion Plan, Open questions — none blocking Phase 1 start, Phase 1 — Gen 4 (Sinnoh, #387-493), no forms/Mega/Gigantamax (+8 more)

### Community 10 - "PokeApiClient"
Cohesion: 0.11
Nodes (16): arrayBufferToBase64(), DiskCache, extOf(), MIME_BY_EXT, makeCache(), ADR-0006, createFakeDataAdapter(), FakePokeApiClient (+8 more)

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
Cohesion: 0.48
Nodes (5): PortraitImageSource, basePortrait(), resolvePortrait(), shinyPortrait(), full

### Community 15 - "Pokedex"
Cohesion: 0.18
Nodes (9): obsidian-pokedex, Repo-specific toolchain, Development, Disclosures, Features, Installation, License, Pokedex (+1 more)

### Community 17 - "hoverPopover.svelte.ts"
Cohesion: 0.33
Nodes (5): sideAnchoredPreviewPosition(), computeSideAnchoredPreviewPosition(), relativeRect, createHoverDescription(), createHoverPopover()

### Community 28 - "PokeApiClient.ts"
Cohesion: 0.11
Nodes (17): collectMemberIds(), fetchJson(), idFromUrl(), main(), evolutionFamilyDepth(), HttpError, PokeApiClient, RawAbility (+9 more)

### Community 29 - "sortPokemon.ts"
Cohesion: 0.15
Nodes (14): STAT_COLUMNS, STAT_OVERRIDES, StatBlock, PokedexFilters, SortColumn, SortDirection, sortPokemon(), valueOf() (+6 more)

### Community 30 - "resolveGenerationId"
Cohesion: 0.20
Nodes (10): resolveGenerationId(), DexNavEntry, getAdjacentDexEntries(), row(), toNavEntry(), EMPTY_FILTERS, row(), rows (+2 more)

### Community 34 - "tableColumns.ts"
Cohesion: 0.33
Nodes (4): failures, manifest, tag, versions

### Community 35 - "PokedexTableRow"
Cohesion: 0.38
Nodes (4): TableLoadResult, PokedexTableRow, isIdInGenerations(), PokedexLoadState

### Community 36 - "quickJump.ts"
Cohesion: 0.31
Nodes (7): quickJumpMatches(), QuickJumpNavResult, stepQuickJumpNav(), row(), onKeydown(), registerGlobalHotkey(), createQuickJumpDropdown()

### Community 37 - "GENERATIONS"
Cohesion: 0.33
Nodes (5): Cache, Data layer, Debugging normalize.ts, PokeAPI, src/data (and the utils/view code that touches its cache)

### Community 38 - "moveRows.ts"
Cohesion: 0.47
Nodes (3): matchesGenerations(), GenerationScope, resolveGenerationScope()

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

## Knowledge Gaps
- **154 isolated node(s):** `id`, `name`, `version`, `minAppVersion`, `description` (+149 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PokedexRepository` connect `PokedexRepository` to `types.ts`, `PokedexTableRow`, `main.ts`, `PokeApiClient`, `PokeApiClient.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `DiskCache` connect `PokeApiClient` to `types.ts`, `PokedexRepository`, `PokeApiClient.ts`, `main.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `id`, `name`, `version` to the rest of the system?**
  _154 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DetailScreen.svelte` be split into smaller, more focused modules?**
  _Cohesion score 0.058469945355191254 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07272727272727272 - nodes in this community are weakly interconnected._
- **Should `PokedexRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._