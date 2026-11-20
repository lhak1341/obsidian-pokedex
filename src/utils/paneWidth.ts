// The Pokedex leaf's width, read two ways: the browse screen's width class
// (table or Card view per class, browseLayout.ts) and the detail screen's band
// (detailBand.ts). PokedexApp keeps one PaneWidth, fed by a ResizeObserver on
// the leaf, and assigns paneWidth's result back every time: an unchanged result
// is the same object, so Svelte re-renders nothing for it.
import { widthClass, type WidthClass } from "./browseLayout";
import { detailBand, type DetailBand } from "./detailBand";

export interface PaneWidth {
	readonly widthClass: WidthClass;
	readonly band: DetailBand;
}

// A hidden leaf (a background tab) measures 0, so at mount it starts wide, in
// three columns, until it has a width. Inferred, not observed: a background
// tab on a phone mounted while hidden (a restored workspace) draws the table
// until its first resize.
export const HIDDEN_LEAF_FALLBACK: PaneWidth = { widthClass: "wide", band: "columns" };

// A width of 0 keeps `prev` (the fallback at mount); otherwise `prev` itself
// comes back unless the width class or the band changed.
export function paneWidth(width: number, prev: PaneWidth = HIDDEN_LEAF_FALLBACK): PaneWidth {
	if (width <= 0) return prev;
	const next = { widthClass: widthClass(width), band: detailBand(width) };
	return next.widthClass === prev.widthClass && next.band === prev.band ? prev : next;
}
