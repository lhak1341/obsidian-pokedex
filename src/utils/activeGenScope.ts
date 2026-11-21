import type { PokedexTableRow } from "../data/types";
import { resolveStatsForGen } from "./stats";

// Active Gen scoping (CONTEXT.md): a row's generation-tagged data is stored for
// every supported generation, and this is the one step that cuts it down to
// the user's Active Gen. Everything that shows a row takes an ActiveGenRow,
// which has no `*AllGens` fields, so reading unscoped data in a layout, a
// Field or a filter is a type error rather than a naming convention. (That
// convention was missed independently for the table cell, its tooltip, the
// detail page and the Quirks filter in one session.)
//
// - `stats`: overlaid by resolveStatsForGen (pre-buff values for the finite
//   STAT_OVERRIDES list); same name, the type says which line it is.
// - `heldItems`: only the Active Gen's rarities; an item with none is dropped
//   (Absorb Bulb, Diamond/Pearl only, disappears at Active Gen 3).
// - `encounterLocations`: only the Active Gen's locations, deduped by name and
//   sorted. describeEncounters formats them.

export interface HeldItemForGen {
	name: string;
	rarities: number[];
}

export interface ActiveEncounterLocation {
	name: string;
	region: string | null;
	method: "trade" | "gift" | "egg" | null;
	tradeFor: string | null;
}

export type ActiveGen<T extends PokedexTableRow> = Omit<T, "heldItemsAllGens" | "encounterLocationsAllGens"> & {
	heldItems: HeldItemForGen[];
	encounterLocations: ActiveEncounterLocation[];
};

export type ActiveGenRow = ActiveGen<PokedexTableRow>;

function scopeHeldItems(heldItemsAllGens: PokedexTableRow["heldItemsAllGens"], activeGen: number): HeldItemForGen[] {
	return heldItemsAllGens.flatMap((item) => {
		const rarities = item.rarities.filter((r) => r.generationId === activeGen).map((r) => r.value);
		return rarities.length === 0 ? [] : [{ name: item.name, rarities }];
	});
}

// A location's own region/method/tradeFor never vary by generation, so dedup
// by name alone is safe. Empty when the Pokemon isn't obtainable that way in
// this generation (evolve-only, legendary, or absent from ENCOUNTER_LOCATIONS).
function scopeEncounterLocations(
	encounterLocationsAllGens: PokedexTableRow["encounterLocationsAllGens"],
	activeGen: number,
): ActiveEncounterLocation[] {
	const byName = new Map<string, ActiveEncounterLocation>();
	for (const loc of encounterLocationsAllGens) {
		if (loc.generationId === activeGen) {
			byName.set(loc.name, { name: loc.name, region: loc.region, method: loc.method, tradeFor: loc.tradeFor });
		}
	}
	return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Memo per source row: the table rescopes every row on each streamed update
// (PokedexLoadState hands a new `rows` array, mostly the same row objects), and
// every row is drawn (ADR-0014), so a fresh object per row per update would
// re-render all of them. An unchanged row at an unchanged Active Gen gets back
// the identical scoped object; a new row object or a new Active Gen rescopes.
const memo = new WeakMap<PokedexTableRow, { activeGen: number; scoped: ActiveGenRow }>();

export function scopeToActiveGen<T extends PokedexTableRow>(row: T, activeGen: number): ActiveGen<T> {
	const hit = memo.get(row);
	if (hit && hit.activeGen === activeGen) return hit.scoped as ActiveGen<T>;
	const { heldItemsAllGens, encounterLocationsAllGens, ...rest } = row;
	const scoped: ActiveGen<T> = {
		...rest,
		stats: resolveStatsForGen(row.stats, row.id, activeGen),
		heldItems: scopeHeldItems(heldItemsAllGens, activeGen),
		encounterLocations: scopeEncounterLocations(encounterLocationsAllGens, activeGen),
	};
	memo.set(row, { activeGen, scoped });
	return scoped;
}

export function scopeRowsToActiveGen(rows: readonly PokedexTableRow[], activeGen: number): ActiveGenRow[] {
	return rows.map((row) => scopeToActiveGen(row, activeGen));
}
