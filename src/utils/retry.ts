export interface RetryOptions {
	retries?: number;
	baseDelayMs?: number;
	// Return false to stop retrying immediately (e.g. a 404 that will never
	// succeed no matter how many times it's requested).
	shouldRetry?: (error: unknown) => boolean;
}

// Falls back to the global timer under vitest, where there's no `window`.
const timers = typeof window !== "undefined" ? window : globalThis;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => timers.setTimeout(resolve, ms));
}

export function isRetryableHttpError(error: unknown): boolean {
	const status = (error as { status?: number })?.status;
	if (typeof status !== "number") return true; // network error, no status: worth retrying
	return status >= 500 || status === 429; // server errors + rate limiting; 4xx otherwise is permanent
}

// Retries `fn` with exponential backoff (baseDelayMs, 2x, 4x, ...). Used for
// PokeAPI calls so a single dropped connection during the initial cache
// warm-up doesn't immediately count as a failed id.
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
	const { retries = 2, baseDelayMs = 300, shouldRetry = isRetryableHttpError } = options;
	let lastError: unknown;
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (attempt === retries || !shouldRetry(error)) throw error;
			await sleep(baseDelayMs * 2 ** attempt);
		}
	}
	throw lastError;
}
