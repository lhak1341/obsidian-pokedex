import { collectChainIds } from "../data/normalize";
import type { PortraitRender } from "../data/imageSet";
import type { EntryExtras, PokedexRepository } from "../data/PokedexRepository";
import type { EvolutionChainVisual, MoveDetail, PokedexEntry } from "../data/types";

// Owns the fetch/retry lifecycle for a single detail-screen entry: the
// pokemon/species/sprite core, move details, evolution-chain sprites, and
// error state. Presentation concerns (e.g. showing a Notice) are the
// caller's job — this class only tracks state and talks to
// PokedexRepository (see PokedexLoadState, the same pattern for the browse
// table).
//
// One instance is reused across id changes — clicking a row, or an
// evolution-chain partner, doesn't remount DetailScreen, it just changes
// the `id` prop — rather than constructing a fresh instance per id:
// `load(id)` supersedes whatever load is still in flight via an internal
// generation counter, so a stale response from a superseded load can never
// clobber newer state. A retry is just calling `load(id)` again — there's
// no separate retry() method like PokedexLoadState's, since a failed
// detail load has no partial-success set to narrow a retry down to.
//
// The large render (artwork or HOME) is part of what a load asks for, and a
// Sprite style switch is `setRender`: a newer extras request for the open
// entry that supersedes the extras stage of any load still in flight (its own
// counter, so the move details that load is streaming keep landing). Nothing
// about the render lives on the repository, so an answer for the old render
// is dropped here, never shown.
export interface DetailEntrySnapshot {
	entry: PokedexEntry | null;
	loading: boolean;
	error: string | null;
	evolutionSprites: Record<number, string | null>;
	evolutionTypes: Record<number, string[]>;
}

export class DetailLoadState {
	entry: PokedexEntry | null = null;
	loading = true;
	error: string | null = null;
	evolutionSprites: Record<number, string | null> = {};
	// Keyed the same as evolutionSprites, kept as a separate map (not folded
	// into PokedexEntry) since it covers every chain member — including ones
	// outside the currently-browsed dex range, which never get a
	// PokedexTableRow of their own to carry types on.
	evolutionTypes: Record<number, string[]> = {};
	// Not reset per load() call, unlike the fields above — moves repeat
	// heavily across species (nearly everything learns Tackle or Growl), so
	// this accumulates across every entry viewed this session rather than
	// discarding what's already been fetched each time `id` changes.
	moveDetails: Record<string, MoveDetail> = {};
	cancelled = false;

	private generation = 0;
	// Bumped by load() and by setRender(): only the newest extras request (the
	// large images, evolution chain and its sprites) writes its answer.
	private extrasGeneration = 0;
	private render: PortraitRender = "official-artwork";

	constructor(private repository: PokedexRepository) {}

	cancel(): void {
		this.cancelled = true;
	}

	// A Sprite style switch. With an entry showing, its extras are asked for
	// again in the new render: the images shown stay until the new ones land,
	// and any extras request still in flight (load()'s, or an earlier switch's)
	// is dropped. Before the core lands, the load in flight reads the new
	// render when it reaches its extras stage. A failure keeps what shows.
	async setRender(render: PortraitRender, onUpdate?: () => void): Promise<void> {
		if (render === this.render) return;
		this.render = render;
		const entry = this.entry;
		if (!entry) return;
		const gen = this.generation;
		try {
			await this.loadExtras(entry.id, () => this.cancelled || gen !== this.generation, onUpdate);
		} catch {
			// the entry and its previous images stay
		}
	}

	// Wholesale-refresh shape (unlike PokedexLoadState, which is
	// payload-carrying/row-streaming instead) — a Svelte caller re-assigns
	// its own $state object from this after every onUpdate, since $state
	// only deep-proxies plain objects/arrays, not class instances.
	snapshot(): DetailEntrySnapshot {
		return {
			entry: this.entry,
			loading: this.loading,
			error: this.error,
			evolutionSprites: this.evolutionSprites,
			evolutionTypes: this.evolutionTypes,
		};
	}

