import { describe, expect, it } from "vitest";
import { resolveGenerationId } from "../data/constants";
import type { PokedexTableRow } from "../data/types";
import { quickJumpMatches, stepQuickJumpNav } from "./quickJump";

function row(id: number, name: string): PokedexTableRow {
	return {
		id,
		dexNumber: id,
		formLabel: null,
		generationId: resolveGenerationId(id),
		name,
		types: [],
		stats: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
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
	};
}

describe("quickJumpMatches", () => {
	const rows = Array.from({ length: 12 }, (_, i) => row(i + 1, `mon${i + 1}`));

	it("returns nothing for an empty query", () => {
		expect(quickJumpMatches(rows, "")).toEqual([]);
		expect(quickJumpMatches(rows, "   ")).toEqual([]);
	});

	it("filters by name substring", () => {
		expect(quickJumpMatches(rows, "mon1").map((r) => r.id)).toEqual([1, 10, 11, 12]);
	});

	it("caps results at the limit", () => {
		expect(quickJumpMatches(rows, "mon", 3)).toHaveLength(3);
	});
});

describe("stepQuickJumpNav", () => {
	it("returns none when there are no matches, regardless of key", () => {
		expect(stepQuickJumpNav("ArrowDown", 0, 0)).toEqual({ action: "none" });
		expect(stepQuickJumpNav("Enter", 0, 0)).toEqual({ action: "none" });
	});

	it("wraps ArrowDown past the last index back to 0", () => {
		expect(stepQuickJumpNav("ArrowDown", 2, 3)).toEqual({ action: "move", index: 0 });
	});

	it("wraps ArrowUp past the first index back to the last", () => {
		expect(stepQuickJumpNav("ArrowUp", 0, 3)).toEqual({ action: "move", index: 2 });
	});

	it("selects the active index on Enter", () => {
		expect(stepQuickJumpNav("Enter", 1, 3)).toEqual({ action: "select", index: 1 });
	});

	it("returns none for an unrecognized key", () => {
		expect(stepQuickJumpNav("a", 0, 3)).toEqual({ action: "none" });
	});
});
