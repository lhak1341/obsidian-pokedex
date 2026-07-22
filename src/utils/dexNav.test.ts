import { describe, expect, it } from "vitest";
import { resolveGenerationId } from "../data/constants";
import type { PokedexTableRow } from "../data/types";
import { getAdjacentDexEntries } from "./dexNav";

// Same fixture-builder pattern as filterPokemon.test.ts.
function row(overrides: Partial<PokedexTableRow>): PokedexTableRow {
	const id = overrides.id ?? 1;
	return {
		id,
		dexNumber: id,
		formLabel: null,
		generationId: resolveGenerationId(id),
		name: "bulbasaur",
		types: ["grass", "poison"],
		stats: { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 },
		evYield: [],
		abilityNames: [],
		levelUpMoveNames: [],
		heldItemNames: [],
		spriteDataUri: null,
		height: 7,
		weight: 69,
		catchRate: 45,
		hatchCounter: 20,
		rarity: "normal",
		isBaby: false,
		canMegaEvolve: false,
		canGigantamax: false,
		...overrides,
	};
}

describe("getAdjacentDexEntries", () => {
	const rows: PokedexTableRow[] = [
		row({ id: 4, name: "charmander" }),
		row({ id: 5, name: "charmeleon" }),
		row({ id: 6, name: "charizard" }),
		// Alolan Rattata: shares dexNumber 19 with the default row but has its
		// own id and a formLabel — must never surface as a prev/next target.
		row({ id: 19, dexNumber: 19, name: "rattata" }),
		row({ id: 10091, dexNumber: 19, name: "rattata", formLabel: "Alolan" }),
	];

	it("returns both neighbors for a middle entry", () => {
		expect(getAdjacentDexEntries(rows, 5)).toEqual({
			prev: { id: 4, dexNumber: 4, name: "charmander", spriteDataUri: null },
			next: { id: 6, dexNumber: 6, name: "charizard", spriteDataUri: null },
		});
	});

	it("returns null prev at the start of the loaded range", () => {
		expect(getAdjacentDexEntries(rows, 4).prev).toBeNull();
	});

	it("returns null next at the end of the loaded range", () => {
		expect(getAdjacentDexEntries(rows, 19).next).toBeNull();
	});

	it("skips regional-form rows and never returns one as a neighbor", () => {
		expect(getAdjacentDexEntries(rows, 6).next).toEqual({
			id: 19,
			dexNumber: 19,
			name: "rattata",
			spriteDataUri: null,
		});
	});

	it("returns nulls when the current dex number isn't in rows at all", () => {
		expect(getAdjacentDexEntries(rows, 999)).toEqual({ prev: null, next: null });
	});
});
