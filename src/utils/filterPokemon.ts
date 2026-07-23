import { FOSSIL_IDS, GENERATIONS } from "../data/constants";
import type { PokedexTableRow, StatBlock } from "../data/types";
import { formatPokemonDisplayName } from "./pokemonDisplay";

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
	// AND semantics, same idiom as `types` above: a Pokemon must have ALL
	// selected traits (see TRAITS in data/constants.ts and matchesTrait
	// below) — unlike quirks, these are independent yes/no properties with
	// no meaningful "any of" reading (e.g. Baby + Fossil should mean both).
	traits: string[];
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
	traits: [],
};

// Exported for QuickSearch.svelte's quick-check input, which needs the same
// substring/exact-id match as the browse table's own search rather than a
// separate reimplementation that could silently drift from it. Matches
// against the *display* name ("Alolan Rattata"), not the shared base `name`
// alone, so typing "alola" finds only the regional-form row while typing
// "rattata" still finds both it and the base row. Exact-number search keys
// off dexNumber (the shared "No. 019"), not `id` (each row's own distinct
// fetch id) — typing "19" should surface every form at that dex number.
export function matchesSearch(row: PokedexTableRow, search: string): boolean {
	if (!search.trim()) return true;
	const needle = search.trim().toLowerCase();
	return formatPokemonDisplayName(row).toLowerCase().includes(needle) || String(row.dexNumber) === needle;
}

function matchesTypes(row: PokedexTableRow, types: string[]): boolean {
	if (types.length === 0) return true;
	return types.every((type) => row.types.includes(type));
}

// Pure dex-*number* range membership — used by generationScope.ts to decide
// which base ids to fetch at all, before any row exists yet. Deliberately
// NOT used for row-visibility filtering (see matchesGenerations below): a
// regional-form row's own generation membership isn't derivable from a dex
// range at all (see PokedexTableRow.generationId's own doc comment).
export function isIdInGenerations(id: number, generations: number[]): boolean {
	if (generations.length === 0) return true;
	return generations.some((genId) => {
		const gen = GENERATIONS.find((g) => g.id === genId);
		return gen ? id >= gen.start && id <= gen.end : false;
	});
}

// A regional-form row is always fetched alongside its base species (see
// PokedexRepository.getRowsForIds) regardless of whether the form's own
// generation is enabled — cheap since only ~18 species currently have one —
// so this is the actual gate that hides it from view when e.g. Gen 7 is
// disabled even though Gen 1 (its base dex number's generation) isn't.
// Narrowed to just the one field it reads (rather than the full row) so
// PokedexLoadState can also check a bare failed id's generation membership
// without needing to fabricate a whole fake row — see generationScope.ts.
export function matchesGenerations(row: Pick<PokedexTableRow, "generationId">, generations: number[]): boolean {
	if (generations.length === 0) return true;
	return generations.includes(row.generationId);
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

// Each quirk key checks a different underlying field — an array-length check
// (held-item), an ability name (compound-eyes/pickup), or a level-up move
// name (thief/trick/covet) — see QUIRKS in data/constants.ts for the
// definitions this switch's keys must stay in sync with. Fossil and the
// evolution-stage buckets live in matchesTrait below instead (see TRAITS'
// own comment for why); held-item stays here rather than moving alongside
// fossil, since "pickup OR holds an item" is a meaningful combined search
// the way "baby AND fossil" isn't.
function matchesQuirk(row: PokedexTableRow, quirk: string): boolean {
	switch (quirk) {
		case "held-item":
			return row.heldItemNames.length > 0;
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

// Each trait key checks a different independent yes/no property — a curated
// id list (fossil, same FOSSIL_IDS as before) or a derived-at-load-time
// boolean (baby/mega/gigantamax) — see TRAITS in data/constants.ts for the
// definitions this switch's keys must stay in sync with.
function matchesTrait(row: PokedexTableRow, trait: string): boolean {
	switch (trait) {
		case "baby":
			return row.isBaby;
		case "fossil":
			return FOSSIL_IDS.has(row.dexNumber);
		case "mega":
			return row.canMegaEvolve;
		// Bucketed off the whole-family evolutionStages value — see TRAITS in
		// data/constants.ts for the AND-semantics note.
		case "no-evolution":
			return row.evolutionStages === 0;
		case "one-evolution":
			return row.evolutionStages === 1;
		case "two-plus-evolutions":
			return row.evolutionStages >= 2;
		case "gigantamax":
			return row.canGigantamax;
		default:
			return false;
	}
}

function matchesTraits(row: PokedexTableRow, traits: string[]): boolean {
	if (traits.length === 0) return true;
	return traits.every((t) => matchesTrait(row, t));
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
		matchesQuirks(row, filters.quirks) &&
		matchesTraits(row, filters.traits)
	);
}
