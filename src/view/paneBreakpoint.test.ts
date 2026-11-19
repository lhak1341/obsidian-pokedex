// One threshold: a Pokedex leaf narrower than NARROW_PANE_MAX_WIDTH is a
// Narrow pane. JS measures the leaf (PokedexApp's ResizeObserver); CSS reads
// the same leaf as the `pane` container (styles.src.css), so a narrow query
// is written in that number with no padding arithmetic. #31 first wrote it as
// `detail (width < 554px)`, derived from a wrong 46px of padding (it is ~71px
// on desktop and differs where scrollbars overlay), which made the detail
// screen go narrow at a ~625px leaf while browse switched at 600.
// Reads the components from disk to scan every one, so it needs Node's types.
/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NARROW_PANE_MAX_WIDTH } from "../utils/browseLayout";

const root = fileURLToPath(new URL("../..", import.meta.url));
const componentsDir = join(root, "src/view/components");
const components = readdirSync(componentsDir)
	.filter((f) => f.endsWith(".svelte"))
	.map((f) => ({ file: f, source: readFileSync(join(componentsDir, f), "utf8") }));
const queries = components.flatMap(({ file, source }) =>
	[...source.matchAll(/@container\s+([\w-]+)\s*\(([^)]*)\)/g)].map((m) => ({ file, name: m[1], condition: m[2].trim() })),
);
// A query that applies below a width: `width < N`, `width <= N` or `max-width: N`.
const isNarrow = (condition: string) => /^width\s*<|max-width/.test(condition);

describe("narrow pane breakpoint", () => {
	it("is declared on the leaf the ResizeObserver measures", () => {
		const viewType = /VIEW_TYPE_POKEDEX = "([^"]+)"/.exec(readFileSync(join(root, "src/view/PokedexView.ts"), "utf8"))?.[1];
		const css = readFileSync(join(root, "styles.src.css"), "utf8").replace(/\s+/g, " ");
		expect(viewType).toBe("pokedex-view");
		expect(css).toContain(`.workspace-leaf-content[data-type="${viewType}"] { container: pane / inline-size; }`);
	});

	it("every narrow pane query uses NARROW_PANE_MAX_WIDTH", () => {
		const pane = queries.filter((q) => q.name === "pane");
		// The phone hero and header (#31) at least: the scan found something.
		expect(pane.length).toBeGreaterThanOrEqual(3);
		for (const q of pane.filter((q) => isNarrow(q.condition))) {
			expect({ file: q.file, condition: q.condition }).toEqual({ file: q.file, condition: `width < ${NARROW_PANE_MAX_WIDTH}px` });
		}
	});

	it("no narrow query is written against an inner container", () => {
		const inner = queries.filter((q) => q.name !== "pane" && isNarrow(q.condition));
		expect(inner.map((q) => `${q.file}: @container ${q.name} (${q.condition})`)).toEqual([]);
	});
});
