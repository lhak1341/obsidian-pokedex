import { describe, expect, it } from "vitest";
import { FakePokeApiClient, MemoryCacheStore } from "../data/__fixtures__/fakes";
import { makeRegionalFormRow, makeRow } from "../data/__fixtures__/rows";
import { PokedexRepository } from "../data/PokedexRepository";
import type { PokedexTableRow } from "../data/types";
import type { GenerationScope } from "../utils/generationScope";
import { type LoadSnapshot, PokedexLoadState, UPDATE_INTERVAL_MS, type UpdateTimer } from "./PokedexLoadState";

// A timer on a clock that moves only when a test says so: the throttle's
// cooldown never ends on its own, so every update a test sees is one the class
// chose to send. `advance` fires only what is due, in due order, as real time
// would; `fire` ends every cooldown at once.
class ManualTimer implements UpdateTimer {
	private now = 0;
	private nextHandle = 1;
	private callbacks = new Map<number, { due: number; fn: () => void }>();
	readonly delays: number[] = [];

	set(fn: () => void, ms: number): number {
		const handle = this.nextHandle++;
		this.callbacks.set(handle, { due: this.now + ms, fn });
		this.delays.push(ms);
		return handle;
	}

	clear(handle: unknown): void {
		this.callbacks.delete(handle as number);
	}

	advance(ms: number): void {
		this.now += ms;
		const due = [...this.callbacks].filter(([, c]) => c.due <= this.now).sort(([, a], [, b]) => a.due - b.due);
		for (const [handle, c] of due) {
			this.callbacks.delete(handle);
			c.fn();
		}
	}

	fire(): void {
		this.advance(Infinity);
	}
}

// A plain permissive scope (not resolveGenerationScope, whose empty list
// would give an Infinity range): these tests exercise fetch/retry behavior,
// while generation resolution is covered by generationScope.test.ts.
function makeLoadState(
	range: { start: number; end: number },
	includes: (row: PokedexTableRow) => boolean = () => true,
	includesFailedId: (id: number) => boolean = () => true,
) {
	const updates: LoadSnapshot[] = [];
	const client = new FakePokeApiClient();
	const cache = new MemoryCacheStore();
	const repository = new PokedexRepository(client, cache);
	const scope: GenerationScope = { key: "test", fetchRange: range, includes, includesFailedId };
	const timer = new ManualTimer();
	return { client, updates, timer, loadState: new PokedexLoadState(repository, scope, (s) => updates.push(s), timer) };
}

