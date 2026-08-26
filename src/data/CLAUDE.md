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
  `EVOLUTION_STAGES`. This keeps `PokedexTableRow` fields cheap, the invariant a first
  attempt broke by visibly slowing table load.
- A regional-form or evolution-chain bug reported against one Pokemon is usually a whole
  category. Chains already group by shape (Muk-shaped, Yamask-shaped, Corsola-shaped,
  Mime-Jr-shaped, Obstagoon-shaped) — check `normalize.ts`'s shape comments for siblings
  before calling a chain fix complete.
- A bulk "does this whole family have property X" computation must walk the **raw**
  evolution chain (`evolves_to`), not `normalizeEvolutionChain`'s default no-context view.
  That view picks one coherent path for a specific viewed form and silently drops a branch
  gated entirely on a regional form with no unconditional sibling — it undercounted
  Farfetch'd (Galarian-only evolution) to 0 stages. See `evolutionFamilyDepth` in
  `normalize.ts`.

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

Known residual gaps (ADR-0006): `getCacheStatus` does not count variants at all, so its
"X/Y cached" figure undercounts once a generation has regional forms; and because
`clearRange` only visits base ids inside its own range, a variant whose generation differs
from its base species' range survives every per-generation Delete and yields only to the
global "Clear cache".

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
