import { IDLE, PORTRAIT_PRESS, stepPortraitPress, type PortraitPressEvent, type PressState } from "../utils/pressHold";

// The portrait's art preview (#31): a touch held on the portrait hides the
// identity overlay and the toggles and grows the art until the finger lifts.
// The rules are utils/pressHold.ts's stepPortraitPress; this is the thin
// binding that turns DOM events into its events and runs the timer. DOM-bound,
// so untested here (no jsdom in vitest.config.ts), the same split as
// favoriteMenu.ts.

export interface PortraitPressProps {
	onpointerdown: (e: PointerEvent) => void;
	onpointermove: (e: PointerEvent) => void;
	onpointerup: () => void;
	onpointercancel: () => void;
	// A touch long-press sends contextmenu on Android (the WebView's image
	// menu) while ours is held: stop it, but leave a mouse right-click alone.
	oncontextmenu: (e: MouseEvent) => void;
	// Capture phase, so the tap a hold's lift produces reaches no toggle.
	onclickcapture: (e: MouseEvent) => void;
}

export interface PortraitPress {
	props: PortraitPressProps;
	destroy(): void;
}

export function createPortraitPress(onShowArt: (show: boolean) => void): PortraitPress {
	let state: PressState = IDLE;
	let timer: { win: Window; handle: number } | null = null;
	let detachScroll: (() => void) | null = null;

	function stopWatching() {
		if (timer) timer.win.clearTimeout(timer.handle);
		timer = null;
		detachScroll?.();
		detachScroll = null;
	}

	function dispatch(event: PortraitPressEvent) {
		const step = stepPortraitPress(state, event);
		state = step.state;
		// A hold keeps watching for a scroll, which ends it as a lift would.
		if (state.phase === "idle") stopWatching();
		onShowArt(step.showArt);
		return step;
	}

	function onDown(e: PointerEvent) {
		stopWatching();
		const target = e.target instanceof Element ? e.target : null;
		dispatch({
			kind: "down",
			pointerType: e.pointerType,
			isPrimary: e.isPrimary,
			x: e.clientX,
			y: e.clientY,
			t: e.timeStamp,
			onToggle: target?.closest("button") != null,
		});
		if (state.phase !== "pressing") return;
		const doc = (e.currentTarget as HTMLElement).ownerDocument;
		const win = doc.defaultView ?? activeWindow;
		// The event's timeStamp and performance.now() share a clock.
		timer = { win, handle: win.setTimeout(() => dispatch({ kind: "timer", t: win.performance.now() }), PORTRAIT_PRESS.holdMs) };
		const onScroll = () => dispatch({ kind: "scroll" });
		doc.addEventListener("scroll", onScroll, true);
		detachScroll = () => doc.removeEventListener("scroll", onScroll, true);
	}

	return {
		props: {
			onpointerdown: onDown,
			onpointermove: (e) => {
				if (state.phase === "pressing") dispatch({ kind: "move", x: e.clientX, y: e.clientY });
			},
			onpointerup: () => dispatch({ kind: "up" }),
			onpointercancel: () => dispatch({ kind: "cancel" }),
			oncontextmenu: (e) => {
				if (state.phase !== "idle") e.preventDefault();
			},
			onclickcapture: (e) => {
				if (!dispatch({ kind: "click" }).swallowed) return;
				e.preventDefault();
				e.stopPropagation();
			},
		},
		destroy: stopWatching,
	};
}
