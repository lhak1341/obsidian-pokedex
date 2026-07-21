import type { PokedexTableRow } from "../data/types";

// The prev/next-Pokemon nav strip always lands on a species' default row,
// never a regional-form sibling (formLabel !== null shares its dexNumber
// with the default row it's a variant of — see RegionalFormNav) — stepping
// "next" from #018 Pidgeot should reach #019 Rattata, not Alolan Rattata.
export interface DexNavEntry {
	id: number;
	dexNumber: number;
	name: string;
	spriteDataUri: string | null;
}

function toNavEntry(row: PokedexTableRow): DexNavEntry {
	return { id: row.id, dexNumber: row.dexNumber, name: row.name, spriteDataUri: row.spriteDataUri };
}

// rows is whatever generations are currently enabled/loaded (see
// PokedexApp's resolveGenerationScope) — a disabled generation's dex numbers
// are simply absent, so prev/next naturally skips over the gap instead of
// landing on a row that was never fetched.
export function getAdjacentDexEntries(
	rows: PokedexTableRow[],
	currentDexNumber: number,
): { prev: DexNavEntry | null; next: DexNavEntry | null } {
	const defaultRows = rows
		.filter((r) => r.formLabel === null)
		.sort((a, b) => a.dexNumber - b.dexNumber);
	const index = defaultRows.findIndex((r) => r.dexNumber === currentDexNumber);
	if (index === -1) return { prev: null, next: null };
	return {
		prev: index > 0 ? toNavEntry(defaultRows[index - 1]) : null,
		next: index < defaultRows.length - 1 ? toNavEntry(defaultRows[index + 1]) : null,
	};
}
