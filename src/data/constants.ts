import evolutionStagesData from "./evolutionStages.json";
import type { StatBlock } from "./types";

export const POKEAPI_BASE = "https://pokeapi.co/api/v2";

// Movepool/learn-method version-group toggle tabs (MoveBrowser's per-game
// switcher), one set per generation this plugin supports — mirrors
// FLAVOR_TEXT_TABS_BY_GEN below. `key` matches a move entry's raw
// version_group.name exactly (see normalizeMoves). Which of these sets is
// actually shown at once is an "Active Gen" UI concern, not a data-layer one
// — this table just says what exists per generation.
export const MOVE_VERSION_TABS_BY_GEN: Record<number, readonly { key: string; label: string }[]> = {
	3: [
		{ key: "firered-leafgreen", label: "FRLG" },
		{ key: "emerald", label: "RSE" },
	],
	4: [
		{ key: "diamond-pearl", label: "D/P" },
		{ key: "platinum", label: "Platinum" },
		{ key: "heartgold-soulsilver", label: "HG/SS" },
	],
	5: [
		{ key: "black-white", label: "B/W" },
		{ key: "black-2-white-2", label: "B2/W2" },
	],
	6: [
		{ key: "x-y", label: "X/Y" },
		{ key: "omega-ruby-alpha-sapphire", label: "ORAS" },
	],
	7: [
		{ key: "sun-moon", label: "S/M" },
		{ key: "ultra-sun-ultra-moon", label: "USUM" },
		{ key: "lets-go-pikachu-lets-go-eevee", label: "LGPE" },
	],
	// Sword/Shield's DLC (Isle of Armor/Crown Tundra) are their own
	// version-groups on PokeAPI, but they're the same two games' movepools,
	// not a third title — scoped to the base "sword-shield" version-group
	// only, same as how BDSP (also generation-viii per PokeAPI, verified
	// live) is out of scope entirely, being a Gen 4 remake rather than Galar
	// dex data. "legends-arceus" IS included, unlike BDSP — Hisuian forms
	// (see REGIONAL_FORMS) are real browsable rows now, and legends-arceus is
	// the ONLY version group any Hisuian variety's own moves ever appear
	// under (verified live against growlithe-hisui: version groups present
	// are exactly ["scarlet-violet", "legends-arceus"], neither of which was
	// in this table before — without this entry every Hisuian row shows zero
	// moves, not just a suboptimal fallback). resolveTabsForGen only ever
	// surfaces a tab a species actually has moves for, so this stays inert
	// for the ~80 ordinary Galar natives with no Legends: Arceus appearance
	// and only lights up for the handful of species (Hisuian or not) that
	// were actually catchable there.
	8: [
		{ key: "sword-shield", label: "Sw/Sh" },
		{ key: "legends-arceus", label: "Legends: Arceus" },
	],
	// Scarlet/Violet's DLC (The Teal Mask/The Indigo Disk) are their own
	// version-groups on PokeAPI ("the-teal-mask"/"the-indigo-disk", both
	// generation-ix) and even their own flavor-text *versions*
	// ("the-teal-mask-scarlet" etc.) — but verified live (Dipplin,
	// Archaludon, Okidogi, Ogerpon) that every DLC species' own *moves* and
	// *flavor text* are recorded under plain "scarlet-violet"/"scarlet"/
	// "violet" regardless, same as any base-game species. Unlike Hisuian
	// forms (whose moves only ever appear under "legends-arceus"), no DLC
	// version group needs adding here — the DLC evolution-chain entries that
	// do cite "the-teal-mask"/"the-indigo-disk" (see RawEvolutionChainLink)
	// only date which game update introduced that evolution method, an
	// unrelated concern. Also verified live that PokeAPI hosts a "champions"
	// version-group tagged generation-ix with empty move_learn_methods/
	// regions — non-canon/test data, same "don't trust a plausible-looking
	// PokeAPI entry" lesson as MEGA_VARIETY_KEYS — deliberately excluded.
	9: [{ key: "scarlet-violet", label: "S/V" }],
};

// Every version group any tab above reads, across every supported
// generation — trimming/caching (trimMovesToVersionGroups) keeps exactly
// this set instead of the ~20+ games a move's version_group_details spans.
export const MOVE_VERSION_GROUPS: string[] = Object.values(MOVE_VERSION_TABS_BY_GEN).flatMap((tabs) =>
	tabs.map((t) => t.key),
);

