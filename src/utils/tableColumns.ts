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
