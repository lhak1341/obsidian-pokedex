import { describe, expect, it, vi } from "vitest";
import { isRetryableHttpError, withRetry } from "./retry";

describe("isRetryableHttpError", () => {
	it("retries 5xx and 429", () => {
		expect(isRetryableHttpError({ status: 500 })).toBe(true);
		expect(isRetryableHttpError({ status: 503 })).toBe(true);
		expect(isRetryableHttpError({ status: 429 })).toBe(true);
	});

	it("does not retry 4xx (other than 429)", () => {
		expect(isRetryableHttpError({ status: 404 })).toBe(false);
		expect(isRetryableHttpError({ status: 400 })).toBe(false);
	});

	it("retries errors with no status (network failures)", () => {
		expect(isRetryableHttpError(new Error("network down"))).toBe(true);
	});
});

describe("withRetry", () => {
	it("returns the result on first success without delay", async () => {
		const fn = vi.fn().mockResolvedValue("ok");
		await expect(withRetry(fn, { baseDelayMs: 1 })).resolves.toBe("ok");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("retries transient failures up to the configured count", async () => {
		const fn = vi.fn()
			.mockRejectedValueOnce({ status: 503 })
			.mockRejectedValueOnce({ status: 503 })
			.mockResolvedValueOnce("ok");
		await expect(withRetry(fn, { retries: 2, baseDelayMs: 1 })).resolves.toBe("ok");
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it("gives up after exhausting retries", async () => {
		const fn = vi.fn().mockRejectedValue({ status: 503 });
		await expect(withRetry(fn, { retries: 2, baseDelayMs: 1 })).rejects.toEqual({ status: 503 });
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it("does not retry a permanent (non-retryable) error", async () => {
		const fn = vi.fn().mockRejectedValue({ status: 404 });
		await expect(withRetry(fn, { retries: 2, baseDelayMs: 1 })).rejects.toEqual({ status: 404 });
		expect(fn).toHaveBeenCalledTimes(1);
	});
});
