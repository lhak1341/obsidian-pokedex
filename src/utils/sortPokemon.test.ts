import { describe, expect, it } from "vitest";
import { resolveGenerationId } from "../data/constants";
import type { PokedexTableRow } from "../data/types";
import { sortPokemon } from "./sortPokemon";

function row(id: number, name: string, speed: number, overrides: Partial<PokedexTableRow> = {}): PokedexTableRow {
	const dexNumber = overrides.dexNumber ?? id;
	return {
		id,
		dexNumber,
		formLabel: null,
		generationId: resolveGenerationId(dexNumber),
		name,
		types: [],
		stats: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed },
		evYield: [],
		abilityNames: [],
		levelUpMoveNames: [],
		heldItemNames: [],
		spriteDataUri: null,
		height: 0,
		weight: 0,
		catchRate: 0,
		hatchCounter: 0,
		rarity: "normal",
		isBaby: false,
		canMegaEvolve: false,
		canGigantamax: false,
		evolutionStages: 0,
		...overrides,
	};
}

const rows = [row(3, "venusaur", 80), row(1, "bulbasaur", 45), row(2, "ivysaur", 60)];

describe("sortPokemon", () => {
	it("sorts by dex number ascending", () => {
		expect(sortPokemon(rows, "id", "asc").map((r) => r.id)).toEqual([1, 2, 3]);
	});

	it("sorts by name descending", () => {
		expect(sortPokemon(rows, "name", "desc").map((r) => r.name)).toEqual([
			"venusaur", "ivysaur", "bulbasaur",
		]);
	});

	it("sorts by a stat column", () => {
		expect(sortPokemon(rows, "speed", "asc").map((r) => r.id)).toEqual([1, 2, 3]);
	});

	it("sorts by total stat", () => {
		const totalRows = [
			row(1, "low", 0, { stats: { hp: 10, attack: 10, defense: 10, specialAttack: 10, specialDefense: 10, speed: 10 } }),
			row(2, "high", 0, { stats: { hp: 50, attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 } }),
		];
		expect(sortPokemon(totalRows, "total", "desc").map((r) => r.id)).toEqual([2, 1]);
	});

	it("sorts by species-level fields (catch rate, hatch counter, height, weight)", () => {
		const speciesRows = [
			row(1, "a", 0, { catchRate: 200, hatchCounter: 5, height: 3, weight: 10 }),
			row(2, "b", 0, { catchRate: 45, hatchCounter: 20, height: 17, weight: 905 }),
		];
		expect(sortPokemon(speciesRows, "catchRate", "asc").map((r) => r.id)).toEqual([2, 1]);
		expect(sortPokemon(speciesRows, "hatchCounter", "asc").map((r) => r.id)).toEqual([1, 2]);
		expect(sortPokemon(speciesRows, "height", "asc").map((r) => r.id)).toEqual([1, 2]);
		expect(sortPokemon(speciesRows, "weight", "asc").map((r) => r.id)).toEqual([1, 2]);
	});

	it("does not mutate the input array", () => {
		const original = [...rows];
		sortPokemon(rows, "name", "desc");
		expect(rows).toEqual(original);
	});

	it("groups a regional-form row with its base species when sorting by dex number, in either direction", () => {
		// Alolan Rattata (fetch id 10091) shares dexNumber 19 with base Rattata
		// (fetch id 19) — the base row's own lower numeric id should still put
		// it first within that tied pair, regardless of asc/desc.
		const regionalRows = [
			row(6, "charizard", 100),
			row(10091, "rattata", 72, { dexNumber: 19, formLabel: "Alolan" }),
			row(19, "rattata", 56, { dexNumber: 19 }),
			row(1, "bulbasaur", 45),
		];
		expect(sortPokemon(regionalRows, "id", "asc").map((r) => r.id)).toEqual([1, 6, 19, 10091]);
		expect(sortPokemon(regionalRows, "id", "desc").map((r) => r.id)).toEqual([19, 10091, 6, 1]);
	});
});
