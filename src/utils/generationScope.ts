import { GENERATIONS } from "../data/constants";
import type { PokedexTableRow } from "../data/types";
import { matchesGenerations } from "./filterPokemon";

export interface GenerationScope {
	fetchRange: { start: number; end: number };
	includes: (row: PokedexTableRow) => boolean;
}

// Resolves which generations are enabled (settings.enabledGenerations) into
// what the fetch layer needs: a contiguous dex-number range to fetch (a base
// id range — always dex-number-based, regardless of any row it eventually
// produces), and a membership check to apply to the resulting ROWS
// afterward. These are deliberately different scopes: fetchRange can pull in
// ids from a disabled generation sitting inside a gap (e.g. Gen 1 + Gen 3
// with Gen 2 excluded, or a regional-form row like Alolan Rattata that's
// always fetched alongside its Gen-1-numbered base id regardless of whether
// Gen 7 itself is enabled — see PokedexRepository.getRowsForIds) — `includes`
// is what actually keeps such a row out of view. Row-based (not a bare dex
// id) specifically so it can check a regional-form row's own generationId
// rather than incorrectly range-checking its dex number (see
// PokedexTableRow.generationId's own doc comment for why those can diverge).
export function resolveGenerationScope(enabledGenerations: number[]): GenerationScope {
	const enabled = GENERATIONS.filter((g) => enabledGenerations.includes(g.id));
	return {
		fetchRange: {
			start: Math.min(...enabled.map((g) => g.start)),
			end: Math.max(...enabled.map((g) => g.end)),
		},
		includes: (row) => matchesGenerations(row, enabledGenerations),
	};
}
