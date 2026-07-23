import type { PokedexTableRow } from "../data/types";

// The prev/next-Pokemon nav strip walks the National Dex sequence by default
// row (formLabel === null defines the sequence's own dexNumber ordering —
// stepping "next" from #018 Pidgeot always reaches #019, never a regional
// form's own dexNumber, since a regional form always shares its base
// species' dexNumber). But when the CURRENTLY VIEWED row is itself a
// regional variant (e.g. Hisuian Growlithe), landing on #019's default row
// would silently drop the user out of the variant line they're browsing —
// so getAdjacentDexEntries prefers a same-formLabel sibling at the target
// dexNumber when one exists (Hisuian Arcanine), falling back to the default
// row only when this species line has no such sibling (e.g. stepping from
// Hisuian Decidueye to #725 Rowlet, which has no Hisuian form).
export interface DexNavEntry {
	id: number;
	dexNumber: number;
	name: string;
	formLabel: string | null;
	spriteDataUri: string | null;
}

function toNavEntry(row: PokedexTableRow): DexNavEntry {
	return {
		id: row.id,
		dexNumber: row.dexNumber,
		name: row.name,
		formLabel: row.formLabel,
		spriteDataUri: row.spriteDataUri,
	};
}

// rows is whatever generations are currently enabled/loaded (see
// PokedexApp's resolveGenerationScope) — a disabled generation's dex numbers
// are simply absent, so prev/next naturally skips over the gap instead of
// landing on a row that was never fetched.
export function getAdjacentDexEntries(
	rows: PokedexTableRow[],
	currentDexNumber: number,
	currentFormLabel: string | null = null,
): { prev: DexNavEntry | null; next: DexNavEntry | null } {
	const defaultRows = rows
		.filter((r) => r.formLabel === null)
		.sort((a, b) => a.dexNumber - b.dexNumber);
	const index = defaultRows.findIndex((r) => r.dexNumber === currentDexNumber);
	if (index === -1) return { prev: null, next: null };

	const resolve = (target: PokedexTableRow | undefined): DexNavEntry | null => {
		if (!target) return null;
		if (currentFormLabel !== null) {
			const sibling = rows.find(
				(r) => r.dexNumber === target.dexNumber && r.formLabel === currentFormLabel,
			);
			if (sibling) return toNavEntry(sibling);
		}
		return toNavEntry(target);
	};

	return {
		prev: resolve(defaultRows[index - 1]),
		next: resolve(defaultRows[index + 1]),
	};
}