// Which version group's flavor text backs the move-name hover tooltip (see
// normalizeMoveDetail) — tried in this priority order, first English match
// wins, since a move's *description* barely differs between games and
// doesn't need its own per-generation toggle. A move introduced in a later
// generation (e.g. a Gen 4 signature move) simply has no firered-leafgreen
// entry, so it falls through to the next group instead of coming up blank.
export const MOVE_DESCRIPTION_VERSION_GROUPS: string[] = MOVE_VERSION_GROUPS;

// Pokedex description ("flavor text") is one tab per game the detail view
// lets the user switch between, grouped per generation — Ruby and Sapphire
// (and similarly Diamond/Pearl) share a tab since their text is identical
// for nearly every species. Flavor text is keyed by individual game
// *version* on PokeAPI (e.g. "leafgreen"), not the version *group*
// MOVE_VERSION_TABS_BY_GEN above uses ("firered-leafgreen") — that string
// never matches a flavor_text_entries.version.name. `key` is what
// DetailScreen's toggle state and PokedexEntry.flavorTexts use; each tab's
// `versions` is the priority-ordered list of raw version names tried. Which
// generation's tab set is shown at once is an "Active Gen" UI concern, not a
// data-layer one — this table just says what exists per generation.
export const FLAVOR_TEXT_TABS_BY_GEN: Record<
	number,
	readonly { key: string; label: string; versions: readonly string[] }[]
> = {
	3: [
		{ key: "leafgreen", label: "Leaf Green", versions: ["leafgreen"] },
		{ key: "firered", label: "Fire Red", versions: ["firered"] },
		{ key: "emerald", label: "Emerald", versions: ["emerald"] },
		{ key: "ruby-sapphire", label: "Ruby / Sapphire", versions: ["ruby", "sapphire"] },
	],
	4: [
		{ key: "diamond-pearl", label: "Diamond / Pearl", versions: ["diamond", "pearl"] },
		{ key: "platinum", label: "Platinum", versions: ["platinum"] },
		{ key: "heartgold-soulsilver", label: "HeartGold / SoulSilver", versions: ["heartgold", "soulsilver"] },
	],
	5: [
		{ key: "black-white", label: "Black / White", versions: ["black", "white"] },
		{ key: "black-2-white-2", label: "Black 2 / White 2", versions: ["black-2", "white-2"] },
	],
	6: [
		{ key: "x-y", label: "X / Y", versions: ["x", "y"] },
		{
			key: "omega-ruby-alpha-sapphire",
			label: "Omega Ruby / Alpha Sapphire",
			versions: ["omega-ruby", "alpha-sapphire"],
		},
	],
	7: [
		{ key: "sun-moon", label: "Sun / Moon", versions: ["sun", "moon"] },
		{
			key: "ultra-sun-ultra-moon",
			label: "Ultra Sun / Ultra Moon",
			versions: ["ultra-sun", "ultra-moon"],
		},
		{
			key: "lets-go-pikachu-lets-go-eevee",
			label: "Let's Go Pikachu / Eevee",
			versions: ["lets-go-pikachu", "lets-go-eevee"],
		},
	],
	// Sword and Shield's flavor text genuinely differs per version (verified
	// live against Grookey #810) — unlike Ruby/Sapphire or Diamond/Pearl,
	// this isn't a "shared text, merge into one tab" pair.
	8: [
		{ key: "sword", label: "Sword", versions: ["sword"] },
		{ key: "shield", label: "Shield", versions: ["shield"] },
	],
	// Scarlet and Violet's flavor text genuinely differs per version (verified
	// live against Sprigatito #906), same pairing pattern as Sword/Shield —
	// two tabs, not one merged. DLC species (Dipplin, Archaludon, Ogerpon,
	// ...) still only ever carry "scarlet"/"violet" flavor-text entries, never
	// "the-teal-mask-scarlet" etc. (verified live) — see the matching note on
	// MOVE_VERSION_TABS_BY_GEN[9].
	9: [
		{ key: "scarlet", label: "Scarlet", versions: ["scarlet"] },
		{ key: "violet", label: "Violet", versions: ["violet"] },
	],
};

