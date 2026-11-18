// The persistence port PokedexRepository reads and writes through — only the
// operations it uses, so swapping the store (the disk folder became IndexedDB
// in ADR-0011) is not a repository change. Keys are the
// relative cache paths cachePaths.ts builds (`pokemon/1.json`,
// `images/1-sprite.png`); a store never interprets them beyond that.
//
// IndexedDbCacheStore (production, ADR-0011) implements it; MemoryCacheStore
// (src/data/__fixtures__/fakes.ts) is the test store.
export interface CacheStore {
	// null for a missing or unreadable entry — a miss, never a throw.
	readJson<T>(key: string): Promise<T | null>;
	writeJson(key: string, data: unknown): Promise<void>;
	// Raw bytes; null for a miss. How an image is shown (a blob URL, made by
	// the repository's ImageMemory) is the caller's business, not the store's.
	readBinary(key: string): Promise<ArrayBuffer | null>;
	writeBinary(key: string, buffer: ArrayBuffer): Promise<void>;
	exists(key: string): Promise<boolean>;
	// No-op for a key that was never written.
	remove(key: string): Promise<void>;
	// Entries directly inside one flat directory (`"species"`). Each entry ends
	// with its key; a store may prefix it (the old disk store returned full
	// vault paths), so callers parse only the trailing file name.
	listFilesIn(dir: string): Promise<string[]>;
	// Every entry. PokedexRepository.clearAll() is the only caller that should
	// reach this — it also drops the mem caches (see src/data/CLAUDE.md).
	clear(): Promise<void>;
}
