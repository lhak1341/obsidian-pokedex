// Leaf hotkeys (CONTEXT.md) have one keydown listener per leaf, PokedexView's,
// gated on the active leaf by resolveLeafHotkey. That no other file listens is
// eslint's (no-restricted-syntax, eslint.config.mjs); a lint rule cannot say a
// listener must exist, so this pins the one that must.
import { describe, expect, it } from "vitest";
import pokedexViewSource from "./PokedexView.ts?raw";

describe("leaf hotkey listener", () => {
	it("is registered by PokedexView", () => {
		expect(pokedexViewSource).toMatch(/this\.registerDomEvent\(window, "keydown",/);
	});
});
