import { GENERATIONS } from "../data/constants";
import { isIdInGenerations } from "./filterPokemon";

export interface GenerationScope {
	fetchRange: { start: number; end: number };
	includes: (id: number) => boolean;
}

// Resolves which generations are enabled (settings.enabledGenerations) into
// what the fetch layer needs: a contiguous dex-number range to fetch, and a
// membership check to apply afterward (fetching is contiguous even when the
// enabled generations aren't, e.g. Gen 1 + Gen 3 with Gen 2 excluded).
export function resolveGenerationScope(enabledGenerations: number[]): GenerationScope {
	const enabled = GENERATIONS.filter((g) => enabledGenerations.includes(g.id));
	return {
		fetchRange: {
			start: Math.min(...enabled.map((g) => g.start)),
			end: Math.max(...enabled.map((g) => g.end)),
		},
		includes: (id) => isIdInGenerations(id, enabledGenerations),
	};
}
