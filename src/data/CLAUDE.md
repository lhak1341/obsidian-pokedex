# src/data (and the utils/view code that touches its cache)

Scoped to `PokeApiClient`, `PokedexRepository`, `Cache`/`DiskCache`, `normalize.ts`,
`constants.ts` — fetch, cache, and normalization rules for raw PokeAPI data.

## Data layer

- `PokeApiClient` owns request throttling via an internal `Semaphore`
  (`NETWORK_CONCURRENCY = 10`) enforced at the HTTP call site. Do not re-add cache-hit /
  cache-miss lane splitting or pre-partitioning in `PokedexRepository` to "protect"
  PokeAPI — that pattern forced a full-range disk scan before the first table row could
  render.
- `mapWithConcurrency` (`src/utils/concurrency.ts`) swallows per-item errors, so
  `cacheRange` / `refreshRange` / `getTableRows` never reject on a single failed id, and
  `FakePokeApiClient.failIds` cannot produce a real rejection through them. For classes
  that only orchestrate repository calls (e.g. `GenerationCacheController`), test against a
  narrow `Pick<PokedexRepository, …>` plus `vi.fn()` stubs; reserve the heavier
  repository + `FakePokeApiClient` stack (`PokedexLoadState.test.ts`,
  `DetailLoadState.test.ts`) for classes that need real fetch/cache behavior.
- Adding a genuinely new field to a raw PokeAPI response (e.g. `held_items` — as opposed to
  a trim-down of something already cached, like `moves`/`flavor_text_entries`) needs a
  matching `isStale` check on its `getOrFetch` call in `PokedexRepository.ts`. Otherwise an
  existing user's disk cache has the field `undefined` and crashes instead of self-healing.
- For a per-row derived value needing more than the already-fetched pokemon+species
  response and stable until the next generation ships (e.g. evolution-family depth), do not
  add a runtime fetch. Generate a static lookup table via `scripts/generate-*.ts`, reusing
  the real exported pure function from `src/data/*.ts` so it cannot drift, writing a
  committed `src/data/*.json` — see `scripts/generate-evolution-stages.ts` and
  `EVOLUTION_STAGES`. Same pattern covers genuinely NEW data too (no existing pure function
  to reuse at all) — see `scripts/generate-encounters.ts`/`ENCOUNTER_LOCATIONS`, which fetches
  a PokeAPI endpoint (`/pokemon/{id}/encounters`) nothing else in this app touches; staleness
  risk there is live PokeAPI drifting, not function drift. This keeps `PokedexTableRow` fields cheap, the invariant a first
  attempt broke by visibly slowing table load. A second per-species fact needing the same
  underlying walk (e.g. `IS_FINAL_EVOLUTION_STAGE`, per-node leaf-ness off the same
  evolution-chain data `EVOLUTION_STAGES` already walks) belongs in the SAME script/fetch
  pass, not a second one refetching all 541 chains again — write both output files from one
  `main()`. `writeFileSync(JSON.stringify(table))` alone drops the trailing newline the
  already-committed file has, showing a spurious diff on regen even when every value is
  identical — append `+ "\n"`.
  No gate catches a committed table like `evolutionStages.json`/`finalEvolutionStage.json`/
  `encounterLocations.json` going stale against the function that produced it — the generator walks live PokeAPI, so
  CI cannot regenerate it. `generationTables.test.ts` gates only consistency with `GENERATIONS` (array length
  covers the last dex number, generation ids exist), not freshness. `normalize.test.ts` ties the per-form rule (`evolutionReachByForm`) and the
  known divergent rows in `evolutionStageOverrides.json` together offline (the second drift instance
  that the deferred fixture test was waiting for: species-id tables mis-served regional-gated rows).
  Regenerating also picks up any live PokeAPI drift (Meltan -> Melmetal flipped #808/#809 in one
  run), so diff all three files and read the logged override list before keeping a regen.
- Tests build a `PokedexTableRow` through `makeRow` / `makeRegionalFormRow`
  (`src/data/__fixtures__/rows.ts`), never a literal. Adding a required field is one edit
  there: `tsc` fails the factory's return type until it is added. A plain row derives
  `generationId` from the dex number; a regional-form row (`id !== dexNumber`) must be made
  with `makeRegionalFormRow`, which takes its generation explicitly. `sortPokemon.test.ts` and
  `quickJump.test.ts` keep positional `row(...)` wrappers over `makeRow`.
- A regional-form or evolution-chain bug reported against one Pokemon is usually a whole
  category. Chains already group by shape (Muk-shaped, Yamask-shaped, Corsola-shaped,
  Mime-Jr-shaped, Obstagoon-shaped) — check `normalize.ts`'s shape comments for siblings
  before calling a chain fix complete.
