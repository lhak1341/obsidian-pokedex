// The browse screen draws one list two ways, the table or Card view, and each
// pane-width class remembers its own choice (CONTEXT.md, "Narrow pane"), so a
// phone (settings sync) choosing cards never flips a wide desktop pane to cards.

// One threshold: a Pokedex leaf narrower than this is a Narrow pane. CSS reads
// the same 600px through container queries; JS reads it here, fed by a
// ResizeObserver on the leaf (PokedexApp).
export const NARROW_PANE_MAX_WIDTH = 600;

export type WidthClass = "narrow" | "wide";
export type BrowseLayout = "table" | "card";
export type LayoutByWidthClass = Record<WidthClass, BrowseLayout>;

export const DEFAULT_LAYOUT_BY_WIDTH_CLASS: LayoutByWidthClass = { narrow: "card", wide: "table" };

export function widthClass(width: number): WidthClass {
	return width < NARROW_PANE_MAX_WIDTH ? "narrow" : "wide";
}

// The toggle writes only the current width class; the other keeps its choice.
export function chooseLayout(
	layouts: LayoutByWidthClass,
	current: WidthClass,
	layout: BrowseLayout,
): LayoutByWidthClass {
	return { ...layouts, [current]: layout };
}
