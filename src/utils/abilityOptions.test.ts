import { describe, expect, it } from "vitest";
import { filterAndOrderAbilityOptions } from "./abilityOptions";

describe("filterAndOrderAbilityOptions", () => {
	it("passes every option through unchanged when search is empty and nothing is selected", () => {
		expect(filterAndOrderAbilityOptions(["Overgrow", "Chlorophyll", "Blaze"], "", [])).toEqual([
			"Overgrow", "Chlorophyll", "Blaze",
		]);
	});

	it("narrows to a case-insensitive substring match", () => {
		expect(filterAndOrderAbilityOptions(["Overgrow", "Chlorophyll", "Blaze"], "OVER", [])).toEqual(["Overgrow"]);
	});

	it("bubbles a selected ability to the front, keeping the rest in their original relative order", () => {
		expect(filterAndOrderAbilityOptions(["Overgrow", "Chlorophyll", "Blaze"], "", ["Chlorophyll"])).toEqual([
			"Chlorophyll", "Overgrow", "Blaze",
		]);
	});

	it("excludes a selected ability that no longer matches the search text", () => {
		expect(filterAndOrderAbilityOptions(["Overgrow", "Chlorophyll", "Blaze"], "over", ["Chlorophyll"])).toEqual([
			"Overgrow",
		]);
	});
});
