// The @lhak/style adoption (lhak-style-adoption 07). TypeScript 6 loads no
// @types on its own; this test reads the vendored package and runs esbuild and
// stylelint, so it alone needs Node's types. Source text comes in through `?raw`.
/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import stylelint from "stylelint";
import { describe, expect, it } from "vitest";
import { stylesOptions } from "../scripts/styles.mjs";
import { STAT_COLORS, STAT_COLUMNS, TYPE_COLORS, TYPE_NAMES } from "./data/constants";
import filterBarSource from "./view/components/FilterBar.svelte?raw";
import pokedexViewSource from "./view/PokedexView.ts?raw";

const root = fileURLToPath(new URL("..", import.meta.url));
// Read from disk: vitest hands a `.css?raw` import back empty.
const pokemonColoursCss = readFileSync(join(root, "src/styles/pokemon-colours.css"), "utf8");

async function buildStyles(): Promise<string> {
	const result = await esbuild.build({ ...stylesOptions, absWorkingDir: root, write: false, logLevel: "silent" });
	const [output] = result.outputFiles ?? [];
	if (!output) throw new Error("esbuild wrote no stylesheet");
	return output.text;
}

/** Whitespace runs as one space: the bundle and a lone transform wrap values apart. */
const squash = (css: string) => css.replace(/\s+/g, " ");

/** Each declaration of a vendored @lhak/style sheet, e.g. `--lk-surface: var(--background-primary)`. */
function packageDeclarations(sheet: string): string[] {
	const path = createRequire(join(root, "package.json")).resolve(`@lhak/style/${sheet}`);
	// Through esbuild as the build is, which drops comments and rewrites quotes.
	const css = esbuild.transformSync(readFileSync(path, "utf8"), { loader: "css" }).code;
	return [...css.matchAll(/([a-z-]+):\s*([^;{}]+);/g)].map(([, name, value]) => squash(`${name}: ${value}`));
}

