import { STAT_COLUMNS } from "../data/constants";
import type { PokedexTableRow, StatBlock } from "../data/types";
import type { ActiveGenRow } from "./activeGenScope";
import type { BrowseLayout } from "./browseLayout";
import type { SortColumn, SortState } from "./sortPokemon";
import { describeEncounters } from "./encounters";
import { formatHeight, formatWeight } from "./pokemonDisplay";
import { totalStat } from "./stats";

// The Fields the user chooses from in the browse screen's Fields menu (see
// CONTEXT.md, "Fields"). One list, read by every layout; each layout keeps its
// own selection (ADR-0020). The table draws a chosen Field as a column (its
// geometry lives in tableColumns.ts, keyed by FieldKey); Card view's tile draws
// a chosen Tile Field, and its tap panel draws every Field.
// Order is menu order: stats in stat order, then the Other Fields.

// Exported for EvChips.svelte (the table's EV cell and the detail screen),
// which renders coloured chips (see STAT_COLORS) rather than a plain-text
// join, but still needs the same stat-key-to-abbreviation lookup.
export const STAT_LABEL_BY_KEY = new Map(STAT_COLUMNS.map((c) => [c.key, c.label]));

// The EV yield as one string — the chip cell's hover tooltip. The cell body
// itself is drawn by EvChips.svelte, so this is not a `render`.
export function formatEvYield(row: Pick<PokedexTableRow, "evYield">): string {
	return row.evYield.length === 0
		? "-"
		: row.evYield.map((y) => `${y.amount} ${STAT_LABEL_BY_KEY.get(y.stat) ?? y.stat}`).join(", ");
}

// A closed union, so tableColumns.ts's Record<FieldKey, …> fails typecheck
// when a Field has no table geometry.
export type FieldKey =
	| keyof StatBlock
	| "total"
	| "ev"
	| "heldItems"
	| "encounterLocation"
	| "catchRate"
	| "hatchCounter"
	| "height"
	| "weight";

interface FieldBase {
	key: FieldKey;
	label: string;
	// The Lucide icon for the Field in the Fields menu, on Card view's tap panel
	// chip and, in the table, the
	// header (with `label` as a hover tooltip) instead of the full text label,
	// to keep wide columns like "Catch rate"/"Hatch counter" from blowing out
	// the table width. Stats have none: they keep their short text labels.
	// Which section a Field sits in is isStatField, not whether it has an icon.
	icon?: string;
	sortKey?: SortColumn;
}

// A plain-text Field: both layouts' generic cell is `render(row)`, with
// `title(row)` as its hover text when the Field has one. The row is an
// ActiveGenRow (CONTEXT.md "Active Gen scoping"), so stats and Capture
// locations are already the Active Gen's; a Field cannot reach the unscoped
// `*AllGens` data at all.
//
// A `custom` Field has no `render` at all — the layout draws its cell itself
// because the cell is more than a string: held items are Info popover
// targets, EV yield is coloured chips. The type makes "render exists but
// production never calls it" unrepresentable; Fields used to carry such a
// function, and tests pinned behavior the app never ran. `custom` names which
// cell TableScreen and CardPanel draw; both templates branch on each value
// and end in unhandledCustomCell, as does tableColumns.ts's tableWidestRows
// (each content-sized column's width score, ADR-0019), so a new value without its
// own branch in each fails typecheck there.
export type CustomCell = "heldItems" | "ev";

// A layout's fallback after its last `custom` branch. The parameter is
// `never`, so it type-checks only while every CustomCell value has a branch
// above it; at runtime it draws nothing, keeping the row aligned.
export function unhandledCustomCell(custom: never): string {
	void custom;
	return "";
}

export type Field =
	| (FieldBase & {
			render: (row: ActiveGenRow) => string;
			title?: (row: ActiveGenRow) => string;
			// True when the row has no value. Card view's tap panel then draws
			// the muted "None" its held item chip uses; the table keeps
			// `render`'s "-", as every empty table cell shows.
			empty?: (row: ActiveGenRow) => boolean;
			custom?: undefined;
	  })
	| (FieldBase & { custom: CustomCell });

