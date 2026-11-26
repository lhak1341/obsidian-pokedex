import { getContext, setContext } from "svelte";
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

// A screen's root (BrowseScreen's, DetailScreen's): position: relative, and
// the containing block every Info popover and hover preview inside that
// screen is placed against (relativeRect). Each screen provides it through
// this context as a getter over its `$state`, as PokedexApp provides the
// scroller (getScroller), so a child reads the element and nothing below a
// screen looks it up by class name or DOM nesting.
export const SCREEN_ROOT_CONTEXT = Symbol("pkdx-screen-root");

export type ScreenRootGetter = () => HTMLElement | undefined;

// Call during the screen's own component init, before anything reads it
// (the screen's own popovers included).
export function provideScreenRoot(root: ScreenRootGetter): void {
	setContext<ScreenRootGetter>(SCREEN_ROOT_CONTEXT, root);
}

// Call during component init, as any getContext. Throws outside a screen: a
// popover placed against no root lands at the leaf's corner, silently.
export function getScreenRoot(): ScreenRootGetter {
	const root = getContext<ScreenRootGetter | undefined>(SCREEN_ROOT_CONTEXT);
	if (!root) throw new Error("getScreenRoot() called outside a screen (provideScreenRoot)");
	return root;
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
// re-bases `target`'s rect against its screen's root (getScreenRoot) instead. Untested (see PokeApiClient.ts/PokedexView.ts
// for the same convention) — this project's vitest config has no jsdom
// environment, so `getBoundingClientRect`/`closest` aren't available to a
// unit test without adding one just for this.
export function relativeRect(target: HTMLElement, root: Element | undefined): RelativeRect {
	const rect = target.getBoundingClientRect();
	const containerRect = root?.getBoundingClientRect();
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
// the screen and halfHeight differed). The clamp/shift math
// itself is DOM-free and lives in utils/previewPosition.ts (tested there);
// this wrapper is only the DOM-reading part (relativeRect,
// getBoundingClientRect), left untested per this project's view/ convention
// (no jsdom in vitest.config.ts).
export function computeSideAnchoredPreviewPosition(
	target: HTMLElement,
	root: Element | undefined,
	halfHeight: number,
): { top: number; left: number } {
	const r = relativeRect(target, root);
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
