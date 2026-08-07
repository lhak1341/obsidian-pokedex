// Pure display-decision half of the Settings tab's per-generation Cache/
// Refresh/Delete row — the state half (actionKind/status) already lives in
// GenerationCacheController, tested there. Icon/tooltip is a function of
// ONLY actionKind: the in-progress callback never recomputes it, so it stays
// whatever it was before the run started. Status text is a function of all
// three inputs since it's the one thing that unifies the idle "X/Y cached."
// template and the in-progress "Caching... X/Y." template that used to be
// two separate string literals in settings.ts.
export function describeGenerationAction(actionKind: "cache" | "refresh"): { icon: string; tooltip: string } {
	return actionKind === "refresh"
		? { icon: "refresh-cw", tooltip: "Re-fetch this generation from PokeAPI, bypassing the cache" }
		: { icon: "download", tooltip: "Prefetch this generation so browsing it is instant" };
}

export function describeGenerationStatus(
	baseDesc: string,
	status: { cached: number; total: number } | null,
	running: { kind: "cache" | "refresh"; loaded: number; total: number } | null,
): string {
	if (running) {
		return `${baseDesc} ${running.kind === "refresh" ? "Refreshing" : "Caching"}... ${running.loaded}/${running.total}.`;
	}
	return status ? `${baseDesc} ${status.cached}/${status.total} cached.` : baseDesc;
}
