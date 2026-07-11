import { describe, expect, it } from "vitest";
import { resolveGenerationScope } from "./generationScope";

describe("resolveGenerationScope", () => {
	it("resolves a single generation to its own range", () => {
		const scope = resolveGenerationScope([1]);
		expect(scope.fetchRange).toEqual({ start: 1, end: 151 });
	});

	it("resolves multiple contiguous generations to a spanning range", () => {
		const scope = resolveGenerationScope([1, 2, 3]);
		expect(scope.fetchRange).toEqual({ start: 1, end: 386 });
	});

	it("spans the gap when a middle generation is excluded", () => {
		const scope = resolveGenerationScope([1, 3]);
		expect(scope.fetchRange).toEqual({ start: 1, end: 386 });
	});

	it("includes() only matches ids within the enabled generations, even inside the fetch range", () => {
		const scope = resolveGenerationScope([1, 3]);

		expect(scope.includes(1)).toBe(true); // Gen 1 start
		expect(scope.includes(151)).toBe(true); // Gen 1 end
		expect(scope.includes(200)).toBe(false); // inside fetch range, but Gen 2 (excluded)
		expect(scope.includes(252)).toBe(true); // Gen 3 start
		expect(scope.includes(386)).toBe(true); // Gen 3 end
	});
});
