# No cached table rows; the pokemon record is compacted instead

A store-served table load read 145 MB of `pokemon/N.json` over 1,025 pokemon (554–838 ms of IndexedDB reads, probed) and held all of it in `pokemonMemCache` for the session, to build rows of about 1.5 KB each. Moves were 124 MB of it. An architecture review (2026-11-20, performance, candidate 3) proposed caching each finished `PokedexTableRow` (`rows/N.json`) behind a row-shape version, so the table load would never read the full record.

**Decision:** no row cache. The cache keeps the PokeAPI record, compacted by projection (`toStoredPokemon` in `normalize.ts`, the `StoredPokemon` type): moves filtered to `MOVE_VERSION_GROUPS` and cut to `[versionGroup, learnMethod, levelLearnedAt]` per detail. Probed size: moves 124 → 17 MB, the whole record 145 → ~38 MB. Every other field stays PokeAPI's.

- **A row is not a function of PokeAPI data alone.** `toTableRow` also reads committed static tables (`ENCOUNTER_LOCATIONS`, `EVOLUTION_STAGES`, `IS_FINAL_EVOLUTION_STAGE`, `EVOLUTION_STAGE_OVERRIDES`), which a regen changes without touching the code, plus every normalize function on the row path. A cached row stays correct only if someone bumps its version on each such change, and nothing would catch a missed bump: old rows would just keep showing.
- **The projection holds no normalize rule.** Dedupe, sort and the level-up filter still run on read (`normalizeMoves`), so changing them never strands old records. The only rule baked in is the version-group filter, which the cache already held before this change (the multi-gen recipe covers a generation's new groups).
- An old record (PokeAPI's move shape, trimmed or not) is rewritten on first read through the existing `migrate` step (`hasPokeApiMoves`), no refetch.

**Rejected:** the versioned row cache (above). Dropping `pokemonMemCache` after a load: saves memory but not the read time, and makes opening a detail screen a store read. Also trimming `sprites` (every game's sprite tree, 16 MB) and `game_indices` (2.5 MB): another ~18 MB, but a new image suffix would then need a refetch of every record; left until there is a reason.

**Reopen when** reading or deserializing the compact record still dominates a store-served load, or rows start needing data that is expensive to derive from the record on every load.
