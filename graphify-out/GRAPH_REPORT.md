# Graph Report - obsidian-pokedex  (2026-10-10)

## Corpus Check
- 142 files · ~91,630 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 708 nodes · 1467 edges · 47 communities (34 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `79e1655a`
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
- GENERATIONS
- GENERATIONS
- imageBounds.ts
- abilityOptions.ts
- src/view
- deploy.mjs
- lint-ratchet.mjs
- generationScope.ts
- pokedollar.ts
- 0007-local-preference-callbacks-stay-plumbed.md
- 0008-font-picker-stays-the-shared-recipe-shape.md
- 0009-detail-screen-derivations-stay-in-the-component.md

## God Nodes (most connected - your core abstractions)
1. `PokedexRepository` - 51 edges
2. `PokedexTableRow` - 34 edges
3. `DiskCache` - 27 edges
4. `RawPokemon` - 18 edges
5. `PokeApiClient` - 14 edges
6. `compilerOptions` - 14 edges
7. `scripts` - 13 edges
8. `toTableRow()` - 13 edges
9. `filterPokemon()` - 13 edges
10. `PokedexPlugin` - 12 edges

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

## Communities (47 total, 13 thin omitted)

### Community 0 - "constants.ts"
Cohesion: 0.06
Nodes (51): FOSSIL_IDS, GENERATIONS, resolveGenerationId(), makeRegionalFormRow(), makeRow(), TableLoadResult, PokedexTableRow, DexNavEntry (+43 more)

### Community 1 - "DetailScreen.svelte"
Cohesion: 0.05
Nodes (48): ./AbilitiesPanel.svelte, popover, ./BarRow.svelte, retry(), startLoad(), ./EvolutionChain.svelte, ./FilterBar.svelte, activeFlavorIndex (+40 more)

### Community 2 - "types.ts"
Cohesion: 0.06
Nodes (53): ENCOUNTER_LOCATIONS, EVOLUTION_STAGE_OVERRIDES, EVOLUTION_STAGES, FLAVOR_TEXT_TABS_BY_GEN, FLAVOR_TEXT_VERSION_GROUPS, IS_FINAL_EVOLUTION_STAGE, MEGA_VARIETY_KEYS, MOVE_DESCRIPTION_VERSION_GROUPS (+45 more)

### Community 3 - "PokedexRepository"
Cohesion: 0.08
Nodes (18): ALL_IMAGE_SUFFIXES, gigantamaxFormPath(), imagePath(), ImageSuffix, megaFormPath(), pokemonPath(), speciesPath(), Generation (+10 more)

### Community 4 - "devDependencies"
Cohesion: 0.05
Nodes (43): builtin-modules, esbuild, esbuild-svelte, eslint, eslint-plugin-obsidianmd, description, devDependencies, builtin-modules (+35 more)

### Community 6 - "main.ts"
Cohesion: 0.09
Nodes (14): DEFAULT_ENABLED_GENERATIONS, DEFAULT_VISIBLE_COLUMNS, FontChoice, PokedexPlugin, DEFAULT_SETTINGS, FONT_OPTIONS, PokedexSettingTab, formatBytes() (+6 more)

### Community 7 - "PokeApiClient.ts"
Cohesion: 0.14
Nodes (19): acquisitionFromEncounterDetails(), buildAreaRegionMap(), fetchJson(), main(), RawEncounter, RawLocation, RawPokemonMinimal, collectMembers() (+11 more)

### Community 8 - "compilerOptions"
Cohesion: 0.10
Nodes (20): DOM, DOM.Iterable, ES2020, ES2021.String, src/**/*.ts, compilerOptions, allowJs, importHelpers (+12 more)

### Community 9 - "Multi-Generation Expansion Plan"
Cohesion: 0.12
Nodes (16): Current state (baseline), Design principle: generation is a first-class axis, not bolted on later, Explicitly deferred — needs its own go/no-go, not a default yes, Goal, Log, Multi-Generation Expansion Plan, Open questions — none blocking Phase 1 start, Phase 1 — Gen 4 (Sinnoh, #387-493), no forms/Mega/Gigantamax (+8 more)

### Community 10 - "PokeApiClient"
Cohesion: 0.06
Nodes (36): ADR-0002, arrayBufferToBase64(), DiskCache, extOf(), MIME_BY_EXT, makeCache(), ADR-0006, createFakeDataAdapter() (+28 more)

### Community 11 - "manifest.json"
Cohesion: 0.25
Nodes (7): author, description, id, isDesktopOnly, minAppVersion, name, version

### Community 12 - "Domain glossary"
Cohesion: 0.20
Nodes (9): Active Gen scoping, Domain glossary, Evolution requirement, Evolution stage, Generation fallback, Quick jump, Quirk and Trait, Variety toggle (+1 more)

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
Cohesion: 0.33
Nodes (5): sideAnchoredPreviewPosition(), computeSideAnchoredPreviewPosition(), relativeRect, createHoverDescription(), createHoverPopover()

### Community 28 - "PokedexView"
Cohesion: 0.20
Nodes (3): FONT_VAR_RESOLVERS, resolveFontVar(), PokedexView

### Community 29 - "sortPokemon.ts"
Cohesion: 0.12
Nodes (21): STAT_COLUMNS, STAT_OVERRIDES, StatBlock, PokedexFilters, formatDexNumber(), formatHeight(), formatPokemonDisplayName(), formatWeight() (+13 more)

### Community 30 - "moveRows.ts"
Cohesion: 0.53
Nodes (4): MoveEntry, buildMoveRows(), MoveRow, move()

### Community 34 - "tableColumns.ts"
Cohesion: 0.33
Nodes (4): failures, manifest, tag, versions

### Community 37 - "GENERATIONS"
Cohesion: 0.33
Nodes (5): Cache, Data layer, Debugging normalize.ts, PokeAPI, src/data (and the utils/view code that touches its cache)

### Community 38 - "GENERATIONS"
Cohesion: 0.40
Nodes (4): resolveTabsForGen(), FLAVOR_TABS_BY_GEN, LATEST_GEN, MOVE_TABS_BY_GEN

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

## Knowledge Gaps
- **173 isolated node(s):** `id`, `name`, `version`, `minAppVersion`, `description` (+168 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PokedexRepository` connect `PokedexRepository` to `constants.ts`, `PokeApiClient`, `PokedexView`, `main.ts`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `PokedexTableRow` connect `constants.ts` to `types.ts`, `PokedexRepository`, `PokeApiClient`, `generationScope.ts`, `sortPokemon.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `DiskCache` connect `PokeApiClient` to `PokedexRepository`, `main.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `id`, `name`, `version` to the rest of the system?**
  _173 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `constants.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05693693693693694 - nodes in this community are weakly interconnected._
- **Should `DetailScreen.svelte` be split into smaller, more focused modules?**
  _Cohesion score 0.05472636815920398 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._