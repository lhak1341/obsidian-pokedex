import type { App, PluginManifest } from "obsidian";
import { describe, expect, it } from "vitest";
import { createFakeDataAdapter } from "./__fixtures__/fakes";
import { DiskCache } from "./Cache";

// Only what DiskCache.forPlugin actually reads off App — vault.configDir and
// vault.adapter — rather than a full fake App implementation.
function makeFakeApp(adapter: ReturnType<typeof createFakeDataAdapter>): App {
	return { vault: { configDir: ".obsidian", adapter } } as unknown as App;
}

function makeManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
	return {
		id: "obsidian-pokedex",
		name: "Pokedex",
		version: "1.0.0",
		minAppVersion: "1.0.0",
		author: "test",
		description: "test",
		...overrides,
	};
}

function makeCache() {
	return DiskCache.forTest(createFakeDataAdapter(), "plugins/obsidian-pokedex/cache");
}

describe("DiskCache", () => {
	it("round-trips JSON through nested paths, creating parent dirs as needed", async () => {
		const cache = makeCache();
		expect(await cache.readJson("pokemon/1.json")).toBeNull();

		await cache.writeJson("pokemon/1.json", { id: 1, name: "bulbasaur" });

		expect(await cache.exists("pokemon/1.json")).toBe(true);
		expect(await cache.readJson("pokemon/1.json")).toEqual({ id: 1, name: "bulbasaur" });
	});

	it("returns null instead of throwing when cached JSON is malformed", async () => {
		const adapter = createFakeDataAdapter();
		const cache = DiskCache.forTest(adapter, "cache");
		await adapter.mkdir("cache");
		await adapter.write("cache/pokemon/1.json", "{not valid json");

		expect(await cache.readJson("pokemon/1.json")).toBeNull();
	});

	it("round-trips images as data URIs, picking MIME type from the extension", async () => {
		const cache = makeCache();
		const buffer = new Uint8Array([1, 2, 3, 4]).buffer;

		expect(await cache.readImageDataUri("images/1-sprite.png")).toBeNull();

		await cache.writeImageBinary("images/1-sprite.png", buffer);
		const dataUri = await cache.readImageDataUri("images/1-sprite.png");

		expect(dataUri).toMatch(/^data:image\/png;base64,/);
	});

	it("round-trips an image spanning multiple base64 encode chunks byte-for-byte", async () => {
		// Larger than BASE64_CHUNK_SIZE (0x8000) so the chunked loop in
		// arrayBufferToBase64 has to stitch together more than one chunk —
		// exercises the boundary rather than the single-chunk case every other
		// test here uses.
		const bytes = new Uint8Array(0x8000 * 2 + 137);
		for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
		const cache = makeCache();

		await cache.writeImageBinary("images/1-artwork.png", bytes.buffer);
		const dataUri = await cache.readImageDataUri("images/1-artwork.png");

		const base64 = dataUri?.split(",")[1] ?? "";
		const decoded = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
		expect(decoded).toEqual(bytes);
	});

	it("picks jpeg MIME type for .jpg/.jpeg paths", async () => {
		const cache = makeCache();
		await cache.writeImageBinary("images/1-artwork.jpg", new ArrayBuffer(2));

		expect(await cache.readImageDataUri("images/1-artwork.jpg")).toMatch(/^data:image\/jpeg;base64,/);
	});

	it("clear() removes everything under the cache dir", async () => {
		const cache = makeCache();
		await cache.writeJson("pokemon/1.json", { id: 1 });
		await cache.writeJson("species/1.json", { id: 1 });

		await cache.clear();

		expect(await cache.exists("pokemon/1.json")).toBe(false);
		expect(await cache.exists("species/1.json")).toBe(false);
	});

	it("clear() on an empty cache is a no-op, not an error", async () => {
		const cache = makeCache();
		await expect(cache.clear()).resolves.toBeUndefined();
	});

	it("getSizeBytes() sums file sizes across nested folders", async () => {
		const cache = makeCache();
		expect(await cache.getSizeBytes()).toBe(0);

		await cache.writeJson("pokemon/1.json", { id: 1 });
		await cache.writeImageBinary("images/1-sprite.png", new ArrayBuffer(10));

		expect(await cache.getSizeBytes()).toBe(JSON.stringify({ id: 1 }).length + 10);
	});

	it("remove() deletes a single cached file, leaving the rest of the cache alone", async () => {
		const cache = makeCache();
		await cache.writeJson("pokemon/1.json", { id: 1 });
		await cache.writeJson("species/1.json", { id: 1 });

		await cache.remove("pokemon/1.json");

		expect(await cache.exists("pokemon/1.json")).toBe(false);
		expect(await cache.exists("species/1.json")).toBe(true);
	});

	it("remove() on a file that was never cached is a no-op, not an error", async () => {
		const cache = makeCache();
		await expect(cache.remove("pokemon/999.json")).resolves.toBeUndefined();
	});

	describe("forPlugin()", () => {
		it("derives the cache dir from manifest.dir, not manifest.id", async () => {
			const adapter = createFakeDataAdapter();
			const app = makeFakeApp(adapter);
			// The exact scenario this repo's own dev vault hits: deployed folder
			// name ("pokedex") differs from manifest.id ("obsidian-pokedex").
			const manifest = makeManifest({ id: "obsidian-pokedex", dir: ".obsidian/plugins/pokedex" });

			const cache = await DiskCache.forPlugin(app, manifest);
			await cache.writeJson("pokemon/1.json", { id: 1 });

			expect(await adapter.exists(".obsidian/plugins/pokedex/cache/pokemon/1.json")).toBe(true);
			expect(await adapter.exists(".obsidian/plugins/obsidian-pokedex/cache/pokemon/1.json")).toBe(false);
		});

		it("falls back to the id-based path when manifest.dir is absent", async () => {
			const adapter = createFakeDataAdapter();
			const app = makeFakeApp(adapter);
			const manifest = makeManifest({ id: "obsidian-pokedex", dir: undefined });

			const cache = await DiskCache.forPlugin(app, manifest);
			await cache.writeJson("pokemon/1.json", { id: 1 });

			expect(await adapter.exists(".obsidian/plugins/obsidian-pokedex/cache/pokemon/1.json")).toBe(true);
		});

		it("migrates an existing cache from the legacy id-based path to manifest.dir", async () => {
			const adapter = createFakeDataAdapter();
			const app = makeFakeApp(adapter);
			// Simulate a cache already written under the old id-based path (as
			// this repo's own dev vault had, before forPlugin switched to
			// manifest.dir) before the plugin ever runs with the new code.
			const legacyManifest = makeManifest({ id: "obsidian-pokedex", dir: undefined });
			const legacyCache = await DiskCache.forPlugin(app, legacyManifest);
			await legacyCache.writeJson("pokemon/1.json", { id: 1, name: "bulbasaur" });

			const manifest = makeManifest({ id: "obsidian-pokedex", dir: ".obsidian/plugins/pokedex" });
			const cache = await DiskCache.forPlugin(app, manifest);

			expect(await cache.readJson("pokemon/1.json")).toEqual({ id: 1, name: "bulbasaur" });
			expect(await adapter.exists(".obsidian/plugins/obsidian-pokedex/cache")).toBe(false);
		});

		it("does not migrate (or throw) when both the legacy and new cache dirs already have content", async () => {
			const adapter = createFakeDataAdapter();
			const app = makeFakeApp(adapter);
			const legacyManifest = makeManifest({ id: "obsidian-pokedex", dir: undefined });
			const legacyCache = await DiskCache.forPlugin(app, legacyManifest);
			await legacyCache.writeJson("pokemon/1.json", { id: "legacy" });

			const manifest = makeManifest({ id: "obsidian-pokedex", dir: ".obsidian/plugins/pokedex" });
			const newCache = await DiskCache.forPlugin(app, manifest);
			await newCache.writeJson("pokemon/1.json", { id: "current" });

			// Loading forPlugin again (e.g. a second onload) must not clobber the
			// already-current cache with the stale legacy one.
			const cache = await DiskCache.forPlugin(app, manifest);
			expect(await cache.readJson("pokemon/1.json")).toEqual({ id: "current" });
		});

		it("is a no-op when the deployed folder name already matches manifest.id", async () => {
			const adapter = createFakeDataAdapter();
			const app = makeFakeApp(adapter);
			const manifest = makeManifest({ id: "obsidian-pokedex", dir: ".obsidian/plugins/obsidian-pokedex" });

			const cache = await DiskCache.forPlugin(app, manifest);
			await cache.writeJson("pokemon/1.json", { id: 1 });

			expect(await adapter.exists(".obsidian/plugins/obsidian-pokedex/cache/pokemon/1.json")).toBe(true);
		});
	});
});
