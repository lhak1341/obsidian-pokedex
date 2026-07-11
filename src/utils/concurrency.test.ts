import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./concurrency";

describe("mapWithConcurrency", () => {
	it("never has more than `limit` tasks in flight", async () => {
		let active = 0;
		let maxActive = 0;
		await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (item) => {
			active++;
			maxActive = Math.max(maxActive, active);
			await new Promise((resolve) => setTimeout(resolve, 5));
			active--;
			return item * 2;
		});
		expect(maxActive).toBeLessThanOrEqual(2);
	});

	it("reports both successes and failures without aborting the batch", async () => {
		const results: Array<{ index: number; ok: boolean }> = [];
		await mapWithConcurrency(
			[1, 2, 3],
			3,
			async (item) => {
				if (item === 2) throw new Error("boom");
				return item;
			},
			(result) => {
				results.push({ index: result.index, ok: "value" in result });
			},
		);
		expect(results).toHaveLength(3);
		expect(results.find((r) => r.index === 1)?.ok).toBe(false);
		expect(results.filter((r) => r.ok)).toHaveLength(2);
	});

	it("stops picking up new items once isCancelled() is true", async () => {
		let cancelled = false;
		const started: number[] = [];
		await mapWithConcurrency(
			[1, 2, 3, 4, 5, 6],
			1,
			async (item) => {
				started.push(item);
				if (item === 2) cancelled = true;
				return item;
			},
			undefined,
			() => cancelled,
		);
		expect(started).toEqual([1, 2]);
	});
});
