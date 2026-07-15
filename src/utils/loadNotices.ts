// User-facing Notice text for PokedexApp's browse-table load and retry
// flows. Pure string composition, pulled out for the same reason as any
// other untested branching logic in this codebase — not because either
// function has more than one call site.

// Only meaningful when failedCount > 0 — the caller only shows this Notice
// in that case (a fully-successful load gets no Notice at all), so this
// doesn't branch on failedCount itself.
export function describePartialLoadOutcome(loadedCount: number, failedCount: number): string {
	return (
		`Pokedex: showing ${loadedCount} of ${loadedCount + failedCount} ` +
		"Pokemon; some entries couldn't be fetched (offline or PokeAPI unreachable)."
	);
}

export function describeRetryOutcome(attempted: number, recovered: number, stillFailing: number): string {
	if (stillFailing === 0) return "Pokedex: all entries loaded.";
	return `Pokedex: ${recovered} of ${attempted} retried entries loaded; ${stillFailing} still unreachable.`;
}
