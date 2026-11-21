import { describe, expect, it } from "vitest";
import { NARROW_PANE_MAX_WIDTH } from "./browseLayout";
import { DETAIL_COLUMNS_MIN_WIDTH, DETAIL_PHONE_MAX_WIDTH } from "./detailBand";
import { HIDDEN_LEAF_FALLBACK, paneWidth } from "./paneWidth";

describe("paneWidth", () => {
	it("starts a hidden leaf (width 0) wide, in three columns", () => {
		expect(paneWidth(0)).toEqual({ widthClass: "wide", band: "columns" });
		expect(paneWidth(0)).toBe(HIDDEN_LEAF_FALLBACK);
	});

	it("keeps the previous value while the leaf is hidden", () => {
		// Not phone: a width of 0 would compute as phone, so a phone prev
		// can't tell keeping it from re-deriving it.
		const rail = paneWidth(900);
		expect(paneWidth(0, rail)).toBe(rail);
	});

	it("returns the previous object for a width inside the same band", () => {
		const rail = paneWidth(800);
		expect(paneWidth(1000, rail)).toBe(rail);
	});

	it("returns a new value across 600, 760 and 1100", () => {
		const rail = paneWidth(900);
		const widePhone = paneWidth(DETAIL_PHONE_MAX_WIDTH - 1, rail);
		expect(widePhone).toEqual({ widthClass: "wide", band: "phone" });
		expect(paneWidth(NARROW_PANE_MAX_WIDTH - 1, widePhone)).toEqual({ widthClass: "narrow", band: "phone" });
		expect(paneWidth(DETAIL_COLUMNS_MIN_WIDTH, rail)).toEqual({ widthClass: "wide", band: "columns" });
	});

	// The phone band reaches past the Narrow pane (detailBand.ts), so a
	// 600-759px leaf is the wide browse layout with the phone detail screen.
	it.each([
		[NARROW_PANE_MAX_WIDTH - 1, "narrow", "phone"],
		[NARROW_PANE_MAX_WIDTH, "wide", "phone"],
		[DETAIL_PHONE_MAX_WIDTH - 1, "wide", "phone"],
		[DETAIL_PHONE_MAX_WIDTH, "wide", "rail"],
		[DETAIL_COLUMNS_MIN_WIDTH - 1, "wide", "rail"],
		[DETAIL_COLUMNS_MIN_WIDTH, "wide", "columns"],
	])("at %i is %s with the %s band", (width, widthClass, band) => {
		expect(paneWidth(width)).toEqual({ widthClass, band });
	});
});
