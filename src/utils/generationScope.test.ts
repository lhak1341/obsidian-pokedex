import { describe, expect, it } from "vitest";
import { resolveGenerationScope } from "./generationScope";
import { makeRow } from "../data/__fixtures__/rows";

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

	it("includes() matches a row by its own generationId, even inside a disabled gap within the fetch range", () => {
		const scope = resolveGenerationScope([1, 3]);

		expect(scope.includes(makeRow({ dexNumber: 1, generationId: 1 }))).toBe(true); // Gen 1 start
		expect(scope.includes(makeRow({ dexNumber: 151, generationId: 1 }))).toBe(true); // Gen 1 end
		expect(scope.includes(makeRow({ dexNumber: 200, generationId: 2 }))).toBe(false); // inside fetch range, but Gen 2 (excluded)
		expect(scope.includes(makeRow({ dexNumber: 252, generationId: 3 }))).toBe(true); // Gen 3 start
		expect(scope.includes(makeRow({ dexNumber: 386, generationId: 3 }))).toBe(true); // Gen 3 end
	});

	// The actual bug this row-based (not bare-id) signature exists to fix:
	// a regional-form row's own numeric `id` (a PokeAPI variety pseudo-id
	// like 10091) falls nowhere near any real dex-number range — `includes`
	// must key off generationId, not re-derive membership from id/dexNumber
	// range math, or every regional-form row gets silently dropped.
	it("includes() matches a regional-form row by its own generationId, ignoring its unrelated id/dexNumber", () => {
		const scope = resolveGenerationScope([7]);
		const alolanRattata = makeRow({ id: 10091, dexNumber: 19, formLabel: "Alolan", generationId: 7 });

		expect(scope.includes(alolanRattata)).toBe(true);
		expect(resolveGenerationScope([1]).includes(alolanRattata)).toBe(false);
	});

	// A failed fetch is a bare base dex number with no row behind it, so
	// includesFailedId checks the dex range directly (ADR-0001) — still
	// honoring a disabled generation sitting inside the fetch range's gap.
	it("includesFailedId() checks a bare dex number against the enabled generations' ranges", () => {
		const scope = resolveGenerationScope([1, 3]);

		expect(scope.includesFailedId(25)).toBe(true); // Gen 1
		expect(scope.includesFailedId(200)).toBe(false); // inside fetch range, but Gen 2 (excluded)
		expect(scope.includesFailedId(300)).toBe(true); // Gen 3
		expect(scope.includesFailedId(400)).toBe(false); // beyond every enabled generation
	});
});
