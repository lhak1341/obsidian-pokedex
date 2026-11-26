// A pop-out leaf is drawn in its own window, while the plugin's code runs in
// the main one, so the bare `window` globals measure and schedule against the
// wrong window there (both probed live: domPosition.ts's windowOf). Geometry
// and frames come from an element's own window through windowOf; this scan
// is the only check that sees the components (eslint parses no .svelte here)
// and infoPopover.svelte.ts (a rune module, untestable without jsdom).
// Reads the sources from disk to scan every one, so it needs Node's types.
/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const viewDir = fileURLToPath(new URL(".", import.meta.url));
const sources = readdirSync(viewDir, { recursive: true, encoding: "utf8" })
	.filter((f) => /\.(svelte|ts)$/.test(f) && !f.endsWith(".test.ts"))
	.map((f) => ({ file: f.split("\\").join("/"), source: readFileSync(join(viewDir, f), "utf8") }));

// The viewport's size, or a frame, from the global window: `window.innerHeight`,
// `activeWindow.innerWidth`, a bare `requestAnimationFrame(`. A property read
// off another object (`win.requestAnimationFrame`, `pw.innerHeight`) passes.
const GLOBAL_WINDOW_READ =
	/(?:^|[^.\w])(?:(?:window|activeWindow|globalThis)\.(?:innerHeight|innerWidth|requestAnimationFrame|cancelAnimationFrame)|(?:innerHeight|innerWidth|requestAnimationFrame|cancelAnimationFrame)\b(?!\s*:))/m;

// Comment lines describe the rule; only code is scanned.
function code(source: string): string {
	return source
		.split("\n")
		.filter((line) => !/^\s*(?:\/\/|\*|\/\*)/.test(line))
		.join("\n");
}

describe("own-window reads", () => {
	it("scans the components and the rune modules", () => {
		const files = sources.map(({ file }) => file);
		expect(files.includes("components/TableGrid.svelte")).toBe(true);
		expect(files.includes("infoPopover.svelte.ts")).toBe(true);
	});

	it("takes the viewport's size and frames from an element's own window, never the global one", () => {
		const offenders = sources.filter(({ source }) => GLOBAL_WINDOW_READ.test(code(source))).map(({ file }) => file);
		expect(offenders).toEqual([]);
	});
});
