import { describe, expect, it } from "vitest";
import { createFakeDataAdapter, FakePokeApiClient } from "../data/__fixtures__/fakes";
import { DiskCache } from "../data/Cache";
import { PokedexRepository } from "../data/PokedexRepository";
import type { PokedexTableRow } from "../data/types";
import { PokedexLoadState } from "./PokedexLoadState";

function makeLoadState(
	range: { start: number; end: number },
	includes: (row: PokedexTableRow) => boolean = () => true,
	// Empty = unfiltered (matches EMPTY_FILTERS semantics) — only the
	// generation-filter-specific tests need a real list.
	enabledGenerations: number[] = [],
) {
	const client = new FakePokeApiClient();
	const cache = DiskCache.forTest(createFakeDataAdapter(), "cache");
	const repository = new PokedexRepository(client, cache);
	return { client, loadState: new PokedexLoadState(repository, range, includes, enabledGenerations) };
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

	it("load()'s onRow callback only fires for ids includes() allows", async () => {
		const { loadState } = makeLoadState({ start: 1, end: 3 }, (row) => row.id !== 2);
		const seen: number[] = [];

		await loadState.load(undefined, (row) => seen.push(row.id));

		expect(seen.sort((a, b) => a - b)).toEqual([1, 3]);
	});

	it("retry() merges recovered rows into the existing set and clears them from failedIds", async () => {
		const { client, loadState } = makeLoadState({ start: 1, end: 3 });
		client.failIds.add(2);
		await loadState.load();

		client.failIds.delete(2);
		const result = await loadState.retry();

		expect(result?.rows.map((r) => r.id)).toEqual([2]);
		expect(result?.failedIds).toEqual([]);
		expect(loadState.rows.map((r) => r.id)).toEqual([1, 2, 3]);
		expect(loadState.failedIds).toEqual([]);
	});

	it("retry() is a no-op returning null when nothing failed", async () => {
		const { loadState } = makeLoadState({ start: 1, end: 1 });
		await loadState.load();

		expect(await loadState.retry()).toBeNull();
	});

	it("load() leaves rows/loading untouched when cancelled", async () => {
		const { loadState } = makeLoadState({ start: 1, end: 3 });
		loadState.cancel();

		await loadState.load();

		expect(loadState.loading).toBe(true);
		expect(loadState.rows).toEqual([]);
	});

	it("retry() is a no-op returning null when a retry is already in flight", async () => {
		const { client, loadState } = makeLoadState({ start: 1, end: 1 });
		client.failIds.add(1);
		await loadState.load();
		client.failIds.delete(1);

		const first = loadState.retry();
		const second = loadState.retry();

		expect(await second).toBeNull();
		expect((await first)?.rows.map((r) => r.id)).toEqual([1]);
	});
});
