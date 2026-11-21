import { describe, expect, it } from "vitest";
import { makeRow } from "../data/__fixtures__/rows";
import type { PokedexTableRow } from "../data/types";
import { scopeRowsToActiveGen, scopeToActiveGen } from "./activeGenScope";
import { FIELDS } from "./fields";
import { EMPTY_FILTERS, filterPokemon } from "./filterPokemon";
import { sortPokemon } from "./sortPokemon";

const encountersAt = (locations: PokedexTableRow["encounterLocationsAllGens"], activeGen: number) =>
	scopeToActiveGen(makeRow({ encounterLocationsAllGens: locations }), activeGen).encounterLocations;

const heldItemsAt = (heldItemsAllGens: PokedexTableRow["heldItemsAllGens"], activeGen: number) =>
	scopeToActiveGen(makeRow({ heldItemsAllGens }), activeGen).heldItems;

describe("scopeToActiveGen: stats", () => {
	// Pikachu (#25): current defense 40 / specialDefense 50, pre-Gen 6 was 30 / 40.
	const pikachu = makeRow({
		id: 25,
		name: "pikachu",
		stats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
	});
	const bulbasaur = makeRow({
		id: 1,
		name: "bulbasaur",
		stats: { hp: 45, attack: 49, defense: 35, specialAttack: 65, specialDefense: 65, speed: 45 },
	});
	const rows = [pikachu, bulbasaur];

	it("overlays pre-buff stats when the Active Gen predates the buff", () => {
		const scoped = scopeToActiveGen(pikachu, 3);
		expect(scoped.stats.defense).toBe(30);
		expect(scoped.stats.specialDefense).toBe(40);
	});

	it("keeps the latest-game stats once the Active Gen reaches the buff generation", () => {
		expect(scopeToActiveGen(pikachu, 6).stats).toEqual(pikachu.stats);
		expect(scopeToActiveGen(bulbasaur, 3).stats).toEqual(bulbasaur.stats);
	});

	it("does not mutate the input row", () => {
		scopeToActiveGen(pikachu, 3);
		expect(pikachu.stats.defense).toBe(40);
	});

	it("feeds the table's columns, Total, sort and stat-range filter the same scoped stats", () => {
		const gen3 = scopeRowsToActiveGen(rows, 3);
		const gen6 = scopeRowsToActiveGen(rows, 6);
		const renderOf = (key: string, row: (typeof gen3)[number]): string => {
			const field = FIELDS.find((f) => f.key === key);
			if (!field || field.custom) throw new Error(`no text Field "${key}"`);
			return field.render(row);
		};
		expect(renderOf("defense", gen3[0])).toBe("30");
		expect(renderOf("total", gen3[0])).toBe("300");

		// Pikachu Def 30 < Bulbasaur 35 at Gen 3; at Gen 6 (40) it sorts after.
		expect(sortPokemon(gen3, "defense", "asc").map((r) => r.name)).toEqual(["pikachu", "bulbasaur"]);
		expect(sortPokemon(gen6, "defense", "asc").map((r) => r.name)).toEqual(["bulbasaur", "pikachu"]);

		const filters = { ...EMPTY_FILTERS, statRanges: { defense: { min: 35, max: 255 } } };
		expect(filterPokemon(gen6, filters).map((r) => r.name)).toEqual(["pikachu", "bulbasaur"]);
		expect(filterPokemon(gen3, filters).map((r) => r.name)).toEqual(["bulbasaur"]);
	});
});

describe("scopeToActiveGen: held items", () => {
	it("keeps only rarities from the Active Gen", () => {
		const items = [{ name: "oran-berry", rarities: [{ value: 50, generationId: 3 }, { value: 30, generationId: 4 }] }];
		expect(heldItemsAt(items, 3)).toEqual([{ name: "oran-berry", rarities: [50] }]);
		expect(heldItemsAt(items, 4)).toEqual([{ name: "oran-berry", rarities: [30] }]);
	});

	it("drops an item entirely when it has no rarity in the Active Gen", () => {
		// Absorb Bulb: Diamond/Pearl only (Gen 4) — should disappear at Active Gen 3.
		expect(heldItemsAt([{ name: "absorb-bulb", rarities: [{ value: 5, generationId: 4 }] }], 3)).toEqual([]);
	});

	it("returns an empty list for a species with no held items", () => {
		expect(heldItemsAt([], 3)).toEqual([]);
	});
});

