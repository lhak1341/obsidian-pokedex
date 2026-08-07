import { describe, expect, it } from "vitest";
import { describeGenerationAction, describeGenerationStatus } from "./generationCacheDescription";

describe("describeGenerationAction", () => {
	it("shows a download icon/tooltip for cache", () => {
		expect(describeGenerationAction("cache")).toEqual({
			icon: "download",
			tooltip: "Prefetch this generation so browsing it is instant",
		});
	});

	it("shows a refresh icon/tooltip for refresh", () => {
		expect(describeGenerationAction("refresh")).toEqual({
			icon: "refresh-cw",
			tooltip: "Re-fetch this generation from PokeAPI, bypassing the cache",
		});
	});
});

describe("describeGenerationStatus", () => {
	it("shows just the base description before any status has loaded", () => {
		expect(describeGenerationStatus("National dex #1-151.", null, null)).toBe("National dex #1-151.");
	});

	it("appends cached/total once status has loaded", () => {
		expect(describeGenerationStatus("National dex #1-151.", { cached: 42, total: 151 }, null)).toBe(
			"National dex #1-151. 42/151 cached.",
		);
	});

	it("shows Caching progress when running is cache", () => {
		expect(
			describeGenerationStatus("National dex #1-151.", { cached: 42, total: 151 }, { kind: "cache", loaded: 10, total: 151 }),
		).toBe("National dex #1-151. Caching... 10/151.");
	});

	it("shows Refreshing progress when running is refresh", () => {
		expect(
			describeGenerationStatus(
				"National dex #1-151.",
				{ cached: 151, total: 151 },
				{ kind: "refresh", loaded: 80, total: 151 },
			),
		).toBe("National dex #1-151. Refreshing... 80/151.");
	});
});
