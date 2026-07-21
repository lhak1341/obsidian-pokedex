import { onMount } from "svelte";
import type { PokedexTableRow } from "../data/types";
import { quickJumpMatches, stepQuickJumpNav } from "../utils/quickJump";
import { registerGlobalHotkey } from "./globalHotkey";

// Shared by QuickSearch (detail screen) and FilterBar's own search box
// (browse table) — both wrap quickJumpMatches/stepQuickJumpNav with the same
// open/activeIndex state, DOM event wiring, and Cmd/Ctrl+Shift+L hotkey
// registration. The two callers diverge only on what "search text" is bound
// to (QuickSearch owns an ephemeral local string; FilterBar's is
// filters.search, also the table's own live filter) and on two commit-path
// side effects — see onSelect/onEscape below — so this hook takes both as
// reactive reads/callbacks rather than owning them itself.
export function createQuickJumpDropdown(options: {
	rows: () => PokedexTableRow[];
	query: () => string;
	inputRef: () => HTMLInputElement | undefined;
	// Caller-specific extra for a committed selection — e.g. QuickSearch
	// blurs (so isEditableTarget doesn't block PokedexApp's "["/"]" history
	// hotkey right after navigating, since it stays mounted on the same
	// screen); FilterBar's onQuickSelect navigates away to the detail
	// screen entirely, so its own callback doesn't need to blur at all.
	onSelect: (id: number) => void;
	// Caller-specific extra on Escape — e.g. QuickSearch clears its
	// ephemeral query; FilterBar's dropdown dismisses without touching
	// filters.search, the table's real live filter.
	onEscape: () => void;
}) {
	let open = $state(false);
	let activeIndex = $state(0);

	const matches = $derived.by(() => quickJumpMatches(options.rows(), options.query()));

	$effect(() => {
		void matches;
		activeIndex = 0;
	});

	function onFocus() {
		open = true;
	}

	function onInput() {
		open = true;
	}

	function onBlur() {
		open = false;
	}

	// Shared by the Enter-key path (onKeydown) and the dropdown's own
	// mousedown-select — both are "commit to this id" and must go through
	// the same open/activeIndex bookkeeping plus the caller's onSelect.
	function select(id: number) {
		open = false;
		options.onSelect(id);
	}

	function onKeydown(e: KeyboardEvent) {
		const result = stepQuickJumpNav(e.key, activeIndex, matches.length);
		if (result.action === "move") {
			e.preventDefault();
			activeIndex = result.index;
		} else if (result.action === "select") {
			select(matches[result.index].id);
		} else if (e.key === "Escape") {
			open = false;
			// Both callers blur here unconditionally — unlike the Select path,
			// this part isn't caller-specific, only the text-clearing (via
			// onEscape below) diverges.
			(e.currentTarget as HTMLInputElement).blur();
			options.onEscape();
		}
	}

	onMount(() => registerGlobalHotkey("l", () => {
		const el = options.inputRef();
		el?.focus();
		el?.select();
	}));

	return {
		get open() {
			return open;
		},
		get activeIndex() {
			return activeIndex;
		},
		set activeIndex(value: number) {
			activeIndex = value;
		},
		get matches() {
			return matches;
		},
		onFocus,
		onInput,
		onBlur,
		onKeydown,
		select,
	};
}
