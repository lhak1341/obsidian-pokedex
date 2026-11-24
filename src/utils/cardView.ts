import { STAT_COLUMNS } from "../data/constants";
import type { PokedexTableRow, StatBlock } from "../data/types";
import type { ActiveGenRow } from "./activeGenScope";
import type { WidthClass } from "./browseLayout";
import { type Field, type FieldKey, FIELDS, isStatField } from "./fields";
import { formatHeightValue, formatWeightValue } from "./pokemonDisplay";
import type { SortColumn, SortState } from "./sortPokemon";

// Card view's tile and tap panel (CONTEXT.md, "Card view"). The tile reads
// Card view's own Fields selection, the Tile Fields (ADR-0020), and the sort;
// the tap panel draws every Field. These are their choices, and the grid
// geometry, kept out of the components so they are testable without a DOM.

// The chosen stats, in stat order (menu order). Total is not a stat Field.
function chosenStats(tileFields: ReadonlySet<string>): (keyof StatBlock)[] {
	return FIELDS.filter((f) => isStatField(f) && tileFields.has(f.key)).map((f) => f.key as keyof StatBlock);
}

function isStat(column: SortColumn): column is keyof StatBlock {
	return STAT_COLUMNS.some((c) => c.key === column);
}

// The two summary corners at the bottom of the sprite well. An unchosen corner
// stays empty, except Σ while the list is sorted by Total: the tile always
// shows the value it is sorted by (tileSortValue covers the rest).
export function tileCorners(tileFields: ReadonlySet<string>, sort: SortState): { ev: boolean; total: boolean } {
	return { ev: tileFields.has("ev"), total: tileFields.has("total") || sort.column === "total" };
}

// The top-left corner: the dex number, or the value the list is sorted by when
// the tile does not otherwise show it (CONTEXT.md, "Sort value"). No. is the
// dex number itself, Name is under the sprite, Total is the Σ corner
// (tileCorners). A stat carries its colour as a dot (`stat`), the same colour
// as its bar; any other Field carries its menu icon. Height and weight drop
// their unit to fit an ~75px tile (the icon says which; the tap panel has the
// unit), and keep the decimal: rounding showed Cosmoem's 999.9 kg as 1000.
// The number is formatHeightValue's/formatWeightValue's, the same as the
// Fields' render, so only the unit differs (ADR-0023 keeps this a switch).
export interface TileSortValue {
	text: string;
	icon?: string;
	stat?: keyof StatBlock;
}

export function tileSortValue(row: ActiveGenRow, sort: SortState): TileSortValue | null {
	const column = sort.column;
	if (isStat(column)) return { text: String(row.stats[column]), stat: column };
	switch (column) {
		case "id":
		case "name":
		case "total":
			return null;
		case "catchRate":
			return { text: String(row.catchRate), icon: iconOf("catchRate") };
		case "hatchCounter":
			return { text: String(row.hatchCounter), icon: iconOf("hatchCounter") };
		case "height":
			return { text: formatHeightValue(row.height), icon: iconOf("height") };
		case "weight":
			return { text: formatWeightValue(row.weight), icon: iconOf("weight") };
	}
}

function iconOf(key: string): string | undefined {
	return FIELDS.find((f) => f.key === key)?.icon;
}

// Card size (CONTEXT.md): the user's choice of tile size, per pane-width class.
// Each size sets the tile's minimum width, how much the sprite is zoomed, and
// how many stats the strip prints values under. The tile image is the sprite
// at every size (an artwork option would be a separate setting, never a size).
export type CardSize = "small" | "medium" | "large";
export const CARD_SIZES: readonly CardSize[] = ["small", "medium", "large"];
// The toggle shows each one's first letter, with the word as its label.
export const CARD_SIZE_LABELS: Record<CardSize, string> = { small: "Small", medium: "Medium", large: "Large" };
// Remembered per pane-width class, as the layout is: a phone's choice never
// resizes a wide desktop pane's tiles. Small everywhere is the tile as it was.
export type CardSizeByWidthClass = Record<WidthClass, CardSize>;
export const DEFAULT_CARD_SIZE_BY_WIDTH_CLASS: CardSizeByWidthClass = { narrow: "small", wide: "small" };

