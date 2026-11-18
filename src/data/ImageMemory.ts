import { mimeOf } from "./mime";

// URL.createObjectURL/revokeObjectURL, injected so repository tests can record
// each call as it happens (RecordingObjectUrls in __fixtures__/fakes.ts).
export interface ObjectUrls {
	create(blob: Blob): string;
	revoke(url: string): void;
}

export const browserObjectUrls: ObjectUrls = {
	create: (blob) => URL.createObjectURL(blob),
	revoke: (url) => URL.revokeObjectURL(url),
};

// Bytes of budgeted images held at once. Official artwork runs ~50-200 KB per
// PNG, so this keeps a few dozen detail screens' worth (3 budgeted images
// each). Unmeasured on a phone yet: #18's device check 3 settles it.
export const IMAGE_MEMORY_BUDGET_BYTES = 16 * 1024 * 1024;

interface Held {
	url: string;
	bytes: number;
	budgeted: boolean;
}

// The session's in-memory images, as blob URLs over the bytes a CacheStore
// returned. Keyed by cache path (`images/25-artwork.png`).
//
// A budgeted image sits in an LRU bounded in bytes: making room evicts the
// least recently used one and revokes its URL there and then. A resident one
// (`budgeted: false`) is never evicted to make room, only by delete/clear —
// the repository's call, since a revoked URL never loads again in a new <img>
// (probed in Obsidian), so a URL a long-lived view keeps must stay resident.
export class ImageMemory {
	// Map order is recency: oldest first. get() moves a hit to the end.
	private held = new Map<string, Held>();
	private pathByUrl = new Map<string, string>();
	private budgetedBytes = 0;

	constructor(
		private urls: ObjectUrls,
		private budgetBytes: number,
	) {}

	get(path: string): string | undefined {
		const entry = this.held.get(path);
		if (!entry) return undefined;
		this.held.delete(path);
		this.held.set(path, entry);
		return entry.url;
	}

	has(path: string): boolean {
		return this.held.has(path);
	}

	// Returns the URL to show. A path already held keeps its URL, since a
	// caller may already be displaying it. Room is made before the new URL is
	// created, so the budget holds at every moment, not just between calls. A
	// single image larger than the whole budget is still held (alone), since
	// the caller is about to show it.
	put(path: string, buffer: ArrayBuffer, budgeted: boolean): string {
		const existing = this.get(path);
		if (existing) return existing;
		const bytes = buffer.byteLength;
		if (budgeted) this.makeRoom(bytes);
		const url = this.urls.create(new Blob([buffer], { type: mimeOf(path) }));
		this.held.set(path, { url, bytes, budgeted });
		this.pathByUrl.set(url, path);
		if (budgeted) this.budgetedBytes += bytes;
		return url;
	}

	private makeRoom(incoming: number): void {
		for (const [path, entry] of this.held) {
			if (this.budgetedBytes + incoming <= this.budgetBytes) return;
			if (entry.budgeted) this.delete(path);
		}
	}

	delete(path: string): void {
		const entry = this.held.get(path);
		if (!entry) return;
		this.held.delete(path);
		this.pathByUrl.delete(entry.url);
		if (entry.budgeted) this.budgetedBytes -= entry.bytes;
		this.urls.revoke(entry.url);
	}

	clear(): void {
		for (const path of [...this.held.keys()]) this.delete(path);
	}

	// The cache path behind a URL this memory handed out, while it is held.
	pathOf(url: string): string | null {
		return this.pathByUrl.get(url) ?? null;
	}
}
