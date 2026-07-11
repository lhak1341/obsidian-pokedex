import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		// The real "obsidian" package is types-only (no runtime module) — see
		// src/data/__fixtures__/obsidian-stub.ts for why this alias exists.
		alias: {
			obsidian: new URL("./src/data/__fixtures__/obsidian-stub.ts", import.meta.url).pathname,
		},
	},
	test: {
		include: ["src/**/*.test.ts"],
	},
});
