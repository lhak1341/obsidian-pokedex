import { describe, expect, it } from "vitest";
import type { PokedexTableRow } from "../data/types";
import { TOGGLEABLE_COLUMNS } from "./tableColumns";

function makeRow(overrides: Partial<PokedexTableRow> = {}): PokedexTableRow {
	return {
		id: 1,
		name: "bulbasaur",
		types: ["grass", "poison"],
		stats: { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 },
		evYield: [],
		abilityNames: ["overgrow"],
		spriteDataUri: null,
		height: 7,
		weight: 69,
		catchRate: 45,
		hatchCounter: 20,
		...overrides,
	};
}

function renderOf(key: string, row: PokedexTableRow): string {
	const column = TOGGLEABLE_COLUMNS.find((c) => c.key === key);
	if (!column) throw new Error(`no column registered for key "${key}"`);
	return column.render(row);
}

describe("TOGGLEABLE_COLUMNS", () => {
	it("renders a stat column as its raw value", () => {
		expect(renderOf("hp", makeRow())).toBe("45");
	});

	it("renders total as the sum of all stats", () => {
		expect(renderOf("total", makeRow())).toBe("318"); // 45+49+49+65+65+45
	});

	it("renders '-' for empty EV yield", () => {
		expect(renderOf("ev", makeRow({ evYield: [] }))).toBe("-");
	});

	it("renders EV yield entries with their stat labels, comma-joined", () => {
		const row = makeRow({ evYield: [{ stat: "specialAttack", amount: 1 }, { stat: "hp", amount: 2 }] });
		expect(renderOf("ev", row)).toBe("1 SpA, 2 HP");
	});

	it("passes catch rate and hatch counter through unchanged", () => {
		const row = makeRow({ catchRate: 200, hatchCounter: 10 });
		expect(renderOf("catchRate", row)).toBe("200");
		expect(renderOf("hatchCounter", row)).toBe("10");
	});

	it("converts height from decimeters to meters", () => {
		expect(renderOf("height", makeRow({ height: 7 }))).toBe("0.7 m");
	});

	it("converts weight from hectograms to kilograms", () => {
		expect(renderOf("weight", makeRow({ weight: 690 }))).toBe("69.0 kg");
	});
});
