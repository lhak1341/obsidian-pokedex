import { getContext, setContext } from "svelte";
import type { Band, OverlayMeasure } from "../utils/overlayPosition";

// The window an element is drawn in: a pop-out leaf's own, not the main
// window the plugin's code runs in, which the bare `window`/`activeWindow`
// globals can name instead. Frames and the viewport's height come from it;
// timers need not (a minimised main window's setTimeout kept full rate over a
// visible pop-out, probed live for #37). Probed live: a pop-out focused over
// a minimised main window got 90 frames in 1.5 s from its own window and 0
// from the global
// `requestAnimationFrame` (the table's spacers kept the old row height); a
// 600px pop-out beside an 870px main window placed an Info popover below a
// target with 79px of room, since the global `innerHeight` said 349.
// eslint (no-restricted-globals and no-restricted-properties in
// eslint.config.mjs) fails a global read anywhere in src/view.
export function windowOf(el: Element): Window {
	return el.ownerDocument.defaultView ?? activeWindow;
}

// A screen's root (BrowseScreen's, DetailScreen's): position: relative, and
// the containing block every Info popover and hover preview inside that
// screen is placed against (measureOverlay). Each screen provides it through
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

// The one DOM reader behind utils/overlayPosition.ts: the target's, its
// screen's root's (getScreenRoot) and the Visible band's rects, all
// viewport-relative, which infoPopoverPosition and artPreviewPosition re-base
// against the root themselves. Untested, as every DOM read in view/: this
// project's vitest config has no jsdom, so getBoundingClientRect isn't
// available to a unit test (ADR-0003).
export function measureOverlay(target: Element, root: Element | undefined, scroller: Element | undefined): OverlayMeasure {
	return { target: target.getBoundingClientRect(), root: root?.getBoundingClientRect(), band: visibleBand(target, scroller) };
}

// The Visible band (CONTEXT.md): the viewport-relative top and bottom an
// Info popover or an Art preview may use: the scroller's rect, which clips
// both (a screen's root sits inside it), within the target's own window. Probed live: a
// Pokédex leaf in the top half of a horizontal split had its scroller end at
// 403px in an 870px window, and both an Info box and the sprite preview
// measured against the window ran past 403 and were cut off there. Without a
// scroller (not yet bound) it is the window.
export function visibleBand(target: Element, scroller: Element | undefined): Band {
	const height = windowOf(target).innerHeight;
	const rect = scroller?.getBoundingClientRect();
	return { top: Math.max(rect?.top ?? 0, 0), bottom: Math.min(rect?.bottom ?? height, height) };
}
