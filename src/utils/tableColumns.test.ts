import { describe, expect, it } from "vitest";
import type { PokedexTableRow } from "../data/types";
import {
	formatEncounterLocationsPlain, formatLocationName, groupEncounterLocations, summarizeAcquisitionMethods,
	TOGGLEABLE_COLUMNS,
} from "./tableColumns";

function makeRow(overrides: Partial<PokedexTableRow> = {}): PokedexTableRow {
	return {
		id: 1,
		dexNumber: 1,
		formLabel: null,
		generationId: 1,
		name: "bulbasaur",
		types: ["grass", "poison"],
		stats: { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 },
		evYield: [],
		abilityNames: ["overgrow"],
		levelUpMoveNames: [],
		heldItems: [],
		encounterLocations: [],
		spriteDataUri: null,
		height: 7,
		weight: 69,
		catchRate: 45,
		hatchCounter: 20,
		rarity: "normal",
		isBaby: false,
		canMegaEvolve: false,
		canGigantamax: false,
		evolutionStages: 0,
		isFinalStage: false,
		...overrides,
	};
}

function renderOf(key: string, row: PokedexTableRow): string {
	const column = TOGGLEABLE_COLUMNS.find((c) => c.key === key);
	if (!column) throw new Error(`no column registered for key "${key}"`);
	return column.render(row);
}

describe("TOGGLEABLE_COLUMNS", () => {
	it("renders a stat column as its raw value", () => {
		expect(renderOf("hp", makeRow())).toBe("45");
	});

	it("renders total as the sum of all stats", () => {
		expect(renderOf("total", makeRow())).toBe("318"); // 45+49+49+65+65+45
	});

	it("renders '-' for empty EV yield", () => {
		expect(renderOf("ev", makeRow({ evYield: [] }))).toBe("-");
	});

	it("renders EV yield entries with their stat labels, comma-joined", () => {
		const row = makeRow({ evYield: [{ stat: "specialAttack", amount: 1 }, { stat: "hp", amount: 2 }] });
		expect(renderOf("ev", row)).toBe("1 SpA, 2 HP");
	});

	it("passes catch rate and hatch counter through unchanged", () => {
		const row = makeRow({ catchRate: 200, hatchCounter: 10 });
		expect(renderOf("catchRate", row)).toBe("200");
		expect(renderOf("hatchCounter", row)).toBe("10");
	});

	it("converts height from decimeters to meters", () => {
		expect(renderOf("height", makeRow({ height: 7 }))).toBe("0.7 m");
	});

	it("converts weight from hectograms to kilograms", () => {
		expect(renderOf("weight", makeRow({ weight: 690 }))).toBe("69.0 kg");
	});

	it("renders '-' for no wild held items", () => {
		expect(renderOf("heldItems", makeRow({ heldItems: [] }))).toBe("-");
	});

	it("renders wild held item names, formatted and comma-joined", () => {
		const row = makeRow({
			heldItems: [
				{ name: "oran-berry", rarities: [{ value: 50, generationId: 3 }] },
				{ name: "leftovers", rarities: [{ value: 5, generationId: 3 }] },
			],
		});
		expect(renderOf("heldItems", row)).toBe("Oran Berry, Leftovers");
	});

	it("renders '-' for no wild encounter locations", () => {
		expect(renderOf("encounterLocation", makeRow({ encounterLocations: [] }))).toBe("-");
	});

	it("renders wild encounter location names, formatted and comma-joined", () => {
		const row = makeRow({
			encounterLocations: [
				{ name: "route-1-area", generationId: 1, region: "kanto", method: null, tradeFor: null },
				{ name: "viridian-forest-area", generationId: 1, region: "kanto", method: null, tradeFor: null },
			],
		});
		expect(renderOf("encounterLocation", row)).toBe("Route 1, Viridian Forest");
	});
});

