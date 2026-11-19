import { describe, expect, it } from "vitest";
import {
	IDLE, MENU_PRESS, PORTRAIT_PRESS, stepMenuPress, stepPortraitPress, stepPress, type MenuPressEvent, type PortraitPressEvent,
	type PressEvent, type PressOptions, type PressState,
} from "./pressHold";

const MENU: PressOptions = MENU_PRESS;

const down = (t: number, x = 100, y = 100, pointerType = "touch"): PressEvent =>
	({ kind: "down", pointerType, isPrimary: true, x, y, t });
const timer = (t: number): PressEvent => ({ kind: "timer", t });

// Feeds events from idle, as the binding does one at a time, and collects
// every step's outcome.
function run(events: PressEvent[], options = MENU) {
	let state: PressState = IDLE;
	const steps = events.map((e) => {
		const step = stepPress(state, e, options);
		state = step.state;
		return step;
	});
	return { state, steps };
}

describe("press and hold", () => {
	it("fires once a touch press is held for the hold time", () => {
		const { steps } = run([down(0), timer(500)]);
		expect(steps.map((s) => s.fired)).toEqual([false, true]);
	});

	it("does not fire before the hold time, and the hold time is the caller's", () => {
		expect(run([down(0), timer(499)]).steps[1].fired).toBe(false);
		expect(run([down(0), timer(350)], { ...MENU, holdMs: 350 }).steps[1].fired).toBe(true);
	});

	it.each<[string, PressEvent]>([
		["a lift", { kind: "up" }],
		["a pointercancel", { kind: "cancel" }],
		["a scroll", { kind: "scroll" }],
		["a move past the tolerance", { kind: "move", x: 111, y: 100 }],
		["a diagonal move past the tolerance", { kind: "move", x: 108, y: 108 }],
	])("%s before the hold time cancels it", (_, event) => {
		const { state, steps } = run([down(0), event, timer(500)]);
		expect(steps[2].fired).toBe(false);
		expect(state).toEqual(IDLE);
	});

	it("a move within the tolerance keeps the press", () => {
		expect(run([down(0), { kind: "move", x: 106, y: 107 }, timer(500)]).steps[2].fired).toBe(true);
	});

	it("a mouse never holds: its right-click has the contextmenu path", () => {
		expect(run([down(0, 100, 100, "mouse"), timer(500)]).steps[1].fired).toBe(false);
	});

	it("a second finger is not a press of its own", () => {
		const second: PressEvent = { kind: "down", pointerType: "touch", isPrimary: false, x: 300, y: 300, t: 200 };
		const { steps } = run([down(0), second, timer(500)]);
		expect(steps[2].fired).toBe(true);
	});

	it("a stale timer from an earlier press does not fire the next one early", () => {
		// Press A at 0 lifts at 100; press B at 400; A's timer arrives at 500.
		const { steps } = run([down(0), { kind: "up" }, down(400), timer(500), timer(900)]);
		expect(steps.map((s) => s.fired)).toEqual([false, false, false, false, true]);
	});

	it("swallows the one tap that follows a hold, so the row or tile does not also open", () => {
		const { steps } = run([down(0), timer(500), { kind: "up" }, { kind: "click" }, down(2000), { kind: "up" }, { kind: "click" }]);
		expect(steps.map((s) => s.swallowed)).toEqual([false, false, false, true, false, false, false]);
	});

	it("never swallows a plain tap or a mouse click", () => {
		expect(run([down(0), { kind: "up" }, { kind: "click" }]).steps[2].swallowed).toBe(false);
		expect(run([down(0, 0, 0, "mouse"), timer(900), { kind: "up" }, { kind: "click" }]).steps[3].swallowed).toBe(false);
	});

	it("a hold whose tap never came does not eat the next press's tap", () => {
		// iOS may send no click after a long press; the next press starts clean.
		const { steps } = run([down(0), timer(500), { kind: "up" }, down(3000), { kind: "up" }, { kind: "click" }]);
		expect(steps[5].swallowed).toBe(false);
	});

	it("a held press is not undone by the finger moving or lifting after the hold", () => {
		const { state, steps } = run([down(0), timer(500), { kind: "move", x: 200, y: 200 }, { kind: "up" }]);
		expect(steps.some((s) => s.fired && s !== steps[1])).toBe(false);
		expect(state).toEqual({ phase: "idle", swallowClick: true });
	});
});

// The favourites menu on a table row or Card view tile: the hold above, plus
// the `contextmenu` a right-click (and, on Android, a long-press) sends.
function runMenu(events: MenuPressEvent[]) {
	let state: PressState = IDLE;
	const steps = events.map((e) => {
		const step = stepMenuPress(state, e);
		state = step.state;
		return step;
	});
	return { state, steps };
}
const contextmenu: MenuPressEvent = { kind: "contextmenu" };

