import { describe, expect, it } from "vitest";
import { describePartialLoadOutcome, describeRetryOutcome } from "./loadNotices";

describe("describePartialLoadOutcome", () => {
	it("reports loaded and total counts", () => {
		expect(describePartialLoadOutcome(480, 13)).toBe(
			"Pokedex: showing 480 of 493 Pokemon; some entries couldn't be fetched (offline or PokeAPI unreachable).",
		);
	});
});

describe("describeRetryOutcome", () => {
	it("reports recovered vs still-unreachable counts when some retries still fail", () => {
		expect(describeRetryOutcome(13, 10, 3)).toBe(
			"Pokedex: 10 of 13 retried entries loaded; 3 still unreachable.",
		);
	});

	it("reports full success when nothing is still failing", () => {
		expect(describeRetryOutcome(13, 13, 0)).toBe("Pokedex: all entries loaded.");
	});
});
