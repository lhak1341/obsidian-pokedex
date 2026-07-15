import {
	FLAVOR_TEXT_TABS_BY_GEN,
	FLAVOR_TEXT_VERSION_GROUPS,
	MOVE_DESCRIPTION_VERSION_GROUPS,
	MOVE_VERSION_GROUPS,
} from "./constants";
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
	let entry: RawMove["flavor_text_entries"][number] | undefined;
	for (const group of MOVE_DESCRIPTION_VERSION_GROUPS) {
		entry = raw.flavor_text_entries.find((e) => e.language.name === "en" && e.version_group.name === group);
		if (entry) break;
	}
	const description = entry?.flavor_text.replace(/[\n\f\r]+/g, " ").trim() ?? null;
	return { type: raw.type.name, power: raw.power, accuracy: raw.accuracy, pp: raw.pp, description };
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
		minHappiness: detail?.min_happiness ?? null,
		timeOfDay: detail?.time_of_day || null,
		heldItem: detail?.held_item?.name ?? null,
		minBeauty: detail?.min_beauty ?? null,
		relativePhysicalStats: detail?.relative_physical_stats ?? null,
		location: detail?.location?.name ?? null,
		knownMove: detail?.known_move?.name ?? null,
		partySpecies: detail?.party_species?.name ?? null,
		gender: detail?.gender ?? null,
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

// Human-readable label for what triggers `node`'s own evolution (e.g. "Lv.
// 16", "Thunder Stone", "Trade (metal-coat)") — used as the method line on
// EvolutionChain's card for this node. Priority-ordered: the base label
// checks minLevel > item > minHappiness > minBeauty > knownMove >
// partySpecies > location > trigger (excluding level-up, which needs no
// label of its own), first match wins. relativePhysicalStats, gender, and
// timeOfDay are independent suffixes layered on top of whichever base label
// (if any) matched. trigger==="trade" && heldItem is a hard override — it
// replaces the base label entirely rather than layering, since "Trade
// (item)" is a more complete description than whatever base branch also
// happened to match (e.g. a trade evolution can carry a minHappiness value
// on some species without happiness actually being the real requirement).
export function describeEvolutionRequirement(node: EvolutionNode): string {
	let base = "";
	if (node.minLevel) base = `Lv. ${node.minLevel}`;
	else if (node.item) base = node.item.replace(/-/g, " ");
	else if (node.minHappiness) base = "Friendship";
	else if (node.minBeauty) base = "Beauty";
	else if (node.knownMove) base = `Knows ${node.knownMove.replace(/-/g, " ")}`;
	else if (node.partySpecies) base = `${node.partySpecies.replace(/-/g, " ")} in party`;
	else if (node.location) base = node.location.replace(/-/g, " ");
	else if (node.trigger && node.trigger !== "level-up") base = node.trigger.replace(/-/g, " ");

	if (node.relativePhysicalStats === 1) base = base ? `${base} (Atk > Def)` : "Atk > Def";
	else if (node.relativePhysicalStats === -1) base = base ? `${base} (Def > Atk)` : "Def > Atk";
	else if (node.relativePhysicalStats === 0) base = base ? `${base} (Atk = Def)` : "Atk = Def";

	if (node.trigger === "trade" && node.heldItem) {
		base = `Trade (${node.heldItem.replace(/-/g, " ")})`;
	}

	if (node.gender === 1) base = base ? `${base} (Female)` : "Female";
	else if (node.gender === 2) base = base ? `${base} (Male)` : "Male";

	if (!node.timeOfDay) return base;
	const timeLabel = node.timeOfDay === "day" ? "Day" : node.timeOfDay === "night" ? "Night" : node.timeOfDay;
	return base ? `${base} (${timeLabel})` : timeLabel;
}

// One entry per tab (across every generation's FLAVOR_TEXT_TABS_BY_GEN
// entry) that has a matching version in this species' data — missing for a
// tab only if the species genuinely never appeared in that game (always
// true for a species older than the tab's generation, e.g. a Gen 1-3 mon
// has no diamond-pearl entry). DetailScreen's version cycler filters this
// map's keys down to whichever generation is currently active.
export function extractFlavorTexts(
	species: RawSpecies,
	tabs: readonly {
		key: string;
		versions: readonly string[];
	}[] = Object.values(FLAVOR_TEXT_TABS_BY_GEN).flat(),
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

// Rarity is per game version, scoped down to `supportedVersions` (defaults
// to every version this app currently supports across all generations) so
// an item only appearing in an out-of-scope game (a spinoff like
// Colosseum/XD, or a future generation not yet added — e.g. Parasect's
// Balm Mushroom, Gen 5 (Black/White) only) doesn't show at all while this
// app is capped at Gen 4, and doesn't pollute an in-scope item's rarity
// with that other game's possibly-different number. An item with no
// version_details left after filtering is dropped entirely.
export function normalizeHeldItemDetails(
	heldItems: RawPokemon["held_items"],
	supportedVersions: readonly string[] = FLAVOR_TEXT_VERSION_GROUPS,
): { name: string; rarities: number[] }[] {
	return heldItems
		.map((h) => ({
			name: h.item.name,
			rarities: [...new Set(
				h.version_details
					.filter((v) => supportedVersions.includes(v.version.name))
					.map((v) => v.rarity),
			)].sort((a, b) => a - b),
		}))
		.filter((h) => h.rarities.length > 0);
}

// Table-column shape (see PokedexTableRow.heldItemNames) — same era scope as
// normalizeHeldItemDetails above, just names instead of rarity.
export function normalizeHeldItems(
	heldItems: RawPokemon["held_items"],
	supportedVersions: readonly string[] = FLAVOR_TEXT_VERSION_GROUPS,
): string[] {
	return normalizeHeldItemDetails(heldItems, supportedVersions).map((h) => h.name);
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
		levelUpMoveNames: [...new Set(
			normalizeMoves(pokemon.moves)
				.filter((m) => m.learnMethod === "level-up")
				.map((m) => m.name),
		)],
		heldItemNames: normalizeHeldItems(pokemon.held_items),
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
		heldItems: normalizeHeldItemDetails(pokemon.held_items),
	};
}