describe("favourites menu press", () => {
	it("holds for about 500ms with a ~10px tolerance", () => {
		expect(MENU_PRESS).toEqual({ holdMs: 500, moveTolerance: 10 });
	});

	it("a hold opens the menu at the press point", () => {
		const { steps } = runMenu([down(0, 40, 60), timer(500)]);
		expect(steps.map((s) => s.menu)).toEqual([null, { at: "press", x: 40, y: 60 }]);
	});

	it("a right-click opens it at the event", () => {
		const { steps } = runMenu([down(0, 40, 60, "mouse"), { kind: "up" }, contextmenu]);
		expect(steps[2].menu).toEqual({ at: "event" });
	});

	it("opens it once when contextmenu follows our hold (a long-press that also fires contextmenu)", () => {
		const { steps } = runMenu([down(0), timer(500), contextmenu, { kind: "up" }, { kind: "click" }]);
		expect(steps.filter((s) => s.menu !== null)).toHaveLength(1);
		expect(steps[4].swallowed).toBe(true);
	});

	it("swallows that duplicate contextmenu, which would otherwise close the menu the hold opened", () => {
		const { steps } = runMenu([down(0), timer(500), contextmenu, { kind: "up" }, contextmenu]);
		expect(steps[2].swallowed).toBe(true);
		expect(steps[4].swallowed).toBe(true);
	});

	it("never swallows a contextmenu that opens the menu", () => {
		expect(runMenu([contextmenu]).steps[0].swallowed).toBe(false);
		expect(runMenu([down(0), contextmenu]).steps[1].swallowed).toBe(false);
	});

	it("opens it once when contextmenu comes before our hold time", () => {
		const { steps } = runMenu([down(0), contextmenu, timer(500), { kind: "up" }, { kind: "click" }]);
		expect(steps.map((s) => s.menu)).toEqual([null, { at: "event" }, null, null, null]);
		expect(steps[4].swallowed).toBe(true);
	});

	it("a later right-click opens it again", () => {
		const { steps } = runMenu([down(0), timer(500), { kind: "up" }, down(3000, 0, 0, "mouse"), { kind: "up" }, contextmenu]);
		expect(steps.filter((s) => s.menu !== null)).toHaveLength(2);
	});
});

// The portrait's art preview (#31): hold to hide the overlay and toggles and
// grow the art, lift to restore them.
function runPortrait(events: PortraitPressEvent[]) {
	let state: PressState = IDLE;
	const steps = events.map((e) => {
		const step = stepPortraitPress(state, e);
		state = step.state;
		return step;
	});
	return { state, steps };
}
const portraitDown = (t: number, opts: { pointerType?: string; onToggle?: boolean } = {}): PortraitPressEvent => ({
	kind: "down", pointerType: opts.pointerType ?? "touch", isPrimary: true, x: 100, y: 100, t, onToggle: opts.onToggle ?? false,
});
const portraitTimer = (t: number): PortraitPressEvent => ({ kind: "timer", t });

describe("portrait art preview press", () => {
	it("holds for 350ms", () => {
		expect(PORTRAIT_PRESS.holdMs).toBe(350);
		const { steps } = runPortrait([portraitDown(0), portraitTimer(349), portraitTimer(350)]);
		expect(steps.map((s) => s.showArt)).toEqual([false, false, true]);
	});

	it("shows the art for as long as the finger stays down, and restores on release", () => {
		const { steps } = runPortrait([portraitDown(0), portraitTimer(350), { kind: "move", x: 104, y: 103 }, { kind: "up" }]);
		expect(steps.map((s) => s.showArt)).toEqual([false, true, true, false]);
	});

	it.each<[string, PortraitPressEvent]>([
		["a lift", { kind: "up" }],
		["a pointercancel", { kind: "cancel" }],
		["a scroll", { kind: "scroll" }],
	])("%s before 350ms cancels it", (_, event) => {
		const { steps } = runPortrait([portraitDown(0), event, portraitTimer(350)]);
		expect(steps[2].showArt).toBe(false);
	});

	it("a press that starts on a toggle never shows the art", () => {
		const { steps } = runPortrait([portraitDown(0, { onToggle: true }), portraitTimer(350), portraitTimer(1000)]);
		expect(steps.map((s) => s.showArt)).toEqual([false, false, false]);
	});

	it.each(["mouse", "pen"])("only touch holds: a %s press does nothing", (pointerType) => {
		const { steps } = runPortrait([portraitDown(0, { pointerType }), portraitTimer(350), portraitTimer(1000)]);
		expect(steps.map((s) => s.showArt)).toEqual([false, false, false]);
	});

	it("swallows the tap a hold's lift produces, and only that one", () => {
		const { steps } = runPortrait([portraitDown(0), portraitTimer(350), { kind: "up" }, { kind: "click" }, portraitDown(900), { kind: "up" }, { kind: "click" }]);
		expect(steps.map((s) => s.swallowed)).toEqual([false, false, false, true, false, false, false]);
	});
});
