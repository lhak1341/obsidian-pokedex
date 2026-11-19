import type { PokedexFilters, StatRange } from "./filterPokemon";

// The Stats group's inputs span every possible base stat; a range left at (or
// edited back to) the full span filters nothing, so it is not an active group.
export const FULL_STAT_RANGE: StatRange = { min: 0, max: 255 };

// The eight filter groups, in the order the rail and the Narrow pane's inline
// Filters panel draw them. Search and the favourites toggle are not groups:
// they sit in the toolbar's own row.
export const FILTER_GROUP_KEYS = ["type", "gen", "ability", "stats", "rarity", "ev", "traits", "quirks"] as const;
export type FilterGroupKey = (typeof FILTER_GROUP_KEYS)[number];

// How many selections a chip group holds, drawn as its badge on a rail segment
// or panel section. Stats has no count (it would count stats, not chips).
export function filterGroupCount(filters: PokedexFilters, key: FilterGroupKey): number | undefined {
	switch (key) {
		case "type": return filters.types.length;
		case "gen": return filters.generations.length;
		case "ability": return filters.abilities.length;
		case "stats": return undefined;
		case "rarity": return filters.rarities.length;
		case "ev": return filters.evStats.length;
		case "traits": return filters.traits.length;
		case "quirks": return filters.quirks.length;
	}
}

function isGroupActive(filters: PokedexFilters, key: FilterGroupKey): boolean {
	if (key === "stats") {
		return Object.values(filters.statRanges).some(
			(range) => range !== undefined && (range.min > FULL_STAT_RANGE.min || range.max < FULL_STAT_RANGE.max),
		);
	}
	return (filterGroupCount(filters, key) ?? 0) > 0;
}

// The groups narrowing the list: Filters (n) counts them, and the inline panel
// opens with only these sections expanded.
export function activeFilterGroups(filters: PokedexFilters): FilterGroupKey[] {
	return FILTER_GROUP_KEYS.filter((key) => isGroupActive(filters, key));
}
