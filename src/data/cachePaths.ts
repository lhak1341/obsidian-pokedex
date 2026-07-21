// Single source of truth for the pokemon/species/image disk-cache path
// templates, previously hand-built at a dozen+ call sites in
// PokedexRepository.ts. The image suffix list in particular is load-bearing:
// clearRange must delete every suffix any fetch site writes, and without one
// shared list, a new suffix added at a write site has no compiler-enforced
// link to the delete side (see clearRange's own comment).
export type ImageSuffix = "sprite" | "artwork" | "shiny" | "shiny-artwork";

export const ALL_IMAGE_SUFFIXES: ImageSuffix[] = ["sprite", "artwork", "shiny", "shiny-artwork"];

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
