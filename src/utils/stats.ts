import { STAT_OVERRIDES } from "../data/constants";
import type { PokedexTableRow, StatBlock } from "../data/types";

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

// Applies resolveStatsForGen to every browse-table row, once, so the table's
// columns, Total, stat sort and stat-range filter all read the same Active
// Gen stats the detail page does (they used to read PokeAPI's latest-game
// line unconditionally). A row with no override at this Active Gen comes
// back as the same object, so only the handful of buffed species allocate.
export function scopeRowsToGen(rows: PokedexTableRow[], activeGen: number): PokedexTableRow[] {
	return rows.map((row) => {
		const stats = resolveStatsForGen(row.stats, row.id, activeGen);
		return stats === row.stats ? row : { ...row, stats };
	});
}
