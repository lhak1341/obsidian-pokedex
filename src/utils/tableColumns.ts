import { STAT_COLUMNS } from "../data/constants";
import type { PokedexTableRow } from "../data/types";
import type { SortColumn } from "./sortPokemon";
import { formatHeight, formatWeight } from "./pokemonDisplay";
import { totalStat } from "./stats";

// Exported for TableScreen's EV yield column, which renders colored chips
// (see STAT_COLORS) rather than this plain-text join, but still needs the
// same stat-key-to-abbreviation lookup.
export const STAT_LABEL_BY_KEY = new Map(STAT_COLUMNS.map((c) => [c.key, c.label]));

interface ColumnBase {
	key: string;
	label: string;
	// When set, the table header shows this Lucide icon (with `label` as a
	// hover tooltip) instead of the full text label, to keep wide columns
	// like "Catch rate"/"Hatch counter" from blowing out the table width.
	headerIcon?: string;
	sortKey?: SortColumn;
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

// A plain-text column: TableScreen's generic cell is `render(row)`. A
// `custom` column has no `render` at all — TableScreen draws its cell itself
// because the cell needs more than a string (item tooltips) or the user's
// Active Gen (Capture), which render(row) cannot receive. The type makes
// "render exists but production never calls it" unrepresentable; those two
// columns used to carry such a function, and tests pinned behavior the app
// never ran.
export type ColumnDef =
	| (ColumnBase & { render: (row: PokedexTableRow) => string; custom?: undefined })
	| (ColumnBase & { custom: true });

export const TOGGLEABLE_COLUMNS: ColumnDef[] = [
	...STAT_COLUMNS.map((col) => ({
		key: col.key,
		label: col.label,
		sortKey: col.key,
		render: (row: PokedexTableRow) => String(row.stats[col.key]),
		widthPercent: "4%",
		minWidth: "52px",
		align: "right" as const,
	})),
	{
		key: "total",
		label: "Total",
		headerIcon: "sigma",
		sortKey: "total",
		render: (row) => String(totalStat(row.stats)),
		widthPercent: "4%",
		minWidth: "52px",
		align: "right",
	},
	{
		key: "ev",
		label: "EV yield",
		headerIcon: "dumbbell",
		render: (row) =>
			row.evYield.length === 0
				? "-"
				: row.evYield.map((y) => `${y.amount} ${STAT_LABEL_BY_KEY.get(y.stat) ?? y.stat}`).join(", "),
		widthPercent: "6%",
		minWidth: "204px",
	},
	{
		key: "heldItems",
		label: "Held item",
		headerIcon: "gift",
		custom: true,
		widthPercent: "6%",
		minWidth: "140px",
	},
	{
		key: "encounterLocation",
		label: "Capture",
		headerIcon: "map-pin",
		custom: true,
		widthPercent: "6%",
		minWidth: "140px",
	},
	{
		key: "catchRate",
		label: "Catch rate",
		headerIcon: "target",
		sortKey: "catchRate",
		render: (row) => String(row.catchRate),
		widthPercent: "4%",
		minWidth: "52px",
		align: "right",
	},
	{
		key: "hatchCounter",
		label: "Hatch counter",
		headerIcon: "egg",
		sortKey: "hatchCounter",
		render: (row) => String(row.hatchCounter),
		widthPercent: "4%",
		minWidth: "52px",
		align: "right",
	},
	{
		key: "height",
		label: "Height",
		headerIcon: "ruler",
		sortKey: "height",
		render: (row) => formatHeight(row.height),
		widthPercent: "5%",
		minWidth: "76px",
		align: "right",
	},
	{
		key: "weight",
		label: "Weight",
		headerIcon: "weight",
		sortKey: "weight",
		render: (row) => formatWeight(row.weight),
		widthPercent: "6%",
		minWidth: "88px",
		align: "right",
	},
];
