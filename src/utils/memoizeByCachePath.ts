// Memoizes a per-image computation by the image's cache path
// (`images/6-artwork.png`, from PokedexRepository.imagePathOf), not by its URL:
// an evicted image comes back under a new blob URL, so a URL key would
// recompute it and keep a dead entry for the old one. A rejection (a URL
// revoked before it loaded) is dropped, so the next URL for that path is
// tried. `compute` is injected so the rule is testable without a DOM
// (imageBounds.ts's contentScale passes its canvas decode).
export function memoizeByCachePath<T>(
	compute: (url: string) => Promise<T>,
): (cachePath: string, url: string) => Promise<T> {
	const memo = new Map<string, Promise<T>>();
	return (cachePath, url) => {
		let pending = memo.get(cachePath);
		if (!pending) {
			const started = compute(url);
			pending = started;
			memo.set(cachePath, started);
			started.catch(() => {
				if (memo.get(cachePath) === started) memo.delete(cachePath);
			});
		}
		return pending;
	};
}