// Every raw version name any tab above reads, across every supported
// generation — trimming/caching keeps exactly this set instead of the ~20
// games flavor_text_entries spans.
export const FLAVOR_TEXT_VERSION_GROUPS: string[] = Object.values(FLAVOR_TEXT_TABS_BY_GEN).flatMap((tabs) =>
	tabs.flatMap((tab) => tab.versions),
);

export const TYPE_NAMES = [
	"normal", "fire", "water", "electric", "grass", "ice",
	"fighting", "poison", "ground", "flying", "psychic", "bug",
	"rock", "ghost", "dragon", "dark", "steel", "fairy",
] as const;

export const RARITIES = [
	{ key: "normal", label: "Normal" },
	{ key: "legendary", label: "Legendary" },
	{ key: "mythical", label: "Mythical" },
] as const;

// Fossil Pokemon (revived from a fossil item at a Pokemon Lab/Dig Site, not
// found or evolved any other way). PokeAPI has no explicit "is_fossil"
// species flag, so this is a curated list rather than a derived one — and
// since it's curated, it needs a manual re-check every time a new
// generation is added (see the "curated tables" reminder in
// docs/multi-gen-expansion-plan.md's Recipe section). Verified live
// (id -> species name) rather than from memory before adding each gen's
// entries: Gen 1 omanyte/omastar/kabuto/kabutops/aerodactyl (#138-142);
// Gen 3 lileep/cradily/anorith/armaldo (#345-348); Gen 4
// cranidos/rampardos/shieldon/bastiodon (#408-411); Gen 5
// tirtouga/carracosta/archen/archeops (#564-567); Gen 6
// tyrunt/tyrantrum/amaura/aurorus (#696-699); Gen 8
// dracozolt/arctozolt/dracovish/arctovish (#880-883, Sword/Shield's
// mix-and-match fossils). No Gen 2 or Gen 7 fossils exist.
export const FOSSIL_IDS = new Set([
	138, 139, 140, 141, 142,
	345, 346, 347, 348,
	408, 409, 410, 411,
	564, 565, 566, 567,
	696, 697, 698, 699,
	880, 881, 882, 883,
]);

export interface QuirkDef {
	key: string;
	label: string;
	icon: string;
}

// A personal shortlist of specific traits that can genuinely overlap on one
// Pokemon (not a formal in-game category) — mixes an ability check
// (compoundEyes/pickup), a level-up-learnset check (thief/trick/covet), and a
// held-item check, OR'd together in matchesQuirks (e.g. "pickup OR holds an
// item" is a meaningful combined search, unlike Traits' independent flags
// below). See matchesQuirk in filterPokemon.ts for how each key is evaluated.
export const QUIRKS: QuirkDef[] = [
	{ key: "held-item", label: "Held Item", icon: "gift" },
	{ key: "compound-eyes", label: "Compound Eyes", icon: "eye" },
	{ key: "pickup", label: "Pickup", icon: "boxes" },
	{ key: "thief", label: "Thief", icon: "package" },
	{ key: "trick", label: "Trick", icon: "package" },
	{ key: "covet", label: "Covet", icon: "package" },
];

// Independent yes/no properties of a Pokemon itself — unlike QUIRKS' OR
// semantics (show me any of these), TRAITS uses AND semantics (same idiom as
// the Type filter): selecting Baby + Fossil finds only a Pokemon that is
// BOTH, since there's no meaningful "either/or" reading of these flags. See
// matchesTrait in filterPokemon.ts.
export const TRAITS: QuirkDef[] = [
	{ key: "baby", label: "Baby", icon: "baby" },
	{ key: "fossil", label: "Fossil", icon: "bone" },
	{ key: "mega", label: "Can Mega Evolve", icon: "wand-2" },
	{ key: "gigantamax", label: "Can Gigantamax", icon: "expand" },
	// Bucketed off PokedexTableRow.evolutionStages (a whole-family value, see
	// its own comment). AND semantics still composes meaningfully with the
	// OTHER traits here (e.g. Baby + No Evolution), but selecting two of
	// these three buckets together always yields zero rows since they're
	// mutually exclusive per row — same as any other Traits combo that
	// happens not to overlap, not a special case. See matchesTrait in
	// filterPokemon.ts for the bucket boundaries.
	{ key: "no-evolution", label: "No Evolution", icon: "minus" },
	{ key: "one-evolution", label: "1 Evolution", icon: "arrow-up" },
	{ key: "two-plus-evolutions", label: "2+ Evolutions", icon: "chevrons-up" },
];

