import { describe, expect, it } from "vitest";
import { CLOSED, stepPin, type PinEvent, type PinState } from "./infoPopoverPin";

// Feeds a sequence of events from closed, as the binding does one at a time.
const runPin = (events: PinEvent<string>[]): PinState<string> =>
	events.reduce<PinState<string>>((s, e) => stepPin(s, e).state, CLOSED);

const enter = (target: string, pointerType: string): PinEvent<string> => ({ kind: "hover-enter", target, pointerType });
const leave = (target: string, pointerType: string): PinEvent<string> => ({ kind: "hover-leave", target, pointerType });
const tap = (target: string): PinEvent<string> => ({ kind: "tap", target });

describe("Info popover pin state", () => {
	it("previews on mouse hover", () => {
		expect(runPin([enter("A", "mouse")])).toEqual({ open: "A", pinned: false });
	});

	it("closes a preview when the mouse leaves its target, not another one", () => {
		expect(runPin([enter("A", "mouse"), leave("A", "mouse")])).toEqual(CLOSED);
		expect(runPin([enter("A", "mouse"), enter("B", "mouse"), leave("A", "mouse")])).toEqual({ open: "B", pinned: false });
	});

	it("touch-hover guard: ignores hover from a touch or pen pointer", () => {
		expect(runPin([enter("A", "touch")])).toEqual(CLOSED);
		expect(runPin([enter("A", "pen")])).toEqual(CLOSED);
	});

	it("pins on a tap or click, closes on a second tap of the same target, moves on another", () => {
		expect(runPin([tap("A")])).toEqual({ open: "A", pinned: true });
		expect(runPin([enter("A", "mouse"), tap("A")])).toEqual({ open: "A", pinned: true });
		expect(runPin([tap("A"), tap("A")])).toEqual(CLOSED);
		expect(runPin([tap("A"), tap("B")])).toEqual({ open: "B", pinned: true });
	});

	it("swallows a tap on a target, so a table row behind it does not also open", () => {
		expect(stepPin(CLOSED, tap("A")).swallowed).toBe(true);
		expect(stepPin({ open: "A", pinned: true }, tap("A")).swallowed).toBe(true);
	});

	it("hover suppression: while pinned, mouse hover neither moves nor closes the popover", () => {
		expect(runPin([tap("A"), enter("B", "mouse")])).toEqual({ open: "A", pinned: true });
		// A click pins with the mouse still over the target; moving off it must not unpin.
		expect(runPin([enter("A", "mouse"), tap("A"), leave("A", "mouse")])).toEqual({ open: "A", pinned: true });
	});

	it("a touch tap followed by its synthetic mouse events stays pinned", () => {
		// What a browser fires for one tap: touch pointer enter/leave, the tap,
		// then compatibility mouse events at the same point.
		expect(
			runPin([enter("A", "touch"), leave("A", "touch"), tap("A"), enter("A", "mouse"), leave("A", "mouse")]),
		).toEqual({ open: "A", pinned: true });
		// Some browsers fire the compatibility mouseenter before the click.
		expect(
			runPin([enter("A", "touch"), leave("A", "touch"), enter("A", "mouse"), tap("A"), leave("A", "mouse")]),
		).toEqual({ open: "A", pinned: true });
	});

	it("a tap outside closes it and is not swallowed, so it still does its own job", () => {
		const step = stepPin({ open: "A", pinned: true }, { kind: "tap-outside" });
		expect(step).toEqual({ state: CLOSED, swallowed: false });
		expect(runPin([enter("A", "mouse"), { kind: "tap-outside" }])).toEqual(CLOSED);
	});

	it("a tap inside the box does nothing", () => {
		expect(stepPin({ open: "A", pinned: true }, { kind: "tap-inside" })).toEqual({
			state: { open: "A", pinned: true },
			swallowed: false,
		});
	});

	it.each([["scroll" as const], ["escape" as const]])("%s closes a pinned popover and a preview", (kind) => {
		expect(runPin([tap("A"), { kind }])).toEqual(CLOSED);
		expect(runPin([enter("A", "mouse"), { kind }])).toEqual(CLOSED);
	});

	it("Enter/Space on a focused target toggles the pin like a tap, and is consumed", () => {
		const key = (target: string): PinEvent<string> => ({ kind: "key-activate", target });
		expect(runPin([key("A")])).toEqual({ open: "A", pinned: true });
		expect(runPin([key("A"), key("A")])).toEqual(CLOSED);
		expect(runPin([key("A"), key("B")])).toEqual({ open: "B", pinned: true });
		// Consumed, so Space doesn't also scroll the pane.
		expect(stepPin(CLOSED, key("A")).swallowed).toBe(true);
	});

	it("starts closed", () => {
		expect(runPin([])).toEqual(CLOSED);
	});
});
