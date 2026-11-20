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

// How often a progress tick or a streamed row may reach the view. Each update
// re-runs TableScreen's filter and sort and re-checks every drawn row (38 ms
// apiece with 1,082 rows, measured live), and a load reports one progress
// tick per id plus one callback per row: about 2,100 updates, which took a
// cache-served load to 24 s through the UI against 1.85 s with the rows
// handed over once. Changes the user must see at once (see flush) skip it.
export const UPDATE_INTERVAL_MS = 100;

// The timer the throttle runs on: setTimeout in the app, a manual one in tests.
export interface UpdateTimer {
	set(fn: () => void, ms: number): unknown;
	clear(handle: unknown): void;
}

const browserTimer: UpdateTimer = {
	set: (fn, ms) => window.setTimeout(fn, ms),
	clear: (handle) => window.clearTimeout(handle as number),
};

export function emptyLoadSnapshot(): LoadSnapshot {
	return { rows: [], failedIds: [], loading: true, retrying: false, progress: { loaded: 0, total: 0 } };
}

// Owns the fetch/retry lifecycle for the browse table: which rows are
// loaded (including rows streaming in before the load ends), which ids
// failed, progress, and the outcome counts a caller turns into a Notice.
// Presentation concerns (showing the Notice) are the caller's job — this class
// only tracks state and talks to PokedexRepository.
export class PokedexLoadState {
	// Only ever replaced, never changed in place, so a snapshot can hand the
	// view this same array until the rows really change (see snapshot).
	rows: PokedexTableRow[] = [];
	failedIds: number[] = [];
	loading = true;
	retrying = false;
	progress = { loaded: 0, total: 0 };
	// Set by the owning view when its leaf closes (or onOpen remounts it) while
	// a load is still in flight. Without this, that stale load keeps running in
	// the background, and if a new app mounts, every id the old load hasn't
	// reached yet gets fetched twice. It also silences onUpdate, so a destroyed
	// view is never written to.
	cancelled = false;
	// Which load is current. setScope bumps it, and a load or retry that
	// started under an older value stops fetching and drops everything it
	// still hands back, the way a cancelled one does, while this instance
	// carries on with the new scope.
	private loadNumber = 0;
	// The throttle (see UPDATE_INTERVAL_MS): `cooldown` holds the timer
	// started by the last update sent, and `pending` records that something
	// changed while it ran, so the timer sends one update with the newest state.
	private cooldown: unknown = null;
	private pending = false;

	constructor(
		private repository: PokedexRepository,
		private scope: GenerationScope,
		// PokedexLoadState is a plain class, not reactive: Svelte 5's `$state`
		// only deep-proxies plain objects/arrays, not class instances, so
		// mutating a field here is invisible to a Svelte view watching this
		// instance. onUpdate hands the owner a fresh snapshot (throttled, see
		// emit/flush; a new `rows` array only when the rows changed, see
		// snapshot) for it to assign into its own `$state.raw`.
		private onUpdate: (snapshot: LoadSnapshot) => void = () => {},
		private timer: UpdateTimer = browserTimer,
	) {}

	// `rows` is the class's own array, safe to share because it is only ever
	// replaced: the view sees a new array exactly when the rows changed
	// (TableScreen's deriveds re-run on identity), and a progress-only update
	// leaves them alone.
	snapshot(): LoadSnapshot {
		return {
			rows: this.rows,
			failedIds: [...this.failedIds],
			loading: this.loading,
			retrying: this.retrying,
			progress: { ...this.progress },
		};
	}

	// Sends now, unless an update went out within UPDATE_INTERVAL_MS: then the
	// cooldown's timer sends the newest state when it ends.
	private emit(): void {
		if (this.cancelled) return;
		if (this.cooldown !== null) {
			this.pending = true;
			return;
		}
		this.send();
	}

	// For changes the user must see at once (the table replacing the loading
	// screen, a load or retry starting or ending): sends now and replaces any
	// update the throttle still holds.
	private flush(): void {
		if (this.cancelled) return;
		this.stopCooldown();
		this.send();
	}