	// onUpdate fires whenever entry/loading/error/evolutionSprites changes —
	// a caller (e.g. a Svelte component, whose $state can't see mutations on
	// a plain class instance) re-mirrors all of them wholesale each time.
	// onMoveDetail is a separate channel because moves stream in one at a
	// time (see PokedexRepository.getMoveDetailsForMoves) and the move table
	// should render each as it settles, not wait for the whole movepool.
	async load(
		id: number,
		render: PortraitRender,
		onUpdate?: () => void,
		onMoveDetail?: (name: string, detail: MoveDetail) => void,
	): Promise<void> {
		const gen = ++this.generation;
		const stale = () => this.cancelled || gen !== this.generation;
		this.render = render;

		this.entry = null;
		this.loading = true;
		this.error = null;
		this.evolutionSprites = {};
		this.evolutionTypes = {};

		// Supersedes only the extras stage once the core has landed: a later
		// setRender drops this load's images and chain, while its move details
		// keep landing.
		let extrasStale = stale;
		try {
			// The order lives in the repository's detail-open plan (loadEntry),
			// the same one cacheRange prefetches. Pokemon/species/sprite are
			// already mem-cached from the table load that got the user to this
			// row, so the core resolves almost instantly and renders before the
			// genuinely slow parts.
			await this.repository.loadEntry(id, {
				images: "hold",
				render: () => this.render,
				isCancelled: stale,
				onCore: (core) => {
					this.entry = core;
					this.loading = false;
					onUpdate?.();
					const extrasGen = ++this.extrasGeneration;
					extrasStale = () => stale() || extrasGen !== this.extrasGeneration;
				},
				onMove: (name, detail) => {
					this.moveDetails = { ...this.moveDetails, [name]: detail };
					onMoveDetail?.(name, detail);
				},
				onExtras: (extras) => {
					if (!extrasStale()) this.applyExtras(extras, onUpdate);
				},
				onChainMembers: (members) => {
					if (!extrasStale()) this.applyChainMembers(members, onUpdate);
				},
			});
		} catch (err) {
			// A superseded request's failure is not this entry's error.
			if (extrasStale()) return;
			this.error = err instanceof Error ? err.message : String(err);
			this.loading = false;
			onUpdate?.();
		}
	}

	// The extras stage on its own, for setRender(): the large images in the
	// new render, the evolution chain, then the chain's members. `superseded` is
	// the caller's own check (an id change); a newer extras request supersedes
	// this one too. A failure is thrown to the caller only while this request
	// is current.
	private async loadExtras(id: number, superseded: () => boolean, onUpdate?: () => void): Promise<void> {
		const extrasGen = ++this.extrasGeneration;
		const stale = () => superseded() || extrasGen !== this.extrasGeneration;
		try {
			const extras = await this.repository.getEntryExtras(id, this.render);
			if (stale()) return;
			this.applyExtras(extras, onUpdate);

			if (!extras.evolutionChain) return;
			const members = await this.repository.getEntryChainVisuals(collectChainIds(extras.evolutionChain));
			if (stale()) return;
			this.applyChainMembers(members, onUpdate);
		} catch (err) {
			if (stale()) return;
			throw err;
		}
	}

	private applyExtras(extras: EntryExtras, onUpdate?: () => void): void {
		if (this.entry === null) return;
		this.entry = { ...this.entry, ...extras };
		onUpdate?.();
	}

	private applyChainMembers(members: Record<number, EvolutionChainVisual>, onUpdate?: () => void): void {
		this.evolutionSprites = Object.fromEntries(Object.entries(members).map(([id, v]) => [id, v.sprite]));
		this.evolutionTypes = Object.fromEntries(Object.entries(members).map(([id, v]) => [id, v.types]));
		onUpdate?.();
	}
}
