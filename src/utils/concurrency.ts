// Runs `fn` over `items` with at most `limit` in flight at once. Each result
// is reported through `onResult` as it settles (not batched), so callers can
// still surface partial progress even if some items throw.
export async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>,
	onResult?: (result: { index: number; value: R } | { index: number; error: unknown }) => void,
): Promise<void> {
	let cursor = 0;

	async function worker(): Promise<void> {
		while (cursor < items.length) {
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
