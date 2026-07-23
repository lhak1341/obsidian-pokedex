import { mapWithConcurrency } from "../utils/concurrency";
import { DiskCache } from "./Cache";
import { ALL_IMAGE_SUFFIXES, imagePath, pokemonPath, speciesPath } from "./cachePaths";
import {
	deriveRegionalForms,
	inferAncestorFormSuffix,
	normalizeEvolutionChain,
	normalizeMoveDetail,
	resolveRegionalFormSuffix,
	toEntry,
	toGigantamaxFormDetail,
	toMegaFormDetail,
	toTableRow,
	trimFlavorTextEntries,
	trimMovesToVersionGroups,
} from "./normalize";
import { PokeApiClient } from "./PokeApiClient";
import type {
	EvolutionChainVisual,
	EvolutionNode,
	GigantamaxFormDetail,
	MegaFormDetail,
	MoveDetail,
	PokedexEntry,
	PokedexTableRow,
	RawEvolutionChain,
	RawPokemon,
	RawSpecies,
} from "./types";

// Outer dispatch concurrency for loops that are all network-bound work (e.g.
// cacheRange's extras phase, getMoveDetailsForMoves) — the real PokeAPI-
// friendly cap is enforced at the HTTP call site itself (see PokeApiClient's
// NETWORK_CONCURRENCY), this just bounds how many callers pile up waiting on
// that semaphore at once.
const FETCH_CONCURRENCY = 10;

