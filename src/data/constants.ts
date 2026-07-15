import type { StatBlock } from "./types";

export const POKEAPI_BASE = "https://pokeapi.co/api/v2";

// Movepool/learn-method version-group toggle tabs (MoveBrowser's per-game
// switcher), one set per generation this plugin supports — mirrors
// FLAVOR_TEXT_TABS_BY_GEN below. `key` matches a move entry's raw
// version_group.name exactly (see normalizeMoves). Which of these sets is
// actually shown at once is an "Active Gen" UI concern, not a data-layer one
// — this table just says what exists per generation.
export const MOVE_VERSION_TABS_BY_GEN: Record<number, readonly { key: string; label: string }[]> = {
	3: [
		{ key: "firered-leafgreen", label: "FRLG" },
		{ key: "emerald", label: "RSE" },
	],
	4: [
		{ key: "diamond-pearl", label: "D/P" },
		{ key: "platinum", label: "Platinum" },
		{ key: "heartgold-soulsilver", label: "HG/SS" },
	],
};

// Every version group any tab above reads, across every supported
// generation — trimming/caching (trimMovesToVersionGroups) keeps exactly
// this set instead of the ~20+ games a move's version_group_details spans.
export const MOVE_VERSION_GROUPS: string[] = Object.values(MOVE_VERSION_TABS_BY_GEN).flatMap((tabs) =>
	tabs.map((t) => t.key),
);

// Which version group's flavor text backs the move-name hover tooltip (see
// normalizeMoveDetail) — tried in this priority order, first English match
// wins, since a move's *description* barely differs between games and
// doesn't need its own per-generation toggle. A move introduced in a later
// generation (e.g. a Gen 4 signature move) simply has no firered-leafgreen
// entry, so it falls through to the next group instead of coming up blank.
export const MOVE_DESCRIPTION_VERSION_GROUPS: string[] = MOVE_VERSION_GROUPS;

// Pokedex description ("flavor text") is one tab per game the detail view
// lets the user switch between, grouped per generation — Ruby and Sapphire
// (and similarly Diamond/Pearl) share a tab since their text is identical
// for nearly every species. Flavor text is keyed by individual game
// *version* on PokeAPI (e.g. "leafgreen"), not the version *group*
// MOVE_VERSION_TABS_BY_GEN above uses ("firered-leafgreen") — that string
// never matches a flavor_text_entries.version.name. `key` is what
// DetailScreen's toggle state and PokedexEntry.flavorTexts use; each tab's
// `versions` is the priority-ordered list of raw version names tried. Which
// generation's tab set is shown at once is an "Active Gen" UI concern, not a
// data-layer one — this table just says what exists per generation.
export const FLAVOR_TEXT_TABS_BY_GEN: Record<
	number,
	readonly { key: string; label: string; versions: readonly string[] }[]
> = {
	3: [
		{ key: "leafgreen", label: "Leaf Green", versions: ["leafgreen"] },
		{ key: "firered", label: "Fire Red", versions: ["firered"] },
		{ key: "emerald", label: "Emerald", versions: ["emerald"] },
		{ key: "ruby-sapphire", label: "Ruby / Sapphire", versions: ["ruby", "sapphire"] },
	],
	4: [
		{ key: "diamond-pearl", label: "Diamond / Pearl", versions: ["diamond", "pearl"] },
		{ key: "platinum", label: "Platinum", versions: ["platinum"] },
		{ key: "heartgold-soulsilver", label: "HeartGold / SoulSilver", versions: ["heartgold", "soulsilver"] },
	],
};

// Every raw version name any tab above reads, across every supported
// generation — trimming/caching keeps exactly this set instead of the ~20
// games flavor_text_entries spans.
export const FLAVOR_TEXT_VERSION_GROUPS: string[] = Object.values(FLAVOR_TEXT_TABS_BY_GEN).flatMap((tabs) =>
	tabs.flatMap((tab) => tab.versions),
);

export const TYPE_NAMES = [
	"normal", "fire", "water", "electric", "grass", "ice",
	"fighting", "poison", "ground", "flying", "psychic", "bug",
	"rock", "ghost", "dragon", "dark", "steel", "fairy",
] as const;

export const RARITIES = [
	{ key: "normal", label: "Normal" },
	{ key: "legendary", label: "Legendary" },
	{ key: "mythical", label: "Mythical" },
] as const;

// Gen 1-3 fossil Pokemon (revived from a fossil item at a Pokemon Lab, not
// found or evolved any other way). PokeAPI has no explicit "is_fossil"
// species flag, so this is a curated list rather than a derived one.
export const FOSSIL_IDS = new Set([138, 139, 140, 141, 142, 345, 346, 347, 348]);

export interface QuirkDef {
	key: string;
	label: string;
	icon: string;
}

// A personal shortlist of specific traits (not a formal in-game category) —
// mixes an ability check (compoundEyes/pickup), a level-up-learnset check
// (thief/trick/covet), and the curated FOSSIL_IDS list above. See
// matchesQuirk in filterPokemon.ts for how each key is actually evaluated.
export const QUIRKS: QuirkDef[] = [
	{ key: "fossil", label: "Fossil", icon: "bone" },
	{ key: "compound-eyes", label: "Compound Eyes", icon: "eye" },
	{ key: "pickup", label: "Pickup", icon: "boxes" },
	{ key: "thief", label: "Thief", icon: "package" },
	{ key: "trick", label: "Trick", icon: "package" },
	{ key: "covet", label: "Covet", icon: "package" },
];

