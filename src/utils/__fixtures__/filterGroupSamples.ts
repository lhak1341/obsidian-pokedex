import { makeRow } from "../../data/__fixtures__/rows";
import type { PokedexTableRow } from "../../data/types";
import type { FilterGroupKey } from "../filterGroups";
import { EMPTY_FILTERS, type PokedexFilters } from "../filterPokemon";

// One selection per filter group, and two rows each selection splits: every
// sample keeps one row and drops the other. A Record, so a new group cannot
// go without a sample (filterPokemon.test.ts, filterGroups.test.ts).
export const GROUP_SAMPLES: Record<FilterGroupKey, Partial<PokedexFilters>> = {
	type: { types: ["fire"] },
	gen: { generations: [1] },
	ability: { abilities: ["blaze"] },
	stats: { statRanges: { hp: { min: 60, max: 255 } } },
	rarity: { rarities: ["mythical"] },
	ev: { evStats: ["speed"] },
	traits: { traits: ["baby"] },
	quirks: { quirks: ["pickup"] },
};

export function sampleFilters(key: FilterGroupKey): PokedexFilters {
	return { ...EMPTY_FILTERS, statRanges: {}, ...GROUP_SAMPLES[key] };
}

// The first matches type, gen, ability and ev; the second stats, rarity,
// traits and quirks.
export const SAMPLE_ROWS: PokedexTableRow[] = [
	makeRow({
		id: 4, name: "charmander", types: ["fire"], abilityNames: ["blaze"], generationId: 1, rarity: "normal",
		stats: { hp: 39, attack: 52, defense: 43, specialAttack: 60, specialDefense: 50, speed: 65 },
		evYield: [{ stat: "speed", amount: 1 }], isBaby: false,
	}),
	makeRow({
		id: 172, name: "pichu", types: ["electric"], abilityNames: ["pickup"], generationId: 2, rarity: "mythical",
		stats: { hp: 80, attack: 40, defense: 15, specialAttack: 35, specialDefense: 35, speed: 60 },
		evYield: [{ stat: "hp", amount: 1 }], isBaby: true,
	}),
];
