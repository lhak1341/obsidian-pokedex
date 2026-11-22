import { describe, expect, it } from "vitest";
import { arcDasharray, RING_CIRCUMFERENCE, ringFill } from "./ring";

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

describe("arcDasharray", () => {
	const C = RING_CIRCUMFERENCE;

	it("draws a fill from 12 o'clock with no leading zero-length dash", () => {
		expect(arcDasharray(0, ringFill(60, 120))).toBe(`${0.5 * C} ${C}`);
	});

	it("splits an 87.5/12.5 gender ratio into two arcs that meet", () => {
		expect(arcDasharray(0, 0.875)).toBe(`${0.875 * C} ${C}`);
		expect(arcDasharray(0.875, 0.125)).toBe(`0 ${0.875 * C} ${0.125 * C} ${C}`);
	});

	it("starts an all-female ring at 12 o'clock and draws no male arc", () => {
		expect(arcDasharray(0, 0)).toBeNull();
		expect(arcDasharray(0, 1)).toBe(`${C} ${C}`);
	});

	it("draws nothing for an empty arc", () => {
		expect(arcDasharray(0.4, 0)).toBeNull();
	});

	it("clamps an arc to the circle", () => {
		expect(arcDasharray(0, 1.5)).toBe(`${C} ${C}`);
		expect(arcDasharray(0.75, 0.5)).toBe(`0 ${0.75 * C} ${0.25 * C} ${C}`);
		expect(arcDasharray(-1, 0.25)).toBe(`${0.25 * C} ${C}`);
	});
});
