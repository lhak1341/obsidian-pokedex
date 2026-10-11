import { GENERATIONS } from "../data/constants";
import type { PluginSettings } from "../data/types";
import { FONT_CHOICES } from "./fonts";

// One Record per closed set, so a new union member without a row fails
// typecheck here instead of being rejected as "unknown" at load.
const SPRITE_STYLES: Record<PluginSettings["spriteStyle"], true> = { "official-artwork": true, sprite: true };
const GRID_DENSITIES: Record<PluginSettings["gridDensity"], true> = { compact: true, comfortable: true };
const SORT_COLUMNS: Record<PluginSettings["defaultSortColumn"], true> = { id: true, name: true };

function oneOf<T extends string>(value: unknown, allowed: readonly T[] | Record<T, true>, fallback: T): T {
	const list = Array.isArray(allowed) ? (allowed as readonly T[]) : (Object.keys(allowed) as T[]);
	return typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : fallback;
}

function str(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

function numberArray(value: unknown, fallback: number[]): number[] {
	return Array.isArray(value) ? value.filter((v): v is number => typeof v === "number") : [...fallback];
}

// Turns whatever data.json held into a valid PluginSettings. data.json is a
// tracked, synced file and can be hand-edited, so loadSettings cannot assume
// its shape: a shallow merge let an empty or all-unknown enabledGenerations
// reach resolveGenerationScope (Math.min() of nothing = Infinity, so the table
// silently loaded zero ids) and an unknown font choice throw in
// resolveFontVar at mount.
//
// Builds the result from the known fields only (unknown keys are dropped on the
// next save), and gives it its own arrays so nothing aliases `defaults`.
// Corrections are in-memory; the next saveSettings persists them. Contents of
// visibleColumns / favoritePokemonIds are not checked, only that they are
// arrays: stale entries there are harmless (ADR-0007).
//
// The settings UI's resolveGenerationToggle enforces the same "at least one
// generation" invariant against a user action; this repairs stored data.
export function hydrateSettings(saved: unknown, defaults: PluginSettings): PluginSettings {
	const s = (typeof saved === "object" && saved !== null ? saved : {}) as Record<string, unknown>;
	const knownGenerationIds: number[] = GENERATIONS.map((g) => g.id);
	const generations = [...new Set(numberArray(s.enabledGenerations, []).filter((id) => knownGenerationIds.includes(id)))]
		.sort((a, b) => a - b);

	return {
		fontHeading: oneOf(s.fontHeading, FONT_CHOICES, defaults.fontHeading),
		fontHeadingCustom: str(s.fontHeadingCustom, defaults.fontHeadingCustom),
		fontBody: oneOf(s.fontBody, FONT_CHOICES, defaults.fontBody),
		fontBodyCustom: str(s.fontBodyCustom, defaults.fontBodyCustom),
		fontMono: oneOf(s.fontMono, FONT_CHOICES, defaults.fontMono),
		fontMonoCustom: str(s.fontMonoCustom, defaults.fontMonoCustom),
		enabledGenerations: generations.length > 0 ? generations : [...defaults.enabledGenerations],
		spriteStyle: oneOf(s.spriteStyle, SPRITE_STYLES, defaults.spriteStyle),
		gridDensity: oneOf(s.gridDensity, GRID_DENSITIES, defaults.gridDensity),
		defaultSortColumn: oneOf(s.defaultSortColumn, SORT_COLUMNS, defaults.defaultSortColumn),
		visibleColumns: Array.isArray(s.visibleColumns)
			? s.visibleColumns.filter((v): v is string => typeof v === "string")
			: [...defaults.visibleColumns],
		useTypeIcons: typeof s.useTypeIcons === "boolean" ? s.useTypeIcons : defaults.useTypeIcons,
		activeGen:
			typeof s.activeGen === "number" && knownGenerationIds.includes(s.activeGen) ? s.activeGen : defaults.activeGen,
		favoritePokemonIds: numberArray(s.favoritePokemonIds, defaults.favoritePokemonIds),
	};
}
