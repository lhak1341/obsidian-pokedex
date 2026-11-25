import type { DataAdapter } from "obsidian";
import { vi } from "vitest";
import type { CacheStore } from "../CacheStore";
import type { ObjectUrls } from "../ImageMemory";
import { PokeApiClient } from "../PokeApiClient";
import type { RawAbility, RawEvolutionChain, RawMove, RawPokemon, RawPokemonForm, RawSpecies } from "../types";
import bulbasaurChain from "./bulbasaur-evolution-chain.json";
import bulbasaurSpecies from "./bulbasaur-species.json";
import bulbasaur from "./bulbasaur.json";

// In-memory DataAdapter for code that touches vault files directly (today
// only legacyDiskCache.ts's one-time delete of the old cache folder, whose
// test seeds it with mkdir/write). Typed as Partial<DataAdapter> and cast,
// rather than implementing Obsidian's full adapter interface.
export function createFakeDataAdapter(): DataAdapter {
	const files = new Map<string, string>();
	const folders = new Set<string>();

	const adapter: Partial<DataAdapter> = {
		async exists(path) {
			return files.has(path) || folders.has(path);
		},
		async write(path, data) {
			files.set(path, data);
		},
		async mkdir(path) {
			folders.add(path);
		},
		async rmdir(path, recursive) {
			folders.delete(path);
			if (recursive) {
				const prefix = `${path}/`;
				for (const p of [...files.keys()]) if (p.startsWith(prefix)) files.delete(p);
				for (const p of [...folders]) if (p.startsWith(prefix)) folders.delete(p);
			}
		},
	};

	return adapter as DataAdapter;
}

// The test CacheStore: repository and load-state tests run against this,
// since the production IndexedDbCacheStore has no IndexedDB under vitest.
export class MemoryCacheStore implements CacheStore {
	private entries = new Map<string, string | ArrayBuffer>();

	async readJson<T>(key: string): Promise<T | null> {
		const content = this.entries.get(key);
		return typeof content === "string" ? (JSON.parse(content) as T) : null;
	}

	// Stored serialized (IndexedDB structured-clones), so a caller mutating
	// what it wrote or read can never alias the stored entry.
	async writeJson(key: string, data: unknown): Promise<void> {
		this.entries.set(key, JSON.stringify(data));
	}

	async readBinary(key: string): Promise<ArrayBuffer | null> {
		const content = this.entries.get(key);
		return content instanceof ArrayBuffer ? content : null;
	}

	async writeBinary(key: string, buffer: ArrayBuffer): Promise<void> {
		this.entries.set(key, buffer);
	}

	async exists(key: string): Promise<boolean> {
		return this.entries.has(key);
	}

	async remove(key: string): Promise<void> {
		this.entries.delete(key);
	}

	async listFilesIn(dir: string): Promise<string[]> {
		const prefix = `${dir}/`;
		return [...this.entries.keys()].filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes("/"));
	}

	async clear(): Promise<void> {
		this.entries.clear();
	}
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
	// Name-keyed fetches (Mega/regional-form varieties, e.g. "rattata-alola")
	// go through here instead of the numeric-id branch below — a test
	// populates this directly with whatever RawPokemon it wants that name to
	// resolve to, rather than this fake trying to synthesize one generically.
	variantPokemon = new Map<string, RawPokemon>();

	fetchPokemon = vi.fn(async (idOrName: number | string): Promise<RawPokemon> => {
		if (typeof idOrName === "string") {
			const variant = this.variantPokemon.get(idOrName);
			if (!variant) throw new Error(`fake failure fetching pokemon variant ${idOrName}`);
			return variant;
		}
		const id = idOrName;
		if (this.failIds.has(id)) throw new Error(`fake failure fetching pokemon ${id}`);
		return { ...(bulbasaur as unknown as RawPokemon), id };
	});

	fetchSpecies = vi.fn(async (idOrName: number | string): Promise<RawSpecies> => {
		const id = Number(idOrName);
		if (this.failIds.has(id)) throw new Error(`fake failure fetching species ${id}`);
		return { ...bulbasaurSpecies, id };
	});

	// Pokédex text per pokemon-form name; a name not set has none, as every
	// form but the Gen 7 ones does on PokeAPI.
	formFlavorTexts = new Map<string, RawPokemonForm["flavor_text_entries"]>();
	failForms = false;

	fetchPokemonForm = vi.fn(async (name: string): Promise<RawPokemonForm> => {
		if (this.failForms) throw new Error(`fake failure fetching pokemon-form ${name}`);
		return { flavor_text_entries: this.formFlavorTexts.get(name) ?? [] };
	});

	fetchEvolutionChain = vi.fn(async (_url: string): Promise<RawEvolutionChain> => {
		if (this.failEvolutionChain) throw new Error("fake failure fetching evolution chain");
		return bulbasaurChain as unknown as RawEvolutionChain;
	});

	// Bytes per fetched image; the image-memory budget tests raise it.
	imageSize = 4;

	fetchImageBinary = vi.fn(async (_url: string): Promise<ArrayBuffer> => {
		if (this.failImage) throw new Error("fake failure fetching image");
		return new ArrayBuffer(this.imageSize);
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
}

// Stands in for URL.createObjectURL/revokeObjectURL. `log` records each call
// as it happens, so a test can show an eviction revoked its URL at eviction
// time rather than at a later clear; `live` is every URL not yet revoked, and
// `peakLiveBytes` the most bytes they ever held at once.
export class RecordingObjectUrls implements ObjectUrls {
	log: string[] = [];
	live = new Map<string, Blob>();
	peakLiveBytes = 0;
	private next = 0;

	create = vi.fn((blob: Blob): string => {
		const url = `blob:fake/${this.next++}`;
		this.live.set(url, blob);
		this.log.push(`create ${url}`);
		this.peakLiveBytes = Math.max(this.peakLiveBytes, this.liveBytes());
		return url;
	});

	revoke = vi.fn((url: string): void => {
		this.live.delete(url);
		this.log.push(`revoke ${url}`);
	});

	liveBytes(): number {
		let total = 0;
		for (const blob of this.live.values()) total += blob.size;
		return total;
	}
}
