import { describe, expect, it } from "vitest";
import { createFakeDataAdapter, FakePokeApiClient } from "../data/__fixtures__/fakes";
import { DiskCache } from "../data/Cache";
import { PokedexRepository } from "../data/PokedexRepository";
import type { RawPokemon } from "../data/types";
import bulbasaur from "../data/__fixtures__/bulbasaur.json";
import { VarietyToggleState } from "./VarietyToggleState";

function makeState() {
	const client = new FakePokeApiClient();
	const cache = DiskCache.forTest(createFakeDataAdapter(), "cache");
	const repository = new PokedexRepository(client, cache);
	return { client, repository, toggle: new VarietyToggleState(repository) };
}

function tick(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("VarietyToggleState", () => {
	it("selectMega sets activeMegaKey and clears an active Gigantamax selection", () => {
		const { client, toggle } = makeState();
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });
		toggle.selectGigantamax("charizard-gmax");

		toggle.selectMega("charizard-mega-x");

		expect(toggle.activeMegaKey).toBe("charizard-mega-x");
		expect(toggle.activeGigantamaxKey).toBeNull();
	});

	it("selectGigantamax sets activeGigantamaxKey and clears an active Mega selection", () => {
		const { client, toggle } = makeState();
		client.variantPokemon.set("charizard-gmax", { ...(bulbasaur as unknown as RawPokemon) });
		toggle.selectMega("charizard-mega-x");

		toggle.selectGigantamax("charizard-gmax");

		expect(toggle.activeGigantamaxKey).toBe("charizard-gmax");
		expect(toggle.activeMegaKey).toBeNull();
	});

	it("selecting null clears the selection without calling the repository", () => {
		const { client, toggle } = makeState();

		toggle.selectMega(null);
		toggle.selectGigantamax(null);

		expect(toggle.activeMegaKey).toBeNull();
		expect(toggle.activeGigantamaxKey).toBeNull();
		expect(client.fetchPokemon).not.toHaveBeenCalled();
	});

	it("selecting a key already in the cache skips the repository call", async () => {
		const { client, toggle } = makeState();
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });
		toggle.selectMega("charizard-mega-x");
		await tick();
		expect(client.fetchPokemon).toHaveBeenCalledTimes(1);

		toggle.selectMega(null);
		toggle.selectMega("charizard-mega-x");
		await tick();

		expect(client.fetchPokemon).toHaveBeenCalledTimes(1);
	});

	it("selecting a new key fetches, fills the cache, and fires onUpdate for the sync selection and the async cache-fill", async () => {
		const { client, toggle } = makeState();
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });
		const updates: number[] = [];

		toggle.selectMega("charizard-mega-x", () => updates.push(Object.keys(toggle.megaFormCache).length));
		expect(updates).toEqual([0]);

		await tick();

		expect(updates).toEqual([0, 1]);
		expect(toggle.megaFormCache["charizard-mega-x"]).toBeDefined();
	});

	it("a rejected fetch is swallowed: no unhandled rejection, cache stays empty, key stays selected", async () => {
		const { toggle } = makeState();

		toggle.selectMega("charizard-mega-x");
		await tick();

		expect(toggle.activeMegaKey).toBe("charizard-mega-x");
		expect(toggle.megaFormCache["charizard-mega-x"]).toBeUndefined();
	});

	it("resetSelection clears both keys but leaves both caches untouched", async () => {
		const { client, toggle } = makeState();
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });
		toggle.selectMega("charizard-mega-x");
		await tick();
		expect(toggle.megaFormCache["charizard-mega-x"]).toBeDefined();

		toggle.resetSelection();

		expect(toggle.activeMegaKey).toBeNull();
		expect(toggle.activeGigantamaxKey).toBeNull();
		expect(toggle.megaFormCache["charizard-mega-x"]).toBeDefined();
	});
});
