import type { PokedexTableRow } from "../data/types";

// Scopes a Pokemon's held items down to just the rarities from the user's
// Active Gen, dropping an item entirely if it has none in that generation
// (e.g. Absorb Bulb, Diamond/Pearl-only, disappears from Oddish's held-item
// list at Active Gen 3) — the reactive counterpart to
// normalizeHeldItemDetails staying Active-Gen-agnostic at fetch/cache time.
// Returns the same `{ name, rarities: number[] }[]` shape the table cell and
// HeldItemsPanel already render, now carrying only the values, since the
// generation tag has done its job by this point.
export function filterHeldItemsForGen(
	heldItems: PokedexTableRow["heldItems"],
	activeGen: number,
): { name: string; rarities: number[] }[] {
	return heldItems.flatMap((item) => {
		const rarities = item.rarities.filter((r) => r.generationId === activeGen).map((r) => r.value);
		return rarities.length === 0 ? [] : [{ name: item.name, rarities }];
	});
}
