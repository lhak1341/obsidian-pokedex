import { describe, expect, it, vi } from "vitest";
import bulbasaur from "./__fixtures__/bulbasaur.json";
import bulbasaurSpecies from "./__fixtures__/bulbasaur-species.json";
import { FakePokeApiClient, MemoryCacheStore, RecordingObjectUrls } from "./__fixtures__/fakes";
import type { PortraitRender } from "./imageSet";
import { PokedexRepository, type EntryExtras } from "./PokedexRepository";
import { MOVE_VERSION_GROUPS } from "./constants";
import { toStoredPokemon } from "./normalize";
import type { ChainMember, MegaFormDetail, PokedexEntry, RawPokemon, RawSpecies, StoredPokemon } from "./types";

function makeRepository(imageBudgetBytes?: number) {
	const client = new FakePokeApiClient();
	const cache = new MemoryCacheStore();
	const objectUrls = new RecordingObjectUrls();
	return { client, cache, objectUrls, repository: new PokedexRepository(client, cache, { objectUrls, imageBudgetBytes }) };
}

// The extras the Entry load's extras stage hands its caller (the large
// images in `render` and the evolution chain), as a detail screen holds them.
// The stage is cancelled once they land, so it asks for no chain members and
// their sprites never count against an image or call budget here.
async function extrasOf(repository: PokedexRepository, id: number, render: PortraitRender): Promise<EntryExtras> {
	let extras: EntryExtras | undefined;
	await repository.loadEntryExtras(id, render, {
		images: "hold",
		isCancelled: () => extras !== undefined,
		onExtras: (answer) => (extras = answer),
	});
	if (!extras) throw new Error("loadEntryExtras never handed over its extras");
	return extras;
}

// The core the Entry load hands its caller first (pokemon, species, sprite,
// a regional form's own text). The load is cancelled once it lands, so it
// asks for no move pool and no extras.
async function coreOf(repository: PokedexRepository, id: number): Promise<PokedexEntry> {
	let core: PokedexEntry | undefined;
	await repository.loadEntry(id, {
		images: "hold",
		render: () => "official-artwork",
		isCancelled: () => core !== undefined,
		onCore: (answer) => (core = answer),
	});
	if (!core) throw new Error("loadEntry never handed over its core");
	return core;
}

// The chain members the extras stage hands its caller for `id`'s chain.
async function chainMembersOf(repository: PokedexRepository, id: number): Promise<Record<number, ChainMember>> {
	let members: Record<number, ChainMember> | undefined;
	await repository.loadEntryExtras(id, "official-artwork", { images: "hold", onChainMembers: (answer) => (members = answer) });
	if (!members) throw new Error("loadEntryExtras never handed over chain members");
	return members;
}

// Fails every image whose source URL matches, at the client: every fake
// pokemon shares the bulbasaur fixture's URLs, so one URL fails that image
// for every id that is not already in memory.
function failImagesWhere(client: FakePokeApiClient, fails: (url: string) => boolean): void {
	const fetchImage = client.fetchImageBinary.getMockImplementation()!;
	client.fetchImageBinary.mockImplementation(async (url) => {
		if (fails(url)) throw new Error(`fake failure fetching image ${url}`);
		return fetchImage(url);
	});
}

