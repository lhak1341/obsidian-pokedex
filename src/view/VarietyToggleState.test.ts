import { describe, expect, it, vi } from "vitest";
import { FakePokeApiClient, MemoryCacheStore, RecordingObjectUrls } from "../data/__fixtures__/fakes";
import { PokedexRepository } from "../data/PokedexRepository";
import type { RawPokemon } from "../data/types";
import bulbasaur from "../data/__fixtures__/bulbasaur.json";
import { VarietyToggleState } from "./VarietyToggleState";

function makeState(imageBudgetBytes?: number) {
	const client = new FakePokeApiClient();
	const cache = new MemoryCacheStore();
	const objectUrls = new RecordingObjectUrls();
	const repository = new PokedexRepository(client, cache, { objectUrls, imageBudgetBytes });
	return { client, objectUrls, repository, toggle: new VarietyToggleState(repository) };
}

function tick(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("VarietyToggleState", () => {
	it("selectMega sets activeMegaKey and clears an active Gigantamax selection", () => {
		const { client, toggle } = makeState();
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });
		toggle.selectGigantamax("charizard-gmax", "official-artwork");

		toggle.selectMega("charizard-mega-x", "official-artwork");

		expect(toggle.activeMegaKey).toBe("charizard-mega-x");
		expect(toggle.activeGigantamaxKey).toBeNull();
	});

	it("selectGigantamax sets activeGigantamaxKey and clears an active Mega selection", () => {
		const { client, toggle } = makeState();
		client.variantPokemon.set("charizard-gmax", { ...(bulbasaur as unknown as RawPokemon) });
		toggle.selectMega("charizard-mega-x", "official-artwork");

		toggle.selectGigantamax("charizard-gmax", "official-artwork");

		expect(toggle.activeGigantamaxKey).toBe("charizard-gmax");
		expect(toggle.activeMegaKey).toBeNull();
	});

	it("selecting null clears the selection without calling the repository", () => {
		const { client, toggle } = makeState();

		toggle.selectMega(null, "official-artwork");
		toggle.selectGigantamax(null, "official-artwork");

		expect(toggle.activeMegaKey).toBeNull();
		expect(toggle.activeGigantamaxKey).toBeNull();
		expect(client.fetchPokemon).not.toHaveBeenCalled();
	});

	it("re-selecting a cached form refreshes it from the repository without refetching, so an image the LRU evicted meanwhile comes back live", async () => {
		const { client, objectUrls, repository, toggle } = makeState(600);
		client.imageSize = 100;
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });
		client.variantPokemon.set("charizard-gmax", { ...(bulbasaur as unknown as RawPokemon) });
		toggle.selectMega("charizard-mega-x", "official-artwork");
		toggle.selectGigantamax("charizard-gmax", "official-artwork");
		await tick();
		await repository.getEntryExtras(2, "official-artwork");
		await repository.getEntryExtras(3, "official-artwork");

		toggle.selectMega("charizard-mega-x", "official-artwork");
		toggle.selectGigantamax("charizard-gmax", "official-artwork");
		await tick();

		expect(client.fetchPokemon).toHaveBeenCalledTimes(4);
		for (const detail of [toggle.megaFormCache["charizard-mega-x"], toggle.gigantamaxFormCache["charizard-gmax"]]) {
			expect(objectUrls.live.has(detail?.artworkDataUri ?? "")).toBe(true);
		}
	});

	it("selecting a new key fetches, fills the cache, and fires onUpdate for the sync selection and the async cache-fill", async () => {
		const { client, toggle } = makeState();
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });
		const updates: number[] = [];

		toggle.selectMega("charizard-mega-x", "official-artwork", () => updates.push(Object.keys(toggle.megaFormCache).length));
		expect(updates).toEqual([0]);

		await tick();

		expect(updates).toEqual([0, 1]);
		expect(toggle.megaFormCache["charizard-mega-x"]).toBeDefined();
	});

	it("a rejected fetch is swallowed: no unhandled rejection, cache stays empty, key stays selected", async () => {
		const { toggle } = makeState();

		toggle.selectMega("charizard-mega-x", "official-artwork");
		await tick();

		expect(toggle.activeMegaKey).toBe("charizard-mega-x");
		expect(toggle.megaFormCache["charizard-mega-x"]).toBeUndefined();
	});

	it("reselect() asks again for the selected form only, in the new render", async () => {
		const { client, repository, toggle } = makeState();
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });
		toggle.selectMega("charizard-mega-x", "official-artwork");
		await tick();
		expect(repository.imagePathOf(toggle.megaFormCache["charizard-mega-x"].artworkDataUri!)).toBe(
			"images/charizard-mega-x-artwork.png",
		);

		toggle.reselect("home");
		await tick();

		expect(repository.imagePathOf(toggle.megaFormCache["charizard-mega-x"].artworkDataUri!)).toBe(
			"images/charizard-mega-x-home.png",
		);
	});

	it("reselect() with nothing selected asks the repository for nothing", () => {
		const { repository, toggle } = makeState();
		const getMegaForm = vi.spyOn(repository, "getMegaForm");
		const getGigantamaxForm = vi.spyOn(repository, "getGigantamaxForm");
		toggle.reselect("home");
		expect(getMegaForm).not.toHaveBeenCalled();
		expect(getGigantamaxForm).not.toHaveBeenCalled();
	});

	// The race a render on the repository used to lose: the first select's
	// artwork answer landed after the switch's HOME one and overwrote it.
	it("a render switch while the selected form is in flight keeps the new render's form", async () => {
		const { client, repository, toggle } = makeState();
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });
		const getMegaForm = repository.getMegaForm.bind(repository);
		let release!: () => void;
		const held = new Promise<void>((resolve) => (release = resolve));
		vi.spyOn(repository, "getMegaForm").mockImplementation(async (key, render) => {
			const answer = getMegaForm(key, render);
			if (render === "official-artwork") await held;
			return answer;
		});

		toggle.selectMega("charizard-mega-x", "official-artwork");
		toggle.reselect("home");
		await tick();
		release();
		await tick();

		expect(repository.imagePathOf(toggle.megaFormCache["charizard-mega-x"].artworkDataUri!)).toBe(
			"images/charizard-mega-x-home.png",
		);
	});

	it("resetSelection clears both keys but leaves both caches untouched", async () => {
		const { client, toggle } = makeState();
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });
		toggle.selectMega("charizard-mega-x", "official-artwork");
		await tick();
		expect(toggle.megaFormCache["charizard-mega-x"]).toBeDefined();

		toggle.resetSelection();

		expect(toggle.activeMegaKey).toBeNull();
		expect(toggle.activeGigantamaxKey).toBeNull();
		expect(toggle.megaFormCache["charizard-mega-x"]).toBeDefined();
	});
});
