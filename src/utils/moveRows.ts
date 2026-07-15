import type { MoveEntry } from "../data/types";

// moveIndex (not the raw position in MoveRow[]) drives MoveBrowser's
// alternating row shade — a plain `tr:nth-child(odd)` would count a divider
// row too, shifting every real move row's shade by one past it.
export type MoveRow =
	| { kind: "move"; move: MoveEntry; moveIndex: number }
	| { kind: "divider"; level: number };

// Interleaves a synthetic divider row into `moves` right before the first
// move learned past each level in `evolvesAtLevels`, so the table reads as
// "these moves came before the evolution, these after" without a second
// pass over the rendered rows. Only meaningful on the Level-Up tab — the
// only one ordered by level (see normalizeMoves, which sorts level-up moves
// ascending by levelLearnedAt before anything else) — so `isLevelUpTab`
// short-circuits to a plain pass-through otherwise. A level past every
// move's levelLearnedAt still gets its own trailing divider, appended after
// the main pass.
export function buildMoveRows(moves: MoveEntry[], evolvesAtLevels: number[], isLevelUpTab: boolean): MoveRow[] {
	if (!isLevelUpTab || evolvesAtLevels.length === 0) {
		return moves.map((move, moveIndex) => ({ kind: "move", move, moveIndex }));
	}
	const remainingLevels = [...evolvesAtLevels];
	const rows: MoveRow[] = [];
	moves.forEach((move, moveIndex) => {
		while (remainingLevels.length > 0 && move.levelLearnedAt > remainingLevels[0]) {
			rows.push({ kind: "divider", level: remainingLevels.shift()! });
		}
		rows.push({ kind: "move", move, moveIndex });
	});
	for (const level of remainingLevels) rows.push({ kind: "divider", level });
	return rows;
}
