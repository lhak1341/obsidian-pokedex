// Composes a row's base name with its regional-form label (if any) into a
// single display string ("Alolan Rattata" vs plain "Rattata") — kept
// lowercase-with-a-leading-word-boundary rather than pre-capitalized so the
// existing text-transform: capitalize CSS convention (see CLAUDE.md's
// capitalization gotcha) still handles the actual casing, same as every
// other Pokemon name in this app; text-transform: capitalize correctly
// capitalizes each space-separated word, unlike the raw PokeAPI slug's
// hyphen ("rattata-alola" would only capitalize "Rattata-alola").
export function formatPokemonDisplayName(row: { name: string; formLabel: string | null }): string {
	return row.formLabel ? `${row.formLabel} ${row.name}` : row.name;
}

// PokeAPI item/move/etc names are lowercase-hyphenated ("oran-berry") — most
// name-like cells in this app get capitalized via CSS (see CLAUDE.md's
// text-transform gotcha), but a plain-text table cell with no dedicated
// class is simplest to just format directly rather than adding CSS for one
// column. Exported so DetailScreen's held-item display matches exactly.
export function formatItemName(name: string): string {
	return name.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

// National Dex number as shown everywhere ("007", "1025"): zero-padded to 3
// digits, longer numbers left whole. One rule instead of a padStart at each
// of the seven display sites.
export function formatDexNumber(dexNumber: number): string {
	return String(dexNumber).padStart(3, "0");
}

// PokeAPI stores height in decimeters and weight in hectograms.
export function formatHeight(decimeters: number): string {
	return `${(decimeters / 10).toFixed(1)} m`;
}

export function formatWeight(hectograms: number): string {
	return `${(hectograms / 10).toFixed(1)} kg`;
}
