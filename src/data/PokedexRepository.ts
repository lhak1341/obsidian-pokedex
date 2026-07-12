import { mapWithConcurrency } from "../utils/concurrency";
import { DiskCache } from "./Cache";
import {
	normalizeEvolutionChain,
	normalizeMoveDetail,
	toEntry,
	toTableRow,
	trimFlavorTextEntries,
	trimMovesToVersionGroups,
} from "./normalize";
import { PokeApiClient } from "./PokeApiClient";
import type {
	EvolutionNode,
	MoveDetail,
	PokedexEntry,
	PokedexTableRow,
	RawEvolutionChain,
	RawPokemon,
	RawSpecies,
} from "./types";

// Network path (real PokeAPI requests) — kept low and PokeAPI-friendly.
// withRetry's exponential backoff (see retry.ts) already absorbs an
// occasional 429 at this concurrency.
const FETCH_CONCURRENCY = 10;

// Disk-only path (every id already on disk from a previous session, just not
// yet in this session's mem cache — e.g. every fresh Obsidian restart) has no
// external rate limit to respect, only local file I/O, so it can run far more
// in flight than the network path.
const DISK_READ_CONCURRENCY = 50;

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
	// Value is string | null (a real "no English description" result), so a
	// plain Map.has/get check (not `!== undefined`) is needed to tell "not
	// fetched yet" apart from "fetched, nothing found".
	private abilityDescriptionMemCache = new Map<string, string | null>();
	private moveDetailMemCache = new Map<string, MoveDetail>();

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
			// Self-heals a cache written before trimFlavorTextEntries existed (a
			// full, untrimmed flavor_text_entries array) the same way
			// getOrFetchPokemon does for moves.
			const trimmedFlavorText = trimFlavorTextEntries(cached.flavor_text_entries);
			if (trimmedFlavorText.length !== cached.flavor_text_entries.length) {
				const migrated: RawSpecies = { ...cached, flavor_text_entries: trimmedFlavorText };
				await this.cache.writeJson(`species/${id}.json`, migrated);
				this.speciesMemCache.set(id, migrated);
				return migrated;
			}
			this.speciesMemCache.set(id, cached);
			return cached;
		}
		const fresh = await this.client.fetchSpecies(id);
		const trimmed: RawSpecies = {
			...fresh,
			flavor_text_entries: trimFlavorTextEntries(fresh.flavor_text_entries),
		};
		await this.cache.writeJson(`species/${id}.json`, trimmed);
		this.speciesMemCache.set(id, trimmed);
		return trimmed;
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

	// Abilities repeat heavily across species (e.g. "levitate", "intimidate"),
	// so this is cached by ability name rather than per-Pokemon — fetched once
	// total across an entire browsing session, not once per entry. Called
	// lazily on hover from the detail view, not prefetched with the rest of
	// an entry's extras.
	async getAbilityDescription(name: string): Promise<string | null> {
		if (this.abilityDescriptionMemCache.has(name)) {
			return this.abilityDescriptionMemCache.get(name) ?? null;
		}
		const cached = await this.cache.readJson<{ description: string | null }>(`abilities/${name}.json`);
		if (cached) {
			this.abilityDescriptionMemCache.set(name, cached.description);
			return cached.description;
		}
		const fresh = await this.client.fetchAbility(name);
		const description =
			fresh.effect_entries.find((e) => e.language.name === "en")?.short_effect ?? null;
		await this.cache.writeJson(`abilities/${name}.json`, { description });
		this.abilityDescriptionMemCache.set(name, description);
		return description;
	}

	// Moves repeat even more heavily than abilities across species (e.g.
	// almost every Pokemon learns Tackle or Growl) — cached by move name for
	// the same reason. Unlike getAbilityDescription, a fetch failure here
	// isn't swallowed to null (there's no legitimate "empty" result for a
	// move's type/power/accuracy/PP) — it's left to reject so
	// getMoveDetailsForMoves' per-item error handling (via mapWithConcurrency)
	// can tell "failed" apart from "successfully has no power" (status moves).
	async getMoveDetails(name: string): Promise<MoveDetail> {
		const mem = this.moveDetailMemCache.get(name);
		if (mem) return mem;
		const cached = await this.cache.readJson<MoveDetail>(`moves/${name}.json`);
		if (cached) {
			this.moveDetailMemCache.set(name, cached);
			return cached;
		}
		const fresh = await this.client.fetchMove(name);
		const detail = normalizeMoveDetail(fresh);
		await this.cache.writeJson(`moves/${name}.json`, detail);
		this.moveDetailMemCache.set(name, detail);
		return detail;
	}

	// Fetches details for a whole movepool at FETCH_CONCURRENCY, reporting
	// each through `onResult` as it settles rather than blocking on the
	// slowest one — the detail view's move table can have 15-40+ rows, and
	// showing rows progressively as their data arrives beats a single long
	// wait. A move that fails to fetch is silently skipped (its row just
	// keeps showing the "…" loading placeholder) rather than surfaced as an
	// error — consistent with how a dropped shiny-sprite fetch elsewhere in
	// this repository doesn't take down the rest of the entry.
	async getMoveDetailsForMoves(
		names: string[],
		onResult: (name: string, detail: MoveDetail) => void,
	): Promise<void> {
		const uniqueNames = [...new Set(names)];
		await mapWithConcurrency(uniqueNames, FETCH_CONCURRENCY, (name) => this.getMoveDetails(name), (result) => {
			if ("value" in result) onResult(uniqueNames[result.index], result.value);
		});
	}

	// Splits `ids` into ones already sitting in mem/disk cache vs ones that
	// still need a network round-trip, using a cheap existence check (no JSON
	// parse) rather than actually reading either file. Lets the caller run the
	// cache-hit half at DISK_READ_CONCURRENCY and the miss half at the slower,
	// PokeAPI-friendly FETCH_CONCURRENCY instead of gating every id — cache hit
	// or not — behind the same throttle.
	private async partitionByCacheHit(
		ids: number[],
	): Promise<{ cached: number[]; uncached: number[] }> {
		const cached: number[] = [];
		const uncached: number[] = [];

		await mapWithConcurrency(ids, DISK_READ_CONCURRENCY, async (id) => {
			const hasPokemon =
				this.pokemonMemCache.has(id) || (await this.cache.exists(`pokemon/${id}.json`));
			const hasSpecies =
				this.speciesMemCache.has(id) || (await this.cache.exists(`species/${id}.json`));
			return hasPokemon && hasSpecies;
		}, (result) => {
			const id = ids[result.index];
			if ("value" in result && result.value) cached.push(id);
			else uncached.push(id);
		});

		return { cached, uncached };
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
	//
	// `onRow` fires as each row settles (not batched at the end) so a caller
	// like PokedexApp can render rows as they arrive instead of blocking on
	// the full batch.
	private async getRowsForIds(
		ids: number[],
		onProgress?: (loaded: number, total: number) => void,
		isCancelled?: () => boolean,
		onRow?: (row: PokedexTableRow) => void,
	): Promise<TableLoadResult> {
		const rows: PokedexTableRow[] = [];
		const failedIds: number[] = [];
		let loaded = 0;
		const total = ids.length;

		const fetchRow = async (id: number): Promise<PokedexTableRow> => {
			const [pokemon, species] = await Promise.all([
				this.getOrFetchPokemon(id),
				this.getOrFetchSpecies(id),
			]);
			const sprite = await this.getOrFetchImage(
				pokemon.sprites.front_default,
				`images/${id}-sprite.png`,
			);
			return toTableRow(pokemon, species, sprite);
		};

		const handleResult = (source: number[]) =>
			(result: { index: number; value: PokedexTableRow } | { index: number; error: unknown }) => {
				loaded++;
				onProgress?.(loaded, total);
				if ("value" in result) {
					rows.push(result.value);
					onRow?.(result.value);
				} else {
					failedIds.push(source[result.index]);
				}
			};

		const { cached, uncached } = await this.partitionByCacheHit(ids);
		await mapWithConcurrency(cached, DISK_READ_CONCURRENCY, fetchRow, handleResult(cached), isCancelled);
		await mapWithConcurrency(uncached, FETCH_CONCURRENCY, fetchRow, handleResult(uncached), isCancelled);

		rows.sort((a, b) => a.id - b.id);
		return { rows, failedIds, servedFromCache: failedIds.length === 0 };
	}

	async getTableRows(
		range: { start: number; end: number },
		onProgress?: (loaded: number, total: number) => void,
		isCancelled?: () => boolean,
		onRow?: (row: PokedexTableRow) => void,
	): Promise<TableLoadResult> {
		const ids = Array.from(
			{ length: range.end - range.start + 1 },
			(_, i) => range.start + i,
		);
		return this.getRowsForIds(ids, onProgress, isCancelled, onRow);
	}

	async retryRows(
		ids: number[],
		onProgress?: (loaded: number, total: number) => void,
		isCancelled?: () => boolean,
	): Promise<TableLoadResult> {
		return this.getRowsForIds(ids, onProgress, isCancelled);
	}

	// Everything the detail view needs that's already sitting in mem cache by
	// the time a row is clickable — pokemon + species were fetched for every
	// visible row during the table load, and the sprite is the same file the
	// table already showed. Resolves near-instantly; see getEntryExtras for
	// the actually-slow, never-cached-until-now parts (evolution chain,
	// official artwork, shiny) that the detail view was previously blocking on
	// before showing anything at all.
	async getEntryCore(id: number): Promise<PokedexEntry> {
		const pokemon = await this.getOrFetchPokemon(id);
		const species = await this.getOrFetchSpecies(id);
		const sprite = await this.getOrFetchImage(pokemon.sprites.front_default, `images/${id}-sprite.png`);
		return toEntry(pokemon, species, null, { sprite, artwork: null, shiny: null, shinyArtwork: null });
	}

	async getEntryExtras(
		id: number,
	): Promise<Pick<PokedexEntry, "artworkDataUri" | "shinyDataUri" | "shinyArtworkDataUri" | "evolutionChain">> {
		const pokemon = await this.getOrFetchPokemon(id);
		const species = await this.getOrFetchSpecies(id);

		let evolutionChain: EvolutionNode | null = null;
		try {
			const rawChain = await this.getOrFetchEvolutionChain(species.evolution_chain.url);
			evolutionChain = normalizeEvolutionChain(rawChain.chain);
		} catch {
			evolutionChain = null; // non-fatal: detail view still renders without it
		}

		// Each image fetch is caught independently — a dropped connection on
		// just the shiny sprite, say, shouldn't take the artwork (or the rest
		// of the already-rendered core view) down with it.
		const [artworkDataUri, shinyDataUri, shinyArtworkDataUri] = await Promise.all([
			this.getOrFetchImage(
				pokemon.sprites.other?.["official-artwork"]?.front_default ?? null,
				`images/${id}-artwork.png`,
			).catch(() => null),
			this.getOrFetchImage(pokemon.sprites.front_shiny, `images/${id}-shiny.png`).catch(() => null),
			this.getOrFetchImage(
				pokemon.sprites.other?.["official-artwork"]?.front_shiny ?? null,
				`images/${id}-shiny-artwork.png`,
			).catch(() => null),
		]);

		return { artworkDataUri, shinyDataUri, shinyArtworkDataUri, evolutionChain };
	}

	async getEntry(id: number): Promise<PokedexEntry> {
		const [core, extras] = await Promise.all([this.getEntryCore(id), this.getEntryExtras(id)]);
		return { ...core, ...extras };
	}
}
