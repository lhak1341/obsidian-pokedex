import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import svelte from "eslint-plugin-svelte";

// obsidianmd's TypeScript blocks, re-aimed at the components. Its recommended
// config matches only script files (`**/*.{ts,cts,mts,tsx}`), and a flat
// config lints nothing no block's `files` matches, so before these blocks
// eslint silently skipped every .svelte file. Their parser is left to
// svelte.configs.base below, which reads `<script lang="ts">` through tsparser.
// A block counts when one of its globs names `ts` in a brace list: the
// eslint-comments block's `**/*.{ts,cts,mts,tsx,js,…}` is one, and matching
// the TypeScript glob's exact text missed it, which left every inline
// `eslint-disable` in a component unchecked.
const namesTs = (files) => JSON.stringify(files ?? null).match(/\{[^}]*\bts\b[^}]*\}/) !== null;
const obsidianTsBlocksForSvelte = obsidianmd.configs.recommended
	.filter((block) => namesTs(block.files))
	.map(({ languageOptions: _parser, files: _ts, ...block }) => ({ ...block, files: ["src/**/*.svelte"] }));

// The globals obsidianmd restricts (fetch, app, localStorage). A block that
// sets no-restricted-globals replaces the list, so the own-window block
// below re-states it before adding its own.
const obsidianRestrictedGlobals = obsidianmd.configs.recommended
	.flatMap((block) => (block.rules?.["no-restricted-globals"] ? [block.rules["no-restricted-globals"].slice(1)] : []))
	.at(-1) ?? [];

// Leaf hotkeys (CONTEXT.md): one keydown listener per leaf, PokedexView's,
// gated on the active leaf. Every open Pokédex leaf mounts its own app, so a
// window or document listener in a component fires once per leaf, background
// tabs included (DetailScreen's arrows stepped every leaf, probed live).
const LEAF_HOTKEY = "Leaf hotkeys go through PokedexView's one gated keydown listener (src/view/CLAUDE.md).";
const OWN_WINDOW = "Read the viewport and frames from the element's own window (windowOf, view/domPosition.ts): a pop-out leaf's window is not the global one.";
const OWN_WINDOW_NAMES = ["innerHeight", "innerWidth", "requestAnimationFrame", "cancelAnimationFrame"];

