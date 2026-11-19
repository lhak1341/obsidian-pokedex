import { describe, expect, it } from "vitest";
import { NARROW_PANE_MAX_WIDTH } from "./browseLayout";
import { DETAIL_COLUMNS_MIN_WIDTH } from "./detailBand";
import { HIDDEN_LEAF_FALLBACK, paneWidth } from "./paneWidth";

describe("paneWidth", () => {
	it("starts a hidden leaf (width 0) wide, in three columns", () => {
		expect(paneWidth(0)).toEqual({ widthClass: "wide", band: "columns" });
		expect(paneWidth(0)).toBe(HIDDEN_LEAF_FALLBACK);
	});

	it("keeps the previous value while the leaf is hidden", () => {
		// Not phone: a width of 0 would compute as phone, so a phone prev
		// can't tell keeping it from re-deriving it.
		const rail = paneWidth(700);
		expect(paneWidth(0, rail)).toBe(rail);
	});

	it("returns the previous object for a width inside the same band", () => {
		const rail = paneWidth(700);
		expect(paneWidth(800, rail)).toBe(rail);
	});

	it("returns a new value across 600 and 1100", () => {
		const rail = paneWidth(700);
		expect(paneWidth(NARROW_PANE_MAX_WIDTH - 1, rail)).toEqual({ widthClass: "narrow", band: "phone" });
		expect(paneWidth(DETAIL_COLUMNS_MIN_WIDTH, rail)).toEqual({ widthClass: "wide", band: "columns" });
	});

	it.each([NARROW_PANE_MAX_WIDTH - 1, NARROW_PANE_MAX_WIDTH, DETAIL_COLUMNS_MIN_WIDTH - 1, DETAIL_COLUMNS_MIN_WIDTH])(
		"is narrow exactly when the band is phone at %i",
		(width) => {
			const { widthClass, band } = paneWidth(width);
			expect(widthClass === "narrow").toBe(band === "phone");
		},
	);
});
