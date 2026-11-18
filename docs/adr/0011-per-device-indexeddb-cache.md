# Per-device IndexedDB cache, not the plugin folder

The PokeAPI cache used to live in `{manifest.dir}/cache`, inside the vault's `.obsidian` folder, which syncs. In the live vault it had reached 845 MB, 428 MB of it iCloud conflict copies (`1 2.json`). A phone on that vault would download all of it before the plugin could use any of it, and two devices writing the same files kept producing more conflict copies.

**Decision:** each device keeps its own cache in IndexedDB (`IndexedDbCacheStore`, behind the `CacheStore` port), and nothing cache-related is written to the vault.

- **One database per vault per device**, named `pokedex-cache-<key>`. IndexedDB is keyed by origin, and every vault on a device is inferred to share one origin, so the name needs a per-vault part. `<key>` is a random id created once and kept in `app.saveLocalStorage`, which is vault-scoped, per-device and never synced. Clearing one vault's cache leaves the others alone.
- **Images are `ArrayBuffer` plus a MIME type, never `Blob` records.** WebKit has a history of bugs storing Blobs in IndexedDB. JSON is stored as values.
- **A missing or emptied database is a cold cache.** iOS may delete the origin's storage under pressure. The store reopens after the connection closes or the database is deleted, a read that fails is a miss, and a write that fails is skipped rather than failing the row being loaded. `navigator.storage.persist()` is requested, but nothing depends on its result.
- **The old folder is deleted once, not imported.** On startup (after layout) `legacyDiskCache.ts` removes `{manifest.dir}/cache` and the older id-keyed `plugins/<id>/cache` if either exists, conflict copies included, and shows a one-line notice. The folder's absence is the "done" flag, so there is no stored flag to drift, and a folder that sync brings back is deleted again. An import was rejected: it would race other devices deleting the same synced folder, and carry over stale JSON with untrimmed `moves`.
- `DiskCache` and its legacy-path migration are gone.

**Consequences:** every device fills its own cache from PokeAPI, so a new device's first load is a cold one. The store is untested by convention, like `PokeApiClient`: vitest has no IndexedDB. Repository behaviour is tested against `MemoryCacheStore`, and the store itself is checked live.

**Reopen when** a device's cold fill proves too slow or too heavy to accept (the spec's device checks, #18), or Obsidian ships a per-device, unsynced file location that plugins can write to.
