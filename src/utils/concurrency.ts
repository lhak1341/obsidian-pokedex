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
