import { describe, expect, it } from "vitest";
import type { PokedexTableRow } from "../data/types";
import { EMPTY_FILTERS, filterPokemon } from "./filterPokemon";

function row(overrides: Partial<PokedexTableRow>): PokedexTableRow {
	return {
		id: 1,
		name: "bulbasaur",
		types: ["grass", "poison"],
		stats: { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 },
		evYield: [],
		abilityNames: ["overgrow", "chlorophyll"],
		levelUpMoveNames: [],
		heldItemNames: [],
		spriteDataUri: null,
		height: 7,
		weight: 69,
		catchRate: 45,
		hatchCounter: 20,
		rarity: "normal",
		...overrides,
	};
}

const rows: PokedexTableRow[] = [
	row({ id: 1, name: "bulbasaur", types: ["grass", "poison"], abilityNames: ["overgrow"] }),
	row({ id: 4, name: "charmander", types: ["fire"], abilityNames: ["blaze"], stats: { hp: 39, attack: 52, defense: 43, specialAttack: 60, specialDefense: 50, speed: 65 } }),
	row({ id: 6, name: "charizard", types: ["fire", "flying"], abilityNames: ["blaze"], stats: { hp: 78, attack: 84, defense: 78, specialAttack: 109, specialDefense: 85, speed: 100 } }),
	row({ id: 152, name: "chikorita", types: ["grass"], abilityNames: ["overgrow"] }),
	row({ id: 144, name: "articuno", types: ["ice", "flying"], abilityNames: ["pressure"], rarity: "legendary" }),
	row({ id: 151, name: "mew", types: ["psychic"], abilityNames: ["synchronize"], rarity: "mythical" }),
];

describe("filterPokemon", () => {
	it("returns all rows when filters are empty", () => {
		expect(filterPokemon(rows, EMPTY_FILTERS)).toHaveLength(6);
	});

	it("matches search by name substring", () => {
		const result = filterPokemon(rows, { ...EMPTY_FILTERS, search: "char" });
		expect(result.map((r) => r.name)).toEqual(["charmander", "charizard"]);
	});

	it("matches search by exact dex number", () => {
		const result = filterPokemon(rows, { ...EMPTY_FILTERS, search: "6" });
		expect(result.map((r) => r.name)).toEqual(["charizard"]);
	});

	it("requires ALL selected types to be present (dual-type search)", () => {
		const result = filterPokemon(rows, { ...EMPTY_FILTERS, types: ["fire", "flying"] });
		expect(result.map((r) => r.name)).toEqual(["charizard"]);
	});

	it("filters by generation range", () => {
		const result = filterPokemon(rows, { ...EMPTY_FILTERS, generations: [2] });
		expect(result.map((r) => r.name)).toEqual(["chikorita"]);
	});

	it("filters by inclusive stat range", () => {
		const result = filterPokemon(rows, {
			...EMPTY_FILTERS,
			statRanges: { speed: { min: 90, max: 255 } },
		});
		expect(result.map((r) => r.name)).toEqual(["charizard"]);
	});

	it("matches ANY selected ability", () => {
		const result = filterPokemon(rows, { ...EMPTY_FILTERS, abilities: ["blaze"] });
		expect(result.map((r) => r.name)).toEqual(["charmander", "charizard"]);
	});

	it("matches ANY selected rarity", () => {
		const result = filterPokemon(rows, { ...EMPTY_FILTERS, rarities: ["legendary", "mythical"] });
		expect(result.map((r) => r.name)).toEqual(["articuno", "mew"]);
	});

	it("matches ANY selected EV yield stat, regardless of amount or co-yielded stats", () => {
		const evRows: PokedexTableRow[] = [
			row({ id: 1, name: "bulbasaur", evYield: [{ stat: "specialAttack", amount: 1 }] }),
			row({ id: 2, name: "ivysaur", evYield: [{ stat: "specialAttack", amount: 1 }, { stat: "specialDefense", amount: 1 }] }),
			row({ id: 4, name: "charmander", evYield: [{ stat: "speed", amount: 1 }] }),
			row({ id: 7, name: "squirtle", evYield: [] }),
		];

		const result = filterPokemon(evRows, { ...EMPTY_FILTERS, evStats: ["specialAttack"] });

		expect(result.map((r) => r.name)).toEqual(["bulbasaur", "ivysaur"]);
	});

	it("matches ANY selected quirk, across id/ability/move-based checks alike", () => {
		const quirkRows: PokedexTableRow[] = [
			row({ id: 138, name: "omanyte" }),
			row({ id: 1, name: "bulbasaur", abilityNames: ["overgrow"] }),
			row({ id: 190, name: "aipom", abilityNames: ["pickup"] }),
			row({ id: 302, name: "sableye", levelUpMoveNames: ["covet"] }),
			row({ id: 7, name: "squirtle", abilityNames: ["torrent"], levelUpMoveNames: [] }),
		];

		const result = filterPokemon(quirkRows, { ...EMPTY_FILTERS, quirks: ["fossil", "pickup", "covet"] });

		expect(result.map((r) => r.name)).toEqual(["omanyte", "aipom", "sableye"]);
	});

	it("combines multiple filter axes with AND", () => {
		const result = filterPokemon(rows, {
			...EMPTY_FILTERS,
			types: ["fire"],
			statRanges: { hp: { min: 50, max: 255 } },
		});
		expect(result.map((r) => r.name)).toEqual(["charizard"]);
	});
});
