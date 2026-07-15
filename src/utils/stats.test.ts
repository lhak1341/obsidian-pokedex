import { describe, expect, it } from "vitest";
import { resolveStatsForGen, totalStat } from "./stats";

describe("totalStat", () => {
	it("sums all six base stats", () => {
		expect(totalStat({ hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 })).toBe(318);
	});
});

describe("resolveStatsForGen", () => {
	// Butterfree (#12): current specialAttack 90, pre-Gen 6 was 80.
	const butterfreeCurrent = { hp: 60, attack: 45, defense: 50, specialAttack: 90, specialDefense: 80, speed: 70 };

	it("overlays the pre-buff value when the active gen predates the buff", () => {
		expect(resolveStatsForGen(butterfreeCurrent, 12, 3)).toEqual({ ...butterfreeCurrent, specialAttack: 80 });
	});

	it("returns current stats unchanged once the active gen reaches the buff generation", () => {
		expect(resolveStatsForGen(butterfreeCurrent, 12, 6)).toEqual(butterfreeCurrent);
	});

	it("returns current stats unchanged for a species with no override entry", () => {
		const bulbasaurCurrent = { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 };
		expect(resolveStatsForGen(bulbasaurCurrent, 1, 3)).toEqual(bulbasaurCurrent);
	});
});
