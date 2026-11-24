import { describe, expect, it } from "vitest";
import { makeActiveGenRow } from "../data/__fixtures__/rows";
import { FIELDS, formatEvYield } from "./fields";
import {
	TABLE_GEOMETRY, TABLE_COLUMNS, columnWidth, createRowTextWidths, createTableMemory, rememberedRowTextWidths,
	tableFrame, tableWidestRows, type RowTextWidths, type TableColumn,
} from "./tableColumns";

describe("TABLE_GEOMETRY", () => {
	// A Field without an entry would reach TableGrid with no width or floor.
	it("has an entry for every Field, and none for a key that is not a Field", () => {
		expect(FIELDS.length).toBeGreaterThan(0);
		expect(Object.keys(TABLE_GEOMETRY).sort()).toEqual(FIELDS.map((f) => f.key).sort());
		for (const { key } of FIELDS) {
			expect(typeof TABLE_GEOMETRY[key].widthPercent, key).toBe("string");
			expect(typeof TABLE_GEOMETRY[key].minWidth, key).toBe("string");
		}
	});
});

describe("tableFrame", () => {
	// Spec #18, Narrow pane: No. 32px, sprite 36px, name 112px, Type 58px of
	// 22px icons whatever the type-icons setting says. Name was 108px, the
	// longest base name (Sandy Shocks, 98px) plus padding; #35 added 4px so a
	// favourite's dot fits after it, clear of the name and the column line.
	it("gives a Narrow pane compact pinned columns and always draws type icons", () => {
		for (const useTypeIcons of [true, false]) {
			for (const density of ["compact", "comfortable"] as const) {
				expect(tableFrame({ narrow: true, density, useTypeIcons })).toEqual({
					number: { width: "32px", min: "32px" },
					sprite: { width: "36px", min: "36px" },
					name: { width: undefined, min: "112px" },
					type: { width: "58px", min: "58px" },
					typeIcons: true,
					// The 32px sprite is the spec's, whatever the density.
					compact: false,
				});
			}
		}
	});

	it("keeps the wide table as it was, honouring the type-icons setting", () => {
		expect(tableFrame({ narrow: false, density: "comfortable", useTypeIcons: false })).toEqual({
			number: { width: "4%", min: "60px" },
			sprite: { width: "4%", min: "48px" },
			name: { width: "25%", min: "20ch" },
			type: { width: "10%", min: "168px" },
			typeIcons: false,
			compact: false,
		});
		expect(tableFrame({ narrow: false, density: "compact", useTypeIcons: true })).toEqual({
			number: { width: "4%", min: "60px" },
			sprite: { width: "3%", min: "40px" },
			name: { width: "25%", min: "20ch" },
			type: { width: "6%", min: "76px" },
			typeIcons: true,
			compact: true,
		});
	});
});

describe("columnWidth", () => {
	// On a Narrow pane a Field column is its floor in px (a stat stays 52px), so
	// any spare width goes to the auto-width Name column, not the stats.
	it("is the floor on a Narrow pane and the percentage share otherwise", () => {
		const hp = TABLE_COLUMNS.find((c) => c.key === "hp");
		expect(hp).toBeDefined();
		if (!hp) return;
		expect(columnWidth(hp, true)).toBe("52px");
		expect(columnWidth(hp, false)).toBe("4%");
	});
});

// A fake RowTextWidths: a width of the text's length, or of `wide`'s value for
// the texts it names, recording every key and text asked for.
function fakeWidths(wide: Record<string, number> = {}) {
	const asked: { key: string; text: string }[] = [];
	const widths: RowTextWidths = (_row, key, text) => {
		const t = text();
		asked.push({ key, text: t });
		return wide[t] ?? t.length;
	};
	return { widths, asked };
}

const wideFrame = tableFrame({ narrow: false, density: "comfortable", useTypeIcons: false });
const iconFrame = tableFrame({ narrow: false, density: "comfortable", useTypeIcons: true });
const column = (key: string): TableColumn => {
	const col = TABLE_COLUMNS.find((c) => c.key === key);
	if (!col) throw new Error(`no column ${key}`);
	return col;
};