export const FIELDS: Field[] = [
	...STAT_COLUMNS.map((col) => ({
		key: col.key,
		label: col.label,
		sortKey: col.key,
		render: (row: ActiveGenRow) => String(row.stats[col.key]),
	})),
	{ key: "total", label: "Total", icon: "sigma", sortKey: "total", render: (row) => String(totalStat(row.stats)) },
	{ key: "ev", label: "EV yield", icon: "dumbbell", custom: "ev" },
	{ key: "heldItems", label: "Held item", icon: "gift", custom: "heldItems" },
	{
		key: "encounterLocation",
		label: "Capture",
		icon: "map-pin",
		// How it is obtained at the Active Gen ("Wild, Trade"), with every
		// location as the hover text: one describeEncounters result for both.
		render: (row) => {
			const encounters = describeEncounters(row.encounterLocations);
			return encounters.isEmpty ? "-" : encounters.summary;
		},
		title: (row) => describeEncounters(row.encounterLocations).tooltip,
		empty: (row) => describeEncounters(row.encounterLocations).isEmpty,
	},
	{ key: "catchRate", label: "Catch rate", icon: "target", sortKey: "catchRate", render: (row) => String(row.catchRate) },
	{
		key: "hatchCounter",
		label: "Hatch counter",
		icon: "egg",
		sortKey: "hatchCounter",
		render: (row) => String(row.hatchCounter),
	},
	{ key: "height", label: "Height", icon: "ruler", sortKey: "height", render: (row) => formatHeight(row.height) },
	{ key: "weight", label: "Weight", icon: "weight", sortKey: "weight", render: (row) => formatWeight(row.weight) },
];

// One of the six base stats: the Fields menu's Stats section, and in Card view
// the tile's stat strip and the panel's stat columns. Total is not a stat
// Field; each layout places it on its own (menu: Other; tile: a corner;
// panel: a column after the stats).
export function isStatField(field: Field): boolean {
	return STAT_LABEL_BY_KEY.has(field.key as keyof StatBlock);
}

// The table's fresh-install selection: the six stats, Total and EV yield.
// hydrateSettings keeps any saved selection as it is, so an upgrading user is
// not widened to this.
export const DEFAULT_VISIBLE_FIELDS: FieldKey[] = [...STAT_COLUMNS.map((c) => c.key), "total", "ev"];

// The Fields a Card view tile has room for (CONTEXT.md, "Tile Fields"): the
// stat strip, the Σ corner and the EV corner. Card view's Fields menu offers
// these only; the tap panel shows every Field whatever is chosen.
export const TILE_FIELD_KEYS: readonly FieldKey[] = [...STAT_COLUMNS.map((c) => c.key), "total", "ev"];

export function isTileField(field: Field): boolean {
	return TILE_FIELD_KEYS.includes(field.key);
}

// Card view's fresh-install selection: everything the tile can draw.
export const DEFAULT_CARD_FIELDS: FieldKey[] = [...TILE_FIELD_KEYS];

const ALL_FIELD_KEYS: ReadonlySet<string> = new Set(FIELDS.map((f) => f.key));

// The Fields a layout shows somewhere. The table shows its chosen ones; Card
// view shows every Field (its tap panel draws them all, and the tile's top
// corner shows whichever the list is sorted by), so its selection never
// limits what it can sort by.
export function fieldsShown(layout: BrowseLayout, visibleFields: ReadonlySet<string>): ReadonlySet<string> {
	return layout === "card" ? ALL_FIELD_KEYS : visibleFields;
}

// The list is never sorted by a Field the user cannot see: when the Field
// owning the current sort is no longer shown (fieldsShown), the sort resets to
// No. ascending. No. and Name are not Fields, so they always stay.
export function sortAfterFieldsChange(sort: SortState, visibleFields: ReadonlySet<string>): SortState {
	const owner = FIELDS.find((f) => f.sortKey === sort.column);
	return owner && !visibleFields.has(owner.key) ? { column: "id", direction: "asc" } : sort;
}
