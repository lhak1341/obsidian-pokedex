import { describe, expect, it } from "vitest";
import { createFakeDataAdapter, FakePokeApiClient } from "../data/__fixtures__/fakes";
import { DiskCache } from "../data/Cache";
import { PokedexRepository } from "../data/PokedexRepository";
import type { RawPokemon } from "../data/types";
import bulbasaur from "../data/__fixtures__/bulbasaur.json";
import { DetailLoadState } from "./DetailLoadState";

function makeLoadState() {
	const client = new FakePokeApiClient();
	const cache = DiskCache.forTest(createFakeDataAdapter(), "cache");
	const repository = new PokedexRepository(client, cache);
	return { client, repository, loadState: new DetailLoadState(repository) };
}

function tick(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("DetailLoadState", () => {
	it("load() populates entry and flips loading off", async () => {
		const { loadState } = makeLoadState();
		expect(loadState.loading).toBe(true);

		await loadState.load(1);

		expect(loadState.loading).toBe(false);
		expect(loadState.entry?.id).toBe(1);
		expect(loadState.error).toBeNull();
	});

	it("load() merges evolution chain and sprites once extras resolve", async () => {
		const { loadState } = makeLoadState();

		await loadState.load(1);

		expect(loadState.entry?.evolutionChain?.name).toBe("bulbasaur");
		const chainIds = [1, loadState.entry!.evolutionChain!.children[0].id];
		for (const id of chainIds) expect(loadState.evolutionSprites[id]).not.toBeNull();
	});

	it("onMoveDetail fires per move as the movepool settles, mirrored into moveDetails", async () => {
		const { loadState } = makeLoadState();
		const seen: string[] = [];

		await loadState.load(1, undefined, (name) => seen.push(name));
		await tick();

		expect(seen.length).toBeGreaterThan(0);
		expect(loadState.moveDetails[seen[0]]).toBeDefined();
	});

	it("moveDetails is not reset by a later load() — accumulates across entries", async () => {
		const { loadState } = makeLoadState();

		await loadState.load(1);
		await tick();
		const afterFirst = Object.keys(loadState.moveDetails).length;
		expect(afterFirst).toBeGreaterThan(0);

		await loadState.load(1);
		await tick();

		expect(Object.keys(loadState.moveDetails).length).toBe(afterFirst);
	});

	it("records failure on error without touching entry, and a later load(id) can recover", async () => {
		const { client, loadState } = makeLoadState();
		client.failIds.add(1);

		await loadState.load(1);

		expect(loadState.error).not.toBeNull();
		expect(loadState.entry).toBeNull();
		expect(loadState.loading).toBe(false);

		client.failIds.delete(1);
		await loadState.load(1);

		expect(loadState.error).toBeNull();
		expect(loadState.entry?.id).toBe(1);
	});

	it("a later load(id) supersedes a still in-flight earlier one", async () => {
		const { client, loadState } = makeLoadState();
		let resolveFirst!: (pokemon: RawPokemon) => void;
		const pending = new Promise<RawPokemon>((resolve) => {
			resolveFirst = resolve;
		});
		client.fetchPokemon.mockImplementationOnce(() => pending);

		const firstLoad = loadState.load(1);
		const secondLoad = loadState.load(3);
		resolveFirst({ ...(bulbasaur as unknown as RawPokemon), id: 1 });
		await Promise.all([firstLoad, secondLoad]);

		expect(loadState.entry?.id).toBe(3);
	});

	it("load() leaves entry/loading untouched when cancelled beforehand", async () => {
		const { loadState } = makeLoadState();
		loadState.cancel();

		await loadState.load(1);

		expect(loadState.loading).toBe(true);
		expect(loadState.entry).toBeNull();
	});
});
