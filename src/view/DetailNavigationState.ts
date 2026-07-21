import { pushHistory, stepBack, stepForward } from "../utils/viewHistory";

// Owns which screen/Pokemon is showing, the view-history stack (see
// CONTEXT.md's "View history" entry), and the table's saved scroll
// position. Plain, non-reactive class (same shape as PokedexLoadState) —
// PokedexApp.svelte mirrors these fields into its own $state after every
// call and is the only thing that touches rootEl/tick() directly, since
// this class stays DOM-free on purpose (testable with plain vitest).
export type ScrollInstruction = { kind: "reset" } | { kind: "restore"; top: number } | { kind: "none" };

export class DetailNavigationState {
	screen: "table" | "detail" = "table";
	selectedId: number | null = null;
	history: number[] = [];
	historyIndex = -1;
	private tableScrollTop = 0;

	// currentScrollTop is the caller's rootEl.scrollTop read just before this
	// call — only stored when actually leaving the table (an evolution-chain
	// click inside detail also calls this, and must not clobber the saved
	// table position with detail's own scroll position).
	openDetail(id: number, currentScrollTop: number): ScrollInstruction {
		const fromScreen = this.screen;
		if (fromScreen === "table") this.tableScrollTop = currentScrollTop;
		this.selectedId = id;
		this.screen = "detail";
		({ history: this.history, historyIndex: this.historyIndex } = pushHistory(
			this.history,
			this.historyIndex,
			id,
			fromScreen,
		));
		return { kind: "reset" };
	}

	goBack(): ScrollInstruction {
		const step = stepBack(this.history, this.historyIndex, this.screen);
		if (step.action === "exitToTable") return this.backToTable();
		if (step.action === "select") {
			this.historyIndex = step.historyIndex;
			this.selectedId = step.id;
			this.screen = "detail";
			return { kind: "reset" };
		}
		return { kind: "none" };
	}

	goForward(): ScrollInstruction {
		const step = stepForward(this.history, this.historyIndex, this.screen);
		if (step.action === "select") {
			this.historyIndex = step.historyIndex;
			this.selectedId = step.id;
			this.screen = "detail";
			return { kind: "reset" };
		}
		return { kind: "none" };
	}

	backToTable(): ScrollInstruction {
		this.screen = "table";
		return { kind: "restore", top: this.tableScrollTop };
	}
}
