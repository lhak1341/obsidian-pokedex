import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextFrame, type ViewportReading, watchLayout, watchSize, watchViewport } from "./viewportWatch";

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

// The document of the window an element is drawn in. Its frames are the only
// ones a test runs: the global requestAnimationFrame throws (beforeEach), as a
// minimised main window's never fires for a pop-out leaf.
const ownerDocument = {
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
};

function stubGlobals() {
	observers.length = 0;
	frames = new Map();
	vi.stubGlobal("ResizeObserver", FakeResizeObserver);
	const noGlobalFrames = () => {
		throw new Error("a frame from the global window");
	};
	vi.stubGlobal("requestAnimationFrame", noGlobalFrames);
	vi.stubGlobal("cancelAnimationFrame", noGlobalFrames);
}

function setup({ shown = true } = {}) {
	const listeners = new Set<() => void>();
	const scroller = {
		top: 100,
		clientHeight: 600,
		ownerDocument,
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
	beforeEach(stubGlobals);
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


function setupLayout({ shown = true } = {}) {
	const target = {
		shown,
		ownerDocument,
		getClientRects() {
			return this.shown ? [{}] : [];
		},
	};
	const rows = [{}, {}];
	let measured = 0;
	const stop = watchLayout(target as unknown as HTMLElement, rows as unknown as Element[], () => measured++);
	return { target, rows, stop, measures: () => measured };
}

describe("watchLayout", () => {
	beforeEach(stubGlobals);
	afterEach(() => vi.unstubAllGlobals());

	it("measures on the next frame of the target's own window, not at once", () => {
		const { measures } = setupLayout();
		expect(measures()).toBe(0);
		runFrames();
		expect(measures()).toBe(1);
	});

	it("observes every given element and measures a burst of resizes once a frame", () => {
		const { rows, measures } = setupLayout();
		runFrames();
		expect(observers[0].observed).toEqual(rows);
		observers[0].fire();
		observers[0].fire();
		observers[0].fire();
		expect(frames.size).toBe(1);
		runFrames();
		expect(measures()).toBe(2);
	});

	it("never measures while the target is hidden, and measures again once it shows", () => {
		const { target, measures } = setupLayout({ shown: false });
		runFrames();
		observers[0].fire();
		runFrames();
		expect(measures()).toBe(0);
		target.shown = true;
		observers[0].fire();
		runFrames();
		expect(measures()).toBe(1);
	});

	it("disconnects and drops a pending measure on teardown", () => {
		const { stop, measures } = setupLayout();
		stop();
		expect(observers[0].disconnected).toBe(true);
		runFrames();
		expect(measures()).toBe(0);
	});
});

describe("watchSize", () => {
	beforeEach(stubGlobals);
	afterEach(() => vi.unstubAllGlobals());

	it("keeps the last real size through the 0 a hidden element reads", () => {
		const el = { size: 320 };
		const sizes: number[] = [];
		const stop = watchSize(el as unknown as Element, () => el.size, (s) => sizes.push(s));
		observers[0].fire();
		el.size = 0;
		observers[0].fire();
		el.size = 400;
		observers[0].fire();
		expect(sizes).toEqual([320, 400]);
		stop();
		expect(observers[0].disconnected).toBe(true);
	});
});

describe("nextFrame", () => {
	beforeEach(stubGlobals);
	afterEach(() => vi.unstubAllGlobals());

	it("resolves on a frame of the element's own window", async () => {
		let done = false;
		const wait = nextFrame({ ownerDocument } as unknown as Element).then(() => (done = true));
		await Promise.resolve();
		expect(done).toBe(false);
		runFrames();
		await wait;
		expect(done).toBe(true);
	});
});
