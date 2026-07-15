import type { PokedexTableRow, StatBlock } from "../data/types";
import { totalStat } from "./stats";

export type SortColumn =
	| "id"
	| "name"
	| "total"
	| "catchRate"
	| "hatchCounter"
	| "height"
	| "weight"
	| keyof StatBlock;
export type SortDirection = "asc" | "desc";

function valueOf(row: PokedexTableRow, column: SortColumn): number | string {
	switch (column) {
		case "id": return row.dexNumber;
		case "name": return row.name;
		case "total": return totalStat(row.stats);
		case "catchRate": return row.catchRate;
		case "hatchCounter": return row.hatchCounter;
		case "height": return row.height;
		case "weight": return row.weight;
		default: return row.stats[column];
	}
}

export function sortPokemon(
	rows: PokedexTableRow[],
	column: SortColumn,
	direction: SortDirection,
): PokedexTableRow[] {
	const sign = direction === "asc" ? 1 : -1;
	return [...rows].sort((a, b) => {
		// "No." (dexNumber) needs a tiebreaker: a regional-form row shares its
		// dexNumber with its base species (e.g. Alolan Rattata and Rattata are
		// both "No. 019"), so without this they'd be ordered arbitrarily
		// relative to each other instead of the base row consistently coming
		// first — kept ascending-by-id regardless of `sign` since that's a
		// display-grouping convention, not part of what the user's asc/desc
		// choice means.
		if (column === "id") return sign * (a.dexNumber - b.dexNumber) || a.id - b.id;
		const va = valueOf(a, column);
		const vb = valueOf(b, column);
		if (typeof va === "string" || typeof vb === "string") {
			return sign * String(va).localeCompare(String(vb));
		}
		return sign * (va - vb);
	});
}