	private send(): void {
		this.pending = false;
		this.onUpdate(this.snapshot());
		this.cooldown = this.timer.set(() => {
			this.cooldown = null;
			if (this.pending) this.send();
		}, UPDATE_INTERVAL_MS);
	}

	private stopCooldown(): void {
		if (this.cooldown !== null) this.timer.clear(this.cooldown);
		this.cooldown = null;
		this.pending = false;
	}

	cancel(): void {
		this.cancelled = true;
		this.stopCooldown();
	}

	private isCurrent(loadNumber: number): boolean {
		return !this.cancelled && loadNumber === this.loadNumber;
	}

	// A settings change hands every leaf the scope its saved settings resolve
	// to, changed or not. The same scope (by key) is a no-op returning null, so
	// only enabling or disabling a generation reloads. A new one supersedes
	// the running load or retry, clears the rows, failures and progress, and
	// loads the new scope. `loading` stays as it was: a table already showing
	// stays mounted (PokedexApp shows it only once `loading` is off), empty
	// while the new rows stream in, so its filters, sort and an open detail
	// screen survive.
	setScope(scope: GenerationScope): Promise<LoadOutcome | null> {
		if (this.cancelled || scope.key === this.scope.key) return Promise.resolve(null);
		this.loadNumber++;
		this.scope = scope;
		this.rows = [];
		this.failedIds = [];
		this.retrying = false;
		this.progress = { loaded: 0, total: 0 };
		this.flush();
		return this.load();
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
		const loadNumber = this.loadNumber;
		const result = await this.repository.getTableRows(
			this.scope.fetchRange,
			(loaded, total) => {
				if (!this.isCurrent(loadNumber)) return;
				this.progress = { loaded, total };
				this.emit();
			},
			() => !this.isCurrent(loadNumber),
			(row) => {
				if (!this.isCurrent(loadNumber)) return;
				const admitted = this.admit([row]);
				if (admitted.length === 0) return;
				this.rows = [...this.rows, ...admitted];
				if (this.loading) {
					this.loading = false;
					this.flush();
				} else {
					this.emit();
				}
			},
		);
		if (!this.isCurrent(loadNumber)) return null;
		this.rows = this.admit(result.rows);
		// failedIds are bare ids (a row never got built, nothing to check
		// generationId on) — a failure always happens on the *base* fetch id
		// (see getRowsForIds: a regional-variant failure is caught separately
		// and never propagates here), which is always a plain dex number, so
		// this stays the simple dex-range check.
		this.failedIds = result.failedIds.filter((id) => this.scope.includesFailedId(id));
		this.loading = false;
		this.flush();
		return this.failedIds.length > 0 ? { loaded: this.rows.length, failed: this.failedIds.length } : null;
	}

	// Returns null (a no-op) if there's nothing to retry, a retry is already in
	// flight, or the load was cancelled or superseded (setScope) meanwhile. `recovered` counts ids
	// (`attempted - stillFailing`), not rows: a base id's regional-form rows
	// come back with it, so a row count would overstate it.
	async retry(): Promise<RetryOutcome | null> {
		if (this.failedIds.length === 0 || this.retrying) return null;
		const attempted = this.failedIds.length;
		const loadNumber = this.loadNumber;
		this.retrying = true;
		this.flush();
		const result = await this.repository.retryRows(
			this.failedIds,
			(loaded, total) => {
				if (!this.isCurrent(loadNumber)) return;
				this.progress = { loaded, total };
				this.emit();
			},
			() => !this.isCurrent(loadNumber),
		);
		// A superseded retry leaves `retrying` alone: setScope cleared it, and
		// the new scope may have a retry of its own in flight by now.
		if (loadNumber !== this.loadNumber) return null;
		this.retrying = false;
		if (this.cancelled) return null;
		this.mergeRows(this.admit(result.rows));
		this.failedIds = result.failedIds;
		this.flush();
		return {
			attempted,
			recovered: attempted - result.failedIds.length,
			stillFailing: result.failedIds.length,
		};
	}
}
