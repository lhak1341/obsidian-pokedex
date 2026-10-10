import { FOSSIL_IDS } from "../data/constants";
import type { PokedexTableRow } from "../data/types";
import { filterHeldItemsForGen } from "./heldItemGen";

// One entry per Quirk/Trait filter option: what FilterBar renders (key, label,
// icon) and what filterPokemon evaluates (matches) live together, so a key
// can't exist in one place without the other. Quirks and Traits differ only in
// how a selection COMBINES (OR vs AND, decided in filterPokemon), not in what
// one entry is — so both lists share this shape. `ctx` carries what a row
// can't answer alone (Active Gen); entries that don't need it ignore it.
export interface FlagContext {
	activeGen: number;
}

export interface FlagDef {
	key: string;
	label: string;
	icon: string;
	matches(row: PokedexTableRow, ctx: FlagContext): boolean;
}

// A personal shortlist of specific traits that can genuinely overlap on one
// Pokemon (not a formal in-game category) — mixes an ability check
// (compound-eyes/pickup), a level-up-learnset check (thief/trick/covet), and a
// held-item check, OR'd together in matchesQuirks (e.g. "pickup OR holds an
// item" is a meaningful combined search, unlike Traits' independent flags
// below). Fossil and the evolution-stage buckets live in TRAITS instead;
// held-item stays here rather than moving alongside fossil, since "pickup OR
// holds an item" is a meaningful combined search the way "baby AND fossil"
// isn't.
export const QUIRKS: readonly FlagDef[] = [
	// Scoped to activeGen — same reasoning as the table cell/tooltip (see
	// heldItemGen.ts): a species whose only held item is from an out-of-scope
	// generation shouldn't surface under this quirk any more than it shows an
	// item in the row itself. activeGen is required (no "any generation"
	// fallback): a caller that forgot it used to get the unscoped union
	// silently.
	{
		key: "held-item",
		label: "Held Item",
		icon: "gift",
		matches: (row, ctx) => filterHeldItemsForGen(row.heldItemsAllGens, ctx.activeGen).length > 0,
	},
	{ key: "compound-eyes", label: "Compound Eyes", icon: "eye", matches: (row) => row.abilityNames.includes("compound-eyes") },
	{ key: "pickup", label: "Pickup", icon: "boxes", matches: (row) => row.abilityNames.includes("pickup") },
	{ key: "thief", label: "Thief", icon: "package", matches: (row) => row.levelUpMoveNames.includes("thief") },
	{ key: "trick", label: "Trick", icon: "package", matches: (row) => row.levelUpMoveNames.includes("trick") },
	{ key: "covet", label: "Covet", icon: "package", matches: (row) => row.levelUpMoveNames.includes("covet") },
];

// Independent yes/no properties of a Pokemon itself — unlike QUIRKS' OR
// semantics (show me any of these), TRAITS uses AND semantics (same idiom as
// the Type filter): selecting Baby + Fossil finds only a Pokemon that is
// BOTH, since there's no meaningful "either/or" reading of these flags. Each
// checks a curated id list (fossil, FOSSIL_IDS) or a derived-at-load-time
// boolean (baby/mega/gigantamax/last-stage).
export const TRAITS: readonly FlagDef[] = [
	{ key: "baby", label: "Baby", icon: "baby", matches: (row) => row.isBaby },
	{ key: "fossil", label: "Fossil", icon: "bone", matches: (row) => FOSSIL_IDS.has(row.dexNumber) },
	{ key: "mega", label: "Can Mega Evolve", icon: "wand-2", matches: (row) => row.canMegaEvolve },
	{ key: "gigantamax", label: "Can Gigantamax", icon: "expand", matches: (row) => row.canGigantamax },
	// Bucketed off PokedexTableRow.evolutionStages (a whole-family value, see
	// its own comment). AND semantics still composes meaningfully with the
	// OTHER traits here (e.g. Baby + No Evolution), but selecting two of
	// these three buckets together always yields zero rows since they're
	// mutually exclusive per row — same as any other Traits combo that
	// happens not to overlap, not a special case.
	{ key: "no-evolution", label: "No Evolution", icon: "minus", matches: (row) => row.evolutionStages === 0 },
	{ key: "one-evolution", label: "1 Evolution", icon: "arrow-up", matches: (row) => row.evolutionStages === 1 },
	{ key: "two-plus-evolutions", label: "2+ Evolutions", icon: "chevrons-up", matches: (row) => row.evolutionStages >= 2 },
	// Independent of the three buckets above (per-species leaf-ness, not a
	// whole-family bucket — see IS_FINAL_EVOLUTION_STAGE) — meaningfully
	// combines with them via AND (e.g. "2+ Evolutions" + "Last Stage" finds
	// only the fully-evolved member of a multi-stage family, like Charizard
	// but not Charmander/Charmeleon), unlike the three buckets which are
	// mutually exclusive with each other. Includes every No Evolution
	// species too, since a species with no evolution at all is trivially its
	// own last stage.
	{ key: "last-stage", label: "Last Stage", icon: "flag", matches: (row) => row.isFinalStage },
];
