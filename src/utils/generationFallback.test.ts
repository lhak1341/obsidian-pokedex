import { describe, expect, it } from "vitest";
import { resolveTabsForGen } from "./generationFallback";

const MOVE_TABS_BY_GEN: Record<number, readonly { key: string; label: string }[]> = {
	3: [
		{ key: "firered-leafgreen", label: "FRLG" },
		{ key: "emerald", label: "RSE" },
	],
	4: [
		{ key: "diamond-pearl", label: "D/P" },
		{ key: "platinum", label: "Platinum" },
	],
};

const FLAVOR_TABS_BY_GEN: Record<number, readonly { key: string; label: string; versions: readonly string[] }[]> = {
	3: [
		{ key: "leafgreen", label: "Leaf Green", versions: ["leafgreen"] },
		{ key: "firered", label: "Fire Red", versions: ["firered"] },
	],
	4: [{ key: "platinum", label: "Platinum", versions: ["platinum"] }],
};

describe("resolveTabsForGen", () => {
	it("returns the active gen's tabs that have data", () => {
		const versionsWithMoves = new Set(["emerald"]);
		const tabs = resolveTabsForGen(MOVE_TABS_BY_GEN, 3, (t) => versionsWithMoves.has(t.key));
		expect(tabs.map((t) => t.key)).toEqual(["emerald"]);
	});

	it("falls back to the latest gen's tabs when the active gen's tabs have no data", () => {
		const versionsWithMoves = new Set(["platinum"]);
		const tabs = resolveTabsForGen(MOVE_TABS_BY_GEN, 3, (t) => versionsWithMoves.has(t.key));
		expect(tabs.map((t) => t.key)).toEqual(["platinum"]);
	});

	it("falls back when the active gen is missing from the map entirely", () => {
		const flavorTexts: Record<string, string> = { platinum: "..." };
		const tabs = resolveTabsForGen(FLAVOR_TABS_BY_GEN, 1, (t) => !!flavorTexts[t.key]);
		expect(tabs.map((t) => t.key)).toEqual(["platinum"]);
	});

	it("returns an empty array when even the latest gen's tabs have no data", () => {
		const flavorTexts: Record<string, string> = {};
		const tabs = resolveTabsForGen(FLAVOR_TABS_BY_GEN, 3, (t) => !!flavorTexts[t.key]);
		expect(tabs).toEqual([]);
	});

	it("works generically across differently-shaped tab types", () => {
		const versionsWithMoves = new Set(["firered-leafgreen", "emerald"]);
		const moveTabs = resolveTabsForGen(MOVE_TABS_BY_GEN, 3, (t) => versionsWithMoves.has(t.key));
		expect(moveTabs.map((t) => t.key)).toEqual(["firered-leafgreen", "emerald"]);

		const flavorTexts: Record<string, string> = { leafgreen: "..." };
		const flavorTabs = resolveTabsForGen(FLAVOR_TABS_BY_GEN, 3, (t) => !!flavorTexts[t.key]);
		expect(flavorTabs.map((t) => t.key)).toEqual(["leafgreen"]);
	});
});
