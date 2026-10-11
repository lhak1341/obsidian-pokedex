import { describe, expect, it } from "vitest";
import { imagePath, pokemonPath, speciesPath } from "./cachePaths";

describe("cachePaths", () => {
	it("builds a pokemon path from a numeric id", () => {
		expect(pokemonPath(4)).toBe("pokemon/4.json");
	});

	it("builds a pokemon path from a variety name", () => {
		expect(pokemonPath("rattata-alola")).toBe("pokemon/rattata-alola.json");
	});

	it("builds a species path", () => {
		expect(speciesPath(19)).toBe("species/19.json");
	});

	it("builds an image path for each suffix", () => {
		expect(imagePath(4, "sprite")).toBe("images/4-sprite.png");
		expect(imagePath(4, "artwork")).toBe("images/4-artwork.png");
		expect(imagePath(4, "shiny")).toBe("images/4-shiny.png");
		expect(imagePath(4, "shiny-artwork")).toBe("images/4-shiny-artwork.png");
	});

	it("builds an image path from a variety name", () => {
		expect(imagePath("charizard-mega-x", "artwork")).toBe("images/charizard-mega-x-artwork.png");
	});
});
