// Copies `keys` from `source` onto `target`, mutating `target` in place.
// Built for mirroring a plain, non-reactive orchestration class (see
// PokedexLoadState/DetailLoadState) onto a Svelte 5 `$state` object — Svelte
// only deep-proxies plain objects, not class instances, so a component can't
// just watch the class directly. `target` is that $state object; a
// component calls this from the class's onUpdate-style callback instead of
// hand-reassigning each field.
//
// `keys` is required, not inferred from `source`'s own enumerable
// properties: TypeScript's `private` constructor-param fields (e.g.
// PokedexLoadState's `repository`) are compile-time only — at runtime
// they're ordinary enumerable instance properties. A blind copy-everything
// approach would leak those internal references into reactive state.
export function mirrorInto<T extends object, K extends keyof T>(
	target: Pick<T, K>,
	source: T,
	keys: readonly K[],
): void {
	for (const key of keys) {
		target[key] = source[key];
	}
}
