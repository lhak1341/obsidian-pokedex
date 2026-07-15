export type GenerationToggleResult = { allowed: true; enabled: number[] } | { allowed: false };

// The settings tab's "at least one generation must stay enabled" rule — a
// species search needs SOME generation to fetch against, so disabling the
// last one is rejected rather than left to silently produce an empty dex.
// Pure decision only; the caller (PokedexSettingTab) owns reverting the
// toggle control and showing a Notice when allowed is false.
export function resolveGenerationToggle(
	enabledGenerations: number[],
	genId: number,
	value: boolean,
): GenerationToggleResult {
	const enabled = new Set(enabledGenerations);
	if (value) {
		enabled.add(genId);
	} else if (enabled.size === 1) {
		return { allowed: false };
	} else {
		enabled.delete(genId);
	}
	return { allowed: true, enabled: [...enabled].sort((a, b) => a - b) };
}
