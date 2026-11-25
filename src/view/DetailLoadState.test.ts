import { describe, expect, it, vi } from "vitest";
import { FakePokeApiClient, MemoryCacheStore } from "../data/__fixtures__/fakes";
import { collectChainIds } from "../data/normalize";
import { PokedexRepository } from "../data/PokedexRepository";
import type { RawEvolutionChain, RawEvolutionChainLink, RawPokemon } from "../data/types";
import bulbasaur from "../data/__fixtures__/bulbasaur.json";
import bulbasaurChain from "../data/__fixtures__/bulbasaur-evolution-chain.json";
import { DetailLoadState } from "./DetailLoadState";

function makeLoadState() {
	const client = new FakePokeApiClient();
	const cache = new MemoryCacheStore();
	const repository = new PokedexRepository(client, cache);
	return { client, cache, repository, loadState: new DetailLoadState(repository) };
}

function withDefaults(raw: RawEvolutionChain): RawEvolutionChain {
	const link = (l: RawEvolutionChainLink): RawEvolutionChainLink => ({
		...l,
		evolution_details: l.evolution_details.map((d) => ({ ...d, is_default: true })),
		evolves_to: l.evolves_to.map(link),
	});
	return { ...raw, chain: link(raw.chain) };
}

function tick(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

const ARTWORK_URL = (bulbasaur as unknown as RawPokemon).sprites.other!["official-artwork"]!.front_default!;

// Holds the client's answer to the first fetch of `url` until the returned
// release() is called; every other fetch answers at once.
function holdFirstImage(client: FakePokeApiClient, url: string): () => void {
	const fetchImageBinary = client.fetchImageBinary.getMockImplementation()!;
	let release!: () => void;
	const held = new Promise<void>((resolve) => (release = resolve));
	let first = true;
	client.fetchImageBinary.mockImplementation(async (requested) => {
		if (requested === url && first) {
			first = false;
			await held;
		}
		return fetchImageBinary(requested);
	});
	return release;
}

describe("DetailLoadState", () => {
	it("load() populates entry and flips loading off", async () => {
		const { loadState } = makeLoadState();
		expect(loadState.loading).toBe(true);

		await loadState.load(1, "official-artwork");

		expect(loadState.loading).toBe(false);
		expect(loadState.entry?.id).toBe(1);
		expect(loadState.error).toBeNull();
	});

	it("setRender() swaps in the new render's images, keeping the rest of the entry", async () => {
		const { repository, loadState } = makeLoadState();
		await loadState.load(1, "official-artwork");
		const before = loadState.entry!;
		expect(repository.imagePathOf(before.artworkDataUri!)).toBe("images/1-artwork.png");
		let updates = 0;

		await loadState.setRender("home", () => updates++);

		expect(repository.imagePathOf(loadState.entry!.artworkDataUri!)).toBe("images/1-home.png");
		expect(repository.imagePathOf(loadState.entry!.shinyArtworkDataUri!)).toBe("images/1-shiny-home.png");
		expect(loadState.entry!.evolutionChain).toEqual(before.evolutionChain);
		expect(updates).toBeGreaterThan(0);
	});

	it("setRender() with the render already loaded asks for nothing", async () => {
		const { loadState } = makeLoadState();
		await loadState.load(1, "home");
		let updates = 0;

		await loadState.setRender("home", () => updates++);

		expect(updates).toBe(0);
	});

	it("setRender() drops its answer once another entry has started loading", async () => {
		const { client, repository, loadState } = makeLoadState();
		await loadState.load(1, "official-artwork");
		// The fixture has no HOME image, so HOME reads the artwork URL (under
		// its own path). Entry 1's HOME image is the first fetch of it.
		const release = holdFirstImage(client, ARTWORK_URL);

		const switched = loadState.setRender("home");
		await loadState.load(2, "home");
		release();
		await switched;

		expect(loadState.entry!.id).toBe(2);
		expect(repository.imagePathOf(loadState.entry!.artworkDataUri!)).toBe("images/2-home.png");
	});

	// The race a render on the repository used to lose: load()'s extras, asked
	// for in artwork, landed after the switch's HOME ones and overwrote them.
	// Held at the client, so it holds load()'s extras whichever repository
	// method runs them.
	it("a render switch while load()'s extras are in flight leaves the new render", async () => {
		const { client, repository, loadState } = makeLoadState();
		const release = holdFirstImage(client, ARTWORK_URL);

		const load = loadState.load(1, "official-artwork");
		await vi.waitFor(() => expect(client.fetchImageBinary).toHaveBeenCalledWith(ARTWORK_URL));
		await loadState.setRender("home");
		release();
		await load;

		expect(repository.imagePathOf(loadState.entry!.artworkDataUri!)).toBe("images/1-home.png");
		expect(loadState.error).toBeNull();
	});

	it("a superseded load that fails is not the entry's error", async () => {
		const { client, loadState } = makeLoadState();
		let fail!: () => void;
		const failed = new Promise<never>((_, reject) => (fail = () => reject(new Error("network down"))));
		client.fetchPokemon.mockImplementationOnce(() => failed);

		// Id 4 sits outside the fixture's chain (1-3), so load(3) never waits on it.
		const first = loadState.load(4, "official-artwork");
		await loadState.load(3, "official-artwork");
		fail();
		await first;

		expect(loadState.error).toBeNull();
		expect(loadState.entry?.id).toBe(3);
	});

	it("a superseded load's chain members never land on the next entry", async () => {
		const { client, loadState } = makeLoadState();
		// Id 4 is a one-member chain of its own, so a superseded load(1)'s
		// members (1-3) are told apart from load(4)'s.
		const charmanderChain: RawEvolutionChain = {
			id: 2,
			chain: { species: { name: "charmander", url: "https://pokeapi.co/api/v2/pokemon-species/4/" }, evolution_details: [], evolves_to: [] },
		};
		const fetchPokemon = client.fetchPokemon.getMockImplementation()!;
		const fetchSpecies = client.fetchSpecies.getMockImplementation()!;
		const fetchEvolutionChain = client.fetchEvolutionChain.getMockImplementation()!;
		let release!: () => void;
		const held = new Promise<void>((resolve) => (release = resolve));
		client.fetchPokemon.mockImplementation(async (idOrName) => {
			// Ivysaur is first fetched as a chain member of load(1).
			if (idOrName === 2) await held;
			const pokemon = await fetchPokemon(idOrName);
			return idOrName === 4
				? { ...pokemon, name: "charmander", species: { name: "charmander", url: "https://pokeapi.co/api/v2/pokemon-species/4/" } }
				: pokemon;
		});
		client.fetchSpecies.mockImplementation(async (idOrName) => {
			const species = await fetchSpecies(idOrName);
			if (Number(idOrName) !== 4) return species;
			return {
				...species,
				name: "charmander",
				evolution_chain: { url: "https://pokeapi.co/api/v2/evolution-chain/2/" },
				varieties: [{ is_default: true, pokemon: { name: "charmander", url: "https://pokeapi.co/api/v2/pokemon/4/" } }],
			};
		});
		client.fetchEvolutionChain.mockImplementation(async (url) => (url.includes("/evolution-chain/2/") ? charmanderChain : fetchEvolutionChain(url)));

		const first = loadState.load(1, "official-artwork");
		await vi.waitFor(() => expect(client.fetchPokemon).toHaveBeenCalledWith(2));
		await loadState.load(4, "official-artwork");
		release();
		await first;

		expect(loadState.entry?.id).toBe(4);
		expect(Object.keys(loadState.evolutionSprites)).toEqual(["4"]);
	});

	it("a render switch before the core lands is the render the load's extras ask for", async () => {
		const { cache, repository, loadState } = makeLoadState();

		const load = loadState.load(1, "official-artwork");
		await loadState.setRender("home");
		await load;

		// The artwork render was never asked for, so it never reached the store.
		expect(await cache.exists("images/1-artwork.png")).toBe(false);
		expect(repository.imagePathOf(loadState.entry!.artworkDataUri!)).toBe("images/1-home.png");
	});

	it("a render switch mid-load keeps the load's move details landing", async () => {
		const { client, loadState } = makeLoadState();
		const fetchMove = client.fetchMove.getMockImplementation()!;
		let release!: () => void;
		const held = new Promise<void>((resolve) => (release = resolve));
		client.fetchMove.mockImplementation(async (name) => {
			await held;
			return fetchMove(name);
		});
		const seen: string[] = [];

		// load() resolves once its move pool settles, so it is awaited last.
		const load = loadState.load(1, "official-artwork", undefined, (name) => seen.push(name));
		await vi.waitFor(() => expect(loadState.entry?.evolutionChain).toBeTruthy());
		await loadState.setRender("home");
		release();
		await load;
		expect(seen.length).toBeGreaterThan(0);
	});

	// cacheRange runs the same detail-open plan (loadEntry) with images stored,
	// so a cached generation's detail screen needs nothing from the network:
	// its move pool, large images, evolution chain and the chain members
	// outside the cached range (Ivysaur and Venusaur, for a range of one) included.
	it("a detail screen in a generation cacheRange stored opens with no request", async () => {
		const { client, cache, repository } = makeLoadState();
		// As PokeAPI serves it since 2026-06: the bare fixture lacks is_default,
		// which reads as a pre-2026 cached chain and is refetched on every read.
		client.fetchEvolutionChain.mockResolvedValue(withDefaults(bulbasaurChain as unknown as RawEvolutionChain));
		await repository.cacheRange({ id: 1, name: "Test Gen", start: 1, end: 1 }, "official-artwork");
		// A new repository over the same store, so its memory caches answer nothing.
		const offline = new FakePokeApiClient();
		const requests = Object.values(offline).filter((value) => vi.isMockFunction(value));
		for (const request of requests) {
			request.mockImplementation(() => {
				throw new Error("offline");
			});
		}
		const loadState = new DetailLoadState(new PokedexRepository(offline, cache));

		await loadState.load(1, "official-artwork");

		expect(requests.length).toBeGreaterThan(5);
		for (const request of requests) expect(request.mock.calls).toEqual([]);
		const entry = loadState.entry!;
		expect(loadState.error).toBeNull();
		expect(entry.artworkDataUri).not.toBeNull();
		expect(entry.moves.length).toBeGreaterThan(0);
		for (const move of entry.moves) expect(loadState.moveDetails[move.name]).toBeDefined();
		const chainIds = collectChainIds(entry.evolutionChain!);
		expect(chainIds).toEqual([1, 2, 3]);
		for (const id of chainIds) {
			expect(loadState.evolutionSprites[id]).not.toBeNull();
			expect(loadState.evolutionTypes[id].length).toBeGreaterThan(0);
		}
	});

	it("load() merges evolution chain and sprites once extras resolve", async () => {
		const { loadState } = makeLoadState();

		await loadState.load(1, "official-artwork");

		expect(loadState.entry?.evolutionChain?.name).toBe("bulbasaur");
		const chainIds = [1, loadState.entry!.evolutionChain!.children[0].id];
		for (const id of chainIds) expect(loadState.evolutionSprites[id]).not.toBeNull();
	});

	it("onMoveDetail fires per move as the movepool settles, mirrored into moveDetails", async () => {
		const { loadState } = makeLoadState();
		const seen: string[] = [];

		await loadState.load(1, "official-artwork", undefined, (name) => seen.push(name));
		await tick();

		expect(seen.length).toBeGreaterThan(0);
		expect(loadState.moveDetails[seen[0]]).toBeDefined();
	});

	it("moveDetails is not reset by a later load() — accumulates across entries", async () => {
		const { loadState } = makeLoadState();

		await loadState.load(1, "official-artwork");
		await tick();
		const afterFirst = Object.keys(loadState.moveDetails).length;
		expect(afterFirst).toBeGreaterThan(0);

		await loadState.load(1, "official-artwork");
		await tick();

		expect(Object.keys(loadState.moveDetails).length).toBe(afterFirst);
	});

	it("records failure on error without touching entry, and a later load(id) can recover", async () => {
		const { client, loadState } = makeLoadState();
		client.failIds.add(1);

		await loadState.load(1, "official-artwork");

		expect(loadState.error).not.toBeNull();
		expect(loadState.entry).toBeNull();
		expect(loadState.loading).toBe(false);

		client.failIds.delete(1);
		await loadState.load(1, "official-artwork");

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

		const firstLoad = loadState.load(1, "official-artwork");
		const secondLoad = loadState.load(3, "official-artwork");
		resolveFirst({ ...(bulbasaur as unknown as RawPokemon), id: 1 });
		await Promise.all([firstLoad, secondLoad]);

		expect(loadState.entry?.id).toBe(3);
	});

	it("load() leaves entry/loading untouched when cancelled beforehand", async () => {
		const { loadState } = makeLoadState();
		loadState.cancel();

		await loadState.load(1, "official-artwork");

		expect(loadState.loading).toBe(true);
		expect(loadState.entry).toBeNull();
	});
});
