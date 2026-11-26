import { getContext } from "svelte";
import { windowOf } from "./domPosition";

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

// Runs `fn` on `win`'s next frame, however many times it is asked before
// then. `cancel` drops a pending run.
function frameScheduler(win: Window, fn: () => void): { schedule: () => void; cancel: () => void } {
	let frame = 0;
	return {
		schedule() {
			if (frame) return;
			frame = win.requestAnimationFrame(() => {
				frame = 0;
				fn();
			});
		},
		cancel() {
			win.cancelAnimationFrame(frame);
			frame = 0;
		},
	};
}

// Resolves on the next frame of the window `el` is drawn in (settleTopTile's
// layout wait).
export function nextFrame(el: Element): Promise<void> {
	return new Promise((resolve) => windowOf(el).requestAnimationFrame(() => resolve()));
}

// The scroll offset and viewport a window (the Table window, the Card window)
// is computed from, relative to `target`. Read at once, then on a scroll or a
// resize of the scroller or `alsoObserve` (what sits above the target, such as
// FilterBar's inline Filters panel, can move it without a scroll), at most
// once per frame. Never read while the target is hidden: the window keeps its
// last slice, so back-to-list's restored scroll offset finds the same rows
// drawn (ADR-0016, ADR-0019). Frames come from the scroller's own window
// (windowOf). Returns the teardown, for an `$effect` to return.
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
	const frames = frameScheduler(windowOf(scroller), read);
	scroller.addEventListener("scroll", frames.schedule, { passive: true });
	const ro = new ResizeObserver(frames.schedule);
	ro.observe(scroller);
	if (alsoObserve) ro.observe(alsoObserve);
	read();
	return () => {
		scroller.removeEventListener("scroll", frames.schedule);
		ro.disconnect();
		frames.cancel();
	};
}

// A windowed list's measure of its drawn rows (row heights, the open panel,
// the font): run on the next frame, then a frame after any of `observed`
// resizes, at most once per frame, and never while `target` is hidden (every
// size inside it reads 0 then, so the list keeps what it measured last). A
// frame later, not inside the observer: a write from there re-lays the list
// out in the same frame, which Chromium reports as an undelivered
// ResizeObserver loop. Frames come from `target`'s own window. The caller's
// `$effect` re-runs it whenever the drawn rows change, so `observed` can be
// the rows themselves. Returns the teardown.
export function watchLayout(target: HTMLElement, observed: Iterable<Element>, measure: () => void): () => void {
	const frames = frameScheduler(windowOf(target), () => {
		if (isShown(target)) measure();
	});
	const ro = new ResizeObserver(frames.schedule);
	for (const el of observed) ro.observe(el);
	frames.schedule();
	return () => {
		ro.disconnect();
		frames.cancel();
	};
}

// A size that must survive a trip to the detail screen (a grid's width, the
// scroller's height): `onSize` gets `read()` each time `observed` resizes,
// except the 0 it reads while hidden, so the last real size is kept. Returns
// the teardown.
export function watchSize(observed: Element, read: () => number, onSize: (size: number) => void): () => void {
	const ro = new ResizeObserver(() => {
		const size = read();
		if (size > 0) onSize(size);
	});
	ro.observe(observed);
	return () => ro.disconnect();
}
