import { describe, expect, it } from "vitest";
import type { PokedexTableRow } from "../data/types";
import { DEFAULT_VISIBLE_FIELDS, FIELDS, formatEvYield, isStatField, sortAfterFieldsChange } from "./fields";
import { makeRow } from "../data/__fixtures__/rows";

function renderOf(key: string, row: PokedexTableRow): string {
	const field = FIELDS.find((f) => f.key === key);
	if (!field) throw new Error(`no Field registered for key "${key}"`);
	if (field.custom) throw new Error(`Field "${key}" is custom-rendered, not render()`);
	return field.render(row);
}

describe("FIELDS", () => {
	it("renders a stat column as its raw value", () => {
		expect(renderOf("hp", makeRow())).toBe("45");
	});

	it("renders total as the sum of all stats", () => {
		expect(renderOf("total", makeRow())).toBe("318"); // 45+49+49+65+65+45
	});

	it("renders '-' for empty EV yield", () => {
		expect(formatEvYield(makeRow({ evYield: [] }))).toBe("-");
	});

	it("renders EV yield entries with their stat labels, comma-joined", () => {
		const row = makeRow({ evYield: [{ stat: "specialAttack", amount: 1 }, { stat: "hp", amount: 2 }] });
		expect(formatEvYield(row)).toBe("1 SpA, 2 HP");
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

describe("custom Fields", () => {
	it("leaves held items, capture and EV yield to TableScreen, which draws their cells", () => {
		// These have no render(): production never called one (held items and
		// capture need the Active Gen, so a text fallback could only show every
		// generation's data; EV yield draws chips).
		// The discriminant is what TableScreen's template branches on, with no
		// default, so pin each column's exact value.
		const expected = { heldItems: "heldItems", encounterLocation: "encounters", ev: "ev" } as const;
		for (const [key, cell] of Object.entries(expected)) {
			const field = FIELDS.find((f) => f.key === key);
			expect(field?.custom).toBe(cell);
			expect(field && "render" in field).toBe(false);
		}
	});
});

describe("DEFAULT_VISIBLE_FIELDS", () => {
	it("is the six stats, Total and EV yield, so a fresh tile shows its Σ and EV corners", () => {
		expect(DEFAULT_VISIBLE_FIELDS).toEqual([
			"hp", "attack", "defense", "specialAttack", "specialDefense", "speed", "total", "ev",
		]);
	});
});

describe("sortAfterFieldsChange", () => {
	const all = new Set(FIELDS.map((f) => f.key));
	const without = (key: string) => new Set([...all].filter((k) => k !== key));

	it("resets to No. ascending when the sorted Field is unchosen", () => {
		expect(sortAfterFieldsChange({ column: "weight", direction: "desc" }, without("weight"))).toEqual({
			column: "id",
			direction: "asc",
		});
		expect(sortAfterFieldsChange({ column: "speed", direction: "asc" }, without("speed"))).toEqual({
			column: "id",
			direction: "asc",
		});
	});

	it("keeps the sort when a different Field is unchosen", () => {
		const sort = { column: "weight", direction: "desc" } as const;
		expect(sortAfterFieldsChange(sort, without("height"))).toEqual(sort);
	});

	it("keeps No. and Name sorts, which are not Fields, whatever is chosen", () => {
		expect(sortAfterFieldsChange({ column: "name", direction: "desc" }, new Set())).toEqual({
			column: "name",
			direction: "desc",
		});
		expect(sortAfterFieldsChange({ column: "id", direction: "desc" }, new Set())).toEqual({
			column: "id",
			direction: "desc",
		});
	});
});

describe("isStatField", () => {
	// The Fields menu's Stats section, and Card view's stat strip and panel
	// columns, are exactly the six base stats. Total is not one: the menu lists
	// it under Other, and the tile and panel place it separately.
	it("is true for the six base stats only", () => {
		expect(FIELDS.filter(isStatField).map((f) => f.key)).toEqual([
			"hp", "attack", "defense", "specialAttack", "specialDefense", "speed",
		]);
	});
});
