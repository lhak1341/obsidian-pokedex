import { CLOSED, stepPin, type PinEvent, type PinState } from "../utils/infoPopoverPin";
import { infoPopoverPosition, type InfoPopoverPosition } from "../utils/overlayPosition";
import { getScreenRoot, measureOverlay, type ScreenRootGetter } from "./domPosition";
import { getScroller, type ScrollerGetter } from "./viewportWatch";

// The Info popover binding, shared by AbilitiesPanel, HeldItemsPanel,
// MoveBrowser, BrowseScreen and TableGrid. The rules (hover previews for a mouse only, a
// tap pins, a tap elsewhere closes without being swallowed, …) live in
// utils/infoPopoverPin.ts and are tested there; this file only turns DOM
// events into its PinEvents, reading pointerType per event, and positions the
// box (relative to its screen's root, getScreenRoot; the below/above flip and
// why the box is not position: fixed are utils/overlayPosition.ts's
// infoPopoverPosition, tested there).
//
// One pin state for the whole module, not one per createInfoPopover call:
// the table's item and type popovers, and the detail screen's three panels,
// are separate instances, but only one Info popover is ever open. So tapping
// a type icon moves a pinned item popover there, and a pin anywhere suppresses
// hover previews everywhere. Each instance reads `open`/`pos` only while it
// owns the open target.
let pin = $state.raw<PinState<HTMLElement>>(CLOSED);
let openOwner = $state.raw<object | null>(null);
let openName = $state.raw<string | null>(null);
let openPos = $state.raw<InfoPopoverPosition | null>(null);
let detachDocListeners: (() => void) | null = null;

// The attributes a target spreads onto its element (`{...popover.target(name)}`).
export interface InfoTargetProps {
	role: "button";
	tabindex: 0;
	onpointerenter: (e: PointerEvent) => void;
	onpointerleave: (e: PointerEvent) => void;
	onclick: (e: MouseEvent) => void;
	onkeydown: (e: KeyboardEvent) => void;
}

interface OpenInfo {
	owner: object;
	name: string;
	root: ScreenRootGetter;
	scroller: ScrollerGetter;
	offsetY: number;
	onOpen?: () => void;
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
			openPos = infoPopoverPosition(measureOverlay(open, info.root(), info.scroller()), info.offsetY);
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
			dispatch({ kind: t.closest?.(".info-popover-box") ? "tap-inside" : "tap-outside" });
		};
		// A right-click or long-press is a tap elsewhere too (the row's menu).
		const onContextmenu = onClick;
		// Only a scroll that moves the target closes it: the pane (.pokedex-view),
		// the table's sideways scroller (.table-wrap) or the document. Another
		// pane, a filter list or the box's own content scrolling leaves it open.
		const onScroll = (e: Event) => {
			const openEl = pin.open;
			const scrolled = e.target as Node | null;
			if (openEl && scrolled?.contains?.(openEl)) dispatch({ kind: "scroll" });
		};
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

// Call during component init, inside a screen: the box is placed against
// that screen's root (getScreenRoot).
export function createInfoPopover(offsetY = 6) {
	const owner = {};
	const root = getScreenRoot();
	const scroller = getScroller();

	// A component that unmounts with its popover open takes the popover (and
	// the document listeners) with it.
	$effect(() => () => {
		if (openOwner === owner) dispatch({ kind: "escape" });
	});

	// Spread onto each target element: `<span class="pkdx-info-target"
	// {...popover.target(name)}>`. `onOpen` runs each time this target's
	// popover opens (a fetch, or per-target content like a held item's rarity).
	function target(name: string, onOpen?: () => void): InfoTargetProps {
		const info: OpenInfo = { owner, name, root, scroller, offsetY, onOpen };
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
		get open() {
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
