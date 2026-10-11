import { describe, expect, it } from "vitest";
import { createFakeDataAdapter, FakePokeApiClient } from "../data/__fixtures__/fakes";
import { makeRegionalFormRow } from "../data/__fixtures__/rows";
import { DiskCache } from "../data/Cache";
import { PokedexRepository } from "../data/PokedexRepository";
import type { PokedexTableRow } from "../data/types";
import type { GenerationScope } from "../utils/generationScope";
import { type LoadSnapshot, PokedexLoadState } from "./PokedexLoadState";

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
	const cache = DiskCache.forTest(createFakeDataAdapter(), "cache");
	const repository = new PokedexRepository(client, cache);
	const scope: GenerationScope = { fetchRange: range, includes, includesFailedId };
	return { client, updates, loadState: new PokedexLoadState(repository, scope, (s) => updates.push(s)) };
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
		// each update hands over a fresh rows array (TableScreen's deriveds key on identity)
		expect(new Set(updates.map((u) => u.rows)).size).toBe(updates.length);
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
