import { describe, expect, it } from "vitest";
import { makeActiveGenRow } from "../data/__fixtures__/rows";
import type { StatBlock } from "../data/types";
import {
	cardGrid, cardRowTop, cardWindow, type CardWindowInput, fitSprite, isTallCardRow, PANEL_CHIPS, PANEL_STATS, panelPlacement,
	SORT_CHIPS, statStrip, tileCorners, tileSortValue,
} from "./cardView";
import type { SortColumn, SortState } from "./sortPokemon";

const stats = (overrides: Partial<StatBlock>): StatBlock => ({
	hp: 50, attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50, ...overrides,
});

const byNo: SortState = { column: "id", direction: "asc" };
const by = (column: SortColumn): SortState => ({ column, direction: "desc" });

describe("tileCorners", () => {
	it("shows EV dots and the Σ total only when their Field is chosen", () => {
		expect(tileCorners(new Set(["hp", "total", "ev"]), byNo)).toEqual({ ev: true, total: true });
		expect(tileCorners(new Set(["hp", "ev"]), byNo)).toEqual({ ev: true, total: false });
		expect(tileCorners(new Set(["total"]), byNo)).toEqual({ ev: false, total: true });
		expect(tileCorners(new Set(), byNo)).toEqual({ ev: false, total: false });
	});

	it("shows Σ while the list is sorted by Total, chosen or not", () => {
		expect(tileCorners(new Set(), by("total"))).toEqual({ ev: false, total: true });
		expect(tileCorners(new Set(), by("speed")).total).toBe(false);
	});
});

describe("tileSortValue", () => {
	const row = makeActiveGenRow({
		dexNumber: 790, stats: stats({ speed: 37 }), catchRate: 45, hatchCounter: 120, height: 1, weight: 9999,
	});

	it("shows nothing for No., Name and Total, which the tile already shows", () => {
		expect(tileSortValue(row, byNo)).toBeNull();
		expect(tileSortValue(row, by("name"))).toBeNull();
		expect(tileSortValue(row, by("total"))).toBeNull();
	});

	it("shows a stat's value with its stat, for the colour dot", () => {
		expect(tileSortValue(row, by("speed"))).toEqual({ text: "37", stat: "speed" });
	});

	it("shows another Field's value with its menu icon", () => {
		expect(tileSortValue(row, by("catchRate"))).toEqual({ text: "45", icon: "target" });
		expect(tileSortValue(row, by("hatchCounter"))).toEqual({ text: "120", icon: "egg" });
	});

	// Cosmoem is 999.9 kg: rounding to fit printed 1000. No unit, one decimal.
	it("shows height and weight without a unit and with their decimal", () => {
		expect(tileSortValue(row, by("weight"))).toEqual({ text: "999.9", icon: "weight" });
		expect(tileSortValue(row, by("height"))).toEqual({ text: "0.1", icon: "ruler" });
	});
});