/** The body of the first rule whose whole selector is `selector`. */
function ruleBody(css: string, selector: string): string {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(?:^|[}]\\s*)${escaped}\\s*\\{([^}]*)\\}`, "m").exec(css)?.[1] ?? "";
}

/** The value one property takes in a rule body. */
function value(body: string, property: string): string | undefined {
	return new RegExp(`(?:^|[;{\\s])${property}:\\s*([^;]+);`).exec(body)?.[1]?.trim();
}

/** `--pkdx-…` names declared in the domain colour file, with their values. */
function domainColours(): Map<string, string> {
	return new Map([...pokemonColoursCss.matchAll(/(--pkdx-[a-z-]+):\s*([^;]+);/g)].map(([, n, v]) => [n, v.trim()]));
}

/** The squashed bodies of every `@media <query>` block, joined (the kit has several of its own). */
function mediaBody(css: string, query: string): string {
	const flat = squash(css);
	const head = `@media ${query} {`;
	const bodies: string[] = [];
	for (let start = flat.indexOf(head); start >= 0; start = flat.indexOf(head, start + 1)) {
		const open = start + head.length - 1;
		let depth = 0;
		for (let i = open; i < flat.length; i++) {
			if (flat[i] === "{") depth++;
			else if (flat[i] === "}" && --depth === 0) {
				bodies.push(flat.slice(open + 1, i).trim());
				break;
			}
		}
	}
	return bodies.join(" ");
}

/** Every `.svelte` file under src, read from disk. */
function svelteSources(): { path: string; text: string }[] {
	return readdirSync(join(root, "src"), { recursive: true, encoding: "utf8" })
		.filter((f) => f.endsWith(".svelte"))
		.map((f) => ({ path: f, text: readFileSync(join(root, "src", f), "utf8") }));
}

const varName = (css: string) => /^var\((--[a-z-]+)\)$/.exec(css)?.[1];

async function lint(code: string, codeFilename: string): Promise<string[]> {
	const result = await stylelint.lint({ code, codeFilename, cwd: root });
	return result.results.flatMap((r) => r.warnings.map((w) => w.rule));
}

describe("built styles.css", () => {
	it("inlines every declaration of the alias layer and the chip pattern", async () => {
		const css = squash(await buildStyles());
		expect(css).toContain(".lk-root {");
		for (const sheet of ["obsidian.css", "patterns.css"]) {
			const decls = packageDeclarations(sheet);
			expect(decls.length).toBeGreaterThan(50);
			for (const decl of decls) expect(css).toContain(decl);
		}
	});

	it("inlines the type and stat colours on the view root", async () => {
		const css = await buildStyles();
		const outer = ruleBody(css, ".pokedex-outer");
		expect(value(outer, "--pkdx-type-fire")).toBe("#F08030");
		expect(value(outer, "--pkdx-stat-speed")).toBe("#D51DAD");
	});

	it("reads the font roles, not the retired --pkx- variables", async () => {
		const css = await buildStyles();
		expect(css).not.toMatch(/--pkx-/);
		const view = ruleBody(css, ".pokedex-view");
		expect(value(view, "font-family")).toBe("var(--lk-font-label)");
		expect(value(view, "padding")).toBe("var(--lk-space-4)");
	});

	it("restates on filter chips what Obsidian's global button rules set", async () => {
		const css = await buildStyles();
		// Obsidian's bare `button { height: var(--input-height) }`: the vendored pattern answers it.
		expect(value(ruleBody(css, ".lk-chip"), "height")).toBe("auto");
		const chip = ruleBody(css, "button.filter-chip");
		expect(value(chip, "background")).toBe("var(--lk-surface-raised)");
		expect(value(chip, "box-shadow")).toBe("none");
		expect(value(chip, "color")).toBe("var(--lk-text)");
	});
});

describe("the view root", () => {
	it("carries lk-root, where the alias layer defines the --lk- roles, and the font roles", () => {
		expect(pokedexViewSource).toMatch(/this\.contentEl\.addClasses\(\["lk-root", "pokedex-outer"\]\)/);
		expect(pokedexViewSource).toMatch(/applyFontRoles\(this\.contentEl, this\.getSettings\(\)\)/);
	});

	it("carries pkdx-reduce-motion exactly while the Reduce motion setting is on", () => {
		expect(pokedexViewSource).toMatch(
			/this\.contentEl\.toggleClass\("pkdx-reduce-motion", this\.getSettings\(\)\.reduceMotion\)/,
		);
	});

	// A settings change no longer remounts the app, so the font roles and
	// Reduce motion reach contentEl only if refresh re-applies them.
	it("re-applies both on every settings refresh, not only at mount", () => {
		const refresh = /\n\trefresh\(\): void \{([\s\S]*?)\n\t\}/.exec(pokedexViewSource)?.[1] ?? "";
		const mount = /\n\tprivate mountApp\(\): void \{([\s\S]*?)\n\t\}/.exec(pokedexViewSource)?.[1] ?? "";
		expect(refresh).toMatch(/this\.applyHostSettings\(\)/);
		expect(mount).toMatch(/this\.applyHostSettings\(\)/);
		expect(pokedexViewSource).toMatch(/private applyHostSettings\(\): void \{[^}]*applyFontRoles[^}]*pkdx-reduce-motion/);
	});
});

// #26: the setting, or the OS's Reduce Motion, makes every plugin transition
// instant. The kit's transitions read --lk-duration-*, which the alias layer
// defines on `.lk-root` (0,1,0); both overrides are (0,2,0), so they win
// wherever the bundle puts them.
describe("reduce motion", () => {
	const zeroed = ["--lk-duration-fast", "--lk-duration-base", "--lk-duration-slow"];

	it("zeroes the kit durations under the setting's class", async () => {
		const body = ruleBody(await buildStyles(), ".lk-root.pkdx-reduce-motion");
		for (const name of zeroed) expect(value(body, name), name).toBe("0s");
	});

	it("zeroes them under the OS preference too", async () => {
		const media = mediaBody(await buildStyles(), "(prefers-reduced-motion: reduce)");
		const body = ruleBody(media, ".lk-root.pokedex-outer");
		for (const name of zeroed) expect(value(body, name), name).toBe("0s");
	});

	// A literal time would ignore both overrides. Durations read a token instead.
	it("leaves no literal transition or animation time in any PKDX style", () => {
		const sources = [{ path: "styles.src.css", text: readFileSync(join(root, "styles.src.css"), "utf8") }];
		for (const { path, text } of svelteSources()) {
			for (const [, style] of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) sources.push({ path, text: style });
		}
		expect(sources.length).toBeGreaterThan(20);
		const literal = sources.flatMap(({ path, text }) =>
			[...text.matchAll(/(?:transition|animation)[a-z-]*\s*:\s*([^;]+);/g)]
				.filter(([, v]) => /(?:^|[\s,(])[\d.]+m?s\b/.test(v))
				.map(([decl]) => `${path}: ${squash(decl)}`),
		);
		expect(literal).toEqual([]);
	});
});

describe("type and stat colours (domain data)", () => {
	it("names one declared hex colour for every type", () => {
		const declared = domainColours();
		expect(Object.keys(TYPE_COLORS).sort()).toEqual([...TYPE_NAMES].sort());
		for (const type of TYPE_NAMES) {
			const name = varName(TYPE_COLORS[type]);
			expect(name, type).toBe(`--pkdx-type-${type}`);
			expect(declared.get(name ?? ""), type).toMatch(/^#[0-9A-F]{6}$/);
		}
	});

	it("names one declared hex colour for every stat column", () => {
		const declared = domainColours();
		expect(Object.keys(STAT_COLORS).sort()).toEqual(STAT_COLUMNS.map((c) => c.key).sort());
		for (const { key } of STAT_COLUMNS) {
			expect(declared.get(varName(STAT_COLORS[key]) ?? ""), key).toMatch(/^#[0-9A-F]{6}$/);
		}
	});

	it("declares nothing TypeScript does not read, apart from the badge text", () => {
		const read = new Set([...Object.values(TYPE_COLORS), ...Object.values(STAT_COLORS)].map(varName));
		const unread = [...domainColours().keys()].filter((n) => !read.has(n));
		expect(unread.sort()).toEqual(["--pkdx-type-text", "--pkdx-type-text-shadow"]);
	});
});

describe("stylelint", () => {
	it("passes on the stylesheet source and every component", async () => {
		const result = await stylelint.lint({
			files: ["styles.src.css", "src/**/*.css", "src/**/*.svelte"],
			cwd: root,
		});
		expect(result.results.length).toBeGreaterThan(20);
		expect(result.results.flatMap((r) => r.warnings.map((w) => `${r.source}: ${w.text}`))).toEqual([]);
	});

	it("exempts colour literals only in the named domain file", async () => {
		const hex = ".x { color: #F08030; background: rgba(0, 0, 0, 0.25); border-color: white; }";
		expect(await lint(hex, join(root, "src/styles/pokemon-colours.css"))).toEqual([]);
		const elsewhere = await lint(hex, join(root, "src/styles/other.css"));
		for (const rule of ["color-no-hex", "color-named", "declaration-property-value-disallowed-list"]) {
			expect(elsewhere).toContain(rule);
		}
		const svelte = `<div></div>\n<style>\n\t.x { color: #F08030; }\n</style>\n`;
		expect(await lint(svelte, join(root, "src/view/components/X.svelte"))).toEqual(["color-no-hex"]);
	});

	it("still bans the retired prefix in the domain file", async () => {
		const retired = ".x { --pkx-fh: var(--font-interface); }";
		expect(await lint(retired, join(root, "src/styles/pokemon-colours.css"))).toEqual(["custom-property-pattern"]);
	});
});

