// The detail screen has three bands by Pokedex leaf width (#18): the phone
// tabs in a Narrow pane, a sticky identity rail with two tabs up to 1100px,
// and three columns from there. The phone band is the narrow width class, by
// construction; PokedexApp reads both through paneWidth.ts. CSS never
// re-derives a band.
import { widthClass } from "./browseLayout";

export const DETAIL_COLUMNS_MIN_WIDTH = 1100;
// The header's one CSS-only breakpoint: two rows below a 780px leaf, one from
// 780 (`@container pane (width < 780px)`, pinned by paneBreakpoint.test.ts).
export const DETAIL_HEADER_ONE_ROW_MIN_WIDTH = 780;

export type DetailBand = "phone" | "rail" | "columns";

export function detailBand(width: number): DetailBand {
	if (widthClass(width) === "narrow") return "phone";
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
// (Moves is in both tab sets, so it survives a resize across 600), else its
// first tab; the selection itself is untouched, so resizing back restores a
// phone tab the rail lacks.
export function shownDetailTab(selected: DetailTab, band: DetailBand): DetailTab | null {
	const tabs = TABS[band];
	if (tabs.length === 0) return null;
	return tabs.some((t) => t.key === selected) ? selected : tabs[0].key;
}
