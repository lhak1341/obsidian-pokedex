// Shared by MoveBrowser (move version-group tabs) and FlavorTextPanel
// (flavor-text version tabs): both need "the tabs this entry actually has
// data for, scoped to the currently Active Gen, falling back to the nearest
// other generation's tabs when Active Gen's own data is missing" (e.g.
// viewing a Gen 4 mon with Active Gen set to Gen 3, which has no data for it
// at all). `hasData` is the only thing that differs between callers — move
// tabs check a version-group Set, flavor tabs check a Record for a truthy
// value.
export function resolveTabsForGen<T extends { key: string }>(
	tabsByGen: Record<number, readonly T[]>,
	activeGen: number,
	hasData: (tab: T) => boolean,
): T[] {
	const primary = (tabsByGen[activeGen] ?? []).filter(hasData);
	if (primary.length > 0) return primary;
	// Falling back to LATEST_GEN specifically used to be a no-op whenever
	// activeGen was already LATEST_GEN (the default Active Gen for every
	// fresh install, and the common case) — this entry's cached data simply
	// doesn't cover the active generation's version group/version (e.g. a
	// moves/flavor-text cache trimmed before this generation's support
	// existed, see PokedexRepository's isStale comments), and retrying the
	// exact same failed lookup just re-fails identically, leaving the panel
	// showing zero tabs and zero rows. Search every other generation instead,
	// nearest to activeGen first (ties broken toward the later generation),
	// so a stale/incomplete cache still surfaces whichever data it actually
	// has rather than going blank.
	const candidates = Object.keys(tabsByGen)
		.map(Number)
		.filter((gen) => gen !== activeGen)
		.sort((a, b) => Math.abs(a - activeGen) - Math.abs(b - activeGen) || b - a);
	for (const gen of candidates) {
		const fallback = (tabsByGen[gen] ?? []).filter(hasData);
		if (fallback.length > 0) return fallback;
	}
	return [];
}
