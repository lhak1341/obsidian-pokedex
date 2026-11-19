import { describe, expect, it, vi } from "vitest";
import { MENU_PRESS } from "../utils/pressHold";
import { mouse, pointer } from "./__fixtures__/fakeEvents";
import { createFakePressWatch } from "./__fixtures__/fakePressWatch";
import { createFavoriteMenu, type OpenMenu } from "./favoriteMenu";

// The binding's wiring only: the press rules themselves are pressHold.test.ts.
function setup() {
	const fake = createFakePressWatch();
	const openMenu = vi.fn<OpenMenu>();
	const deps = { isFavorite: () => false, onToggle: () => {} };
	const menu = createFavoriteMenu(deps, { watch: fake.watch, openMenu });
	return { fake, openMenu, menu, deps, row: menu.target(7) };
}

describe("favourites menu binding", () => {
	it("opens at the press point on a hold, and stops the watch there", () => {
		const { fake, openMenu, row, deps } = setup();
		row.onpointerdown(pointer(0, { x: 40, y: 60 }));
		expect(fake.holdMs()).toBe(MENU_PRESS.holdMs);
		fake.fireTimer(MENU_PRESS.holdMs);
		expect(openMenu).toHaveBeenCalledWith(7, { at: "press", x: 40, y: 60, doc: fake.doc }, deps);
		expect(fake.isLive()).toBe(false);
	});

	it("starts no watch for a mouse press", () => {
		const { fake, row } = setup();
		row.onpointerdown(pointer(0, { pointerType: "mouse" }));
		expect(fake.isLive()).toBe(false);
	});

	it("opens at the event on a contextmenu mid-press, and swallows the lift's tap", () => {
		const { fake, openMenu, row, deps } = setup();
		row.onpointerdown(pointer(0));
		const ctx = mouse();
		row.oncontextmenu(ctx.e);
		expect(openMenu).toHaveBeenCalledWith(7, { at: "event", e: ctx.e }, deps);
		expect(ctx.stop).not.toHaveBeenCalled();
		// It counted as the hold, so the timer can't open the menu again.
		expect(fake.isLive()).toBe(false);
		row.onpointerup();
		const tap = mouse();
		row.onclickcapture(tap.e);
		expect([tap.prevent.mock.calls.length, tap.stop.mock.calls.length]).toEqual([1, 1]);
		const next = mouse();
		row.onclickcapture(next.e);
		expect(next.stop).not.toHaveBeenCalled();
		expect(openMenu).toHaveBeenCalledTimes(1);
	});

	it("prevents the browser's menu on every contextmenu, and swallows the one after a hold", () => {
		const { fake, openMenu, row } = setup();
		const rightClick = mouse();
		row.oncontextmenu(rightClick.e);
		expect(rightClick.prevent).toHaveBeenCalled();
		expect(openMenu).toHaveBeenCalledTimes(1);

		row.onpointerdown(pointer(1000));
		fake.fireTimer(1000 + MENU_PRESS.holdMs);
		const sameGesture = mouse();
		row.oncontextmenu(sameGesture.e);
		expect([sameGesture.prevent.mock.calls.length, sameGesture.stop.mock.calls.length]).toEqual([1, 1]);
		expect(openMenu).toHaveBeenCalledTimes(2);
	});

	it("opens nothing when destroyed mid-press", () => {
		const { fake, openMenu, menu, row } = setup();
		row.onpointerdown(pointer(0));
		menu.destroy();
		fake.fireTimer(MENU_PRESS.holdMs);
		expect(openMenu).not.toHaveBeenCalled();
	});
});
