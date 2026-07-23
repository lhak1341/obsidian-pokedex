import { describe, expect, it } from "vitest";
import type { PokedexTableRow } from "../data/types";
import { resolveGenerationScope } from "./generationScope";

function rowWith(overrides: Partial<PokedexTableRow>): PokedexTableRow {
	return {
		id: 1, dexNumber: 1, formLabel: null, generationId: 1, name: "test",
		types: [], stats: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
		evYield: [], abilityNames: [], levelUpMoveNames: [], heldItemNames: [], spriteDataUri: null,
		height: 0, weight: 0, catchRate: 0, hatchCounter: 0, rarity: "normal",
		isBaby: false,
		canMegaEvolve: false,
		canGigantamax: false,
		evolutionStages: 0,
		...overrides,
	};
}

describe("resolveGenerationScope", () => {
	it("resolves a single generation to its own range", () => {
		const scope = resolveGenerationScope([1]);
		expect(scope.fetchRange).toEqual({ start: 1, end: 151 });
	});

	it("resolves multiple contiguous generations to a spanning range", () => {
		const scope = resolveGenerationScope([1, 2, 3]);
		expect(scope.fetchRange).toEqual({ start: 1, end: 386 });
	});

	it("spans the gap when a middle generation is excluded", () => {
		const scope = resolveGenerationScope([1, 3]);
		expect(scope.fetchRange).toEqual({ start: 1, end: 386 });
	});

	it("includes() matches a row by its own generationId, even inside a disabled gap within the fetch range", () => {
		const scope = resolveGenerationScope([1, 3]);

		expect(scope.includes(rowWith({ dexNumber: 1, generationId: 1 }))).toBe(true); // Gen 1 start
		expect(scope.includes(rowWith({ dexNumber: 151, generationId: 1 }))).toBe(true); // Gen 1 end
		expect(scope.includes(rowWith({ dexNumber: 200, generationId: 2 }))).toBe(false); // inside fetch range, but Gen 2 (excluded)
		expect(scope.includes(rowWith({ dexNumber: 252, generationId: 3 }))).toBe(true); // Gen 3 start
		expect(scope.includes(rowWith({ dexNumber: 386, generationId: 3 }))).toBe(true); // Gen 3 end
	});

	// The actual bug this row-based (not bare-id) signature exists to fix:
	// a regional-form row's own numeric `id` (a PokeAPI variety pseudo-id
	// like 10091) falls nowhere near any real dex-number range — `includes`
	// must key off generationId, not re-derive membership from id/dexNumber
	// range math, or every regional-form row gets silently dropped.
	it("includes() matches a regional-form row by its own generationId, ignoring its unrelated id/dexNumber", () => {
		const scope = resolveGenerationScope([7]);
		const alolanRattata = rowWith({ id: 10091, dexNumber: 19, formLabel: "Alolan", generationId: 7 });

		expect(scope.includes(alolanRattata)).toBe(true);
		expect(resolveGenerationScope([1]).includes(alolanRattata)).toBe(false);
	});
});
