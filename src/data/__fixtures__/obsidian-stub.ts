// The real "obsidian" package ships types only (package.json "main": "") — it
// has no runtime module. Vitest is aliased to this stub so files that import
// from "obsidian" (e.g. PokeApiClient's `requestUrl`) can be loaded under
// test. FakePokeApiClient overrides every PokeApiClient method, so
// `requestUrl` itself is never actually invoked.
export function requestUrl(): never {
	throw new Error("requestUrl is not available under vitest — use a fake instead of the real client");
}
