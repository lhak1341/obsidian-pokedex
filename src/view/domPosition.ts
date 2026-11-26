import { sideAnchoredPreviewPosition } from "../utils/previewPosition";

// The window an element is drawn in: a pop-out leaf's own, not the main
// window the plugin's code runs in, which the bare `window`/`activeWindow`
// globals can name instead. Frames, timers and the viewport's height come
// from it. Probed live: a pop-out focused over a minimised main window got 90
// frames in 1.5 s from its own window and 0 from the global
// `requestAnimationFrame` (the table's spacers kept the old row height); a
// 600px pop-out beside an 870px main window placed an Info popover below a
// target with 79px of room, since the global `innerHeight` said 349.
// `src/view/ownWindow.test.ts` fails on a global read.
export function windowOf(el: Element): Window {
	return el.ownerDocument.defaultView ?? activeWindow;
}

export interface RelativeRect {
	top: number;
	left: number;
	right: number;
	bottom: number;
	width: number;
	height: number;
}

// getBoundingClientRect() is viewport-relative, but a popover positioned
// with `position: absolute` needs coordinates relative to its own
// positioning ancestor instead — Obsidian's `.workspace-leaf` has `contain:
// strict`, which (like a transform) makes it the containing block for a
// `position: fixed` descendant, so a fixed popover positioned from a raw
// viewport rect lands visibly off (by however tall the tab bar is). This
// re-bases `target`'s rect against the nearest ancestor matching
// `containerSelector` instead. Untested (see PokeApiClient.ts/PokedexView.ts
// for the same convention) — this project's vitest config has no jsdom
// environment, so `getBoundingClientRect`/`closest` aren't available to a
// unit test without adding one just for this.
export function relativeRect(target: HTMLElement, containerSelector: string): RelativeRect {
	const rect = target.getBoundingClientRect();
	const containerRect = target.closest(containerSelector)?.getBoundingClientRect();
	const top = containerRect?.top ?? 0;
	const left = containerRect?.left ?? 0;
	return {
		top: rect.top - top,
		left: rect.left - left,
		right: rect.right - left,
		bottom: rect.bottom - top,
		width: rect.width,
		height: rect.height,
	};
}

// Side-anchored hover-preview positioning shared by TableGrid's sprite
// preview and DetailScreen's portrait preview — used to be duplicated
// verbatim between the two (same relativeRect + vertical-clamp shape, only
// the container selector and halfHeight differed). The clamp/shift math
// itself is DOM-free and lives in utils/previewPosition.ts (tested there);
// this wrapper is only the DOM-reading part (relativeRect,
// getBoundingClientRect), left untested per this project's view/ convention
// (no jsdom in vitest.config.ts).
export function computeSideAnchoredPreviewPosition(
	target: HTMLElement,
	containerSelector: string,
	halfHeight: number,
): { top: number; left: number } {
	const r = relativeRect(target, containerSelector);
	const viewportRect = target.getBoundingClientRect();
	return sideAnchoredPreviewPosition(
		r.top,
		r.right,
		r.height,
		viewportRect.top,
		viewportRect.height,
		halfHeight,
		windowOf(target).innerHeight,
	);
}
