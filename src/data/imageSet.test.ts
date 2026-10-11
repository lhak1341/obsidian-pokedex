import { describe, expect, it } from "vitest";
import bulbasaur from "./__fixtures__/bulbasaur.json";
import { ALL_IMAGE_SUFFIXES, imageRequests } from "./imageSet";
import type { RawPokemon } from "./types";

const sprites = (bulbasaur as unknown as RawPokemon).sprites;

describe("imageSet", () => {
	it("ALL_IMAGE_SUFFIXES lists every suffix in the table", () => {
		expect([...ALL_IMAGE_SUFFIXES].sort()).toEqual(["artwork", "shiny", "shiny-artwork", "sprite"]);
	});

	it("maps each suffix to its sprites field, bundle field and cache path", () => {
		const byField = Object.fromEntries(imageRequests(1, sprites).map((r) => [r.field, r]));
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
		expect(urls.filter((u) => u === null)).toHaveLength(2);
	});
});
