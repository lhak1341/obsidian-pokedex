import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

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
]);