// PokeAPI's species.varieties naming convention ("{species}-mega"/"-mega-x"/
// "-mega-y") is NOT a reliable signal for "has an official in-game Mega
// Evolution" — verified live (full /pokemon?limit=2000 scan) that it hosts
// 94 "-mega"-suffixed varieties, only 48 of which are real Gen 6-7 Mega
// Evolutions; the other 46 are non-canon/fan content PokeAPI happens to also
// host (e.g. "raichu-mega-x", "starmie-mega", "dragonite-mega", even
// "baxcalibur-mega" for a Gen 9 Pokemon that predates any real Mega
// mechanic). deriveMegaForms filters candidates against this curated
// allowlist of the real 48 (by variety key) rather than trusting the naming
// pattern alone — same FOSSIL_IDS-style curation, needed because PokeAPI has
// no "is this an official game mechanic" flag either. This exact set is
// stable (Mega Evolution hasn't gained a new entry since Gen 7 ORAS/USUM,
// and isn't expected to as of Gen 8/9's Dynamax/Terastallization focus) —
// re-verify only if a future generation ever reintroduces Mega.
export const MEGA_VARIETY_KEYS = new Set([
	"venusaur-mega", "charizard-mega-x", "charizard-mega-y", "blastoise-mega",
	"alakazam-mega", "gengar-mega", "kangaskhan-mega", "pinsir-mega",
	"gyarados-mega", "aerodactyl-mega", "mewtwo-mega-x", "mewtwo-mega-y",
	"ampharos-mega", "scizor-mega", "heracross-mega", "houndoom-mega",
	"tyranitar-mega", "blaziken-mega", "gardevoir-mega", "mawile-mega",
	"aggron-mega", "medicham-mega", "manectric-mega", "banette-mega",
	"absol-mega", "garchomp-mega", "lucario-mega", "abomasnow-mega",
	"latias-mega", "latios-mega", "swampert-mega", "sceptile-mega",
	"sableye-mega", "altaria-mega", "gallade-mega", "audino-mega",
	"sharpedo-mega", "slowbro-mega", "steelix-mega", "pidgeot-mega",
	"glalie-mega", "diancie-mega", "metagross-mega", "rayquaza-mega",
	"camerupt-mega", "lopunny-mega", "salamence-mega", "beedrill-mega",
]);

export const GENERATIONS = [
	{ id: 1, name: "Gen 1 (Kanto)", start: 1, end: 151 },
	{ id: 2, name: "Gen 2 (Johto)", start: 152, end: 251 },
	{ id: 3, name: "Gen 3 (Hoenn)", start: 252, end: 386 },
	{ id: 4, name: "Gen 4 (Sinnoh)", start: 387, end: 493 },
	{ id: 5, name: "Gen 5 (Unova)", start: 494, end: 649 },
	{ id: 6, name: "Gen 6 (Kalos)", start: 650, end: 721 },
	{ id: 7, name: "Gen 7 (Alola)", start: 722, end: 809 },
	{ id: 8, name: "Gen 8 (Galar)", start: 810, end: 905 },
	// Verified live via /generation/9 — 120 species, contiguous #906-1025, no
	// gaps. This already includes every Teal Mask/Indigo Disk DLC addition
	// (Ogerpon, Dipplin, Archaludon, the Loyal Three, the Paradox Pokemon,
	// Terapagos, Pecharunt, ...) — DLC content patches into the same National
	// Dex range rather than adding its own, unlike a spinoff.
	{ id: 9, name: "Gen 9 (Paldea)", start: 906, end: 1025 },
] as const;

// All generations enabled by default (dex #1-1025, Gen 1 through Gen 9).
export const DEFAULT_ENABLED_GENERATIONS: number[] = GENERATIONS.map((g) => g.id);

// Which GENERATIONS entry a dex number falls in — shared by toTableRow (to
// precompute PokedexTableRow.generationId for a default/base row) and
// filterPokemon's isIdInGenerations (which used to re-scan GENERATIONS on
// every filter check; now just compares against this precomputed value).
// -1 for a dex number outside every configured range, which can't happen for
// data this app actually fetches but keeps the return type a plain number
// rather than number | undefined for callers.
export function resolveGenerationId(dexNumber: number): number {
	return GENERATIONS.find((g) => dexNumber >= g.start && dexNumber <= g.end)?.id ?? -1;
}

