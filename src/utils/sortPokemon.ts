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
		case "id": return row.id;
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
		const va = valueOf(a, column);
		const vb = valueOf(b, column);
		if (typeof va === "string" || typeof vb === "string") {
			return sign * String(va).localeCompare(String(vb));
		}
		return sign * (va - vb);
	});
}
