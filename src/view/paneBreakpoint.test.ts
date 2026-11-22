// Leaf widths are written as leaf widths. JS measures the leaf (PokedexApp's
// ResizeObserver: the Narrow pane, the detail band); CSS reads the same leaf
// as the `pane` container (styles.src.css), so a query is written in one of
// those named numbers with no padding arithmetic. #31 first wrote the phone
// hero as `detail (width < 554px)`, derived from a wrong 46px of padding (it
// is ~71px on desktop and differs where scrollbars overlay), which made the
// detail screen go narrow at a ~625px leaf while browse switched at 600.
// Reads the components from disk to scan every one, so it needs Node's types.
/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	DETAIL_HEADER_ONE_ROW_MIN_WIDTH,
	DETAIL_HERO_TYPES_STACK_MAX_WIDTH,
	DETAIL_PHONE_MAX_WIDTH,
} from "../utils/detailBand";

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
// Containers that answer a component's own width, which no leaf width
// stands for, so they are not a converted leaf threshold: the sections are
// tabs on the phone, a tab beside the identity rail from 760, then a third
// (Moves) or middle column from 1100, so "is this section too narrow" is not
// monotonic in the leaf width. MoveBrowser's `moves`; DetailScreen's `paired`
// (Base stats beside Abilities) and `capture` (the ring line, which Ring and
// GenderRing lay out too, so its widths are pinned below by CAPTURE_WIDTHS);
// EvolutionTree's `evo` (its smallest cards).
const COMPONENT_WIDTH_CONTAINERS: Record<string, readonly string[]> = {
	moves: ["MoveBrowser.svelte"],
	paired: ["DetailScreen.svelte"],
	capture: ["DetailScreen.svelte", "Ring.svelte", "GenderRing.svelte"],
	evo: ["EvolutionChain.svelte"],
};
// `capture` is the one component container queried from more than one file,
// and a container query cannot read a variable, so each file writes the
// number itself (ADR-0018). These are the widths every copy must use: rings
// beside their labels from 540, a 2x2 grid below 360 (DetailScreen only).
const CAPTURE_WIDTHS = { ringsBeside: 540, grid: 360 } as const;
// The leaf widths a component may query, by file. Browse switches at the
// Narrow pane in JS (PokedexApp), so no component queries 600.
const PANE_THRESHOLDS: Record<string, readonly number[]> = {
	"DetailScreen.svelte": [DETAIL_PHONE_MAX_WIDTH, DETAIL_HEADER_ONE_ROW_MIN_WIDTH, DETAIL_HERO_TYPES_STACK_MAX_WIDTH],
	"PortraitPanel.svelte": [DETAIL_PHONE_MAX_WIDTH],
};

describe("pane breakpoints", () => {
	it("is declared on the leaf the ResizeObserver measures", () => {
		const viewType = /VIEW_TYPE_POKEDEX = "([^"]+)"/.exec(readFileSync(join(root, "src/view/PokedexView.ts"), "utf8"))?.[1];
		const css = readFileSync(join(root, "styles.src.css"), "utf8").replace(/\s+/g, " ");
		expect(viewType).toBe("pokedex-view");
		expect(css).toContain(`.workspace-leaf-content[data-type="${viewType}"] { container: pane / inline-size; }`);
	});

	// Both directions: the one-row header's `width >= 780px` is the complement
	// of the two-row `width < 780px`, and moving either alone leaves a band of
	// leaf widths with neither layout's rules.
	it("every pane query uses one of its file's named leaf widths", () => {
		const pane = queries.filter((q) => q.name === "pane");
		// The phone hero and header (#31) at least: the scan found something.
		expect(pane.length).toBeGreaterThanOrEqual(3);
		for (const q of pane) {
			const allowed = (PANE_THRESHOLDS[q.file] ?? []).flatMap((w) => [`width < ${w}px`, `width >= ${w}px`]);
			expect({ file: q.file, allowed: allowed.includes(q.condition) }).toEqual({ file: q.file, allowed: true });
		}
	});

	it("the phone hero follows the phone band (760)", () => {
		for (const file of ["DetailScreen.svelte", "PortraitPanel.svelte"]) {
			const conditions = queries.filter((q) => q.file === file && q.name === "pane").map((q) => q.condition);
			expect(conditions).toContain(`width < ${DETAIL_PHONE_MAX_WIDTH}px`);
		}
	});

	it("the detail header has two rows below a 780px leaf (#33)", () => {
		const header = queries.filter((q) => q.file === "DetailScreen.svelte" && q.name === "pane");
		expect(header.map((q) => q.condition)).toContain(`width < ${DETAIL_HEADER_ONE_ROW_MIN_WIDTH}px`);
	});

	it("no narrow query is written against an inner container", () => {
		const inner = queries.filter(
			(q) => q.name !== "pane" && isNarrow(q.condition) && !COMPONENT_WIDTH_CONTAINERS[q.name]?.includes(q.file),
		);
		expect(inner.map((q) => `${q.file}: @container ${q.name} (${q.condition})`)).toEqual([]);
	});

	it("every capture query uses a named Capture & Breeding width", () => {
		const capture = queries.filter((q) => q.name === "capture");
		const allowed = Object.values(CAPTURE_WIDTHS).map((w) => `width < ${w}px`);
		expect(capture.length).toBeGreaterThanOrEqual(4);
		for (const q of capture) {
			expect({ file: q.file, condition: q.condition, allowed: allowed.includes(q.condition) }).toEqual({
				file: q.file,
				condition: q.condition,
				allowed: true,
			});
		}
	});

	it("the panel and both rings switch at the same capture width", () => {
		const beside = `width < ${CAPTURE_WIDTHS.ringsBeside}px`;
		for (const file of COMPONENT_WIDTH_CONTAINERS.capture) {
			const conditions = queries.filter((q) => q.file === file && q.name === "capture").map((q) => q.condition);
			expect({ file, conditions, switches: conditions.includes(beside) }).toEqual({ file, conditions, switches: true });
		}
	});
});
