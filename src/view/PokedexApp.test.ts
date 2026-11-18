import { describe, expect, it } from "vitest";
import template from "./PokedexApp.svelte?raw";

// PokedexView casts the mounted app to `{ show(record) }` (its MountedApp type)
// and calls it for every View history entry. tsc skips .svelte, so a rename
// here would build clean and throw on the first navigation.
describe("PokedexApp exports", () => {
	it("exports the show(record) PokedexView calls", () => {
		expect(template).toMatch(/export function show\(record: NavRecord\): ScrollInstruction/);
	});
});