// Regional/alternate forms don't belong to their base species' original
// generation — an Alolan form is a Gen 7 creature regardless of its base
// species' dex number (e.g. Alolan Rattata is dex #019, a Gen 1 number, but
// disabling Gen 7 in the generations filter should still hide it), and needs
// its own human label ("Alolan") distinct from the plain suffix PokeAPI uses
// in the variety name ("alola"). Keyed by that PokeAPI variety-name suffix
// (e.g. "rattata-alola" -> suffix "alola") — see deriveRegionalForms in
// normalize.ts. Curated the same way FOSSIL_IDS is: PokeAPI has neither a
// "which generation introduced this form" nor a "display label" field.
export const REGIONAL_FORMS: Record<string, { label: string; generationId: number }> = {
	alola: { label: "Alolan", generationId: 7 },
	// Galarian forms span 19 species (verified live via a full /pokemon
	// name-suffix scan, not assumed from the Alolan count) — retroactively
	// touching Gen 1 (the legendary birds, Slowpoke line, Meowth, Farfetch'd,
	// Weezing, Mr. Mime), Gen 2 (Slowking), Gen 3 (Corsola, Zigzagoon/
	// Linoone), and Gen 5 (Darumaka/Darmanitan, Stunfisk), not just Gen 8
	// natives — same "scan the whole dex range" gotcha the Alolan phase hit.
	// Darmanitan's Galarian variety is keyed separately ("galar-standard")
	// since its variety name is "darmanitan-galar-standard" — its Zen-mode
	// counterpart ("darmanitan-galar-zen") is left unmodeled, same as the
	// already-unmodeled base "darmanitan-zen" (a pre-existing, consistent
	// gap, not a new one introduced here).
	galar: { label: "Galarian", generationId: 8 },
	"galar-standard": { label: "Galarian", generationId: 8 },
	// Hisuian forms span 16 species (verified live via a full /pokemon
	// name-suffix scan), all already-shipped Gen 1/4/5/7 species (Growlithe/
	// Arcanine, Voltorb/Electrode, Typhlosion, Qwilfish, Sneasel, Samurott,
	// Lilligant, Zorua/Zoroark, Braviary, Sliggoo/Goodra, Avalugg, Decidueye).
	// PokeAPI tags their origin version-group (legends-arceus) as
	// generation-viii — same bucket as Galarian, no new GENERATIONS entry
	// needed. See docs/multi-gen-expansion-plan.md's "Explicitly deferred"
	// section for the go/no-go history.
	hisui: { label: "Hisuian", generationId: 8 },
	// Paldean forms span 2 species, 4 varieties total (verified live via a
	// full /pokemon name-suffix scan for "-paldea") — Tauros (#128, Gen 1)
	// gained three "breed" varieties with no single unsuffixed "-paldea" form
	// at all, so each breed needs its own key; Wooper (#194, Gen 2) gained one
	// plain "-paldea" variety, itself the only route to Clodsire (#980) via
	// the same base_form-gated branch mechanism Yamask/Zigzagoon already use.
	// No Paldean form evolves *from* a non-Paldean ancestor the way Meowth/
	// Vulpix's Alolan lines do, and Tauros doesn't evolve at all — no new
	// evolution-chain gap here.
	"paldea-combat-breed": { label: "Paldean (Combat Breed)", generationId: 9 },
	"paldea-blaze-breed": { label: "Paldean (Blaze Breed)", generationId: 9 },
	"paldea-aqua-breed": { label: "Paldean (Aqua Breed)", generationId: 9 },
	paldea: { label: "Paldean", generationId: 9 },
};