describe("tableWidestRows", () => {
	// ADR-0019: a content-sized column with no score changes its width as rows
	// scroll in. Every column is asked for one, with the text its cell draws.
	it("scores Name, Type as text and every chosen Field, a text Field by its render", () => {
		const row = makeActiveGenRow();
		const { widths, asked } = fakeWidths();
		tableWidestRows([row], { frame: wideFrame, columns: TABLE_COLUMNS, narrow: false, widths });
		const keys = new Set(asked.map((a) => a.key));
		expect([...keys].sort()).toEqual(["name", "type", ...TABLE_COLUMNS.map((c) => c.key)].sort());
		for (const col of TABLE_COLUMNS) {
			if (col.custom) continue;
			expect(asked.find((a) => a.key === col.key)?.text, col.key).toBe(col.render(row));
		}
	});

	it("scores a Narrow pane's Name by the base name, and the wide table's by the display name", () => {
		const rows = [
			makeActiveGenRow({ id: 1, name: "aaaaaaaaaa" }),
			makeActiveGenRow({ id: 2, name: "b", formLabel: "A very long form label" }),
			makeActiveGenRow({ id: 3, name: "cccccccc" }),
		];
		const narrowFrame = tableFrame({ narrow: true, density: "comfortable", useTypeIcons: false });
		expect(tableWidestRows(rows, { frame: narrowFrame, columns: [], narrow: true, widths: fakeWidths().widths }))
			.toEqual([0, 2]);
		expect(tableWidestRows(rows, { frame: iconFrame, columns: [], narrow: false, widths: fakeWidths().widths }))
			.toEqual([0, 1]);
	});

	it("scores Type only when it draws text, not icons", () => {
		// Names tie, so Name keeps the first two rows.
		const rows = [1, 2, 3].map((id) => makeActiveGenRow({ id, types: ["fire"] }));
		rows.push(makeActiveGenRow({ id: 4, types: ["electric", "fighting"] }));
		expect(tableWidestRows(rows, { frame: iconFrame, columns: [], narrow: false, widths: fakeWidths().widths }))
			.toEqual([0, 1]);
		expect(tableWidestRows(rows, { frame: wideFrame, columns: [], narrow: false, widths: fakeWidths().widths }))
			.toEqual([0, 1, 3]);
	});

	it("ranks EV yield by chip count before its text", () => {
		const one = { stat: "hp" as const, amount: 1 };
		const rows = [
			makeActiveGenRow({ id: 1 }),
			makeActiveGenRow({ id: 2 }),
			makeActiveGenRow({ id: 3, evYield: [one, one, one] }),
			makeActiveGenRow({ id: 4, evYield: [one, { stat: "speed", amount: 2 }] }),
			makeActiveGenRow({ id: 5 }),
			makeActiveGenRow({ id: 6, evYield: [one, one, one] }),
		];
		// Two chips whose text measures far wider than any three.
		const { widths } = fakeWidths({ [formatEvYield(rows[3])]: 9_999 });
		expect(tableWidestRows(rows, { frame: iconFrame, columns: [column("ev")], narrow: false, widths }))
			.toEqual([0, 1, 2, 5]);
	});

	it("scores held items by their names as the cell draws them", () => {
		const row = {
			...makeActiveGenRow(),
			heldItems: [{ name: "oran-berry", rarities: [50] }, { name: "sitrus-berry", rarities: [5] }],
		};
		const { widths, asked } = fakeWidths();
		tableWidestRows([row], { frame: iconFrame, columns: [column("heldItems")], narrow: false, widths });
		expect(asked.find((a) => a.key === "heldItems")?.text).toBe("Oran Berry, Sitrus Berry");
	});
});

describe("createRowTextWidths", () => {
	it("measures each row and key once, building the text only then", () => {
		const measured: string[] = [];
		let built = 0;
		const widths = createRowTextWidths((text) => {
			measured.push(text);
			return text.length;
		});
		const a = makeActiveGenRow({ id: 1 });
		const b = makeActiveGenRow({ id: 2 });
		const text = (t: string) => () => {
			built++;
			return t;
		};
		expect(widths(a, "name", text("bulbasaur"))).toBe(9);
		expect(widths(a, "name", text("other"))).toBe(9);
		expect(built).toBe(1);
		widths(a, "type", text("grass poison"));
		widths(b, "name", text("ivysaur"));
		expect(measured).toEqual(["bulbasaur", "grass poison", "ivysaur"]);
		// A new cache (a font change) measures again.
		const fresh = createRowTextWidths((t) => t.length * 2);
		expect(fresh(a, "name", text("bulbasaur"))).toBe(18);
	});
});

describe("rememberedRowTextWidths", () => {
	// TableGrid remounts on every switch from Card view; the widths it measured
	// stay in its owner's TableMemory for as long as the font does.
	it("keeps one cache per font across calls, and starts a new one on a font change", () => {
		const memory = createTableMemory();
		let measures = 0;
		const measureFor = () => {
			measures++;
			return (text: string) => text.length;
		};
		const row = makeActiveGenRow();
		const first = rememberedRowTextWidths(memory, "14px a", measureFor);
		first(row, "name", () => "bulbasaur");
		expect(rememberedRowTextWidths(memory, "14px a", measureFor)).toBe(first);
		expect(measures).toBe(1);
		const other = rememberedRowTextWidths(memory, "16px b", measureFor);
		expect(other).not.toBe(first);
		expect(measures).toBe(2);
	});
});
