import { describe, expect, it } from "vitest";
import { createFakeDataAdapter } from "./__fixtures__/fakes";
import { deleteLegacyDiskCache, legacyDiskCacheDirs } from "./legacyDiskCache";

describe("legacyDiskCacheDirs()", () => {
	it("names the deployed folder's cache and the old id-keyed one", () => {
		expect(legacyDiskCacheDirs(".obsidian", { id: "obsidian-pokedex", dir: ".obsidian/plugins/pokedex" })).toEqual([
			".obsidian/plugins/pokedex/cache",
			".obsidian/plugins/obsidian-pokedex/cache",
		]);
	});

	it("names one folder when the deployed folder matches the id", () => {
		expect(
			legacyDiskCacheDirs(".obsidian", { id: "obsidian-pokedex", dir: ".obsidian/plugins/obsidian-pokedex" }),
		).toEqual([".obsidian/plugins/obsidian-pokedex/cache"]);
	});

	it("falls back to the id-keyed folder when manifest.dir is absent", () => {
		expect(legacyDiskCacheDirs(".obsidian", { id: "obsidian-pokedex" })).toEqual([
			".obsidian/plugins/obsidian-pokedex/cache",
		]);
	});
});

describe("deleteLegacyDiskCache()", () => {
	it("deletes the whole folder, iCloud conflict copies included, and reports it", async () => {
		const adapter = createFakeDataAdapter();
		await adapter.mkdir("plugins/pokedex/cache");
		await adapter.mkdir("plugins/pokedex/cache/pokemon");
		await adapter.write("plugins/pokedex/cache/pokemon/1.json", "{}");
		await adapter.write("plugins/pokedex/cache/pokemon/1 2.json", "{}");
		await adapter.write("plugins/pokedex/main.js", "code");

		expect(await deleteLegacyDiskCache(adapter, ["plugins/pokedex/cache"])).toBe(true);

		expect(await adapter.exists("plugins/pokedex/cache")).toBe(false);
		expect(await adapter.exists("plugins/pokedex/cache/pokemon/1.json")).toBe(false);
		expect(await adapter.exists("plugins/pokedex/cache/pokemon/1 2.json")).toBe(false);
		expect(await adapter.exists("plugins/pokedex/main.js")).toBe(true);
	});

	// The notice keys off this result, so a second run must report nothing.
	it("reports nothing on the next run, once the folder is gone", async () => {
		const adapter = createFakeDataAdapter();
		await adapter.mkdir("plugins/pokedex/cache");
		await deleteLegacyDiskCache(adapter, ["plugins/pokedex/cache"]);

		expect(await deleteLegacyDiskCache(adapter, ["plugins/pokedex/cache"])).toBe(false);
	});

	it("deletes every listed folder that exists", async () => {
		const adapter = createFakeDataAdapter();
		await adapter.mkdir("plugins/obsidian-pokedex/cache");
		await adapter.write("plugins/obsidian-pokedex/cache/x.json", "{}");

		expect(
			await deleteLegacyDiskCache(adapter, ["plugins/pokedex/cache", "plugins/obsidian-pokedex/cache"]),
		).toBe(true);
		expect(await adapter.exists("plugins/obsidian-pokedex/cache")).toBe(false);
	});
});
