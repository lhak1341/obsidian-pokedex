import { imagePath, type ImageSuffix } from "./cachePaths";
import type { RawPokemon } from "./types";

// The four images a Pokemon (or a Mega/Gigantamax variety) can own, keyed by
// the field name normalize.ts's builders and PokedexEntry-side code read them
// under. Named once here; it used to be written inline at four sites.
export interface ImageBundle {
	sprite: string | null;
	artwork: string | null;
	shiny: string | null;
	shinyArtwork: string | null;
}

// Single source of truth for "which RawPokemon.sprites field feeds which cache
// suffix". A Record over ImageSuffix, so adding a suffix to that union without
// a row here fails typecheck; ALL_IMAGE_SUFFIXES is derived from it, so the
// delete side (PokedexRepository.clearRange) cannot miss a suffix any fetch
// site writes.
const IMAGE_SET: Record<ImageSuffix, { field: keyof ImageBundle; url: (s: RawPokemon["sprites"]) => string | null }> = {
	sprite: { field: "sprite", url: (s) => s.front_default },
	artwork: { field: "artwork", url: (s) => s.other?.["official-artwork"]?.front_default ?? null },
	shiny: { field: "shiny", url: (s) => s.front_shiny },
	"shiny-artwork": { field: "shinyArtwork", url: (s) => s.other?.["official-artwork"]?.front_shiny ?? null },
};

export const ALL_IMAGE_SUFFIXES = Object.keys(IMAGE_SET) as ImageSuffix[];

export interface ImageRequest {
	suffix: ImageSuffix;
	field: keyof ImageBundle;
	url: string | null;
	relPath: string;
}

// The (url, cache path, bundle field) triple for each requested suffix. Pure:
// the repository owns the actual fetch (and its mem cache), so this stays
// testable without a cache or client.
export function imageRequests(
	key: number | string,
	sprites: RawPokemon["sprites"],
	suffixes: readonly ImageSuffix[] = ALL_IMAGE_SUFFIXES,
): ImageRequest[] {
	return suffixes.map((suffix) => ({
		suffix,
		field: IMAGE_SET[suffix].field,
		url: IMAGE_SET[suffix].url(sprites),
		relPath: imagePath(key, suffix),
	}));
}
