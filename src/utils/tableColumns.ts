import type { PluginSettings } from "../data/types";
import { FIELDS, type Field, type FieldKey } from "./fields";

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
			name: { width: undefined, min: "108px" },
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