describe("PokedexLoadState", () => {
	it("load() populates rows and flips loading off", async () => {
		const { loadState } = makeLoadState({ start: 1, end: 3 });
		expect(loadState.loading).toBe(true);

		await loadState.load();

		expect(loadState.loading).toBe(false);
		expect(loadState.rows.map((r) => r.id)).toEqual([1, 2, 3]);
		expect(loadState.failedIds).toEqual([]);
	});

	it("load() filters the fetched range down to whatever includes() allows", async () => {
		const { loadState } = makeLoadState({ start: 1, end: 3 }, (row) => row.id !== 2);

		await loadState.load();

		expect(loadState.rows.map((r) => r.id)).toEqual([1, 3]);
	});

	it("load() tracks failed ids separately from successful rows", async () => {
		const { client, loadState } = makeLoadState({ start: 1, end: 3 });
		client.failIds.add(2);

		await loadState.load();

		expect(loadState.rows.map((r) => r.id)).toEqual([1, 3]);
		expect(loadState.failedIds).toEqual([2]);
	});

	it("streams only includes()-allowed rows into the snapshots, never an out-of-scope one", async () => {
		const { loadState, updates } = makeLoadState({ start: 1, end: 3 }, (row) => row.id !== 2);

		await loadState.load();

		const everSeen = new Set(updates.flatMap((u) => u.rows.map((r) => r.id)));
		expect([...everSeen].sort((a, b) => a - b)).toEqual([1, 3]);
	});

	it("accumulates streamed rows in the snapshots and flips loading off on the first admitted row, before the load ends", async () => {
		const { loadState, updates } = makeLoadState({ start: 1, end: 3 });

		await loadState.load();

		const firstWithRow = updates.findIndex((u) => u.rows.length > 0);
		expect(firstWithRow).toBeGreaterThanOrEqual(0);
		expect(updates[firstWithRow].loading).toBe(false);
		// every snapshot with rows has loading off; rows only ever grow while streaming
		const withRows = updates.slice(firstWithRow);
		expect(withRows.every((u) => !u.loading)).toBe(true);
		expect(updates[updates.length - 1].rows.map((r) => r.id)).toEqual([1, 2, 3]);
	});

	it("load() reports { loaded, failed } only when some ids failed", async () => {
		const clean = makeLoadState({ start: 1, end: 2 });
		expect(await clean.loadState.load()).toBeNull();

		const partial = makeLoadState({ start: 1, end: 3 });
		partial.client.failIds.add(2);
		expect(await partial.loadState.load()).toEqual({ loaded: 2, failed: 1 });
	});

	it("retry() merges recovered rows into the existing set and clears them from failedIds", async () => {
		const { client, loadState } = makeLoadState({ start: 1, end: 3 });
		client.failIds.add(2);
		await loadState.load();

		client.failIds.delete(2);
		const outcome = await loadState.retry();

		expect(outcome).toEqual({ attempted: 1, recovered: 1, stillFailing: 0 });
		expect(loadState.rows.map((r) => r.id)).toEqual([1, 2, 3]);
		expect(loadState.failedIds).toEqual([]);
	});

	it("retry() drops rows includes() rejects, and counts recovered ids rather than rows", async () => {
		// Retrying a base id also returns its regional-form rows (getRowsForIds);
		// includes() rejects them here the way a disabled generation would.
		const { client, loadState } = makeLoadState({ start: 1, end: 3 }, (row) => row.generationId !== 7);
		client.failIds.add(2);
		await loadState.load();

		client.failIds.delete(2);
		const regional = makeRegionalFormRow(loadState.rows[0], { id: 10002, generationId: 7, formLabel: "Alolan" });
		const repository = (loadState as unknown as { repository: PokedexRepository }).repository;
		const real = repository.retryRows.bind(repository);
		repository.retryRows = async (...args) => {
			const result = await real(...args);
			return { ...result, rows: [...result.rows, regional] };
		};
		const outcome = await loadState.retry();

		expect(outcome).toEqual({ attempted: 1, recovered: 1, stillFailing: 0 });
		expect(loadState.rows.map((r) => r.id)).toEqual([1, 2, 3]);
	});

	it("retry() reports ids still failing", async () => {
		const { client, loadState } = makeLoadState({ start: 1, end: 3 });
		client.failIds.add(2);
		client.failIds.add(3);
		await loadState.load();

		client.failIds.delete(2);
		const outcome = await loadState.retry();

		expect(outcome).toEqual({ attempted: 2, recovered: 1, stillFailing: 1 });
		expect(loadState.failedIds).toEqual([3]);
	});

	it("retry() is a no-op returning null when nothing failed", async () => {
		const { loadState } = makeLoadState({ start: 1, end: 1 });
		await loadState.load();

		expect(await loadState.retry()).toBeNull();
	});

	it("load() leaves rows/loading untouched and never calls onUpdate when cancelled", async () => {
		const { loadState, updates } = makeLoadState({ start: 1, end: 3 });
		loadState.cancel();

		expect(await loadState.load()).toBeNull();

		expect(loadState.loading).toBe(true);
		expect(loadState.rows).toEqual([]);
		expect(updates).toEqual([]);
	});

	it("stops calling onUpdate once cancelled mid-load", async () => {
		const { loadState, updates } = makeLoadState({ start: 1, end: 3 });
		const loading = loadState.load();
		loadState.cancel();
		await loading;

		expect(updates).toEqual([]);
	});

	it("retry() is a no-op returning null when a retry is already in flight", async () => {
		const { client, loadState } = makeLoadState({ start: 1, end: 1 });
		client.failIds.add(1);
		await loadState.load();
		client.failIds.delete(1);

		const first = loadState.retry();
		const second = loadState.retry();

		expect(await second).toBeNull();
		expect(await first).toEqual({ attempted: 1, recovered: 1, stillFailing: 0 });
	});
});

