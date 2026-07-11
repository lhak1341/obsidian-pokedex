import { mapWithConcurrency } from "../utils/concurrency";
import { DiskCache } from "./Cache";
import { normalizeEvolutionChain, toEntry, toTableRow, trimMovesToVersionGroups } from "./normalize";
import { PokeApiClient } from "./PokeApiClient";
import type {
	EvolutionNode,
	PokedexEntry,
	PokedexTableRow,
	RawEvolutionChain,
	RawPokemon,
	RawSpecies,
} from "./types";

// Applies to both a cold load (real PokeAPI requests) and a warm one (pure
// disk reads once cached) — 10 is a modest increase over the previous 5 for
// PokeAPI's sake, but doubles a warm reload's throughput where the only real
// cost is disk I/O. withRetry's exponential backoff (see retry.ts) already
// absorbs an occasional 429 at this concurrency.
const FETCH_CONCURRENCY = 10;

export interface TableLoadResult {
	rows: PokedexTableRow[];
	failedIds: number[];
	servedFromCache: boolean;
}

// Facade the UI talks to: "give me row/entry data for id X", never worrying
// about whether that means a cache hit or a live PokeAPI call.
export class PokedexRepository {
	// Session-lifetime in-memory layer on top of DiskCache. The table reload
	// (settings change, tab close/reopen) is common — PokedexView remounts on
	// every settings save — and without this, each of those re-reads and
	// re-parses/re-base64-encodes the same ~400 files from disk even though
	// nothing on disk changed since the last read a moment ago.
	private pokemonMemCache = new Map<number, RawPokemon>();
	private speciesMemCache = new Map<number, RawSpecies>();
	private evolutionChainMemCache = new Map<string, RawEvolutionChain>();
	private imageMemCache = new Map<string, string>();

	constructor(
		private client: PokeApiClient,
		private cache: DiskCache,
	) {}

	private async getOrFetchPokemon(id: number): Promise<RawPokemon> {
		const mem = this.pokemonMemCache.get(id);
		if (mem) return mem;
		const cached = await this.cache.readJson<RawPokemon>(`pokemon/${id}.json`);
		if (cached) {
			// Self-heals a cache written before trimMovesToVersionGroups existed
			// (a full, untrimmed moves array) by rewriting it trimmed the first
			// time it's read, rather than requiring a manual cache clear.
			const trimmedMoves = trimMovesToVersionGroups(cached.moves);
			if (trimmedMoves.length !== cached.moves.length) {
				const migrated: RawPokemon = { ...cached, moves: trimmedMoves };
				await this.cache.writeJson(`pokemon/${id}.json`, migrated);
				this.pokemonMemCache.set(id, migrated);
				return migrated;
			}
			this.pokemonMemCache.set(id, cached);
			return cached;
		}
		const fresh = await this.client.fetchPokemon(id);
		// See trimMovesToVersionGroups: strips the ~20 version groups this
		// plugin never reads before it's written to disk / kept in memory.
		const trimmed: RawPokemon = { ...fresh, moves: trimMovesToVersionGroups(fresh.moves) };
		await this.cache.writeJson(`pokemon/${id}.json`, trimmed);
		this.pokemonMemCache.set(id, trimmed);
		return trimmed;
	}

	private async getOrFetchSpecies(id: number): Promise<RawSpecies> {
		const mem = this.speciesMemCache.get(id);
		if (mem) return mem;
		const cached = await this.cache.readJson<RawSpecies>(`species/${id}.json`);
		if (cached) {
			this.speciesMemCache.set(id, cached);
			return cached;
		}
		const fresh = await this.client.fetchSpecies(id);
		await this.cache.writeJson(`species/${id}.json`, fresh);
		this.speciesMemCache.set(id, fresh);
		return fresh;
	}

	private async getOrFetchEvolutionChain(url: string): Promise<RawEvolutionChain> {
		const chainId = url.match(/\/(\d+)\/?$/)?.[1] ?? "unknown";
		const mem = this.evolutionChainMemCache.get(chainId);
		if (mem) return mem;
		const cached = await this.cache.readJson<RawEvolutionChain>(`evolution-chain/${chainId}.json`);
		if (cached) {
			this.evolutionChainMemCache.set(chainId, cached);
			return cached;
		}
		const fresh = await this.client.fetchEvolutionChain(url);
		await this.cache.writeJson(`evolution-chain/${chainId}.json`, fresh);
		this.evolutionChainMemCache.set(chainId, fresh);
		return fresh;
	}

	private async getOrFetchImage(url: string | null, relPath: string): Promise<string | null> {
		if (!url) return null;
		const mem = this.imageMemCache.get(relPath);
		if (mem) return mem;
		const cached = await this.cache.readImageDataUri(relPath);
		if (cached) {
			this.imageMemCache.set(relPath, cached);
			return cached;
		}
		const buffer = await this.client.fetchImageBinary(url);
		await this.cache.writeImageBinary(relPath, buffer);
		const dataUri = await this.cache.readImageDataUri(relPath);
		if (dataUri) this.imageMemCache.set(relPath, dataUri);
		return dataUri;
	}

	// Fetches/caches table rows (pokemon + species, for catch rate/hatch
	// counter columns) for an explicit list of ids. Bounded concurrency; per
	// Q12, a single id failing doesn't abort the rest — it's reported in
	// `failedIds` and the caller shows a Notice. Also the retry path: passing
	// previously-failed ids re-attempts just those (a failed id was never
	// cached, so `getOrFetchPokemon`/`getOrFetchSpecies` fetch fresh rather
	// than returning a stale miss).
	//
	// `isCancelled` lets a caller whose view has since closed/remounted stop
	// this from continuing to fetch ids nobody's waiting on anymore — see
	// PokedexLoadState, which is the thing that actually goes stale.
	private async getRowsForIds(
		ids: number[],
		onProgress?: (loaded: number, total: number) => void,
		isCancelled?: () => boolean,
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
			isCancelled,
		);

		rows.sort((a, b) => a.id - b.id);
		return { rows, failedIds, servedFromCache: failedIds.length === 0 };
	}

	async getTableRows(
		range: { start: number; end: number },
		onProgress?: (loaded: number, total: number) => void,
		isCancelled?: () => boolean,
	): Promise<TableLoadResult> {
		const ids = Array.from(
			{ length: range.end - range.start + 1 },
			(_, i) => range.start + i,
		);
		return this.getRowsForIds(ids, onProgress, isCancelled);
	}

	async retryRows(
		ids: number[],
		onProgress?: (loaded: number, total: number) => void,
		isCancelled?: () => boolean,
	): Promise<TableLoadResult> {
		return this.getRowsForIds(ids, onProgress, isCancelled);
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
