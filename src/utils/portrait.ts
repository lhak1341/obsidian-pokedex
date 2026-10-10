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

// How much to shrink the shown render so it matches its non-shiny
// counterpart's on-screen size (see imageBounds.ts for why shiny artwork can
// crop tighter). 1 whenever no correction applies; never above 1, so the
// non-shiny baseline's own size never changes. `measure` is injected (the
// view passes imageBounds.ts's contentScale, which needs a DOM canvas) so the
// rule is testable without one. null means "no usable measurement, keep the
// previous scale": the view must not overwrite it. A rejected `measure`
// propagates to the caller.
export async function resolvePortraitScale(args: {
	style: PluginSettings["spriteStyle"];
	baseUri: string | null;
	currentUri: string | null;
	measure: (dataUri: string) => Promise<number>;
}): Promise<number | null> {
	const { style, baseUri, currentUri, measure } = args;
	if (style !== "official-artwork" || !baseUri || !currentUri || baseUri === currentUri) return 1;
	const [baseFill, currentFill] = await Promise.all([measure(baseUri), measure(currentUri)]);
	if (currentFill <= 0) return null;
	return Math.min(baseFill / currentFill, 1);
}