describe("scopeToActiveGen: encounter locations", () => {
	it("keeps only locations from the Active Gen, sorted, carrying their region and method", () => {
		const locations = [
			{ name: "viridian-forest-area", generationId: 1, region: "kanto", method: null, tradeFor: null },
			{ name: "route-1-area", generationId: 1, region: "kanto", method: null, tradeFor: null },
			{ name: "kanto-route-1-area", generationId: 7, region: "kanto", method: null, tradeFor: null },
		];
		expect(encountersAt(locations, 1)).toEqual([
			{ name: "route-1-area", region: "kanto", method: null, tradeFor: null },
			{ name: "viridian-forest-area", region: "kanto", method: null, tradeFor: null },
		]);
		expect(encountersAt(locations, 7)).toEqual([{ name: "kanto-route-1-area", region: "kanto", method: null, tradeFor: null }]);
	});

	it("carries method/tradeFor through for an NPC-trade spot (Jynx: trade a Poliwhirl in Cerulean City)", () => {
		const locations = [
			{ name: "cerulean-city-area", generationId: 3, region: "kanto", method: "trade" as const, tradeFor: "poliwhirl" },
		];
		expect(encountersAt(locations, 3))
			.toEqual([{ name: "cerulean-city-area", region: "kanto", method: "trade", tradeFor: "poliwhirl" }]);
	});

	it("carries method through for a gift/egg spot", () => {
		const locations = [{ name: "pallet-town-area", generationId: 3, region: "kanto", method: "gift" as const, tradeFor: null }];
		expect(encountersAt(locations, 3)).toEqual([{ name: "pallet-town-area", region: "kanto", method: "gift", tradeFor: null }]);
	});

	it("dedupes a location repeated across multiple games of the same generation", () => {
		const locations = [
			{ name: "route-1-area", generationId: 1, region: "kanto", method: null, tradeFor: null },
			{ name: "route-1-area", generationId: 1, region: "kanto", method: null, tradeFor: null },
		];
		expect(encountersAt(locations, 1)).toEqual([{ name: "route-1-area", region: "kanto", method: null, tradeFor: null }]);
	});

	it("returns an empty list for a generation with no encounters", () => {
		expect(encountersAt([{ name: "route-1-area", generationId: 1, region: "kanto", method: null, tradeFor: null }], 3))
			.toEqual([]);
		expect(encountersAt([], 1)).toEqual([]);
	});
});

describe("scopeToActiveGen: the scoped row", () => {
	it("carries no every-generation field, so nothing downstream can read one", () => {
		const scoped = scopeToActiveGen(makeRow({ heldItemsAllGens: [], encounterLocationsAllGens: [] }), 3);
		expect(Object.keys(scoped)).not.toContain("heldItemsAllGens");
		expect(Object.keys(scoped)).not.toContain("encounterLocationsAllGens");
	});

	// The table rescopes every row on each streamed update and draws every row
	// (ADR-0014): a new object per row per update would re-render them all.
	it("returns the identical object for the same row at the same Active Gen", () => {
		const row = makeRow({ id: 25 });
		const first = scopeToActiveGen(row, 3);
		expect(scopeToActiveGen(row, 3)).toBe(first);
		expect(scopeRowsToActiveGen([row], 3)[0]).toBe(first);
	});

	it("rescopes when the Active Gen changes or the row object is replaced", () => {
		const row = makeRow({ id: 25 });
		const gen3 = scopeToActiveGen(row, 3);
		const gen6 = scopeToActiveGen(row, 6);
		expect(gen6).not.toBe(gen3);
		expect(gen6.stats).toBe(row.stats);
		expect(scopeToActiveGen(row, 3)).not.toBe(gen6);
		expect(scopeToActiveGen({ ...row }, 3)).not.toBe(scopeToActiveGen(row, 3));
	});
});
