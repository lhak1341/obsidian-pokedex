import { MOVE_VERSION_TABS_BY_GEN } from "../data/constants";
import type { MoveEntry } from "../data/types";
import { pickRemembered, resolveTabsForGen } from "./generationFallback";

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

// Keys are PokeAPI move-learn-method names. "reminder" (Scarlet/Violet,
// Legends: Z-A: learnable from the move reminder with no level) and
// "train" (Pokemon Champions' training menu, the only method that game
// has) appear in one or two games each; a method PokeAPI has that is not
// listed here (form-change, light-ball-egg, ...) shows no tab.
export const MOVE_METHOD_TABS = [
	{ key: "level-up", label: "Level-Up" },
	{ key: "reminder", label: "Reminder" },
	{ key: "machine", label: "Machine" },
	{ key: "egg", label: "Egg" },
	{ key: "tutor", label: "Tutor" },
	{ key: "train", label: "Train" },
] as const;

export type MoveTab = { key: string; label: string };

export interface MoveView {
	versionTabs: MoveTab[];
	// The generation the version tabs came from: activeGen unless the
	// Generation fallback picked another, and activeGen when no generation
	// has moves for this entry.
	shownGen: number;
	version: string | null;
	methodTabs: MoveTab[];
	method: string | null;
	// Empty exactly when nothing is taught by a shown method: a non-null
	// method comes from a tab with at least one move, and a null one is not
	// Level-Up, so no divider row stands alone.
	rows: MoveRow[];
}

// Everything MoveBrowser shows, from the movepool and the two Remembered
// tabs (version, method), in the order the panel narrows it: version tabs
// for the Active Gen (with Generation fallback, see resolveTabsForGen) →
// that game's moves → the methods that game teaches this entry anything by
// (so Champions, every move under "train", does not open on an empty
// Level-Up tab) → the remembered method, else the first shown → that
// method's moves → rows with evolution dividers on Level-Up only.
export function resolveMoveView(
	moves: MoveEntry[],
	activeGen: number,
	remembered: { version: string; method: string },
	evolvesAtLevels: number[],
): MoveView {
	const versionsWithMoves = new Set(moves.map((m) => m.versionGroup));
	const versions = resolveTabsForGen(
		MOVE_VERSION_TABS_BY_GEN,
		activeGen,
		(tab) => versionsWithMoves.has(tab.key),
		remembered.version,
	);
	const version = versions.selected?.key ?? null;
	const versionMoves = moves.filter((m) => m.versionGroup === version);

	const methods = new Set(versionMoves.map((m) => m.learnMethod));
	const methodTabs: MoveTab[] = MOVE_METHOD_TABS.filter((tab) => methods.has(tab.key));
	const method = pickRemembered(methodTabs, remembered.method).selected?.key ?? null;
	const shownMoves = versionMoves.filter((m) => m.learnMethod === method);

	return {
		versionTabs: versions.tabs,
		shownGen: versions.gen ?? activeGen,
		version,
		methodTabs,
		method,
		rows: buildMoveRows(shownMoves, evolvesAtLevels, method === "level-up"),
	};
}
