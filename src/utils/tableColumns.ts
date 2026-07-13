import { STAT_COLUMNS } from "../data/constants";
import type { PokedexTableRow } from "../data/types";
import type { SortColumn } from "./sortPokemon";
import { totalStat } from "./stats";

// Exported for TableScreen's EV yield column, which renders colored chips
// (see STAT_COLORS) rather than this plain-text join, but still needs the
// same stat-key-to-abbreviation lookup.
export const STAT_LABEL_BY_KEY = new Map(STAT_COLUMNS.map((c) => [c.key, c.label]));

export interface ColumnDef {
	key: string;
	label: string;
	// When set, the table header shows this Lucide icon (with `label` as a
	// hover tooltip) instead of the full text label, to keep wide columns
	// like "Catch rate"/"Hatch counter" from blowing out the table width.
	headerIcon?: string;
	sortKey?: SortColumn;
	render: (row: PokedexTableRow) => string;
}

export const TOGGLEABLE_COLUMNS: ColumnDef[] = [
	...STAT_COLUMNS.map((col) => ({
		key: col.key,
		label: col.label,
		sortKey: col.key,
		render: (row: PokedexTableRow) => String(row.stats[col.key]),
	})),
	{
		key: "total",
		label: "Total",
		headerIcon: "sigma",
		sortKey: "total",
		render: (row) => String(totalStat(row.stats)),
	},
	{
		key: "ev",
		label: "EV yield",
		headerIcon: "dumbbell",
		render: (row) =>
			row.evYield.length === 0
				? "-"
				: row.evYield.map((y) => `${y.amount} ${STAT_LABEL_BY_KEY.get(y.stat) ?? y.stat}`).join(", "),
	},
	{
		key: "catchRate",
		label: "Catch rate",
		headerIcon: "target",
		sortKey: "catchRate",
		render: (row) => String(row.catchRate),
	},
	{
		key: "hatchCounter",
		label: "Hatch counter",
		headerIcon: "egg",
		sortKey: "hatchCounter",
		render: (row) => String(row.hatchCounter),
	},
	{
		key: "height",
		label: "Height",
		headerIcon: "ruler",
		sortKey: "height",
		render: (row) => `${(row.height / 10).toFixed(1)} m`,
	},
	{
		key: "weight",
		label: "Weight",
		headerIcon: "weight",
		sortKey: "weight",
		render: (row) => `${(row.weight / 10).toFixed(1)} kg`,
	},
];
