import { describe, expect, it } from "vitest";
import bulbasaur from "./__fixtures__/bulbasaur.json";
import { ALL_IMAGE_SUFFIXES, imageRequests, largeImageSuffixes, portraitRenderFor } from "./imageSet";
import type { RawPokemon } from "./types";

const sprites = (bulbasaur as unknown as RawPokemon).sprites;

describe("imageSet", () => {
	it("ALL_IMAGE_SUFFIXES lists every suffix in the table", () => {
		expect([...ALL_IMAGE_SUFFIXES].sort()).toEqual(["artwork", "home", "shiny", "shiny-artwork", "shiny-home", "sprite"]);
	});

	it("maps each suffix to its sprites field, bundle field and cache path", () => {
		const byField = Object.fromEntries(imageRequests(1, sprites, largeImageSuffixes("official-artwork").concat("sprite")).map((r) => [r.field, r]));
		expect(byField.sprite).toMatchObject({ url: sprites.front_default, relPath: "images/1-sprite.png" });
		expect(byField.shiny).toMatchObject({ url: sprites.front_shiny, relPath: "images/1-shiny.png" });
		expect(byField.artwork).toMatchObject({
			url: sprites.other?.["official-artwork"]?.front_default,
			relPath: "images/1-artwork.png",
		});
		expect(byField.shinyArtwork).toMatchObject({
			url: sprites.other?.["official-artwork"]?.front_shiny,
			relPath: "images/1-shiny-artwork.png",
		});
	});

	it("returns only the requested suffixes", () => {
		expect(imageRequests("charizard-mega-x", sprites, ["shiny"]).map((r) => r.relPath)).toEqual([
			"images/charizard-mega-x-shiny.png",
		]);
	});

	it("yields a null url when official-artwork is absent", () => {
		const bare = { ...sprites, other: undefined };
		const urls = imageRequests(1, bare).map((r) => r.url);
		expect(urls.filter((u) => u === null)).toHaveLength(4);
	});

	// HOME fills the artwork slots under its own paths, so a style switch never
	// reads the other render's file.
	const withHome = { ...sprites, other: { ...sprites.other, home: { front_default: "home.png", front_shiny: "home-shiny.png" } } };

	it("puts the HOME render in the large-portrait slots under its own cache paths", () => {
		const requests = imageRequests(1, withHome, largeImageSuffixes("home"));
		expect(requests.map((r) => [r.field, r.url, r.relPath])).toEqual([
			["artwork", "home.png", "images/1-home.png"],
			["shiny", sprites.front_shiny, "images/1-shiny.png"],
			["shinyArtwork", "home-shiny.png", "images/1-shiny-home.png"],
		]);
	});

	it("falls back to official artwork where a form has no HOME render", () => {
		const noHome = { ...sprites, other: { ...sprites.other, home: null } };
		expect(imageRequests(1, noHome, ["home", "shiny-home"]).map((r) => r.url)).toEqual([
			sprites.other?.["official-artwork"]?.front_default,
			sprites.other?.["official-artwork"]?.front_shiny,
		]);
	});

	it("reads the HOME render only for the HOME style; sprite style keeps artwork", () => {
		expect(portraitRenderFor("home")).toBe("home");
		expect(portraitRenderFor("official-artwork")).toBe("official-artwork");
		expect(portraitRenderFor("sprite")).toBe("official-artwork");
	});
});
