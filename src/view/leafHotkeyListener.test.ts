// Leaf hotkeys (CONTEXT.md) have one keydown listener per leaf, PokedexView's,
// gated on the active leaf by resolveLeafHotkey. A component that listened on
// the window itself would see every leaf's keys again: DetailScreen's arrows
// did, stepping background tabs (probed live). eslint parses no .svelte here,
// so this scan is the only check that sees the components.
// Reads the sources from disk to scan every one, so it needs Node's types.
/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL("..", import.meta.url));
const sources = readdirSync(srcDir, { recursive: true, encoding: "utf8" })
	.filter((f) => /\.(svelte|ts)$/.test(f) && !f.endsWith(".test.ts"))
	.map((f) => ({ file: f.split("\\").join("/"), source: readFileSync(join(srcDir, f), "utf8") }));

// addEventListener("keydown"…) / registerDomEvent(…, "keydown"…) on any target,
// and Svelte's <svelte:window onkeydown> / <svelte:document onkeydown>.
const KEYDOWN_LISTENER = /(?:addEventListener|registerDomEvent)\([^)]*["']keydown["']|<svelte:(?:window|document)[^>]*onkeydown/;

describe("leaf hotkey listener", () => {
	it("scans the components", () => {
		expect(sources.some(({ file }) => file === "view/components/DetailScreen.svelte")).toBe(true);
	});

	it("is registered only in PokedexView (plus the open Info popover's Escape)", () => {
		const listeners = sources.filter(({ source }) => KEYDOWN_LISTENER.test(source)).map(({ file }) => file);
		// infoPopover's Escape listener is attached only while a popover is
		// open and only dismisses it: not a leaf hotkey.
		expect(listeners).toEqual(["view/PokedexView.ts", "view/infoPopover.svelte.ts"]);
	});
});
