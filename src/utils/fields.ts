import { STAT_COLUMNS } from "../data/constants";
import type { PokedexTableRow, StatBlock } from "../data/types";
import type { SortColumn, SortState } from "./sortPokemon";
import { formatHeight, formatWeight } from "./pokemonDisplay";
import { totalStat } from "./stats";

// The Fields the user chooses from in the browse screen's Fields menu (see
// CONTEXT.md, "Fields"). One list, read by every layout: the table draws a
// chosen Field as a column (its geometry lives in tableColumns.ts, keyed by
// FieldKey), and Card view will draw it on the tile and in the tap panel.
// Order is menu order: stats in stat order, then the Other Fields.

// Exported for EvChips.svelte (the table's EV cell and the detail screen),
// which renders coloured chips (see STAT_COLORS) rather than a plain-text
// join, but still needs the same stat-key-to-abbreviation lookup.
export const STAT_LABEL_BY_KEY = new Map(STAT_COLUMNS.map((c) => [c.key, c.label]));

// The EV yield as one string — the chip cell's hover tooltip. The cell body
// itself is drawn by EvChips.svelte, so this is not a `render`.
export function formatEvYield(row: PokedexTableRow): string {
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
	// The Lucide icon for the Field in the Fields menu and, in the table, the
	// header (with `label` as a hover tooltip) instead of the full text label,
	// to keep wide columns like "Catch rate"/"Hatch counter" from blowing out
	// the table width. Stats have none: they keep their short text labels.
	// Which section a Field sits in is isStatField, not whether it has an icon.
	icon?: string;
	sortKey?: SortColumn;
}

// A plain-text Field: the table's generic cell is `render(row)`. A `custom`
// Field has no `render` at all — the layout draws its cell itself because the
// cell needs more than a string (item tooltips) or the user's Active Gen
// (Capture), which render(row) cannot receive. The type makes "render exists
// but production never calls it" unrepresentable; those two Fields used to
// carry such a function, and tests pinned behavior the app never ran. EV yield
// is custom for the same reason: it draws chips, so a `render` string would be
// a second, unused cell body. `custom` names which cell TableScreen draws; the
// template branches on each value with no default (tsc skips .svelte, so a new
// value needs its own branch there by hand).
export type CustomCell = "heldItems" | "encounters" | "ev";

export type Field =
	| (FieldBase & { render: (row: PokedexTableRow) => string; custom?: undefined })
	| (FieldBase & { custom: CustomCell });

export const FIELDS: Field[] = [
	...STAT_COLUMNS.map((col) => ({
		key: col.key,
		label: col.label,
		sortKey: col.key,
		render: (row: PokedexTableRow) => String(row.stats[col.key]),
	})),
	{ key: "total", label: "Total", icon: "sigma", sortKey: "total", render: (row) => String(totalStat(row.stats)) },
	{ key: "ev", label: "EV yield", icon: "dumbbell", custom: "ev" },
	{ key: "heldItems", label: "Held item", icon: "gift", custom: "heldItems" },
	{ key: "encounterLocation", label: "Capture", icon: "map-pin", custom: "encounters" },
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

// The fresh-install selection: the six stats, Total and EV yield, so a default
// Card view tile shows its Σ and EV corners. hydrateSettings keeps any saved
// selection as it is, so an upgrading user is not widened to this.
export const DEFAULT_VISIBLE_FIELDS: FieldKey[] = [...STAT_COLUMNS.map((c) => c.key), "total", "ev"];

// The list is never sorted by a Field the user cannot see: when the Field
// owning the current sort is unchosen, the sort resets to No. ascending. No.
// and Name are not Fields, so they always stay. One rule for every layout.
export function sortAfterFieldsChange(sort: SortState, visibleFields: ReadonlySet<string>): SortState {
	const owner = FIELDS.find((f) => f.sortKey === sort.column);
	return owner && !visibleFields.has(owner.key) ? { column: "id", direction: "asc" } : sort;
}
