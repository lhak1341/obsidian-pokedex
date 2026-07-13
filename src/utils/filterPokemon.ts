import { FOSSIL_IDS, GENERATIONS } from "../data/constants";
import type { PokedexTableRow, StatBlock } from "../data/types";

export interface StatRange {
	min: number;
	max: number;
}

export interface PokedexFilters {
	search: string;
	// Dual-type search: with 2+ types selected a Pokemon must have ALL of
	// them (e.g. Fire+Flying finds Charizard, not every Fire or every Flying
	// mon). With 0 selected, no type filtering is applied.
	types: string[];
	generations: number[];
	statRanges: Partial<Record<keyof StatBlock, StatRange>>;
	// OR semantics: matches if the Pokemon has ANY of the selected abilities.
	abilities: string[];
	// OR semantics: matches if the Pokemon's rarity is ANY of the selected ones.
	rarities: string[];
	// OR semantics: matches if the Pokemon's EV yield includes ANY of the
	// selected stats (e.g. selecting SpA finds every Pokemon that yields at
	// least one SpA EV, regardless of amount or what else it yields).
	evStats: string[];
	// OR semantics: matches if the Pokemon has ANY of the selected quirks
	// (see QUIRKS in data/constants.ts and matchesQuirk below).
	quirks: string[];
}

export const EMPTY_FILTERS: PokedexFilters = {
	search: "",
	types: [],
	generations: [],
	statRanges: {},
	abilities: [],
	rarities: [],
	evStats: [],
	quirks: [],
};

// Exported for QuickSearch.svelte's quick-check input, which needs the same
// substring/exact-id match as the browse table's own search rather than a
// separate reimplementation that could silently drift from it.
export function matchesSearch(row: PokedexTableRow, search: string): boolean {
	if (!search.trim()) return true;
	const needle = search.trim().toLowerCase();
	return row.name.toLowerCase().includes(needle) || String(row.id) === needle;
}

function matchesTypes(row: PokedexTableRow, types: string[]): boolean {
	if (types.length === 0) return true;
	return types.every((type) => row.types.includes(type));
}

export function isIdInGenerations(id: number, generations: number[]): boolean {
	if (generations.length === 0) return true;
	return generations.some((genId) => {
		const gen = GENERATIONS.find((g) => g.id === genId);
		return gen ? id >= gen.start && id <= gen.end : false;
	});
}

export function matchesGenerations(row: PokedexTableRow, generations: number[]): boolean {
	return isIdInGenerations(row.id, generations);
}

function matchesStatRanges(row: PokedexTableRow, ranges: PokedexFilters["statRanges"]): boolean {
	for (const [stat, range] of Object.entries(ranges) as [keyof StatBlock, StatRange][]) {
		const value = row.stats[stat];
		if (value < range.min || value > range.max) return false;
	}
	return true;
}

function matchesAbilities(row: PokedexTableRow, abilities: string[]): boolean {
	if (abilities.length === 0) return true;
	return abilities.some((ability) => row.abilityNames.includes(ability));
}

function matchesRarities(row: PokedexTableRow, rarities: string[]): boolean {
	if (rarities.length === 0) return true;
	return rarities.includes(row.rarity);
}

function matchesEvStats(row: PokedexTableRow, evStats: string[]): boolean {
	if (evStats.length === 0) return true;
	return row.evYield.some((y) => evStats.includes(y.stat));
}

// Each quirk key checks a different underlying field — a curated id list
// (fossil), an ability name (compound-eyes/pickup), or a level-up move name
// (thief/trick/covet) — see QUIRKS in data/constants.ts for the definitions
// this switch's keys must stay in sync with.
function matchesQuirk(row: PokedexTableRow, quirk: string): boolean {
	switch (quirk) {
		case "fossil":
			return FOSSIL_IDS.has(row.id);
		case "compound-eyes":
		case "pickup":
			return row.abilityNames.includes(quirk);
		case "thief":
		case "trick":
		case "covet":
			return row.levelUpMoveNames.includes(quirk);
		default:
			return false;
	}
}

function matchesQuirks(row: PokedexTableRow, quirks: string[]): boolean {
	if (quirks.length === 0) return true;
	return quirks.some((q) => matchesQuirk(row, q));
}

export function filterPokemon(rows: PokedexTableRow[], filters: PokedexFilters): PokedexTableRow[] {
	return rows.filter((row) =>
		matchesSearch(row, filters.search) &&
		matchesTypes(row, filters.types) &&
		matchesGenerations(row, filters.generations) &&
		matchesStatRanges(row, filters.statRanges) &&
		matchesAbilities(row, filters.abilities) &&
		matchesRarities(row, filters.rarities) &&
		matchesEvStats(row, filters.evStats) &&
		matchesQuirks(row, filters.quirks)
	);
}
