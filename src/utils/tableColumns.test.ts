import { describe, expect, it } from "vitest";
import { FIELDS } from "./fields";
import { TABLE_GEOMETRY } from "./tableColumns";
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
