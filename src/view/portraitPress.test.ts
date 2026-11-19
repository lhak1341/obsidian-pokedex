import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PORTRAIT_PRESS } from "../utils/pressHold";
import { mouse, pointer } from "./__fixtures__/fakeEvents";
import { createFakePressWatch } from "./__fixtures__/fakePressWatch";
import { createPortraitPress } from "./portraitPress";

// The binding reads `e.target instanceof Element` and `closest("button")`;
// node has no Element, so a stand-in answers whether the press is on a toggle.
class FakeElement {
	constructor(private readonly inButton: boolean) {}
	closest(): FakeElement | null {
		return this.inButton ? this : null;
	}
}

// The binding's wiring only: the press rules themselves are pressHold.test.ts.
function setup() {
	const fake = createFakePressWatch();
	const previews: boolean[] = [];
	const press = createPortraitPress((show) => previews.push(show), { watch: fake.watch });
	const last = () => previews[previews.length - 1];
	return { fake, press, props: press.props, last };
}

describe("portrait press binding", () => {
	beforeEach(() => vi.stubGlobal("Element", FakeElement));
	afterEach(() => vi.unstubAllGlobals());

	it("shows the art preview on a hold, and keeps watching for a scroll", () => {
		const { fake, props, last } = setup();
		props.onpointerdown(pointer(0, { target: new FakeElement(false) }));
		expect(fake.holdMs()).toBe(PORTRAIT_PRESS.holdMs);
		fake.fireTimer(PORTRAIT_PRESS.holdMs);
		expect(last()).toBe(true);
		expect(fake.isLive()).toBe(true);
	});

	it("ends the preview on a scroll during the hold, and swallows the tap after", () => {
		const { fake, props, last } = setup();
		props.onpointerdown(pointer(0, { target: new FakeElement(false) }));
		fake.fireTimer(PORTRAIT_PRESS.holdMs);
		fake.scroll();
		expect(last()).toBe(false);
		expect(fake.isLive()).toBe(false);
		const tap = mouse();
		props.onclickcapture(tap.e);
		expect([tap.prevent.mock.calls.length, tap.stop.mock.calls.length]).toEqual([1, 1]);
	});

	it("starts no watch for a press on a toggle", () => {
		const { fake, props } = setup();
		props.onpointerdown(pointer(0, { target: new FakeElement(true) }));
		expect(fake.isLive()).toBe(false);
	});

	it("prevents contextmenu only while a press is live", () => {
		const { props } = setup();
		const idle = mouse();
		props.oncontextmenu(idle.e);
		expect(idle.prevent).not.toHaveBeenCalled();
		props.onpointerdown(pointer(0, { target: new FakeElement(false) }));
		const pressing = mouse();
		props.oncontextmenu(pressing.e);
		expect(pressing.prevent).toHaveBeenCalled();
	});

	it("stops the watch on destroy", () => {
		const { fake, press, props, last } = setup();
		props.onpointerdown(pointer(0, { target: new FakeElement(false) }));
		press.destroy();
		fake.fireTimer(PORTRAIT_PRESS.holdMs);
		expect(fake.isLive()).toBe(false);
		expect(last()).toBe(false);
	});
});
