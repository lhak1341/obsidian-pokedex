// The detail screen has three bands by Pokedex leaf width (#18): the phone
// tabs below 760px, a sticky identity rail with two tabs up to 1100px, and
// three columns from there. PokedexApp reads the band and the browse width
// class through paneWidth.ts. CSS never re-derives a band.
//
// The phone band reaches past the Narrow pane (600): from 600 to 760 the
// rail's 232px identity column left the tab column narrower (239px) than the
// whole phone column at 390 (293px), so stat bars shrank to ~20px and the
// move table dropped to one-letter headers one pixel after the phone band
// gave them room. Browse keeps switching at 600, so a 600-759px leaf shows
// the wide table but the phone detail screen.

export const DETAIL_PHONE_MAX_WIDTH = 760;
export const DETAIL_COLUMNS_MIN_WIDTH = 1100;
// The header's one CSS-only breakpoint: two rows below a 780px leaf, one from
// 780 (`@container pane (width < 780px)`, pinned by paneBreakpoint.test.ts).
export const DETAIL_HEADER_ONE_ROW_MIN_WIDTH = 780;
// The phone hero's type badges stack below a 420px leaf
// (`@container pane (width < 420px)`, pinned by paneBreakpoint.test.ts): two
// badges in a row covered the name at 320 (Grass over "Venusaur").
export const DETAIL_HERO_TYPES_STACK_MAX_WIDTH = 420;

export type DetailBand = "phone" | "rail" | "columns";

export function detailBand(width: number): DetailBand {
	if (width < DETAIL_PHONE_MAX_WIDTH) return "phone";
	return width < DETAIL_COLUMNS_MIN_WIDTH ? "rail" : "columns";
}

export type DetailTab = "about" | "evolution" | "stats" | "overview" | "moves";

export type DetailTabSpec = { key: DetailTab; label: string };

const TABS: Record<DetailBand, readonly DetailTabSpec[]> = {
	phone: [
		{ key: "about", label: "About" },
		{ key: "evolution", label: "Evolution" },
		{ key: "stats", label: "Stats" },
		{ key: "moves", label: "Moves" },
	],
	rail: [
		{ key: "overview", label: "Overview" },
		{ key: "moves", label: "Moves" },
	],
	columns: [],
};

export function tabsForBand(band: DetailBand): readonly DetailTabSpec[] {
	return TABS[band];
}

// One selected tab is kept across bands. A band shows it if it has that tab
// (Moves is in both tab sets, so it survives a resize across 760, the
// phone/rail boundary), else its first tab; the selection itself is
// untouched, so resizing back restores a phone tab the rail lacks.
export function shownDetailTab(selected: DetailTab, band: DetailBand): DetailTab | null {
	const tabs = TABS[band];
	if (tabs.length === 0) return null;
	return tabs.some((t) => t.key === selected) ? selected : tabs[0].key;
}
