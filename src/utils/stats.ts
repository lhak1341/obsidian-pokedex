import { STAT_OVERRIDES } from "../data/constants";
import type { StatBlock } from "../data/types";

export function totalStat(stats: StatBlock): number {
	return stats.hp + stats.attack + stats.defense + stats.specialAttack + stats.specialDefense + stats.speed;
}

// Resolves a species' stats for whichever generation is currently active —
// see STAT_OVERRIDES. `current` is always PokeAPI's latest-game stat line;
// this only ever *reduces* a stat back to its pre-Gen 6 value for the finite
// list of species that got buffed, never invents new numbers. For every
// species not in the table (the overwhelming majority), this is a no-op:
// current stats already are correct for every generation, since nothing
// about them has ever changed.
export function resolveStatsForGen(current: StatBlock, pokemonId: number, activeGen: number): StatBlock {
	const override = STAT_OVERRIDES[pokemonId];
	if (!override || activeGen > override.validThroughGen) return current;
	return { ...current, ...override.deltas };
}