export default defineConfig([
	...obsidianmd.configs.recommended,
	// obsidianmd.configs.recommended applies type-checked rules (both
	// tseslint's own and obsidianmd's custom ones, e.g.
	// no-plugin-as-component) to every *.ts file, test files included —
	// tsconfig.json's "include" already covers *.test.ts, so every file gets
	// parserOptions.project here rather than excluding tests from it. Without
	// this, any type-aware rule crashes hard ("You have used a rule which
	// requires type information...") the instant something lints a test file
	// without a matching --ignore-pattern (this repo's own scripts have one,
	// but nothing stops another caller from omitting it).
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: "./tsconfig.json" },
		},
	},
	{
		// Obsidian-specific UI/runtime rules don't apply to test code, so
		// this override is scoped away from it — unrelated to the
		// parserOptions concern above, which does need to cover tests.
		files: ["src/**/*.ts"],
		ignores: ["src/**/*.test.ts"],
		rules: {
			"obsidianmd/ui/sentence-case": ["warn", {
				brands: ["PokeAPI", "Pokemon"],
			}],
		},
	},
	// Obsidian runtime/UI rules that describe how the *plugin* must behave
	// inside the app, switched off for test code the same way
	// ui/sentence-case is above. hardcoded-config-path fires on
	// legacyDiskCache.test.ts, which passes ".obsidian" as the configDir
	// under test and asserts the paths built from it; prefer-window-timers
	// fires on tests that run under vitest's node environment, where there
	// is no `window` at all (see the comment on `timers` in utils/retry.ts).
	// no-nodejs-modules arms itself once manifest.json says
	// isDesktopOnly: false, and fires on the tests that import Node
	// built-ins (styles.test.ts, paneBreakpoint.test.ts); vitest runs those
	// under Node, never on a phone. Runtime code keeps the rule.
	{
		files: ["src/**/*.test.ts"],
		rules: {
			"obsidianmd/hardcoded-config-path": "off",
			"obsidianmd/prefer-window-timers": "off",
			"obsidianmd/no-nodejs-modules": "off",
		},
	},
	{
		// Typed linting for the components: `<script lang="ts">` is parsed by
		// tsparser against tsconfig.json, whose include lists src/**/*.svelte.
		// svelte.configs.recommended hands the rune modules (.svelte.ts) to the
		// Svelte parser too, which needs tsparser named to read their types.
		files: ["src/**/*.svelte", "src/**/*.svelte.ts"],
		languageOptions: {
			parserOptions: { parser: tsparser, project: "./tsconfig.json", extraFileExtensions: [".svelte"] },
		},
	},
	...obsidianTsBlocksForSvelte,
	...svelte.configs.recommended,
	{
		// A callback passed as a component prop (`onHover={(i) => …}`) reaches
		// the lint parser with its parameter typed `any`, though the prop
		// declares it (`onHover: (index: number) => void`): typescript-eslint
		// does not read component props across a .svelte import, and
		// svelte-check, which does, types it correctly. All 11 no-unsafe-*
		// findings on the first .svelte run (2026-11-28) were this. svelte-check
		// owns the types in .svelte; these rules stay on for .ts.
		files: ["src/**/*.svelte"],
		rules: {
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-return": "off",
		},
	},
	{
		// Pop-out leaves: the plugin's code runs in the main window, so the
		// bare globals measure and schedule against the wrong one there (probed
		// live: a pop-out over a minimised main window got 0 global frames in
		// 1.5 s). A property read off another object (`win.innerHeight`) passes.
		files: ["src/view/**/*.ts", "src/view/**/*.svelte"],
		ignores: ["src/**/*.test.ts"],
		rules: {
			"no-restricted-globals": [
				"error",
				...obsidianRestrictedGlobals,
				...OWN_WINDOW_NAMES.map((name) => ({ name, message: OWN_WINDOW })),
			],
			"no-restricted-properties": [
				"error",
				...["window", "activeWindow", "globalThis", "self"].flatMap((object) =>
					OWN_WINDOW_NAMES.map((property) => ({ object, property, message: OWN_WINDOW })),
				),
			],
		},
	},
	{
		// The one listener and the open Info popover's Escape (attached only
		// while a popover is open, and only dismisses it) are the exceptions.
		files: ["src/**/*.ts", "src/**/*.svelte"],
		ignores: ["src/**/*.test.ts", "src/view/PokedexView.ts", "src/view/infoPopover.svelte.ts"],
		rules: {
			"no-restricted-syntax": [
				"error",
				{ selector: "CallExpression[callee.property.name='addEventListener'][arguments.0.value='keydown']", message: LEAF_HOTKEY },
				{ selector: "CallExpression[callee.name='addEventListener'][arguments.0.value='keydown']", message: LEAF_HOTKEY },
				{ selector: "CallExpression[callee.property.name='registerDomEvent'][arguments.1.value='keydown']", message: LEAF_HOTKEY },
				{ selector: "AssignmentExpression[left.property.name='onkeydown']", message: LEAF_HOTKEY },
				{
					selector: "SvelteElement[kind='special'][name.name=/^svelte:(window|document|body)$/] SvelteAttribute[key.name='onkeydown']",
					message: LEAF_HOTKEY,
				},
			],
		},
	},
	{
		// A row's generation is its precomputed generationId: resolveGenerationId
		// reads the dex number, wrong for every regional form (Alolan Rattata:
		// dexNumber 19, generationId 7), and DetailScreen.svelte once showed the
		// wrong numeral that way. Only the data layer derives it.
		files: ["src/view/**/*.ts", "src/view/**/*.svelte", "src/utils/**/*.ts"],
		ignores: ["src/**/*.test.ts"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: ["**/data/constants"],
							importNames: ["resolveGenerationId"],
							message: "Draw a row's generationId (romanNumeral); resolveGenerationId is wrong for regional forms.",
						},
					],
				},
			],
		},
	},
	{
		// No inline escape hatch for any rule: obsidianmd restricts disabling
		// only its own list (obsidianmd/*, no-console, …), so a described
		// `eslint-disable-next-line` switched off no-floating-promises and each
		// guard above while the ratchet stayed at 0 (probed 2026-11-28).
		files: ["src/**/*.ts", "src/**/*.svelte", "scripts/*.ts"],
		rules: { "eslint-comments/no-restricted-disable": ["error", "*"] },
	},
	{
		// Build-time generators and release checks, run by bun on a dev machine:
		// typed linting applies, the plugin-runtime rules do not (console
		// output, Node built-ins and fetch are what these scripts are for), and
		// TypeScript already resolves their globals.
		files: ["scripts/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: "./tsconfig.json" },
		},
		rules: {
			"obsidianmd/rule-custom-message": "off",
			"obsidianmd/no-nodejs-modules": "off",
			"no-restricted-globals": "off",
			"no-undef": "off",
		},
	},
]);
