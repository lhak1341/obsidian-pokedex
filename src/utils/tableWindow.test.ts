import { describe, expect, it } from "vitest";
import { type TableEntry, tableEntries, tableWindow, widestRows } from "./tableWindow";

// Sums what the entries stand for: every row once, and the table's full height.
function cover(entries: TableEntry[], rowHeight: number): { indices: number[]; height: number } {
	const indices: number[] = [];
	let height = 0;
	let next = 0;
	for (const e of entries) {
		if (e.kind === "gap") {
			height += e.height;
			next += e.height / rowHeight;
		} else {
			expect(e.index).toBe(next);
			indices.push(e.index);
			height += rowHeight;
			next++;
		}
	}
	return { indices, height };
}

describe("tableWindow", () => {
	const base = { count: 1000, rowHeight: 45, scrollTop: 0, viewportHeight: 450 };

	it("draws the viewport and one viewport below it at the top, and a step more", () => {
		// Rows 0-20 needed. The start snaps to -16 (a viewport above row 0) and
		// the span is 48 rows (30 to a whole step, plus a step), so row 32.
		expect(tableWindow(base)).toEqual({ start: 0, end: 32 });
	});

	it("draws one viewport above and below the viewport, from a start snapped to a step", () => {
		// Viewport 4500-4950: rows 90-120 needed; the start snaps to 80.
		expect(tableWindow({ ...base, scrollTop: 4500 })).toEqual({ start: 80, end: 80 + 48 });
	});

	it("keeps its rows while the scroll stays inside one step", () => {
		const at = (scrollTop: number) => tableWindow({ ...base, scrollTop });
		// The start is row 80 from 4050 (row 90 less a viewport) until row 96.
		expect(at(4050)).toEqual(at(4050 + 45 * 15.9));
		expect(at(4050 + 45 * 16)).not.toEqual(at(4050));
	});

	it("never draws less than the viewport and one viewport each side", () => {
		for (let scrollTop = 0; scrollTop < 45 * 900; scrollTop += 37) {
			const { start, end } = tableWindow({ ...base, scrollTop });
			expect(start * 45).toBeLessThanOrEqual(Math.max(0, scrollTop - 450));
			expect(end * 45).toBeGreaterThanOrEqual(Math.min(45 * 1000, scrollTop + 900));
		}
	});

	it("stops at the last row, and still draws one row past the end of a short list", () => {
		expect(tableWindow({ ...base, scrollTop: 45 * 990 })).toEqual({ start: 976, end: 1000 });
		expect(tableWindow({ ...base, scrollTop: 45 * 2000 })).toEqual({ start: 999, end: 1000 });
		expect(tableWindow({ ...base, count: 5, scrollTop: 10_000 })).toEqual({ start: 4, end: 5 });
	});

	it("draws everything before a row height is known, and nothing for an empty list", () => {
		expect(tableWindow({ ...base, rowHeight: 0 })).toEqual({ start: 0, end: 1000 });
		expect(tableWindow({ ...base, count: 0 })).toEqual({ start: 0, end: 0 });
	});
});

describe("widestRows", () => {
	const names = ["mew", "crabominable", "abra", "fletchinder", "eevee", "ho-oh"];

	it("keeps the top rows of each score, as sorted distinct indices", () => {
		const len = (n: string) => n.length;
		const hyphens = (n: string) => (n.includes("-") ? 1 : 0);
		expect(widestRows(names, [len], 2)).toEqual([1, 3]);
		expect(widestRows(names, [len, hyphens], 1)).toEqual([1, 5]);
		expect(widestRows(names, [len, len], 2)).toEqual([1, 3]);
	});

	it("finds a widest row anywhere in the list, first or last", () => {
		expect(widestRows([9, 1, 1, 1], [(n) => n], 1)).toEqual([0]);
		expect(widestRows([1, 1, 1, 9], [(n) => n], 1)).toEqual([3]);
		expect(widestRows([3, 1, 2, 9, 0], [(n) => n], 3)).toEqual([0, 2, 3]);
	});

	it("keeps the first of tied rows, and every row of a list shorter than the count", () => {
		expect(widestRows([5, 5, 5], [(n) => n], 1)).toEqual([0]);
		expect(widestRows([1, 2], [(n) => n], 3)).toEqual([0, 1]);
	});
});

describe("tableEntries", () => {
	it("stands a gap for each run of undrawn rows, so the table keeps its full height", () => {
		const entries = tableEntries({ count: 100, start: 40, end: 60, extra: [3, 50, 97], rowHeight: 45 });
		const { indices, height } = cover(entries, 45);
		expect(height).toBe(100 * 45);
		expect(indices).toEqual([3, ...Array.from({ length: 20 }, (_, i) => 40 + i), 97]);
		expect(entries.filter((e) => e.kind === "gap")).toEqual([
			{ kind: "gap", key: 3, height: 3 * 45 },
			{ kind: "gap", key: 40, height: 36 * 45 },
			{ kind: "gap", key: 97, height: 37 * 45 },
			{ kind: "gap", key: 100, height: 2 * 45 },
		]);
	});

	it("draws no gap where drawn rows meet", () => {
		const entries = tableEntries({ count: 10, start: 0, end: 10, extra: [0, 9], rowHeight: 45 });
		expect(entries.every((e) => e.kind === "row")).toBe(true);
		expect(cover(entries, 45).height).toBe(450);
		const touching = tableEntries({ count: 30, start: 10, end: 20, extra: [9, 20], rowHeight: 45 });
		expect(touching.filter((e) => e.kind === "gap").map((e) => e.key)).toEqual([9, 30]);
	});

	it("adds the first and last rows' extra height to the gaps that stand in for them, and to no other", () => {
		const edges = { rowHeight: 45, leadExtra: 0.5, tailExtra: -0.5 };
		const gaps = (entries: TableEntry[]) => entries.filter((e) => e.kind === "gap").map((e) => e.height);
		expect(gaps(tableEntries({ count: 100, start: 40, end: 60, extra: [70], ...edges })))
			.toEqual([40 * 45 + 0.5, 10 * 45, 29 * 45 - 0.5]);
		expect(gaps(tableEntries({ count: 100, start: 0, end: 20, extra: [99], ...edges }))).toEqual([79 * 45]);
		expect(gaps(tableEntries({ count: 3, start: 3, end: 3, extra: [], ...edges }))).toEqual([3 * 45]);
	});

	it("drops an extra row past the end of the list", () => {
		const { indices } = cover(tableEntries({ count: 5, start: 0, end: 5, extra: [7], rowHeight: 45 }), 45);
		expect(indices).toEqual([0, 1, 2, 3, 4]);
	});
});
