import { IDLE, PORTRAIT_PRESS, stepPortraitPress, type PortraitPressEvent, type PressState } from "../utils/pressHold";
import { createPressWatch, type PressWatch } from "./pressWatch";

// The portrait's art preview (#31): a touch held on the portrait hides the
// identity overlay and the toggles and grows the art until the finger lifts.
// The rules are utils/pressHold.ts's stepPortraitPress; this is the thin
// binding that turns DOM events into its events and runs the timer
// (pressWatch.ts, shared with favoriteMenu.ts). The watch is injected, so
// portraitPress.test.ts drives this wiring with a fake one, the same split as
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

export function createPortraitPress(
	onArtPreview: (show: boolean) => void,
	{ watch = createPressWatch() }: { watch?: PressWatch } = {},
): PortraitPress {
	let state: PressState = IDLE;

	function dispatch(event: PortraitPressEvent) {
		const step = stepPortraitPress(state, event);
		state = step.state;
		// A hold keeps watching for a scroll, which ends it as a lift would.
		if (state.phase === "idle") watch.stop();
		onArtPreview(step.artPreview);
		return step;
	}

	function onDown(e: PointerEvent) {
		watch.stop();
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
		watch.start(e, PORTRAIT_PRESS.holdMs, {
			onTimer: (t) => dispatch({ kind: "timer", t }),
			onScroll: () => dispatch({ kind: "scroll" }),
		});
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
		destroy: () => watch.stop(),
	};
}
