import { describe, expect, it } from "vitest";
import { createFakeDataAdapter } from "./__fixtures__/fakes";
import { DiskCache } from "./Cache";

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
});
