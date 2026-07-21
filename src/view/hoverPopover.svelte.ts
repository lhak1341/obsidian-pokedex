import { relativeRect } from "./domPosition";

// Below this much room (px) between the hovered target's bottom edge and the
// viewport's own bottom, there isn't enough space left to render a popover
// underneath it without it running off-screen (or under Obsidian's status
// bar) — flip it above the target instead. A fixed threshold rather than the
// popover's actual rendered height, since that's only known post-render and
// this decision has to be made in show() before anything's on the DOM yet.
const MIN_SPACE_BELOW = 120;

// Shared by AbilitiesPanel, MoveBrowser and HeldItemsPanel: hover-a-name-to-
// show-a-popover, positioned relative to an ancestor selector (see
// relativeRect for why position: fixed doesn't work here — Obsidian's
// .workspace-leaf has contain: strict). Only the hover/position state
// machine is shared — a caller with its own side effect on show (e.g.
// AbilitiesPanel's fetch-and-cache) calls this hook's show() first, then
// does its own thing, rather than this module taking an onShow callback it'd
// only use once.
export function createHoverPopover(anchorSelector: string, offsetY = 6) {
	let hovered = $state<string | null>(null);
	let pos = $state<{ top: number; left: number; placement: "below" | "above" } | null>(null);

	function show(name: string, target: EventTarget | null) {
		hovered = name;
		const targetEl = target as HTMLElement;
		// Viewport-relative (not relativeRect's container-relative numbers) —
		// this decision is about actual on-screen room, independent of
		// wherever .detail-screen's own box happens to sit.
		const viewportRect = targetEl.getBoundingClientRect();
		const placement: "below" | "above" =
			window.innerHeight - viewportRect.bottom < MIN_SPACE_BELOW ? "above" : "below";
		const r = relativeRect(targetEl, anchorSelector);
		pos = placement === "below"
			? { top: r.bottom + offsetY, left: r.left, placement }
			// Anchored to the target's own top edge, not a computed
			// "top - popover height" — the popover's height isn't known here
			// (only after it renders), so it grows upward from this point via
			// `transform: translateY(-100%)` in each consumer's CSS instead.
			: { top: r.top - offsetY, left: r.left, placement };
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
