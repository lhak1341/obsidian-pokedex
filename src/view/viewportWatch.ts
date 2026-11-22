import { getContext } from "svelte";

// The browse screen's scroller is PokedexApp's root `.pokedex-view` (it, not
// Obsidian's contentEl, overflows). PokedexApp provides it through this
// context as a getter over its `$state`, so a child's effect that reads it
// before the root binds re-runs once it does; nothing below PokedexApp looks
// the scroller up by its class.
export const SCROLLER_CONTEXT = Symbol("pkdx-scroller");

export type ScrollerGetter = () => HTMLElement | undefined;

// Call during component init, as any getContext.
export function getScroller(): ScrollerGetter {
	return getContext<ScrollerGetter>(SCROLLER_CONTEXT);
}

// An element with no client rects is under `display:none`: TableScreen stays
// mounted while the detail screen shows, and every size read inside it is 0.
export function isShown(el: Element): boolean {
	return el.getClientRects().length > 0;
}

export interface ViewportReading {
	// How far the scroller's top edge is below the target's top edge.
	scrollTop: number;
	viewportHeight: number;
}

// The scroll offset and viewport a window (the Table window, the Card window)
// is computed from, relative to `target`. Read at once, then on a scroll or a
// resize of the scroller or `alsoObserve` (what sits above the target, such as
// FilterBar's inline Filters panel, can move it without a scroll), at most
// once per frame. Never read while the target is hidden: the window keeps its
// last slice, so back-to-list's restored scroll offset finds the same rows
// drawn (ADR-0016, ADR-0019). Frames come from the scroller's own window (a
// pop-out leaf's, as pressWatch's timers). Returns the teardown, for an
// `$effect` to return.
export function watchViewport(
	target: HTMLElement,
	scroller: HTMLElement,
	alsoObserve: Element | null,
	onRead: (reading: ViewportReading) => void,
): () => void {
	const read = () => {
		if (!isShown(target)) return;
		onRead({
			scrollTop: scroller.getBoundingClientRect().top - target.getBoundingClientRect().top,
			viewportHeight: scroller.clientHeight,
		});
	};
	const win = scroller.ownerDocument.defaultView ?? activeWindow;
	let frame = 0;
	const schedule = () => {
		if (frame) return;
		frame = win.requestAnimationFrame(() => {
			frame = 0;
			read();
		});
	};
	scroller.addEventListener("scroll", schedule, { passive: true });
	const ro = new ResizeObserver(schedule);
	ro.observe(scroller);
	if (alsoObserve) ro.observe(alsoObserve);
	read();
	return () => {
		scroller.removeEventListener("scroll", schedule);
		ro.disconnect();
		win.cancelAnimationFrame(frame);
	};
}