describe("statStrip", () => {
	it("draws the chosen stats in stat order, never Total or another Field", () => {
		const strip = statStrip([makeActiveGenRow()], new Set(["speed", "total", "hp", "catchRate", "attack"]), byNo);
		expect(strip.stats).toEqual(["hp", "attack", "speed"]);
	});

	it("draws each bar relative to that stat's maximum among the shown rows", () => {
		const a = makeActiveGenRow({ id: 1, stats: stats({ hp: 50, speed: 30 }) });
		const b = makeActiveGenRow({ id: 2, stats: stats({ hp: 100, speed: 120 }) });
		const strip = statStrip([a, b], new Set(["hp", "speed"]), byNo);
		expect(strip.height(a, "hp")).toBe(0.5);
		expect(strip.height(b, "hp")).toBe(1);
		expect(strip.height(a, "speed")).toBe(0.25);
		expect(strip.height(b, "speed")).toBe(1);
	});

	it("draws a zero-height bar, not NaN, when no shown row has the stat above 0", () => {
		const a = makeActiveGenRow({ stats: stats({ hp: 0 }) });
		expect(statStrip([a], new Set(["hp"]), byNo).height(a, "hp")).toBe(0);
	});

	it.each([
		["small", 4], ["medium", 5], ["large", 6],
	] as const)("prints values under up to as many stats as a %s tile fits (%i)", (size, most) => {
		const all = ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"];
		expect(statStrip([makeActiveGenRow()], new Set(all.slice(0, most)), byNo, size).showValues).toBe(true);
		if (most < 6) {
			expect(statStrip([makeActiveGenRow()], new Set(all.slice(0, most + 1)), byNo, size).showValues).toBe(false);
		}
	});

	it.each([
		[["hp"], true],
		[["hp", "attack", "defense", "speed"], true],
		[["hp", "attack", "defense", "specialAttack", "speed"], false],
		[["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"], false],
	])("prints the values under %j: %s (dropped above four stats)", (chosen, showValues) => {
		expect(statStrip([makeActiveGenRow()], new Set(chosen), byNo).showValues).toBe(showValues);
	});

	it("emphasizes the sorted stat when the strip draws it", () => {
		const chosen = new Set(["hp", "speed"]);
		expect(statStrip([makeActiveGenRow()], chosen, by("speed")).emphasis).toBe("speed");
		expect(statStrip([makeActiveGenRow()], chosen, by("attack")).emphasis).toBeNull();
		expect(statStrip([makeActiveGenRow()], chosen, by("weight")).emphasis).toBeNull();
	});

	// The tap panel draws all six stats with the strip's heights.
	it("gives a height for an unchosen stat too", () => {
		const a = makeActiveGenRow({ id: 1, stats: stats({ attack: 40 }) });
		const b = makeActiveGenRow({ id: 2, stats: stats({ attack: 80 }) });
		expect(statStrip([a, b], new Set(["hp"]), byNo).height(a, "attack")).toBe(0.5);
	});
});

describe("SORT_CHIPS", () => {
	// Card view shows every Field (in the panel, and the sorted one on the
	// tile), so it sorts by every Field that sorts, whatever the tile shows.
	it("offers No. and Name, then every sortable Field in menu order", () => {
		expect(SORT_CHIPS.map((c) => c.label)).toEqual([
			"No.", "Name", "HP", "Atk", "Def", "SpA", "SpD", "Spe", "Total", "Catch rate", "Hatch counter", "Height", "Weight",
		]);
		expect(SORT_CHIPS.map((c) => c.column)).toEqual([
			"id", "name", "hp", "attack", "defense", "specialAttack", "specialDefense", "speed", "total", "catchRate",
			"hatchCounter", "height", "weight",
		]);
	});
});

describe("cardGrid", () => {
	it("fits four tiles a row in a 390px pane's grid, and more columns of the same size when wider", () => {
		// A 390px pane leaves 319px for the grid on desktop (12px + 16px of
		// padding a side and a 15px scrollbar, measured live) and 334px without
		// the scrollbar.
		expect(cardGrid(319).columns).toBe(4);
		expect(cardGrid(334).columns).toBe(4);
		expect(cardGrid(319).tileWidth).toBeGreaterThanOrEqual(74);
		expect(cardGrid(568).columns).toBe(7);
		expect(cardGrid(1000).columns).toBe(12);
		expect(cardGrid(1000).tileWidth).toBeLessThan(90);
	});

	// Card size: four small, three medium or two large tiles at a 390px pane.
	it.each([
		["small", 319, 4],
		["medium", 319, 3],
		["medium", 334, 3],
		["large", 319, 2],
		["large", 334, 2],
		["medium", 1000, 9],
		["large", 1000, 6],
	] as const)("fits %s tiles at %ipx in %i columns", (size, width, columns) => {
		expect(cardGrid(width, size).columns).toBe(columns);
	});

	it("keeps at least one column, however narrow", () => {
		expect(cardGrid(40).columns).toBe(1);
		expect(cardGrid(0).columns).toBe(1);
	});
});

