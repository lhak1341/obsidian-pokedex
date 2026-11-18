import { CLOSED, stepPin, type PinEvent, type PinState } from "../utils/infoPopoverPin";
import { relativeRect } from "./domPosition";

// Below this much room (px) between the target's bottom edge and the
// viewport's own bottom, there isn't enough space left to render a popover
// underneath it without it running off-screen (or under Obsidian's status
// bar) — flip it above the target instead. A fixed threshold rather than the
// popover's actual rendered height, since that's only known post-render and
// this decision has to be made before anything's on the DOM yet.
const MIN_SPACE_BELOW = 120;

type Placement = "below" | "above";
type Pos = { top: number; left: number; placement: Placement };

// The Info popover binding, shared by AbilitiesPanel, HeldItemsPanel,
// MoveBrowser and TableScreen. The rules (hover previews for a mouse only, a
// tap pins, a tap elsewhere closes without being swallowed, …) live in
// utils/infoPopoverPin.ts and are tested there; this file only turns DOM
// events into its PinEvents, reading pointerType per event, and positions the
// box (relative to an ancestor selector — see relativeRect for why
// position: fixed doesn't work here: Obsidian's .workspace-leaf has
// contain: strict).
//
// One pin state for the whole module, not one per createHoverPopover call:
// the table's item and type popovers, and the detail screen's three panels,
// are separate instances, but only one Info popover is ever open. So tapping
// a type icon moves a pinned item popover there, and a pin anywhere suppresses
// hover previews everywhere. Each instance reads `hovered`/`pos` only while it
// owns the open target.
let pin = $state.raw<PinState<HTMLElement>>(CLOSED);
let openOwner = $state.raw<object | null>(null);
let openName = $state.raw<string | null>(null);
let openPos = $state.raw<Pos | null>(null);
let detachDocListeners: (() => void) | null = null;

interface OpenInfo {
	owner: object;
	name: string;
	anchorSelector: string;
	offsetY: number;
	onOpen?: () => void;
}

function place(targetEl: HTMLElement, anchorSelector: string, offsetY: number): Pos {
	// Viewport-relative (not relativeRect's container-relative numbers) —
	// this decision is about actual on-screen room, independent of wherever
	// the anchor's own box happens to sit.
	const viewportRect = targetEl.getBoundingClientRect();
	const placement: Placement = window.innerHeight - viewportRect.bottom < MIN_SPACE_BELOW ? "above" : "below";
	const r = relativeRect(targetEl, anchorSelector);
	return placement === "below"
		? { top: r.bottom + offsetY, left: r.left, placement }
		// Anchored to the target's own top edge, not a computed
		// "top - popover height" — the popover's height isn't known here
		// (only after it renders), so it grows upward from this point via
		// `transform: translateY(-100%)` in HoverPopoverBox's CSS instead.
		: { top: r.top - offsetY, left: r.left, placement };
}

// Feeds one event to the pin state and applies the result. Returns whether
// the popover consumed the event (the caller then stops it).
function dispatch(event: PinEvent<HTMLElement>, info?: OpenInfo): boolean {
	// Both screens stay mounted, so a pin can outlive its target's visibility:
	// pinned on the table, then the detail screen shown by a key (no click to
	// close it), or a detail panel's row replaced on navigation. Such a pin
	// would suppress every hover preview until the next click; it is closed
	// before the next event instead.
	if (pin.open && event.kind !== "escape" && pin.open.getClientRects().length === 0) {
		dispatch({ kind: "escape" });
	}
	const prev = pin;
	const step = stepPin(prev, event);
	pin = step.state;
	const open = step.state.open;
	if (open !== prev.open) {
		if (open && info) {
			openOwner = info.owner;
			openName = info.name;
			openPos = place(open, info.anchorSelector, info.offsetY);
			info.onOpen?.();
		} else {
			openOwner = null;
			openName = null;
			openPos = null;
		}
	}
	syncDocListeners();
	return step.swallowed;
}

// Tap-outside, scroll and Esc are only listened for while something is open.
// Capture phase on the target's own document: a tap on another target inside
// a table row stops propagation (so the row doesn't open), and a bubble
// listener would never see it to close the old popover.
function syncDocListeners() {
	const el = pin.open;
	if (el && !detachDocListeners) {
		const doc = el.ownerDocument;
		const onClick = (e: MouseEvent) => {
			const openEl = pin.open;
			const t = e.target as Element | null;
			if (!openEl || !t) return;
			// The open target's own click handler decides (close, or pin a preview).
			if (openEl.contains(t)) return;
			dispatch({ kind: t.closest?.(".hover-popover-box") ? "tap-inside" : "tap-outside" });
		};
		// A right-click or long-press is a tap elsewhere too (the row's menu).
		const onContextmenu = onClick;
		const onScroll = () => dispatch({ kind: "scroll" });
		const onKeydown = (e: KeyboardEvent) => {
			if (e.key === "Escape") dispatch({ kind: "escape" });
		};
		doc.addEventListener("click", onClick, true);
		doc.addEventListener("contextmenu", onContextmenu, true);
		doc.addEventListener("scroll", onScroll, true);
		doc.addEventListener("keydown", onKeydown, true);
		detachDocListeners = () => {
			doc.removeEventListener("click", onClick, true);
			doc.removeEventListener("contextmenu", onContextmenu, true);
			doc.removeEventListener("scroll", onScroll, true);
			doc.removeEventListener("keydown", onKeydown, true);
		};
	} else if (!el && detachDocListeners) {
		detachDocListeners();
		detachDocListeners = null;
	}
}

export function createHoverPopover(anchorSelector: string, offsetY = 6) {
	const owner = {};

	// A component that unmounts with its popover open takes the popover (and
	// the document listeners) with it.
	$effect(() => () => {
		if (openOwner === owner) dispatch({ kind: "escape" });
	});

	// Spread onto each target element: `<span class="pkdx-info-target"
	// {...popover.target(name)}>`. `onOpen` runs each time this target's
	// popover opens (a fetch, or per-target content like a held item's rarity).
	function target(name: string, onOpen?: () => void) {
		const info: OpenInfo = { owner, name, anchorSelector, offsetY, onOpen };
		return {
			role: "button",
			tabindex: 0,
			onpointerenter: (e: PointerEvent) => {
				dispatch({ kind: "hover-enter", target: e.currentTarget as HTMLElement, pointerType: e.pointerType }, info);
			},
			onpointerleave: (e: PointerEvent) => {
				dispatch({ kind: "hover-leave", target: e.currentTarget as HTMLElement, pointerType: e.pointerType }, info);
			},
			onclick: (e: MouseEvent) => {
				if (dispatch({ kind: "tap", target: e.currentTarget as HTMLElement }, info)) e.stopPropagation();
			},
			onkeydown: (e: KeyboardEvent) => {
				if (e.key !== "Enter" && e.key !== " ") return;
				if (dispatch({ kind: "key-activate", target: e.currentTarget as HTMLElement }, info)) {
					e.preventDefault();
					e.stopPropagation();
				}
			},
		};
	}

	return {
		get hovered() {
			return openOwner === owner ? openName : null;
		},
		get pos() {
			return openOwner === owner ? openPos : null;
		},
		get pinned() {
			return openOwner === owner && pin.pinned;
		},
		target,
	};
}
