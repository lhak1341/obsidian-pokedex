// The Table window (CONTEXT.md): which table rows to draw for a scroll
// position. Every table row is one height (the sprite's: no cell wraps), so
// the undrawn rows are spacer rows of an exact multiple of it and a scroll
// offset always means the same place.
//
// Column widths stay those of the whole list because the widest rows are
// always drawn too: the table is table-layout: auto (tableColumns.ts), which
// sizes each column from the rows it has, so a slice alone would resize
// columns while scrolling. A widest row is drawn at its own place in the list,
// between spacers, as a real row: nothing is hidden, so no engine's handling
// of collapsed or zero-height rows is involved.

export interface TableWindowInput {
	count: number;
	rowHeight: number;
	// The scroller's offset from the table body's top edge, and its height.
	scrollTop: number;
	viewportHeight: number;
}

// The window's edges move in steps of this many rows. Any move redraws rows
// and lays the whole auto table out again, so moving on every row a fling
// passes cost a long frame each time; a step only ever widens the window.
// 16 measured best at a 250px-a-frame fling (ADR-0019): a 17 ms median frame,
// as with every row drawn, against 55-62 ms at 8; 24 gained nothing more.
export const TABLE_WINDOW_STEP = 16;

// The viewport plus one viewport above and below, as Card view's window,
// widened to whole steps: the start snaps down to a step and the end follows
// at a fixed span (a step more than the three viewports), so the window moves
// once per step, not again when its end crosses one.
export function tableWindow({ count, rowHeight, scrollTop, viewportHeight }: TableWindowInput): {
	start: number;
	end: number;
} {
	if (count === 0 || rowHeight <= 0) return { start: 0, end: count };
	const step = TABLE_WINDOW_STEP;
	const start = Math.floor((scrollTop - viewportHeight) / rowHeight / step) * step;
	const end = start + Math.ceil((3 * viewportHeight) / rowHeight / step) * step + step;
	const clampedStart = Math.min(Math.max(0, start), count - 1);
	return { start: clampedStart, end: Math.min(count, Math.max(clampedStart + 1, end)) };
}

// For each score (one per content-sized column), the indices of the
// `perScore` rows that score highest, as one sorted, distinct list. A score is
// a measured text width, used only to rank, so more than one row is kept per
// column to absorb what the measurement leaves out (capitalisation, kerning).
export function widestRows<T>(rows: readonly T[], scores: readonly ((row: T) => number)[], perScore = 2): number[] {
	const picked = new Set<number>();
	for (const score of scores) {
		// The top `perScore` indices, best first, without sorting every row.
		const top: { index: number; value: number }[] = [];
		for (let i = 0; i < rows.length; i++) {
			const value = score(rows[i]);
			if (top.length === perScore && value <= top[top.length - 1].value) continue;
			let at = top.length;
			while (at > 0 && top[at - 1].value < value) at--;
			top.splice(at, 0, { index: i, value });
			if (top.length > perScore) top.pop();
		}
		for (const t of top) picked.add(t.index);
	}
	return [...picked].sort((a, b) => a - b);
}

// What the table body draws, top to bottom: rows by their index in the list,
// and a gap (one spacer row) for each run of undrawn rows. A gap's key is the
// index of the row after it, so a gap keeps its key while its height changes.
export type TableEntry = { kind: "row"; index: number } | { kind: "gap"; key: number; height: number };

export function tableEntries({ count, start, end, extra, rowHeight, leadExtra = 0, tailExtra = 0 }: {
	count: number;
	start: number;
	end: number;
	// Rows drawn outside the window (widestRows), sorted.
	extra: readonly number[];
	rowHeight: number;
	// What the first and last rows are taller than the rest (negative:
	// shorter), added to a gap that stands in for either (TableScreen: their
	// share of the collapsed borders).
	leadExtra?: number;
	tailExtra?: number;
}): TableEntry[] {
	const drawn: number[] = [];
	let e = 0;
	for (; e < extra.length && extra[e] < start; e++) drawn.push(extra[e]);
	for (let i = start; i < end; i++) drawn.push(i);
	for (; e < extra.length; e++) if (extra[e] >= end && extra[e] < count) drawn.push(extra[e]);

	const entries: TableEntry[] = [];
	let next = 0;
	for (const index of drawn) {
		if (index > next) entries.push({ kind: "gap", key: index, height: gapHeight(next, index) });
		entries.push({ kind: "row", index });
		next = index + 1;
	}
	if (count > next) entries.push({ kind: "gap", key: count, height: gapHeight(next, count) });
	return entries;

	function gapHeight(from: number, to: number): number {
		return (to - from) * rowHeight + (from === 0 ? leadExtra : 0) + (to === count ? tailExtra : 0);
	}
}
