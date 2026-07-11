export const POKEAPI_BASE = "https://pokeapi.co/api/v2";

// Movepool/learn-method data is filtered to these version groups so a
// Pokemon's move list matches Gen 3 (FireRed/LeafGreen + Emerald) instead of
// dumping every game the species has ever appeared in.
export const MOVE_VERSION_GROUPS = ["firered-leafgreen", "emerald"] as const;

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

export const GENERATIONS = [
	{ id: 1, name: "Gen 1 (Kanto)", start: 1, end: 151 },
	{ id: 2, name: "Gen 2 (Johto)", start: 152, end: 251 },
	{ id: 3, name: "Gen 3 (Hoenn)", start: 252, end: 386 },
] as const;

// All generations enabled by default (dex #1-386, Gen 1 through Gen 3).
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
