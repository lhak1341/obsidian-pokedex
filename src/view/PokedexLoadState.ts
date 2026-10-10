import type { PokedexRepository, TableLoadResult } from "../data/PokedexRepository";
import type { PokedexTableRow } from "../data/types";
import type { GenerationScope } from "../utils/generationScope";

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
		private scope: GenerationScope,
	) {}

	cancel(): void {
		this.cancelled = true;
	}

	// The single place the generation scope is applied to fetched rows.
	// `scope.fetchRange` is a contiguous span that can include ids from a
	// disabled generation, and getRowsForIds adds regional-form rows next to
	// each base id, so every path that hands rows to the caller (the onRow
	// stream, load's final set, retry) has to cross this.
	private admit(rows: PokedexTableRow[]): PokedexTableRow[] {
		return rows.filter((row) => this.scope.includes(row));
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
	// `onRow` fires per row as it settles, filtered through `admit` first —
	// out-of-scope rows (see resolveGenerationScope) get fetched but must never
	// reach the caller, even transiently.
	async load(
		onProgress?: (loaded: number, total: number) => void,
		onRow?: (row: PokedexTableRow) => void,
	): Promise<void> {
		const result = await this.repository.getTableRows(
			this.scope.fetchRange,
			(loaded, total) => {
				this.progress = { loaded, total };
				onProgress?.(loaded, total);
			},
			() => this.cancelled,
			(row) => {
				for (const admitted of this.admit([row])) onRow?.(admitted);
			},
		);
		if (this.cancelled) return;
		this.rows = this.admit(result.rows);
		// failedIds are bare ids (a row never got built, nothing to check
		// generationId on) — a failure always happens on the *base* fetch id
		// (see getRowsForIds: a regional-variant failure is caught separately
		// and never propagates here), which is always a plain dex number, so
		// this stays the simple dex-range check.
		this.failedIds = result.failedIds.filter((id) => this.scope.includesFailedId(id));
		this.loading = false;
	}

	// Returns null (a no-op) if there's nothing to retry or a retry is
	// already in flight, mirroring the guard the caller previously had to
	// check itself. Returns the retry result otherwise, with `rows` already
	// scoped (so it matches what was merged into `this.rows`), since the
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
		const scoped = { ...result, rows: this.admit(result.rows) };
		this.mergeRows(scoped.rows);
		this.failedIds = scoped.failedIds;
		return scoped;
	}
}
