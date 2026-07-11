import { GENERATIONS } from "../data/constants";
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
}

export const EMPTY_FILTERS: PokedexFilters = {
	search: "",
	types: [],
	generations: [],
	statRanges: {},
	abilities: [],
};

function matchesSearch(row: PokedexTableRow, search: string): boolean {
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

export function filterPokemon(rows: PokedexTableRow[], filters: PokedexFilters): PokedexTableRow[] {
	return rows.filter((row) =>
		matchesSearch(row, filters.search) &&
		matchesTypes(row, filters.types) &&
		matchesGenerations(row, filters.generations) &&
		matchesStatRanges(row, filters.statRanges) &&
		matchesAbilities(row, filters.abilities)
	);
}
