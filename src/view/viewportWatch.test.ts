import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ViewportReading, watchViewport } from "./viewportWatch";

// Node has no layout, ResizeObserver or frame clock: the scroller and target
// are plain objects answering the reads watchViewport makes, the scroller's
// window hands out frames a test runs by hand, and ResizeObserver is a
// stand-in global.
const observers: FakeResizeObserver[] = [];
class FakeResizeObserver {
	observed: unknown[] = [];
	disconnected = false;
	constructor(readonly callback: () => void) {
		observers.push(this);
	}
	observe(el: unknown) {
		this.observed.push(el);
	}
	disconnect() {
		this.disconnected = true;
	}
	fire() {
		if (!this.disconnected) this.callback();
	}
}

let frames = new Map<number, () => void>();
let nextFrameId = 1;
function runFrames() {
	const due = [...frames.values()];
	frames = new Map();
	for (const cb of due) cb();
}

function setup({ shown = true } = {}) {
	const listeners = new Set<() => void>();
	const scroller = {
		top: 100,
		clientHeight: 600,
		ownerDocument: {
			defaultView: {
				requestAnimationFrame(cb: () => void) {
					const id = nextFrameId++;
					frames.set(id, cb);
					return id;
				},
				cancelAnimationFrame(id: number) {
					frames.delete(id);
				},
			},
		},
		getBoundingClientRect() {
			return { top: this.top };
		},
		addEventListener(_type: string, fn: () => void) {
			listeners.add(fn);
		},
		removeEventListener(_type: string, fn: () => void) {
			listeners.delete(fn);
		},
	};
	const target = {
		top: -400,
		shown,
		getBoundingClientRect() {
			return { top: this.top };
		},
		getClientRects() {
			return this.shown ? [{}] : [];
		},
	};
	const above = {};
	const reads: ViewportReading[] = [];
	const stop = watchViewport(
		target as unknown as HTMLElement,
		scroller as unknown as HTMLElement,
		above as unknown as Element,
		(r) => reads.push(r),
	);
	const scroll = () => {
		for (const fn of listeners) fn();
	};
	return { scroller, target, above, reads, stop, scroll, listeners };
}

describe("watchViewport", () => {
	beforeEach(() => {
		observers.length = 0;
		frames = new Map();
		vi.stubGlobal("ResizeObserver", FakeResizeObserver);
	});
	afterEach(() => vi.unstubAllGlobals());

	it("reads at once, relative to the target's top edge", () => {
		const { reads } = setup();
		expect(reads).toEqual([{ scrollTop: 500, viewportHeight: 600 }]);
	});

	it("reads two scrolls in one frame once, with the later offset", () => {
		const { target, reads, scroll } = setup();
		target.top = -450;
		scroll();
		target.top = -520;
		scroll();
		expect(frames.size).toBe(1);
		runFrames();
		expect(reads.slice(1)).toEqual([{ scrollTop: 620, viewportHeight: 600 }]);
	});

	it("never reads while the target is hidden, and reads again once it shows", () => {
		const { target, scroller, reads, scroll } = setup({ shown: false });
		scroller.clientHeight = 0;
		scroll();
		observers[0].fire();
		runFrames();
		expect(reads).toEqual([]);
		target.shown = true;
		scroller.clientHeight = 600;
		scroll();
		runFrames();
		expect(reads).toEqual([{ scrollTop: 500, viewportHeight: 600 }]);
	});

	it("re-reads when what sits above the target resizes, without a scroll", () => {
		const { above, target, reads } = setup();
		expect(observers[0].observed.includes(above)).toBe(true);
		target.top = -300;
		observers[0].fire();
		runFrames();
		expect(reads[reads.length - 1]).toEqual({ scrollTop: 400, viewportHeight: 600 });
	});

	it("stops listening and drops a pending read on teardown", () => {
		const { reads, scroll, stop, listeners } = setup();
		scroll();
		stop();
		expect(listeners.size).toBe(0);
		expect(observers[0].disconnected).toBe(true);
		runFrames();
		expect(reads.length).toBe(1);
	});
});
