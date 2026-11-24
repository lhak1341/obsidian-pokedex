# A species' cache footprint stays two questions, not one shared description

An architecture review flagged that "what a species owns in the cache" is enumerated in three places in `PokedexRepository`: the status check (`isIdCached`, `isExtrasCached`), eviction (`clearRange` via `evictVarietyForms`, `evictPokemonAssets`, `evictImages`) and `clearAll`. It suggested one description of the footprint consumed by status, evict and prefetch.

On inspection these are not three copies of one list:

- **Status asks "would opening this id be instant?"** It checks pokemon JSON, species JSON and the artwork file, and uses the artwork file as a deliberate proxy for "`getEntryExtras` has landed" (shiny, shiny artwork and the evolution chain arrive in the same call). It intentionally skips variants (ADR-0006) and the Mega/Gigantamax forms.
- **Eviction asks "remove everything this species owns".** It already composes three helpers that share one image list, `ALL_IMAGE_SUFFIXES`, derived from the image-set table in `imageSet.ts`. Four tests pin it, including the write/delete symmetry test in `PokedexRepository.test.ts`.
- **`clearAll` does not enumerate a species footprint.** It empties the mem-cache `Map`s (ADR-0004) and calls `cache.clear()`.
- **Prefetch (`cacheRange`) enumerates nothing.** It calls `getTableRows` then `getEntryExtras`.

A shared description would have to carry two views of the same list, or make the status side count everything it deliberately skips. Deleting it would put the lists back in the same two places, so it fails the deletion test.

**Decision:** leave status and eviction as separate questions. Don't re-flag them as one duplicated footprint in a future review.

**Reopen when** a new per-species artifact is added and either the status check or eviction misses it (a real bug, not a hypothetical), or when `getCacheStatus` is extended to count regional-form variants. The ADR-0006 gap needs a new honest total surfaced through `settings.ts`, and that work would touch the status side anyway.

## Addendum (2026-11-24): prefetch runs the detail-open plan

The "Prefetch enumerates nothing" line above stopped being true with #21 (8d1758b). From then on, `cacheRange` called its own `prefetchEntryExtras` instead of `getEntryExtras`, so that a generation's large images would not pass through the image LRU. That copy listed flavour text, the raw chain and the large images, and fell behind what a detail open loads. It never fetched the move pool (`moves/*.json`), the species a chain's variety ids are resolved from, or the chain members' pokemon and sprites outside the range. So "Cache" promised an instant detail screen that still needed the network.

`PokedexRepository.loadEntry` is now the one detail-open plan (CONTEXT.md, "Entry load"). `DetailLoadState.load` runs it with images "hold", and `cacheRange` runs it with images "store". `DetailLoadState.test.ts` pins it: after `cacheRange`, a detail load against a client that throws on every call makes no request.

The decision above stands. Status and eviction stay separate questions:

- **Status keeps its stand-in.** `isExtrasCached` checks the large image only, and does not check the move pool or chain members. A generation cached before this change reads as cached while missing them. Online nothing shows, since moves load on open as before. Offline, a Refresh fills them in.
- **Eviction is unchanged.** Move details and other generations' chain members are shared, so `clearRange` leaves them, and only `clearAll` removes them.
