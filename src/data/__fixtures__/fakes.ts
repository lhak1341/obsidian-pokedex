import type { DataAdapter } from "obsidian";
import { vi } from "vitest";
import { PokeApiClient } from "../PokeApiClient";
import type {
	RawAbility,
	RawEvolutionChain,
	RawMove,
	RawPokemon,
	RawPokemonListResponse,
	RawSpecies,
} from "../types";
import bulbasaurChain from "./bulbasaur-evolution-chain.json";
import bulbasaurSpecies from "./bulbasaur-species.json";
import bulbasaur from "./bulbasaur.json";

// In-memory DataAdapter covering only the methods DiskCache actually calls
// (exists/read/write/readBinary/writeBinary/mkdir/rmdir/list/stat/remove/
// rename). Typed as Partial<DataAdapter> and cast, rather than implementing
// Obsidian's full ~15-method adapter interface for methods nothing here ever
// touches.
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
		// Real Obsidian (Node fs under the hood) rejects read/readBinary for a
		// missing path rather than returning empty content — matched here so
		// DiskCache's try/catch-based "missing file" handling is exercised the
		// same way tests run as it will against the real adapter.
		async read(path) {
			const content = files.get(path);
			if (typeof content !== "string") throw new Error(`ENOENT: ${path}`);
			return content;
		},
		async readBinary(path) {
			const content = files.get(path);
			if (!(content instanceof ArrayBuffer)) throw new Error(`ENOENT: ${path}`);
			return content;
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
		async remove(path) {
			files.delete(path);
		},
		async rename(path, newPath) {
			const prefix = `${path}/`;
			for (const [p, content] of [...files.entries()]) {
				if (p === path) {
					files.delete(p);
					files.set(newPath, content);
				} else if (p.startsWith(prefix)) {
					files.delete(p);
					files.set(`${newPath}/${p.slice(prefix.length)}`, content);
				}
			}
			for (const p of [...folders]) {
				if (p === path) {
					folders.delete(p);
					folders.add(newPath);
				} else if (p.startsWith(prefix)) {
					folders.delete(p);
					folders.add(`${newPath}/${p.slice(prefix.length)}`);
				}
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
	failImage = false;
	failAbility = false;
	failMoves = new Set<string>();

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

	fetchImageBinary = vi.fn(async (): Promise<ArrayBuffer> => {
		if (this.failImage) throw new Error("fake failure fetching image");
		return new ArrayBuffer(4);
	});

	fetchAbility = vi.fn(async (name: string): Promise<RawAbility> => {
		if (this.failAbility) throw new Error(`fake failure fetching ability ${name}`);
		return {
			name,
			effect_entries: [
				{ effect: `${name} full effect`, short_effect: `${name} short effect`, language: { name: "en", url: "" } },
			],
		};
	});

	fetchMove = vi.fn(async (name: string): Promise<RawMove> => {
		if (this.failMoves.has(name)) throw new Error(`fake failure fetching move ${name}`);
		return {
			name,
			power: 40,
			accuracy: 100,
			pp: 35,
			type: { name: "normal", url: "" },
			flavor_text_entries: [
				{
					flavor_text: `${name} FRLG description`,
					language: { name: "en", url: "" },
					version_group: { name: "firered-leafgreen", url: "" },
				},
			],
		};
	});

	fetchPokemonList = vi.fn(async (): Promise<RawPokemonListResponse> => {
		throw new Error("FakePokeApiClient.fetchPokemonList not implemented — unused by PokedexRepository");
	});
}
