import { requestUrl } from "obsidian";
import { Semaphore } from "../utils/concurrency";
import { withRetry } from "../utils/retry";
import { POKEAPI_BASE } from "./constants";
import type {
	RawAbility,
	RawEvolutionChain,
	RawItem,
	RawMove,
	RawPokemon,
	RawPokemonListResponse,
	RawSpecies,
} from "./types";

export class HttpError extends Error {
	constructor(public status: number, url: string) {
		super(`PokeAPI request failed (${status}): ${url}`);
	}
}

// Caps how many live PokeAPI requests are in flight at once, enforced at the
// actual HTTP call site rather than by whatever concurrency each caller's own
// id-fetch loop happens to run at — a caller that's stopped pre-partitioning
// cache hits from misses (see PokedexRepository.getRowsForIds) can now just
// dispatch every id at a single high concurrency, since a cache-hit id never
// reaches this class at all and a cache-miss one is still rate-limited here
// regardless of how many other ids are "in flight" one layer up.
const NETWORK_CONCURRENCY = 10;

// Thin wrapper around PokeAPI. Uses Obsidian's requestUrl instead of fetch so
// requests aren't subject to the page's CORS/CSP restrictions. Every call is
// wrapped in exponential-backoff retry so one dropped connection during the
// bulk cache warm-up doesn't immediately count as a failed id (a real 404,
// which will never succeed, is not retried).
export class PokeApiClient {
	private semaphore = new Semaphore(NETWORK_CONCURRENCY);

	private async getJson<T>(url: string): Promise<T> {
		return this.semaphore.run(() =>
			withRetry(async () => {
				const response = await requestUrl({ url, method: "GET", throw: false });
				if (response.status < 200 || response.status >= 300) {
					throw new HttpError(response.status, url);
				}
				return response.json as T;
			}),
		);
	}

	async fetchPokemon(idOrName: number | string): Promise<RawPokemon> {
		return this.getJson<RawPokemon>(`${POKEAPI_BASE}/pokemon/${idOrName}`);
	}

	async fetchSpecies(idOrName: number | string): Promise<RawSpecies> {
		return this.getJson<RawSpecies>(`${POKEAPI_BASE}/pokemon-species/${idOrName}`);
	}

	async fetchEvolutionChain(url: string): Promise<RawEvolutionChain> {
		return this.getJson<RawEvolutionChain>(url);
	}

	async fetchAbility(name: string): Promise<RawAbility> {
		return this.getJson<RawAbility>(`${POKEAPI_BASE}/ability/${name}`);
	}

	async fetchItem(name: string): Promise<RawItem> {
		return this.getJson<RawItem>(`${POKEAPI_BASE}/item/${name}`);
	}

	async fetchMove(name: string): Promise<RawMove> {
		return this.getJson<RawMove>(`${POKEAPI_BASE}/move/${name}`);
	}

	async fetchPokemonList(limit: number, offset: number): Promise<RawPokemonListResponse> {
		return this.getJson<RawPokemonListResponse>(
			`${POKEAPI_BASE}/pokemon?limit=${limit}&offset=${offset}`,
		);
	}

	async fetchImageBinary(url: string): Promise<ArrayBuffer> {
		return this.semaphore.run(() =>
			withRetry(async () => {
				const response = await requestUrl({ url, method: "GET", throw: false });
				if (response.status < 200 || response.status >= 300) {
					throw new HttpError(response.status, url);
				}
				return response.arrayBuffer;
			}),
		);
	}
}