// Outer dispatch concurrency for getRowsForIds, run over every id regardless
// of cache hit or miss — safe to fan out this wide even though some of those
// ids will turn out to be cache misses, since a miss blocks on
// PokeApiClient's own network semaphore rather than consuming this loop's
// concurrency, and a hit resolves near-instantly (pure local file I/O) and
// frees its slot immediately.
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
	// Regional-form varieties (e.g. "rattata-alola") are fetched by PokeAPI
	// *name*, not a numeric dex id — a separate cache/map so a variety name
	// can never collide with a numeric pokemonMemCache key, and so
	// `pokemon/{name}.json` and `pokemon/{id}.json` stay distinct disk paths.
	private pokemonVariantMemCache = new Map<string, RawPokemon>();
	private speciesMemCache = new Map<number, RawSpecies>();
	private evolutionChainMemCache = new Map<string, RawEvolutionChain>();
	private imageMemCache = new Map<string, string>();
	// Wrapped in the same { description } shape the disk cache stores (see
	// getAbilityDescription) so getOrFetch's mem/disk/return type lines up as
	// one T throughout — a bare `string | null` would make a cached null
	// indistinguishable from "not fetched yet" via Map.get, which is exactly
	// why getOrFetch's own presence check uses .has() instead.
	private abilityDescriptionMemCache = new Map<string, { description: string | null }>();
	private itemDescriptionMemCache = new Map<string, { description: string | null }>();
	private moveDetailMemCache = new Map<string, MoveDetail>();
	private megaFormMemCache = new Map<string, MegaFormDetail>();
	private gigantamaxFormMemCache = new Map<string, GigantamaxFormDetail>();
	// In-flight dedup for getOrFetch, keyed by disk cache path (globally
	// unique across every entity type). Without this, two concurrent callers
	// for the same not-yet-mem-cached key (e.g. two detail-screen loads in
	// quick succession from prev/next nav, both wanting move "tackle") each
	// pay their own disk read or network fetch instead of sharing one.
	private inFlight = new Map<string, Promise<unknown>>();
	// Same dedup, separate map: getOrFetchImage isn't built on getOrFetch (see
	// its own comment), so it needs its own in-flight tracking keyed by
	// relPath instead of cachePath.
	private imageInFlight = new Map<string, Promise<string | null>>();

	constructor(
		private client: PokeApiClient,
		private cache: DiskCache,
	) {}

	// Shared shape behind every getOrFetch* method below: check the
	// session-lifetime mem cache, fall back to disk (running `migrate` on
	// what's found there — e.g. self-healing an older untrimmed shape —
	// which persists back to disk only when it actually produced a
	// different value than what was read), and only then hit the network,
	// writing the fresh result through to both disk and mem cache.
	//
	// `.has()`/`.get()!` (not a truthy check on the mem value) because a
	// cached value isn't always truthy — getAbilityDescription's `{
	// description: null }` is a real, valid cached result, not "not fetched
	// yet".
	//
	// `isStale`, unlike `migrate`, can't be self-healed by transforming the
	// cached value — it's for a field that genuinely isn't derivable from
	// what's already on disk (e.g. getMoveDetails' `description`, added after
	// plenty of moves were already cached without it) and needs a real
	// network refetch, not a local transform. Trimming-only widenings (see
	// getOrFetchSpecies' flavor-text comment) still rely on the settings
	// "Clear cache" button instead — this is only worth the extra refetch
	// when leaving it stale would silently blank out an entire feature for
	// every already-cached item, not just narrow an edge case.
	//
	// getOrFetchImage isn't built on this shell — it caches a binary asset,
	// not a JSON value, and has its own null-url short-circuit and
	// re-read-after-write step, different enough that forcing it into this
	// shape would cost more clarity than it'd save.
	private async getOrFetch<K, T>(
		memCache: Map<K, T>,
		key: K,
		cachePath: string,
		fetch: () => Promise<T>,
		migrate?: (cached: T) => T,
		isStale?: (cached: T) => boolean,
	): Promise<T> {
		if (memCache.has(key)) return memCache.get(key)!;
		const pending = this.inFlight.get(cachePath) as Promise<T> | undefined;
		if (pending) return pending;

		const load = (async (): Promise<T> => {
			const cached = await this.cache.readJson<T>(cachePath);
			if (cached && !isStale?.(cached)) {
				const value = migrate ? migrate(cached) : cached;
				if (value !== cached) await this.cache.writeJson(cachePath, value);
				memCache.set(key, value);
				return value;
			}
			const fresh = await fetch();
			await this.cache.writeJson(cachePath, fresh);
			memCache.set(key, fresh);
			return fresh;
		})();

		this.inFlight.set(cachePath, load);
		try {
			return await load;
		} finally {
			this.inFlight.delete(cachePath);
		}
	}

	// Shared fetch/migrate/isStale logic behind getOrFetchPokemon (numeric id)
	// and getOrFetchPokemonVariant (name) below — both fetch the exact same
	// /pokemon/{idOrName} shape and need the exact same trim/self-heal
	// treatment, just keyed differently.
	private async fetchAndTrimPokemon(idOrName: number | string): Promise<RawPokemon> {
		const fresh = await this.client.fetchPokemon(idOrName);
		// See trimMovesToVersionGroups: strips the ~20 version groups this
		// plugin never reads before it's written to disk / kept in memory.
		return { ...fresh, moves: trimMovesToVersionGroups(fresh.moves) };
	}
	// Self-heals a cache written before trimMovesToVersionGroups existed (a
	// full, untrimmed moves array) by rewriting it trimmed the first time
	// it's read, rather than requiring a manual cache clear.
	private trimCachedPokemonMoves(cached: RawPokemon): RawPokemon {
		const trimmedMoves = trimMovesToVersionGroups(cached.moves);
		return trimmedMoves.length !== cached.moves.length ? { ...cached, moves: trimmedMoves } : cached;
	}
	// held_items is new data, not a trim-down of something already on disk
	// (unlike moves/flavor text above) — same as getMoveDetails' `description`
	// field, a cache written before it existed can't self-heal via a local
	// transform and needs a real refetch.
	private pokemonIsStale(cached: RawPokemon): boolean {
		return !("held_items" in cached);
	}

	private async getOrFetchPokemon(id: number): Promise<RawPokemon> {
		return this.getOrFetch(
			this.pokemonMemCache,
			id,
			pokemonPath(id),
			() => this.fetchAndTrimPokemon(id),
			(cached) => this.trimCachedPokemonMoves(cached),
			(cached) => this.pokemonIsStale(cached),
		);
	}

	private async getOrFetchPokemonVariant(name: string): Promise<RawPokemon> {
		return this.getOrFetch(
			this.pokemonVariantMemCache,
			name,
			pokemonPath(name),
			() => this.fetchAndTrimPokemon(name),
			(cached) => this.trimCachedPokemonMoves(cached),
			(cached) => this.pokemonIsStale(cached),
		);
	}

	// Every RawPokemon carries its own species reference (name + URL) —
	// resolving the species id from *that* rather than assuming it equals
	// the pokemon's own id is what lets every call site below work
	// uniformly for both a default variety (where they're numerically the
	// same anyway) and a regional-form variety (where they're not: Alolan
	// Rattata's own id is 10091, but its species is still #19).
	private speciesIdFromPokemon(pokemon: RawPokemon): number {
		const match = pokemon.species.url.match(/\/(\d+)\/?$/);
		return match ? Number(match[1]) : pokemon.id;
	}

	private async getOrFetchSpecies(id: number): Promise<RawSpecies> {
		return this.getOrFetch(
			this.speciesMemCache,
			id,
			speciesPath(id),
			async () => {
				const fresh = await this.client.fetchSpecies(id);
				return { ...fresh, flavor_text_entries: trimFlavorTextEntries(fresh.flavor_text_entries) };
			},
			// Self-heals a cache written before trimFlavorTextEntries existed (a
			// full, untrimmed flavor_text_entries array) the same way
			// getOrFetchPokemon does for moves. Only ever shrinks, so a cache
			// written under an older/smaller FLAVOR_TEXT_VERSION_GROUPS (e.g.
			// before the Ruby/Sapphire tab existed) won't regain the trimmed-
			// away versions this way — that needs the settings "Clear cache"
			// button, the same manual step any other trimmed-field widening
			// would need, rather than a forced refetch here that would turn
			// every already-cached species into a slow reload.
			(cached) => {
				const trimmedFlavorText = trimFlavorTextEntries(cached.flavor_text_entries);
				return trimmedFlavorText.length !== cached.flavor_text_entries.length
					? { ...cached, flavor_text_entries: trimmedFlavorText }
					: cached;
			},
		);
	}

	private async getOrFetchEvolutionChain(url: string): Promise<RawEvolutionChain> {
		const chainId = url.match(/\/(\d+)\/?$/)?.[1] ?? "unknown";
		return this.getOrFetch(
			this.evolutionChainMemCache,
			chainId,
			`evolution-chain/${chainId}.json`,
			() => this.client.fetchEvolutionChain(url),
		);
	}

	private async getOrFetchImage(url: string | null, relPath: string): Promise<string | null> {
		if (!url) return null;
		const mem = this.imageMemCache.get(relPath);
		if (mem) return mem;
		const pending = this.imageInFlight.get(relPath);
		if (pending) return pending;

		const load = (async (): Promise<string | null> => {
			const cached = await this.cache.readImageDataUri(relPath);
			if (cached) {
				this.imageMemCache.set(relPath, cached);
				return cached;
			}
			const buffer = await this.client.fetchImageBinary(url);
			// writeImageBinary hands back the data URI for the buffer it just
			// wrote — no separate readImageDataUri re-read needed.
			const dataUri = await this.cache.writeImageBinary(relPath, buffer);
			this.imageMemCache.set(relPath, dataUri);
			return dataUri;
		})();

		this.imageInFlight.set(relPath, load);
		try {
			return await load;
		} finally {
			this.imageInFlight.delete(relPath);
		}
	}

	// Abilities repeat heavily across species (e.g. "levitate", "intimidate"),
	// so this is cached by ability name rather than per-Pokemon — fetched once
	// total across an entire browsing session, not once per entry. Called
	// lazily on hover from the detail view, not prefetched with the rest of
	// an entry's extras.
	async getAbilityDescription(name: string): Promise<string | null> {
		const result = await this.getOrFetch(
			this.abilityDescriptionMemCache,
			name,
			`abilities/${name}.json`,
			async () => {
				const fresh = await this.client.fetchAbility(name);
				const description =
					fresh.effect_entries.find((e) => e.language.name === "en")?.short_effect ?? null;
				return { description };
			},
		);
		return result.description;
	}

	// Wild held items repeat across species (e.g. "oran-berry") the same way
	// abilities do — cached by item name, fetched lazily on hover from the
	// detail view's held-item line, same shape/caching approach as
	// getAbilityDescription above.
	async getItemDescription(name: string): Promise<string | null> {
		const result = await this.getOrFetch(
			this.itemDescriptionMemCache,
			name,
			`items/${name}.json`,
			async () => {
				const fresh = await this.client.fetchItem(name);
				const description =
					fresh.effect_entries.find((e) => e.language.name === "en")?.short_effect ?? null;
				return { description };
			},
		);
		return result.description;
	}

	// Moves repeat even more heavily than abilities across species (e.g.
	// almost every Pokemon learns Tackle or Growl) — cached by move name for
	// the same reason. Unlike getAbilityDescription, a fetch failure here
	// isn't swallowed to null (there's no legitimate "empty" result for a
	// move's type/power/accuracy/PP) — it's left to reject so
	// getMoveDetailsForMoves' per-item error handling (via mapWithConcurrency)
	// can tell "failed" apart from "successfully has no power" (status moves).
	//
	// isStale refetches a move cached before `description` existed (the
	// move-name hover tooltip) — see getOrFetch's comment on why this one
	// gets a real refetch instead of the usual migrate-in-place/Clear-cache
	// pattern.
	async getMoveDetails(name: string): Promise<MoveDetail> {
		return this.getOrFetch(
			this.moveDetailMemCache,
			name,
			`moves/${name}.json`,
			async () => normalizeMoveDetail(await this.client.fetchMove(name)),
			undefined,
			(cached) => !("description" in cached),
		);
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

	// Shared by getMegaForm/getGigantamaxForm below: both combine one JSON
	// fetch with four image fetches, a different shape than getOrFetch's
	// single-value cache (see ADR-0002 for why this doesn't reuse getOrFetch
	// itself) — but that combined shape IS identical between the two of them,
	// differing only in which mem cache/disk-path prefix/normalize function
	// each uses. `normalize` takes the raw pokemon even though
	// toGigantamaxFormDetail ignores it (Gigantamax changes no
	// types/abilities/stats, verified live comparing Gengar vs. gengar-gmax)
	// — one shared signature, not two.
	//
	// No isStale escape hatch, unlike getOrFetchPokemon's pokemonIsStale — if
	// a field is ever added to MegaFormDetail/GigantamaxFormDetail, an
	// existing user's cached json will silently stay undefined for that field
	// forever instead of self-healing. Add one here when that happens (see
	// getOrFetch's own isStale comment for the pattern); nothing today needs
	// it, so it isn't speculatively built in.
	private async fetchVarietyForm<T>(
		varietyKey: string,
		memCache: Map<string, T>,
		cachePathPrefix: string,
		normalize: (pokemon: RawPokemon, images: {
			sprite: string | null;
			artwork: string | null;
			shiny: string | null;
			shinyArtwork: string | null;
		}) => T,
	): Promise<T> {
		const mem = memCache.get(varietyKey);
		if (mem) return mem;
		const cachePath = `${cachePathPrefix}/${varietyKey}.json`;
		const cached = await this.cache.readJson<T>(cachePath);
		if (cached) {
			memCache.set(varietyKey, cached);
			return cached;
		}
		const pokemon = await this.client.fetchPokemon(varietyKey);
		const [sprite, artwork, shiny, shinyArtwork] = await Promise.all([
			this.getOrFetchImage(pokemon.sprites.front_default, imagePath(varietyKey, "sprite")).catch(() => null),
			this.getOrFetchImage(
				pokemon.sprites.other?.["official-artwork"]?.front_default ?? null,
				imagePath(varietyKey, "artwork"),
			).catch(() => null),
			this.getOrFetchImage(pokemon.sprites.front_shiny, imagePath(varietyKey, "shiny")).catch(() => null),
			this.getOrFetchImage(
				pokemon.sprites.other?.["official-artwork"]?.front_shiny ?? null,
				imagePath(varietyKey, "shiny-artwork"),
			).catch(() => null),
		]);
		const detail = normalize(pokemon, { sprite, artwork, shiny, shinyArtwork });
		await this.cache.writeJson(cachePath, detail);
		memCache.set(varietyKey, detail);
		return detail;
	}

	// Mega forms are rare (<40 species out of 900+) and only ever needed when
	// a user actually clicks that species' Mega tab — fetched lazily here
	// rather than eagerly during getEntryCore/getEntryExtras, same reasoning
	// as ability/item descriptions above. `varietyKey` (e.g.
	// "charizard-mega-x") is a PokeAPI pokemon name, never a numeric id, so it
	// can't collide with the `pokemon/{id}.json` cache getOrFetchPokemon uses.
	async getMegaForm(varietyKey: string): Promise<MegaFormDetail> {
		return this.fetchVarietyForm(varietyKey, this.megaFormMemCache, "mega-forms", toMegaFormDetail);
	}

	// Same lazy fetch-on-click shape as getMegaForm. Cached separately from
	// mega-forms/ since a variety name is never shared between the two (a
	// species' Gigantamax key always ends "-gmax", Mega always
	// "-mega"/"-mega-x/-y").
	async getGigantamaxForm(varietyKey: string): Promise<GigantamaxFormDetail> {
		return this.fetchVarietyForm(varietyKey, this.gigantamaxFormMemCache, "gigantamax-forms", (_pokemon, images) =>
			toGigantamaxFormDetail(images),
		);
	}

	// Shared by partitionByCacheHit and getCacheStatus — an id counts as
	// cached once both its pokemon and species JSON are on disk (or already
	// in this session's mem cache), the same two files getRowsForIds' fetchRow
	// needs to build a table row.
	private async isIdCached(id: number): Promise<boolean> {
		const hasPokemon =
			this.pokemonMemCache.has(id) || (await this.cache.exists(pokemonPath(id)));
		const hasSpecies =
			this.speciesMemCache.has(id) || (await this.cache.exists(speciesPath(id)));
		return hasPokemon && hasSpecies;
	}

	// Whether opening this id's detail screen would still hit the network —
	// i.e. whether getEntryExtras(id) (official artwork, shiny, shiny artwork,
	// evolution chain) has already landed on disk, not just the table-row
	// core. Checked via the artwork file specifically as a proxy for "extras
	// were fetched at least once" (shiny/shinyArtwork/evolutionChain always
	// land in that same getEntryExtras call, so they arrive together) —
	// falls back to reading the already-cached pokemon record (never a
	// network call at this point, core is confirmed cached by the caller
	// first) to tell a genuine cache miss apart from a species with no
	// official-artwork render at all (rare, but real — nothing to cache
	// there, so it shouldn't block "fully cached").
	private async isExtrasCached(id: number): Promise<boolean> {
		if (this.imageMemCache.has(imagePath(id, "artwork"))) return true;
		if (await this.cache.exists(imagePath(id, "artwork"))) return true;
		const pokemon = await this.getOrFetchPokemon(id);
		return !pokemon.sprites.other?.["official-artwork"]?.front_default;
	}

	// Powers the settings page's per-generation cache status (e.g. "142/151
	// cached") and decides whether its action button offers to cache or
	// refresh — an id only counts as cached once both the table-row core
	// (isIdCached) and the detail-screen extras (isExtrasCached) are on disk,
	// since "cached" here means "opening this Pokemon is instant," not just
	// "the browse table has a row for it." Known, intentionally-scoped gap:
	// this counts base dex ids only, not the regional-form rows they may
	// also produce (see getRowsForIds) — the Cache/Refresh/Delete actions
	// below don't reach into pokemonVariantMemCache or a variety's own
	// pokemon/{name}.json either. A regional variant still gets cached
	// normally the first time its table row loads; it just isn't reflected
	// in this counter or swept by these bulk actions yet.
	async getCacheStatus(range: { start: number; end: number }): Promise<{ cached: number; total: number }> {
		const ids = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);
		let cached = 0;
		await mapWithConcurrency(ids, DISK_READ_CONCURRENCY, async (id) => {
			return (await this.isIdCached(id)) && (await this.isExtrasCached(id));
		}, (result) => {
			if ("value" in result && result.value) cached++;
		});
		return { cached, total: ids.length };
	}

	// Settings page's "Delete cache" action for a generation: evicts every
	// id's mem-cache entries and cached disk files (both the table-row core
	// and the detail-screen extras), without re-fetching — the generation
	// just goes back to 0/N cached until it's browsed or cached again.
	// Evolution-chain JSON is deliberately left alone — it's keyed by chain
	// id, not Pokemon id, and shared across every member of a family, so
	// deleting it here could evict data a sibling species outside this range
	// still depends on.
	//
	// Also sweeps any regional-form row this range's species produce (see
	// deriveRegionalForms) — a variant's own numeric id (e.g. 10229 for
	// Hisuian Growlithe) has nothing to do with this range even though its
	// BASE species' id does, so it needs its own explicit removal rather
	// than falling out of the `ids` loop below. Read from whatever species
	// JSON is STILL on disk (before this id's own files get removed further
	// down) rather than an extra network fetch — if the species was never
	// cached, there's nothing to derive a variant from anyway, consistent
	// with that variant equally never having been cached.
	async clearRange(range: { start: number; end: number }): Promise<void> {
		const ids = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);
		for (const id of ids) {
			const cachedSpecies = await this.cache.readJson<RawSpecies>(speciesPath(id));
			if (cachedSpecies) {
				for (const form of deriveRegionalForms(cachedSpecies)) {
					// Two independent cache entries per variant — the name-keyed
					// one table-load writes (getOrFetchPokemonVariant) and the
					// numeric-id-keyed one the detail view writes (getOrFetchPokemon)
					// — see this repo's CLAUDE.md cache-duplication gotcha. Read
					// the name-keyed file first to learn the variant's own numeric
					// id before removing it out from under itself.
					const cachedVariant = await this.cache.readJson<RawPokemon>(pokemonPath(form.key));
					this.pokemonVariantMemCache.delete(form.key);
					await this.cache.remove(pokemonPath(form.key));
					for (const suffix of ALL_IMAGE_SUFFIXES) {
						this.imageMemCache.delete(imagePath(form.key, suffix));
						await this.cache.remove(imagePath(form.key, suffix));
					}
					if (cachedVariant) {
						this.pokemonMemCache.delete(cachedVariant.id);
						await this.cache.remove(pokemonPath(cachedVariant.id));
						for (const suffix of ALL_IMAGE_SUFFIXES) {
							this.imageMemCache.delete(imagePath(cachedVariant.id, suffix));
							await this.cache.remove(imagePath(cachedVariant.id, suffix));
						}
					}
				}
			}
			this.pokemonMemCache.delete(id);
			this.speciesMemCache.delete(id);
			for (const suffix of ALL_IMAGE_SUFFIXES) {
				this.imageMemCache.delete(imagePath(id, suffix));
				await this.cache.remove(imagePath(id, suffix));
			}
			await this.cache.remove(pokemonPath(id));
			await this.cache.remove(speciesPath(id));
		}
	}

	// Settings page's "Cache" action for a generation: the normal getTableRows
	// path (table-row core) followed by getEntryExtras for every id (official
	// artwork, shiny, shiny artwork, evolution chain) — the same data
	// DetailLoadState.load() would otherwise fetch on first click into that
	// Pokemon, done ahead of time instead.
	//
	// The extras phase runs over EVERY row getTableRows actually produced
	// (result.rows), not just the static numeric ids — a regional-form row
	// discovered here (e.g. Hisuian Growlithe while caching Gen 1, since its
	// base species' dex number lives there even though its own generationId
	// is 8) would otherwise never get its evolution chain/artwork/shiny
	// prefetched at all, only lazily loaded on first detail-view visit.
	// `onProgress` reports each phase against its own honest total (0..
	// ids.length for the core phase, 0..result.rows.length for the extras
	// phase) rather than one combined/halved counter — simpler, and the
	// extras phase's total can legitimately be larger than the core phase's
	// once regional forms are involved, which a single shared total can't
	// represent without lying about one phase or the other.
	async cacheRange(
		range: { start: number; end: number },
		onProgress?: (loaded: number, total: number) => void,
		isCancelled?: () => boolean,
		onRow?: (row: PokedexTableRow) => void,
	): Promise<TableLoadResult> {
		const ids = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);

		const result = await this.getTableRows(range, (loaded) => onProgress?.(loaded, ids.length), isCancelled, onRow);

		let extrasLoaded = 0;
		const extrasTotal = result.rows.length;
		await mapWithConcurrency(
			result.rows.map((r) => r.id),
			FETCH_CONCURRENCY,
			(id) => this.getEntryExtras(id),
			() => {
				extrasLoaded++;
				onProgress?.(extrasLoaded, extrasTotal);
			},
			isCancelled,
		);

		return result;
	}

	// Settings page's "Refresh" action for a generation: clearRange followed
	// by cacheRange — same network/disk-concurrency split, just forced past
	// the cache instead of short-circuited by it, and covering extras too.
	async refreshRange(
		range: { start: number; end: number },
		onProgress?: (loaded: number, total: number) => void,
		isCancelled?: () => boolean,
		onRow?: (row: PokedexTableRow) => void,
	): Promise<TableLoadResult> {
		await this.clearRange(range);
		return this.cacheRange(range, onProgress, isCancelled, onRow);
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

		// One base id can now produce multiple rows: the species' own default
		// row plus one per regional-form variety it has (e.g. id 19 -> Rattata
		// AND Alolan Rattata) — see deriveRegionalForms. A dropped fetch for
		// one variant is swallowed rather than failing the whole id: the base
		// row (already built above it) still renders, just without that one
		// regional sibling this load — same "a partial miss shouldn't take
		// down what did succeed" reasoning as getEntryExtras' per-image
		// .catch(() => null) below.
		const fetchRow = async (id: number): Promise<PokedexTableRow[]> => {
			const pokemon = await this.getOrFetchPokemon(id);
			const species = await this.getOrFetchSpecies(this.speciesIdFromPokemon(pokemon));
			const sprite = await this.getOrFetchImage(pokemon.sprites.front_default, imagePath(id, "sprite"));
			const builtRows = [toTableRow(pokemon, species, sprite)];

			for (const form of deriveRegionalForms(species)) {
				try {
					const formPokemon = await this.getOrFetchPokemonVariant(form.key);
					const formSprite = await this.getOrFetchImage(
						formPokemon.sprites.front_default,
						imagePath(form.key, "sprite"),
					);
					builtRows.push(toTableRow(formPokemon, species, formSprite));
				} catch {
					// skip this one regional variant; the base row above is unaffected
				}
			}
			return builtRows;
		};

		const handleResult = (result: { index: number; value: PokedexTableRow[] } | { index: number; error: unknown }) => {
			loaded++;
			onProgress?.(loaded, total);
			if ("value" in result) {
				for (const row of result.value) {
					rows.push(row);
					onRow?.(row);
				}
			} else {
				failedIds.push(ids[result.index]);
			}
		};

		// A single pass at DISK_READ_CONCURRENCY over every id, cache hit or
		// miss — no upfront partitioning scan first. That used to mean checking
		// every single id's on-disk existence (two adapter.exists() calls each)
		// before a single row could render, which on the default all-generations
		// scope (~1010 ids) blocked the very first row behind ~2000 filesystem
		// checks. Safe to fan out this wide even for cache-miss ids now that
		// PokeApiClient enforces the real PokeAPI-friendly concurrency cap at
		// the actual HTTP call site (see NETWORK_CONCURRENCY) — a cache hit
		// resolves near-instantly and frees its slot, a cache miss blocks on
		// the client's own semaphore rather than this loop's concurrency.
		await mapWithConcurrency(ids, DISK_READ_CONCURRENCY, fetchRow, handleResult, isCancelled);

		// dexNumber first (so a regional-form row sits next to its base
		// species), id as the tiebreaker within a shared dexNumber — a
		// default variety's own numeric id (1-1025ish) always sorts before
		// its regional siblings' variety pseudo-ids (10001+).
		rows.sort((a, b) => a.dexNumber - b.dexNumber || a.id - b.id);
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
		const species = await this.getOrFetchSpecies(this.speciesIdFromPokemon(pokemon));
		const sprite = await this.getOrFetchImage(pokemon.sprites.front_default, imagePath(id, "sprite"));
		return toEntry(pokemon, species, null, { sprite, artwork: null, shiny: null, shinyArtwork: null });
	}

	async getEntryExtras(
		id: number,
	): Promise<Pick<PokedexEntry, "artworkDataUri" | "shinyDataUri" | "shinyArtworkDataUri" | "evolutionChain">> {
		const pokemon = await this.getOrFetchPokemon(id);
		const species = await this.getOrFetchSpecies(this.speciesIdFromPokemon(pokemon));
		// Scopes the chain to whichever variety `id` actually is — undefined
		// (the default/base behavior) for a normal row, or { formSuffix,
		// rootId: id } for a regional-form row, so e.g. Alolan Vulpix's
		// evolution card shows the Ice Stone requirement and links onward to
		// Alolan Ninetales rather than the base Fire-Stone line. See
		// normalizeEvolutionChain's own comment for the selection rules.
		const ownFormSuffix = resolveRegionalFormSuffix(pokemon, species);

		let evolutionChain: EvolutionNode | null = null;
		try {
			const rawChain = await this.getOrFetchEvolutionChain(species.evolution_chain.url);
			// Obstagoon/Cursola/Perrserker/Runerigus/Sirfetch'd/Mr. Rime shape:
			// `ownFormSuffix` is undefined (the viewed species has no suffix of
			// its own) but it may still only be reachable via a regional-variant
			// ancestor — inferAncestorFormSuffix walks the raw chain to find
			// that suffix so the branch leading to it isn't dropped as an
			// unrelated regional edge. See inferAncestorFormSuffix's own comment.
			const pathSuffix = ownFormSuffix ?? inferAncestorFormSuffix(rawChain.chain, species.name);
			evolutionChain = normalizeEvolutionChain(
				rawChain.chain,
				pathSuffix ? { formSuffix: pathSuffix, ownFormSuffix, rootId: id, speciesName: species.name } : undefined,
			);
		} catch {
			evolutionChain = null; // non-fatal: detail view still renders without it
		}

		// Each image fetch is caught independently — a dropped connection on
		// just the shiny sprite, say, shouldn't take the artwork (or the rest
		// of the already-rendered core view) down with it.
		const [artworkDataUri, shinyDataUri, shinyArtworkDataUri] = await Promise.all([
			this.getOrFetchImage(
				pokemon.sprites.other?.["official-artwork"]?.front_default ?? null,
				imagePath(id, "artwork"),
			).catch(() => null),
			this.getOrFetchImage(pokemon.sprites.front_shiny, imagePath(id, "shiny")).catch(() => null),
			this.getOrFetchImage(
				pokemon.sprites.other?.["official-artwork"]?.front_shiny ?? null,
				imagePath(id, "shiny-artwork"),
			).catch(() => null),
		]);

		return { artworkDataUri, shinyDataUri, shinyArtworkDataUri, evolutionChain };
	}

	// Sprite + types for evolution-chain partners shown alongside the
	// currently viewed entry (see EvolutionTree/EvolutionChain). Every chain
	// member was already fetched for the table load that got the user here,
	// so this usually resolves from mem cache; a chain spanning outside the
	// currently-browsed generation range is the one case that's a real
	// network fetch — but even then it's one fetch per partner id, not a
	// separate one for sprite vs types, since both come off the same
	// already-fetched RawPokemon. Skips species entirely, unlike
	// getEntryCore — the evolution tree only ever renders a partner's
	// id/name/sprite/types, name already comes free from the evolution-chain
	// response itself (see normalizeEvolutionChain), so fetching a partner's
	// whole species record just to throw away everything but that would be
	// wasted work. Each id resolves independently to a null sprite / empty
	// types on failure rather than rejecting the whole set — a dropped
	// connection on one partner shouldn't blank out the others.
	async getEntryChainVisuals(ids: number[]): Promise<Record<number, EvolutionChainVisual>> {
		const pairs = await Promise.all(
			ids.map(async (id): Promise<readonly [number, EvolutionChainVisual]> => {
				try {
					const pokemon = await this.getOrFetchPokemon(id);
					const sprite = await this.getOrFetchImage(
						pokemon.sprites.front_default,
						imagePath(id, "sprite"),
					);
					const types = pokemon.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name);
					return [id, { sprite, types }];
				} catch {
					return [id, { sprite: null, types: [] }];
				}
			}),
		);
		return Object.fromEntries(pairs);
	}
}