// How many evolution stages the WHOLE family a given dex number belongs to
// has (0/1/2+, same value for every member of a family — see QUIRKS' no-
// evolution/one-evolution/two-plus-evolutions options and
// PokedexTableRow.evolutionStages). Unlike FOSSIL_IDS/REGIONAL_FORMS/
// STAT_OVERRIDES this isn't hand-curated — it's a generated array (index =
// dex number, 1-1025; index 0 unused) computed once against every one of
// PokeAPI's 541 evolution-chain resources, since the dex is fixed until Gen
// 10 and this doesn't change without a new generation shipping. Deliberately
// counts every `evolves_to` child unconditionally (ignoring
// evolution_details' base_form/region branch-selection entirely) rather than
// reusing normalizeEvolutionChain's default (no-context) view — that view
// has to pick exactly ONE coherent path for a specific viewed form, which
// silently drops a species whose ONLY evolution route is entirely
// form-gated (e.g. plain Farfetch'd has no evolution of its own; only
// Galarian Farfetch'd evolves into Sirfetch'd, with no unconditional sibling
// entry — verified live against /evolution-chain for Farfetch'd) — see
// evolutionFamilyDepth's own comment in normalize.ts for the full
// reasoning, and the generation script that produced this array (fetch
// every evolution-chain resource, walk `evolves_to` counting max depth,
// assign that depth to every member species id) for how to regenerate this
// after a future generation adds new evolution chains.
export const EVOLUTION_STAGES: readonly number[] = evolutionStagesData;

export const STAT_NAMES = [
	"hp", "attack", "defense", "special-attack", "special-defense", "speed",
] as const;

export const STAT_COLUMNS = [
	{ key: "hp", label: "HP" },
	{ key: "attack", label: "Atk" },
	{ key: "defense", label: "Def" },
	{ key: "specialAttack", label: "SpA" },
	{ key: "specialDefense", label: "SpD" },
	{ key: "speed", label: "Spe" },
] as const;

// Browse-table columns shown by default before the user customizes them via
// the Columns dropdown.
export const DEFAULT_VISIBLE_COLUMNS: string[] = STAT_COLUMNS.map((c) => c.key);

// Per-stat bar colors, matching Bulbapedia's own stat-bar convention.
export const STAT_COLORS: Record<string, string> = {
	hp: "#69DC12", attack: "#EFCC18", defense: "#E86412",
	specialAttack: "#14C3F1", specialDefense: "#4A6ADF", speed: "#D51DAD",
};