export const GENERATIONS = [
	{ id: 1, name: "Gen 1 (Kanto)", start: 1, end: 151 },
	{ id: 2, name: "Gen 2 (Johto)", start: 152, end: 251 },
	{ id: 3, name: "Gen 3 (Hoenn)", start: 252, end: 386 },
	{ id: 4, name: "Gen 4 (Sinnoh)", start: 387, end: 493 },
] as const;

// All generations enabled by default (dex #1-493, Gen 1 through Gen 4).
export const DEFAULT_ENABLED_GENERATIONS: number[] = GENERATIONS.map((g) => g.id);

export const STAT_NAMES = [
	"hp", "attack", "defense", "special-attack", "special-defense", "speed",
] as const;

export const STAT_COLUMNS = [
	{ key: "hp", label: "HP" },
	{ key: "attack", label: "Atk" },
	{ key: "defense", label: "Def" },
	{ key: "specialAttack", label: "SpA" },
	{ key: "specialDefense", label: "SpD" },
	{ key: "speed", label: "Spe" },
] as const;

// Browse-table columns shown by default before the user customizes them via
// the Columns dropdown.
export const DEFAULT_VISIBLE_COLUMNS: string[] = STAT_COLUMNS.map((c) => c.key);

// Per-stat bar colors, matching Bulbapedia's own stat-bar convention.
export const STAT_COLORS: Record<string, string> = {
	hp: "#69DC12", attack: "#EFCC18", defense: "#E86412",
	specialAttack: "#14C3F1", specialDefense: "#4A6ADF", speed: "#D51DAD",
};

// PokeAPI's /pokemon.stats only ever returns the CURRENT (latest-game) base
// stat line — there's no per-generation stats field the way movepools have
// version_group_details. Gen 6 (X/Y) buffed a specific, finite list of
// underused species by +10 to one or two stats; every other species' stats
// have never changed. This is a curated override table (FOSSIL_IDS-style,
// not derived from any API) holding only the pre-buff value for whichever
// stat(s) changed — an "Active Gen" stat lookup overlays this onto the
// current stats when the active generation predates the buff
// (validThroughGen: the last generation that still used the old value).
// Sourced from https://bulbapedia.bulbagarden.net/wiki/Base_stats
// ("Between generations" > Generation VI), restricted to dex #1-493 (the
// generations this plugin currently supports) — re-check that page and
// extend this table if a later phase's dex range pulls in the rest of the
// Gen 6 list (nothing beyond #407 is affected within Gen 1-4 anyway).
export const STAT_OVERRIDES: Record<number, { validThroughGen: number; deltas: Partial<StatBlock> }> = {
	12: { validThroughGen: 5, deltas: { specialAttack: 80 } }, // Butterfree
	15: { validThroughGen: 5, deltas: { attack: 80 } }, // Beedrill
	18: { validThroughGen: 5, deltas: { speed: 91 } }, // Pidgeot
	25: { validThroughGen: 5, deltas: { defense: 30, specialDefense: 40 } }, // Pikachu
	26: { validThroughGen: 5, deltas: { speed: 100 } }, // Raichu
	31: { validThroughGen: 5, deltas: { attack: 82 } }, // Nidoqueen
	34: { validThroughGen: 5, deltas: { attack: 92 } }, // Nidoking
	36: { validThroughGen: 5, deltas: { specialAttack: 85 } }, // Clefable
	40: { validThroughGen: 5, deltas: { specialAttack: 75 } }, // Wigglytuff
	45: { validThroughGen: 5, deltas: { specialAttack: 100 } }, // Vileplume
	62: { validThroughGen: 5, deltas: { attack: 85 } }, // Poliwrath
	65: { validThroughGen: 5, deltas: { specialDefense: 85 } }, // Alakazam
	71: { validThroughGen: 5, deltas: { specialDefense: 60 } }, // Victreebel
	76: { validThroughGen: 5, deltas: { attack: 110 } }, // Golem
	181: { validThroughGen: 5, deltas: { defense: 75 } }, // Ampharos
	182: { validThroughGen: 5, deltas: { defense: 85 } }, // Bellossom
	184: { validThroughGen: 5, deltas: { specialAttack: 50 } }, // Azumarill
	189: { validThroughGen: 5, deltas: { specialDefense: 85 } }, // Jumpluff
	267: { validThroughGen: 5, deltas: { specialAttack: 90 } }, // Beautifly
	295: { validThroughGen: 5, deltas: { specialDefense: 63 } }, // Exploud
	398: { validThroughGen: 5, deltas: { specialDefense: 50 } }, // Staraptor
	407: { validThroughGen: 5, deltas: { defense: 55 } }, // Roserade
};

export const TYPE_COLORS: Record<string, string> = {
	normal: "#A8A878", fire: "#F08030", water: "#6890F0", electric: "#F8D030",
	grass: "#78C850", ice: "#98D8D8", fighting: "#C03028", poison: "#A040A0",
	ground: "#E0C068", flying: "#A890F0", psychic: "#F85888", bug: "#A8B820",
	rock: "#B8A038", ghost: "#705898", dragon: "#7038F8", dark: "#705848",
	steel: "#B8B8D0", fairy: "#EE99AC",
};

// Lucide icon names, picked for a recognizable-at-a-glance match to each
// type (verified against Obsidian's bundled icon set — not every Lucide
// icon ships with every Obsidian version).
export const TYPE_ICONS: Record<string, string> = {
	normal: "circle", fire: "flame", water: "droplet", electric: "zap",
	grass: "leaf", ice: "snowflake", fighting: "hand-fist", poison: "skull",
	ground: "mountain", flying: "feather", psychic: "eye", bug: "bug",
	rock: "stone", ghost: "ghost", dragon: "tornado", dark: "moon",
	steel: "anvil", fairy: "heart",
};
