import { describe, expect, it } from "vitest";
import type { MoveEntry } from "../data/types";
import { buildMoveRows } from "./moveRows";

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
