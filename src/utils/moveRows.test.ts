import { describe, expect, it } from "vitest";
import type { MoveEntry } from "../data/types";
import { buildMoveRows, resolveMoveView, type MoveRow } from "./moveRows";

function learned(name: string, learnMethod: string, versionGroup: string, levelLearnedAt = 0): MoveEntry {
	return { name, levelLearnedAt, learnMethod, versionGroup };
}

function labels(rows: MoveRow[]): string[] {
	return rows.map((r) => (r.kind === "divider" ? `divider-${r.level}` : r.move.name));
}

function move(name: string, levelLearnedAt: number): MoveEntry {
	return { name, levelLearnedAt, learnMethod: "level-up", versionGroup: "firered-leafgreen" };
}

describe("buildMoveRows", () => {
	const moves = [move("tackle", 1), move("growl", 3), move("vine-whip", 13), move("razor-leaf", 20)];

	it("returns plain move rows when evolvesAtLevels is empty", () => {
		const rows = buildMoveRows(moves, [], true);
		expect(rows.every((r) => r.kind === "move")).toBe(true);
		expect(rows).toHaveLength(4);
	});

	it("returns plain move rows on a non-level-up tab even when evolvesAtLevels is set", () => {
		const rows = buildMoveRows(moves, [16], false);
		expect(rows.every((r) => r.kind === "move")).toBe(true);
	});

	it("inserts a divider before the first move past the level", () => {
		const rows = buildMoveRows(moves, [16], true);
		expect(rows.map((r) => (r.kind === "divider" ? `divider-${r.level}` : r.move.name))).toEqual([
			"tackle",
			"growl",
			"vine-whip",
			"divider-16",
			"razor-leaf",
		]);
	});

	it("inserts multiple dividers for multiple levels", () => {
		const rows = buildMoveRows(moves, [2, 16], true);
		expect(rows.map((r) => (r.kind === "divider" ? `divider-${r.level}` : r.move.name))).toEqual([
			"tackle",
			"divider-2",
			"growl",
			"vine-whip",
			"divider-16",
			"razor-leaf",
		]);
	});

	it("appends a trailing divider for a level past every move's levelLearnedAt", () => {
		const rows = buildMoveRows(moves, [99], true);
		expect(rows[rows.length - 1]).toEqual({ kind: "divider", level: 99 });
	});

	it("skips divider rows when numbering moveIndex, preserving the shading invariant", () => {
		const rows = buildMoveRows(moves, [2, 16], true);
		const moveIndexes = rows.filter((r) => r.kind === "move").map((r) => (r.kind === "move" ? r.moveIndex : -1));
		expect(moveIndexes).toEqual([0, 1, 2, 3]);
	});
});

// Each case runs the whole chain MoveBrowser renders: version tabs →
// that game's methods → remembered-or-first method → rows.
describe("resolveMoveView", () => {
	const remembered = { version: "scarlet-violet", method: "level-up" };

	it("opens a Champions movepool (every move under Train) on Train, not an empty Level-Up", () => {
		const moves = [learned("protect", "train", "champions"), learned("tackle", "train", "champions")];
		const view = resolveMoveView(moves, 9, remembered, []);
		expect(view.version).toBe("champions");
		expect(view.methodTabs.map((t) => t.key)).toEqual(["train"]);
		expect(view.method).toBe("train");
		expect(labels(view.rows)).toEqual(["protect", "tackle"]);
	});

	it("keeps a remembered method across a version switch when the new game has it", () => {
		const moves = [
			learned("tackle", "level-up", "scarlet-violet", 1),
			learned("protect", "machine", "scarlet-violet"),
			learned("growl", "level-up", "legends-za", 1),
			learned("rest", "machine", "legends-za"),
		];
		const sv = resolveMoveView(moves, 9, { version: "scarlet-violet", method: "machine" }, []);
		const za = resolveMoveView(moves, 9, { version: "legends-za", method: "machine" }, []);
		expect([sv.method, labels(sv.rows)]).toEqual(["machine", ["protect"]]);
		expect([za.version, za.method, labels(za.rows)]).toEqual(["legends-za", "machine", ["rest"]]);
	});

	it("shows the first method when the game lacks the remembered one, and shows it again where it exists", () => {
		const moves = [
			learned("growl", "reminder", "legends-za"),
			learned("tackle", "level-up", "legends-za", 1),
			learned("rest", "machine", "scarlet-violet"),
		];
		const za = resolveMoveView(moves, 9, { version: "legends-za", method: "machine" }, []);
		expect(za.methodTabs.map((t) => t.key)).toEqual(["level-up", "reminder"]);
		expect(za.method).toBe("level-up");
		// The same remembered method, unchanged by the fallback above.
		const sv = resolveMoveView(moves, 9, { version: "scarlet-violet", method: "machine" }, []);
		expect(sv.method).toBe("machine");
	});

	it("falls back to another generation's tabs and names it as shownGen when the Active Gen has no moves", () => {
		const moves = [learned("pound", "level-up", "diamond-pearl", 1), learned("pound", "level-up", "platinum", 1)];
		const view = resolveMoveView(moves, 3, { version: "firered-leafgreen", method: "level-up" }, []);
		expect(view.shownGen).toBe(4);
		expect(view.versionTabs.map((t) => t.key)).toEqual(["diamond-pearl", "platinum"]);
		expect(view.version).toBe("diamond-pearl");
	});

	it("draws evolution dividers on Level-Up only", () => {
		const moves = [
			learned("tackle", "level-up", "scarlet-violet", 1),
			learned("vine-whip", "level-up", "scarlet-violet", 20),
			learned("protect", "machine", "scarlet-violet"),
		];
		const levelUp = resolveMoveView(moves, 9, { version: "scarlet-violet", method: "level-up" }, [16]);
		const machine = resolveMoveView(moves, 9, { version: "scarlet-violet", method: "machine" }, [16]);
		expect(labels(levelUp.rows)).toEqual(["tackle", "divider-16", "vine-whip"]);
		expect(labels(machine.rows)).toEqual(["protect"]);
	});

	it("resolves an empty movepool to no tabs, no method and no rows, not even an evolution divider", () => {
		const view = resolveMoveView([], 9, remembered, [16]);
		expect(view.versionTabs).toEqual([]);
		expect(view.version).toBeNull();
		expect(view.methodTabs).toEqual([]);
		expect(view.method).toBeNull();
		expect(view.rows).toEqual([]);
		expect(view.shownGen).toBe(9);
	});

	it("shows the game's tab but no method or rows when it teaches only by an unlisted method", () => {
		const moves = [learned("volt-tackle", "light-ball-egg", "scarlet-violet")];
		const view = resolveMoveView(moves, 9, remembered, [16]);
		expect(view.version).toBe("scarlet-violet");
		expect([view.methodTabs, view.method, view.rows]).toEqual([[], null, []]);
	});
});
