import { mapWithConcurrency } from "../utils/concurrency";
import { DiskCache } from "./Cache";
import { normalizeEvolutionChain, toEntry, toTableRow } from "./normalize";
import { PokeApiClient } from "./PokeApiClient";
import type {
	EvolutionNode,
	PokedexEntry,
	PokedexTableRow,
	RawEvolutionChain,
	RawPokemon,
	RawSpecies,
} from "./types";

const FETCH_CONCURRENCY = 5;

export interface TableLoadResult {
	rows: PokedexTableRow[];
	failedIds: number[];
	servedFromCache: boolean;
}

// Facade the UI talks to: "give me row/entry data for id X", never worrying
// about whether that means a cache hit or a live PokeAPI call.
export class PokedexRepository {
	constructor(
		private client: PokeApiClient,
		private cache: DiskCache,
	) {}

	private async getOrFetchPokemon(id: number): Promise<RawPokemon> {
		const cached = await this.cache.readJson<RawPokemon>(`pokemon/${id}.json`);
		if (cached) return cached;
		const fresh = await this.client.fetchPokemon(id);
		await this.cache.writeJson(`pokemon/${id}.json`, fresh);
		return fresh;
	}

	private async getOrFetchSpecies(id: number): Promise<RawSpecies> {
		const cached = await this.cache.readJson<RawSpecies>(`species/${id}.json`);
		if (cached) return cached;
		const fresh = await this.client.fetchSpecies(id);
		await this.cache.writeJson(`species/${id}.json`, fresh);
		return fresh;
	}

	private async getOrFetchEvolutionChain(url: string): Promise<RawEvolutionChain> {
		const chainId = url.match(/\/(\d+)\/?$/)?.[1] ?? "unknown";
		const cached = await this.cache.readJson<RawEvolutionChain>(`evolution-chain/${chainId}.json`);
		if (cached) return cached;
		const fresh = await this.client.fetchEvolutionChain(url);
		await this.cache.writeJson(`evolution-chain/${chainId}.json`, fresh);
		return fresh;
	}

	private async getOrFetchImage(url: string | null, relPath: string): Promise<string | null> {
		if (!url) return null;
		const cached = await this.cache.readImageDataUri(relPath);
		if (cached) return cached;
		const buffer = await this.client.fetchImageBinary(url);
		await this.cache.writeImageBinary(relPath, buffer);
		return this.cache.readImageDataUri(relPath);
	}

	// Fetches/caches table rows (pokemon + species, for catch rate/hatch
	// counter columns) for an explicit list of ids. Bounded concurrency; per
	// Q12, a single id failing doesn't abort the rest — it's reported in
	// `failedIds` and the caller shows a Notice. Also the retry path: passing
	// previously-failed ids re-attempts just those (a failed id was never
	// cached, so `getOrFetchPokemon`/`getOrFetchSpecies` fetch fresh rather
	// than returning a stale miss).
	private async getRowsForIds(
		ids: number[],
		onProgress?: (loaded: number, total: number) => void,
	): Promise<TableLoadResult> {
		const rows: PokedexTableRow[] = [];
		const failedIds: number[] = [];
		let loaded = 0;

		await mapWithConcurrency(
			ids,
			FETCH_CONCURRENCY,
			async (id) => {
				const [pokemon, species] = await Promise.all([
					this.getOrFetchPokemon(id),
					this.getOrFetchSpecies(id),
				]);
				const sprite = await this.getOrFetchImage(
					pokemon.sprites.front_default,
					`images/${id}-sprite.png`,
				);
				return toTableRow(pokemon, species, sprite);
			},
			(result) => {
				loaded++;
				onProgress?.(loaded, ids.length);
				if ("value" in result) rows.push(result.value);
				else failedIds.push(ids[result.index]);
			},
		);

		rows.sort((a, b) => a.id - b.id);
		return { rows, failedIds, servedFromCache: failedIds.length === 0 };
	}

	async getTableRows(
		range: { start: number; end: number },
		onProgress?: (loaded: number, total: number) => void,
	): Promise<TableLoadResult> {
		const ids = Array.from(
			{ length: range.end - range.start + 1 },
			(_, i) => range.start + i,
		);
		return this.getRowsForIds(ids, onProgress);
	}

	async retryRows(
		ids: number[],
		onProgress?: (loaded: number, total: number) => void,
	): Promise<TableLoadResult> {
		return this.getRowsForIds(ids, onProgress);
	}

	async getEntry(id: number): Promise<PokedexEntry> {
		const pokemon = await this.getOrFetchPokemon(id);
		const species = await this.getOrFetchSpecies(id);

		let evolutionChain: EvolutionNode | null = null;
		try {
			const rawChain = await this.getOrFetchEvolutionChain(species.evolution_chain.url);
			evolutionChain = normalizeEvolutionChain(rawChain.chain);
		} catch {
			evolutionChain = null; // non-fatal: detail view still renders without it
		}

		const [sprite, artwork, shiny] = await Promise.all([
			this.getOrFetchImage(pokemon.sprites.front_default, `images/${id}-sprite.png`),
			this.getOrFetchImage(
				pokemon.sprites.other?.["official-artwork"]?.front_default ?? null,
				`images/${id}-artwork.png`,
			),
			this.getOrFetchImage(pokemon.sprites.front_shiny, `images/${id}-shiny.png`),
		]);

		return toEntry(pokemon, species, evolutionChain, { sprite, artwork, shiny });
	}
}
