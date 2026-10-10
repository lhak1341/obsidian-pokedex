import { describe, expect, it } from "vitest";
import { GENERATIONS } from "../data/constants";
import { resolveTabsForGen } from "./generationFallback";

// resolveTabsForGen's fallback target is GENERATIONS' own max id, not a
// fixed number — keying this mock's "latest" entry off the same constant
// (rather than a hardcoded gen number) means this test doesn't need a
// re-fix every time a new generation phase ships and GENERATIONS grows.
const LATEST_GEN = Math.max(...GENERATIONS.map((g) => g.id));

const MOVE_TABS_BY_GEN: Record<number, readonly { key: string; label: string }[]> = {
	3: [
		{ key: "firered-leafgreen", label: "FRLG" },
		{ key: "emerald", label: "RSE" },
	],
	[LATEST_GEN]: [
		{ key: "diamond-pearl", label: "D/P" },
		{ key: "platinum", label: "Platinum" },
	],
};

const FLAVOR_TABS_BY_GEN: Record<number, readonly { key: string; label: string; versions: readonly string[] }[]> = {
	3: [
		{ key: "leafgreen", label: "Leaf Green", versions: ["leafgreen"] },
		{ key: "firered", label: "Fire Red", versions: ["firered"] },
	],
	[LATEST_GEN]: [{ key: "platinum", label: "Platinum", versions: ["platinum"] }],
};

describe("resolveTabsForGen", () => {
	it("returns the active gen's tabs that have data", () => {
		const versionsWithMoves = new Set(["emerald"]);
		const tabs = resolveTabsForGen(MOVE_TABS_BY_GEN, 3, (t) => versionsWithMoves.has(t.key), "").tabs;
		expect(tabs.map((t) => t.key)).toEqual(["emerald"]);
	});

	it("falls back to the latest gen's tabs when the active gen's tabs have no data", () => {
		const versionsWithMoves = new Set(["platinum"]);
		const tabs = resolveTabsForGen(MOVE_TABS_BY_GEN, 3, (t) => versionsWithMoves.has(t.key), "").tabs;
		expect(tabs.map((t) => t.key)).toEqual(["platinum"]);
	});

	it("falls back when the active gen is missing from the map entirely", () => {
		const flavorTexts: Record<string, string> = { platinum: "..." };
		const tabs = resolveTabsForGen(FLAVOR_TABS_BY_GEN, 1, (t) => !!flavorTexts[t.key], "").tabs;
		expect(tabs.map((t) => t.key)).toEqual(["platinum"]);
	});

	it("returns an empty array when no generation's tabs have data", () => {
		const flavorTexts: Record<string, string> = {};
		const tabs = resolveTabsForGen(FLAVOR_TABS_BY_GEN, 3, (t) => !!flavorTexts[t.key], "").tabs;
		expect(tabs).toEqual([]);
	});

	// The actual bug this covers: Active Gen defaults to LATEST_GEN for every
	// fresh install, so falling back to "LATEST_GEN's tabs" specifically used
	// to be a no-op whenever activeGen was already LATEST_GEN — a moves/
	// flavor-text cache trimmed before that generation's support existed (see
	// PokedexRepository's isStale comments) would show zero tabs/rows forever,
	// with no fallback actually firing. Falling back to the nearest *other*
	// generation instead fixes this.
	it("falls back to an older generation when the active gen is already the latest and has no data", () => {
		const versionsWithMoves = new Set(["firered-leafgreen"]);
		const tabs = resolveTabsForGen(MOVE_TABS_BY_GEN, LATEST_GEN, (t) => versionsWithMoves.has(t.key), "").tabs;
		expect(tabs.map((t) => t.key)).toEqual(["firered-leafgreen"]);
	});

	it("works generically across differently-shaped tab types", () => {
		const versionsWithMoves = new Set(["firered-leafgreen", "emerald"]);
		const moveTabs = resolveTabsForGen(MOVE_TABS_BY_GEN, 3, (t) => versionsWithMoves.has(t.key), "").tabs;
		expect(moveTabs.map((t) => t.key)).toEqual(["firered-leafgreen", "emerald"]);

		const flavorTexts: Record<string, string> = { leafgreen: "..." };
		const flavorTabs = resolveTabsForGen(FLAVOR_TABS_BY_GEN, 3, (t) => !!flavorTexts[t.key], "").tabs;
		expect(flavorTabs.map((t) => t.key)).toEqual(["leafgreen"]);
	});

	describe("chosen generation", () => {
		it("reports the active gen when it has data", () => {
			const r = resolveTabsForGen(MOVE_TABS_BY_GEN, 3, () => true, "");
			expect(r.gen).toBe(3);
		});

		it("reports the generation it fell back to", () => {
			const versionsWithMoves = new Set(["platinum"]);
			const r = resolveTabsForGen(MOVE_TABS_BY_GEN, 3, (t) => versionsWithMoves.has(t.key), "");
			expect(r.gen).toBe(LATEST_GEN);
		});

		it("reports null when no generation has data", () => {
			const r = resolveTabsForGen(FLAVOR_TABS_BY_GEN, 3, () => false, "firered");
			expect(r).toEqual({ tabs: [], gen: null, selected: null, selectedIndex: 0 });
		});
	});

	describe("remembered selection", () => {
		it("selects the remembered key when present", () => {
			const r = resolveTabsForGen(MOVE_TABS_BY_GEN, 3, () => true, "emerald");
			expect(r.selected?.key).toBe("emerald");
			expect(r.selectedIndex).toBe(1);
		});

		it("selects the first tab when the remembered key is not among them", () => {
			const r = resolveTabsForGen(MOVE_TABS_BY_GEN, 3, () => true, "platinum");
			expect(r.selected?.key).toBe("firered-leafgreen");
			expect(r.selectedIndex).toBe(0);
		});

		it("re-resolves against the fallback generation's tabs", () => {
			const versionsWithMoves = new Set(["diamond-pearl", "platinum"]);
			const r = resolveTabsForGen(MOVE_TABS_BY_GEN, 3, (t) => versionsWithMoves.has(t.key), "platinum");
			expect(r.selected?.key).toBe("platinum");
		});
	});
});
