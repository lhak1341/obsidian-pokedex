import { describe, expect, it, vi } from "vitest";
import bulbasaur from "./__fixtures__/bulbasaur.json";
import { createFakeDataAdapter, FakePokeApiClient } from "./__fixtures__/fakes";
import { DiskCache } from "./Cache";
import { PokedexRepository } from "./PokedexRepository";
import type { RawPokemon } from "./types";

function makeRepository() {
	const client = new FakePokeApiClient();
	const cache = DiskCache.forTest(createFakeDataAdapter(), "cache");
	return { client, cache, repository: new PokedexRepository(client, cache) };
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

	it("serves a repeat call from the in-memory layer without touching disk", async () => {
		const { cache, repository } = makeRepository();
		await repository.getTableRows({ start: 1, end: 1 });

		const readJsonSpy = vi.spyOn(cache, "readJson");
		await repository.getTableRows({ start: 1, end: 1 });

		expect(readJsonSpy).not.toHaveBeenCalled();
	});

	it("trims an untrimmed pokemon.json (from before moves-trimming existed) on next read", async () => {
		const { cache, repository } = makeRepository();
		// Simulate a cache written before trimMovesToVersionGroups existed: the
		// full fixture still has out-of-scope version groups (e.g. solar-beam,
		// diamond-pearl only).
		await cache.writeJson("pokemon/1.json", bulbasaur);
		expect((bulbasaur as unknown as RawPokemon).moves.some((m) => m.move.name === "solar-beam")).toBe(true);

		await repository.getTableRows({ start: 1, end: 1 });

		const migrated = await cache.readJson<RawPokemon>("pokemon/1.json");
		expect(migrated?.moves.some((m) => m.move.name === "solar-beam")).toBe(false);
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

	it("serves a fresh repository instance (e.g. plugin reload) from disk without refetching", async () => {
		const { client, cache } = makeRepository();
		const repoA = new PokedexRepository(client, cache);
		await repoA.getTableRows({ start: 1, end: 3 });

		// New instance = empty mem cache, same disk — exercises the disk-hit
		// partition path rather than the mem-cache short-circuit.
		const repoB = new PokedexRepository(client, cache);
		const result = await repoB.getTableRows({ start: 1, end: 3 });

		expect(client.fetchPokemon).toHaveBeenCalledTimes(3);
		expect(result.rows.map((r) => r.id)).toEqual([1, 2, 3]);
	});

	it("splits a table load between cached and uncached ids, fetching only the uncached ones", async () => {
		const { client, cache } = makeRepository();
		const repoA = new PokedexRepository(client, cache);
		await repoA.getTableRows({ start: 1, end: 2 });
		client.fetchPokemon.mockClear();
		client.fetchSpecies.mockClear();

		const repoB = new PokedexRepository(client, cache);
		const result = await repoB.getTableRows({ start: 1, end: 3 });

		expect(client.fetchPokemon).toHaveBeenCalledTimes(1);
		expect(client.fetchPokemon).toHaveBeenCalledWith(3);
		expect(result.rows.map((r) => r.id).sort((a, b) => a - b)).toEqual([1, 2, 3]);
	});

	it("getTableRows' onRow callback fires once per successful row as it settles", async () => {
		const { repository } = makeRepository();
		const seen: number[] = [];

		const result = await repository.getTableRows(
			{ start: 1, end: 3 },
			undefined,
			undefined,
			(row) => seen.push(row.id),
		);

		expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3]);
		expect(seen.length).toBe(result.rows.length);
	});

	it("getTableRows' onRow callback is skipped for a failed id", async () => {
		const { client, repository } = makeRepository();
		client.failIds.add(2);
		const seen: number[] = [];

		await repository.getTableRows({ start: 1, end: 3 }, undefined, undefined, (row) => seen.push(row.id));

		expect(seen.sort((a, b) => a - b)).toEqual([1, 3]);
	});

	it("getEntry swallows a failed evolution-chain fetch instead of rejecting", async () => {
		const { client, repository } = makeRepository();
		client.failEvolutionChain = true;

		const entry = await repository.getEntry(1);

		expect(entry.evolutionChain).toBeNull();
		expect(entry.name).toBe("bulbasaur");
	});

	it("getEntry swallows a failed artwork/shiny image fetch instead of rejecting the whole entry", async () => {
		const { client, repository } = makeRepository();
		// Sprite is already cached by the table load that got the user to this
		// row — only the never-fetched-until-now artwork/shiny should fail here.
		await repository.getTableRows({ start: 1, end: 1 });
		client.failImage = true;

		const entry = await repository.getEntry(1);

		expect(entry.artworkDataUri).toBeNull();
		expect(entry.shinyDataUri).toBeNull();
		expect(entry.shinyArtworkDataUri).toBeNull();
		expect(entry.spriteDataUri).not.toBeNull();
		expect(entry.name).toBe("bulbasaur");
	});

	it("getEntryCore resolves the fast fields without touching evolution chain or artwork/shiny", async () => {
		const { client, repository } = makeRepository();
		// Table load already cached pokemon/species/sprite for this id — the
		// same state the detail view finds them in when a row is clicked.
		await repository.getTableRows({ start: 1, end: 1 });
		client.fetchEvolutionChain.mockClear();
		client.fetchImageBinary.mockClear();

		const core = await repository.getEntryCore(1);

		expect(core.name).toBe("bulbasaur");
		expect(core.spriteDataUri).not.toBeNull();
		expect(core.evolutionChain).toBeNull();
		expect(core.artworkDataUri).toBeNull();
		expect(core.shinyDataUri).toBeNull();
		expect(core.shinyArtworkDataUri).toBeNull();
		expect(client.fetchEvolutionChain).not.toHaveBeenCalled();
	});

	it("getEntryExtras resolves evolution chain, artwork, shiny, and shiny artwork", async () => {
		const { repository } = makeRepository();

		const extras = await repository.getEntryExtras(1);

		expect(extras.evolutionChain?.name).toBe("bulbasaur");
		expect(extras.artworkDataUri).not.toBeNull();
		expect(extras.shinyDataUri).not.toBeNull();
		expect(extras.shinyArtworkDataUri).not.toBeNull();
	});

	it("getEntryChainVisuals resolves a sprite and types per id without fetching species", async () => {
		const { client, repository } = makeRepository();

		const visuals = await repository.getEntryChainVisuals([1, 2]);

		expect(visuals[1].sprite).not.toBeNull();
		expect(visuals[1].types.length).toBeGreaterThan(0);
		expect(visuals[2].sprite).not.toBeNull();
		expect(client.fetchSpecies).not.toHaveBeenCalled();
	});

	it("getEntryChainVisuals resolves a null sprite/empty types for an id that fails, without dropping the others", async () => {
		const { client, repository } = makeRepository();
		client.failIds.add(2);

		const visuals = await repository.getEntryChainVisuals([1, 2, 3]);

		expect(visuals[1].sprite).not.toBeNull();
		expect(visuals[2].sprite).toBeNull();
		expect(visuals[2].types).toEqual([]);
		expect(visuals[3].sprite).not.toBeNull();
	});

	it("getAbilityDescription fetches once per ability name, then serves cache on repeat calls", async () => {
		const { client, repository } = makeRepository();

		const first = await repository.getAbilityDescription("overgrow");
		const second = await repository.getAbilityDescription("overgrow");

		expect(first).toBe("overgrow short effect");
		expect(second).toBe("overgrow short effect");
		expect(client.fetchAbility).toHaveBeenCalledTimes(1);
	});

	it("getAbilityDescription serves a repeat call from the in-memory layer without touching disk", async () => {
		const { cache, repository } = makeRepository();
		await repository.getAbilityDescription("overgrow");

		const readJsonSpy = vi.spyOn(cache, "readJson");
		await repository.getAbilityDescription("overgrow");

		expect(readJsonSpy).not.toHaveBeenCalled();
	});

	it("getAbilityDescription rejects when the fetch fails", async () => {
		const { client, repository } = makeRepository();
		client.failAbility = true;

		await expect(repository.getAbilityDescription("overgrow")).rejects.toThrow();
	});

	it("getMoveDetails fetches once per move name, then serves cache on repeat calls", async () => {
		const { client, repository } = makeRepository();

		const first = await repository.getMoveDetails("tackle");
		const second = await repository.getMoveDetails("tackle");

		expect(first).toEqual({ type: "normal", power: 40, accuracy: 100, pp: 35 });
		expect(second).toEqual({ type: "normal", power: 40, accuracy: 100, pp: 35 });
		expect(client.fetchMove).toHaveBeenCalledTimes(1);
	});

	it("getMoveDetails serves a repeat call from the in-memory layer without touching disk", async () => {
		const { cache, repository } = makeRepository();
		await repository.getMoveDetails("tackle");

		const readJsonSpy = vi.spyOn(cache, "readJson");
		await repository.getMoveDetails("tackle");

		expect(readJsonSpy).not.toHaveBeenCalled();
	});

	it("getMoveDetailsForMoves de-dupes names and skips a failed move without aborting the rest", async () => {
		const { client, repository } = makeRepository();
		client.failMoves.add("struggle");
		const results: Record<string, unknown> = {};

		await repository.getMoveDetailsForMoves(
			["tackle", "tackle", "struggle", "growl"],
			(name, detail) => { results[name] = detail; },
		);

		expect(Object.keys(results).sort()).toEqual(["growl", "tackle"]);
		expect(client.fetchMove).toHaveBeenCalledTimes(3);
	});
});
