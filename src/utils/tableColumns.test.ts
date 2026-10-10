import { describe, expect, it } from "vitest";
import type { PokedexTableRow } from "../data/types";
import { formatEvYield, TOGGLEABLE_COLUMNS } from "./tableColumns";
import { makeRow } from "../data/__fixtures__/rows";
import template from "../view/components/TableScreen.svelte?raw";

function renderOf(key: string, row: PokedexTableRow): string {
	const column = TOGGLEABLE_COLUMNS.find((c) => c.key === key);
	if (!column) throw new Error(`no column registered for key "${key}"`);
	if (column.custom) throw new Error(`column "${key}" is custom-rendered by TableScreen, not render()`);
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

describe("custom columns", () => {
	it("leaves held items, capture and EV yield to TableScreen, which draws their cells", () => {
		// These have no render(): production never called one (held items and
		// capture need the Active Gen, so a text fallback could only show every
		// generation's data; EV yield draws chips).
		// The discriminant is what TableScreen's template branches on, with no
		// default, so pin each column's exact value.
		const expected = { heldItems: "heldItems", encounterLocation: "encounters", ev: "ev" } as const;
		for (const [key, cell] of Object.entries(expected)) {
			const column = TOGGLEABLE_COLUMNS.find((c) => c.key === key);
			expect(column?.custom).toBe(cell);
			expect(column && "render" in column).toBe(false);
		}
	});

	// tsc skips .svelte, so nothing else notices a CustomCell value that
	// TableScreen's template has no branch for: it falls into the `{:else}
	// <td></td>` alignment fallback and renders blank. The expected values come
	// from TOGGLEABLE_COLUMNS itself, so a new custom column is covered the
	// moment it is added.
	it("has a TableScreen template branch for every custom column", () => {
		const customValues = [
			...new Set(TOGGLEABLE_COLUMNS.flatMap((c) => (c.custom ? [c.custom] : []))),
		];
		// Liveness: an empty list or an empty template would pass vacuously.
		expect(customValues.length).toBeGreaterThan(0);
		expect(template).toContain("{#each activeColumns as col");
		for (const value of customValues) {
			expect(template, `no \`col.custom === "${value}"\` branch in TableScreen.svelte`).toContain(
				`col.custom === "${value}"`,
			);
		}
	});
});
