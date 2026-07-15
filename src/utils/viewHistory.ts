// Browser-style back/forward stack of previously-viewed Pokemon (see
// CONTEXT.md's "View history" entry) — bound to "[" / "]" in
// PokedexApp.svelte. Distinct from quickJump.ts: quick jump is a search
// result you jump into, this is stepping through Pokemon already visited.

export function pushHistory(
	history: number[],
	historyIndex: number,
	id: number,
	screen: "table" | "detail",
): { history: number[]; historyIndex: number } {
	// Opening a mon straight from the table starts a fresh chain — like
	// navigating to a new page from the browser's home/new-tab page, not a
	// continuation of whatever was browsed before the last exitToTable.
	// Opening from inside detail (evolution card, quick search, or resuming
	// into detail via stepForward before this call) is genuine forward
	// navigation within the current chain: truncate-then-push, dropping any
	// forward entries past the current point rather than leaving them
	// reachable via stepForward.
	if (screen === "table") return { history: [id], historyIndex: 0 };
	const next = [...history.slice(0, historyIndex + 1), id];
	return { history: next, historyIndex: next.length - 1 };
}

export type ViewHistoryStep =
	| { action: "select"; historyIndex: number; id: number }
	| { action: "exitToTable" }
	| { action: "none" };

// Past the oldest viewed Pokemon, stepping back exits to the table itself —
// same destination as the "Back to list" button. From the table screen with
// history still available, this is a no-op (there's nothing "back" of the
// table); use stepForward to re-enter the visited stack instead.
export function stepBack(history: number[], historyIndex: number, screen: "table" | "detail"): ViewHistoryStep {
	if (historyIndex <= 0) {
		return screen === "detail" ? { action: "exitToTable" } : { action: "none" };
	}
	const nextIndex = historyIndex - 1;
	return { action: "select", historyIndex: nextIndex, id: history[nextIndex] };
}

// Symmetric counterpart: from the table (having arrived there via stepBack,
// not the explicit "Back to list" button), stepping forward re-enters
// detail at whatever the stack was last pointing at.
export function stepForward(history: number[], historyIndex: number, screen: "table" | "detail"): ViewHistoryStep {
	if (screen === "table") {
		if (historyIndex < 0 || historyIndex >= history.length) return { action: "none" };
		return { action: "select", historyIndex, id: history[historyIndex] };
	}
	if (historyIndex >= history.length - 1) return { action: "none" };
	const nextIndex = historyIndex + 1;
	return { action: "select", historyIndex: nextIndex, id: history[nextIndex] };
}
