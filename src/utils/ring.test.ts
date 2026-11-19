import { describe, expect, it } from "vitest";
import { ringFill } from "./ring";

describe("ringFill", () => {
	it("fills to value over max", () => {
		// Half of the 120 hatch-counter ceiling; Charizard's 45 catch rate.
		expect(ringFill(60, 120)).toBe(0.5);
		expect(ringFill(45, 255)).toBeCloseTo(0.1765, 4);
	});

	it("clamps to a full or empty ring", () => {
		expect(ringFill(300, 255)).toBe(1);
		expect(ringFill(-5, 120)).toBe(0);
	});

	it("draws an empty ring when there is no max", () => {
		expect(ringFill(10, 0)).toBe(0);
	});
});
