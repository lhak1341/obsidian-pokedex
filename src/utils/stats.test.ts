import { describe, expect, it } from "vitest";
import { totalStat } from "./stats";

describe("totalStat", () => {
	it("sums all six base stats", () => {
		expect(totalStat({ hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 })).toBe(318);
	});
});
