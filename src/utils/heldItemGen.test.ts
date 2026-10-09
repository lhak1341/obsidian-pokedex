import { describe, expect, it } from "vitest";
import { filterHeldItemsForGen } from "./heldItemGen";

describe("filterHeldItemsForGen", () => {
	it("keeps only rarities from the active generation", () => {
		const heldItemsAllGens = [
			{
				name: "oran-berry",
				rarities: [{ value: 50, generationId: 3 }, { value: 30, generationId: 4 }],
			},
		];
		expect(filterHeldItemsForGen(heldItemsAllGens, 3)).toEqual([{ name: "oran-berry", rarities: [50] }]);
		expect(filterHeldItemsForGen(heldItemsAllGens, 4)).toEqual([{ name: "oran-berry", rarities: [30] }]);
	});

	it("drops an item entirely when it has no rarity in the active generation", () => {
		// Absorb Bulb: Diamond/Pearl only (Gen 4) — should disappear at Active Gen 3.
		const heldItemsAllGens = [{ name: "absorb-bulb", rarities: [{ value: 5, generationId: 4 }] }];
		expect(filterHeldItemsForGen(heldItemsAllGens, 3)).toEqual([]);
	});

	it("returns an empty list for a species with no held items", () => {
		expect(filterHeldItemsForGen([], 3)).toEqual([]);
	});
});