describe("fitSprite", () => {
	// A 96px canvas whose content sits low and right, as PokeAPI sprites do.
	const offCentre = { x: 30, y: 40, width: 40, height: 50, canvasWidth: 96, canvasHeight: 96 };

	it("keeps a sprite that fits at native size and centres its bounding box, not its canvas", () => {
		// Content centre is (50, 65); the well's centre is (42.5, 42.5).
		expect(fitSprite(offCentre, 85)).toEqual({ scale: 1, left: -7.5, top: -22.5, width: 96, height: 96 });
	});

	it("scales down only a sprite whose bounding box is larger than the well's room", () => {
		const big = { x: 2, y: 4, width: 90, height: 84, canvasWidth: 96, canvasHeight: 96 };
		// Room is the well less a 4px inset a side: 77px for 90px of content.
		const fit = fitSprite(big, 85);
		expect(fit.scale).toBeCloseTo(77 / 90);
		expect(fit.width).toBeCloseTo(96 * (77 / 90));
		// The content's centre lands on the well's centre.
		expect(fit.left + (2 + 45) * fit.scale).toBeCloseTo(42.5);
		expect(fit.top + (4 + 42) * fit.scale).toBeCloseTo(42.5);
	});

	it("never scales up", () => {
		const tiny = { x: 40, y: 40, width: 16, height: 16, canvasWidth: 96, canvasHeight: 96 };
		expect(fitSprite(tiny, 85).scale).toBe(1);
	});

	// A large Card size zooms 2×: crisp whole pixels, never more, so every
	// sprite in the grid keeps its size relative to the others.
	it("zooms a sprite that fits to the whole-number zoom, and no further", () => {
		expect(fitSprite(offCentre, 156, 2).scale).toBe(2);
		const tiny = { x: 40, y: 40, width: 16, height: 16, canvasWidth: 96, canvasHeight: 96 };
		expect(fitSprite(tiny, 156, 2).scale).toBe(2);
	});

	it("scales a sprite too big for the zoom down to fit, below the zoom", () => {
		const big = { x: 2, y: 4, width: 90, height: 84, canvasWidth: 96, canvasHeight: 96 };
		// Room is 156 less 8: 148px for 90px of content, so 2× (180px) does not fit.
		expect(fitSprite(big, 156, 2).scale).toBeCloseTo(148 / 90);
	});
});

describe("panelPlacement", () => {
	// The tap panel opens under the tapped tile's grid row, after the last tile
	// in that row (or the last tile of all, on a short final row).
	it.each([
		// [tapped index, columns, tiles, grid row, panel after index]
		[0, 4, 20, 0, 3],
		[3, 4, 20, 0, 3],
		[4, 4, 20, 1, 7],
		[9, 4, 20, 2, 11],
		[5, 7, 20, 0, 6],
		[13, 7, 20, 1, 13],
		[14, 7, 20, 2, 19],
		[0, 1, 3, 0, 0],
		[2, 1, 3, 2, 2],
		[17, 4, 18, 4, 17],
		[16, 4, 18, 4, 17],
	])("index %i with %i columns of %i tiles opens under row %i, after tile %i", (index, columns, count, row, afterIndex) => {
		expect(panelPlacement(index, columns, count)).toEqual({ row, afterIndex });
	});
});

