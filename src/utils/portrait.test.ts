import { describe, expect, it, vi } from "vitest";
import type { PortraitImageSource } from "../data/types";
import { resolvePortrait, resolvePortraitScale } from "./portrait";

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

describe("resolvePortraitScale", () => {
	const fills: Record<string, number> = { base: 0.5, tight: 0.75, loose: 0.4, empty: 0 };
	const measure = vi.fn((uri: string) => Promise.resolve(fills[uri] ?? 1));
	const call = (overrides: Partial<Parameters<typeof resolvePortraitScale>[0]> = {}) =>
		resolvePortraitScale({ style: "official-artwork", baseUri: "base", currentUri: "tight", measure, ...overrides });

	it("is 1 without measuring for a non-artwork style", async () => {
		measure.mockClear();
		expect(await call({ style: "sprite" })).toBe(1);
		expect(measure).not.toHaveBeenCalled();
	});

	it("is 1 when either uri is missing", async () => {
		expect(await call({ baseUri: null })).toBe(1);
		expect(await call({ currentUri: null })).toBe(1);
	});

	it("is 1 without measuring when the current render is the base render", async () => {
		measure.mockClear();
		expect(await call({ currentUri: "base" })).toBe(1);
		expect(measure).not.toHaveBeenCalled();
	});

	it("shrinks a render that fills more of its canvas than the base", async () => {
		expect(await call({ currentUri: "tight" })).toBeCloseTo(0.5 / 0.75);
	});

	it("never enlarges a render that fills less of its canvas than the base", async () => {
		expect(await call({ currentUri: "loose" })).toBe(1);
	});

	it("is null (keep the previous scale) when the current render measures as empty", async () => {
		expect(await call({ currentUri: "empty" })).toBeNull();
	});

	it("propagates a failed measurement", async () => {
		const failing = () => Promise.reject(new Error("image decode failed"));
		await expect(call({ measure: failing })).rejects.toThrow("image decode failed");
	});
});
