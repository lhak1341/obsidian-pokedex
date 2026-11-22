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
	cardFields: ["hp", "total"],
	cardSizeByWidthClass: { narrow: "small", wide: "small" },
	useTypeIcons: false,
	activeGen: 9,
	favoritePokemonIds: [],
	reduceMotion: false,
	layoutByWidthClass: { narrow: "card", wide: "table" },
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
			cardFields: ["speed", "ev"],
			useTypeIcons: true,
			activeGen: 3,
			favoritePokemonIds: [25, 6],
			reduceMotion: true,
			layoutByWidthClass: { narrow: "table", wide: "card" },
			cardSizeByWidthClass: { narrow: "large", wide: "medium" },
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

	// ADR-0020: Card view got its own selection. Before it the tile drew the
	// Tile Fields of the shared one, so an upgrade keeps exactly those.
	describe("cardFields", () => {
		it("seeds an older data.json's from the saved selection's Tile Fields", () => {
			const out = hydrateSettings({ visibleFields: ["weight", "speed", "total", "heldItems", "ev"] }, DEFAULTS);
			expect(out.cardFields).toEqual(["speed", "total", "ev"]);
			expect(out.visibleFields).toEqual(["weight", "speed", "total", "heldItems", "ev"]);
		});

		it("seeds from an even older visibleColumns selection too", () => {
			expect(hydrateSettings({ visibleColumns: ["catchRate", "hp"] }, DEFAULTS).cardFields).toEqual(["hp"]);
		});

		it("keeps a saved one as it is, even empty, whatever the table's", () => {
			expect(hydrateSettings({ visibleFields: ["hp"], cardFields: [] }, DEFAULTS).cardFields).toEqual([]);
			expect(hydrateSettings({ visibleFields: [], cardFields: ["ev"] }, DEFAULTS).cardFields).toEqual(["ev"]);
		});

		it("gives a fresh install the default", () => {
			expect(hydrateSettings({}, DEFAULTS).cardFields).toEqual(["hp", "total"]);
		});
	});

	// Card size per width class. An older data.json has none: small, the tile
	// as it was.
	describe("cardSizeByWidthClass", () => {
		it("gives an older data.json small tiles in both classes", () => {
			expect(hydrateSettings({}, DEFAULTS).cardSizeByWidthClass).toEqual({ narrow: "small", wide: "small" });
		});

		it("repairs an unknown size class by class, keeping the other", () => {
			const out = hydrateSettings({ cardSizeByWidthClass: { narrow: "huge", wide: "large" } }, DEFAULTS);
			expect(out.cardSizeByWidthClass).toEqual({ narrow: "small", wide: "large" });
		});
	});

	// #26: an older data.json has no reduceMotion; it reads as off.
	it("reads a missing reduceMotion as off and round-trips a saved one", () => {
		expect(hydrateSettings({}, DEFAULTS).reduceMotion).toBe(false);
		expect(hydrateSettings({ reduceMotion: true }, DEFAULTS).reduceMotion).toBe(true);
		const once = hydrateSettings({ reduceMotion: true }, DEFAULTS);
		expect(hydrateSettings(JSON.parse(JSON.stringify(once)), DEFAULTS)).toEqual(once);
	});

	// #27: the browse layout per width class. An older data.json has none.
	describe("layoutByWidthClass", () => {
		it("gives an older data.json Card view on a Narrow pane and the table on a wide one", () => {
			expect(hydrateSettings({}, DEFAULTS).layoutByWidthClass).toEqual({ narrow: "card", wide: "table" });
		});

		it("round-trips a saved choice", () => {
			const once = hydrateSettings({ layoutByWidthClass: { narrow: "table", wide: "card" } }, DEFAULTS);
			expect(once.layoutByWidthClass).toEqual({ narrow: "table", wide: "card" });
			expect(hydrateSettings(JSON.parse(JSON.stringify(once)), DEFAULTS)).toEqual(once);
		});

		it.each([
			["a non-object", "card", { narrow: "card", wide: "table" }],
			["an unknown layout per class", { narrow: "list", wide: "card" }, { narrow: "card", wide: "card" }],
			["a missing class", { wide: "card" }, { narrow: "card", wide: "card" }],
		])("repairs %s, class by class", (_label, bad, expected) => {
			expect(hydrateSettings({ layoutByWidthClass: bad }, DEFAULTS).layoutByWidthClass).toEqual(expected);
		});

		it("never aliases the defaults' object", () => {
			const out = hydrateSettings(null, DEFAULTS);
			out.layoutByWidthClass.narrow = "table";
			expect(DEFAULTS.layoutByWidthClass.narrow).toBe("card");
		});
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
