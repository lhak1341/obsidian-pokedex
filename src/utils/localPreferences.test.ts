import { describe, expect, it } from "vitest";
import { LocalPreferences, type LocalPreferenceValues } from "./localPreferences";

function setup(initial: Partial<LocalPreferenceValues> = {}) {
	const settings: LocalPreferenceValues = {
		favoritePokemonIds: [],
		visibleFields: ["hp", "attack"],
		cardFields: ["hp", "total"],
		layoutByWidthClass: { narrow: "card", wide: "table" },
		cardSizeByWidthClass: { narrow: "small", wide: "small" },
		...initial,
	};
	const saved: LocalPreferenceValues[] = [];
	const prefs = new LocalPreferences(() => settings, () => {
		saved.push(structuredClone(settings));
	});
	return { settings, saved, prefs };
}

describe("LocalPreferences", () => {
	// The bug this exists for (#27 grilling): each Pokedex leaf kept its own
	// copy, so a toggle in one leaf saved over the other leaf's change.
	it("keeps both leaves' favourite toggles", () => {
		const { prefs, saved } = setup();
		prefs.toggleFavorite(25); // the main pane
		prefs.toggleFavorite(133); // the sidebar
		expect(saved[saved.length - 1].favoritePokemonIds).toEqual([25, 133]);
	});

	it("toggles a favourite off again", () => {
		const { prefs, settings } = setup({ favoritePokemonIds: [25, 133] });
		prefs.toggleFavorite(25);
		expect(settings.favoritePokemonIds).toEqual([133]);
	});

	it("keeps both leaves' Fields changes", () => {
		const { prefs, saved } = setup({ visibleFields: ["hp", "attack", "defense", "speed"] });
		prefs.toggleField("defense");
		prefs.toggleField("speed");
		prefs.toggleField("total");
		expect(saved[saved.length - 1].visibleFields).toEqual(["hp", "attack", "total"]);
	});

	// ADR-0020: each layout has its own Fields selection.
	it("toggles Card view's Fields without touching the table's, and the reverse", () => {
		const { prefs, settings } = setup();
		prefs.toggleCardField("ev");
		prefs.toggleCardField("hp");
		expect(settings.cardFields).toEqual(["total", "ev"]);
		expect(settings.visibleFields).toEqual(["hp", "attack"]);
		prefs.toggleField("weight");
		expect(settings.cardFields).toEqual(["total", "ev"]);
	});

	it("writes only the current width class's Card size, as a new object", () => {
		const { prefs, settings } = setup();
		const before = settings.cardSizeByWidthClass;
		prefs.setCardSize("narrow", "large");
		expect(settings.cardSizeByWidthClass).toEqual({ narrow: "large", wide: "small" });
		expect(settings.cardSizeByWidthClass).not.toBe(before);
		prefs.setCardSize("wide", "medium");
		expect(settings.cardSizeByWidthClass).toEqual({ narrow: "large", wide: "medium" });
	});

	it("writes only the current width class's layout", () => {
		const { prefs, settings } = setup();
		prefs.setLayout("narrow", "table");
		prefs.setLayout("wide", "card");
		expect(settings.layoutByWidthClass).toEqual({ narrow: "table", wide: "card" });
	});

	it("tells every subscriber, so another open leaf shows the change at once", () => {
		const { prefs } = setup();
		const seenA: number[][] = [];
		const seenB: number[][] = [];
		prefs.subscribe((v) => seenA.push(v.favoritePokemonIds));
		prefs.subscribe((v) => seenB.push(v.favoritePokemonIds));
		prefs.toggleFavorite(25);
		expect(seenA).toEqual([[25]]);
		expect(seenB).toEqual([[25]]);
	});

	it("hands out a new array or object for a changed value, so a Svelte $state reassignment sees it", () => {
		const { prefs } = setup();
		const before = prefs.get();
		prefs.toggleFavorite(25);
		prefs.toggleField("speed");
		prefs.setLayout("wide", "card");
		const after = prefs.get();
		expect(after.favoritePokemonIds).not.toBe(before.favoritePokemonIds);
		expect(after.visibleFields).not.toBe(before.visibleFields);
		expect(after.layoutByWidthClass).not.toBe(before.layoutByWidthClass);
	});

	it("stops telling a leaf that unsubscribed", () => {
		const { prefs } = setup();
		const seen: number[][] = [];
		const unsubscribe = prefs.subscribe((v) => seen.push(v.favoritePokemonIds));
		unsubscribe();
		prefs.toggleFavorite(25);
		expect(seen).toEqual([]);
	});

	it("reads the live settings object, so a reload that replaces it is followed", () => {
		let settings: LocalPreferenceValues = {
			favoritePokemonIds: [1], visibleFields: [], cardFields: [], layoutByWidthClass: { narrow: "card", wide: "table" },
			cardSizeByWidthClass: { narrow: "small", wide: "small" },
		};
		const prefs = new LocalPreferences(() => settings, () => undefined);
		settings = { ...settings, favoritePokemonIds: [7] };
		prefs.toggleFavorite(25);
		expect(settings.favoritePokemonIds).toEqual([7, 25]);
	});
});
