import type { DataAdapter } from "obsidian";
import { vi } from "vitest";
import { PokeApiClient } from "../PokeApiClient";
import type { RawEvolutionChain, RawPokemon, RawPokemonListResponse, RawSpecies } from "../types";
import bulbasaurChain from "./bulbasaur-evolution-chain.json";
import bulbasaurSpecies from "./bulbasaur-species.json";
import bulbasaur from "./bulbasaur.json";

// In-memory DataAdapter covering only the methods DiskCache actually calls
// (exists/read/write/readBinary/writeBinary/mkdir/rmdir/list/stat). Typed as
// Partial<DataAdapter> and cast, rather than implementing Obsidian's full
// ~15-method adapter interface for methods nothing here ever touches.
export function createFakeDataAdapter(): DataAdapter {
	const files = new Map<string, string | ArrayBuffer>();
	const folders = new Set<string>();

	const isDirectChild = (path: string, prefix: string): boolean =>
		path.startsWith(prefix) && !path.slice(prefix.length).includes("/");

	const adapter: Partial<DataAdapter> = {
		async exists(path) {
			return files.has(path) || folders.has(path);
		},
		async stat(path) {
			if (files.has(path)) {
				const content = files.get(path);
				const size = typeof content === "string" ? content.length : (content?.byteLength ?? 0);
				return { type: "file", ctime: 0, mtime: 0, size };
			}
			if (folders.has(path)) return { type: "folder", ctime: 0, mtime: 0, size: 0 };
			return null;
		},
		async list(path) {
			const prefix = `${path}/`;
			return {
				files: [...files.keys()].filter((p) => isDirectChild(p, prefix)),
				folders: [...folders].filter((p) => isDirectChild(p, prefix)),
			};
		},
		async read(path) {
			const content = files.get(path);
			return typeof content === "string" ? content : "";
		},
		async readBinary(path) {
			const content = files.get(path);
			return content instanceof ArrayBuffer ? content : new ArrayBuffer(0);
		},
		async write(path, data) {
			files.set(path, data);
		},
		async writeBinary(path, data) {
			files.set(path, data);
		},
		async mkdir(path) {
			folders.add(path);
		},
		async rmdir(path, recursive) {
			folders.delete(path);
			files.delete(path);
			if (recursive) {
				const prefix = `${path}/`;
				for (const p of [...files.keys()]) if (p.startsWith(prefix)) files.delete(p);
				for (const p of folders) if (p.startsWith(prefix)) folders.delete(p);
			}
		},
	};

	return adapter as DataAdapter;
}

// Subclasses PokeApiClient (rather than a standalone object) so it satisfies
// PokedexRepository's constructor type without any interface change there —
// PokeApiClient's constructor is trivial and its only private member
// (getJson) is never called since every public method is overridden.
export class FakePokeApiClient extends PokeApiClient {
	failIds = new Set<number>();
	failEvolutionChain = false;

	fetchPokemon = vi.fn(async (idOrName: number | string): Promise<RawPokemon> => {
		const id = Number(idOrName);
		if (this.failIds.has(id)) throw new Error(`fake failure fetching pokemon ${id}`);
		return { ...(bulbasaur as unknown as RawPokemon), id };
	});

	fetchSpecies = vi.fn(async (idOrName: number | string): Promise<RawSpecies> => {
		const id = Number(idOrName);
		if (this.failIds.has(id)) throw new Error(`fake failure fetching species ${id}`);
		return { ...bulbasaurSpecies, id };
	});

	fetchEvolutionChain = vi.fn(async (): Promise<RawEvolutionChain> => {
		if (this.failEvolutionChain) throw new Error("fake failure fetching evolution chain");
		return bulbasaurChain;
	});

	fetchImageBinary = vi.fn(async (): Promise<ArrayBuffer> => new ArrayBuffer(4));

	fetchPokemonList = vi.fn(async (): Promise<RawPokemonListResponse> => {
		throw new Error("FakePokeApiClient.fetchPokemonList not implemented — unused by PokedexRepository");
	});
}
