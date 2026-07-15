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