interface CardSizeSpec {
	// The grid fits as many tiles of at least this width as it can (cardGrid):
	// four, three and two at a 390px pane.
	minTileWidth: number;
	// Whole-number zoom, so pixel art stays crisp: a 96px sprite at 2× fills a
	// large tile as a native one fills a small tile.
	spriteZoom: number;
	// Above this many stats the strip drops its values and keeps only the
	// bars: five numbers no longer fit a ~75px tile, six fit a ~156px one.
	maxStatsWithValues: number;
}

export const CARD_SIZE_SPECS: Record<CardSize, CardSizeSpec> = {
	small: { minTileWidth: 72, spriteZoom: 1, maxStatsWithValues: 4 },
	medium: { minTileWidth: 96, spriteZoom: 1, maxStatsWithValues: 5 },
	large: { minTileWidth: 144, spriteZoom: 2, maxStatsWithValues: 6 },
};

export interface StatStrip {
	// The chosen stats, in stat order (menu order). Total is a corner, not a stat.
	stats: (keyof StatBlock)[];
	showValues: boolean;
	// The stat the list is sorted by, when the strip draws it: its bar stays
	// solid and the others dim, so the top corner's number reads as that bar.
	emphasis: keyof StatBlock | null;
	// 0..1: the row's stat against that stat's maximum among `rows`.
	height: (row: ActiveGenRow, stat: keyof StatBlock) => number;
}

