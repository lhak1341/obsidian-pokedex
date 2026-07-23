import type { App, DataAdapter, PluginManifest } from "obsidian";

const MIME_BY_EXT: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
};

function extOf(path: string): string {
	return path.split(".").pop()?.toLowerCase() ?? "png";
}

// 0x8000 bytes/call comfortably avoids blowing the engine's call-stack limit
// on String.fromCharCode's spread args (unlike a single call over the whole
// buffer), while still converting in large chunks instead of one
// function-call-plus-concat per byte — most noticeable on the official
// artwork/shiny images (detail view), which run tens of KB versus a sprite's
// few KB.
const BASE64_CHUNK_SIZE = 0x8000;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
		binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE));
	}
	return btoa(binary);
}

// Persists PokeAPI JSON + images under the plugin's own actual deployed
// folder (manifest.dir) inside .obsidian/plugins/<folder>/cache/ — hidden
// from the vault's note explorer and never written as vault files/notes.
export class DiskCache {
	private constructor(private adapter: DataAdapter, private cacheDir: string) {}

	// manifest.dir (not manifest.id) is load-bearing: a vault can deploy a
	// plugin under a folder name that differs from its manifest id (this
	// repo's own dev vault deploys to .obsidian/plugins/pokedex/ while
	// manifest.id stays "obsidian-pokedex" — see CLAUDE.md). Keying the cache
	// path off manifest.id instead used to leave the cache sitting in an
	// orphaned sibling folder the deployed plugin folder never contained —
	// invisible next to main.js/manifest.json, and never cleaned up if that
	// folder were ever deleted. Falls back to the old id-based path only if
	// manifest.dir is ever genuinely absent.
	static async forPlugin(app: App, manifest: PluginManifest): Promise<DiskCache> {
		const cacheDir = `${manifest.dir ?? `${app.vault.configDir}/plugins/${manifest.id}`}/cache`;
		const cache = new DiskCache(app.vault.adapter, cacheDir);
		await cache.migrateFromLegacyIdPath(app, manifest);
		return cache;
	}

	// One-time move for any install (like this repo's own dev vault) whose
	// cache was already written under the old configDir/plugins/{manifest.id}
	// path before forPlugin switched to manifest.dir. No-ops immediately once
	// the legacy directory is gone, or if this plugin's id and deployed
	// folder happen to already match.
	private async migrateFromLegacyIdPath(app: App, manifest: PluginManifest): Promise<void> {
		const legacyDir = `${app.vault.configDir}/plugins/${manifest.id}/cache`;
		if (legacyDir === this.cacheDir) return;
		if (await this.adapter.exists(this.cacheDir)) return;
		if (!(await this.adapter.exists(legacyDir))) return;
		await this.adapter.rename(legacyDir, this.cacheDir);
	}

	// Second adapter at the same seam: tests construct a DiskCache against a
	// fake DataAdapter instead of a real Obsidian App.
	static forTest(adapter: DataAdapter, cacheDir: string): DiskCache {
		return new DiskCache(adapter, cacheDir);
	}

	private resolve(relPath: string): string {
		return `${this.cacheDir}/${relPath}`;
	}

	private async ensureParentDir(fullPath: string): Promise<void> {
		const segments = fullPath.split("/").slice(0, -1);
		let current = "";
		for (const segment of segments) {
			current = current ? `${current}/${segment}` : segment;
			if (!(await this.adapter.exists(current))) {
				await this.adapter.mkdir(current);
			}
		}
	}

	async exists(relPath: string): Promise<boolean> {
		return this.adapter.exists(this.resolve(relPath));
	}

	// A cache hit is the hot path (every warm reload of the ~400-row table
	// hits this), so this reads directly and treats a rejected read as a
	// miss instead of paying a separate exists() round-trip up front for
	// every single file.
	async readJson<T>(relPath: string): Promise<T | null> {
		const path = this.resolve(relPath);
		try {
			return JSON.parse(await this.adapter.read(path)) as T;
		} catch {
			return null;
		}
	}

	async writeJson(relPath: string, data: unknown): Promise<void> {
		const path = this.resolve(relPath);
		await this.ensureParentDir(path);
		await this.adapter.write(path, JSON.stringify(data));
	}

	private dataUriFromBuffer(relPath: string, buffer: ArrayBuffer): string {
		const mime = MIME_BY_EXT[extOf(relPath)] ?? "image/png";
		return `data:${mime};base64,${arrayBufferToBase64(buffer)}`;
	}

	async readImageDataUri(relPath: string): Promise<string | null> {
		const path = this.resolve(relPath);
		try {
			const buffer = await this.adapter.readBinary(path);
			return this.dataUriFromBuffer(relPath, buffer);
		} catch {
			return null;
		}
	}

	// Returns the data URI for the buffer just written, encoded directly from
	// the in-memory buffer — avoids a redundant readBinary+base64 round-trip
	// against the file it just wrote (every caller needs the data URI right
	// after writing).
	async writeImageBinary(relPath: string, buffer: ArrayBuffer): Promise<string> {
		const path = this.resolve(relPath);
		await this.ensureParentDir(path);
		await this.adapter.writeBinary(path, buffer);
		return this.dataUriFromBuffer(relPath, buffer);
	}

	async clear(): Promise<void> {
		if (await this.adapter.exists(this.cacheDir)) {
			await this.adapter.rmdir(this.cacheDir, true);
		}
	}

	// Scoped counterpart to clear() — deletes one cached file (e.g. a single
	// generation's worth of pokemon/species/sprite entries for a settings
	// "Refresh" action) rather than the whole cache directory. Silently no-ops
	// on a file that was never cached, same as clear()'s own exists() guard.
	async remove(relPath: string): Promise<void> {
		const path = this.resolve(relPath);
		if (await this.adapter.exists(path)) {
			await this.adapter.remove(path);
		}
	}

	async getSizeBytes(): Promise<number> {
		if (!(await this.adapter.exists(this.cacheDir))) return 0;
		let total = 0;
		const walk = async (dir: string): Promise<void> => {
			const { files, folders } = await this.adapter.list(dir);
			for (const file of files) {
				const stat = await this.adapter.stat(file);
				total += stat?.size ?? 0;
			}
			for (const folder of folders) await walk(folder);
		};
		await walk(this.cacheDir);
		return total;
	}
}
