import { describe, expect, it, vi } from "vitest";
import bulbasaur from "./__fixtures__/bulbasaur.json";
import bulbasaurSpecies from "./__fixtures__/bulbasaur-species.json";
import { createFakeDataAdapter, FakePokeApiClient } from "./__fixtures__/fakes";
import { DiskCache } from "./Cache";
import { PokedexRepository } from "./PokedexRepository";
import type { RawPokemon, RawSpecies } from "./types";

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
		// legends-za only).
		await cache.writeJson("pokemon/1.json", bulbasaur);
		expect((bulbasaur as unknown as RawPokemon).moves.some((m) => m.move.name === "solar-beam")).toBe(true);

		await repository.getTableRows({ start: 1, end: 1 });

		const migrated = await cache.readJson<RawPokemon>("pokemon/1.json");
		expect(migrated?.moves.some((m) => m.move.name === "solar-beam")).toBe(false);
	});

	it("refetches a pokemon.json cached before held_items existed instead of crashing on undefined", async () => {
		const { client, cache, repository } = makeRepository();
		const { held_items: _heldItems, ...withoutHeldItems } = bulbasaur as unknown as RawPokemon;
		await cache.writeJson("pokemon/1.json", withoutHeldItems);

		const result = await repository.getTableRows({ start: 1, end: 1 });

		expect(client.fetchPokemon).toHaveBeenCalledTimes(1);
		expect(result.rows[0].heldItemNames).toEqual([]);
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

	it("produces one row per regional-form variety alongside the base row, sharing dexNumber", async () => {
		const { client, cache, repository } = makeRepository();
		// Bypasses the fake client's numeric/name fetch branches directly via
		// disk cache (same technique as the untrimmed-cache-migration test
		// above) — sets up dex #19 as "rattata" with an Alolan variety, since
		// the default bulbasaur fixture's species is obviously not one.
		const rattataSpecies: RawSpecies = {
			...bulbasaurSpecies,
			id: 19,
			name: "rattata",
			varieties: [
				{ is_default: true, pokemon: { name: "rattata", url: "" } },
				{ is_default: false, pokemon: { name: "rattata-alola", url: "" } },
			],
		};
		await cache.writeJson("species/19.json", rattataSpecies);
		await cache.writeJson("pokemon/19.json", {
			...(bulbasaur as unknown as RawPokemon),
			id: 19,
			name: "rattata",
			species: { name: "rattata", url: "" },
		});
		client.variantPokemon.set("rattata-alola", {
			...(bulbasaur as unknown as RawPokemon),
			id: 10091,
			name: "rattata-alola",
			species: { name: "rattata", url: "" },
			types: [{ slot: 1, type: { name: "dark", url: "" } }],
		});

		const result = await repository.getTableRows({ start: 19, end: 19 });

		expect(
			result.rows.map((r) => ({ id: r.id, dexNumber: r.dexNumber, formLabel: r.formLabel, name: r.name })),
		).toEqual([
			{ id: 19, dexNumber: 19, formLabel: null, name: "rattata" },
			{ id: 10091, dexNumber: 19, formLabel: "Alolan", name: "rattata" },
		]);
		expect(result.rows[1].types).toEqual(["dark"]);
	});

	it("skips a failed regional-form variant without dropping the base row", async () => {
		const { cache, repository } = makeRepository();
		const rattataSpecies: RawSpecies = {
			...bulbasaurSpecies,
			id: 19,
			name: "rattata",
			varieties: [
				{ is_default: true, pokemon: { name: "rattata", url: "" } },
				{ is_default: false, pokemon: { name: "rattata-alola", url: "" } },
			],
		};
		await cache.writeJson("species/19.json", rattataSpecies);
		await cache.writeJson("pokemon/19.json", {
			...(bulbasaur as unknown as RawPokemon),
			id: 19,
			name: "rattata",
			species: { name: "rattata", url: "" },
		});
		// No client.variantPokemon entry set for "rattata-alola" -> the fake
		// throws when fetchPokemon is called with that name.

		const result = await repository.getTableRows({ start: 19, end: 19 });

		expect(result.rows.map((r) => r.id)).toEqual([19]);
		expect(result.failedIds).toEqual([]);
	});

	// Shared by the cacheRange/clearRange regional-form tests below — same
	// dex #19 rattata/rattata-alola setup as the two tests above.
	function setUpRattataWithAlolanForm(
		client: FakePokeApiClient,
		cache: DiskCache,
	): Promise<void> {
		const rattataSpecies: RawSpecies = {
			...bulbasaurSpecies,
			id: 19,
			name: "rattata",
			varieties: [
				{ is_default: true, pokemon: { name: "rattata", url: "" } },
				{ is_default: false, pokemon: { name: "rattata-alola", url: "" } },
			],
		};
		client.variantPokemon.set("rattata-alola", {
			...(bulbasaur as unknown as RawPokemon),
			id: 10091,
			name: "rattata-alola",
			species: { name: "rattata", url: "" },
		});
		return Promise.all([
			cache.writeJson("species/19.json", rattataSpecies),
			cache.writeJson("pokemon/19.json", {
				...(bulbasaur as unknown as RawPokemon),
				id: 19,
				name: "rattata",
				species: { name: "rattata", url: "" },
			}),
		]).then(() => undefined);
	}

	it("cacheRange also prefetches extras for a discovered regional-form row, not just the range's own ids", async () => {
		const { client, cache, repository } = makeRepository();
		await setUpRattataWithAlolanForm(client, cache);

		await repository.cacheRange({ start: 19, end: 19 });

		// getEntryExtras(10091) fetches by the variant's own NUMERIC id (a
		// separate call from the name-keyed "rattata-alola" fetch the core
		// phase already made) — confirms the extras phase reached beyond the
		// static range ids to the row getTableRows actually discovered.
		expect(client.fetchPokemon).toHaveBeenCalledWith(10091);
		expect(await cache.readJson("pokemon/10091.json")).not.toBeNull();
	});

	it("clearRange also evicts a discovered regional-form row's cache entries (name-keyed and numeric-id-keyed)", async () => {
		const { client, cache, repository } = makeRepository();
		await setUpRattataWithAlolanForm(client, cache);
		// Populate both cache entities the way real usage would: the
		// name-keyed file (table load) and the numeric-id-keyed one (a detail-
		// view visit) — see this repo's CLAUDE.md cache-duplication gotcha.
		await repository.getTableRows({ start: 19, end: 19 });
		await repository.getEntryExtras(10091);
		expect(await cache.readJson("pokemon/rattata-alola.json")).not.toBeNull();
		expect(await cache.readJson("pokemon/10091.json")).not.toBeNull();

		await repository.clearRange({ start: 19, end: 19 });

		expect(await cache.readJson("pokemon/rattata-alola.json")).toBeNull();
		expect(await cache.readJson("pokemon/10091.json")).toBeNull();
		expect(await cache.readJson("pokemon/19.json")).toBeNull();
		expect(await cache.readJson("species/19.json")).toBeNull();
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

	it("getEntryExtras swallows a failed evolution-chain fetch instead of rejecting", async () => {
		const { client, repository } = makeRepository();
		client.failEvolutionChain = true;

		const extras = await repository.getEntryExtras(1);

		expect(extras.evolutionChain).toBeNull();
	});

	it("getEntryExtras swallows a failed artwork/shiny image fetch, returning null per field", async () => {
		const { client, repository } = makeRepository();
		client.failImage = true;

		const extras = await repository.getEntryExtras(1);

		expect(extras.artworkDataUri).toBeNull();
		expect(extras.shinyDataUri).toBeNull();
		expect(extras.shinyArtworkDataUri).toBeNull();
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
		// evolutionStages is a static lookup (EVOLUTION_STAGES), not a fetch —
		// see data/evolutionStages.json.
		expect(core.evolutionStages).toBe(2); // bulbasaur -> ivysaur -> venusaur
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

		const expected = { type: "normal", power: 40, accuracy: 100, pp: 35, description: "tackle FRLG description" };
		expect(first).toEqual(expected);
		expect(second).toEqual(expected);
		expect(client.fetchMove).toHaveBeenCalledTimes(1);
	});

	it("getMoveDetails refetches a moves/*.json cached before `description` existed", async () => {
		const { client, cache, repository } = makeRepository();
		// Simulate a cache written before this session's `description` field
		// existed — the exact pre-widening shape moves/tackle.json used to have.
		await cache.writeJson("moves/tackle.json", { type: "normal", power: 40, accuracy: 100, pp: 35 });

		const result = await repository.getMoveDetails("tackle");

		expect(result.description).toBe("tackle FRLG description");
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

	it("getMegaForm/getGigantamaxForm serve a repeat call from the in-memory layer without touching the client", async () => {
		const { client, repository } = makeRepository();
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });
		client.variantPokemon.set("charizard-gmax", { ...(bulbasaur as unknown as RawPokemon) });
		await repository.getMegaForm("charizard-mega-x");
		await repository.getGigantamaxForm("charizard-gmax");

		await repository.getMegaForm("charizard-mega-x");
		await repository.getGigantamaxForm("charizard-gmax");

		expect(client.fetchPokemon).toHaveBeenCalledTimes(2);
	});

	it("getMegaForm reads a disk-cached form without touching the client, and mem-caches it", async () => {
		const { cache, client, repository } = makeRepository();
		await cache.writeJson("mega-forms/charizard-mega-x.json", {
			types: ["fire", "flying"],
			abilities: [{ name: "blaze", isHidden: false }],
			stats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
			spriteDataUri: null,
			artworkDataUri: null,
			shinyDataUri: null,
			shinyArtworkDataUri: null,
		});

		const first = await repository.getMegaForm("charizard-mega-x");
		expect(client.fetchPokemon).not.toHaveBeenCalled();
		expect(first.types).toEqual(["fire", "flying"]);

		const readJsonSpy = vi.spyOn(cache, "readJson");
		await repository.getMegaForm("charizard-mega-x");
		expect(readJsonSpy).not.toHaveBeenCalled();
	});

	it("getGigantamaxForm fetches on a cache miss, normalizes, and writes through to disk", async () => {
		const { cache, client, repository } = makeRepository();
		client.variantPokemon.set("charizard-gmax", { ...(bulbasaur as unknown as RawPokemon) });

		const detail = await repository.getGigantamaxForm("charizard-gmax");

		expect(client.fetchPokemon).toHaveBeenCalledTimes(1);
		expect(await cache.readJson("gigantamax-forms/charizard-gmax.json")).toEqual(detail);
	});

	it("Mega and Gigantamax caches never collide, even fetched for the same species", async () => {
		const { cache, client, repository } = makeRepository();
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });
		client.variantPokemon.set("charizard-gmax", { ...(bulbasaur as unknown as RawPokemon) });

		await repository.getMegaForm("charizard-mega-x");
		await repository.getGigantamaxForm("charizard-gmax");

		expect(await cache.readJson("gigantamax-forms/charizard-mega-x.json")).toBeNull();
		expect(await cache.readJson("mega-forms/charizard-gmax.json")).toBeNull();
	});

	it("getMegaForm/getGigantamaxForm swallow a failed image fetch, returning null per field", async () => {
		const { client, repository } = makeRepository();
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });
		client.failImage = true;

		const detail = await repository.getMegaForm("charizard-mega-x");

		expect(detail.spriteDataUri).toBeNull();
		expect(detail.artworkDataUri).toBeNull();
		expect(detail.shinyDataUri).toBeNull();
		expect(detail.shinyArtworkDataUri).toBeNull();
	});
});
