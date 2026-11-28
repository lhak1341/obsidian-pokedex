import type { ActiveGenRow } from "./activeGenScope";
import { sortByOf, type SortableFieldKey } from "./fields";

// No. and Name (the table's pinned columns, not Fields) and every Field with a
// `sortBy` (fields.ts).
export type SortColumn = "id" | "name" | SortableFieldKey;
export type SortDirection = "asc" | "desc";

export interface SortState {
	column: SortColumn;
	direction: SortDirection;
}

// A tap on a sort control (a table header, a Card view sort chip): the sorted
// column flips direction, any other column sorts ascending. One rule, so the
// two layouts never disagree about what a second tap does.
export function nextSort(sort: SortState, column: SortColumn): SortState {
	if (sort.column === column) return { column, direction: sort.direction === "asc" ? "desc" : "asc" };
	return { column, direction: "asc" };
}

function valueOf(row: ActiveGenRow, column: SortColumn): number | string {
	if (column === "id") return row.dexNumber;
	if (column === "name") return row.name;
	return sortByOf(column)(row);
}

export function sortPokemon(
	rows: ActiveGenRow[],
	column: SortColumn,
	direction: SortDirection,
): ActiveGenRow[] {
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
