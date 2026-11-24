import type { PluginSettings } from "../data/types";
import type { ActiveGenRow } from "./activeGenScope";
import { FIELDS, type Field, type FieldKey, formatEvYield, unhandledCustomCell } from "./fields";
import { formatItemName, formatPokemonDisplayName } from "./pokemonDisplay";
import { widestRows } from "./tableWindow";

// The table's own geometry for each Field (the Field itself — label, icon,
// sort key, value — lives in fields.ts and is shared with Card view).
interface TableGeometry {
	// widthPercent becomes the <col>'s width (table stays table-layout: auto
	// — see TableScreen's comment on why). minWidth becomes a real min-width
	// on the <th>, sized to this column's actual max content (a 3-digit
	// stat, a sort arrow's worst case, etc) as a deliberate floor/buffer;
	// auto layout's own never-shrink-below-content behavior is what actually
	// guarantees no wrapping. widthPercent just lets the column claim a
	// share of extra space on a wide pane instead of all of it going to Name.
	widthPercent: string;
	minWidth: string;
	// Right-align the cell so a variable-width number keeps its unit suffix
	// (" m", " kg") lined up between rows instead of ragged.
	align?: "right";
}

const STAT: TableGeometry = { widthPercent: "4%", minWidth: "52px", align: "right" };

// Keyed by FieldKey, so a Field without an entry fails typecheck (and
// tableColumns.test.ts pins it at runtime too).
export const TABLE_GEOMETRY: Record<FieldKey, TableGeometry> = {
	hp: STAT,
	attack: STAT,
	defense: STAT,
	specialAttack: STAT,
	specialDefense: STAT,
	speed: STAT,
	total: STAT,
	ev: { widthPercent: "6%", minWidth: "204px" },
	heldItems: { widthPercent: "6%", minWidth: "140px" },
	encounterLocation: { widthPercent: "6%", minWidth: "140px" },
	catchRate: STAT,
	hatchCounter: STAT,
	height: { widthPercent: "5%", minWidth: "76px", align: "right" },
	weight: { widthPercent: "6%", minWidth: "88px", align: "right" },
};

export type TableColumn = Field & TableGeometry;

// Every Field joined with its geometry, in menu order; TableScreen filters
// this by the chosen Fields.
export const TABLE_COLUMNS: TableColumn[] = FIELDS.map((f) => ({ ...f, ...TABLE_GEOMETRY[f.key] }));

// A column's <col> width (`width`, undefined = auto) and its <th> floor
// (`min`), as TABLE_GEOMETRY's widthPercent/minWidth are for a Field.
export interface ColumnWidth {
	width: string | undefined;
	min: string;
}

// The four columns every table draws ahead of the Fields: No., sprite, Name
// and Type, plus whether Type draws icons and whether compact density's
// smaller sprite and padding apply.
export interface TableFrame {
	number: ColumnWidth;
	sprite: ColumnWidth;
	name: ColumnWidth;
	type: ColumnWidth;
	typeIcons: boolean;
	compact: boolean;
}

// A Narrow pane's table scrolls sideways with No., sprite and Name pinned
// (CONTEXT.md, "Narrow pane"). The pinned columns' left offsets in
// TableScreen's CSS add up No. and sprite, so those two are exact px widths
// their content fits inside; Name is the last pinned column, so it is the
// auto column: a floor, and it takes any spare width a short Fields selection
// leaves. Type draws 22px icons whatever the type-icons setting says, so a
// dual type takes 58px instead of the type badges' 168px. The pinned sprite is
// a fixed 32px in a 36px column, so compact density does not apply there.
export function tableFrame({ narrow, density, useTypeIcons }: {
	narrow: boolean;
	density: PluginSettings["gridDensity"];
	useTypeIcons: boolean;
}): TableFrame {
	if (narrow) {
		return {
			number: { width: "32px", min: "32px" },
			sprite: { width: "36px", min: "36px" },
			name: { width: undefined, min: "112px" },
			type: { width: "58px", min: "58px" },
			typeIcons: true,
			compact: false,
		};
	}
	// No. is a dex number (up to 4 digits) vs a stat's 3; sprite/type widths
	// swing with density and the icon-vs-text type display respectively.
	return {
		number: { width: "4%", min: "60px" },
		sprite: density === "compact" ? { width: "3%", min: "40px" } : { width: "4%", min: "48px" },
		name: { width: "25%", min: "20ch" },
		type: useTypeIcons ? { width: "6%", min: "76px" } : { width: "10%", min: "168px" },
		typeIcons: useTypeIcons,
		compact: density === "compact",
	};
}

// A Field column's <col> width. On a Narrow pane it is the floor in px (a stat
// stays 52px), so spare width goes to Name (tableFrame) rather than being
// shared out across the stats by percentage.
export function columnWidth(col: TableGeometry, narrow: boolean): string {
	return narrow ? col.minWidth : col.widthPercent;
}

// One row's cell text width, for widestRows' ranking only: `key` names the
// column (or a variant of it, as Name's narrow and wide texts), and `text` is
// built only when that row and key have no width yet.
export type RowTextWidths = (row: object, key: string, text: () => string) => number;

// Each row's widths, cached by row object: the Active Gen scoping memo keeps a
// row's object across streamed updates, sorts and filters, so a row is
// measured once per column. `measure` is TableScreen's canvas measureText in
// the table's font; a font change makes a new cache.
export function createRowTextWidths(measure: (text: string) => number): RowTextWidths {
	const cache = new WeakMap<object, Map<string, number>>();
	return (row, key, text) => {
		let byKey = cache.get(row);
		if (!byKey) cache.set(row, (byKey = new Map<string, number>()));
		let w = byKey.get(key);
		if (w === undefined) byKey.set(key, (w = measure(text())));
		return w;
	};
}

// The rows the Table window draws wherever it is (ADR-0019): each
// content-sized column's widest, so the auto table sizes every column as it
// would from all rows. No., sprite and the type icons are fixed widths; every
// other column scores the text its cell draws in TableScreen. Name on a Narrow
// pane draws the base name with the form on a second line that stays out of
// the cell's min-content, so only the base name counts. EV ranks by chip
// count first: each chip adds its padding and dot, which the text leaves out.
export function tableWidestRows<T extends ActiveGenRow>(rows: readonly T[], { frame, columns, narrow, widths }: {
	frame: Pick<TableFrame, "typeIcons">;
	// The chosen Fields' columns, as the table draws them.
	columns: readonly TableColumn[];
	narrow: boolean;
	widths: RowTextWidths;
}): number[] {
	const scores: ((row: T) => number)[] = [
		narrow
			? (row) => widths(row, "name:narrow", () => row.name)
			: (row) => widths(row, "name", () => formatPokemonDisplayName(row)),
	];
	if (!frame.typeIcons) scores.push((row) => widths(row, "type", () => row.types.join(" ")));
	for (const col of columns) {
		if (col.custom === "heldItems") {
			scores.push((row) => widths(row, col.key, () => row.heldItems.map((i) => formatItemName(i.name)).join(", ")));
		} else if (col.custom === "ev") {
			scores.push((row) => row.evYield.length * 10_000 + widths(row, col.key, () => formatEvYield(row)));
		} else if (!col.custom) {
			const render = col.render;
			scores.push((row) => widths(row, col.key, () => render(row)));
		} else {
			// A custom Field with no score would change its column's width
			// as rows scroll in: this fails typecheck until it has one.
			unhandledCustomCell(col.custom);
		}
	}
	return widestRows(rows, scores);
}
