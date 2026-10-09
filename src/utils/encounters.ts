import type { PokedexTableRow } from "../data/types";
import { formatItemName } from "./pokemonDisplay";

// Wild-encounter / acquisition presentation for one Pokemon at the user's
// Active Gen. THE INTERFACE IS `describeEncounters` — table cell, table
// tooltip and the detail page's Capture lines all come from its one result,
// so the Active Gen scoping, the grouping, and the "does a line need its
// region header" rule are decided once. The other exports are its internal
// steps, exported only so encounters.test.ts can pin their formatting
// regressions (Mirage Tower, compass/bike slugs, trade atoms) directly;
// production callers import describeEncounters and the types alone.
// `PokedexTableRow["encounterLocationsAllGens"]` is deliberately named for
// what it is: every generation's locations, unscoped.

export interface ActiveEncounterLocation {
	name: string;
	region: string | null;
	method: "trade" | "gift" | "egg" | null;
	tradeFor: string | null;
}

// Scopes a Pokemon's wild-encounter locations down to just the ones from the
// user's Active Gen — the reactive counterpart to encounterLocationsAllGens staying
// Active-Gen-agnostic at normalize time (same split as heldItemGen.ts's
// filterHeldItemsForGen). Returns deduped, sorted entries (a location's own
// region/method/tradeFor never vary by generation, so dedup-by-name alone is
// safe); empty when the Pokemon isn't found in the wild in that generation
// at all (evolve-only, legendary, or simply absent from ENCOUNTER_LOCATIONS
// — see its comment).
export function filterEncounterLocationsForGen(
	encounterLocationsAllGens: PokedexTableRow["encounterLocationsAllGens"],
	activeGen: number,
): ActiveEncounterLocation[] {
	const byName = new Map<string, ActiveEncounterLocation>();
	for (const loc of encounterLocationsAllGens) {
		if (loc.generationId === activeGen) {
			byName.set(loc.name, { name: loc.name, region: loc.region, method: loc.method, tradeFor: loc.tradeFor });
		}
	}
	return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Small connector words ("Cave of Origin", "Lake of Rage", "Ruins of Alph",
// "Turnback Cave Between Pillars 1 and 2") stay lowercase mid-name under
// normal English title-case convention, unlike every other word — but only
// when they're not the name's own first word (never actually happens in a
// real location slug, but a generic word-formatter shouldn't assume it).
const LOWERCASE_MID_WORDS = new Set(["of", "the", "a", "an", "and", "in", "on", "at", "to", "for"]);

// Formats one hyphen-segment word from a location-area slug at position
// `index` in the whole name. Most words just want their first letter
// capitalized, same as formatItemName — but two PokeAPI slug conventions
// read wrong under that generic rule: a floor code ("1f", "b2f") and a
// compass abbreviation ("se", "sw", "ne", "nw") are both meant to be fully
// capitalized in English ("1F", "SE"), not merely their first letter ("1f",
// "Se") — and a small connector word (see LOWERCASE_MID_WORDS) stays
// lowercase instead of capitalized at all, unless it's the first word.
function capitalizeLocationWord(word: string, index: number): string {
	if (/^(b?\d+f|ne|nw|se|sw)$/i.test(word)) return word.toUpperCase();
	if (index > 0 && LOWERCASE_MID_WORDS.has(word.toLowerCase())) return word.toLowerCase();
	return word[0].toUpperCase() + word.slice(1);
}

// Hoenn's Safari Zone has two sub-areas reachable only on a specific bike,
// and PokeAPI's own slug fuses the compass direction straight onto the bike
// name with no hyphen between them at all ("...-neacro-bike-area",
// "...-nwmach-bike-area") — unlike every other word boundary in a location
// slug, there's no "-" here for a plain split("-") to find, so it comes out
// of that split as one unsplittable word ("neacro") that capitalizeLocationWord
// can't recognize as a compass abbreviation at all, misreading as "Neacro".
// Expands that one fused word (plus the "bike" word right after it) into
// "NE", "(Acro Bike)" before the general per-word capitalization runs, so
// the whole thing reads as "Safari Zone NE (Acro Bike)".
function expandFusedCompassBikeWord(words: string[]): string[] {
	const out: string[] = [];
	for (let i = 0; i < words.length; i++) {
		const match = /^(ne|nw|se|sw)(acro|mach)$/i.exec(words[i]);
		if (match && words[i + 1]?.toLowerCase() === "bike") {
			out.push(match[1].toUpperCase(), `(${match[2][0].toUpperCase()}${match[2].slice(1)} Bike)`);
			i++; // also consumes the "bike" word this fused word was missing a hyphen before
		} else {
			out.push(words[i]);
		}
	}
	return out;
}

function formatLocationWords(text: string): string {
	return expandFusedCompassBikeWord(text.split("-")).map(capitalizeLocationWord).join(" ");
}

// PokeAPI location-area names carry a redundant "-area" suffix ("route-1-
// area", "trophy-garden-area") that adds noise without adding information —
// stripped before the same hyphenated-capitalize treatment as
// formatItemName, plus capitalizeLocationWord's floor/compass fixups above
// (formatItemName itself stays generic — it's also used for item/ability
// names, which never carry either convention).
export function formatLocationName(name: string): string {
	return formatLocationWords(name.replace(/-area$/, ""));
}

// A specific location name ("Kanto Route 2 South Towards Viridian City")
// is too long/noisy for a table cell either way — the full grouped list
// already lives in the tooltip (see groupEncounterLocations,
// formatEncounterLocationsPlain). The cell itself just needs "how do you
// even get this": a wild encounter, or one of the three NPC hand-off
// methods. Multiple distinct methods for one Pokemon in one generation is
// rare but real (e.g. a species with both a wild spawn and a separate gift
// somewhere), so this can return more than one label; ACQUISITION_LABEL_ORDER
// fixes their display order rather than leaving it to whatever order the
// locations happened to arrive in.
const ACQUISITION_LABEL_ORDER: { method: "trade" | "gift" | "egg" | null; label: string }[] = [
	{ method: null, label: "Wild" },
	{ method: "trade", label: "Trade" },
	{ method: "gift", label: "Gift" },
	{ method: "egg", label: "Egg" },
];

export function summarizeAcquisitionMethods(locations: { method: "trade" | "gift" | "egg" | null }[]): string {
	const present = new Set(locations.map((l) => l.method));
	return ACQUISITION_LABEL_ORDER.filter((m) => present.has(m.method)).map((m) => m.label).join(", ");
}

// Same per-word treatment as formatLocationName, for a name that's already
// had its "-area" suffix AND region prefix stripped (groupEncounterLocations'
// own `rest` values) — pulled out so both call sites share one fixup list
// instead of drifting.
function formatLocationRest(rest: string): string {
	return formatLocationWords(rest);
}

// Display order for EncounterLocationGroups below — Kanto before Hoenn the
// same way a generation dropdown would, not alphabetically (which would put
// Hoenn first). Matches GENERATIONS' own region order.
const REGION_ORDER = ["kanto", "johto", "hoenn", "sinnoh", "unova", "kalos", "alola", "galar", "hisui", "paldea"];

// A location-area's own raw name is prefixed with its region ("kanto-
// route-10-area") only when PokeAPI actually needed to disambiguate it from
// a same-named area in another region sharing the generation — an
// unambiguous Hoenn name like "mirage-tower-area" carries no prefix despite
// belonging to Hoenn just as much as "hoenn-route-111-area" does (see
// ActiveEncounterLocation.region, which comes from a real PokeAPI field, not
// a guess). This still strips a literal "{region}-" text prefix when
// present, purely so the region header isn't redundantly repeated in the
// text under it ("Kanto: Route 10", not "Kanto: Kanto Route 10").
function stripRegionPrefix(rawName: string, region: string | null): string {
	const base = rawName.replace(/-area$/, "");
	if (region && (base === region || base.startsWith(`${region}-`))) {
		return base.slice(region.length).replace(/^-/, "");
	}
	return base;
}

function allNumeric(values: string[]): boolean {
	return values.every((v) => /^\d+$/.test(v));
}

// Collapses wild-location names sharing every word but the last ("Route 4",
// "Route 8", "Route 9") down to one shared prefix ("Route 4, 8, 9") — cuts
// real repetition for a species with a long numbered-route or numbered-floor
// spread (Zubat's Gen 3 list repeats "Cave Of Origin"/"Victory Road 2"
// across a dozen floors). Grouped by prefix regardless of adjacency (a
// differently-prefixed name can sit between two same-prefix ones in
// PokeAPI's own ordering), but a name with no shared multi-word prefix (a
// single word, or one with no sibling) never merges with an unrelated
// neighbor just because both happen to have an empty prefix — each such name
// gets its own group, keyed by its full text. A purely-numeric suffix run
// (route/floor numbers) sorts numerically ("4, 8, 9, 10, 11, 23", not the
// lexicographic "10, 11, 23, 4, 8, 9"); anything else (e.g. "1f"/"B1f"/
// "Entrance") keeps arrival order, which is already alphabetical from
// filterEncounterLocationsForGen. Distinct groups join with "; " (not ", ")
// so the group boundary reads as a boundary once commas are already doing
// double duty joining numbers within a group. Only ever called with wild
// (mergeable) location text — a trade/gift/egg spot's fully-formatted "Trade
// Poliwhirl @ Cerulean City" (see formatAcquisitionAtom) is kept as its own
// separate line by groupEncounterLocations below instead, specifically so it
// never runs through this last-word split at all: slicing it at its own
// last word ("City") and treating "Trade Poliwhirl @ Cerulean" as a
// mergeable prefix would silently corrupt it if another entry ever shared
// that "prefix".
function joinWildNames(names: string[]): string {
	const order: string[] = [];
	const suffixesByKey = new Map<string, string[]>();
	const isGroupByKey = new Map<string, boolean>();
	for (const name of names) {
		const words = name.split(" ");
		const prefix = words.slice(0, -1).join(" ");
		const suffix = words[words.length - 1];
		const isGroup = prefix !== "";
		const key = isGroup ? prefix : name;
		if (!suffixesByKey.has(key)) {
			suffixesByKey.set(key, []);
			isGroupByKey.set(key, isGroup);
			order.push(key);
		}
		suffixesByKey.get(key)!.push(isGroup ? suffix : name);
	}
	return order
		.map((key) => {
			const values = suffixesByKey.get(key)!;
			if (!isGroupByKey.get(key)) return values[0];
			const sorted = allNumeric(values) ? [...values].sort((a, b) => Number(a) - Number(b)) : values;
			return `${key} ${sorted.join(", ")}`;
		})
		.join("; ");
}

// A non-wild location (ActiveEncounterLocation.method set — see its own
// comment) isn't somewhere this Pokemon is actually found by chance; it's an
// NPC hand-off. Showing the bare place name there ("Cerulean City") reads as
// a wild-encounter spot and drops the one fact that actually matters —
// verified live as the exact bug for Jynx (Gen 1/3: trade a Poliwhirl in
// Cerulean City).
function formatAcquisitionAtom(method: "trade" | "gift" | "egg", tradeFor: string | null, place: string): string {
	if (method === "trade") return `Trade ${formatItemName(tradeFor ?? "")} @ ${place}`;
	if (method === "egg") return `Egg @ ${place}`;
	return `Gift @ ${place}`;
}

export interface EncounterLocationGroup {
	// null when this Pokemon's wild encounters never needed a region prefix
	// at all (the common case — most generations' games share one region).
	region: string | null;
	text: string;
}

// Splits a Pokemon's active-gen wild-encounter locations (as returned by
// filterEncounterLocationsForGen, each already carrying its own real region
// and acquisition method) into display lines, one per region PLUS one extra
// per non-wild spot in that region — a species with both a wild spawn and a
// trade/gift/egg source (or several of the latter) gets one line each rather
// than everything mashed into a single semicolon-joined sentence, so callers
// can render each as its own bullet point. A region with only wild
// locations still gets just one (already-compressed, see joinWildNames)
// line. Two lines can legitimately share one `region` value (a wild line and
// a trade line for the same single-region Pokemon) — callers deciding
// whether to show a region header should count DISTINCT regions among the
// results, not just how many lines there are.
export function groupEncounterLocations(
	locations: { name: string; region: string | null; method: "trade" | "gift" | "egg" | null; tradeFor: string | null }[],
): EncounterLocationGroup[] {
	const order: (string | null)[] = [];
	const wildNamesByRegion = new Map<string | null, string[]>();
	const acquisitionLinesByRegion = new Map<string | null, string[]>();
	for (const loc of locations) {
		if (!wildNamesByRegion.has(loc.region)) {
			wildNamesByRegion.set(loc.region, []);
			acquisitionLinesByRegion.set(loc.region, []);
			order.push(loc.region);
		}
		const place = formatLocationRest(stripRegionPrefix(loc.name, loc.region));
		if (loc.method) {
			acquisitionLinesByRegion.get(loc.region)!.push(formatAcquisitionAtom(loc.method, loc.tradeFor, place));
		} else {
			wildNamesByRegion.get(loc.region)!.push(place);
		}
	}
	const sortedRegions = [...order].sort((a, b) => {
		const ai = a ? REGION_ORDER.indexOf(a) : Number.MAX_SAFE_INTEGER;
		const bi = b ? REGION_ORDER.indexOf(b) : Number.MAX_SAFE_INTEGER;
		return ai - bi;
	});
	const groups: EncounterLocationGroup[] = [];
	for (const region of sortedRegions) {
		const regionLabel = region ? formatItemName(region) : null;
		const wildNames = wildNamesByRegion.get(region)!;
		if (wildNames.length > 0) groups.push({ region: regionLabel, text: joinWildNames(wildNames) });
		for (const line of acquisitionLinesByRegion.get(region)!) groups.push({ region: regionLabel, text: line });
	}
	return groups;
}

// One rule for "does a line need its own region header": more than one
// DISTINCT region among the groups, not merely more than one group (a
// single-region Pokemon with both a wild line and a trade line has two
// groups and one region). Shared by the plain-text tooltip below and
// DetailScreen's bolded rendering, via describeEncounters.
function shouldShowRegion(groups: EncounterLocationGroup[]): boolean {
	return new Set(groups.map((g) => g.region)).size > 1;
}

// Plain-text rendering of groupEncounterLocations, for a native `title`
// tooltip (no bold/markup available there, unlike DetailScreen's own
// rendering of the same groups) — one line per group, newline-separated once
// there's more than one. Each line only gets its own "Region: " prefix when
// there's more than one DISTINCT region among the groups, not just more than
// one group — a single-region Pokemon with both a wild line and a trade line
// (two groups, one region) shouldn't repeat that one region's name on every
// line (matching DetailScreen's own "skip the header when there's nothing to
// disambiguate" rule).
export function formatEncounterLocationsPlain(groups: EncounterLocationGroup[]): string {
	if (groups.length <= 1) return groups[0]?.text ?? "";
	const showRegion = shouldShowRegion(groups);
	return groups.map((g) => (showRegion && g.region ? `${g.region}: ${g.text}` : g.text)).join("\n");
}

export interface EncounterView {
	// True when nothing at all is available in the Active Gen (callers show
	// their own placeholder or hide the section).
	isEmpty: boolean;
	// Short "how do you get it" cell text: "Wild, Trade". "" when empty.
	summary: string;
	// Plain-text tooltip, one line per group. "" when empty.
	tooltip: string;
	// Detail-page lines, region kept separate so the caller can bold it.
	groups: EncounterLocationGroup[];
	// Whether each line should carry its region header (see shouldShowRegion).
	showRegion: boolean;
}

export function describeEncounters(
	locations: PokedexTableRow["encounterLocationsAllGens"],
	activeGen: number,
): EncounterView {
	const active = filterEncounterLocationsForGen(locations, activeGen);
	const groups = groupEncounterLocations(active);
	return {
		isEmpty: active.length === 0,
		summary: summarizeAcquisitionMethods(active),
		tooltip: formatEncounterLocationsPlain(groups),
		groups,
		showRegion: shouldShowRegion(groups),
	};
}
