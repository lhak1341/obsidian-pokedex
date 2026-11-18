import type { App } from "obsidian";
import type { CacheStore } from "./CacheStore";
import { mimeOf } from "./mime";

// The production CacheStore (ADR-0011): one IndexedDB database per vault per
// device, so nothing reaches the synced vault and iCloud never makes conflict
// copies. Untested by convention, like PokeApiClient (no IndexedDB under
// vitest); checked live in pokedex-test-vault.
//
// Every vault on a device shares one origin, so the database name carries a
// random per-vault key kept in app.saveLocalStorage (vault-scoped, per-device,
// never synced). A vault on another device gets its own key and database.
const DB_KEY_STORAGE = "pokedex-cache-key";
const DB_PREFIX = "pokedex-cache-";
const STORE = "entries";
const DB_VERSION = 1;

// Images are ArrayBuffer plus a MIME type, never Blob records: WebKit has
// long-standing bugs storing Blobs in IndexedDB. JSON is stored as the parsed
// value (structured clone), so a read never aliases what was written.
type Entry =
	| { kind: "json"; value: unknown }
	| { kind: "binary"; bytes: ArrayBuffer; mime: string };

// A flat key's "directory" as a key range: from `dir/` up to, not including,
// `dir0` ('0' is the character right after '/'). Nested keys are inside the
// range too, so listFilesIn also filters with isDirectChildKey.
export function directoryKeyBounds(dir: string): [lower: string, upperExclusive: string] {
	return [`${dir}/`, `${dir}0`];
}

export function isDirectChildKey(key: string, dir: string): boolean {
	const prefix = `${dir}/`;
	return key.startsWith(prefix) && !key.slice(prefix.length).includes("/");
}

function request<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
	});
}

export class IndexedDbCacheStore implements CacheStore {
	// Opened lazily and dropped whenever the connection goes away, so the next
	// call reopens (and, if the database was deleted, recreates it empty).
	private db: Promise<IDBDatabase> | null = null;

	private constructor(readonly name: string) {}

	static forVault(app: App): IndexedDbCacheStore {
		let key = app.loadLocalStorage(DB_KEY_STORAGE) as unknown;
		if (typeof key !== "string" || key === "") {
			key = crypto.randomUUID();
			app.saveLocalStorage(DB_KEY_STORAGE, key);
		}
		// Best effort: a persisted origin is less likely to be evicted on iOS,
		// but a missing database is only ever a cold cache, so nothing waits on
		// or reads the answer.
		void navigator.storage?.persist?.().catch(() => undefined);
		return new IndexedDbCacheStore(`${DB_PREFIX}${key as string}`);
	}

	private open(): Promise<IDBDatabase> {
		if (this.db) return this.db;
		const opening = new Promise<IDBDatabase>((resolve, reject) => {
			const req = indexedDB.open(this.name, DB_VERSION);
			req.onupgradeneeded = () => {
				if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
			};
			req.onsuccess = () => {
				const db = req.result;
				// Someone deleting the database (devtools, "Clear site data", iOS
				// storage pressure) fires versionchange on this open connection;
				// closing lets the delete go through instead of blocking it, and
				// the next call reopens a fresh, empty database: a cold cache.
				db.onversionchange = () => {
					db.close();
					if (this.db === opening) this.db = null;
				};
				db.onclose = () => {
					if (this.db === opening) this.db = null;
				};
				resolve(db);
			};
			// No onblocked reject: a blocked open still completes once the other
			// connection closes (ours close on versionchange), and rejecting here
			// would leave that later connection open and unused.
			req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
		});
		this.db = opening;
		opening.catch(() => {
			if (this.db === opening) this.db = null;
		});
		return opening;
	}

	// One transaction per call. A connection that closed underneath us
	// (InvalidStateError from transaction()) is reopened once and retried.
	// A readwrite call resolves only once its transaction commits.
	private async run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
		for (let attempt = 0; ; attempt++) {
			const opening = this.open();
			const db = await opening;
			let tx: IDBTransaction;
			try {
				tx = db.transaction(STORE, mode);
			} catch (err) {
				// Only drop the connection this call used; another call may
				// already have started a fresh open.
				if (this.db === opening) this.db = null;
				if (attempt === 0) continue;
				throw err;
			}
			const done = new Promise<void>((resolve, reject) => {
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
				tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
			});
			const [result] = await Promise.all([request(fn(tx.objectStore(STORE))), done]);
			return result;
		}
	}

	// A write that fails (quota, or the database deleted mid-transaction) is a
	// cache that didn't fill: the next read misses and refetches. Rejecting
	// would fail the row the repository is loading, over a cache it can do
	// without.
	private async put(key: string, entry: Entry): Promise<void> {
		try {
			await this.run("readwrite", (s) => s.put(entry, key));
		} catch {
			// best effort, see above
		}
	}

	// Port contract: a miss or an unreadable entry is null, never a throw.
	private async get(key: string): Promise<Entry | null> {
		try {
			return ((await this.run("readonly", (s) => s.get(key))) as Entry | undefined) ?? null;
		} catch {
			return null;
		}
	}

	async readJson<T>(key: string): Promise<T | null> {
		const entry = await this.get(key);
		return entry?.kind === "json" ? (entry.value as T) : null;
	}

	async writeJson(key: string, data: unknown): Promise<void> {
		await this.put(key, { kind: "json", value: data });
	}

	async readBinary(key: string): Promise<ArrayBuffer | null> {
		const entry = await this.get(key);
		return entry?.kind === "binary" ? entry.bytes : null;
	}

	async writeBinary(key: string, buffer: ArrayBuffer): Promise<void> {
		await this.put(key, { kind: "binary", bytes: buffer, mime: mimeOf(key) });
	}

	async exists(key: string): Promise<boolean> {
		try {
			return (await this.run("readonly", (s) => s.count(key))) > 0;
		} catch {
			return false;
		}
	}

	async remove(key: string): Promise<void> {
		await this.run("readwrite", (s) => s.delete(key));
	}

	// Keys are flat strings, so a "directory" is a key range (see
	// directoryKeyBounds) minus nested keys.
	async listFilesIn(dir: string): Promise<string[]> {
		const [lower, upper] = directoryKeyBounds(dir);
		const keys = await this.run("readonly", (s) => s.getAllKeys(IDBKeyRange.bound(lower, upper, false, true)));
		return keys.filter((k): k is string => typeof k === "string" && isDirectChildKey(k, dir));
	}

	async clear(): Promise<void> {
		await this.run("readwrite", (s) => s.clear());
	}

	// For the settings tab's "Cached data" line: image bytes plus the JSON's
	// serialized length, close to what the old disk folder reported. Walks a
	// cursor rather than getAll(), which would hold the whole cache (~150 MB
	// for a full dex, measured live) in memory at once just to add up sizes.
	async getSizeBytes(): Promise<number> {
		const db = await this.open();
		return new Promise((resolve, reject) => {
			let total = 0;
			const req = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
			req.onsuccess = () => {
				const cursor = req.result;
				if (!cursor) return resolve(total);
				const entry = cursor.value as Entry;
				total += entry.kind === "binary" ? entry.bytes.byteLength : (JSON.stringify(entry.value)?.length ?? 0);
				cursor.continue();
			};
			req.onerror = () => reject(req.error ?? new Error("IndexedDB cursor failed"));
		});
	}
}
