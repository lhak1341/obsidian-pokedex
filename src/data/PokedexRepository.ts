import { mapWithConcurrency } from "../utils/concurrency";
import type { CacheStore } from "./CacheStore";
import { browserObjectUrls, IMAGE_MEMORY_BUDGET_BYTES, ImageMemory, type ObjectUrls } from "./ImageMemory";
import {
	gigantamaxFormPath,
	imagePath,
	type ImageSuffix,
	megaFormPath,
	pokemonFormPath,
	pokemonPath,
	speciesPath,
} from "./cachePaths";
import {
	ALL_IMAGE_SUFFIXES,
	type ImageBundle,
	type ImageSources,
	imageRequests,
	largeImageSuffixes,
	type PortraitRender,
} from "./imageSet";
import {
	canonicalizeEvolutionChain,
	collectChainIds,
	deriveGigantamaxForms,
	deriveMegaForms,
	deriveRegionalForms,
	evolutionChainPredatesDefaults,
	normalizeEvolutionChainForViewed,
	resolveEvolutionVarietyIds,
	normalizeMoveDetail,
	sortBySlot,
	storedMovesAreStale,
	resolveRegionalFormSuffix,
	toEntry,
	toGigantamaxFormDetail,
	toMegaFormDetail,
	toTableRow,
	toStoredPokemon,
	trimFlavorTextEntries,
	withFormFlavorTexts,
} from "./normalize";
import { PokeApiClient } from "./PokeApiClient";
import { REGIONAL_FORMS, type Generation } from "./constants";
import type {
	EvolutionChainVisual,
	EvolutionNode,
	GigantamaxFormDetail,
	MegaFormDetail,
	MoveDetail,
	PokedexEntry,
	PokedexTableRow,
	RawEvolutionChain,
	RawPokemonForm,
	RawPokemon,
	RawSpecies,
	StoredPokemon,
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

// How a run of the detail-open plan (loadEntry) treats images: "hold" makes
// blob URLs through ImageMemory for a screen to show, "store" writes bytes to
// the store only (cacheRange).
export type EntryImages = "hold" | "store";

export type EntryExtras = Pick<PokedexEntry, "artworkDataUri" | "shinyDataUri" | "shinyArtworkDataUri" | "evolutionChain">;

export interface EntryLoadOptions {
	images: EntryImages;
	// Read when the extras stage starts (see loadEntry).
	render: () => PortraitRender;
	isCancelled?: () => boolean;
	onCore?: (core: PokedexEntry) => void;
	onMove?: (name: string, detail: MoveDetail) => void;
	onExtras?: (extras: EntryExtras) => void;
	onChainMembers?: (members: Record<number, EvolutionChainVisual>) => void;
}

export interface TableLoadResult {
	rows: PokedexTableRow[];
	failedIds: number[];
	servedFromCache: boolean;
}

// What mega-forms/ and gigantamax-forms/ store for a variety: the parts of its
// /pokemon/{key} response a detail is built from, with the PokeAPI image
// source URLs (stable) in place of the images (see fetchVarietyForm).
type VarietyFormSource = Pick<RawPokemon, "types" | "abilities" | "stats"> & {
	sprites: ImageSources;
};

function toVarietyFormSource(pokemon: RawPokemon): VarietyFormSource {
	const { front_default, front_shiny, other } = pokemon.sprites;
	return {
		types: pokemon.types,
		abilities: pokemon.abilities,
		stats: pokemon.stats,
		sprites: {
			front_default,
			front_shiny,
			other: { "official-artwork": other?.["official-artwork"], home: other?.home ?? null },
		},
	};
}

// `home` is null, not absent, when a form has no HOME render: a record
// written before the HOME style (no `home` key) is refetched once, or the
// HOME style would show its artwork forever.
function isVarietyFormSource(value: unknown): value is VarietyFormSource {
	if (typeof value !== "object" || value === null || !("sprites" in value) || !("types" in value)) return false;
	const other = (value as VarietyFormSource).sprites.other;
	return other !== undefined && "home" in other;
}

// Facade the UI talks to: "give me row/entry data for id X", never worrying
// about whether that means a cache hit or a live PokeAPI call.
export class PokedexRepository {
	// Session-lifetime in-memory layer on top of the CacheStore. The table reload
	// (tab close/reopen, a generation enabled or disabled in Settings) is
	// common, and without this, each of those re-reads and
	// re-parses the same ~400 files from disk even though
	// nothing on disk changed since the last read a moment ago.
	private pokemonMemCache = new Map<number, StoredPokemon>();
	// Regional-form varieties (e.g. "rattata-alola") are fetched by PokeAPI
	// *name*, not a numeric dex id — a separate cache/map so a variety name
	// can never collide with a numeric pokemonMemCache key, and so
	// `pokemon/{name}.json` and `pokemon/{id}.json` stay distinct disk paths.
	private pokemonVariantMemCache = new Map<string, StoredPokemon>();
	private speciesMemCache = new Map<number, RawSpecies>();
	private evolutionChainMemCache = new Map<string, RawEvolutionChain>();
	private imageMemCache: ImageMemory;
	// Wrapped in the same { description } shape the disk cache stores (see
	// getAbilityDescription) so getOrFetch's mem/disk/return type lines up as
	// one T throughout — a bare `string | null` would make a cached null
	// indistinguishable from "not fetched yet" via Map.get, which is exactly
	// why getOrFetch's own presence check uses .has() instead.
	private abilityDescriptionMemCache = new Map<string, { description: string | null }>();
	private itemDescriptionMemCache = new Map<string, { description: string | null }>();
	private moveDetailMemCache = new Map<string, MoveDetail>();
	// Image-free records (see VarietyFormSource): the detail itself is rebuilt
	// per call so its image URLs are always live ones.
	private megaFormMemCache = new Map<string, VarietyFormSource>();
	private gigantamaxFormMemCache = new Map<string, VarietyFormSource>();
	// A regional form's own Pokédex text, keyed by its pokemon-form name.
	private formFlavorTextMemCache = new Map<string, RawPokemonForm>();
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
		private cache: CacheStore,
		options: { objectUrls?: ObjectUrls; imageBudgetBytes?: number } = {},
	) {
		this.imageMemCache = new ImageMemory(
			options.objectUrls ?? browserObjectUrls,
			options.imageBudgetBytes ?? IMAGE_MEMORY_BUDGET_BYTES,
		);
	}

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

	// Shared fetch/isStale logic behind getOrFetchPokemon (numeric id)
	// and getOrFetchPokemonVariant (name) below — both fetch the exact same
	// /pokemon/{idOrName} shape and need the exact same projection/self-heal
	// treatment, just keyed differently.
	private async fetchStoredPokemon(idOrName: number | string): Promise<StoredPokemon> {
		// See toStoredPokemon: moves cut to the version groups shown and the
		// three fields read, before the record is written or held in memory.
		return toStoredPokemon(await this.client.fetchPokemon(idOrName));
	}
	// held_items and the version groups moves were cut to are both data a
	// cached record can lack and no local transform can supply (unlike a
	// trim-down, see getOrFetchSpecies' flavor-text comment), so either means
	// a refetch: held_items would otherwise crash on undefined, and a version
	// group added since (legends-za, champions) would show an empty tab for
	// every cached pokemon. A record still in PokeAPI's move shape predates the
	// marker and is refetched the same way.
	private pokemonIsStale(cached: StoredPokemon): boolean {
		return !("held_items" in cached) || storedMovesAreStale(cached);
	}

	private async getOrFetchPokemon(id: number): Promise<StoredPokemon> {
		return this.getOrFetch(
			this.pokemonMemCache,
			id,
			pokemonPath(id),
			() => this.fetchStoredPokemon(id),
			undefined,
			(cached) => this.pokemonIsStale(cached),
		);
	}

	private async getOrFetchPokemonVariant(name: string): Promise<StoredPokemon> {
		return this.getOrFetch(
			this.pokemonVariantMemCache,
			name,
			pokemonPath(name),
			() => this.fetchStoredPokemon(name),
			undefined,
			(cached) => this.pokemonIsStale(cached),
		);
	}

	// Every pokemon record carries its own species reference (name + URL) —
	// resolving the species id from *that* rather than assuming it equals
	// the pokemon's own id is what lets every call site below work
	// uniformly for both a default variety (where they're numerically the
	// same anyway) and a regional-form variety (where they're not: Alolan
	// Rattata's own id is 10091, but its species is still #19).
	private speciesIdFromPokemon(pokemon: StoredPokemon): number {
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

	// A regional form's own Pokédex text, trimmed like a species' on the way
	// in. Only a regional row asks (formFlavorTexts), so one fetch per form,
	// once; the base row shares its species' text and needs none.
	private async getOrFetchFormFlavorText(formName: string): Promise<RawPokemonForm> {
		return this.getOrFetch(this.formFlavorTextMemCache, formName, pokemonFormPath(formName), async () => {
			const fresh = await this.client.fetchPokemonForm(formName);
			return { flavor_text_entries: trimFlavorTextEntries(fresh.flavor_text_entries) };
		});
	}

	// The entry's Pokédex text: a regional row (Alolan Rattata) reads its form's
	// own text where PokeAPI has it (withFormFlavorTexts), every other row its
	// species'. A failed form fetch is not an error: the species' text stands,
	// as it did before form text was read.
	private async flavorTextsFor(pokemon: StoredPokemon, species: RawSpecies, speciesTexts: Record<string, string>) {
		if (resolveRegionalFormSuffix(pokemon, species) === undefined) return speciesTexts;
		try {
			const form = await this.getOrFetchFormFlavorText(pokemon.name);
			return withFormFlavorTexts(speciesTexts, form.flavor_text_entries);
		} catch {
			return speciesTexts;
		}
	}

	private async getOrFetchEvolutionChain(url: string): Promise<RawEvolutionChain> {
		const chainId = url.match(/\/(\d+)\/?$/)?.[1] ?? "unknown";
		return this.getOrFetch(
			this.evolutionChainMemCache,
			chainId,
			`evolution-chain/${chainId}.json`,
			async () => canonicalizeEvolutionChain(await this.client.fetchEvolutionChain(url)),
			// Heals a chain cached in PokeAPI's renamed format (see
			// RawEvolutionChainLink.evolution_details.required_pokemon_form).
			canonicalizeEvolutionChain,
			evolutionChainPredatesDefaults,
		);
	}

	// Sprites stay resident (see ImageMemory): table rows, the hover preview
	// and dex nav keep a sprite's URL for the whole view mount. The other
	// suffixes are only held by the detail screen showing them, and go in the
	// byte-bounded LRU.
	private async getOrFetchImage(url: string | null, key: number | string, suffix: ImageSuffix): Promise<string | null> {
		if (!url) return null;
		const relPath = imagePath(key, suffix);
		const budgeted = suffix !== "sprite";
		const mem = this.imageMemCache.get(relPath);
		if (mem) return mem;
		const pending = this.imageInFlight.get(relPath);
		if (pending) return pending;

		const load = (async (): Promise<string | null> => {
			const cached = await this.cache.readBinary(relPath);
			if (cached) return this.imageMemCache.put(relPath, cached, budgeted);
			const buffer = await this.client.fetchImageBinary(url);
			await this.cache.writeBinary(relPath, buffer);
			// Made from the buffer in hand, not re-read from the store.
			return this.imageMemCache.put(relPath, buffer, budgeted);
		})();

		this.imageInFlight.set(relPath, load);
		try {
			return await load;
		} finally {
			this.imageInFlight.delete(relPath);
		}
	}

	// The cache path behind an image URL this repository handed out, or null
	// once it has been evicted or cleared. imageBounds' contentScale memo keys
	// on it: a blob URL is new each time an evicted image is read back, while
	// its path is stable.
	imagePathOf(url: string): string | null {
		return this.imageMemCache.pathOf(url);
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
	// each uses. `normalize` takes the source even though
	// toGigantamaxFormDetail ignores it (Gigantamax changes no
	// types/abilities/stats, verified live comparing Gengar vs. gengar-gmax)
	// — one shared signature, not two.
	//
	// What is cached (mem and store) is the image-free VarietyFormSource, and
	// the four images are resolved on every call: a cached image URL is a
	// blob URL, dead once the LRU evicts it or the session ends. The images
	// themselves are mem/store hits after the first call. A record in the
	// pre-blob shape (image URIs inside, no `sprites`) is stale and refetched;
	// a field added to VarietyFormSource later extends isVarietyFormSource.
	private async fetchVarietyForm<T>(
		varietyKey: string,
		memCache: Map<string, VarietyFormSource>,
		cachePathFor: (varietyKey: string) => string,
		normalize: (source: VarietyFormSource, images: ImageBundle) => T,
		render: PortraitRender,
	): Promise<T> {
		const source = await this.getOrFetchVarietyFormSource(varietyKey, memCache, cachePathFor(varietyKey));
		const images = await this.fetchImages(varietyKey, source.sprites, ["sprite", ...largeImageSuffixes(render)]);
		return normalize(source, images);
	}

	// A plain single-value cache once the images are split off, so it rides
	// getOrFetch; the shape check is its isStale.
	private async getOrFetchVarietyFormSource(
		varietyKey: string,
		memCache: Map<string, VarietyFormSource>,
		cachePath: string,
	): Promise<VarietyFormSource> {
		return this.getOrFetch(
			memCache,
			varietyKey,
			cachePath,
			async () => toVarietyFormSource(await this.client.fetchPokemon(varietyKey)),
			undefined,
			(cached) => !isVarietyFormSource(cached),
		);
	}

	// Mega forms are rare (<40 species out of 900+) and only ever needed when
	// a user actually clicks that species' Mega tab — fetched lazily here
	// rather than eagerly during getEntryCore/getEntryExtras, same reasoning
	// as ability/item descriptions above. `varietyKey` (e.g.
	// "charizard-mega-x") is a PokeAPI pokemon name, never a numeric id, so it
	// can't collide with the `pokemon/{id}.json` cache getOrFetchPokemon uses.
	//
	// `render` (from spriteStyle, like every large-image read below) is which
	// large render to load: only that one, never both. It is an argument, not
	// repository state, so a request made before a style switch keeps the
	// render it asked for and its caller can tell the answer is stale.
	async getMegaForm(varietyKey: string, render: PortraitRender): Promise<MegaFormDetail> {
		return this.fetchVarietyForm(varietyKey, this.megaFormMemCache, megaFormPath, toMegaFormDetail, render);
	}

	// Same lazy fetch-on-click shape as getMegaForm. Cached separately from
	// mega-forms/ since a variety name is never shared between the two (a
	// species' Gigantamax key always ends "-gmax", Mega always
	// "-mega"/"-mega-x/-y").
	async getGigantamaxForm(varietyKey: string, render: PortraitRender): Promise<GigantamaxFormDetail> {
		return this.fetchVarietyForm(
			varietyKey,
			this.gigantamaxFormMemCache,
			gigantamaxFormPath,
			(_pokemon, images) => toGigantamaxFormDetail(images),
			render,
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
	// i.e. whether getEntryExtras(id) (the chosen render's large image and its
	// shiny, the shiny sprite, evolution chain) has already landed on disk,
	// not just the table-row core. A style switch to the other render reads as
	// uncached until that render is stored. Checked via the large image as a
	// proxy for "the detail-open plan
	// ran at least once" (shiny/shinyArtwork/evolutionChain always land in the
	// same extras stage, so they arrive together; the move pool and chain
	// members of a generation cached before cacheRange ran the whole plan are
	// not checked: a Refresh fills them, ADR-0010 addendum) —
	// falls back to reading the already-cached pokemon record (never a
	// network call at this point, core is confirmed cached by the caller
	// first) to tell a genuine cache miss apart from a species with no
	// official-artwork render at all (rare, but real — nothing to cache
	// there, so it shouldn't block "fully cached").
	private async isExtrasCached(id: number, render: PortraitRender): Promise<boolean> {
		const [large] = largeImageSuffixes(render);
		if (this.imageMemCache.has(imagePath(id, large))) return true;
		if (await this.cache.exists(imagePath(id, large))) return true;
		const pokemon = await this.getOrFetchPokemon(id);
		return !imageRequests(id, pokemon.sprites, [large])[0].url;
	}

	// Powers the settings page's per-generation cache status (e.g. "142/151
	// cached") and decides whether its action button offers to cache or
	// refresh — an id only counts as cached once both the table-row core
	// (isIdCached) and the detail-screen extras (isExtrasCached) are on disk,
	// since "cached" here means "opening this Pokemon is instant," not just
	// "the browse table has a row for it." Deliberately scoped to base dex
	// ids only, not the regional-form rows they may also produce (see
	// getRowsForIds) — unlike this counter, clearRange/cacheRange below DO
	// reach a discovered regional variant's own cache entries (see their own
	// comments), so a generation's variant can be evicted/prefetched without
	// this counter ever reflecting it. Counting variants here would need a
	// second, honest total the same way cacheRange's extras phase reports
	// one (see its own comment) — not done since nothing currently reads it.
	async getCacheStatus(generation: Generation, render: PortraitRender): Promise<{ cached: number; total: number }> {
		const ids = Array.from({ length: generation.end - generation.start + 1 }, (_, i) => generation.start + i);
		let cached = 0;
		await mapWithConcurrency(ids, DISK_READ_CONCURRENCY, async (id) => {
			return (await this.isIdCached(id)) && (await this.isExtrasCached(id, render));
		}, (result) => {
			if ("value" in result && result.value) cached++;
		});
		return { cached, total: ids.length };
	}

	// Settings page's "Delete cache" action for a generation: evicts every
	// id's mem-cache entries and cached disk files (both the table-row core
	// and the detail-screen extras), without re-fetching — the generation
	// just goes back to 0/N cached until it's browsed or cached again.
	// Evolution-chain, ability, item and move JSON are deliberately left
	// alone — each is keyed by chain id or name, not Pokemon id, and shared
	// across species, so deleting one here could evict data a sibling species
	// outside this range still depends on. Only the global clearAll removes
	// them.
	//
	// Two independent, sequentially-run loops — each with exactly one job,
	// deliberately not merged into one shared iteration:
	//
	// 1. Variant discovery, over EVERY cached species id (via
	// listCachedSpeciesIds(), independent of this generation's own numeric
	// range) — evicts any discovered regional-form row (see
	// deriveRegionalForms) whose OWN generationId matches the generation
	// being cleared. A variant's numeric id (e.g. 10229 for Hisuian
	// Growlithe) has nothing to do with its BASE species' dex range, and a
	// regional variant's real generation can diverge from that range too
	// (Alolan Rattata is dex #19/Gen 1's range, but generationId 7) — so
	// discovery can't be scoped to this generation's own range without
	// missing exactly the cross-generation case this loop exists to close
	// (see ADR-0006: clearing Gen 7 must still reach dex #19's species JSON
	// to find Alolan Rattata, even though 19 is nowhere in Gen 7's range).
	//
	// 2. Base-id eviction, over this generation's own numeric range —
	// unconditional, same as before: every id in range gets its species/
	// pokemon/image cache entries removed regardless of what loop 1 found.
	// Its Mega and Gigantamax forms go with it (owned by the base species'
	// dex range, not their own generation: they are only fetched from the
	// species' detail screen, never filtered on, and ADR-0002 gives them no
	// staleness check, so Refresh is the only way to pick up a changed
	// shape). Their keys are derived from the cached species/pokemon JSON,
	// so that read has to happen before those files are removed below.
	async clearRange(generation: Generation): Promise<void> {
		for (const speciesId of await this.listCachedSpeciesIds()) {
			const cachedSpecies = await this.cache.readJson<RawSpecies>(speciesPath(speciesId));
			if (!cachedSpecies) continue;
			for (const form of deriveRegionalForms(cachedSpecies)) {
				if (REGIONAL_FORMS[form.suffix].generationId !== generation.id) continue;
				// Two independent cache entries per variant — the name-keyed one
				// table-load writes (getOrFetchPokemonVariant) and the
				// numeric-id-keyed one the detail view writes (getOrFetchPokemon)
				// — see this repo's CLAUDE.md cache-duplication gotcha. Read the
				// name-keyed file first to learn the variant's own numeric id
				// before removing it out from under itself.
				const cachedVariant = await this.cache.readJson<StoredPokemon>(pokemonPath(form.key));
				await this.evictPokemonAssets(this.pokemonVariantMemCache, form.key);
				this.formFlavorTextMemCache.delete(form.key);
				await this.cache.remove(pokemonFormPath(form.key));
				if (cachedVariant) {
					await this.evictPokemonAssets(this.pokemonMemCache, cachedVariant.id);
				}
			}
		}

		const ids = Array.from(
			{ length: generation.end - generation.start + 1 },
			(_, i) => generation.start + i,
		);
		for (const id of ids) {
			await this.evictVarietyForms(id);
			await this.evictPokemonAssets(this.pokemonMemCache, id);
			this.speciesMemCache.delete(id);
			await this.cache.remove(speciesPath(id));
		}
	}

	private async evictVarietyForms(id: number): Promise<void> {
		const pokemon = await this.cache.readJson<StoredPokemon>(pokemonPath(id));
		const species = await this.cache.readJson<RawSpecies>(speciesPath(id));
		if (!pokemon || !species) return;
		for (const form of deriveMegaForms(pokemon, species)) {
			this.megaFormMemCache.delete(form.key);
			await this.cache.remove(megaFormPath(form.key));
			await this.evictImages(form.key);
		}
		for (const form of deriveGigantamaxForms(pokemon, species)) {
			this.gigantamaxFormMemCache.delete(form.key);
			await this.cache.remove(gigantamaxFormPath(form.key));
			await this.evictImages(form.key);
		}
	}

	// Fetches the requested members of a Pokemon's image set (see imageSet.ts for
	// the suffix -> sprites-field table). Every image is caught independently and
	// resolves to null on failure — a dropped connection on just the shiny
	// sprite shouldn't take the rest down. The core sprite is NOT fetched
	// through here: a failed core sprite must fail the whole id (getEntryCore,
	// getRowsForIds), the opposite policy. Suffixes not requested stay null.
	private async fetchImages(
		key: number | string,
		sprites: ImageSources,
		suffixes: readonly ImageSuffix[],
	): Promise<ImageBundle> {
		const bundle: ImageBundle = { sprite: null, artwork: null, shiny: null, shinyArtwork: null };
		await Promise.all(
			imageRequests(key, sprites, suffixes).map(async ({ field, url, suffix }) => {
				bundle[field] = await this.getOrFetchImage(url, key, suffix).catch(() => null);
			}),
		);
		return bundle;
	}

	private async evictImages(key: number | string): Promise<void> {
		for (const suffix of ALL_IMAGE_SUFFIXES) {
			this.imageMemCache.delete(imagePath(key, suffix));
			await this.cache.remove(imagePath(key, suffix));
		}
	}

	// Settings page's global "Clear cache": the mem layer and the disk layer
	// have to go together, since isIdCached/isExtrasCached count a mem hit as
	// cached and later reads are served from mem without writing disk again —
	// clearing disk alone leaves the settings counters at "N/N cached" and
	// the files never come back. A fetch already in flight when this runs
	// isn't cancelled (emptying the in-flight maps only stops new callers
	// joining it), so it can still write its file afterwards; clearRange has
	// the same window and it hasn't mattered.
	async clearAll(): Promise<void> {
		this.pokemonMemCache.clear();
		this.pokemonVariantMemCache.clear();
		this.speciesMemCache.clear();
		this.formFlavorTextMemCache.clear();
		this.evolutionChainMemCache.clear();
		this.imageMemCache.clear();
		this.abilityDescriptionMemCache.clear();
		this.itemDescriptionMemCache.clear();
		this.moveDetailMemCache.clear();
		this.megaFormMemCache.clear();
		this.gigantamaxFormMemCache.clear();
		this.inFlight.clear();
		this.imageInFlight.clear();
		await this.cache.clear();
	}

	// Every cached species id, discovered by listing the flat species/
	// subdirectory (CacheStore.listFilesIn) — species/ never nests further
	// (see cachePaths.ts's speciesPath()), so one non-recursive listing
	// covers it without touching any image entry. The store
	// itself stays agnostic of this naming convention (see cachePaths.ts's
	// own header comment) — the id-parsing lives here, next to the other
	// callers of speciesPath()/pokemonPath().
	private async listCachedSpeciesIds(): Promise<number[]> {
		const ids: number[] = [];
		for (const file of await this.cache.listFilesIn("species")) {
			const match = /(\d+)\.json$/.exec(file);
			if (match) ids.push(Number(match[1]));
		}
		return ids;
	}

	// Shared by clearRange's 3 eviction cases (variant key, a variant's
	// resolved numeric id, and a range's own base id): delete the mem-cache
	// entry, the pokemon JSON, and every ALL_IMAGE_SUFFIXES image (mem +
	// disk). Species eviction is deliberately not folded in here — it only
	// applies to the base-id case, not the shape this helper covers.
	private async evictPokemonAssets<K extends number | string>(memCache: Map<K, StoredPokemon>, key: K): Promise<void> {
		memCache.delete(key);
		await this.cache.remove(pokemonPath(key));
		await this.evictImages(key);
	}

	// Settings page's "Cache" action for a generation: the normal getTableRows
	// path (table-row core), then the detail-open plan (loadEntry) for every
	// row with images "store": the same plan DetailLoadState.load() runs on a
	// click into that Pokemon (core, move pool, large images, evolution chain
	// and its members, a regional form's own text), done ahead of time, so a
	// cached generation opens every detail screen with no network.
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
		generation: Generation,
		render: PortraitRender,
		onProgress?: (loaded: number, total: number) => void,
		isCancelled?: () => boolean,
		onRow?: (row: PokedexTableRow) => void,
	): Promise<TableLoadResult> {
		const range = { start: generation.start, end: generation.end };
		const ids = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);

		const result = await this.getTableRows(range, (loaded) => onProgress?.(loaded, ids.length), isCancelled, onRow);

		let extrasLoaded = 0;
		const extrasTotal = result.rows.length;
		await mapWithConcurrency(
			result.rows.map((r) => r.id),
			FETCH_CONCURRENCY,
			(id) => this.loadEntry(id, { images: "store", render: () => render, isCancelled }),
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
		generation: Generation,
		render: PortraitRender,
		onProgress?: (loaded: number, total: number) => void,
		isCancelled?: () => boolean,
		onRow?: (row: PokedexTableRow) => void,
	): Promise<TableLoadResult> {
		await this.clearRange(generation);
		return this.cacheRange(generation, render, onProgress, isCancelled, onRow);
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
			const sprite = await this.getOrFetchImage(pokemon.sprites.front_default, id, "sprite");
			const builtRows = [toTableRow(pokemon, species, sprite)];

			for (const form of deriveRegionalForms(species)) {
				try {
					const formPokemon = await this.getOrFetchPokemonVariant(form.key);
					const formSprite = await this.getOrFetchImage(formPokemon.sprites.front_default, form.key, "sprite");
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

	async getEntryCore(id: number): Promise<PokedexEntry> {
		return this.entryCore(id, "hold");
	}

	async getEntryExtras(id: number, render: PortraitRender): Promise<EntryExtras> {
		return this.entryExtras(id, render, "hold");
	}

	// The detail-open plan (CONTEXT.md, "Entry load"): everything opening one
	// Pokemon's detail screen loads, in order. Core first (renders at once),
	// then the move pool and the extras side by side, then the chain members
	// the extras' evolution chain names. Written once here so the two runs
	// cannot drift apart: DetailLoadState.load runs it with images "hold"
	// (blob URLs, through ImageMemory) and its callbacks, and cacheRange runs
	// it with images "store" (bytes written to the store, no URL made, so a
	// generation's ~450 large images never pass through the LRU and revoke
	// the open detail's portrait) and no callbacks. Images are the only fork;
	// every JSON goes through getOrFetch either way.
	//
	// "render" is read when the extras stage starts, so a Sprite style switch
	// that lands before the core does is honoured. "isCancelled" is checked
	// before every callback and every next stage; a move or chain member
	// that fails is skipped (getMoveDetailsForMoves, entryChainMembers), and
	// a core failure rejects. Resolves once every stage, moves included, has
	// settled, so a prefetch that resolves has stored everything a later
	// offline open asks for (DetailLoadState.test.ts pins it).
	async loadEntry(id: number, options: EntryLoadOptions): Promise<void> {
		const { images, isCancelled } = options;
		const live = () => !isCancelled?.();
		const core = await this.entryCore(id, images);
		if (!live()) return;
		options.onCore?.(core);
		const render = options.render();
		await Promise.all([
			this.getMoveDetailsForMoves(core.moves.map((m) => m.name), (name, detail) => {
				if (live()) options.onMove?.(name, detail);
			}),
			(async () => {
				const extras = await this.entryExtras(id, render, images);
				if (!live()) return;
				options.onExtras?.(extras);
				if (!extras.evolutionChain) return;
				const members = await this.entryChainMembers(collectChainIds(extras.evolutionChain), images);
				if (live()) options.onChainMembers?.(members);
			})(),
		]);
	}

	// Everything the detail view needs that's already sitting in mem cache by
	// the time a row is clickable — pokemon + species were fetched for every
	// visible row during the table load, and the sprite is the same file the
	// table already showed. Resolves near-instantly; see getEntryExtras for
	// the actually-slow, never-cached-until-now parts (evolution chain,
	// official artwork, shiny) that the detail view was previously blocking on
	// before showing anything at all.
	private async entryCore(id: number, images: EntryImages): Promise<PokedexEntry> {
		const pokemon = await this.getOrFetchPokemon(id);
		const species = await this.getOrFetchSpecies(this.speciesIdFromPokemon(pokemon));
		const sprite =
			images === "hold" ? await this.getOrFetchImage(pokemon.sprites.front_default, id, "sprite") : await this.storeImages(id, pokemon.sprites, ["sprite"]);
		const entry = toEntry(pokemon, species, null, { sprite, artwork: null, shiny: null, shinyArtwork: null });
		return { ...entry, flavorTexts: await this.flavorTextsFor(pokemon, species, entry.flavorTexts) };
	}

	private async entryExtras(id: number, render: PortraitRender, images: EntryImages): Promise<EntryExtras> {
		const pokemon = await this.getOrFetchPokemon(id);
		const species = await this.getOrFetchSpecies(this.speciesIdFromPokemon(pokemon));
		let evolutionChain: EvolutionNode | null = null;
		try {
			const rawChain = await this.getOrFetchEvolutionChain(species.evolution_chain.url);
			// Which regional variety (if any) the chain is scoped to is worked
			// out inside normalizeEvolutionChainForViewed — see its comment.
			evolutionChain = await resolveEvolutionVarietyIds(
				normalizeEvolutionChainForViewed(rawChain.chain, {
					id,
					pokemonName: pokemon.name,
					speciesName: species.name,
				}),
				// From the species' own variety list (usually cached by table
				// load), so a cosmetic form name ("vivillon-polar", no pokemon of
				// its own) is a miss rather than a 404 fetch. A chain species
				// outside the browsed range is a real fetch, so prefetch stores it.
				async (dexNumber) =>
					(await this.getOrFetchSpecies(dexNumber)).varieties.map((v) => ({
						name: v.pokemon.name,
						id: Number(/\/(\d+)\/?$/.exec(v.pokemon.url)?.[1]),
					})),
			);
		} catch {
			evolutionChain = null; // non-fatal: detail view still renders without it
		}

		const suffixes = largeImageSuffixes(render);
		if (images === "store") {
			await this.storeImages(id, pokemon.sprites, suffixes);
			return { artworkDataUri: null, shinyDataUri: null, shinyArtworkDataUri: null, evolutionChain };
		}
		// Each image fetch is caught independently — a dropped connection on
		// just the shiny sprite, say, shouldn't take the artwork (or the rest
		// of the already-rendered core view) down with it.
		const { artwork: artworkDataUri, shiny: shinyDataUri, shinyArtwork: shinyArtworkDataUri } = await this.fetchImages(id, pokemon.sprites, suffixes);
		return { artworkDataUri, shinyDataUri, shinyArtworkDataUri, evolutionChain };
	}

	// The "store" side of an image: bytes written to the store, no blob URL
	// made, each one caught on its own. An image already in memory or the
	// store is skipped, so a repeat prefetch never re-downloads. Always null,
	// for the URL a "hold" caller would have got.
	private async storeImages(key: number | string, sprites: ImageSources, suffixes: readonly ImageSuffix[]): Promise<null> {
		await Promise.all(
			imageRequests(key, sprites, suffixes).map(({ url, relPath }) => this.storeImage(url, relPath).catch(() => undefined)),
		);
		return null;
	}

	private async storeImage(url: string | null, relPath: string): Promise<void> {
		if (!url || this.imageMemCache.has(relPath) || (await this.cache.exists(relPath))) return;
		await this.cache.writeBinary(relPath, await this.client.fetchImageBinary(url));
	}

	// Sprite + types for evolution-chain partners shown alongside the
	// currently viewed entry (see EvolutionTree/EvolutionChain). Every chain
	// member was already fetched for the table load that got the user here,
	// so this usually resolves from mem cache; a chain spanning outside the
	// currently-browsed generation range is the one case that's a real
	// network fetch — but even then it's one fetch per partner id, not a
	// separate one for sprite vs types, since both come off the same
	// already-fetched StoredPokemon. Skips species entirely, unlike
	// getEntryCore — the evolution tree only ever renders a partner's
	// id/name/sprite/types, name already comes free from the evolution-chain
	// response itself (see normalizeEvolutionChain), so fetching a partner's
	// whole species record just to throw away everything but that would be
	// wasted work. Each id resolves independently to a null sprite / empty
	// types on failure rather than rejecting the whole set — a dropped
	// connection on one partner shouldn't blank out the others.
	async getEntryChainVisuals(ids: number[]): Promise<Record<number, EvolutionChainVisual>> {
		return this.entryChainMembers(ids, "hold");
	}

	private async entryChainMembers(ids: number[], images: EntryImages): Promise<Record<number, EvolutionChainVisual>> {
		const pairs = await Promise.all(
			ids.map(async (id): Promise<readonly [number, EvolutionChainVisual]> => {
				try {
					const pokemon = await this.getOrFetchPokemon(id);
					const sprite =
						images === "hold"
							? await this.getOrFetchImage(pokemon.sprites.front_default, id, "sprite")
							: await this.storeImages(id, pokemon.sprites, ["sprite"]);
					const types = sortBySlot(pokemon.types).map((t) => t.type.name);
					return [id, { sprite, types }];
				} catch {
					return [id, { sprite: null, types: [] }];
				}
			}),
		);
		return Object.fromEntries(pairs);
	}
}
