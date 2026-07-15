import { GENERATIONS } from "../data/constants";

const LATEST_GEN = Math.max(...GENERATIONS.map((g) => g.id));

// Shared by MoveBrowser (move version-group tabs) and FlavorTextPanel
// (flavor-text version tabs): both need "the tabs this entry actually has
// data for, scoped to the currently Active Gen, falling back to the latest
// supported generation's tabs when Active Gen predates this entry" (e.g.
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
	return (tabsByGen[LATEST_GEN] ?? []).filter(hasData);
}
