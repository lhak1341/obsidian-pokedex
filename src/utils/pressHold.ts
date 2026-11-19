// Press and hold, DOM-free so the rules are table-tested here (prior art:
// infoPopoverPin.ts). The binding turns pointer events, a timer and scrolls
// into PressEvents and acts on the outcome; elapsed time comes in on each
// event, so nothing here reads a clock.

export interface PressOptions {
	// How long a press must last to count as held: the favourites menu waits
	// ~500ms, #31's portrait press-and-hold 350ms.
	holdMs: number;
	// A move further than this from the press point is a scroll or a drag,
	// not a hold.
	moveTolerance: number;
}

export type PressState =
	| { phase: "idle"; swallowClick: boolean }
	| { phase: "pressing"; x: number; y: number; t: number }
	| { phase: "held"; x: number; y: number };

export type PressEvent =
	| { kind: "down"; pointerType: string; isPrimary: boolean; x: number; y: number; t: number }
	| { kind: "move"; x: number; y: number }
	| { kind: "up" }
	| { kind: "cancel" }
	| { kind: "scroll" }
	| { kind: "timer"; t: number }
	| { kind: "click" };

export interface PressStep {
	state: PressState;
	// True on the one step where the press became a hold.
	fired: boolean;
	// True when the binding must stop this click: it is the tap a hold's lift
	// produces, and the row or tile under it must not also act on it.
	swallowed: boolean;
}

const pressStep = (state: PressState, fired = false, swallowed = false): PressStep => ({ state, fired, swallowed });

export const IDLE: PressState = { phase: "idle", swallowClick: false };

export function stepPress(state: PressState, event: PressEvent, options: PressOptions): PressStep {
	switch (event.kind) {
		case "down":
			// A second finger belongs to a pinch or a scroll, not a new press.
			if (!event.isPrimary) return pressStep(state);
			// Any new press, mouse included, clears a swallow left by a hold whose
			// tap never came (iOS may send none), so it can't eat a later tap.
			// A mouse never holds: its right-click opens the menu through
			// `contextmenu`, which a held mouse press would otherwise race.
			if (event.pointerType === "mouse") return pressStep(IDLE);
			return pressStep({ phase: "pressing", x: event.x, y: event.y, t: event.t });
		case "move":
			if (state.phase !== "pressing") return pressStep(state);
			if (Math.hypot(event.x - state.x, event.y - state.y) <= options.moveTolerance) return pressStep(state);
			return pressStep(IDLE);
		case "up":
		case "cancel":
		case "scroll":
			if (state.phase === "held") return pressStep({ phase: "idle", swallowClick: true });
			if (state.phase === "pressing") return pressStep(IDLE);
			return pressStep(state);
		case "timer":
			// Elapsed time is checked, not trusted: a timer the binding failed
			// to clear from an earlier press must not fire this one early.
			if (state.phase !== "pressing" || event.t - state.t < options.holdMs) return pressStep(state);
			return pressStep({ phase: "held", x: state.x, y: state.y }, true);
		case "click":
			if (state.phase === "held" || (state.phase === "idle" && state.swallowClick)) return pressStep(IDLE, false, true);
			return pressStep(state);
	}
}

// The favourites menu on a table row or Card view tile (#35). Only this layer
// knows about `contextmenu`: a right-click sends it, and so may a touch
// long-press (Android; iOS likely doesn't), racing our own hold. Either one
// opens the menu, never both.
export const MENU_PRESS: PressOptions = { holdMs: 500, moveTolerance: 10 };

export type MenuPressEvent = PressEvent | { kind: "contextmenu" };

export interface MenuPressStep {
	state: PressState;
	// Where to open the menu, if this step opens it: at the press point (a
	// hold: `Menu.showAtPosition`) or at the contextmenu event's own point.
	menu: { at: "press"; x: number; y: number } | { at: "event" } | null;
	// True when the binding must stop this event: the tap after a hold, or a
	// contextmenu from the same long-press, which reaching the document would
	// close the menu the hold just opened (seen live with Obsidian's Menu).
	swallowed: boolean;
}

export function stepMenuPress(state: PressState, event: MenuPressEvent): MenuPressStep {
	if (event.kind === "contextmenu") {
		// A hold already opened it: this is the same gesture's contextmenu.
		if (state.phase === "held" || (state.phase === "idle" && state.swallowClick)) {
			return { state, menu: null, swallowed: true };
		}
		// A contextmenu mid-press is that press's long-press: it opens the menu
		// and counts as the hold, so our timer can't open it again and the
		// lift's tap is swallowed.
		if (state.phase === "pressing") {
			return { state: { phase: "held", x: state.x, y: state.y }, menu: { at: "event" }, swallowed: false };
		}
		return { state, menu: { at: "event" }, swallowed: false };
	}
	const step = stepPress(state, event, MENU_PRESS);
	return {
		state: step.state,
		menu: step.fired && step.state.phase === "held" ? { at: "press", x: step.state.x, y: step.state.y } : null,
		swallowed: step.swallowed,
	};
}

// The portrait's art preview (#31): a touch held on the portrait hides the
// identity overlay and the toggles and grows the art to fill the box, until
// the finger lifts. Touch only: a mouse keeps hover-to-enlarge (wide panes),
// and a pen has neither. A press that starts on a toggle (shiny, Mega,
// Gigantamax) is that toggle's tap, never a hold. The favourite asterisk sits
// in DetailScreen's overlay, outside the portrait, so its presses never get here.
export const PORTRAIT_PRESS: PressOptions = { holdMs: 350, moveTolerance: 10 };

type DownEvent = Extract<PressEvent, { kind: "down" }>;
export type PortraitPressEvent = Exclude<PressEvent, DownEvent> | (DownEvent & { onToggle: boolean });

export interface PortraitPressStep {
	state: PressState;
	// The overlay and toggles are hidden and the art fills the box.
	showArt: boolean;
	swallowed: boolean;
}

export function stepPortraitPress(state: PressState, event: PortraitPressEvent): PortraitPressStep {
	const ignored = event.kind === "down" && event.isPrimary && (event.pointerType !== "touch" || event.onToggle);
	const step = ignored ? { state: IDLE, swallowed: false } : stepPress(state, event, PORTRAIT_PRESS);
	return { state: step.state, showArt: step.state.phase === "held", swallowed: step.swallowed };
}
