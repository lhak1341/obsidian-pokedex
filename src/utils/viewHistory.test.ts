import { describe, expect, it } from "vitest";
import { pushHistory, stepBack, stepForward } from "./viewHistory";

describe("pushHistory", () => {
	it("appends to an empty history from detail", () => {
		expect(pushHistory([], -1, 1, "detail")).toEqual({ history: [1], historyIndex: 0 });
	});

	it("appends when already at the end, from detail", () => {
		expect(pushHistory([1, 2], 1, 3, "detail")).toEqual({ history: [1, 2, 3], historyIndex: 2 });
	});

	it("truncates forward entries on a fresh navigation from the middle, from detail", () => {
		expect(pushHistory([1, 2, 3, 4], 1, 9, "detail")).toEqual({ history: [1, 2, 9], historyIndex: 2 });
	});

	it("starts a fresh chain when opened from the table, discarding any leftover stack", () => {
		expect(pushHistory([1, 2, 3], 1, 9, "table")).toEqual({ history: [9], historyIndex: 0 });
	});

	it("starts a fresh chain from the table even with empty leftover history", () => {
		expect(pushHistory([], -1, 1, "table")).toEqual({ history: [1], historyIndex: 0 });
	});
});

describe("stepBack", () => {
	it("steps to the previous entry from the middle of the stack", () => {
		expect(stepBack([1, 2, 3], 2, "detail")).toEqual({ action: "select", historyIndex: 1, id: 2 });
	});

	it("exits to the table when run out of history while in detail", () => {
		expect(stepBack([1, 2], 0, "detail")).toEqual({ action: "exitToTable" });
		expect(stepBack([], -1, "detail")).toEqual({ action: "exitToTable" });
	});

	it("does nothing when run out of history while already on the table", () => {
		expect(stepBack([1, 2], 0, "table")).toEqual({ action: "none" });
		expect(stepBack([], -1, "table")).toEqual({ action: "none" });
	});

	it("re-enters detail from the table when history is still available (fixed asymmetry)", () => {
		expect(stepBack([1, 2, 3], 2, "table")).toEqual({ action: "select", historyIndex: 1, id: 2 });
	});
});

describe("stepForward", () => {
	it("steps to the next entry from the middle of the stack", () => {
		expect(stepForward([1, 2, 3], 0, "detail")).toEqual({ action: "select", historyIndex: 1, id: 2 });
	});

	it("does nothing at the end of the stack while in detail", () => {
		expect(stepForward([1, 2], 1, "detail")).toEqual({ action: "none" });
	});

	it("re-enters detail from the table at the current index", () => {
		expect(stepForward([1, 2, 3], 1, "table")).toEqual({ action: "select", historyIndex: 1, id: 2 });
	});

	it("does nothing from the table with no history to re-enter", () => {
		expect(stepForward([], -1, "table")).toEqual({ action: "none" });
		expect(stepForward([1, 2], 2, "table")).toEqual({ action: "none" });
	});
});
