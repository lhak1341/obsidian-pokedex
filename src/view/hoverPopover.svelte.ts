import { relativeRect } from "./domPosition";

// Shared by AbilitiesPanel and MoveBrowser: hover-a-name-to-show-a-popover,
// positioned relative to an ancestor selector (see relativeRect for why
// position: fixed doesn't work here — Obsidian's .workspace-leaf has
// contain: strict). Only the hover/position state machine is shared — a
// caller with its own side effect on show (e.g. AbilitiesPanel's
// fetch-and-cache) calls this hook's show() first, then does its own thing,
// rather than this module taking an onShow callback it'd only use once.
export function createHoverPopover(anchorSelector: string, offsetY = 6) {
	let hovered = $state<string | null>(null);
	let pos = $state<{ top: number; left: number } | null>(null);

	function show(name: string, target: EventTarget | null) {
		hovered = name;
		const r = relativeRect(target as HTMLElement, anchorSelector);
		pos = { top: r.bottom + offsetY, left: r.left };
	}

	function hide() {
		hovered = null;
		pos = null;
	}

	return {
		get hovered() {
			return hovered;
		},
		get pos() {
			return pos;
		},
		show,
		hide,
	};
}