describe("formatLocationName", () => {
	it("fully capitalizes a floor code instead of just its first letter", () => {
		expect(formatLocationName("pokemon-mansion-1f-area")).toBe("Pokemon Mansion 1F");
		expect(formatLocationName("cave-of-origin-b1f-area")).toBe("Cave of Origin B1F");
	});

	it("keeps a small connector word lowercase mid-name, English title-case style", () => {
		expect(formatLocationName("lake-of-rage-area")).toBe("Lake of Rage");
		expect(formatLocationName("lake-of-the-moone-area")).toBe("Lake of the Moone");
		expect(formatLocationName("turnback-cave-between-pillars-1-and-2")).toBe("Turnback Cave Between Pillars 1 and 2");
	});

	it("fully capitalizes a compass abbreviation instead of just its first letter", () => {
		expect(formatLocationName("safari-zone-se-area")).toBe("Safari Zone SE");
		expect(formatLocationName("safari-zone-sw-area")).toBe("Safari Zone SW");
	});

	it("still title-cases an ordinary word", () => {
		expect(formatLocationName("viridian-forest-area")).toBe("Viridian Forest");
	});

	it("splits PokeAPI's hyphen-less compass+bike fusion into a compass letter plus a parenthetical", () => {
		// Raw PokeAPI slugs, verified live: "...-neacro-bike-area" and
		// "...-nwmach-bike-area" — no hyphen between the compass direction and
		// the bike name at all, unlike every other word boundary in a location
		// slug, so a plain split("-") can't separate them on its own.
		expect(formatLocationName("hoenn-safari-zone-neacro-bike-area")).toBe("Hoenn Safari Zone NE (Acro Bike)");
		expect(formatLocationName("hoenn-safari-zone-nwmach-bike-area")).toBe("Hoenn Safari Zone NW (Mach Bike)");
	});
});

// Test helper matching ActiveEncounterLocation's shape (filterEncounterLocationsForGen's
// output) — region/method/tradeFor default to null (the common wild, single-region case).
function loc(
	name: string,
	region: string | null = null,
	method: "trade" | "gift" | "egg" | null = null,
	tradeFor: string | null = null,
): { name: string; region: string | null; method: "trade" | "gift" | "egg" | null; tradeFor: string | null } {
	return { name, region, method, tradeFor };
}

describe("groupEncounterLocations", () => {
	it("groups same-prefix rest names and sorts a numeric suffix run ascending", () => {
		const groups = groupEncounterLocations(
			["route-8-area", "route-4-area", "route-9-area", "route-10-area", "route-11-area", "route-23-area"]
				.map((n) => loc(n)),
		);
		expect(groups).toEqual([{ region: null, text: "Route 4, 8, 9, 10, 11, 23" }]);
	});

	it("fully capitalizes a compass-abbreviation suffix run, not just its first letter", () => {
		const groups = groupEncounterLocations(["safari-zone-se-area", "safari-zone-sw-area"].map((n) => loc(n)));
		expect(groups).toEqual([{ region: null, text: "Safari Zone SE, SW" }]);
	});

	it("splits into one group per region (from the location's own real region, not a name guess), in region order", () => {
		const groups = groupEncounterLocations([
			// "mirage-tower-area" has no "hoenn-" prefix — PokeAPI only adds one
			// when disambiguation is actually needed — so its region must come
			// from the passed-in field, not be guessed from the name.
			loc("hoenn-route-111-area", "hoenn"), loc("hoenn-route-113-area", "hoenn"), loc("mirage-tower-area", "hoenn"),
			loc("kanto-route-4-area", "kanto"), loc("kanto-route-8-area", "kanto"), loc("kanto-route-9-area", "kanto"),
			loc("kanto-route-10-area", "kanto"), loc("kanto-route-11-area", "kanto"), loc("kanto-route-23-area", "kanto"),
		]);
		expect(groups).toEqual([
			{ region: "Kanto", text: "Route 4, 8, 9, 10, 11, 23" },
			{ region: "Hoenn", text: "Route 111, 113; Mirage Tower" },
		]);
	});

	it("keeps a non-numeric suffix run in arrival order (does not force a numeric sort)", () => {
		const groups = groupEncounterLocations(
			["cave-of-origin-1f-area", "cave-of-origin-b1f-area", "cave-of-origin-entrance-area"].map((n) => loc(n)),
		);
		expect(groups).toEqual([{ region: null, text: "Cave of Origin 1F, B1F, Entrance" }]);
	});

	it("never merges two unrelated single-word names", () => {
		expect(groupEncounterLocations([loc("route-area"), loc("cave-area")])).toEqual([
			{ region: null, text: "Route; Cave" },
		]);
	});

	it("returns no groups for no locations", () => {
		expect(groupEncounterLocations([])).toEqual([]);
	});

	it("puts a wild location and a trade spot on separate lines, never merged", () => {
		// Jynx, Gen 1/3: trade a Poliwhirl for it in Cerulean City — not a wild
		// encounter at all, so lumping it into the wild line would misread as
		// one. A mix of wild + non-wild for the same Pokemon should read as
		// separate bullet-worthy lines, not one semicolon-joined sentence.
		const groups = groupEncounterLocations([
			loc("cerulean-city-area", "kanto", "trade", "poliwhirl"),
			loc("kanto-route-4-area", "kanto"),
		]);
		expect(groups).toEqual([
			{ region: "Kanto", text: "Route 4" },
			{ region: "Kanto", text: "Trade Poliwhirl @ Cerulean City" },
		]);
	});

	it("keeps two different trade spots on their own separate lines, in arrival order", () => {
		const groups = groupEncounterLocations([
			loc("cerulean-city-area", "kanto", "trade", "poliwhirl"),
			loc("cerulean-city-gym-area", "kanto", "trade", "machoke"),
		]);
		expect(groups).toEqual([
			{ region: "Kanto", text: "Trade Poliwhirl @ Cerulean City" },
			{ region: "Kanto", text: "Trade Machoke @ Cerulean City Gym" },
		]);
	});

	it("renders a gift spot as 'Gift @ Location' (starters share this method — PokeAPI has no separate 'starter' tag)", () => {
		const groups = groupEncounterLocations([loc("pallet-town-area", "kanto", "gift")]);
		expect(groups).toEqual([{ region: "Kanto", text: "Gift @ Pallet Town" }]);
	});

	it("renders an egg spot as 'Egg @ Location'", () => {
		const groups = groupEncounterLocations([loc("goldenrod-city-area", "johto", "egg")]);
		expect(groups).toEqual([{ region: "Johto", text: "Egg @ Goldenrod City" }]);
	});
});

