// The font-roles subpath, never `@lhak/style/obsidian-helpers`: that index loads
// `obsidian`, which has no runtime module under vitest.
import { parseFontRoleSettings } from "@lhak/style/obsidian-helpers/font-roles";
import { GENERATIONS } from "../data/constants";
import type { PluginSettings } from "../data/types";
import type { BrowseLayout, WidthClass } from "./browseLayout";
import type { CardSize } from "./cardView";
import { TILE_FIELD_KEYS } from "./fields";

// One Record per closed set, so a new union member without a row fails
// typecheck here instead of being rejected as "unknown" at load.
const SPRITE_STYLES: Record<PluginSettings["spriteStyle"], true> = { "official-artwork": true, home: true, sprite: true };
const GRID_DENSITIES: Record<PluginSettings["gridDensity"], true> = { compact: true, comfortable: true };
const SORT_COLUMNS: Record<PluginSettings["defaultSortColumn"], true> = { id: true, name: true };
const BROWSE_LAYOUTS: Record<BrowseLayout, true> = { table: true, card: true };
const CARD_SIZES: Record<CardSize, true> = { small: true, medium: true, large: true };

function oneOf<T extends string>(value: unknown, allowed: readonly T[] | Record<T, true>, fallback: T): T {
	const list = Array.isArray(allowed) ? (allowed as readonly T[]) : (Object.keys(allowed) as T[]);
	return typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : fallback;
}

// Each width class is repaired on its own, so one bad entry does not reset the
// other class's choice. Layouts and Card sizes alike.
function byWidthClass<T extends string>(
	value: unknown,
	allowed: Record<T, true>,
	fallback: Record<WidthClass, T>,
): Record<WidthClass, T> {
	const v = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
	return {
		narrow: oneOf(v.narrow, allowed, fallback.narrow),
		wide: oneOf(v.wide, allowed, fallback.wide),
	};
}

function numberArray(value: unknown, fallback: number[]): number[] {
	return Array.isArray(value) ? value.filter((v): v is number => typeof v === "number") : [...fallback];
}

function stringArray(value: unknown): string[] | undefined {
	return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : undefined;
}

// Turns whatever data.json held into a valid PluginSettings. data.json is a
// tracked, synced file and can be hand-edited, so loadSettings cannot assume
// its shape: a shallow merge let an empty or all-unknown enabledGenerations
// reach resolveGenerationScope (Math.min() of nothing = Infinity, so the table
// silently loaded zero ids).
//
// Builds the result from the known fields only (unknown keys are dropped on the
// next save), and gives it its own arrays so nothing aliases `defaults`.
// Corrections are in-memory; the next saveSettings persists them. Contents of
// visibleFields / favoritePokemonIds are not checked, only that they are
// arrays: stale entries there are harmless (ADR-0007).
//
// visibleFields was `visibleColumns` before #22. The old key is read only when
// the new one is absent (not an array), and since unknown keys are dropped the
// next save writes only the new one: a one-way migration. A saved selection,
// even an empty one, is kept as it is; only a fresh install gets the default.
//
// The settings UI's resolveGenerationToggle enforces the same "at least one
// generation" invariant against a user action; this repairs stored data.
//
// cardFields arrived with ADR-0020, when Card view stopped sharing the table's
// selection. Before it, the tile drew the Tile Fields of visibleFields, so a
// data.json without cardFields but with a saved selection seeds it from that
// selection's Tile Fields: the upgrading user's tiles look as they did.
//
// The six font keys go through the shared @lhak/style font-role helper, which
// reads anything unknown as "default" (so not from `defaults`). That carries
// over PKDX's old "pokedex" choice, which meant the same: follow the theme.
export function hydrateSettings(saved: unknown, defaults: PluginSettings): PluginSettings {
	const s = (typeof saved === "object" && saved !== null ? saved : {}) as Record<string, unknown>;
	const knownGenerationIds: number[] = GENERATIONS.map((g) => g.id);
	const generations = [...new Set(numberArray(s.enabledGenerations, []).filter((id) => knownGenerationIds.includes(id)))]
		.sort((a, b) => a - b);
	const savedVisibleFields = stringArray(s.visibleFields) ?? stringArray(s.visibleColumns);

	return {
		...parseFontRoleSettings(s),
		enabledGenerations: generations.length > 0 ? generations : [...defaults.enabledGenerations],
		spriteStyle: oneOf(s.spriteStyle, SPRITE_STYLES, defaults.spriteStyle),
		gridDensity: oneOf(s.gridDensity, GRID_DENSITIES, defaults.gridDensity),
		defaultSortColumn: oneOf(s.defaultSortColumn, SORT_COLUMNS, defaults.defaultSortColumn),
		visibleFields: savedVisibleFields ?? [...defaults.visibleFields],
		cardFields:
			stringArray(s.cardFields) ??
			savedVisibleFields?.filter((key) => (TILE_FIELD_KEYS as readonly string[]).includes(key)) ??
			[...defaults.cardFields],
		useTypeIcons: typeof s.useTypeIcons === "boolean" ? s.useTypeIcons : defaults.useTypeIcons,
		activeGen:
			typeof s.activeGen === "number" && knownGenerationIds.includes(s.activeGen) ? s.activeGen : defaults.activeGen,
		favoritePokemonIds: numberArray(s.favoritePokemonIds, defaults.favoritePokemonIds),
		reduceMotion: typeof s.reduceMotion === "boolean" ? s.reduceMotion : defaults.reduceMotion,
		layoutByWidthClass: byWidthClass(s.layoutByWidthClass, BROWSE_LAYOUTS, defaults.layoutByWidthClass),
		cardSizeByWidthClass: byWidthClass(s.cardSizeByWidthClass, CARD_SIZES, defaults.cardSizeByWidthClass),
	};
}
