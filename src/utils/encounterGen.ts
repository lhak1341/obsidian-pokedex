import type { PokedexTableRow } from "../data/types";

export interface ActiveEncounterLocation {
	name: string;
	region: string | null;
	method: "trade" | "gift" | "egg" | null;
	tradeFor: string | null;
}

// Scopes a Pokemon's wild-encounter locations down to just the ones from the
// user's Active Gen — the reactive counterpart to encounterLocations staying
// Active-Gen-agnostic at normalize time (same split as heldItemGen.ts's
// filterHeldItemsForGen). Returns deduped, sorted entries (a location's own
// region/method/tradeFor never vary by generation, so dedup-by-name alone is
// safe); empty when the Pokemon isn't found in the wild in that generation
// at all (evolve-only, legendary, or simply absent from ENCOUNTER_LOCATIONS
// — see its comment).
export function filterEncounterLocationsForGen(
	encounterLocations: PokedexTableRow["encounterLocations"],
	activeGen: number,
): ActiveEncounterLocation[] {
	const byName = new Map<string, ActiveEncounterLocation>();
	for (const loc of encounterLocations) {
		if (loc.generationId === activeGen) {
			byName.set(loc.name, { name: loc.name, region: loc.region, method: loc.method, tradeFor: loc.tradeFor });
		}
	}
	return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
