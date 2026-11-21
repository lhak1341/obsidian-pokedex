import { describe, expect, it } from "vitest";
import { DETAIL_COLUMNS_MIN_WIDTH, DETAIL_PHONE_MAX_WIDTH, detailBand, shownDetailTab, tabsForBand } from "./detailBand";
import { NARROW_PANE_MAX_WIDTH } from "./browseLayout";

describe("detailBand", () => {
	it("is the phone layout below 760", () => {
		expect(DETAIL_PHONE_MAX_WIDTH).toBe(760);
		expect(detailBand(390)).toBe("phone");
		expect(detailBand(DETAIL_PHONE_MAX_WIDTH - 1)).toBe("phone");
	});

	// A 600px rail left its tab column 239px, narrower than the phone's 293px.
	it("stays the phone layout past the Narrow pane, where browse goes wide", () => {
		expect(detailBand(NARROW_PANE_MAX_WIDTH)).toBe("phone");
		expect(detailBand(700)).toBe("phone");
	});

	it("is the rail from 760 up to 1100", () => {
		expect(detailBand(DETAIL_PHONE_MAX_WIDTH)).toBe("rail");
		expect(detailBand(768)).toBe("rail");
		expect(detailBand(1024)).toBe("rail");
		expect(detailBand(DETAIL_COLUMNS_MIN_WIDTH - 1)).toBe("rail");
	});

	it("is three columns from 1100", () => {
		expect(DETAIL_COLUMNS_MIN_WIDTH).toBe(1100);
		expect(detailBand(1100)).toBe("columns");
		expect(detailBand(1600)).toBe("columns");
	});
});

describe("shownDetailTab", () => {
	it("shows the selected tab when the band has it", () => {
		expect(shownDetailTab("stats", "phone")).toBe("stats");
		expect(shownDetailTab("overview", "rail")).toBe("overview");
	});

	it("keeps Moves across a resize between phone and rail", () => {
		expect(shownDetailTab("moves", "phone")).toBe("moves");
		expect(shownDetailTab("moves", "rail")).toBe("moves");
	});

	it("falls back to the band's first tab for a tab it lacks", () => {
		expect(shownDetailTab("stats", "rail")).toBe("overview");
		expect(shownDetailTab("evolution", "rail")).toBe("overview");
		expect(shownDetailTab("overview", "phone")).toBe("about");
	});

	it("gives three columns no tabs", () => {
		expect(tabsForBand("columns")).toEqual([]);
		expect(shownDetailTab("moves", "columns")).toBeNull();
	});
});
