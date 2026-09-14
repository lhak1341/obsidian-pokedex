import { describe, expect, it } from "vitest";
import { filterEncounterLocationsForGen } from "./encounterGen";

describe("filterEncounterLocationsForGen", () => {
	it("keeps only locations from the active generation, sorted, carrying their region and method", () => {
		const locations = [
			{ name: "route-1-area", generationId: 1, region: "kanto", method: null, tradeFor: null },
			{ name: "viridian-forest-area", generationId: 1, region: "kanto", method: null, tradeFor: null },
			{ name: "kanto-route-1-area", generationId: 7, region: "kanto", method: null, tradeFor: null },
		];
		expect(filterEncounterLocationsForGen(locations, 1)).toEqual([
			{ name: "route-1-area", region: "kanto", method: null, tradeFor: null },
			{ name: "viridian-forest-area", region: "kanto", method: null, tradeFor: null },
		]);
		expect(filterEncounterLocationsForGen(locations, 7))
			.toEqual([{ name: "kanto-route-1-area", region: "kanto", method: null, tradeFor: null }]);
	});

	it("carries method/tradeFor through for an NPC-trade spot (Jynx: trade a Poliwhirl in Cerulean City)", () => {
		const locations = [
			{ name: "cerulean-city-area", generationId: 3, region: "kanto", method: "trade" as const, tradeFor: "poliwhirl" },
		];
		expect(filterEncounterLocationsForGen(locations, 3))
			.toEqual([{ name: "cerulean-city-area", region: "kanto", method: "trade", tradeFor: "poliwhirl" }]);
	});

	it("carries method through for a gift/egg spot", () => {
		const locations = [
			{ name: "pallet-town-area", generationId: 3, region: "kanto", method: "gift" as const, tradeFor: null },
		];
		expect(filterEncounterLocationsForGen(locations, 3))
			.toEqual([{ name: "pallet-town-area", region: "kanto", method: "gift", tradeFor: null }]);
	});

	it("dedupes a location repeated across multiple games of the same generation", () => {
		const locations = [
			{ name: "route-1-area", generationId: 1, region: "kanto", method: null, tradeFor: null },
			{ name: "route-1-area", generationId: 1, region: "kanto", method: null, tradeFor: null },
		];
		expect(filterEncounterLocationsForGen(locations, 1))
			.toEqual([{ name: "route-1-area", region: "kanto", method: null, tradeFor: null }]);
	});

	it("returns an empty list for a generation with no wild encounters", () => {
		expect(filterEncounterLocationsForGen(
			[{ name: "route-1-area", generationId: 1, region: "kanto", method: null, tradeFor: null }],
			3,
		)).toEqual([]);
		expect(filterEncounterLocationsForGen([], 1)).toEqual([]);
	});
});