async function blobBytes(blob: Blob | undefined): Promise<Uint8Array | null> {
	return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
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

	it("serves a cached image's stored bytes as a blob URL, and writes a fetched image's bytes", async () => {
		const { client, cache, objectUrls, repository } = makeRepository();
		await cache.writeBinary("images/1-sprite.png", new Uint8Array([1, 2, 3, 4]).buffer);

		const { rows } = await repository.getTableRows({ start: 1, end: 2 });

		// FakePokeApiClient's image is 4 zero bytes; id 1's sprite never hits it.
		const [stored, fetched] = rows.map((r) => objectUrls.live.get(r.spriteDataUri ?? ""));
		expect(await blobBytes(stored)).toEqual(new Uint8Array([1, 2, 3, 4]));
		expect(await blobBytes(fetched)).toEqual(new Uint8Array(4));
		expect(stored?.type).toBe("image/png");
		expect(client.fetchImageBinary).toHaveBeenCalledTimes(1);
		const written = await cache.readBinary("images/2-sprite.png");
		expect(written && new Uint8Array(written)).toEqual(new Uint8Array(4));
	});

	it("serves a repeat call from the in-memory layer without touching disk", async () => {
		const { cache, repository } = makeRepository();
		await repository.getTableRows({ start: 1, end: 1 });

		const readJsonSpy = vi.spyOn(cache, "readJson");
		await repository.getTableRows({ start: 1, end: 1 });

		expect(readJsonSpy).not.toHaveBeenCalled();
	});

	it("writes a fetched pokemon in the stored move shape, marked with the version groups it kept", async () => {
		const { cache, repository } = makeRepository();

		await repository.getTableRows({ start: 1, end: 1 });

		const written = await cache.readJson<StoredPokemon>("pokemon/1.json");
		expect(written?.moves.length).toBeGreaterThan(0);
		expect(written?.moves.every((m) => !("version_group_details" in m))).toBe(true);
		expect(written?.moveVersionGroups).toEqual(MOVE_VERSION_GROUPS);
	});

	it("serves a pokemon.json cut to the current version groups without refetching", async () => {
		const { client, cache, repository } = makeRepository();
		await cache.writeJson("pokemon/1.json", toStoredPokemon(bulbasaur));

		await repository.getTableRows({ start: 1, end: 1 });

		expect(client.fetchPokemon).not.toHaveBeenCalled();
	});

	// A record cut before legends-za/champions were tabs lacks their moves,
	// and so does one still in PokeAPI's move shape or written before the
	// marker: none can be repaired from disk, so each is refetched.
	it("refetches a pokemon.json cut to fewer version groups, or written before the marker", async () => {
		const raw = bulbasaur as unknown as RawPokemon;
		const { moveVersionGroups: _kept, ...unmarked } = toStoredPokemon(raw);
		const olderCut = toStoredPokemon(raw, MOVE_VERSION_GROUPS.filter((g) => g !== "legends-za"));
		for (const old of [raw, unmarked, olderCut]) {
			const { client, cache, repository } = makeRepository();
			await cache.writeJson("pokemon/1.json", old);

			await repository.getTableRows({ start: 1, end: 1 });

			expect(client.fetchPokemon).toHaveBeenCalledTimes(1);
			const rewritten = await cache.readJson<StoredPokemon>("pokemon/1.json");
			expect(rewritten?.moveVersionGroups).toEqual(MOVE_VERSION_GROUPS);
		}
	});

	it("refetches a pokemon.json cached before held_items existed instead of crashing on undefined", async () => {
		const { client, cache, repository } = makeRepository();
		const { held_items: _heldItems, ...withoutHeldItems } = toStoredPokemon(bulbasaur);
		await cache.writeJson("pokemon/1.json", withoutHeldItems);

		const result = await repository.getTableRows({ start: 1, end: 1 });

		expect(client.fetchPokemon).toHaveBeenCalledTimes(1);
		expect(result.rows[0].heldItemsAllGens).toEqual([]);
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
		await cache.writeJson("pokemon/19.json", toStoredPokemon({
			...(bulbasaur as unknown as RawPokemon),
			id: 19,
			name: "rattata",
			species: { name: "rattata", url: "" },
		}));
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
		await cache.writeJson("pokemon/19.json", toStoredPokemon({
			...(bulbasaur as unknown as RawPokemon),
			id: 19,
			name: "rattata",
			species: { name: "rattata", url: "" },
		}));
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
		cache: MemoryCacheStore,
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
			cache.writeJson("pokemon/19.json", toStoredPokemon({
				...(bulbasaur as unknown as RawPokemon),
				id: 19,
				name: "rattata",
				species: { name: "rattata", url: "" },
			})),
		]).then(() => undefined);
	}

	// Alolan Rattata as the detail screen reaches it: by numeric id, its
	// species linked by URL (speciesIdFromPokemon).
	async function setUpAlolanRattataDetail(client: FakePokeApiClient, cache: MemoryCacheStore) {
		await setUpRattataWithAlolanForm(client, cache);
		await cache.writeJson("pokemon/10091.json", toStoredPokemon({
			...(bulbasaur as unknown as RawPokemon),
			id: 10091,
			name: "rattata-alola",
			species: { name: "rattata", url: "https://pokeapi.co/api/v2/pokemon-species/19/" },
		}));
		client.formFlavorTexts.set("rattata-alola", [
			{ flavor_text: "Alolan\ntext.", language: { name: "en", url: "" }, version: { name: "sun", url: "" } },
			{ flavor_text: "Texte.", language: { name: "fr", url: "" }, version: { name: "sun", url: "" } },
		]);
	}

	it("gives a regional row its form's own Pokédex text where PokeAPI has it, the species' elsewhere", async () => {
		const { client, cache, repository } = makeRepository();
		await setUpAlolanRattataDetail(client, cache);
		const speciesTexts = (await coreOf(repository, 19)).flavorTexts;

		const alolan = await coreOf(repository, 10091);

		expect(alolan.flavorTexts["sun-moon"]).toBe("Alolan text.");
		expect(alolan.flavorTexts.firered).toBe(speciesTexts.firered);
		expect(client.fetchPokemonForm).toHaveBeenCalledTimes(1);
		expect(client.fetchPokemonForm).toHaveBeenCalledWith("rattata-alola");
		expect(await cache.readJson("pokemon-forms/rattata-alola.json")).toEqual({
			flavor_text_entries: [{ flavor_text: "Alolan\ntext.", language: { name: "en", url: "" }, version: { name: "sun", url: "" } }],
		});
	});

	it("keeps the species' text when the form fetch fails", async () => {
		const { client, cache, repository } = makeRepository();
		await setUpAlolanRattataDetail(client, cache);
		client.failForms = true;

		const alolan = await coreOf(repository, 10091);

		expect(alolan.flavorTexts).toEqual((await coreOf(repository, 19)).flavorTexts);
	});

	it("caches a regional row's form text with its extras, and clearRange evicts it with the variant", async () => {
		const { client, cache, repository } = makeRepository();
		await setUpAlolanRattataDetail(client, cache);
		await repository.cacheRange({ id: 1, name: "Test Gen 1", start: 19, end: 19 }, "official-artwork");
		expect(await cache.readJson("pokemon-forms/rattata-alola.json")).not.toBeNull();

		await repository.clearRange({ id: 7, name: "Test Gen 7", start: 722, end: 809 });

		expect(await cache.readJson("pokemon-forms/rattata-alola.json")).toBeNull();
	});

	it("cacheRange also prefetches extras for a discovered regional-form row, not just the range's own ids", async () => {
		const { client, cache, repository } = makeRepository();
		await setUpRattataWithAlolanForm(client, cache);

		await repository.cacheRange({ id: 1, name: "Test Gen", start: 19, end: 19 }, "official-artwork");

		// The extras stage for 10091 fetches by the variant's own NUMERIC id (a
		// separate call from the name-keyed "rattata-alola" fetch the core
		// phase already made) — confirms the extras phase reached beyond the
		// static range ids to the row getTableRows actually discovered.
		expect(client.fetchPokemon).toHaveBeenCalledWith(10091);
		expect(await cache.readJson("pokemon/10091.json")).not.toBeNull();
	});

	it("clearRange evicts a discovered regional-form row's cache entries when the variant's OWN generation matches, even when its base dex id sits outside the range being cleared", async () => {
		const { client, cache, repository } = makeRepository();
		await setUpRattataWithAlolanForm(client, cache);
		// Populate both cache entities the way real usage would: the
		// name-keyed file (table load) and the numeric-id-keyed one (a detail-
		// view visit) — see this repo's CLAUDE.md cache-duplication gotcha.
		await repository.getTableRows({ start: 19, end: 19 });
		await extrasOf(repository, 10091, "official-artwork");
		expect(await cache.readJson("pokemon/rattata-alola.json")).not.toBeNull();
		expect(await cache.readJson("pokemon/10091.json")).not.toBeNull();

		// "alola" is REGIONAL_FORMS-tagged generationId 7 (see constants.ts).
		// Gen 7's REAL range (722-809) never reaches dex #19 — this is the
		// disjoint-range case ADR-0006 describes: discovery must not depend on
		// this range containing the base species id at all.
		await repository.clearRange({ id: 7, name: "Test Gen 7", start: 722, end: 809 });

		expect(await cache.readJson("pokemon/rattata-alola.json")).toBeNull();
		expect(await cache.readJson("pokemon/10091.json")).toBeNull();
		// Dex #19 itself is outside this range, so its own base entry survives.
		expect(await cache.readJson("pokemon/19.json")).not.toBeNull();
		expect(await cache.readJson("species/19.json")).not.toBeNull();
	});

	it("clearRange preserves a regional-form variant whose OWN generation doesn't match the range being cleared", async () => {
		const { client, cache, repository } = makeRepository();
		await setUpRattataWithAlolanForm(client, cache);
		await repository.getTableRows({ start: 19, end: 19 });
		await extrasOf(repository, 10091, "official-artwork");

		// Alolan Rattata's base dex number (#19) sits in Gen 1's range, but its
		// own generationId is 7 — clearing "Gen 1" (id: 1) must not evict a
		// variant that actually belongs to a different generation.
		await repository.clearRange({ id: 1, name: "Test Gen 1", start: 1, end: 151 });

		expect(await cache.readJson("pokemon/rattata-alola.json")).not.toBeNull();
		expect(await cache.readJson("pokemon/10091.json")).not.toBeNull();
		// The base species/id itself is still in-range and still evicted.
		expect(await cache.readJson("pokemon/19.json")).toBeNull();
		expect(await cache.readJson("species/19.json")).toBeNull();
	});

	it("clearRange leaves no image behind after every image-writing fetch path has run", async () => {
		const { cache, repository } = makeRepository();
		// Table load writes the sprite; the extras stage writes artwork, shiny and
		// shiny-artwork. Together they cover all four suffixes for id 1.
		await repository.getTableRows({ start: 1, end: 1 });
		await extrasOf(repository, 1, "official-artwork");
		expect((await cache.listFilesIn("images")).length).toBe(4);

		await repository.clearRange({ id: 1, name: "Test Gen 1", start: 1, end: 151 });

		expect(await cache.listFilesIn("images")).toEqual([]);
	});

	it("getCacheStatus reports 0/N when nothing has been fetched", async () => {
		const { repository } = makeRepository();

		const status = await repository.getCacheStatus({ id: 1, name: "Test Gen", start: 1, end: 1 }, "official-artwork");

		expect(status).toEqual({ cached: 0, total: 1 });
	});

	it("getCacheStatus serves a mem-cache hit without touching disk", async () => {
		const { cache, repository } = makeRepository();
		await repository.getTableRows({ start: 1, end: 1 });
		await extrasOf(repository, 1, "official-artwork");

		// isIdCached/isExtrasCached both check cache.exists(...) before falling
		// back to disk — a mem hit on the same instance should never reach it.
		const existsSpy = vi.spyOn(cache, "exists");
		const status = await repository.getCacheStatus({ id: 1, name: "Test Gen", start: 1, end: 1 }, "official-artwork");

		expect(status).toEqual({ cached: 1, total: 1 });
		expect(existsSpy).not.toHaveBeenCalled();
	});

	it("getCacheStatus serves a fresh instance's disk-cache hit without touching the network", async () => {
		const { client, cache } = makeRepository();
		const repoA = new PokedexRepository(client, cache);
		await repoA.getTableRows({ start: 1, end: 1 });
		await extrasOf(repoA, 1, "official-artwork");
		client.fetchPokemon.mockClear();
		client.fetchSpecies.mockClear();
		client.fetchImageBinary.mockClear();

		// New instance = empty mem cache, same disk — exercises the disk-hit
		// path rather than the mem-cache short-circuit above. This is the
		// invariant isExtrasCached's own comment only asserts in prose ("core
		// confirmed cached by the caller first, never a network call at this
		// point") — a future reordering of the isIdCached && isExtrasCached
		// check would show up here as a real fetch, not just a stale comment.
		const repoB = new PokedexRepository(client, cache);
		const status = await repoB.getCacheStatus({ id: 1, name: "Test Gen", start: 1, end: 1 }, "official-artwork");

		expect(status).toEqual({ cached: 1, total: 1 });
		expect(client.fetchPokemon).not.toHaveBeenCalled();
		expect(client.fetchSpecies).not.toHaveBeenCalled();
		expect(client.fetchImageBinary).not.toHaveBeenCalled();
	});

	it("getCacheStatus doesn't award credit for core cached without extras", async () => {
		const { repository } = makeRepository();
		// getTableRows populates pokemon.json/species.json (isIdCached's
		// concern) but never touches the artwork/shiny/evolution-chain fetch
		// the extras stage makes — a real, naturally-reachable partial state
		// (browsing the table caches core; opening the detail screen is what
		// caches extras), not a contrived one.
		await repository.getTableRows({ start: 1, end: 1 });

		const status = await repository.getCacheStatus({ id: 1, name: "Test Gen", start: 1, end: 1 }, "official-artwork");

		expect(status).toEqual({ cached: 0, total: 1 });
	});

	it("getCacheStatus counts a species with no official-artwork as extras-satisfied without ever fetching extras", async () => {
		const { cache, repository } = makeRepository();
		const withoutArtwork = structuredClone(bulbasaur) as unknown as RawPokemon;
		if (withoutArtwork.sprites.other) delete withoutArtwork.sprites.other["official-artwork"];
		await cache.writeJson("pokemon/1.json", toStoredPokemon(withoutArtwork));
		await cache.writeJson("species/1.json", bulbasaurSpecies);

		const status = await repository.getCacheStatus({ id: 1, name: "Test Gen", start: 1, end: 1 }, "official-artwork");

		expect(status).toEqual({ cached: 1, total: 1 });
	});

	it("getCacheStatus counts only the fully-cached id in a multi-id range", async () => {
		const { repository } = makeRepository();
		await repository.getTableRows({ start: 1, end: 2 });
		await extrasOf(repository, 1, "official-artwork");
		// id 2's core is cached but its extras never were (same shape as the
		// partial-miss test above) — only id 1 should count.

		const status = await repository.getCacheStatus({ id: 1, name: "Test Gen", start: 1, end: 2 }, "official-artwork");

		expect(status).toEqual({ cached: 1, total: 2 });
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

	it("the extras stage swallows a failed evolution-chain fetch instead of rejecting", async () => {
		const { client, repository } = makeRepository();
		client.failEvolutionChain = true;

		const extras = await extrasOf(repository, 1, "official-artwork");

		expect(extras.evolutionChain).toBeNull();
	});

	it("the extras stage swallows a failed artwork/shiny image fetch, returning null per field", async () => {
		const { client, repository } = makeRepository();
		client.failImage = true;

		const extras = await extrasOf(repository, 1, "official-artwork");

		expect(extras.artworkDataUri).toBeNull();
		expect(extras.shinyDataUri).toBeNull();
		expect(extras.shinyArtworkDataUri).toBeNull();
	});

	it("the Entry load's core resolves the fast fields without touching evolution chain or artwork/shiny", async () => {
		const { client, repository } = makeRepository();
		// Table load already cached pokemon/species/sprite for this id — the
		// same state the detail view finds them in when a row is clicked.
		await repository.getTableRows({ start: 1, end: 1 });
		client.fetchEvolutionChain.mockClear();
		client.fetchImageBinary.mockClear();

		const core = await coreOf(repository, 1);

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

	it("the extras stage resolves evolution chain, artwork, shiny, and shiny artwork", async () => {
		const { repository } = makeRepository();

		const extras = await extrasOf(repository, 1, "official-artwork");

		expect(extras.evolutionChain?.name).toBe("bulbasaur");
		expect(extras.artworkDataUri).not.toBeNull();
		expect(extras.shinyDataUri).not.toBeNull();
		expect(extras.shinyArtworkDataUri).not.toBeNull();
	});

	it("the extras stage resolves a sprite and types per chain member", async () => {
		const { repository } = makeRepository();

		const visuals = await chainMembersOf(repository, 1);

		expect(Object.keys(visuals)).toEqual(["1", "2", "3"]);
		for (const id of [1, 2, 3]) {
			expect(visuals[id].sprite).not.toBeNull();
			expect(visuals[id].types.length).toBeGreaterThan(0);
		}
	});

	it("the extras stage resolves a null sprite/empty types for a chain member that fails, without dropping the others", async () => {
		const { client, repository } = makeRepository();
		// Only Ivysaur's pokemon fails: its species still resolves the chain.
		const fetchPokemon = client.fetchPokemon.getMockImplementation()!;
		client.fetchPokemon.mockImplementation(async (idOrName) => {
			if (idOrName === 2) throw new Error("fake failure fetching pokemon 2");
			return fetchPokemon(idOrName);
		});

		const visuals = await chainMembersOf(repository, 1);

		expect(visuals[1].sprite).not.toBeNull();
		expect(visuals[2].sprite).toBeNull();
		expect(visuals[2].types).toEqual([]);
		expect(visuals[3].sprite).not.toBeNull();
	});

	it("the extras stage keeps a chain member's types when only its sprite fails", async () => {
		const { client, repository } = makeRepository();
		// The viewed id's own sprite is already resident, as after its core.
		await coreOf(repository, 1);
		failImagesWhere(client, (url) => url === bulbasaur.sprites.front_default);

		const visuals = await chainMembersOf(repository, 1);

		expect(visuals[1].sprite).not.toBeNull();
		for (const id of [2, 3]) {
			expect(visuals[id].sprite).toBeNull();
			expect(visuals[id].types.length).toBeGreaterThan(0);
		}
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
		await repository.getMegaForm("charizard-mega-x", "official-artwork");
		await repository.getGigantamaxForm("charizard-gmax", "official-artwork");

		await repository.getMegaForm("charizard-mega-x", "official-artwork");
		await repository.getGigantamaxForm("charizard-gmax", "official-artwork");

		expect(client.fetchPokemon).toHaveBeenCalledTimes(2);
	});

	it("getMegaForm dedups two concurrent calls for the same key into one client fetch", async () => {
		const { client, repository } = makeRepository();
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });

		const [first, second] = await Promise.all([
			repository.getMegaForm("charizard-mega-x", "official-artwork"),
			repository.getMegaForm("charizard-mega-x", "official-artwork"),
		]);

		expect(client.fetchPokemon).toHaveBeenCalledTimes(1);
		expect(first).toEqual(second);
	});

	it("getMegaForm reads a disk-cached form without touching the client, and mem-caches it", async () => {
		const { cache, client, repository } = makeRepository();
		await cache.writeJson("mega-forms/charizard-mega-x.json", {
			types: [
				{ slot: 1, type: { name: "fire", url: "" } },
				{ slot: 2, type: { name: "flying", url: "" } },
			],
			abilities: [{ ability: { name: "blaze", url: "" }, is_hidden: false, slot: 1 }],
			stats: (bulbasaur as unknown as RawPokemon).stats,
			sprites: { front_default: null, front_shiny: null, other: { "official-artwork": undefined, home: null } },
		});

		const first = await repository.getMegaForm("charizard-mega-x", "official-artwork");
		expect(client.fetchPokemon).not.toHaveBeenCalled();
		expect(first.types).toEqual(["fire", "flying"]);
		expect(first.abilities).toEqual([{ name: "blaze", isHidden: false }]);

		const readJsonSpy = vi.spyOn(cache, "readJson");
		await repository.getMegaForm("charizard-mega-x", "official-artwork");
		expect(readJsonSpy).not.toHaveBeenCalled();
	});

	it("refetches a Mega form cached before HOME renders were kept", async () => {
		const { cache, client, repository } = makeRepository();
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });
		await cache.writeJson("mega-forms/charizard-mega-x.json", {
			types: [], abilities: [], stats: [], sprites: { front_default: null, front_shiny: null },
		});

		await repository.getMegaForm("charizard-mega-x", "official-artwork");

		expect(client.fetchPokemon).toHaveBeenCalledTimes(1);
	});

	it("loads and caches only the chosen render: HOME images replace artwork in a detail and its forms", async () => {
		const { cache, client, repository } = makeRepository();
		const raw = bulbasaur as unknown as RawPokemon;
		const home = { front_default: "home.png", front_shiny: "home-shiny.png" };
		client.fetchPokemon.mockImplementation(async (idOrName: number | string) =>
			typeof idOrName === "string"
				? { ...raw, name: idOrName, sprites: { ...raw.sprites, other: { ...raw.sprites.other, home } } }
				: { ...raw, id: idOrName, sprites: { ...raw.sprites, other: { ...raw.sprites.other, home } } },
		);
		const extras = await extrasOf(repository, 1, "home");
		await repository.getMegaForm("charizard-mega-x", "home");
		await repository.cacheRange({ id: 1, name: "Test Gen", start: 2, end: 2 }, "home");

		expect(repository.imagePathOf(extras.artworkDataUri!)).toBe("images/1-home.png");
		expect(repository.imagePathOf(extras.shinyArtworkDataUri!)).toBe("images/1-shiny-home.png");
		for (const key of [1, 2, "charizard-mega-x"]) {
			expect(await cache.exists(`images/${key}-home.png`)).toBe(true);
			expect(await cache.exists(`images/${key}-artwork.png`)).toBe(false);
		}
		const urls = client.fetchImageBinary.mock.calls.map(([url]) => url);
		expect(urls).toContain("home.png");
		expect(urls).not.toContain(raw.sprites.other?.["official-artwork"]?.front_default);
	});

	it("counts an id as cached only once the chosen render is stored", async () => {
		const { repository } = makeRepository();
		const gen = { id: 1, name: "Test Gen", start: 1, end: 1 };
		await repository.cacheRange(gen, "official-artwork");
		expect(await repository.getCacheStatus(gen, "official-artwork")).toEqual({ cached: 1, total: 1 });
		expect(await repository.getCacheStatus(gen, "home")).toEqual({ cached: 0, total: 1 });
	});

	it("getGigantamaxForm fetches on a cache miss, normalizes, and writes through to disk", async () => {
		const { cache, client, repository } = makeRepository();
		client.variantPokemon.set("charizard-gmax", { ...(bulbasaur as unknown as RawPokemon) });

		const detail = await repository.getGigantamaxForm("charizard-gmax", "official-artwork");

		expect(client.fetchPokemon).toHaveBeenCalledTimes(1);
		expect(detail.artworkDataUri).not.toBeNull();
		// Stores the image sources, never the session's image URLs.
		const stored = await cache.readJson("gigantamax-forms/charizard-gmax.json");
		expect(stored).toMatchObject({ sprites: { front_default: (bulbasaur as unknown as RawPokemon).sprites.front_default } });
		expect(JSON.stringify(stored)).not.toContain("blob:");
	});

	it("Mega and Gigantamax caches never collide, even fetched for the same species", async () => {
		const { cache, client, repository } = makeRepository();
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });
		client.variantPokemon.set("charizard-gmax", { ...(bulbasaur as unknown as RawPokemon) });

		await repository.getMegaForm("charizard-mega-x", "official-artwork");
		await repository.getGigantamaxForm("charizard-gmax", "official-artwork");

		expect(await cache.readJson("gigantamax-forms/charizard-mega-x.json")).toBeNull();
		expect(await cache.readJson("mega-forms/charizard-gmax.json")).toBeNull();
	});

	it("getMegaForm/getGigantamaxForm swallow a failed image fetch, returning null per field", async () => {
		const { client, repository } = makeRepository();
		client.variantPokemon.set("charizard-mega-x", { ...(bulbasaur as unknown as RawPokemon) });
		client.failImage = true;

		const detail = await repository.getMegaForm("charizard-mega-x", "official-artwork");

		expect(detail.spriteDataUri).toBeNull();
		expect(detail.artworkDataUri).toBeNull();
		expect(detail.shinyDataUri).toBeNull();
		expect(detail.shinyArtworkDataUri).toBeNull();
	});

	it("clearAll() drops the mem layer too, so status reads 0/N and the next fetch hits the client again", async () => {
		const { client, repository } = makeRepository();
		const gen = { id: 1, name: "Test Gen", start: 1, end: 1 };
		await repository.cacheRange(gen, "official-artwork");
		expect((await repository.getCacheStatus(gen, "official-artwork")).cached).toBe(1);

		await repository.clearAll();

		expect(await repository.getCacheStatus(gen, "official-artwork")).toEqual({ cached: 0, total: 1 });
		client.fetchPokemon.mockClear();
		await repository.getTableRows({ start: 1, end: 1 });
		expect(client.fetchPokemon).toHaveBeenCalledTimes(1);
	});

	// A species with a Mega and a Gigantamax variety, cached the way a detail-
	// screen visit leaves it.
	async function setUpVenusaurWithVarietyForms(client: FakePokeApiClient, cache: MemoryCacheStore, repository: PokedexRepository) {
		const venusaurSpecies: RawSpecies = {
			...bulbasaurSpecies,
			id: 3,
			name: "venusaur",
			varieties: [
				{ is_default: true, pokemon: { name: "venusaur", url: "" } },
				{ is_default: false, pokemon: { name: "venusaur-mega", url: "" } },
				{ is_default: false, pokemon: { name: "venusaur-gmax", url: "" } },
			],
		};
		for (const name of ["venusaur-mega", "venusaur-gmax"]) {
			client.variantPokemon.set(name, { ...(bulbasaur as unknown as RawPokemon), id: 10000, name });
		}
		await cache.writeJson("species/3.json", venusaurSpecies);
		await cache.writeJson("pokemon/3.json", toStoredPokemon({
			...(bulbasaur as unknown as RawPokemon),
			id: 3,
			name: "venusaur",
			species: { name: "venusaur", url: "" },
		}));
		await repository.getMegaForm("venusaur-mega", "official-artwork");
		await repository.getGigantamaxForm("venusaur-gmax", "official-artwork");
	}

	it("clearRange evicts a base species' Mega and Gigantamax forms and their images", async () => {
		const { client, cache, repository } = makeRepository();
		await setUpVenusaurWithVarietyForms(client, cache, repository);
		expect(await cache.readJson("mega-forms/venusaur-mega.json")).not.toBeNull();
		expect(await cache.exists("images/venusaur-mega-sprite.png")).toBe(true);

		await repository.clearRange({ id: 1, name: "Test Gen 1", start: 1, end: 151 });

		expect(await cache.readJson("mega-forms/venusaur-mega.json")).toBeNull();
		expect(await cache.readJson("gigantamax-forms/venusaur-gmax.json")).toBeNull();
		expect(await cache.exists("images/venusaur-mega-sprite.png")).toBe(false);
		expect(await cache.exists("images/venusaur-gmax-shiny.png")).toBe(false);
	});

	// A generation of one species with a Mega and a Gigantamax variety, as
	// PokeAPI lists them: every fake pokemon is named "bulbasaur", so the
	// varieties are "bulbasaur-mega" and "bulbasaur-gmax" (deriveMegaForms
	// and deriveGigantamaxForms match the viewed pokemon's own name).
	function withVarietyForms(client: FakePokeApiClient) {
		const species = client.fetchSpecies.getMockImplementation()!;
		client.fetchSpecies.mockImplementation(async (idOrName) => ({
			...(await species(idOrName)),
			varieties: [
				{ is_default: true, pokemon: { name: "bulbasaur", url: "" } },
				{ is_default: false, pokemon: { name: "bulbasaur-mega", url: "" } },
				{ is_default: false, pokemon: { name: "bulbasaur-gmax", url: "" } },
			],
		}));
		for (const name of ["bulbasaur-mega", "bulbasaur-gmax"]) {
			client.variantPokemon.set(name, { ...(bulbasaur as unknown as RawPokemon), id: 10000, name });
		}
		return { id: 1, name: "Test Gen", start: 1, end: 1 };
	}

	it("cacheRange stores a species' Mega and Gigantamax forms, so the Variety toggle works offline", async () => {
		const { client, cache, repository } = makeRepository();
		const gen = withVarietyForms(client);
		await repository.cacheRange(gen, "official-artwork");
		// A new repository over the same store, so its memory caches answer nothing.
		const offline = new FakePokeApiClient();
		const requests = Object.values(offline).filter((value) => vi.isMockFunction(value));
		for (const request of requests) {
			request.mockImplementation(() => {
				throw new Error("offline");
			});
		}
		const reopened = new PokedexRepository(offline, cache, { objectUrls: new RecordingObjectUrls() });

		const mega = await reopened.getMegaForm("bulbasaur-mega", "official-artwork");
		const gmax = await reopened.getGigantamaxForm("bulbasaur-gmax", "official-artwork");

		for (const request of requests) expect(request.mock.calls).toEqual([]);
		expect(mega.types.length).toBeGreaterThan(0);
		for (const detail of [mega, gmax]) {
			expect(detail.spriteDataUri).not.toBeNull();
			expect(detail.artworkDataUri).not.toBeNull();
			expect(detail.shinyArtworkDataUri).not.toBeNull();
		}
	});

	it("clearRange removes every variety-form file cacheRange stored", async () => {
		const { client, cache, repository } = makeRepository();
		const gen = withVarietyForms(client);
		const before = new Set(await cache.listFilesIn("images"));
		await repository.cacheRange(gen, "official-artwork");
		const formImages = (await cache.listFilesIn("images")).filter((f) => !before.has(f) && /bulbasaur-(mega|gmax)/.test(f));
		expect(formImages.length).toBeGreaterThan(0);
		expect(await cache.readJson("mega-forms/bulbasaur-mega.json")).not.toBeNull();
		expect(await cache.readJson("gigantamax-forms/bulbasaur-gmax.json")).not.toBeNull();

		await repository.clearRange(gen);

		expect(await cache.readJson("mega-forms/bulbasaur-mega.json")).toBeNull();
		expect(await cache.readJson("gigantamax-forms/bulbasaur-gmax.json")).toBeNull();
		const left = (await cache.listFilesIn("images")).filter((f) => formImages.includes(f));
		expect(left).toEqual([]);
	});

	it("clearRange leaves Mega and Gigantamax forms whose base species is outside the range", async () => {
		const { client, cache, repository } = makeRepository();
		await setUpVenusaurWithVarietyForms(client, cache, repository);

		await repository.clearRange({ id: 2, name: "Test Gen 2", start: 152, end: 251 });

		expect(await cache.readJson("mega-forms/venusaur-mega.json")).not.toBeNull();
		expect(await cache.readJson("gigantamax-forms/venusaur-gmax.json")).not.toBeNull();
	});
});

