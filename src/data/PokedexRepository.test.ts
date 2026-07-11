import { describe, expect, it } from "vitest";
import { createFakeDataAdapter, FakePokeApiClient } from "./__fixtures__/fakes";
import { DiskCache } from "./Cache";
import { PokedexRepository } from "./PokedexRepository";

function makeRepository() {
	const client = new FakePokeApiClient();
	const cache = DiskCache.forTest(createFakeDataAdapter(), "cache");
	return { client, repository: new PokedexRepository(client, cache) };
}

describe("PokedexRepository", () => {
	it("fetches each entity once, then serves cache on repeat calls", async () => {
		const { client, repository } = makeRepository();

		await repository.getTableRows({ start: 1, end: 1 });
		await repository.getTableRows({ start: 1, end: 1 });

		expect(client.fetchPokemon).toHaveBeenCalledTimes(1);
		expect(client.fetchSpecies).toHaveBeenCalledTimes(1);
		expect(client.fetchImageBinary).toHaveBeenCalledTimes(1);
	});

	it("tracks per-id failures without aborting the rest of the batch", async () => {
		const { client, repository } = makeRepository();
		client.failIds.add(2);

		const result = await repository.getTableRows({ start: 1, end: 3 });

		expect(result.failedIds).toEqual([2]);
		expect(result.rows.map((r) => r.id)).toEqual([1, 3]);
		expect(result.servedFromCache).toBe(false);
	});

	it("retryRows bypasses cache for a previously-failed id and can recover it", async () => {
		const { client, repository } = makeRepository();
		client.failIds.add(2);
		const first = await repository.getTableRows({ start: 1, end: 3 });
		expect(first.failedIds).toEqual([2]);

		client.failIds.delete(2);
		const retried = await repository.retryRows(first.failedIds);

		expect(retried.failedIds).toEqual([]);
		expect(retried.rows.map((r) => r.id)).toEqual([2]);
		// Never cached on the failed attempt, so the retry had to fetch fresh.
		expect(client.fetchPokemon).toHaveBeenCalledWith(2);
	});

	it("getEntry swallows a failed evolution-chain fetch instead of rejecting", async () => {
		const { client, repository } = makeRepository();
		client.failEvolutionChain = true;

		const entry = await repository.getEntry(1);

		expect(entry.evolutionChain).toBeNull();
		expect(entry.name).toBe("bulbasaur");
	});
});
