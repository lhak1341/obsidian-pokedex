import type { PokedexTableRow } from "../data/types";
import { matchesSearch } from "./filterPokemon";

// Shared by QuickSearch (detail screen) and FilterBar's own search box
// (browse table) — both need "the first `limit` rows matching this query",
// with an empty query meaning "show nothing" here (unlike matchesSearch's
// own no-op-filter default for the table's live filter).
export function quickJumpMatches(rows: PokedexTableRow[], query: string, limit = 8): PokedexTableRow[] {
	if (!query.trim()) return [];
	return rows.filter((r) => matchesSearch(r, query)).slice(0, limit);
}

export type QuickJumpNavResult =
	| { action: "move"; index: number }
	| { action: "select"; index: number }
	| { action: "none" };

// Pure Up/Down/Enter step over a wrapping match list. Escape is deliberately
// not handled here — QuickSearch and FilterBar's own quick-jump dropdown
// diverge on what Escape should do (QuickSearch clears its ephemeral query;
// FilterBar's dropdown dismisses without touching filters.search, the
// table's real live filter), so that decision stays in each caller's own
// keydown handler.
export function stepQuickJumpNav(key: string, activeIndex: number, matchCount: number): QuickJumpNavResult {
	if (matchCount === 0) return { action: "none" };
	if (key === "ArrowDown") return { action: "move", index: (activeIndex + 1) % matchCount };
	if (key === "ArrowUp") return { action: "move", index: (activeIndex - 1 + matchCount) % matchCount };
	if (key === "Enter") return { action: "select", index: activeIndex };
	return { action: "none" };
}
