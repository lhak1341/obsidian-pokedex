import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT_BY_WIDTH_CLASS, chooseLayout, widthClass } from "./browseLayout";

describe("widthClass", () => {
	it.each([
		[0, "narrow"],
		[390, "narrow"],
		[599.5, "narrow"],
		[600, "wide"],
		[1400, "wide"],
	] as const)("a %spx Pokedex leaf is %s", (width, expected) => {
		expect(widthClass(width)).toBe(expected);
	});
});

describe("chooseLayout", () => {
	it("defaults a Narrow pane to Card view and a wide one to the table", () => {
		expect(DEFAULT_LAYOUT_BY_WIDTH_CLASS).toEqual({ narrow: "card", wide: "table" });
	});

	it("writes only the current width class", () => {
		const start = { narrow: "card", wide: "table" } as const;
		expect(chooseLayout(start, "narrow", "table")).toEqual({ narrow: "table", wide: "table" });
		expect(chooseLayout(start, "wide", "card")).toEqual({ narrow: "card", wide: "card" });
	});

	it("returns a new object and leaves the old one alone", () => {
		const start = { narrow: "card", wide: "table" } as const;
		const next = chooseLayout(start, "wide", "card");
		expect(next).not.toBe(start);
		expect(start).toEqual({ narrow: "card", wide: "table" });
	});
});
