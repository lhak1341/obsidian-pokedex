import { FLAVOR_TEXT_TABS, FLAVOR_TEXT_VERSION_GROUPS, MOVE_VERSION_GROUPS } from "./constants";
import type {
	EvolutionNode,
	EvYieldEntry,
	MoveDetail,
	MoveEntry,
	PokedexEntry,
	PokedexTableRow,
	RawEvolutionChainLink,
	RawMove,
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
	// Dedupe key includes versionGroup — FRLG and Emerald can teach the same
	// move at *different* levels, and collapsing those into one row hid
	// whichever group's level lost the race (see DetailScreen's version
	// toggle, which needs each group's own entries to filter correctly).
	// This only catches true duplicates: the same move/method/level/group
	// appearing twice raw (e.g. PokeAPI listing a version group more than
	// once for a move).
	const seen = new Set<string>();
	const moves: MoveEntry[] = [];
	for (const entry of rawMoves) {
		for (const detail of entry.version_group_details) {
			if (!versionGroups.includes(detail.version_group.name)) continue;
			const dedupeKey = `${entry.move.name}|${detail.move_learn_method.name}|${detail.level_learned_at}|${detail.version_group.name}`;
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

// PokeAPI's `moves` array carries every version group the move has ever
// appeared in (20+ games) — `normalizeMoves` only ever reads the couple this
// plugin cares about (MOVE_VERSION_GROUPS). Trimming it down to just those
// before a raw pokemon response is cached cuts a ~260KB moves array (out of
// ~263KB total) down to a few KB, since that's ~99% of what makes
// `pokemon/<id>.json` slow to read and parse on every table load.
export function trimMovesToVersionGroups(
	rawMoves: RawPokemon["moves"],
	versionGroups: readonly string[] = MOVE_VERSION_GROUPS,
): RawPokemon["moves"] {
	return rawMoves
		.map((entry) => ({
			...entry,
			version_group_details: entry.version_group_details.filter((d) =>
				versionGroups.includes(d.version_group.name),
			),
		}))
		.filter((entry) => entry.version_group_details.length > 0);
}

export function normalizeMoveDetail(raw: RawMove): MoveDetail {
	return { type: raw.type.name, power: raw.power, accuracy: raw.accuracy, pp: raw.pp };
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

// Flattens an evolution chain tree down to the ids of every member (the
// currently-viewed Pokemon and every branch of its evolution family) — used
// to fetch sprites for the evolution tree display (see
// PokedexRepository.getEntrySprites).
export function collectChainIds(node: EvolutionNode, ids: number[] = []): number[] {
	ids.push(node.id);
	for (const child of node.children) collectChainIds(child, ids);
	return ids;
}

function findEvolutionNode(node: EvolutionNode, id: number): EvolutionNode | null {
	if (node.id === id) return node;
	for (const child of node.children) {
		const found = findEvolutionNode(child, id);
		if (found) return found;
	}
	return null;
}

// Level(s) at which `id` next evolves, read off the matching node's own
// children within the whole-family `root` tree — each child's minLevel
// describes how IT was reached from its parent (see normalizeEvolutionChain),
// not how `id` itself was reached. Empty for a final-stage member, or one
// that only evolves via item/trade (no level threshold to show). Deduped and
// sorted ascending since a branching evolution (e.g. Tyrogue) can have
// several children sharing the same level.
export function nextEvolutionLevels(root: EvolutionNode, id: number): number[] {
	const node = findEvolutionNode(root, id);
	if (!node) return [];
	const levels = node.children
		.map((child) => child.minLevel)
		.filter((level): level is number => level != null);
	return [...new Set(levels)].sort((a, b) => a - b);
}

// One entry per FLAVOR_TEXT_TABS tab that has a matching version in this
// species' data (missing for a tab only if the species genuinely never
// appeared in that game, which doesn't happen within this plugin's Gen 1-3
// dex) — DetailScreen's version cycler reads straight off this map's keys.
export function extractFlavorTexts(
	species: RawSpecies,
	tabs: readonly { key: string; versions: readonly string[] }[] = FLAVOR_TEXT_TABS,
): Record<string, string> {
	const english = species.flavor_text_entries.filter((e) => e.language.name === "en");
	const texts: Record<string, string> = {};
	for (const tab of tabs) {
		for (const version of tab.versions) {
			const match = english.find((e) => e.version.name === version);
			if (match) {
				texts[tab.key] = match.flavor_text.replace(/[\n\f\r]+/g, " ").trim();
				break;
			}
		}
	}
	return texts;
}

// PokeAPI's `flavor_text_entries` carries every language and every game the
// species has ever appeared in — extractFlavorTexts only ever reads English
// entries from FLAVOR_TEXT_VERSION_GROUPS. Trimming it down before a raw
// species response is cached keeps a table load of ~400 rows from parsing a
// field that's only read once the detail view opens.
export function trimFlavorTextEntries(
	entries: RawSpecies["flavor_text_entries"],
	versionGroups: readonly string[] = FLAVOR_TEXT_VERSION_GROUPS,
): RawSpecies["flavor_text_entries"] {
	return entries.filter(
		(e) => e.language.name === "en" && versionGroups.includes(e.version.name),
	);
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
		rarity: species.is_mythical ? "mythical" : species.is_legendary ? "legendary" : "normal",
	};
}

export function toEntry(
	pokemon: RawPokemon,
	species: RawSpecies,
	evolutionChain: EvolutionNode | null,
	images: { sprite: string | null; artwork: string | null; shiny: string | null; shinyArtwork: string | null },
): PokedexEntry {
	return {
		...toTableRow(pokemon, species, images.sprite),
		abilities: pokemon.abilities
			.sort((a, b) => a.slot - b.slot)
			.map((a) => ({ name: a.ability.name, isHidden: a.is_hidden })),
		artworkDataUri: images.artwork,
		shinyDataUri: images.shiny,
		shinyArtworkDataUri: images.shinyArtwork,
		flavorTexts: extractFlavorTexts(species),
		eggGroups: species.egg_groups.map((g) => g.name),
		genderRate: species.gender_rate,
		moves: normalizeMoves(pokemon.moves),
		evolutionChain,
	};
}
