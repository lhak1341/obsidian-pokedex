import type { PluginSettings, PortraitImageSource } from "../data/types";

// Falls back to the regular shiny sprite when spriteStyle is
// "official-artwork" but that particular render has no shiny artwork on
// PokeAPI (rare, but happens) — still a visible shiny swap, just not
// artwork-styled.
function shinyPortrait(source: PortraitImageSource, style: PluginSettings["spriteStyle"]): string | null {
	return style === "official-artwork"
		? source.shinyArtworkDataUri ?? source.shinyDataUri ?? null
		: source.shinyDataUri ?? null;
}

function basePortrait(source: PortraitImageSource, style: PluginSettings["spriteStyle"]): string | null {
	return (style === "official-artwork" ? source.artworkDataUri : source.spriteDataUri) ??
		source.spriteDataUri ??
		null;
}

// What image DetailScreen actually shows for the current entry (base species
// or a selected Mega form) — combines the style-driven base/shiny lookups
// with the shiny-toggle-to-base double-fallback (a Pokemon with no shiny
// artwork/sprite at all still shows its base portrait rather than nothing
// when showShiny is on).
export function resolvePortrait(
	source: PortraitImageSource,
	style: PluginSettings["spriteStyle"],
	showShiny: boolean,
): string | null {
	const base = basePortrait(source, style);
	if (!showShiny) return base;
	return shinyPortrait(source, style) ?? base;
}