describe("formatEncounterLocationsPlain", () => {
	it("returns the bare text with no header for a single region", () => {
		expect(formatEncounterLocationsPlain(groupEncounterLocations([loc("pallet-town-area")]))).toBe("Pallet Town");
	});

	it("prefixes each region with its own newline-separated header when there's more than one", () => {
		const plain = formatEncounterLocationsPlain(
			groupEncounterLocations([loc("kanto-route-4-area", "kanto"), loc("mirage-tower-area", "hoenn")]),
		);
		expect(plain).toBe("Kanto: Route 4\nHoenn: Mirage Tower");
	});

	it("skips the region header for multiple lines sharing one single region (wild + trade)", () => {
		const plain = formatEncounterLocationsPlain(
			groupEncounterLocations([
				loc("kanto-route-4-area", "kanto"),
				loc("cerulean-city-area", "kanto", "trade", "poliwhirl"),
			]),
		);
		expect(plain).toBe("Route 4\nTrade Poliwhirl @ Cerulean City");
	});
});

describe("summarizeAcquisitionMethods", () => {
	it("labels a plain wild encounter as 'Wild'", () => {
		expect(summarizeAcquisitionMethods([loc("kanto-route-2-south-towards-viridian-city", "kanto")])).toBe("Wild");
	});

	it("labels a trade/gift/egg spot by its own method, not the place", () => {
		expect(summarizeAcquisitionMethods([loc("cerulean-city-area", "kanto", "trade", "poliwhirl")])).toBe("Trade");
		expect(summarizeAcquisitionMethods([loc("pallet-town-area", "kanto", "gift")])).toBe("Gift");
		expect(summarizeAcquisitionMethods([loc("goldenrod-city-area", "johto", "egg")])).toBe("Egg");
	});

	it("dedupes and orders multiple distinct methods (Wild, Trade, Gift, Egg)", () => {
		const methods = summarizeAcquisitionMethods([
			loc("pallet-town-area", "kanto", "gift"),
			loc("kanto-route-1-area", "kanto"),
			loc("kanto-route-1-area", "kanto"),
		]);
		expect(methods).toBe("Wild, Gift");
	});

	it("returns an empty string for no locations", () => {
		expect(summarizeAcquisitionMethods([])).toBe("");
	});
});
