import { describe, expect, it } from "vitest";
import type { PortraitImageSource } from "../data/types";
import { resolvePortrait } from "./portrait";

const full: PortraitImageSource = {
	spriteDataUri: "sprite",
	artworkDataUri: "artwork",
	shinyDataUri: "shiny-sprite",
	shinyArtworkDataUri: "shiny-artwork",
};

describe("resolvePortrait", () => {
	it("uses artwork for official-artwork style, not shiny", () => {
		expect(resolvePortrait(full, "official-artwork", false)).toBe("artwork");
	});

	it("uses sprite for sprite style, not shiny", () => {
		expect(resolvePortrait(full, "sprite", false)).toBe("sprite");
	});

	it("falls back to sprite when artwork is missing", () => {
		const source = { ...full, artworkDataUri: null };
		expect(resolvePortrait(source, "official-artwork", false)).toBe("sprite");
	});

	it("uses shiny artwork for official-artwork style when shiny is on", () => {
		expect(resolvePortrait(full, "official-artwork", true)).toBe("shiny-artwork");
	});

	it("uses shiny sprite for sprite style when shiny is on", () => {
		expect(resolvePortrait(full, "sprite", true)).toBe("shiny-sprite");
	});

	it("falls back to shiny sprite when official-artwork style has no shiny artwork", () => {
		const source = { ...full, shinyArtworkDataUri: null };
		expect(resolvePortrait(source, "official-artwork", true)).toBe("shiny-sprite");
	});

	it("falls back to the base portrait when shiny is entirely missing", () => {
		const source = { ...full, shinyDataUri: null, shinyArtworkDataUri: null };
		expect(resolvePortrait(source, "official-artwork", true)).toBe("artwork");
		expect(resolvePortrait(source, "sprite", true)).toBe("sprite");
	});

	it("returns null when nothing is available at all", () => {
		const empty: PortraitImageSource = {
			spriteDataUri: null,
			artworkDataUri: null,
			shinyDataUri: null,
			shinyArtworkDataUri: null,
		};
		expect(resolvePortrait(empty, "official-artwork", false)).toBeNull();
		expect(resolvePortrait(empty, "official-artwork", true)).toBeNull();
	});
});
