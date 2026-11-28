import { GENERATIONS } from "../data/constants";
import type { PokedexTableRow, StatBlock } from "../data/types";
import { formatPokemonDisplayName } from "./pokemonDisplay";
import type { ActiveGenRow } from "./activeGenScope";
import type { FilterGroupKey } from "./filterGroups";
import { type FlagDef, QUIRKS, TRAITS } from "./quirksAndTraits";

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
	// (see QUIRKS in utils/quirksAndTraits.ts and matchesQuirks below).
	quirks: string[];
	// AND semantics, same idiom as `types` above: a Pokemon must have ALL
	// selected traits (see TRAITS in utils/quirksAndTraits.ts and
	// matchesTraits below) — unlike quirks, these are independent yes/no properties with
	// no meaningful "any of" reading (e.g. Baby + Fossil should mean both).
	traits: string[];
	// Not derivable from a PokedexTableRow field — favorites are user state
	// (BrowseScreen's right-click menu), not fetched data, so filterPokemon
	// takes the actual favorite id set as a separate argument (see below)
	// rather than this flag alone.
	favoritesOnly: boolean;
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
	favoritesOnly: false,
};

// Exported for QuickSearch.svelte's quick-check input, which needs the same
// substring/exact-id match as the browse table's own search rather than a
// separate reimplementation that could silently drift from it. Matches
// against the *display* name ("Alolan Rattata"), not the shared base `name`
// alone, so typing "alola" finds only the regional-form row while typing
// "rattata" still finds both it and the base row. Exact-number search keys
// off dexNumber (the shared "No. 019"), not `id` (each row's own distinct
// fetch id) — typing "19" should surface every form at that dex number.
export function matchesSearch(row: Pick<PokedexTableRow, "name" | "formLabel" | "dexNumber">, search: string): boolean {
	if (!search.trim()) return true;
	const needle = search.trim().toLowerCase();
	return formatPokemonDisplayName(row).toLowerCase().includes(needle) || String(row.dexNumber) === needle;
}

function matchesTypes(row: ActiveGenRow, types: string[]): boolean {
	if (types.length === 0) return true;
	return types.every((type) => row.types.includes(type));
}

// Pure dex-*number* range membership for a bare id with no row behind it —
// generationScope.ts exposes it as `includesFailedId` for fetches that failed
// before a row existed. Deliberately NOT used for row-visibility filtering
// (see matchesGenerations below, and ADR-0001): a
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

function matchesStatRanges(row: ActiveGenRow, ranges: PokedexFilters["statRanges"]): boolean {
	for (const [stat, range] of Object.entries(ranges) as [keyof StatBlock, StatRange][]) {
		const value = row.stats[stat];
		if (value < range.min || value > range.max) return false;
	}
	return true;
}

function matchesAbilities(row: ActiveGenRow, abilities: string[]): boolean {
	if (abilities.length === 0) return true;
	return abilities.some((ability) => row.abilityNames.includes(ability));
}

function matchesRarities(row: ActiveGenRow, rarities: string[]): boolean {
	if (rarities.length === 0) return true;
	return rarities.includes(row.rarity);
}

function matchesEvStats(row: ActiveGenRow, evStats: string[]): boolean {
	if (evStats.length === 0) return true;
	return row.evYield.some((y) => evStats.includes(y.stat));
}

// A selected key with no entry in `defs` matches nothing (same as the old
// switches' `default: return false`).
function matchesFlag(defs: readonly FlagDef[], key: string, row: ActiveGenRow): boolean {
	return defs.find((d) => d.key === key)?.matches(row) ?? false;
}

function matchesQuirks(row: ActiveGenRow, quirks: string[]): boolean {
	if (quirks.length === 0) return true;
	return quirks.some((q) => matchesFlag(QUIRKS, q, row));
}

function matchesTraits(row: ActiveGenRow, traits: string[]): boolean {
	if (traits.length === 0) return true;
	return traits.every((t) => matchesFlag(TRAITS, t, row));
}

function matchesFavorite(row: ActiveGenRow, favoritesOnly: boolean, favoriteIds: ReadonlySet<number>): boolean {
	if (!favoritesOnly) return true;
	return favoriteIds.has(row.id);
}

// Each filter group's predicate (FILTER_GROUP_KEYS, utils/filterGroups.ts;
// CONTEXT.md "Filter group"). A Record, so a new group key fails typecheck
// here until it filters: a group whose chips draw but never narrow the list
// cannot compile. Its count is filterGroups.ts's, its chrome FilterBar's
// GROUP_CHROME, each a Record over the same key (ADR-0027). Search and the
// favourites toggle are filters but not groups; filterPokemon applies them
// itself.
const GROUP_MATCHES: Record<FilterGroupKey, (row: ActiveGenRow, filters: PokedexFilters) => boolean> = {
	type: (row, f) => matchesTypes(row, f.types),
	gen: (row, f) => matchesGenerations(row, f.generations),
	ability: (row, f) => matchesAbilities(row, f.abilities),
	stats: (row, f) => matchesStatRanges(row, f.statRanges),
	rarity: (row, f) => matchesRarities(row, f.rarities),
	ev: (row, f) => matchesEvStats(row, f.evStats),
	traits: (row, f) => matchesTraits(row, f.traits),
	quirks: (row, f) => matchesQuirks(row, f.quirks),
};
const GROUP_PREDICATES = Object.values(GROUP_MATCHES);

// External context not derivable from a row field (favorites are user state).
// favoriteIds is safely omittable: an omitted set matches nothing extra;
// favoritesOnly still gates it. Active Gen is not here: rows arrive already
// scoped to it (ActiveGenRow, activeGenScope.ts).
export interface FilterContext {
	favoriteIds?: ReadonlySet<number>;
}

export function filterPokemon(
	rows: ActiveGenRow[],
	filters: PokedexFilters,
	context: FilterContext = {},
): ActiveGenRow[] {
	const favoriteIds = context.favoriteIds ?? new Set<number>();
	return rows.filter((row) =>
		matchesSearch(row, filters.search) &&
		GROUP_PREDICATES.every((matches) => matches(row, filters)) &&
		matchesFavorite(row, filters.favoritesOnly, favoriteIds)
	);
}
