import type { FontChoice } from "../data/types";

const FONT_VAR_RESOLVERS: Record<FontChoice, (custom: string) => string | null> = {
	pokedex: () => null,
	"obsidian-interface": () => "var(--font-interface)",
	"obsidian-text": () => "var(--font-text)",
	"obsidian-monospace": () => "var(--font-monospace)",
	custom: (custom) => custom || null,
};

// Runtime list of every FontChoice, derived from the exhaustive resolver
// Record above so it cannot drift from the union (see settingsHydrate.ts).
export const FONT_CHOICES = Object.keys(FONT_VAR_RESOLVERS) as FontChoice[];

export function resolveFontVar(choice: FontChoice, custom: string): string | null {
	return FONT_VAR_RESOLVERS[choice](custom);
}
