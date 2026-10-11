import { describe, expect, it } from "vitest";
import { GENERATIONS } from "../data/constants";
import type { PluginSettings } from "../data/types";
import { hydrateSettings } from "./settingsHydrate";

const DEFAULTS: PluginSettings = {
	fontHeading: "pokedex",
	fontHeadingCustom: "",
	fontBody: "pokedex",
	fontBodyCustom: "",
	fontMono: "pokedex",
	fontMonoCustom: "",
	enabledGenerations: GENERATIONS.map((g) => g.id),
	spriteStyle: "official-artwork",
	gridDensity: "comfortable",
	defaultSortColumn: "id",
	visibleColumns: ["hp", "attack"],
	useTypeIcons: false,
	activeGen: 9,
	favoritePokemonIds: [],
};

describe("hydrateSettings", () => {
	it("passes valid values through unchanged", () => {
		const saved: PluginSettings = {
			fontHeading: "custom",
			fontHeadingCustom: "Fira Sans",
			fontBody: "obsidian-text",
			fontBodyCustom: "x",
			fontMono: "obsidian-monospace",
			fontMonoCustom: "y",
			enabledGenerations: [1, 3],
			spriteStyle: "sprite",
			gridDensity: "compact",
			defaultSortColumn: "name",
			visibleColumns: ["hp"],
			useTypeIcons: true,
			activeGen: 3,
			favoritePokemonIds: [25, 6],
		};
		expect(hydrateSettings(saved, DEFAULTS)).toEqual(saved);
	});

	it.each([null, undefined, "x", 5, []])("returns the defaults for non-object saved %j", (saved) => {
		expect(hydrateSettings(saved, DEFAULTS)).toEqual(DEFAULTS);
	});

	it("fills fields missing from an older data.json with defaults", () => {
		const out = hydrateSettings({ spriteStyle: "sprite" }, DEFAULTS);
		expect(out).toEqual({ ...DEFAULTS, spriteStyle: "sprite" });
	});

	it.each([
		["fontHeading", "comic-sans"],
		["fontBody", 3],
		["fontMono", null],
		["spriteStyle", "gif"],
		["gridDensity", "huge"],
		["defaultSortColumn", "weight"],
		["useTypeIcons", "yes"],
		["activeGen", 99],
		["activeGen", "9"],
		["fontHeadingCustom", 5],
	])("falls back to the default for an invalid %s (%j)", (key, bad) => {
		const out = hydrateSettings({ [key]: bad }, DEFAULTS);
		expect(out[key as keyof PluginSettings]).toEqual(DEFAULTS[key as keyof PluginSettings]);
	});

	it.each([[[]], [[99, 100]], ["1"], [null]])("falls back to the default generations for %j", (bad) => {
		expect(hydrateSettings({ enabledGenerations: bad }, DEFAULTS).enabledGenerations).toEqual(
			DEFAULTS.enabledGenerations,
		);
	});

	it("keeps the known generations from a mixed list, sorted and deduped", () => {
		expect(hydrateSettings({ enabledGenerations: [3, 99, 1, 3] }, DEFAULTS).enabledGenerations).toEqual([1, 3]);
	});

	it("falls back when visibleColumns / favoritePokemonIds are not arrays, without checking their contents", () => {
		const out = hydrateSettings({ visibleColumns: "hp", favoritePokemonIds: 5 }, DEFAULTS);
		expect(out.visibleColumns).toEqual(DEFAULTS.visibleColumns);
		expect(out.favoritePokemonIds).toEqual([]);
		expect(hydrateSettings({ visibleColumns: ["nonsense"] }, DEFAULTS).visibleColumns).toEqual(["nonsense"]);
	});

	it("drops unknown keys", () => {
		expect(Object.keys(hydrateSettings({ futureThing: 1 }, DEFAULTS)).sort()).toEqual(Object.keys(DEFAULTS).sort());
	});

	it("never aliases the defaults' arrays", () => {
		const out = hydrateSettings(null, DEFAULTS);
		out.enabledGenerations.push(42);
		out.visibleColumns.push("x");
		out.favoritePokemonIds.push(1);
		expect(DEFAULTS.enabledGenerations).not.toContain(42);
		expect(DEFAULTS.visibleColumns).toEqual(["hp", "attack"]);
		expect(DEFAULTS.favoritePokemonIds).toEqual([]);
	});
});