describe("filter chips", () => {
	// The filter groups' content (snippets drawn into the rail or the Narrow
	// pane's inline panel): every chip there except the Type badges (domain
	// colours, drawn by TypeBadge) is the shared toggle chip, its state in
	// aria-pressed.
	const groupContent = filterBarSource.slice(
		filterBarSource.indexOf("{#snippet typeContent()}"),
		filterBarSource.indexOf('<div class="filter-bar"'),
	);
	const buttons = [...groupContent.matchAll(/<button\b([^>]*)>/g)].map(([, attrs]) => attrs);

	it("are the chip pattern's toggle chip, pressed while their filter is on", () => {
		const chips = buttons.filter((a) => !a.includes('class="type-chip"'));
		expect(chips.length).toBe(6);
		for (const attrs of chips) {
			expect(attrs).toMatch(/class="lk-chip lk-chip--toggle filter-chip[ "]/);
			expect(attrs).toMatch(/aria-pressed=\{filters\.\w+\.includes\(/);
			expect(attrs).toContain('type="button"');
		}
		expect(groupContent).not.toContain("class:active");
	});

	it("give the type badges their pressed state too", () => {
		const types = buttons.filter((a) => a.includes('class="type-chip"'));
		expect(types).toHaveLength(1);
		expect(types[0]).toMatch(/aria-pressed=\{filters\.types\.includes\(type\)\}/);
	});
});
