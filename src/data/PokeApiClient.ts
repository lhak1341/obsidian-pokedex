import { requestUrl } from "obsidian";
import { withRetry } from "../utils/retry";
import { POKEAPI_BASE } from "./constants";
import type { RawEvolutionChain, RawPokemon, RawPokemonListResponse, RawSpecies } from "./types";

export class HttpError extends Error {
	constructor(public status: number, url: string) {
		super(`PokeAPI request failed (${status}): ${url}`);
	}
}

// Thin wrapper around PokeAPI. Uses Obsidian's requestUrl instead of fetch so
// requests aren't subject to the page's CORS/CSP restrictions. Every call is
// wrapped in exponential-backoff retry so one dropped connection during the
// bulk cache warm-up doesn't immediately count as a failed id (a real 404,
// which will never succeed, is not retried).
export class PokeApiClient {
	private async getJson<T>(url: string): Promise<T> {
		return withRetry(async () => {
			const response = await requestUrl({ url, method: "GET", throw: false });
			if (response.status < 200 || response.status >= 300) {
				throw new HttpError(response.status, url);
			}
			return response.json as T;
		});
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

	async fetchPokemonList(limit: number, offset: number): Promise<RawPokemonListResponse> {
		return this.getJson<RawPokemonListResponse>(
			`${POKEAPI_BASE}/pokemon?limit=${limit}&offset=${offset}`,
		);
	}

	async fetchImageBinary(url: string): Promise<ArrayBuffer> {
		return withRetry(async () => {
			const response = await requestUrl({ url, method: "GET", throw: false });
			if (response.status < 200 || response.status >= 300) {
				throw new HttpError(response.status, url);
			}
			return response.arrayBuffer;
		});
	}
}
