import type { PokedexTableRow, StatBlock } from "../data/types";
import { type Field, FIELDS, isStatField } from "./fields";
import type { SortColumn } from "./sortPokemon";

// Card view's tile and tap panel (CONTEXT.md, "Card view") read the same Fields
// selection as the table. These are their choices that depend on it, and the
// grid geometry, kept out of the components so they are testable without a DOM.

// The chosen stats, in stat order (menu order). Total is not a stat Field.
function chosenStats(visibleFields: ReadonlySet<string>): (keyof StatBlock)[] {
	return FIELDS.filter((f) => isStatField(f) && visibleFields.has(f.key)).map((f) => f.key as keyof StatBlock);
}

// The two summary corners at the bottom of the sprite well. The top corners do
// not depend on Fields: the number always shows, the favourite mark when it is
// one. An unchosen corner stays empty.
export function tileCorners(visibleFields: ReadonlySet<string>): { ev: boolean; total: boolean } {
	return { ev: visibleFields.has("ev"), total: visibleFields.has("total") };
}

// Above this many stats the strip drops its values and keeps only the bars:
// five numbers no longer fit an ~85px tile.
const MAX_STATS_WITH_VALUES = 4;

export interface StatStrip {
	// The chosen stats, in stat order (menu order). Total is a corner, not a stat.
	stats: (keyof StatBlock)[];
	showValues: boolean;
	// 0..1: the row's stat against that stat's maximum among `rows`.
	height: (row: PokedexTableRow, stat: keyof StatBlock) => number;
}

// `rows` are the rows shown (filtered, Active Gen scoped), so a bar compares
// against its own stat among what is on screen, not a fixed ceiling.
export function statStrip(rows: readonly PokedexTableRow[], visibleFields: ReadonlySet<string>): StatStrip {
	const stats = chosenStats(visibleFields);
	const max = new Map<keyof StatBlock, number>();
	for (const stat of stats) {
		let m = 0;
		for (const row of rows) m = Math.max(m, row.stats[stat]);
		max.set(stat, m);
	}
	return {
		stats,
		showValues: stats.length <= MAX_STATS_WITH_VALUES,
		height: (row, stat) => {
			const m = max.get(stat) ?? 0;
			return m > 0 ? row.stats[stat] / m : 0;
		},
	};
}

export interface SortChip {
	column: SortColumn;
	label: string;
}

// Card view has no column headers, so a chip row sorts: No. and Name always
// (they are not Fields), then every chosen Field that sorts, in menu order.
export function sortChips(visibleFields: ReadonlySet<string>): SortChip[] {
	const fieldChips = FIELDS.flatMap((f) =>
		f.sortKey && visibleFields.has(f.key) ? [{ column: f.sortKey, label: f.label }] : []
	);
	return [{ column: "id", label: "No." }, { column: "name", label: "Name" }, ...fieldChips];
}

// The grid's columns: as many tiles of at least MIN_TILE_WIDTH as fit, sharing
// the leftover width. Four at a 390px pane, more columns of about the same
// size on a wider one. Computed here rather than by CSS auto-fill because the
// tile needs its own width (fitSprite) and the tap panel needs the column count
// (which grid row a tile sits in).
const MIN_TILE_WIDTH = 72;
export const CARD_GRID_GAP = 6;

export function cardGrid(width: number): { columns: number; tileWidth: number } {
	const columns = Math.max(1, Math.floor((width + CARD_GRID_GAP) / (MIN_TILE_WIDTH + CARD_GRID_GAP)));
	return { columns, tileWidth: Math.max(0, (width - CARD_GRID_GAP * (columns - 1)) / columns) };
}

// The tap panel (CONTEXT.md, "Card view") is an accordion that opens under the
// tapped tile's grid row, spanning the grid's full width. In a CSS grid that
// means it is drawn after the last tile of that row: `afterIndex`, which on a
// short final row is the last tile of all.
export function panelPlacement(index: number, columns: number, count: number): { row: number; afterIndex: number } {
	const row = Math.floor(index / columns);
	return { row, afterIndex: Math.min(count - 1, (row + 1) * columns - 1) };
}

// Five or six stats stretch across the panel as the tile's columns scaled up.
// Four or fewer keep a fixed narrow width, aligned left, so two stats do not
// become flat slabs.
const MIN_STRETCHED_STATS = 5;

export interface PanelStats {
	// The chosen stats, in stat order (menu order).
	stats: (keyof StatBlock)[];
	mode: "stretched" | "fixed";
	// Total is not a stat Field: a muted column after a hairline at the right
	// of the stats. With no stat chosen there is no stat row, and Total is a
	// chip instead (panelChips), so the panel stays header and chips.
	total: boolean;
}

export function panelStats(visibleFields: ReadonlySet<string>): PanelStats {
	const stats = chosenStats(visibleFields);
	return {
		stats,
		mode: stats.length >= MIN_STRETCHED_STATS ? "stretched" : "fixed",
		total: stats.length > 0 && visibleFields.has("total"),
	};
}

// The panel's chips: every chosen Field that is not a stat, in menu order
// (FIELDS order; users cannot reorder Fields). Total only when it has no stat
// row to sit in (see PanelStats.total).
export function panelChips(visibleFields: ReadonlySet<string>): Field[] {
	const totalIsColumn = panelStats(visibleFields).total;
	return FIELDS.filter((f) => !isStatField(f) && visibleFields.has(f.key) && !(f.key === "total" && totalIsColumn));
}

// An image's opaque bounding box inside its canvas (imageBounds.ts measures it).
export interface ContentBounds {
	x: number;
	y: number;
	width: number;
	height: number;
	canvasWidth: number;
	canvasHeight: number;
}

// The sprite well leaves this much room on each side of the content.
const WELL_INSET = 4;

// Places a sprite in a square well of `well` px: centred on its opaque bounding
// box, not its canvas (PokeAPI's 96px sprites sit off-centre, and centring the
// canvas clipped Venusaur and Charizard), at native 1:1 pixels unless the box
// is larger than the well's room, then scaled down to fit. Never scaled up.
// `left`/`top` place the canvas's top-left corner inside the well.
export interface SpritePlacement {
	scale: number;
	left: number;
	top: number;
	width: number;
	height: number;
}

export function fitSprite(bounds: ContentBounds, well: number): SpritePlacement {
	const room = well - 2 * WELL_INSET;
	const scale = Math.min(1, room / Math.max(bounds.width, bounds.height));
	return {
		scale,
		left: well / 2 - (bounds.x + bounds.width / 2) * scale,
		top: well / 2 - (bounds.y + bounds.height / 2) * scale,
		width: bounds.canvasWidth * scale,
		height: bounds.canvasHeight * scale,
	};
}
