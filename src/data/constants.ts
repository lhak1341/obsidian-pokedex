export const POKEAPI_BASE = "https://pokeapi.co/api/v2";

// National dex #1-386 = Gen 1 (Kanto) through Gen 3 (Hoenn).
// Kept as a plain range (not hardcoded into fetch/cache logic) so a later
// settings change can widen it without touching the data layer.
export const DEFAULT_DEX_RANGE = { start: 1, end: 386 } as const;
export const MAX_DEX_NUMBER = 1025; // upper bound PokeAPI currently supports

// Movepool/learn-method data is filtered to these version groups so a
// Pokemon's move list matches Gen 3 (FireRed/LeafGreen + Emerald) instead of
// dumping every game the species has ever appeared in.
export const MOVE_VERSION_GROUPS = ["firered-leafgreen", "emerald"] as const;

export const TYPE_NAMES = [
	"normal", "fire", "water", "electric", "grass", "ice",
	"fighting", "poison", "ground", "flying", "psychic", "bug",
	"rock", "ghost", "dragon", "dark", "steel", "fairy",
] as const;

export const GENERATIONS = [
	{ id: 1, name: "Gen 1 (Kanto)", start: 1, end: 151 },
	{ id: 2, name: "Gen 2 (Johto)", start: 152, end: 251 },
	{ id: 3, name: "Gen 3 (Hoenn)", start: 252, end: 386 },
] as const;

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
