import { describe, expect, it } from "vitest";
import { makeRow } from "../data/__fixtures__/rows";
import panelTemplate from "../view/components/CardPanel.svelte?raw";
import type { StatBlock } from "../data/types";
import { FIELDS } from "./fields";
import { cardGrid, fitSprite, panelChips, panelPlacement, panelStats, sortChips, statStrip, tileCorners } from "./cardView";

const stats = (overrides: Partial<StatBlock>): StatBlock => ({
	hp: 50, attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50, ...overrides,
});

describe("tileCorners", () => {
	it("shows EV dots and the Σ total only when their Field is chosen", () => {
		expect(tileCorners(new Set(["hp", "total", "ev"]))).toEqual({ ev: true, total: true });
		expect(tileCorners(new Set(["hp", "ev"]))).toEqual({ ev: true, total: false });
		expect(tileCorners(new Set(["total"]))).toEqual({ ev: false, total: true });
		expect(tileCorners(new Set())).toEqual({ ev: false, total: false });
	});
});

describe("statStrip", () => {
	it("draws the chosen stats in stat order, never Total or another Field", () => {
		const strip = statStrip([makeRow()], new Set(["speed", "total", "hp", "catchRate", "attack"]));
		expect(strip.stats).toEqual(["hp", "attack", "speed"]);
	});

	it("draws each bar relative to that stat's maximum among the shown rows", () => {
		const a = makeRow({ id: 1, stats: stats({ hp: 50, speed: 30 }) });
		const b = makeRow({ id: 2, stats: stats({ hp: 100, speed: 120 }) });
		const strip = statStrip([a, b], new Set(["hp", "speed"]));
		expect(strip.height(a, "hp")).toBe(0.5);
		expect(strip.height(b, "hp")).toBe(1);
		expect(strip.height(a, "speed")).toBe(0.25);
		expect(strip.height(b, "speed")).toBe(1);
	});

	it("draws a zero-height bar, not NaN, when no shown row has the stat above 0", () => {
		const a = makeRow({ stats: stats({ hp: 0 }) });
		expect(statStrip([a], new Set(["hp"])).height(a, "hp")).toBe(0);
	});

	it.each([
		[["hp"], true],
		[["hp", "attack", "defense", "speed"], true],
		[["hp", "attack", "defense", "specialAttack", "speed"], false],
		[["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"], false],
	])("prints the values under %j: %s (dropped above four stats)", (chosen, showValues) => {
		expect(statStrip([makeRow()], new Set(chosen)).showValues).toBe(showValues);
	});
});

describe("sortChips", () => {
	it("offers No. and Name, then the chosen sortable Fields in menu order", () => {
		const chips = sortChips(new Set(["weight", "ev", "speed", "total", "hp", "heldItems"]));
		expect(chips.map((c) => c.label)).toEqual(["No.", "Name", "HP", "Spe", "Total", "Weight"]);
		expect(chips.map((c) => c.column)).toEqual(["id", "name", "hp", "speed", "total", "weight"]);
	});

	it("offers only No. and Name with nothing chosen", () => {
		expect(sortChips(new Set()).map((c) => c.column)).toEqual(["id", "name"]);
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

describe("panelStats", () => {
	it.each([
		[["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"], "stretched"],
		[["hp", "attack", "defense", "specialAttack", "speed"], "stretched"],
		[["hp", "attack", "defense", "speed"], "fixed"],
		[["hp", "speed"], "fixed"],
		[["attack"], "fixed"],
	])("draws %j as %s columns", (chosen, mode) => {
		expect(panelStats(new Set(chosen)).mode).toBe(mode);
	});

	it("draws the chosen stats in stat order, and Total as its own column only when chosen", () => {
		expect(panelStats(new Set(["speed", "total", "hp", "ev"]))).toEqual({
			stats: ["hp", "speed"], mode: "fixed", total: true,
		});
		expect(panelStats(new Set(["hp"])).total).toBe(false);
	});

	it("has no stat row with no stat chosen, so the panel is header and chips (Total becomes a chip)", () => {
		expect(panelStats(new Set(["total", "weight"]))).toEqual({ stats: [], mode: "fixed", total: false });
		expect(panelChips(new Set(["weight", "total"])).map((f) => f.key)).toEqual(["total", "weight"]);
		expect(panelStats(new Set(["weight"])).stats).toEqual([]);
	});
});

describe("panelChips", () => {
	it("draws every chosen Other Field as a chip in menu order, never a stat or Total", () => {
		const keys = panelChips(
			new Set(["weight", "hp", "catchRate", "total", "encounterLocation", "ev", "height", "heldItems", "hatchCounter"]),
		).map((f) => f.key);
		expect(keys).toEqual(["ev", "heldItems", "encounterLocation", "catchRate", "hatchCounter", "height", "weight"]);
	});

	it("draws no chips when only stats and Total are chosen", () => {
		expect(panelChips(new Set(["hp", "total"]))).toEqual([]);
	});
});

describe("CardPanel's chips", () => {
	// tsc skips .svelte, and the panel's chip has no default branch: a custom
	// Field with no `field.custom === …` branch there would draw its icon and
	// no value. Same pin as tableColumns.test.ts's for TableScreen.
	it("has a CardPanel template branch for every custom Field", () => {
		const customValues = [...new Set(FIELDS.flatMap((f) => (f.custom ? [f.custom] : [])))];
		expect(customValues.length).toBeGreaterThan(0);
		expect(panelTemplate).toContain("{#each chips as field");
		for (const value of customValues) {
			expect(panelTemplate, `no \`field.custom === "${value}"\` branch in CardPanel.svelte`).toContain(
				`field.custom === "${value}"`,
			);
		}
	});
});
