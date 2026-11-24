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
		const { repository, loadState } = makeLoadState();
		await loadState.load(1, "home");
		const getEntryExtras = vi.spyOn(repository, "getEntryExtras");

		await loadState.setRender("home");

		expect(getEntryExtras).not.toHaveBeenCalled();
	});

	it("setRender() drops its answer once another entry has started loading", async () => {
		const { repository, loadState } = makeLoadState();
		await loadState.load(1, "official-artwork");

		// Holds entry 1's answer until entry 2 has loaded, so it lands late.
		const getEntryExtras = repository.getEntryExtras.bind(repository);
		let release!: () => void;
		const held = new Promise<void>((resolve) => (release = resolve));
		vi.spyOn(repository, "getEntryExtras").mockImplementation(async (id, render) => {
			if (id === 1) await held;
			return getEntryExtras(id, render);
		});

		const switched = loadState.setRender("home");
		await loadState.load(2, "home");
		release();
		await switched;

		expect(loadState.entry!.id).toBe(2);
		expect(repository.imagePathOf(loadState.entry!.artworkDataUri!)).toBe("images/2-home.png");
	});

	// The race a render on the repository used to lose: load()'s extras, asked
	// for in artwork, landed after the switch's HOME ones and overwrote them.
	it("a render switch while load()'s extras are in flight leaves the new render", async () => {
		const { repository, loadState } = makeLoadState();
		const getEntryExtras = repository.getEntryExtras.bind(repository);
		let release!: () => void;
		const held = new Promise<void>((resolve) => (release = resolve));
		vi.spyOn(repository, "getEntryExtras").mockImplementation(async (id, render) => {
			const answer = getEntryExtras(id, render);
			if (render === "official-artwork") await held;
			return answer;
		});

		const load = loadState.load(1, "official-artwork");
		await tick();
		await loadState.setRender("home");
		release();
		await load;

		expect(repository.imagePathOf(loadState.entry!.artworkDataUri!)).toBe("images/1-home.png");
		expect(loadState.error).toBeNull();
	});

	it("a superseded extras request that fails is not the entry's error", async () => {
		const { repository, loadState } = makeLoadState();
		const getEntryExtras = repository.getEntryExtras.bind(repository);
		let release!: () => void;
		const held = new Promise<void>((resolve) => (release = resolve));
		vi.spyOn(repository, "getEntryExtras").mockImplementation(async (id, render) => {
			if (render === "official-artwork") {
				await held;
				throw new Error("network down");
			}
			return getEntryExtras(id, render);
		});

		const load = loadState.load(1, "official-artwork");
		await tick();
		await loadState.setRender("home");
		release();
		await load;

		expect(loadState.error).toBeNull();
		expect(repository.imagePathOf(loadState.entry!.artworkDataUri!)).toBe("images/1-home.png");
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
		const { repository, loadState } = makeLoadState();
		const getMoveDetailsForMoves = repository.getMoveDetailsForMoves.bind(repository);
		let release!: () => void;
		const held = new Promise<void>((resolve) => (release = resolve));
		vi.spyOn(repository, "getMoveDetailsForMoves").mockImplementation(async (names, onDetail) => {
			await held;
			return getMoveDetailsForMoves(names, onDetail);
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
