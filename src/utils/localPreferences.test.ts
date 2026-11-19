import { describe, expect, it } from "vitest";
import { LocalPreferences, type LocalPreferenceValues } from "./localPreferences";

function setup(initial: Partial<LocalPreferenceValues> = {}) {
	const settings: LocalPreferenceValues = {
		favoritePokemonIds: [],
		visibleFields: ["hp", "attack"],
		layoutByWidthClass: { narrow: "card", wide: "table" },
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
			favoritePokemonIds: [1], visibleFields: [], layoutByWidthClass: { narrow: "card", wide: "table" },
		};
		const prefs = new LocalPreferences(() => settings, () => undefined);
		settings = { ...settings, favoritePokemonIds: [7] };
		prefs.toggleFavorite(25);
		expect(settings.favoritePokemonIds).toEqual([7, 25]);
	});
});
