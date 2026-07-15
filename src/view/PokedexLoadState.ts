import type { PokedexRepository, TableLoadResult } from "../data/PokedexRepository";
import type { PokedexTableRow } from "../data/types";
import { isIdInGenerations } from "../utils/filterPokemon";

// Owns the fetch/retry lifecycle for the browse table: which rows are
// loaded, which ids failed, and progress while fetching. Presentation
// concerns (e.g. showing a Notice) are the caller's job — this class only
// tracks state and talks to PokedexRepository.
export class PokedexLoadState {
	rows: PokedexTableRow[] = [];
	failedIds: number[] = [];
	loading = true;
	retrying = false;
	progress = { loaded: 0, total: 0 };
	// Set by the owning view when it's closed/remounted while a load is still
	// in flight (e.g. a settings change triggers a remount mid-fetch). Without
	// this, that stale load keeps running in the background — a brand new
	// PokedexLoadState starts its own full fetch at the same time, and every
	// id the old one hasn't reached yet gets fetched twice.
	cancelled = false;

	constructor(
		private repository: PokedexRepository,
		private fetchRange: { start: number; end: number },
		private includes: (row: PokedexTableRow) => boolean,
		// A failed id never became a row (nothing to check generationId on),
		// so its own dex-range membership is checked directly here instead of
		// through `includes` — see the failedIds line below.
		private enabledGenerations: number[],
	) {}

	cancel(): void {
		this.cancelled = true;
	}

	private mergeRows(fetched: PokedexTableRow[]) {
		const byId = new Map(this.rows.map((r) => [r.id, r]));
		for (const row of fetched) byId.set(row.id, row);
		this.rows = [...byId.values()].sort((a, b) => a.id - b.id);
	}

	// onProgress is a second notification channel on top of `this.progress` —
	// PokedexLoadState is a plain class, not reactive: Svelte 5's `$state`
	// only deep-proxies plain objects/arrays, not class instances, so
	// mutating `this.progress` here is invisible to a Svelte view watching
	// this instance. The callback lets the caller mirror progress into its
	// own `$state` variable instead.
	//
	// `onRow` fires per row as it settles, filtered through `includes` first
	// since `fetchRange` is a contiguous span that can include ids from a
	// disabled generation (see resolveGenerationScope) — those get fetched
	// but must never reach the caller, even transiently.
	async load(
		onProgress?: (loaded: number, total: number) => void,
		onRow?: (row: PokedexTableRow) => void,
	): Promise<void> {
		const result = await this.repository.getTableRows(
			this.fetchRange,
			(loaded, total) => {
				this.progress = { loaded, total };
				onProgress?.(loaded, total);
			},
			() => this.cancelled,
			(row) => {
				if (this.includes(row)) onRow?.(row);
			},
		);
		if (this.cancelled) return;
		this.rows = result.rows.filter((row) => this.includes(row));
		// failedIds are bare ids (a row never got built, nothing to check
		// generationId on) — a failure always happens on the *base* fetch id
		// (see getRowsForIds: a regional-variant failure is caught separately
		// and never propagates here), which is always a plain dex number, so
		// this stays the simple dex-range check.
		this.failedIds = result.failedIds.filter((id) => isIdInGenerations(id, this.enabledGenerations));
		this.loading = false;
	}

	// Returns null (a no-op) if there's nothing to retry or a retry is
	// already in flight, mirroring the guard the caller previously had to
	// check itself. Returns the raw retry result otherwise, since the
	// caller needs both how many recovered and how many are still failing
	// to compose its own outcome message.
	async retry(onProgress?: (loaded: number, total: number) => void): Promise<TableLoadResult | null> {
		if (this.failedIds.length === 0 || this.retrying) return null;
		this.retrying = true;
		const result = await this.repository.retryRows(
			this.failedIds,
			(loaded, total) => {
				this.progress = { loaded, total };
				onProgress?.(loaded, total);
			},
			() => this.cancelled,
		);
		this.retrying = false;
		if (this.cancelled) return result;
		this.mergeRows(result.rows);
		this.failedIds = result.failedIds;
		return result;
	}
}
