import type { PokedexRepository } from "../data/PokedexRepository";
import type { PokedexTableRow } from "../data/types";
import type { GenerationScope } from "../utils/generationScope";

// Everything a view needs to render the browse table's load, copied out of the
// class so a reactive owner can hold it in one `$state` (see onUpdate below).
export interface LoadSnapshot {
	rows: PokedexTableRow[];
	failedIds: number[];
	// False from the first admitted row on (the table can render while the rest
	// streams in), or once the load ends, whichever comes first.
	loading: boolean;
	retrying: boolean;
	progress: { loaded: number; total: number };
}

// Counts only — wording is loadNotices.ts's job and showing it is the caller's.
export interface LoadOutcome {
	loaded: number;
	failed: number;
}

export interface RetryOutcome {
	attempted: number;
	recovered: number;
	stillFailing: number;
}

export function emptyLoadSnapshot(): LoadSnapshot {
	return { rows: [], failedIds: [], loading: true, retrying: false, progress: { loaded: 0, total: 0 } };
}

// Owns the fetch/retry lifecycle for the browse table: which rows are
// loaded (including rows streaming in before the load ends), which ids
// failed, progress, and the outcome counts a caller turns into a Notice.
// Presentation concerns (showing the Notice) are the caller's job — this class
// only tracks state and talks to PokedexRepository.
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
	// id the old one hasn't reached yet gets fetched twice. It also silences
	// onUpdate, so a destroyed view is never written to.
	cancelled = false;

	constructor(
		private repository: PokedexRepository,
		private scope: GenerationScope,
		// PokedexLoadState is a plain class, not reactive: Svelte 5's `$state`
		// only deep-proxies plain objects/arrays, not class instances, so
		// mutating a field here is invisible to a Svelte view watching this
		// instance. onUpdate hands the owner a fresh snapshot after every change
		// (a new `rows` array each time, which TableScreen's deriveds need to
		// re-run) for it to assign into its own `$state`.
		private onUpdate: (snapshot: LoadSnapshot) => void = () => {},
	) {}

	snapshot(): LoadSnapshot {
		return {
			rows: [...this.rows],
			failedIds: [...this.failedIds],
			loading: this.loading,
			retrying: this.retrying,
			progress: { ...this.progress },
		};
	}

	private emit(): void {
		if (!this.cancelled) this.onUpdate(this.snapshot());
	}

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

	// Streamed rows land in `rows` in the order they settle, each one filtered
	// through `admit` first — out-of-scope rows (see resolveGenerationScope) get
	// fetched but must never reach the caller, even transiently. The first one
	// flips `loading` off so the table renders while the rest streams in; the
	// final set replaces the streamed one (dex order) when the load ends.
	//
	// Returns the outcome only when some ids failed (a clean load gets no
	// Notice), and null when cancelled.
	async load(): Promise<LoadOutcome | null> {
		const result = await this.repository.getTableRows(
			this.scope.fetchRange,
			(loaded, total) => {
				this.progress = { loaded, total };
				this.emit();
			},
			() => this.cancelled,
			(row) => {
				const admitted = this.admit([row]);
				if (admitted.length === 0) return;
				this.rows.push(...admitted);
				this.loading = false;
				this.emit();
			},
		);
		if (this.cancelled) return null;
		this.rows = this.admit(result.rows);
		// failedIds are bare ids (a row never got built, nothing to check
		// generationId on) — a failure always happens on the *base* fetch id
		// (see getRowsForIds: a regional-variant failure is caught separately
		// and never propagates here), which is always a plain dex number, so
		// this stays the simple dex-range check.
		this.failedIds = result.failedIds.filter((id) => this.scope.includesFailedId(id));
		this.loading = false;
		this.emit();
		return this.failedIds.length > 0 ? { loaded: this.rows.length, failed: this.failedIds.length } : null;
	}

	// Returns null (a no-op) if there's nothing to retry, a retry is already in
	// flight, or the load was cancelled meanwhile. `recovered` counts ids
	// (`attempted - stillFailing`), not rows: a base id's regional-form rows
	// come back with it, so a row count would overstate it.
	async retry(): Promise<RetryOutcome | null> {
		if (this.failedIds.length === 0 || this.retrying) return null;
		const attempted = this.failedIds.length;
		this.retrying = true;
		this.emit();
		const result = await this.repository.retryRows(
			this.failedIds,
			(loaded, total) => {
				this.progress = { loaded, total };
				this.emit();
			},
			() => this.cancelled,
		);
		this.retrying = false;
		if (this.cancelled) return null;
		this.mergeRows(this.admit(result.rows));
		this.failedIds = result.failedIds;
		this.emit();
		return {
			attempted,
			recovered: attempted - result.failedIds.length,
			stillFailing: result.failedIds.length,
		};
	}
}