// PokeAPI's /pokemon.stats only ever returns the CURRENT (latest-game) base
// stat line — there's no per-generation stats field the way movepools have
// version_group_details. Gen 6 (X/Y) buffed a specific, finite list of
// underused species by +10 to one or two stats; every other species' stats
// have never changed. This is a curated override table (FOSSIL_IDS-style,
// not derived from any API) holding only the pre-buff value for whichever
// stat(s) changed — an "Active Gen" stat lookup overlays this onto the
// current stats when the active generation predates the buff
// (validThroughGen: the last generation that still used the old value).
// Sourced from https://bulbapedia.bulbagarden.net/wiki/Base_stats
// ("Between generations" > Generation VI), restricted to dex #1-809 (the
// generations this plugin currently supports at the time of the Gen 6 buff
// research) — re-check that page for any future phase. A species can only
// diverge from its Gen 6-onward stats via that buff wave if it existed
// *before* Gen 6, so nothing native to Gen 6/7 is ever eligible there — but
// this table isn't Gen-6-buff-only: Gen 8 separately nerfed Aegislash (#681,
// Gen 6 native) via a patch, verified live against Bulbapedia + PokeAPI.
// Keyed by PokedexTableRow.id (a specific form's own fetch id), not
// dexNumber — Alolan Raichu (#26, same dexNumber as regular Raichu, which
// IS in this table below) never existed pre-Gen 6 in any form, so it must
// NOT inherit regular Raichu's pre-buff speed value; keying by id rather
// than dexNumber keeps that correct for free (Alolan Raichu's own id simply
// never matches a key here).
export const STAT_OVERRIDES: Record<number, { validThroughGen: number; deltas: Partial<StatBlock> }> = {
	12: { validThroughGen: 5, deltas: { specialAttack: 80 } }, // Butterfree
	15: { validThroughGen: 5, deltas: { attack: 80 } }, // Beedrill
	18: { validThroughGen: 5, deltas: { speed: 91 } }, // Pidgeot
	25: { validThroughGen: 5, deltas: { defense: 30, specialDefense: 40 } }, // Pikachu
	26: { validThroughGen: 5, deltas: { speed: 100 } }, // Raichu
	31: { validThroughGen: 5, deltas: { attack: 82 } }, // Nidoqueen
	34: { validThroughGen: 5, deltas: { attack: 92 } }, // Nidoking
	36: { validThroughGen: 5, deltas: { specialAttack: 85 } }, // Clefable
	40: { validThroughGen: 5, deltas: { specialAttack: 75 } }, // Wigglytuff
	45: { validThroughGen: 5, deltas: { specialAttack: 100 } }, // Vileplume
	62: { validThroughGen: 5, deltas: { attack: 85 } }, // Poliwrath
	65: { validThroughGen: 5, deltas: { specialDefense: 85 } }, // Alakazam
	71: { validThroughGen: 5, deltas: { specialDefense: 60 } }, // Victreebel
	76: { validThroughGen: 5, deltas: { attack: 110 } }, // Golem
	181: { validThroughGen: 5, deltas: { defense: 75 } }, // Ampharos
	182: { validThroughGen: 5, deltas: { defense: 85 } }, // Bellossom
	184: { validThroughGen: 5, deltas: { specialAttack: 50 } }, // Azumarill
	189: { validThroughGen: 5, deltas: { specialDefense: 85 } }, // Jumpluff
	267: { validThroughGen: 5, deltas: { specialAttack: 90 } }, // Beautifly
	295: { validThroughGen: 5, deltas: { specialDefense: 63 } }, // Exploud
	398: { validThroughGen: 5, deltas: { specialDefense: 50 } }, // Staraptor
	407: { validThroughGen: 5, deltas: { defense: 55 } }, // Roserade
	508: { validThroughGen: 5, deltas: { attack: 100 } }, // Stoutland
	521: { validThroughGen: 5, deltas: { attack: 105 } }, // Unfezant
	526: { validThroughGen: 5, deltas: { specialDefense: 70 } }, // Gigalith
	537: { validThroughGen: 5, deltas: { attack: 85 } }, // Seismitoad
	542: { validThroughGen: 5, deltas: { specialDefense: 70 } }, // Leavanny
	545: { validThroughGen: 5, deltas: { attack: 90 } }, // Scolipede
	553: { validThroughGen: 5, deltas: { defense: 70 } }, // Krookodile
	// Gen 8's one base-stat change runs the opposite direction of the Gen 6
	// buff wave above (a nerf, not a buff) — Aegislash's Shield Forme (its
	// default variety) had Def/SpDef lowered 150 -> 140 in Sword/Shield
	// onward, confirmed live against both Bulbapedia's Aegislash page and
	// PokeAPI's current /pokemon/aegislash-shield stats (140/140). The
	// lookup mechanism doesn't care about direction, so this reuses the same
	// table rather than a separate one.
	681: { validThroughGen: 7, deltas: { defense: 150, specialDefense: 150 } }, // Aegislash
	// Gen 9 introduced no broad buff/nerf wave (checked live against
	// Bulbapedia's Base_stats "Between generations" section) — the two
	// Gen9-era stat changes that DO exist don't qualify for this table: the
	// Treasures of Ruin's mid-cycle 1.0.1 patch adjustment is Gen-9-native (no
	// earlier generation's stats to diverge from), and Hisuian Zorua/Zoroark/
	// Kleavor's pre-1.2.0 stat mismatch was corrected back to their original
	// Legends: Arceus values by the time this app's Active Gen 8 lookup would
	// ever read them, i.e. current data already matches — nothing to override
	// either way.
};

export const TYPE_COLORS: Record<string, string> = {
	normal: "#A8A878", fire: "#F08030", water: "#6890F0", electric: "#F8D030",
	grass: "#78C850", ice: "#98D8D8", fighting: "#C03028", poison: "#A040A0",
	ground: "#E0C068", flying: "#A890F0", psychic: "#F85888", bug: "#A8B820",
	rock: "#B8A038", ghost: "#705898", dragon: "#7038F8", dark: "#705848",
	steel: "#B8B8D0", fairy: "#EE99AC",
};

// Lucide icon names, picked for a recognizable-at-a-glance match to each
// type (verified against Obsidian's bundled icon set — not every Lucide
// icon ships with every Obsidian version).
export const TYPE_ICONS: Record<string, string> = {
	normal: "circle", fire: "flame", water: "droplet", electric: "zap",
	grass: "leaf", ice: "snowflake", fighting: "hand-fist", poison: "skull",
	ground: "mountain", flying: "feather", psychic: "eye", bug: "bug",
	rock: "stone", ghost: "ghost", dragon: "tornado", dark: "moon",
	steel: "anvil", fairy: "heart",
};
