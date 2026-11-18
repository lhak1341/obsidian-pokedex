import { DEFAULT_FONT_ROLE_SETTINGS } from "@lhak/style/obsidian-helpers/font-roles";
import { describe, expect, it } from "vitest";
import { GENERATIONS } from "../data/constants";
import type { PluginSettings } from "../data/types";
import { hydrateSettings } from "./settingsHydrate";

const DEFAULTS: PluginSettings = {
	...DEFAULT_FONT_ROLE_SETTINGS,
	enabledGenerations: GENERATIONS.map((g) => g.id),
	spriteStyle: "official-artwork",
	gridDensity: "comfortable",
	defaultSortColumn: "id",
	visibleFields: ["hp", "attack"],
	useTypeIcons: false,
	activeGen: 9,
	favoritePokemonIds: [],
	reduceMotion: false,
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
			visibleFields: ["hp"],
			useTypeIcons: true,
			activeGen: 3,
			favoritePokemonIds: [25, 6],
			reduceMotion: true,
		};
		expect(hydrateSettings(saved, DEFAULTS)).toEqual(saved);
	});

	it.each([null, undefined, "x", 5, []])("returns the defaults for non-object saved %j", (saved) => {
		expect(hydrateSettings(saved, DEFAULTS)).toEqual(DEFAULTS);
	});

	// The shared @lhak/style font-role helper reads the font keys (lhak-style-adoption 07).
	it("keeps every saved font choice and custom family", () => {
		const fonts = {
			fontHeading: "obsidian-interface",
			fontHeadingCustom: "",
			fontBody: "custom",
			fontBodyCustom: "Iowan Old Style",
			fontMono: "obsidian-monospace",
			fontMonoCustom: "JetBrains Mono",
		} as const;
		expect(hydrateSettings(fonts, DEFAULTS)).toEqual({ ...DEFAULTS, ...fonts });
	});

	it("reads the old \"pokedex\" font choice as the shared \"default\" (both follow the theme)", () => {
		const out = hydrateSettings({ fontHeading: "pokedex", fontBody: "pokedex", fontMono: "pokedex" }, DEFAULTS);
		expect([out.fontHeading, out.fontBody, out.fontMono]).toEqual(["default", "default", "default"]);
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
		["reduceMotion", "on"],
		["reduceMotion", 1],
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

	it("falls back when visibleFields / favoritePokemonIds are not arrays, without checking their contents", () => {
		const out = hydrateSettings({ visibleFields: "hp", favoritePokemonIds: 5 }, DEFAULTS);
		expect(out.visibleFields).toEqual(DEFAULTS.visibleFields);
		expect(out.favoritePokemonIds).toEqual([]);
		expect(hydrateSettings({ visibleFields: ["nonsense"] }, DEFAULTS).visibleFields).toEqual(["nonsense"]);
	});

	// #22: the setting was renamed visibleColumns → visibleFields. One-way:
	// the old key is read only when the new one is absent, and the result
	// carries only the new key, so the next save drops the old one.
	describe("visibleColumns → visibleFields migration", () => {
		it("migrates an old visibleColumns selection when visibleFields is absent", () => {
			const out = hydrateSettings({ visibleColumns: ["speed", "catchRate"] }, DEFAULTS);
			expect(out.visibleFields).toEqual(["speed", "catchRate"]);
			expect(Object.keys(out)).not.toContain("visibleColumns");
		});

		it("prefers visibleFields when both keys are present", () => {
			const out = hydrateSettings({ visibleColumns: ["speed"], visibleFields: ["weight"] }, DEFAULTS);
			expect(out.visibleFields).toEqual(["weight"]);
		});

		it("gives a fresh install the default Fields", () => {
			expect(hydrateSettings({}, DEFAULTS).visibleFields).toEqual(["hp", "attack"]);
		});

		it("does not widen a saved selection to the new default", () => {
			// An empty selection is a real choice ("show no Fields"), not "unset".
			expect(hydrateSettings({ visibleColumns: [] }, DEFAULTS).visibleFields).toEqual([]);
			expect(hydrateSettings({ visibleFields: ["hp"] }, DEFAULTS).visibleFields).toEqual(["hp"]);
		});
	});

	// #26: an older data.json has no reduceMotion; it reads as off.
	it("reads a missing reduceMotion as off and round-trips a saved one", () => {
		expect(hydrateSettings({}, DEFAULTS).reduceMotion).toBe(false);
		expect(hydrateSettings({ reduceMotion: true }, DEFAULTS).reduceMotion).toBe(true);
		const once = hydrateSettings({ reduceMotion: true }, DEFAULTS);
		expect(hydrateSettings(JSON.parse(JSON.stringify(once)), DEFAULTS)).toEqual(once);
	});

	it("drops unknown keys", () => {
		expect(Object.keys(hydrateSettings({ futureThing: 1 }, DEFAULTS)).sort()).toEqual(Object.keys(DEFAULTS).sort());
	});

	it("never aliases the defaults' arrays", () => {
		const out = hydrateSettings(null, DEFAULTS);
		out.enabledGenerations.push(42);
		out.visibleFields.push("x");
		out.favoritePokemonIds.push(1);
		expect(DEFAULTS.enabledGenerations).not.toContain(42);
		expect(DEFAULTS.visibleFields).toEqual(["hp", "attack"]);
		expect(DEFAULTS.favoritePokemonIds).toEqual([]);
	});
});
