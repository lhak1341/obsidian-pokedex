import { describe, expect, it } from "vitest";
import {
	describeEncounters, filterEncounterLocationsForGen, formatEncounterLocationsPlain, formatLocationName,
	groupEncounterLocations, summarizeAcquisitionMethods,
} from "./encounters";

describe("filterEncounterLocationsForGen", () => {
	it("keeps only locations from the active generation, sorted, carrying their region and method", () => {
		const locations = [
			{ name: "route-1-area", generationId: 1, region: "kanto", method: null, tradeFor: null },
			{ name: "viridian-forest-area", generationId: 1, region: "kanto", method: null, tradeFor: null },
			{ name: "kanto-route-1-area", generationId: 7, region: "kanto", method: null, tradeFor: null },
		];
		expect(filterEncounterLocationsForGen(locations, 1)).toEqual([
			{ name: "route-1-area", region: "kanto", method: null, tradeFor: null },
			{ name: "viridian-forest-area", region: "kanto", method: null, tradeFor: null },
		]);
		expect(filterEncounterLocationsForGen(locations, 7))
			.toEqual([{ name: "kanto-route-1-area", region: "kanto", method: null, tradeFor: null }]);
	});

	it("carries method/tradeFor through for an NPC-trade spot (Jynx: trade a Poliwhirl in Cerulean City)", () => {
		const locations = [
			{ name: "cerulean-city-area", generationId: 3, region: "kanto", method: "trade" as const, tradeFor: "poliwhirl" },
		];
		expect(filterEncounterLocationsForGen(locations, 3))
			.toEqual([{ name: "cerulean-city-area", region: "kanto", method: "trade", tradeFor: "poliwhirl" }]);
	});

	it("carries method through for a gift/egg spot", () => {
		const locations = [
			{ name: "pallet-town-area", generationId: 3, region: "kanto", method: "gift" as const, tradeFor: null },
		];
		expect(filterEncounterLocationsForGen(locations, 3))
			.toEqual([{ name: "pallet-town-area", region: "kanto", method: "gift", tradeFor: null }]);
	});

	it("dedupes a location repeated across multiple games of the same generation", () => {
		const locations = [
			{ name: "route-1-area", generationId: 1, region: "kanto", method: null, tradeFor: null },
			{ name: "route-1-area", generationId: 1, region: "kanto", method: null, tradeFor: null },
		];
		expect(filterEncounterLocationsForGen(locations, 1))
			.toEqual([{ name: "route-1-area", region: "kanto", method: null, tradeFor: null }]);
	});

	it("returns an empty list for a generation with no wild encounters", () => {
		expect(filterEncounterLocationsForGen(
			[{ name: "route-1-area", generationId: 1, region: "kanto", method: null, tradeFor: null }],
			3,
		)).toEqual([]);
		expect(filterEncounterLocationsForGen([], 1)).toEqual([]);
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


describe("describeEncounters", () => {
	const raw = (
		name: string,
		generationId: number,
		region: string | null = "kanto",
		method: "trade" | "gift" | "egg" | null = null,
		tradeFor: string | null = null,
	) => ({ name, generationId, region, method, tradeFor });

	it("is empty, with blank text, when nothing is available in the Active Gen", () => {
		expect(describeEncounters([], 1)).toEqual({ isEmpty: true, summary: "", tooltip: "", groups: [], showRegion: false });
		const outOfGen = describeEncounters([raw("route-1-area", 3)], 1);
		expect(outOfGen.isEmpty).toBe(true);
	});

	it("scopes to the Active Gen, so the same locations read differently per generation", () => {
		const locations = [raw("route-1-area", 1), raw("kanto-route-1-area", 7, "kanto", "gift")];
		expect(describeEncounters(locations, 1).summary).toBe("Wild");
		expect(describeEncounters(locations, 7).summary).toBe("Gift");
	});

	it("builds the cell summary, tooltip and detail lines from one scoped list", () => {
		const view = describeEncounters(
			[raw("route-1-area", 1), raw("cerulean-city-area", 1, "kanto", "trade", "poliwhirl")],
			1,
		);
		expect(view.isEmpty).toBe(false);
		expect(view.summary).toBe("Wild, Trade");
		expect(view.groups).toEqual([
			{ region: "Kanto", text: "Route 1" },
			{ region: "Kanto", text: "Trade Poliwhirl @ Cerulean City" },
		]);
		// One region, two lines: no region header on either (matches the tooltip).
		expect(view.showRegion).toBe(false);
		expect(view.tooltip).toBe("Route 1\nTrade Poliwhirl @ Cerulean City");
	});

	it("shows region headers only when more than one distinct region is present", () => {
		const view = describeEncounters(
			[raw("route-1-area", 3, "kanto"), raw("hoenn-route-101-area", 3, "hoenn")],
			3,
		);
		expect(view.showRegion).toBe(true);
		expect(view.tooltip).toBe("Kanto: Route 1\nHoenn: Route 101");
	});
});
