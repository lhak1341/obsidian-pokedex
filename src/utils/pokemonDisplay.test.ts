import { describe, expect, it } from "vitest";
import { formatDexNumber, formatHeight, formatItemName, formatPokemonDisplayName, formatWeight } from "./pokemonDisplay";

describe("formatDexNumber", () => {
	it("zero-pads to three digits", () => {
		expect(formatDexNumber(7)).toBe("007");
		expect(formatDexNumber(25)).toBe("025");
		expect(formatDexNumber(150)).toBe("150");
	});

	it("leaves a number longer than three digits whole", () => {
		expect(formatDexNumber(1025)).toBe("1025");
	});
});

describe("formatHeight / formatWeight", () => {
	it("converts decimeters to meters and hectograms to kilograms, one decimal", () => {
		expect(formatHeight(7)).toBe("0.7 m");
		expect(formatWeight(690)).toBe("69.0 kg");
	});

	it("rounds to one decimal", () => {
		expect(formatHeight(17)).toBe("1.7 m");
		expect(formatWeight(1234)).toBe("123.4 kg");
	});
});

describe("formatItemName", () => {
	it("capitalizes each hyphenated word", () => {
		expect(formatItemName("oran-berry")).toBe("Oran Berry");
		expect(formatItemName("leftovers")).toBe("Leftovers");
	});
});

describe("formatPokemonDisplayName", () => {
	it("composes the form label ahead of the base name", () => {
		expect(formatPokemonDisplayName({ name: "rattata", formLabel: "Alolan" })).toBe("Alolan rattata");
		expect(formatPokemonDisplayName({ name: "rattata", formLabel: null })).toBe("rattata");
	});
});
