import { collectChainIds } from "../data/normalize";
import type { PokedexRepository } from "../data/PokedexRepository";
import type { MoveDetail, PokedexEntry } from "../data/types";

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
export class DetailLoadState {
	entry: PokedexEntry | null = null;
	loading = true;
	error: string | null = null;
	evolutionSprites: Record<number, string | null> = {};
	// Not reset per load() call, unlike the fields above — moves repeat
	// heavily across species (nearly everything learns Tackle or Growl), so
	// this accumulates across every entry viewed this session rather than
	// discarding what's already been fetched each time `id` changes.
	moveDetails: Record<string, MoveDetail> = {};
	cancelled = false;

	private generation = 0;

	constructor(private repository: PokedexRepository) {}

	cancel(): void {
		this.cancelled = true;
	}

	// onUpdate fires whenever entry/loading/error/evolutionSprites changes —
	// a caller (e.g. a Svelte component, whose $state can't see mutations on
	// a plain class instance) re-mirrors all of them wholesale each time.
	// onMoveDetail is a separate channel because moves stream in one at a
	// time (see PokedexRepository.getMoveDetailsForMoves) and the move table
	// should render each as it settles, not wait for the whole movepool.
	async load(
		id: number,
		onUpdate?: () => void,
		onMoveDetail?: (name: string, detail: MoveDetail) => void,
	): Promise<void> {
		const gen = ++this.generation;
		const stale = () => this.cancelled || gen !== this.generation;

		this.entry = null;
		this.loading = true;
		this.error = null;
		this.evolutionSprites = {};

		try {
			// Pokemon/species/sprite are already mem-cached from the table load
			// that got the user to this row, so this resolves almost
			// instantly — render on it instead of waiting on the genuinely
			// slow, never-cached-until-now parts fetched below.
			const core = await this.repository.getEntryCore(id);
			if (stale()) return;
			this.entry = core;
			this.loading = false;
			onUpdate?.();

			void this.repository.getMoveDetailsForMoves(core.moves.map((m) => m.name), (name, detail) => {
				if (stale()) return;
				this.moveDetails = { ...this.moveDetails, [name]: detail };
				onMoveDetail?.(name, detail);
			});

			const extras = await this.repository.getEntryExtras(id);
			if (stale()) return;
			this.entry = { ...this.entry, ...extras };
			onUpdate?.();

			if (!extras.evolutionChain) return;
			const chainIds = collectChainIds(extras.evolutionChain);
			const sprites = await this.repository.getEntrySprites(chainIds);
			if (stale()) return;
			this.evolutionSprites = sprites;
			onUpdate?.();
		} catch (err) {
			if (stale()) return;
			this.error = err instanceof Error ? err.message : String(err);
			this.loading = false;
			onUpdate?.();
		}
	}
}
