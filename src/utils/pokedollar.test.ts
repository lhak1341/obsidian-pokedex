import { describe, expect, it } from "vitest";
import { formatPokedollarSigns } from "./pokedollar";

describe("formatPokedollarSigns", () => {
	it("moves the symbol in front of an amount (Nugget's real short_effect)", () => {
		expect(formatPokedollarSigns("Sell for 5000 Pokédollars, or to Ore Collector for 10000 Pokédollars."))
			.toBe("Sell for ₱5000, or to Ore Collector for ₱10000.");
	});

	it("matches the plain-ASCII spelling too, not just the accented one", () => {
		expect(formatPokedollarSigns("Sell for 250 Pokedollars.")).toBe("Sell for ₱250.");
	});

	it("matches a singular mention with no trailing 's'", () => {
		expect(formatPokedollarSigns("Worth 1 Pokédollar.")).toBe("Worth ₱1.");
	});

	it("falls back to a bare symbol when no number is adjacent", () => {
		expect(formatPokedollarSigns("Paid in Pokédollars.")).toBe("Paid in ₱.");
	});

	it("leaves unrelated text untouched", () => {
		expect(formatPokedollarSigns("Tries to catch a wild Pokémon.")).toBe("Tries to catch a wild Pokémon.");
	});
});
