import { describe, expect, it } from "vitest";
import { resolveFontVar } from "./fonts";

describe("resolveFontVar", () => {
	it("resolves the default \"pokedex\" choice to null (theme-following, no override)", () => {
		expect(resolveFontVar("pokedex", "")).toBeNull();
	});

	it("resolves each obsidian-* choice to the matching raw var", () => {
		expect(resolveFontVar("obsidian-interface", "")).toBe("var(--font-interface)");
		expect(resolveFontVar("obsidian-text", "")).toBe("var(--font-text)");
		expect(resolveFontVar("obsidian-monospace", "")).toBe("var(--font-monospace)");
	});

	it("resolves \"custom\" to the trimmed custom string", () => {
		expect(resolveFontVar("custom", "Inter")).toBe("Inter");
	});

	it("resolves \"custom\" with an empty string to null", () => {
		expect(resolveFontVar("custom", "")).toBeNull();
	});
});
