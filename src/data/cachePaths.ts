// Single source of truth for the pokemon/species/image disk-cache path
// templates, previously hand-built at a dozen+ call sites in
// PokedexRepository.ts. ImageSuffix is the key set of imageSet.ts's table, which
// derives ALL_IMAGE_SUFFIXES for clearRange — that table, not this union alone,
// is what ties the write sites to the delete side.
export type ImageSuffix = "sprite" | "artwork" | "shiny" | "shiny-artwork" | "home" | "shiny-home";

// idOrName covers both a numeric dex id (getOrFetchPokemon) and a PokeAPI
// variety name (getOrFetchPokemonVariant's regional forms, getMegaForm's
// varietyKey) — the template output doesn't care which, only the mem-cache
// layer (pokemonMemCache vs pokemonVariantMemCache) needs them kept apart.
export function pokemonPath(idOrName: number | string): string {
	return `pokemon/${idOrName}.json`;
}

export function speciesPath(id: number): string {
	return `species/${id}.json`;
}

export function imagePath(idOrName: number | string, suffix: ImageSuffix): string {
	return `images/${idOrName}-${suffix}.png`;
}

// Mega/Gigantamax variety forms (PokedexRepository.fetchVarietyForm writes
// them, clearRange evicts them). Shared so the delete side has a
// compiler-enforced link to the write side, like the paths above.
export function megaFormPath(varietyKey: string): string {
	return `mega-forms/${varietyKey}.json`;
}

// A regional form's own Pokédex text (getOrFetchFormFlavorText writes it,
// clearRange evicts it with the variant), keyed by its pokemon-form name.
export function pokemonFormPath(formName: string): string {
	return `pokemon-forms/${formName}.json`;
}

export function gigantamaxFormPath(varietyKey: string): string {
	return `gigantamax-forms/${varietyKey}.json`;
}
