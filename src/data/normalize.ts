import { MOVE_VERSION_GROUPS } from "./constants";
import type {
	EvolutionNode,
	EvYieldEntry,
	MoveEntry,
	PokedexEntry,
	PokedexTableRow,
	RawEvolutionChainLink,
	RawPokemon,
	RawSpecies,
	StatBlock,
} from "./types";

const STAT_KEY_MAP: Record<string, keyof StatBlock> = {
	hp: "hp",
	attack: "attack",
	defense: "defense",
	"special-attack": "specialAttack",
	"special-defense": "specialDefense",
	speed: "speed",
};

export function normalizeStats(rawStats: RawPokemon["stats"]): StatBlock {
	const stats: StatBlock = {
		hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0,
	};
	for (const entry of rawStats) {
		const key = STAT_KEY_MAP[entry.stat.name];
		if (key) stats[key] = entry.base_stat;
	}
	return stats;
}

export function normalizeMoves(
	rawMoves: RawPokemon["moves"],
	versionGroups: readonly string[] = MOVE_VERSION_GROUPS,
): MoveEntry[] {
	// A move learned the same way at the same level in more than one of the
	// requested version groups (e.g. FireRed/LeafGreen and Emerald both teach
	// Vine Whip at level 13) should show up once, not once per group.
	const seen = new Set<string>();
	const moves: MoveEntry[] = [];
	for (const entry of rawMoves) {
		for (const detail of entry.version_group_details) {
			if (!versionGroups.includes(detail.version_group.name)) continue;
			const dedupeKey = `${entry.move.name}|${detail.move_learn_method.name}|${detail.level_learned_at}`;
			if (seen.has(dedupeKey)) continue;
			seen.add(dedupeKey);
			moves.push({
				name: entry.move.name,
				levelLearnedAt: detail.level_learned_at,
				learnMethod: detail.move_learn_method.name,
				versionGroup: detail.version_group.name,
			});
		}
	}
	// Level-up moves first in learn order, then everything else alphabetically.
	moves.sort((a, b) => {
		if (a.learnMethod === "level-up" && b.learnMethod === "level-up") {
			return a.levelLearnedAt - b.levelLearnedAt;
		}
		if (a.learnMethod === "level-up") return -1;
		if (b.learnMethod === "level-up") return 1;
		return a.name.localeCompare(b.name);
	});
	return moves;
}

function idFromUrl(url: string): number {
	const match = url.match(/\/(\d+)\/?$/);
	return match ? Number(match[1]) : 0;
}

export function normalizeEvolutionChain(link: RawEvolutionChainLink): EvolutionNode {
	const detail = link.evolution_details[0];
	return {
		id: idFromUrl(link.species.url),
		name: link.species.name,
		minLevel: detail?.min_level ?? null,
		trigger: detail?.trigger?.name ?? null,
		item: detail?.item?.name ?? null,
		children: link.evolves_to.map(normalizeEvolutionChain),
	};
}

export function extractFlavorText(
	species: RawSpecies,
	versionGroups: readonly string[] = ["firered-leafgreen", "leafgreen", "firered", "emerald"],
): string | null {
	const english = species.flavor_text_entries.filter((e) => e.language.name === "en");
	for (const version of versionGroups) {
		const match = english.find((e) => e.version.name === version);
		if (match) return match.flavor_text.replace(/[\n\f\r]+/g, " ").trim();
	}
	return english[0]?.flavor_text.replace(/[\n\f\r]+/g, " ").trim() ?? null;
}

export function normalizeEvYield(rawStats: RawPokemon["stats"]): EvYieldEntry[] {
	const yields: EvYieldEntry[] = [];
	for (const entry of rawStats) {
		if (entry.effort <= 0) continue;
		const key = STAT_KEY_MAP[entry.stat.name];
		if (key) yields.push({ stat: key, amount: entry.effort });
	}
	return yields;
}

export function toTableRow(
	pokemon: RawPokemon,
	species: RawSpecies,
	spriteDataUri: string | null,
): PokedexTableRow {
	return {
		id: pokemon.id,
		name: pokemon.name,
		types: pokemon.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
		stats: normalizeStats(pokemon.stats),
		evYield: normalizeEvYield(pokemon.stats),
		abilityNames: pokemon.abilities.sort((a, b) => a.slot - b.slot).map((a) => a.ability.name),
		spriteDataUri,
		height: pokemon.height,
		weight: pokemon.weight,
		catchRate: species.capture_rate,
		hatchCounter: species.hatch_counter,
	};
}

export function toEntry(
	pokemon: RawPokemon,
	species: RawSpecies,
	evolutionChain: EvolutionNode | null,
	images: { sprite: string | null; artwork: string | null; shiny: string | null },
): PokedexEntry {
	return {
		...toTableRow(pokemon, species, images.sprite),
		abilities: pokemon.abilities
			.sort((a, b) => a.slot - b.slot)
			.map((a) => ({ name: a.ability.name, isHidden: a.is_hidden })),
		artworkDataUri: images.artwork,
		shinyDataUri: images.shiny,
		flavorText: extractFlavorText(species),
		eggGroups: species.egg_groups.map((g) => g.name),
		genderRate: species.gender_rate,
		moves: normalizeMoves(pokemon.moves),
		evolutionChain,
		criesUrl: pokemon.cries.latest ?? pokemon.cries.legacy ?? null,
	};
}
