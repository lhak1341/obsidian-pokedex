import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, type PokedexFilters } from "./filterPokemon";
import { activeFilterGroups, FILTER_GROUP_KEYS, filterGroupCount } from "./filterGroups";
import { sampleFilters } from "./__fixtures__/filterGroupSamples";

function filters(over: Partial<PokedexFilters>): PokedexFilters {
	return { ...EMPTY_FILTERS, statRanges: {}, ...over };
}

describe("activeFilterGroups", () => {
	it("has no active group when nothing is filtered", () => {
		expect(activeFilterGroups(EMPTY_FILTERS)).toEqual([]);
	});

	it("names each chip group with a selection once, in panel order", () => {
		const active = activeFilterGroups(
			filters({ quirks: ["q"], types: ["fire", "flying"], generations: [1], abilities: ["blaze"], rarities: ["legendary"], evStats: ["hp"], traits: ["baby"] }),
		);
		expect(active).toEqual(["type", "gen", "ability", "rarity", "ev", "traits", "quirks"]);
	});

	it("counts Stats when a range is narrower than 0 to 255", () => {
		expect(activeFilterGroups(filters({ statRanges: { speed: { min: 100, max: 255 } } }))).toEqual(["stats"]);
		expect(activeFilterGroups(filters({ statRanges: { hp: { min: 0, max: 80 } } }))).toEqual(["stats"]);
	});

	it("does not count Stats for a range edited back to the full 0 to 255", () => {
		expect(activeFilterGroups(filters({ statRanges: { hp: { min: 0, max: 255 } } }))).toEqual([]);
	});

	it("counts each chip group's selections, and gives Stats no count", () => {
		const f = filters({ types: ["fire", "flying"], abilities: ["blaze"], quirks: ["a", "b", "c"], statRanges: { hp: { min: 9, max: 255 } } });
		expect(filterGroupCount(f, "type")).toBe(2);
		expect(filterGroupCount(f, "ability")).toBe(1);
		expect(filterGroupCount(f, "quirks")).toBe(3);
		expect(filterGroupCount(f, "gen")).toBe(0);
		expect(filterGroupCount(f, "stats")).toBeUndefined();
	});

	it("does not count search or the favourites toggle", () => {
		expect(activeFilterGroups(filters({ search: "char", favoritesOnly: true }))).toEqual([]);
	});
});

describe("filter group samples", () => {
	// Each group's count and active rule see its own selection: a count left
	// at 0 (or wired to another group's field) drops the group from
	// Filters (n) and from the panel's open sections.
	it("each group's selection makes that group, and only it, active", () => {
		for (const key of FILTER_GROUP_KEYS) {
			expect(activeFilterGroups(sampleFilters(key)), key).toEqual([key]);
		}
	});
});