// Drives load() by hand: the test calls the repository's callbacks and decides
// when the load ends, so the throttle's choices are visible one by one.
function makeDrivenLoad() {
	const updates: LoadSnapshot[] = [];
	const timer = new ManualTimer();
	let onProgress: (loaded: number, total: number) => void = () => {};
	let onRow: (row: PokedexTableRow) => void = () => {};
	let finish: (rows: PokedexTableRow[]) => void = () => {};
	const repository = {
		getTableRows: (
			_range: unknown,
			progress: typeof onProgress,
			_isCancelled: unknown,
			row: typeof onRow,
		) => {
			onProgress = progress;
			onRow = row;
			return new Promise((resolve) => {
				finish = (rows) => resolve({ rows, failedIds: [], servedFromCache: true });
			});
		},
	} as unknown as PokedexRepository;
	const scope: GenerationScope = { key: "test", fetchRange: { start: 1, end: 10 }, includes: () => true, includesFailedId: () => true };
	const loadState = new PokedexLoadState(repository, scope, (s) => updates.push(s), timer);
	const loading = loadState.load();
	return {
		updates,
		timer,
		loadState,
		loading,
		progress: (loaded: number) => onProgress(loaded, 10),
		row: (id: number) => onRow(makeRow({ id })),
		finish: (ids: number[]) => finish(ids.map((id) => makeRow({ id }))),
	};
}

describe("PokedexLoadState update throttle", () => {
	it("sends the same three updates however many ids load, while the cooldown never ends", async () => {
		const small = makeLoadState({ start: 1, end: 3 });
		await small.loadState.load();
		const large = makeLoadState({ start: 1, end: 300 });
		await large.loadState.load();

		// the first progress tick (the repository reports it before the row),
		// the first admitted row, then the load's end: the other 299 ticks and
		// 299 rows sent nothing in between
		expect(small.updates).toHaveLength(3);
		expect(large.updates).toHaveLength(3);
		expect(large.updates[2].rows).toHaveLength(300);
		expect(large.timer.delays.every((ms) => ms === UPDATE_INTERVAL_MS)).toBe(true);
	});

	it("sends the newest held state once when the cooldown ends, and nothing more", () => {
		const load = makeDrivenLoad();
		load.progress(1);
		load.progress(2);
		load.progress(3);
		expect(load.updates.map((u) => u.progress.loaded)).toEqual([1]);

		load.timer.fire();
		expect(load.updates.map((u) => u.progress.loaded)).toEqual([1, 3]);

		load.timer.fire();
		expect(load.updates).toHaveLength(2);
	});

	it("shows the first admitted row at once, inside a cooldown", () => {
		const load = makeDrivenLoad();
		load.progress(1);
		load.row(1);

		expect(load.updates).toHaveLength(2);
		expect(load.updates[1].loading).toBe(false);
		expect(load.updates[1].rows.map((r) => r.id)).toEqual([1]);
	});

	it("replaces a held update with the load's end, and sends nothing after it", async () => {
		const load = makeDrivenLoad();
		load.row(1);
		load.progress(2);
		load.finish([1, 2]);
		await load.loading;

		expect(load.updates).toHaveLength(2);
		load.timer.fire();
		expect(load.updates).toHaveLength(2);
		expect(load.updates[1].rows.map((r) => r.id)).toEqual([1, 2]);
	});

	it("starts a fresh cooldown after an update that skipped it", () => {
		const load = makeDrivenLoad();
		load.progress(1); // sent at 0: cooldown to 100
		load.timer.advance(UPDATE_INTERVAL_MS / 2);
		load.row(1); // sent at 50, past the throttle: cooldown to 150
		load.timer.advance(UPDATE_INTERVAL_MS / 2);
		load.progress(2); // at 100, still inside the second cooldown

		expect(load.updates).toHaveLength(2);
		load.timer.advance(UPDATE_INTERVAL_MS / 2);
		expect(load.updates.map((u) => u.progress.loaded)).toEqual([1, 1, 2]);
	});

	it("drops a held update on cancel", () => {
		const load = makeDrivenLoad();
		load.progress(1);
		load.progress(2);
		load.loadState.cancel();
		load.timer.fire();

		expect(load.updates).toHaveLength(1);
	});

	it("hands the view a new rows array exactly when the rows changed", () => {
		const load = makeDrivenLoad();
		load.row(1);
		load.timer.fire();
		load.progress(2);
		load.timer.fire();
		load.row(2);
		load.timer.fire();

		expect(load.updates).toHaveLength(3);
		// progress only: the same array, so TableScreen's deriveds stay put
		expect(load.updates[1].rows).toBe(load.updates[0].rows);
		// a new row: a new array, which those deriveds re-run on
		expect(load.updates[2].rows).not.toBe(load.updates[1].rows);
		expect(load.updates[2].rows.map((r) => r.id)).toEqual([1, 2]);
		// the earlier update's array was not changed in place
		expect(load.updates[0].rows.map((r) => r.id)).toEqual([1]);
	});
});

