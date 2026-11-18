// Pin state for the Info popover (the ability, held item, move and type-name
// explanations): which target's popover is open, and whether it is pinned.
// DOM-free so the rules are table-tested here; view/infoPopover.svelte.ts is
// the thin binding that turns DOM events into PinEvents and positions the box.
//
// Touch vs mouse is decided per event from the event's own pointerType, never
// from Platform.isMobile or `(hover: hover)`: a laptop with a touch screen
// sends both, and a tap's trailing compatibility mouse events must not undo
// the pin it just made (hover is ignored while pinned).
//
// `T` is whatever identifies a target; the binding uses the element itself,
// compared with ===.

export interface PinState<T> {
	open: T | null;
	pinned: boolean;
}

export type PinEvent<T> =
	| { kind: "hover-enter"; target: T; pointerType: string }
	| { kind: "hover-leave"; target: T; pointerType: string }
	| { kind: "tap"; target: T }
	| { kind: "key-activate"; target: T }
	| { kind: "tap-inside" }
	| { kind: "tap-outside" }
	| { kind: "scroll" }
	| { kind: "escape" };

export interface PinStep<T> {
	state: PinState<T>;
	// True when the popover consumed the event: the binding stops it there
	// (a tap on a target inside a table row must not also open the detail
	// screen; Space must not also scroll). A tap outside is never swallowed,
	// so dismissing the popover still does that tap's own job.
	swallowed: boolean;
}

export const CLOSED: PinState<never> = { open: null, pinned: false };

export function stepPin<T>(state: PinState<T>, event: PinEvent<T>): PinStep<T> {
	switch (event.kind) {
		case "hover-enter":
			// Only a mouse previews; and a pinned popover isn't replaced by a
			// preview of whatever the mouse crosses next.
			if (event.pointerType !== "mouse" || state.pinned) return { state, swallowed: false };
			return { state: { open: event.target, pinned: false }, swallowed: false };
		case "hover-leave":
			if (event.pointerType !== "mouse" || state.pinned) return { state, swallowed: false };
			return { state: state.open === event.target ? CLOSED : state, swallowed: false };
		case "tap":
		case "key-activate":
			// A tap on the target currently previewed pins it; only a tap on
			// the pinned one closes it.
			if (state.pinned && state.open === event.target) return { state: CLOSED, swallowed: true };
			return { state: { open: event.target, pinned: true }, swallowed: true };
		case "tap-inside":
			return { state, swallowed: false };
		case "tap-outside":
		case "scroll":
		case "escape":
			return { state: CLOSED, swallowed: false };
	}
}
