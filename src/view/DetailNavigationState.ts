// Owns which screen/Pokemon is showing and the table's saved scroll position.
// The back/forward record itself is Obsidian's: each NavRecord is one entry in
// the tab's own navigation history (see CONTEXT.md's "View history" entry), so
// PokedexView.getState/setState hand records in and out and Obsidian keeps the
// stack. Plain, non-reactive class (same shape as PokedexLoadState) —
// PokedexApp.svelte mirrors these fields into its own $state after every
// call and is the only thing that touches rootEl/tick() directly, since this
// class stays DOM-free on purpose (testable with plain vitest).
export type ScrollInstruction = { kind: "reset" } | { kind: "restore"; top: number } | { kind: "none" };

export type NavRecord = { screen: "table"; pokemonId: null } | { screen: "detail"; pokemonId: number };

export const TABLE_RECORD: NavRecord = { screen: "table", pokemonId: null };

// setState's input comes from Obsidian: a history entry this class wrote, the
// saved workspace on restart, or `{}` when the leaf is opened without state.
// Anything that is not a record is ignored rather than guessed at.
export function parseNavRecord(raw: unknown): NavRecord | null {
	if (typeof raw !== "object" || raw === null) return null;
	const { screen, pokemonId } = raw as Record<string, unknown>;
	if (screen === "table") return TABLE_RECORD;
	if (screen === "detail" && Number.isInteger(pokemonId) && (pokemonId as number) > 0) {
		return { screen: "detail", pokemonId: pokemonId as number };
	}
	return null;
}

export class DetailNavigationState {
	screen: "table" | "detail" = "table";
	selectedId: number | null = null;
	private tableScrollTop = 0;

	getState(): NavRecord {
		return this.screen === "detail" && this.selectedId !== null
			? { screen: "detail", pokemonId: this.selectedId }
			: TABLE_RECORD;
	}

	// currentScrollTop is the caller's rootEl.scrollTop read just before this
	// call — only stored when actually leaving the table (moving between
	// Pokemon also lands here, and must not clobber the saved table position
	// with detail's own scroll position). "none" means the record is the one
	// already showing, which PokedexView reads as "no history entry".
	setState(record: NavRecord, currentScrollTop: number): ScrollInstruction {
		const current = this.getState();
		if (record.screen === current.screen && record.pokemonId === current.pokemonId) {
			return { kind: "none" };
		}
		if (record.screen === "table") {
			this.screen = "table";
			this.selectedId = null;
			return { kind: "restore", top: this.tableScrollTop };
		}
		if (this.screen === "table") this.tableScrollTop = currentScrollTop;
		this.screen = "detail";
		this.selectedId = record.pokemonId;
		return { kind: "reset" };
	}

	// "Back to list" is a new table entry, not a step back, so back from the
	// table returns to the Pokemon just left.
	backToTable(): NavRecord {
		return TABLE_RECORD;
	}
}
