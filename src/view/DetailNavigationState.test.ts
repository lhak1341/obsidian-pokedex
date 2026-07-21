import { describe, expect, it } from "vitest";
import { DetailNavigationState } from "./DetailNavigationState";

describe("DetailNavigationState", () => {
	it("opens detail from the table, saving scroll and starting a fresh chain", () => {
		const nav = new DetailNavigationState();
		const instruction = nav.openDetail(1, 42);
		expect(instruction).toEqual({ kind: "reset" });
		expect(nav.screen).toBe("detail");
		expect(nav.selectedId).toBe(1);
		expect(nav.history).toEqual([1]);
		expect(nav.historyIndex).toBe(0);
	});

	it("opens detail from inside detail without touching the saved table scroll", () => {
		const nav = new DetailNavigationState();
		nav.openDetail(1, 42);
		nav.openDetail(2, 999); // e.g. clicking an evolution card
		expect(nav.history).toEqual([1, 2]);
		expect(nav.backToTable()).toEqual({ kind: "restore", top: 42 });
	});

	it("steps back within the history stack", () => {
		const nav = new DetailNavigationState();
		nav.openDetail(1, 0);
		nav.openDetail(2, 0);
		const instruction = nav.goBack();
		expect(instruction).toEqual({ kind: "reset" });
		expect(nav.selectedId).toBe(1);
		expect(nav.screen).toBe("detail");
	});

	it("exits to the table when stepping back past the oldest entry", () => {
		const nav = new DetailNavigationState();
		nav.openDetail(1, 7);
		const instruction = nav.goBack();
		expect(instruction).toEqual({ kind: "restore", top: 7 });
		expect(nav.screen).toBe("table");
	});

	it("does nothing stepping back from the table with no history", () => {
		const nav = new DetailNavigationState();
		expect(nav.goBack()).toEqual({ kind: "none" });
		expect(nav.screen).toBe("table");
	});

	it("steps forward re-entering detail from the table", () => {
		const nav = new DetailNavigationState();
		nav.openDetail(1, 0);
		nav.goBack();
		const instruction = nav.goForward();
		expect(instruction).toEqual({ kind: "reset" });
		expect(nav.screen).toBe("detail");
		expect(nav.selectedId).toBe(1);
	});

	it("does nothing stepping forward at the end of the stack", () => {
		const nav = new DetailNavigationState();
		nav.openDetail(1, 0);
		expect(nav.goForward()).toEqual({ kind: "none" });
	});

	it("returns the saved table scroll position when explicitly returning to the table", () => {
		const nav = new DetailNavigationState();
		nav.openDetail(1, 55);
		expect(nav.backToTable()).toEqual({ kind: "restore", top: 55 });
		expect(nav.screen).toBe("table");
	});
});
