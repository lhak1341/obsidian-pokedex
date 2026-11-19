import { describe, expect, it } from "vitest";
import { FIELDS } from "./fields";
import { TABLE_GEOMETRY, TABLE_COLUMNS, columnWidth, tableFrame } from "./tableColumns";
import template from "../view/components/TableScreen.svelte?raw";

describe("TABLE_GEOMETRY", () => {
	// A Field without an entry would reach TableScreen with no width or floor.
	it("has an entry for every Field, and none for a key that is not a Field", () => {
		expect(FIELDS.length).toBeGreaterThan(0);
		expect(Object.keys(TABLE_GEOMETRY).sort()).toEqual(FIELDS.map((f) => f.key).sort());
		for (const { key } of FIELDS) {
			expect(typeof TABLE_GEOMETRY[key].widthPercent, key).toBe("string");
			expect(typeof TABLE_GEOMETRY[key].minWidth, key).toBe("string");
		}
	});
});

describe("custom cells", () => {
	// tsc skips .svelte, so nothing else notices a CustomCell value that
	// TableScreen's template has no branch for: it falls into the `{:else}
	// <td></td>` alignment fallback and renders blank. The expected values come
	// from FIELDS itself, so a new custom Field is covered the moment it is
	// added.
	// A plain Field's cell scopes by Active Gen only if the template passes it:
	// `col.render(row)` compiles (tsc skips .svelte) and Capture would show "-"
	// in every row.
	it("passes the Active Gen to a plain Field's render and title", () => {
		expect(template).toContain("col.render(row, activeGen)");
		expect(template).toContain("col.title?.(row, activeGen)");
	});

	it("has a TableScreen template branch for every custom Field", () => {
		const customValues = [...new Set(FIELDS.flatMap((f) => (f.custom ? [f.custom] : [])))];
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

describe("tableFrame", () => {
	// Spec #18, Narrow pane: No. 32px, sprite 36px, name 112px, Type 58px of
	// 22px icons whatever the type-icons setting says. Name was 108px, the
	// longest base name (Sandy Shocks, 98px) plus padding; #35 added 4px so a
	// favourite's dot fits after it, clear of the name and the column line.
	it("gives a Narrow pane compact pinned columns and always draws type icons", () => {
		for (const useTypeIcons of [true, false]) {
			for (const density of ["compact", "comfortable"] as const) {
				expect(tableFrame({ narrow: true, density, useTypeIcons })).toEqual({
					number: { width: "32px", min: "32px" },
					sprite: { width: "36px", min: "36px" },
					name: { width: undefined, min: "112px" },
					type: { width: "58px", min: "58px" },
					typeIcons: true,
					// The 32px sprite is the spec's, whatever the density.
					compact: false,
				});
			}
		}
	});

	it("keeps the wide table as it was, honouring the type-icons setting", () => {
		expect(tableFrame({ narrow: false, density: "comfortable", useTypeIcons: false })).toEqual({
			number: { width: "4%", min: "60px" },
			sprite: { width: "4%", min: "48px" },
			name: { width: "25%", min: "20ch" },
			type: { width: "10%", min: "168px" },
			typeIcons: false,
			compact: false,
		});
		expect(tableFrame({ narrow: false, density: "compact", useTypeIcons: true })).toEqual({
			number: { width: "4%", min: "60px" },
			sprite: { width: "3%", min: "40px" },
			name: { width: "25%", min: "20ch" },
			type: { width: "6%", min: "76px" },
			typeIcons: true,
			compact: true,
		});
	});
});

describe("columnWidth", () => {
	// On a Narrow pane a Field column is its floor in px (a stat stays 52px), so
	// any spare width goes to the auto-width Name column, not the stats.
	it("is the floor on a Narrow pane and the percentage share otherwise", () => {
		const hp = TABLE_COLUMNS.find((c) => c.key === "hp");
		expect(hp).toBeDefined();
		if (!hp) return;
		expect(columnWidth(hp, true)).toBe("52px");
		expect(columnWidth(hp, false)).toBe("4%");
	});
});
