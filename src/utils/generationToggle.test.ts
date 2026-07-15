import { describe, expect, it } from "vitest";
import { resolveGenerationToggle } from "./generationToggle";

describe("resolveGenerationToggle", () => {
	it("adds a generation to the enabled set", () => {
		const result = resolveGenerationToggle([1], 2, true);
		expect(result).toEqual({ allowed: true, enabled: [1, 2] });
	});

	it("removes a generation when more than one is enabled", () => {
		const result = resolveGenerationToggle([1, 2, 3], 2, false);
		expect(result).toEqual({ allowed: true, enabled: [1, 3] });
	});

	it("rejects disabling the last remaining enabled generation", () => {
		const result = resolveGenerationToggle([2], 2, false);
		expect(result).toEqual({ allowed: false });
	});

	it("sorts the resulting enabled list ascending", () => {
		const result = resolveGenerationToggle([3, 1], 2, true);
		expect(result).toEqual({ allowed: true, enabled: [1, 2, 3] });
	});
});