// Every getTableRows/retryRows call keeps its own callbacks, so a test can
// drive a superseded load after setScope has started the next one.
function makeScopedLoads() {
	const updates: LoadSnapshot[] = [];
	const timer = new ManualTimer();
	type Call = {
		range: { start: number; end: number };
		progress: (loaded: number, total: number) => void;
		isCancelled: () => boolean;
		row: (row: PokedexTableRow) => void;
		finish: (ids: number[], failedIds?: number[]) => void;
	};
	const loads: Call[] = [];
	const retries: { finish: (ids: number[]) => void }[] = [];
	const repository = {
		getTableRows: (
			range: Call["range"],
			progress: Call["progress"],
			isCancelled: Call["isCancelled"],
			row: Call["row"],
		) =>
			new Promise((resolve) => {
				loads.push({
					range, progress, isCancelled, row,
					finish: (ids, failedIds = []) =>
						resolve({ rows: ids.map((id) => makeRow({ id })), failedIds, servedFromCache: true }),
				});
			}),
		retryRows: () =>
			new Promise((resolve) => {
				retries.push({ finish: (ids) => resolve({ rows: ids.map((id) => makeRow({ id })), failedIds: [] }) });
			}),
	} as unknown as PokedexRepository;
	const scopeOf = (key: string, start: number, end: number): GenerationScope => ({
		key, fetchRange: { start, end }, includes: () => true, includesFailedId: () => true,
	});
	const loadState = new PokedexLoadState(repository, scopeOf("a", 1, 10), (s) => updates.push(s), timer);
	return { updates, timer, loadState, loads, retries, scopeOf };
}

describe("PokedexLoadState.setScope", () => {
	it("does nothing for a scope with the same key", async () => {
		const { loadState, loads, updates, scopeOf } = makeScopedLoads();
		const first = loadState.load();
		loads[0].finish([1, 2]);
		await first;
		const sent = updates.length;

		expect(await loadState.setScope(scopeOf("a", 50, 60))).toBeNull();

		expect(loads).toHaveLength(1);
		expect(updates).toHaveLength(sent);
		expect(loadState.rows.map((r) => r.id)).toEqual([1, 2]);
	});

	it("loads a new key's range, clearing the rows at once and keeping loading off", async () => {
		const { loadState, loads, updates, scopeOf } = makeScopedLoads();
		const first = loadState.load();
		loads[0].finish([1, 2], [3]);
		await first;

		const next = loadState.setScope(scopeOf("b", 20, 22));
		const cleared = updates[updates.length - 1];
		expect(cleared.rows).toEqual([]);
		expect(cleared.failedIds).toEqual([]);
		expect(cleared.loading).toBe(false);
		expect(loads[1].range).toEqual({ start: 20, end: 22 });

		loads[1].finish([20, 21, 22]);
		expect(await next).toBeNull();
		expect(loadState.rows.map((r) => r.id)).toEqual([20, 21, 22]);
	});

	it("drops whatever the superseded load hands back after the switch, and stops it fetching", async () => {
		const { loadState, loads, timer, scopeOf } = makeScopedLoads();
		const first = loadState.load();
		loads[0].row(makeRow({ id: 1 }));
		void loadState.setScope(scopeOf("b", 20, 22));

		expect(loads[0].isCancelled()).toBe(true);
		expect(loads[1].isCancelled()).toBe(false);
		loads[0].row(makeRow({ id: 2 }));
		loads[0].progress(5, 10);
		loads[0].finish([1, 2, 3]);
		expect(await first).toBeNull();
		timer.fire();

		expect(loadState.rows).toEqual([]);
		expect(loadState.progress).toEqual({ loaded: 0, total: 0 });
		loads[1].row(makeRow({ id: 20 }));
		expect(loadState.rows.map((r) => r.id)).toEqual([20]);
	});

	it("drops a retry the switch superseded, leaving the new scope's state alone", async () => {
		const { loadState, loads, retries, scopeOf } = makeScopedLoads();
		const first = loadState.load();
		loads[0].finish([1], [2]);
		await first;
		const retrying = loadState.retry();
		expect(loadState.retrying).toBe(true);

		void loadState.setScope(scopeOf("b", 20, 22));
		expect(loadState.retrying).toBe(false);
		retries[0].finish([2]);

		expect(await retrying).toBeNull();
		expect(loadState.rows).toEqual([]);
	});

	it("is a no-op once cancelled", async () => {
		const { loadState, loads, scopeOf } = makeScopedLoads();
		loadState.cancel();

		expect(await loadState.setScope(scopeOf("b", 20, 22))).toBeNull();
		expect(loads).toHaveLength(0);
	});
});
