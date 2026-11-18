// The persistence port PokedexRepository reads and writes through — only the
// operations it uses today, so a second store (IndexedDB on mobile, a bounded
// image LRU) is a drop-in rather than a repository change. Keys are the
// relative cache paths cachePaths.ts builds (`pokemon/1.json`,
// `images/1-sprite.png`); a store never interprets them beyond that.
//
// DiskCache (production) implements it; MemoryCacheStore
// (src/data/__fixtures__/fakes.ts) is the test store.
export interface CacheStore {
	// null for a missing or unreadable entry — a miss, never a throw.
	readJson<T>(key: string): Promise<T | null>;
	writeJson(key: string, data: unknown): Promise<void>;
	// Raw bytes; null for a miss. Display encoding (data URI today) is the
	// caller's, so a store never needs to know how an image is shown.
	readBinary(key: string): Promise<ArrayBuffer | null>;
	writeBinary(key: string, buffer: ArrayBuffer): Promise<void>;
	exists(key: string): Promise<boolean>;
	// No-op for a key that was never written.
	remove(key: string): Promise<void>;
	// Entries directly inside one flat directory (`"species"`). Each entry ends
	// with its key; a store may prefix it (DiskCache returns full vault
	// paths), so callers parse only the trailing file name.
	listFilesIn(dir: string): Promise<string[]>;
	// Every entry. PokedexRepository.clearAll() is the only caller that should
	// reach this — it also drops the mem caches (see src/data/CLAUDE.md).
	clear(): Promise<void>;
}