- The repository never builds `normalizeEvolutionChain`'s context itself: `getEntryExtras` calls
  `normalizeEvolutionChainForViewed(chain, { id, pokemonName, speciesName })`, which owns the
  own-suffix / ancestor-suffix / no-context choice. A new chain shape gets its test there,
  from raw inputs, not by hand-typing a `formSuffix`/`ownFormSuffix` context.
- A bulk "does this whole family have property X" computation must walk the **raw**
  evolution chain (`evolves_to`), not `normalizeEvolutionChain`'s default no-context view.
  That view picks one coherent path for a specific viewed form and silently drops a branch
  gated entirely on a regional form with no unconditional sibling — it undercounted
  Farfetch'd (Galarian-only evolution) to 0 stages. See `evolutionFamilyDepth` in
  `normalize.ts`.
- A per-row fact stored in a table indexed by species id is wrong for any row whose own form
  differs from the species (plain Farfetch'd is final; its species-wide entry says it evolves).
  Key by `pokemon.name` (`EVOLUTION_STAGE_OVERRIDES`, `ENCOUNTER_LOCATIONS`) or check
  `evolutionReachByForm` before adding another species-id table. See CONTEXT.md "Evolution stage".
- PokeAPI renamed `evolution_details.base_form`/`evolved_form` to `required_pokemon_form`/
  `evolved_pokemon_form`. A raw chain read anywhere must go through `canonicalizeEvolutionChain`
  (the repository does; the generator does), or a fresh fetch silently loses all regional gating.
  Check a live response before trusting a field name in a "verified live" comment.

## Cache

Disk cache lives at `{manifest.dir}/cache` — the vault's deployed folder, not the manifest
id. `DiskCache.forPlugin` derives it from `manifest.dir` specifically because keying off
`manifest.id` used to orphan the cache in a sibling folder; `Cache.ts` holds one-time
migration logic. Inspect from eval via
`app.plugins.plugins['obsidian-pokedex'].manifest.dir + '/cache'`.

Regional forms have two distinct cache keys: the detail view fetches by numeric PokeAPI id
(`pokemon/10229.json` for Hisuian Growlithe) while table load's
`deriveRegionalForms`/`getOrFetchPokemonVariant` writes the name-keyed one
(`pokemon/growlithe-hisui.json`). `cacheRange` prefetches both unconditionally.
`clearRange` sweeps both, but only when the variant's own
`REGIONAL_FORMS[suffix].generationId` matches the generation being cleared — not its base
dex number's range, since those diverge (Alolan Rattata is dex #19 but `generationId: 7`).
Discovery is independent of the range being cleared too — `listCachedSpeciesIds()` lists
every cached species id via `DiskCache.listFilesIn("species")`, so a variant survives only
if its own generation truly doesn't match, never because its base id sits outside this
range (see ADR-0006).

`clearRange` also evicts each in-range base id's Mega and Gigantamax forms (`mega-forms/`,
`gigantamax-forms/`, and their four images, paths from `megaFormPath`/`gigantamaxFormPath`).
They belong to the base species' dex range, not their own generation, and their keys are
derived from the cached species/pokemon JSON, so that read must happen before the base files
are removed. `abilities/`, `items/`, `moves/` and `evolution-chain/` are shared across
species and only the global clear removes them. That global clear is
`PokedexRepository.clearAll()`, never `DiskCache.clear()` alone: `isIdCached`/`isExtrasCached`
count a mem hit as cached, so a disk-only clear leaves the counters at "N/N cached" and the
files are never written again this session. A fetch already in flight is not cancelled by
either clear and can still write afterwards.

Known residual gap (ADR-0006): `getCacheStatus` does not count variants at all, so its
"X/Y cached" figure undercounts once a generation has regional forms.

Gating a cache-eviction sweep on a matching condition can silently make the *correctly*
scoped case unreachable too, if discovery is still keyed by the old range. Live-verify both
directions before calling such a fix done.

## PokeAPI

- `GET /pokemon?limit=N` silently truncates when `N` is below the true count (1351 as of
  Gen 8). Pass `limit=2000` or read the response's own `count`. A `limit=1300` scan once
  hid 46 non-canon fan "-mega" varieties and shipped a real bug.
- Numbered list resources are **not** contiguous — guessing sequential ids 404s (8 of 541
  evolution chains, confirmed live). Paginate the real list endpoint
  (`/evolution-chain?limit=600`) and use `results[].url`.

## Debugging normalize.ts

To debug a `normalize.ts` discrepancy, do not hand-trace or eval-probe: write a
standalone script (`bun run /path/to/script.ts`) importing the real source file by
absolute path, run it against live-fetched PokeAPI data or the plugin's cached JSON, and
add temporary `console.error` instrumentation in the source, then revert.