describe("cardWindow", () => {
	// 100 tiles in 4 columns: 25 grid rows of 100px with 10px gaps, so row r
	// starts at 110r and the grid is 25 * 100 + 24 * 10 = 2740px tall.
	const plainRows = Array.from({ length: 100 }, (_, i) => makeActiveGenRow({ id: i + 1 }));
	const base: CardWindowInput = {
		rows: plainRows,
		columns: 4,
		rowHeight: { plain: 100, tall: 120 },
		rowGap: 10,
		panel: null,
		scrollTop: 0,
		viewportHeight: 300,
	};
	const withForm = (index: number) =>
		plainRows.map((r, i) => (i === index ? { ...r, formLabel: "Alolan" } : r));

	// cardRowTop and the Card window share the row arithmetic: the first drawn
	// row's padTop is that row's top, panel and tall rows included.
	it("agrees with cardRowTop on where every drawn window starts", () => {
		const input = { ...base, rows: withForm(9), panel: { gridRow: 1, height: 40 } };
		for (const scrollTop of [0, 500, 1100, 2000]) {
			const win = cardWindow({ ...input, scrollTop });
			expect(cardRowTop(input, win.start / input.columns)).toBe(win.padTop);
		}
		// Row 3 sits after rows 0 (100), 1 (100 + 40 panel) and 2 (tall, 120).
		expect(cardRowTop(input, 3)).toBe(100 + 140 + 120 + 3 * 10);
	});

	it("draws the viewport and one viewport below it at the top", () => {
		// Rows starting above 0 + 2 * 300: rows 0-5 (row 5 starts at 550).
		expect(cardWindow(base)).toEqual({ start: 0, end: 24, padTop: 0, padBottom: 2740 - 650 });
	});

	it("draws one viewport above and below the viewport, in whole grid rows", () => {
		// Viewport 1100-1400: rows ending below 800 (row 7, 770-870) through rows
		// starting above 1700 (row 15, 1650-1750).
		expect(cardWindow({ ...base, scrollTop: 1100 })).toEqual({
			start: 28,
			end: 64,
			padTop: 770,
			padBottom: 2740 - 1750,
		});
	});

	it("keeps the grid's full height: spacers plus drawn rows add up to it", () => {
		for (const scrollTop of [-200, 0, 333, 1100, 2400, 2740, 9000]) {
			const w = cardWindow({ ...base, scrollTop });
			const drawnRows = (w.end - w.start) / 4;
			const drawn = drawnRows * 100 + (drawnRows - 1) * 10;
			expect(w.padTop + drawn + w.padBottom).toBe(2740);
		}
	});

	it("counts a grid row with a form line at the tall height, in the spacer above it", () => {
		// Tile 2 (row 0) has a form line: every row after it starts 20px lower.
		const w = cardWindow({ ...base, rows: withForm(2), scrollTop: 1100 });
		expect(w.padTop).toBe(790);
		expect(w.start).toBe(28);
		expect(w.padBottom).toBe(2760 - 1770);
	});

	it("counts the open panel's room under its own grid row", () => {
		const w = cardWindow({ ...base, panel: { gridRow: 3, height: 200 }, scrollTop: 1300 });
		// Row 3 ends at 330 + 100 + 200; row 7 starts at 970, 1300 - 300 = 1000.
		expect(w.start).toBe(28);
		expect(w.padTop).toBe(970);
		const below = cardWindow({ ...base, panel: { gridRow: 20, height: 200 } });
		expect(below.padBottom).toBe(2940 - 650);
	});

	it("ends the last window at the last tile on a short final row", () => {
		const w = cardWindow({ ...base, rows: plainRows.slice(0, 98), scrollTop: 2400 });
		expect(w.end).toBe(98);
		expect(w.padBottom).toBe(0);
	});

	it("still draws the last row when scrolled past the grid", () => {
		const w = cardWindow({ ...base, scrollTop: 9000 });
		expect(w).toEqual({ start: 96, end: 100, padTop: 2640, padBottom: 0 });
	});

	it("draws nothing for no rows", () => {
		expect(cardWindow({ ...base, rows: [] })).toEqual({ start: 0, end: 0, padTop: 0, padBottom: 0 });
	});
});

describe("isTallCardRow", () => {
	it("is tall when any tile in the grid row has a form line", () => {
		const rows = Array.from({ length: 10 }, (_, i) => makeActiveGenRow({ id: i + 1, formLabel: i === 5 ? "Galarian" : null }));
		expect([0, 1, 2].map((r) => isTallCardRow(rows, 4, r))).toEqual([false, true, false]);
	});
});

describe("the tap panel", () => {
	// It shows every Field, whatever the tile's selection (ADR-0020).
	it("draws the six stats as columns, in stat order", () => {
		expect(PANEL_STATS).toEqual(["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"]);
	});

	it("draws every other Field but Total (a column after the stats) as a chip, in menu order", () => {
		expect(PANEL_CHIPS.map((f) => f.key)).toEqual([
			"ev", "heldItems", "encounterLocation", "catchRate", "hatchCounter", "height", "weight",
		]);
	});
});