// Images held in memory are blob URLs. Artwork, shiny and shiny artwork sit in
// an LRU bounded in bytes; sprites stay resident, since table rows keep their
// sprite URL for the whole view mount and a revoked URL never loads again.
describe("PokedexRepository image memory", () => {
	// The extras stage loads exactly the three budgeted images and no sprite.
	function extrasUrls(extras: EntryExtras): string[] {
		return [extras.artworkDataUri, extras.shinyDataUri, extras.shinyArtworkDataUri].filter((u): u is string => u !== null);
	}

	it("keeps the budgeted images' bytes within the budget, evicting the least recently used first and revoking each URL as it is evicted", async () => {
		const { client, objectUrls, repository } = makeRepository(600);
		client.imageSize = 100;

		const two = extrasUrls(await extrasOf(repository, 2, "official-artwork"));
		const three = extrasUrls(await extrasOf(repository, 3, "official-artwork"));
		// A mem hit makes id 2's images the most recently used.
		expect(extrasUrls(await extrasOf(repository, 2, "official-artwork"))).toEqual(two);
		const logBeforeFour = objectUrls.log.length;
		const four = extrasUrls(await extrasOf(repository, 4, "official-artwork"));

		expect(objectUrls.peakLiveBytes).toBeLessThanOrEqual(600);
		expect([...objectUrls.live.keys()].sort()).toEqual([...two, ...four].sort());
		// Revoked while id 4 loaded, not left for a later clear.
		const revokedDuringFour = objectUrls.log.slice(logBeforeFour).filter((e) => e.startsWith("revoke "));
		expect(revokedDuringFour.map((e) => e.slice("revoke ".length)).sort()).toEqual([...three].sort());
	});

	it("serves an evicted image again from the store, under a new URL", async () => {
		const { client, objectUrls, repository } = makeRepository(300);
		client.imageSize = 100;

		const first = await extrasOf(repository, 2, "official-artwork");
		await extrasOf(repository, 3, "official-artwork");
		const again = await extrasOf(repository, 2, "official-artwork");

		expect(client.fetchImageBinary).toHaveBeenCalledTimes(6);
		expect(again.artworkDataUri).not.toBe(first.artworkDataUri);
		expect(objectUrls.live.has(again.artworkDataUri ?? "")).toBe(true);
	});

	it("never evicts a sprite to make room", async () => {
		const { client, objectUrls, repository } = makeRepository(300);
		client.imageSize = 100;
		const { rows } = await repository.getTableRows({ start: 1, end: 5 });

		for (const id of [2, 3, 4]) await extrasOf(repository, id, "official-artwork");

		for (const row of rows) expect(objectUrls.live.has(row.spriteDataUri ?? "")).toBe(true);
	});

	it("clearAll revokes every live URL, sprites included", async () => {
		const { objectUrls, repository } = makeRepository();
		await repository.getTableRows({ start: 1, end: 3 });
		await extrasOf(repository, 2, "official-artwork");
		expect(objectUrls.live.size).toBe(6);

		await repository.clearAll();

		expect(objectUrls.live.size).toBe(0);
	});

	it("clearRange revokes the URLs of the ids it clears and keeps the rest", async () => {
		const { objectUrls, repository } = makeRepository();
		const { rows } = await repository.getTableRows({ start: 1, end: 2 });
		const two = extrasUrls(await extrasOf(repository, 2, "official-artwork"));
		const [one] = rows;

		await repository.clearRange({ id: 1, name: "Test Gen", start: 2, end: 2 });

		expect([...objectUrls.live.keys()]).toEqual([one?.spriteDataUri]);
		for (const url of [rows[1]?.spriteDataUri, ...two]) expect(objectUrls.log).toContain(`revoke ${url}`);
	});

	// Mega/Gigantamax forms are cached as a whole record, unlike entries and
	// rows, so the record must not carry a URL: one evicted (or from an
	// earlier session) never loads again.
	function megaUrls(detail: MegaFormDetail): string[] {
		return [detail.spriteDataUri, detail.artworkDataUri, detail.shinyDataUri, detail.shinyArtworkDataUri].filter(
			(u): u is string => u !== null,
		);
	}

	it("serves a Mega form's images under live URLs after the LRU evicted them", async () => {
		const { client, objectUrls, repository } = makeRepository(300);
		client.imageSize = 100;
		client.variantPokemon.set("venusaur-mega", { ...(bulbasaur as unknown as RawPokemon), name: "venusaur-mega" });
		await repository.getMegaForm("venusaur-mega", "official-artwork");
		await extrasOf(repository, 2, "official-artwork");

		const again = megaUrls(await repository.getMegaForm("venusaur-mega", "official-artwork"));

		expect(again).toHaveLength(4);
		for (const url of again) expect(objectUrls.live.has(url)).toBe(true);
	});

	it("serves a Mega form cached in an earlier session under this session's URLs, without refetching it", async () => {
		const { client, cache } = makeRepository();
		client.variantPokemon.set("venusaur-mega", { ...(bulbasaur as unknown as RawPokemon), name: "venusaur-mega" });
		await new PokedexRepository(client, cache, { objectUrls: new RecordingObjectUrls() }).getMegaForm("venusaur-mega", "official-artwork");
		client.fetchPokemon.mockClear();
		const nextSession = new RecordingObjectUrls();

		const detail = await new PokedexRepository(client, cache, { objectUrls: nextSession }).getMegaForm("venusaur-mega", "official-artwork");

		expect(client.fetchPokemon).not.toHaveBeenCalled();
		expect(detail.types).toEqual(["grass", "poison"]);
		for (const url of megaUrls(detail)) expect(nextSession.live.has(url)).toBe(true);
	});

	it("refetches a Mega form record cached with its image URIs inside, the shape before blob URLs", async () => {
		const { client, cache, objectUrls, repository } = makeRepository();
		client.variantPokemon.set("venusaur-mega", { ...(bulbasaur as unknown as RawPokemon), name: "venusaur-mega" });
		await cache.writeJson("mega-forms/venusaur-mega.json", {
			types: ["grass"],
			abilities: [],
			stats: {},
			spriteDataUri: "data:image/png;base64,AAAA",
			artworkDataUri: null,
			shinyDataUri: null,
			shinyArtworkDataUri: null,
		});

		const detail = await repository.getMegaForm("venusaur-mega", "official-artwork");

		expect(client.fetchPokemon).toHaveBeenCalledWith("venusaur-mega");
		expect(megaUrls(detail)).toHaveLength(4);
		for (const url of megaUrls(detail)) expect(objectUrls.live.has(url)).toBe(true);
	});

	it("cacheRange stores a generation's artwork and shiny images without holding them, so it leaves the open detail's URLs live", async () => {
		const { client, cache, objectUrls, repository } = makeRepository(300);
		client.imageSize = 100;
		const open = extrasUrls(await extrasOf(repository, 10, "official-artwork"));

		await repository.cacheRange({ id: 1, name: "Test Gen", start: 1, end: 3 }, "official-artwork");

		for (const url of open) expect(objectUrls.live.has(url)).toBe(true);
		// Only the three table sprites were turned into URLs.
		expect(objectUrls.create).toHaveBeenCalledTimes(open.length + 3);
		for (const id of [1, 2, 3]) {
			for (const suffix of ["artwork", "shiny", "shiny-artwork"]) {
				expect(await cache.exists(`images/${id}-${suffix}.png`)).toBe(true);
			}
		}
	});

	// The one exception to "never exceed the budget": the caller is about to
	// show the image, and an untracked URL could never be revoked.
	it("holds a single image larger than the whole budget on its own", async () => {
		const { client, objectUrls, repository } = makeRepository(50);
		client.imageSize = 100;

		const urls = extrasUrls(await extrasOf(repository, 2, "official-artwork"));

		expect(urls).toHaveLength(3);
		expect(objectUrls.live.size).toBe(1);
		expect(urls).toContain([...objectUrls.live.keys()][0]);
	});

	it("leaves no URL behind when an image load spans clearAll and a second load of the same image", async () => {
		const { client, objectUrls, repository } = makeRepository();
		let release = (): void => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		client.fetchImageBinary.mockImplementation(async () => {
			await gate;
			return new ArrayBuffer(4);
		});

		const first = extrasOf(repository, 2, "official-artwork");
		await vi.waitFor(() => expect(client.fetchImageBinary).toHaveBeenCalledTimes(3));
		await repository.clearAll();
		const second = extrasOf(repository, 2, "official-artwork");
		// Both loads are now fetching the same three images, undeduplicated.
		await vi.waitFor(() => expect(client.fetchImageBinary).toHaveBeenCalledTimes(6));
		release();
		await Promise.all([first, second]);
		await repository.clearAll();

		expect(objectUrls.live.size).toBe(0);
	});

	it("cacheRange over an already-cached generation downloads no image", async () => {
		const { client, repository } = makeRepository();
		const gen = { id: 1, name: "Test Gen", start: 1, end: 2 };
		await repository.cacheRange(gen, "official-artwork");
		client.fetchImageBinary.mockClear();

		await repository.cacheRange(gen, "official-artwork");

		expect(client.fetchImageBinary).not.toHaveBeenCalled();
	});

	// The core sprite is required whichever way the Entry load treats images:
	// a held load rejects, so a stored one must not report success.
	it("an Entry load rejects when the core sprite fails, with images stored as with images held", async () => {
		const { client, repository } = makeRepository();
		failImagesWhere(client, (url) => url === bulbasaur.sprites.front_default);

		await expect(repository.loadEntry(2, { images: "store", render: () => "official-artwork" })).rejects.toThrow();
		await expect(repository.loadEntry(3, { images: "hold", render: () => "official-artwork" })).rejects.toThrow();
	});

	it("an Entry load with images stored skips a failed large image and stores the rest", async () => {
		const { client, cache, repository } = makeRepository();
		failImagesWhere(client, (url) => url === bulbasaur.sprites.other["official-artwork"].front_default);

		await repository.loadEntry(2, { images: "store", render: () => "official-artwork" });

		expect(await cache.exists("images/2-artwork.png")).toBe(false);
		for (const suffix of ["sprite", "shiny", "shiny-artwork"]) {
			expect(await cache.exists(`images/2-${suffix}.png`)).toBe(true);
		}
	});

	it("maps a held URL back to its cache path, and forgets it once evicted", async () => {
		const { client, repository } = makeRepository(300);
		client.imageSize = 100;

		const { artworkDataUri } = await extrasOf(repository, 2, "official-artwork");
		expect(repository.imagePathOf(artworkDataUri ?? "")).toBe("images/2-artwork.png");

		await extrasOf(repository, 3, "official-artwork");
		expect(repository.imagePathOf(artworkDataUri ?? "")).toBeNull();
	});
});
