import { describe, expect, it, vi } from "vitest";
import { memoizeByCachePath } from "./memoizeByCachePath";

describe("memoizeByCachePath", () => {
	it("computes once per cache path, whatever URL the image comes back under", async () => {
		const compute = vi.fn(async (url: string) => url.length);
		const measure = memoizeByCachePath(compute);

		const first = await measure("images/6-artwork.png", "blob:a");
		const again = await measure("images/6-artwork.png", "blob:bbbb");

		expect(again).toBe(first);
		expect(compute).toHaveBeenCalledTimes(1);
	});

	it("forgets a failed computation, so the next URL for that path is tried", async () => {
		const compute = vi.fn(async (url: string) => {
			if (url === "blob:revoked") throw new Error("decode failed");
			return 0.9;
		});
		const measure = memoizeByCachePath(compute);

		await expect(measure("images/6-artwork.png", "blob:revoked")).rejects.toThrow("decode failed");
		await expect(measure("images/6-artwork.png", "blob:live")).resolves.toBe(0.9);
		expect(compute).toHaveBeenCalledTimes(2);
	});
});