// `rows` are the rows shown (filtered, Active Gen scoped), so a bar compares
// against its own stat among what is on screen, not a fixed ceiling. The
// heights cover every stat, not only the chosen ones: the tap panel draws all
// six with the same bars.
export function statStrip(
	rows: readonly ActiveGenRow[],
	tileFields: ReadonlySet<string>,
	sort: SortState,
	size: CardSize = "small",
): StatStrip {
	const stats = chosenStats(tileFields);
	const max = new Map<keyof StatBlock, number>();
	for (const { key } of STAT_COLUMNS) {
		let m = 0;
		for (const row of rows) m = Math.max(m, row.stats[key]);
		max.set(key, m);
	}
	const sorted = sort.column;
	return {
		stats,
		showValues: stats.length <= CARD_SIZE_SPECS[size].maxStatsWithValues,
		emphasis: isStat(sorted) && stats.includes(sorted) ? sorted : null,
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

// Card view has no column headers, so a chip row sorts: No. and Name (they are
// not Fields), then every Field that sorts, in menu order. Not only the chosen
// ones: Card view shows every Field (fieldsShown), in the tap panel and, for
// the sorted one, the tile's top corner. The row scrolls sideways.
export const SORT_CHIPS: readonly SortChip[] = [
	{ column: "id", label: "No." },
	{ column: "name", label: "Name" },
	...FIELDS.flatMap((f) => (f.sortKey ? [{ column: f.sortKey, label: f.label }] : [])),
];

// The grid's columns: as many tiles of at least the Card size's minimum width
// as fit, sharing the leftover width. At a 390px pane: four small, three
// medium or two large; more columns of about the same size on a wider one.
// Computed here rather than by CSS auto-fill because the tile needs its own
// width (fitSprite) and the tap panel needs the column count (which grid row a
// tile sits in).
export const CARD_GRID_GAP = 6;

export function cardGrid(width: number, size: CardSize = "small"): { columns: number; tileWidth: number } {
	const min = CARD_SIZE_SPECS[size].minTileWidth;
	const columns = Math.max(1, Math.floor((width + CARD_GRID_GAP) / (min + CARD_GRID_GAP)));
	return { columns, tileWidth: Math.max(0, (width - CARD_GRID_GAP * (columns - 1)) / columns) };
}

// The tap panel (CONTEXT.md, "Card view") is an accordion that opens under the
// tapped tile's grid row, in a grid item spanning the grid's full width. In a
// CSS grid that means it is drawn after the last tile of that row:
// `afterIndex`, which on a short final row is the last tile of all.
export function panelPlacement(index: number, columns: number, count: number): { row: number; afterIndex: number } {
	const row = Math.floor(index / columns);
	return { row, afterIndex: Math.min(count - 1, (row + 1) * columns - 1) };
}

// The panel's content is a fixed set (ADR-0020: six stats, Total, the chips),
// laid out for a ~390px phone pane. Across a wide pane its stat bars stretch
// to several tiles each and the chips fill one line of a long empty band, so
// the panel body spans about this many pixels of tile columns instead of the
// whole row.
export const PANEL_TARGET_WIDTH = 480;

// Which tile columns the panel body covers: the whole tiles nearest
// PANEL_TARGET_WIDTH (never more than the grid has), centred on the tapped
// tile and held inside the grid's edges, so it reads as that tile's. Its grid
// item still spans the row: a narrower item would let the next tiles flow into
// the cells beside it. Whole columns keep its edges on the tiles' edges.
// Rounding (not ceil) lands within half a tile pitch of the target: 384px at
// the narrowest (large tiles of 189px), the phone width the content fits.
export function panelColumns(index: number, columns: number, tileWidth: number): { start: number; span: number } {
	const pitch = tileWidth + CARD_GRID_GAP;
	const span = Math.min(columns, Math.max(1, Math.round((PANEL_TARGET_WIDTH + CARD_GRID_GAP) / pitch)));
	const column = index % columns;
	const start = Math.min(columns - span, Math.max(0, column - Math.floor((span - 1) / 2)));
	return { start, span };
}

// A grid row is tall when any tile in it has a form line under its name: CSS
// stretches every tile in a grid row to the tallest, so the row's height is
// one of two kinds, read from the rows rather than drawn.
export function isTallCardRow(rows: readonly Pick<PokedexTableRow, "formLabel">[], columns: number, gridRow: number): boolean {
	const end = Math.min(rows.length, (gridRow + 1) * columns);
	for (let i = gridRow * columns; i < end; i++) {
		if (rows[i].formLabel) return true;
	}
	return false;
}

// The two grid row heights, from the drawn tiles' heights (in DOM order, the
// Card window's first tile at `start`, always a grid row's first). A tile is
// stretched to its grid row's height, so one tile per grid row is read, and
// isTallCardRow says which kind of row it is. A kind with no drawn row, or
// only rows that lay out at 0 (hidden), is left out: keep the last one.
export function cardRowHeights(
	tileHeights: readonly number[],
	{ start, columns, rows }: { start: number; columns: number; rows: readonly Pick<PokedexTableRow, "formLabel">[] },
): { plain?: number; tall?: number } {
	const heights: { plain?: number; tall?: number } = {};
	for (let k = 0; k < tileHeights.length; k += columns) {
		const h = tileHeights[k];
		if (h <= 0) continue;
		if (isTallCardRow(rows, columns, Math.floor((start + k) / columns))) heights.tall = h;
		else heights.plain = h;
	}
	return heights;
}

export interface CardWindowInput {
	rows: readonly Pick<PokedexTableRow, "formLabel">[];
	columns: number;
	// The two grid row heights (isTallCardRow), measured from drawn tiles.
	rowHeight: { plain: number; tall: number };
	rowGap: number;
	// The open tap panel: the grid row it sits under and the room it adds
	// below that row (its own height plus the panel gap).
	panel: { gridRow: number; height: number } | null;
	// How far the scroller's top edge is past the grid's top edge: negative
	// while the grid starts lower down the screen.
	scrollTop: number;
	viewportHeight: number;
}

export interface CardWindow {
	// Tiles [start, end) are drawn: always whole grid rows.
	start: number;
	end: number;
	// The undrawn rows' height above and below the drawn ones, gaps included,
	// so the grid keeps its full height and every scroll offset its meaning.
	padTop: number;
	padBottom: number;
}

// The Card window (CONTEXT.md): which tiles to draw for a scroll position.
// The viewport plus one viewport above and below, in whole grid rows. The
// spacers are exact sums of the row heights, never estimates, so a restored
// scroll offset and the tapped-tile correction land where they did before.
export function cardWindow(input: CardWindowInput): CardWindow {
	const { rows, rowGap, scrollTop, viewportHeight } = input;
	const columns = Math.max(1, input.columns);
	const gridRows = Math.ceil(rows.length / columns);
	if (gridRows === 0) return { start: 0, end: 0, padTop: 0, padBottom: 0 };

	const from = scrollTop - viewportHeight;
	const to = scrollTop + 2 * viewportHeight;
	// Walk the rows top to bottom: `first` is the first row ending below
	// `from`, `last` the last row starting above `to` (at least `first`).
	let first = -1;
	let last = -1;
	let padTop = 0;
	let drawnBottom = 0;
	let bottom = 0;
	for (let r = 0; r < gridRows; r++) {
		const top = r === 0 ? 0 : bottom + rowGap;
		bottom = top + gridRowRoom(input, columns, r);
		if (first < 0 && (bottom > from || r === gridRows - 1)) {
			first = r;
			padTop = top;
		}
		if (r === first || (first >= 0 && last === r - 1 && top < to)) {
			last = r;
			drawnBottom = bottom;
		}
	}
	return {
		start: first * columns,
		end: Math.min(rows.length, (last + 1) * columns),
		padTop,
		padBottom: bottom - drawnBottom,
	};
}

// A grid row's height, plus the open panel's room under it: one rule for the
// Card window and cardRowTop, so the two never disagree about where a row is.
function gridRowRoom(input: CardRowsInput, columns: number, r: number): number {
	const { rows, rowHeight, panel } = input;
	return (isTallCardRow(rows, columns, r) ? rowHeight.tall : rowHeight.plain) + (panel?.gridRow === r ? panel.height : 0);
}

// Where the grid's rows are: what cardWindow and cardRowTop both read, so
// CardGrid builds it once.
export type CardRowsInput = Pick<CardWindowInput, "rows" | "columns" | "rowHeight" | "rowGap" | "panel">;

// Where grid row `gridRow` starts, from the grid's top edge. A Card size change
// re-lays the grid out with a new column count; CardGrid scrolls the tile that
// was at the top of the viewport back there with this.
export function cardRowTop(input: CardRowsInput, gridRow: number): number {
	const columns = Math.max(1, input.columns);
	let top = 0;
	for (let r = 0; r < gridRow; r++) top += gridRowRoom(input, columns, r) + input.rowGap;
	return top;
}

// A Card size change re-lays the grid out with a new column count, so the
// same scroll offset would show other Pokemon. The tile that was at the top
// of the viewport (`index`, `offset` from the viewport's top edge) is put back
// there. CardGrid supplies the DOM: `read` gives the viewport's and grid's top
// edges and the tile's own top when the Card window draws it (else null), or
// null when the grid is gone; `rowTop` is where the tile's grid row starts
// (cardRowTop); `nextLayout` waits until the grid has re-laid out.
export interface TopTileIo {
	read: (index: number) => { viewTop: number; gridTop: number; tileTop: number | null } | null;
	rowTop: (index: number) => number;
	scrollBy: (delta: number) => void;
	nextLayout: () => Promise<void>;
}

export const MAX_TOP_TILE_PASSES = 4;

// Each pass puts the tile back at its offset: from the drawn tile when it is
// drawn, else from the row arithmetic. A jump redraws the window and
// re-measures heights, which can move the tile again, so it repeats until a
// drawn tile is within a pixel (two passes in practice). A newer call on the
// same `state` (another size change while this one runs) stops this one, or
// the loops push the scroller toward each other's anchors in turn (probed:
// three quick changes left the tile 55px off). The newer call keeps the older
// one's anchor while it is pending: the anchor it read itself comes from a
// grid laid out for one frame at the old offset, a tile the user never chose
// (probed: S→M→L 30ms apart ended on #272, started on #986). Only the run
// still current clears it, when it settles, caps or loses the grid. Resolves
// "settled", "capped" (still moving after `maxPasses` scrolls) or "stopped"
// (superseded, or no grid to read).
export type TopTileAnchor = { index: number; offset: number };
export interface TopTileState {
	run: number;
	pending: TopTileAnchor | null;
}

export async function settleTopTile(
	state: TopTileState,
	anchor: TopTileAnchor,
	io: TopTileIo,
	maxPasses = MAX_TOP_TILE_PASSES,
): Promise<"settled" | "capped" | "stopped"> {
	const run = ++state.run;
	const kept = state.pending ?? anchor;
	state.pending = kept;
	const result = await settlePasses(state, run, kept, io, maxPasses);
	if (run === state.run) state.pending = null;
	return result;
}

async function settlePasses(
	state: TopTileState,
	run: number,
	anchor: TopTileAnchor,
	io: TopTileIo,
	maxPasses: number,
): Promise<"settled" | "capped" | "stopped"> {
	for (let pass = 0; pass < maxPasses; pass++) {
		await io.nextLayout();
		if (run !== state.run) return "stopped";
		const reading = io.read(anchor.index);
		if (!reading) return "stopped";
		const tileTop = reading.tileTop ?? reading.gridTop + io.rowTop(anchor.index);
		const delta = tileTop - (reading.viewTop + anchor.offset);
		if (reading.tileTop !== null && Math.abs(delta) < 1) return "settled";
		io.scrollBy(delta);
	}
	return "capped";
}

// The tap panel shows every Field, whatever the tile's selection (ADR-0020):
// the six stats as columns with Total after them, then every other Field as a
// chip, in menu order (FIELDS order; users cannot reorder Fields).
export const PANEL_STATS: readonly (keyof StatBlock)[] = STAT_COLUMNS.map((c) => c.key);
export const PANEL_CHIPS: readonly Field[] = FIELDS.filter((f) => !isStatField(f) && f.key !== "total");

// Chips that wrap onto a new line as one unit: Height and Weight describe one
// thing (size), and a line break between them left Weight alone on a line.
const WRAP_TOGETHER: readonly (readonly FieldKey[])[] = [["height", "weight"]];

// PANEL_CHIPS in wrapping units, in the same order: each chip alone, except
// adjacent chips WRAP_TOGETHER pairs up.
export const PANEL_CHIP_GROUPS: readonly (readonly Field[])[] = PANEL_CHIPS.reduce<Field[][]>((groups, field) => {
	const last = groups[groups.length - 1] as Field[] | undefined;
	const prev = last?.[last.length - 1];
	const joins = prev !== undefined && WRAP_TOGETHER.some((set) => set.includes(prev.key) && set.includes(field.key));
	if (last && joins) last.push(field);
	else groups.push([field]);
	return groups;
}, []);

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
// canvas clipped Venusaur and Charizard), at the Card size's whole-number zoom
// (1:1 or 2:2 pixels) unless the box is larger than the well's room at that
// zoom, then scaled down to fit (a fractional scale, drawn smoothed). Never
// above the zoom, so every sprite in a grid keeps its size relative to the
// others. `left`/`top` place the canvas's top-left corner inside the well.
export interface SpritePlacement {
	scale: number;
	left: number;
	top: number;
	width: number;
	height: number;
}

export function fitSprite(bounds: ContentBounds, well: number, zoom = 1): SpritePlacement {
	const room = well - 2 * WELL_INSET;
	const scale = Math.min(zoom, room / Math.max(bounds.width, bounds.height));
	return {
		scale,
		left: well / 2 - (bounds.x + bounds.width / 2) * scale,
		top: well / 2 - (bounds.y + bounds.height / 2) * scale,
		width: bounds.canvasWidth * scale,
		height: bounds.canvasHeight * scale,
	};
}
