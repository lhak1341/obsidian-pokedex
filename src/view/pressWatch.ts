// The DOM half a press-and-hold binding needs while a press is live: the hold
// timer and a scroll listener. Shared by favoriteMenu.ts and portraitPress.ts,
// which each keep their own pointer handlers and decide when to stop (the menu
// at the hold, the portrait at the lift, since a scroll ends its hold too).
// The rules are utils/pressHold.ts; this is DOM-bound, so untested here (no
// jsdom in vitest.config.ts). Both bindings take a PressWatch, and their tests
// pass a fake one whose timer and scroll fire on demand.

import { windowOf } from "./domPosition";

export interface PressWatch {
	// Starts the hold timer and the scroll watch for the press `e` began.
	// onTimer gets the current time on the clock e.timeStamp uses, for the
	// rules' elapsed-time check.
	start(e: PointerEvent, holdMs: number, handlers: { onTimer: (t: number, doc: Document) => void; onScroll: () => void }): void;
	stop(): void;
}

export function createPressWatch(): PressWatch {
	let timer: { win: Window; handle: number } | null = null;
	let detachScroll: (() => void) | null = null;

	function stop() {
		if (timer) timer.win.clearTimeout(timer.handle);
		timer = null;
		detachScroll?.();
		detachScroll = null;
	}

	return {
		start(e, holdMs, { onTimer, onScroll }) {
			stop();
			const el = e.currentTarget as HTMLElement;
			const doc = el.ownerDocument;
			const win = windowOf(el);
			// The event's timeStamp and performance.now() share a clock.
			timer = { win, handle: win.setTimeout(() => onTimer(win.performance.now(), doc), holdMs) };
			// Scroll doesn't bubble: capture on the document sees the pane
			// (.pokedex-view) and the table's sideways scroller alike.
			doc.addEventListener("scroll", onScroll, true);
			detachScroll = () => doc.removeEventListener("scroll", onScroll, true);
		},
		stop,
	};
}
