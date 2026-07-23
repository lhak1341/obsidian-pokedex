// Caps how many `fn` calls run at once *globally*, independent of how many
// separate callers are dispatching work — unlike mapWithConcurrency's limit,
// which only bounds one particular array-processing call, a single Semaphore
// instance shared across every call site (e.g. PokeApiClient's live HTTP
// calls) enforces its cap no matter how many concurrent id-fetch loops are
// feeding it at once.
export class Semaphore {
	private queue: (() => void)[] = [];
	private active = 0;

	constructor(private limit: number) {}

	async run<T>(fn: () => Promise<T>): Promise<T> {
		if (this.active >= this.limit) {
			await new Promise<void>((resolve) => this.queue.push(resolve));
		}
		this.active++;
		try {
			return await fn();
		} finally {
			this.active--;
			this.queue.shift()?.();
		}
	}
}

// Runs `fn` over `items` with at most `limit` in flight at once. Each result
// is reported through `onResult` as it settles (not batched), so callers can
// still surface partial progress even if some items throw.
//
// `isCancelled` is checked before a worker picks up its next item — it can't
// abort work already in flight (no AbortController plumbed through `fn`),
// but it stops queuing new ones, which is what matters for a caller (e.g. a
// closed/remounted view) that no longer wants the remaining items fetched.
export async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>,
	onResult?: (result: { index: number; value: R } | { index: number; error: unknown }) => void,
	isCancelled?: () => boolean,
): Promise<void> {
	let cursor = 0;

	async function worker(): Promise<void> {
		while (cursor < items.length) {
			if (isCancelled?.()) return;
			const index = cursor++;
			try {
				const value = await fn(items[index], index);
				onResult?.({ index, value });
			} catch (error) {
				onResult?.({ index, error });
			}
		}
	}

	const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
	await Promise.all(workers);
}
