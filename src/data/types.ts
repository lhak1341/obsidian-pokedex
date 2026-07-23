// --- Raw PokeAPI response shapes (subset of fields we actually use) ---

export interface NamedApiResource {
	name: string;
	url: string;
}

export interface RawPokemon {
	id: number;
	name: string;
	height: number;
	weight: number;
	types: { slot: number; type: NamedApiResource }[];
	abilities: { ability: NamedApiResource; is_hidden: boolean; slot: number }[];
	stats: { base_stat: number; effort: number; stat: NamedApiResource }[];
	sprites: {
		front_default: string | null;
		front_shiny: string | null;
		back_default: string | null;
		back_shiny: string | null;
		other?: {
			"official-artwork"?: { front_default: string | null; front_shiny: string | null };
		};
	};
	species: NamedApiResource;
	moves: {
		move: NamedApiResource;
		version_group_details: {
			level_learned_at: number;
			move_learn_method: NamedApiResource;
			version_group: NamedApiResource;
		}[];
	}[];
	// Items a wild-encountered individual of this species may be holding —
	// most species have none (empty array), not every entry has this field
	// populated. Per-game rarity % lives in version_details but isn't
	// currently surfaced (see normalizeHeldItems) — same simplicity level as
	// abilityNames/levelUpMoveNames below, not version/generation-scoped.
	held_items: {
		item: NamedApiResource;
		version_details: { rarity: number; version: NamedApiResource }[];
	}[];
}

export interface RawSpecies {
	id: number;
	name: string;
	gender_rate: number;
	hatch_counter: number;
	capture_rate: number;
	is_legendary: boolean;
	is_mythical: boolean;
	is_baby: boolean;
	egg_groups: NamedApiResource[];
	// Alternate forms of this species — most species have only the default
	// entry (is_default: true, pokemon.name === species.name); a Mega/Gigantamax
	// variety shows up here as an extra non-default entry with its own
	// `pokemon` resource (e.g. "charizard-mega-x"), never its own dex number
	// or species record (see deriveMegaForms in normalize.ts).
	varieties: { is_default: boolean; pokemon: NamedApiResource }[];
	flavor_text_entries: {
		flavor_text: string;
		language: NamedApiResource;
		version: NamedApiResource;
	}[];
	evolution_chain: { url: string };
	generation: NamedApiResource;
}

export interface RawEvolutionChainLink {
	species: NamedApiResource;
	evolution_details: {
		min_level: number | null;
		trigger: NamedApiResource | null;
		item: NamedApiResource | null;
		min_happiness: number | null;
		time_of_day: string;
		held_item: NamedApiResource | null;
		min_beauty: number | null;
		relative_physical_stats: number | null;
		location: NamedApiResource | null;
		known_move: NamedApiResource | null;
		party_species: NamedApiResource | null;
		gender: number | null;
		trade_species: NamedApiResource | null;
		needs_overworld_rain: boolean;
		turn_upside_down: boolean;
		// Present only on a form-divergent evolution (e.g. Meowth -> Persian has
		// two evolution_details entries: one for the regular line, one with
		// base_form: "meowth-alola" / evolved_form: "persian-alola" for the
		// Alolan line, which also happens to use a different trigger —
		// friendship instead of level). null on every entry for a species with
		// no regional-form-specific divergence (the common case — most Alolan
		// species share their evolution requirement with the base form, just
		// re-recorded per version_group). See normalizeEvolutionChain's
		// currentFormSuffix parameter for how these are selected per-row.
		base_form: NamedApiResource | null;
		evolved_form: NamedApiResource | null;
		// Gen 8+: the region an evolution must occur in, when that's the only
		// thing distinguishing two otherwise-identical entries (e.g. Mime Jr. ->
		// Mr. Mime vs. -> Galarian Mr. Mime, both requiring the known move
		// Mimic — neither parent nor child has its own base_form/evolved_form
		// variety here, since Mime Jr. itself has no Galarian variety; only this
		// field says which). Distinct from base_form: base_form names a
		// PokeAPI *variety* the parent must already be, region names a place
		// the evolution happens regardless of the parent's variety.
		region: NamedApiResource | null;
		// Gen 8+: Runerigus's take-damage trigger — must take at least this
		// much damage in a single hit without fainting (Galarian Yamask #562).
		min_damage_taken: number | null;
		// Hisuian forms (tagged generation-viii, legends-arceus): Hisuian
		// Qwilfish -> Overqwil requires using a specific move a number of times
		// (Barb Barrage x20 as a Strong Style move) rather than any
		// level/item/happiness condition already modeled — verified live
		// against /evolution-chain/106.
		used_move: NamedApiResource | null;
		min_move_count: number | null;
	}[];
	evolves_to: RawEvolutionChainLink[];
}

export interface RawEvolutionChain {
	id: number;
	chain: RawEvolutionChainLink;
}

export interface RawAbility {
	name: string;
	effect_entries: { effect: string; short_effect: string; language: NamedApiResource }[];
}

// Same effect_entries.short_effect shape as RawAbility (verified live against
// /item/{name}) — kept as its own type rather than reusing RawAbility since
// the two are semantically distinct raw responses that happen to share a
// field shape today.
export interface RawItem {
	name: string;
	effect_entries: { effect: string; short_effect: string; language: NamedApiResource }[];
}

export interface RawPokemonListResponse {
	count: number;
	next: string | null;
	previous: string | null;
	results: NamedApiResource[];
}

// --- Normalized shapes used by the UI layer ---

export interface StatBlock {
	hp: number;
	attack: number;
	defense: number;
	specialAttack: number;
	specialDefense: number;
	speed: number;
}

export interface EvolutionNode {
	// PokeAPI's own numeric pokemon id for whichever form this node
	// represents — the species' default-variety id for a regular node, or a
	// variety's own id (e.g. 10104 for ninetales-alola) when the chain was
	// normalized for a regional-form-aware traversal (see
	// normalizeEvolutionChain's currentFormSuffix parameter). Always safe to
	// pass straight into PokedexRepository fetch calls either way.
	id: number;
	// Same split as PokedexTableRow: the National Dex number ("No. 038"),
	// identical for every variety of a species — id above is what's actually
	// fetched/clicked/keyed-by, dexNumber is what's displayed. See
	// buildEvolutionNode in normalize.ts.
	dexNumber: number;
	name: string;
	// Human label for a regional-form node ("Alolan"), null for a default
	// one — mirrors PokedexTableRow.formLabel; see formatPokemonDisplayName.
	formLabel: string | null;
	minLevel: number | null;
	trigger: string | null;
	item: string | null;
	minHappiness: number | null;
	timeOfDay: string | null;
	heldItem: string | null;
	minBeauty: number | null;
	relativePhysicalStats: number | null;
	location: string | null;
	knownMove: string | null;
	partySpecies: string | null;
	gender: number | null;
	// The specific species that must be traded for (Gen 5+, e.g. Karrablast <->
	// Shelmet) — distinct from heldItem, which is the item carried during a
	// generic trade evolution. Mutually exclusive with heldItem in practice.
	tradeSpecies: string | null;
	// Gen 6+ level-up conditions (Sliggoo -> Goodra needs rain; Inkay ->
	// Malamar needs the device held upside down) — independent boolean
	// suffixes layered onto whatever base label matched, same treatment as
	// gender/timeOfDay below.
	needsOverworldRain: boolean;
	turnUpsideDown: boolean;
	// Gen 8+ independent suffixes, same layering treatment as the two above —
	// see RawEvolutionChainLink.evolution_details for what each means.
	region: string | null;
	minDamageTaken: number | null;
	// Hisuian Qwilfish -> Overqwil's use-move condition — see
	// RawEvolutionChainLink.evolution_details.used_move/min_move_count.
	usedMove: string | null;
	minMoveCount: number | null;
	children: EvolutionNode[];
}

export interface MoveEntry {
	name: string;
	levelLearnedAt: number;
	learnMethod: string;
	versionGroup: string;
}

export interface RawMove {
	name: string;
	power: number | null;
	accuracy: number | null;
	pp: number;
	type: NamedApiResource;
	// Unlike species' flavor_text_entries (keyed by `version`, one entry per
	// game), a move's is keyed by `version_group` (one entry per paired
	// games, e.g. "firered-leafgreen" covers both) — see normalizeMoveDetail.
	flavor_text_entries: { flavor_text: string; language: NamedApiResource; version_group: NamedApiResource }[];
}

export interface MoveDetail {
	type: string;
	power: number | null;
	accuracy: number | null;
	pp: number;
	// FRLG-specific description (see MOVE_DESCRIPTION_VERSION_GROUP) shown as
	// a hover tooltip on the move name — null when this move has no English
	// FRLG flavor text entry at all (rare; PokeAPI gap, not a fetch failure).
	description: string | null;
}

// Per evolution-chain-member visuals (see PokedexRepository.getEntryChainVisuals) —
// sprite AND types together so a partner outside the browsed dex range (id
// beyond the plugin's configured range) still gets both, not just a sprite
// with no type badges.
export interface EvolutionChainVisual {
	sprite: string | null;
	types: string[];
}

export interface EvYieldEntry {
	stat: keyof StatBlock;
	amount: number;
}

// Lightweight row shown in the browse table; cheap to keep ~400 of in memory.
// Carries ability names (not full ability detail) so the table's ability
// filter doesn't require a separate fetch per Pokemon. Also carries a few
// species-level fields (catchRate, hatchCounter) so those can be shown as
// optional table columns without a per-row detail fetch.
export type PokemonRarity = "normal" | "legendary" | "mythical";

export interface PokedexTableRow {
	// PokeAPI's own numeric pokemon id — the fetch/cache key and the sort
	// tiebreaker within a shared dexNumber, NOT what's shown as "No. XXX" or
	// what row-visibility/search-by-number/range filtering key off (see
	// dexNumber below). A regional-form row's id is its own variety pseudo-id
	// (e.g. 10091 for rattata-alola), never the base species' id.
	id: number;
	// The National Dex number ("No. 019") — identical across a species'
	// default row and every regional-form row it has, unlike id above. This
	// is what search-by-number, dex-range display, and the Traits filter's
	// FOSSIL_IDS lookup should compare against.
	dexNumber: number;
	name: string;
	// Human label for a regional/alternate form ("Alolan"), null for a
	// species' default row — see formatPokemonDisplayName in
	// utils/pokemonDisplay.ts for how this composes with `name` for display.
	formLabel: string | null;
	// Precomputed generation membership for the enabledGenerations
	// row-visibility filter: a default row's is derived from dexNumber
	// falling inside a GENERATIONS range (today's behavior); a regional-form
	// row's is looked up from REGIONAL_FORM_GENERATIONS instead, since a form
	// belongs to whichever generation actually introduced it (Alolan forms
	// are Gen 7) regardless of its base species' original dex number/gen —
	// disabling Gen 7 should hide Alolan Rattata even with Gen 1 enabled.
	generationId: number;
	types: string[];
	stats: StatBlock;
	evYield: EvYieldEntry[];
	abilityNames: string[];
	// Deduped move names learned via level-up (across MOVE_VERSION_GROUPS) —
	// powers the Quirks filter's Thief/Trick/Covet toggles without a
	// per-Pokemon detail fetch, since the underlying move data is already
	// part of the same RawPokemon response abilityNames/stats come from.
	levelUpMoveNames: string[];
	// Wild-encounter held items (see RawPokemon.held_items) — empty for most
	// species, which is a real fact (nothing to hold), not missing data.
	heldItemNames: string[];
	spriteDataUri: string | null;
	height: number;
	weight: number;
	catchRate: number;
	hatchCounter: number;
	rarity: PokemonRarity;
	// Traits filter fields — cheap booleans derived from data already fetched
	// at table-load time (species/pokemon), no extra fetch. Fossil and held-
	// item aren't duplicated here: fossil checks FOSSIL_IDS.has(dexNumber)
	// directly (curated list, same as before), held-item checks
	// heldItemNames.length > 0 directly — see matchesTrait in filterPokemon.ts.
	isBaby: boolean;
	canMegaEvolve: boolean;
	canGigantamax: boolean;
}

// Full record shown in the detail screen.
export interface PokedexEntry extends PokedexTableRow {
	abilities: { name: string; isHidden: boolean }[];
	artworkDataUri: string | null;
	shinyDataUri: string | null;
	shinyArtworkDataUri: string | null;
	// Keyed by FLAVOR_TEXT_TABS' `key` (e.g. "leafgreen", "ruby-sapphire") —
	// only present for tabs this species actually has a matching version for.
	flavorTexts: Record<string, string>;
	eggGroups: string[];
	genderRate: number;
	moves: MoveEntry[];
	evolutionChain: EvolutionNode | null;
	// Rarity is per PokeAPI game *version*, scoped down to the ones this app
	// currently supports (see normalizeHeldItemDetails) — `rarities` is
	// almost always one value (an item's drop % rarely differs across a
	// species' supported games), kept as a list of distinct values for the
	// rare case it does. Table column (heldItemNames on PokedexTableRow)
	// deliberately stays name-only; this richer shape is detail-view-only.
	heldItems: { name: string; rarities: number[] }[];
	// Mega Evolution varieties this species has, if any (empty for the ~95%
	// of species that don't) — cheap to derive from species.varieties at
	// getEntryCore time, no extra fetch. Selecting one lazily fetches the
	// full MegaFormDetail (see PokedexRepository.getMegaForm) only when the
	// user actually picks that tab, same lazy-on-interaction shape as
	// ability/move descriptions.
	megaForms: MegaFormSummary[];
	// Gigantamax varieties this species has, if any — same lazy-fetch shape
	// as megaForms (see PokedexRepository.getGigantamaxForm), but the detail
	// itself is just PortraitImageSource: Gigantamax changes no stats, types,
	// or abilities (verified live comparing Gengar vs. gengar-gmax), only
	// the sprite/artwork, unlike Mega.
	gigantamaxForms: GigantamaxFormSummary[];
}

// key is the raw PokeAPI variety name (e.g. "charizard-mega-x") — used both
// as the display-agnostic identity for caching/lookup and as the literal
// fetch target (GET /pokemon/{key}). label is the short human tab text
// derived from it ("Mega X").
export interface MegaFormSummary {
	key: string;
	label: string;
}

// Same shape as MegaFormSummary — key is the raw PokeAPI variety name (e.g.
// "toxtricity-amped-gmax"), label is always "Gigantamax" (no split-form
// case like Mega X/Y exists for Gigantamax).
export interface GigantamaxFormSummary {
	key: string;
	label: string;
}

// The four image fields PokedexEntry and MegaFormDetail both carry, named so
// utils/portrait.ts's resolvePortrait can treat either shape interchangeably
// (DetailScreen.svelte passes whichever is currently active — base species
// or a selected Mega form — as this type).
export interface PortraitImageSource {
	spriteDataUri: string | null;
	artworkDataUri: string | null;
	shinyDataUri: string | null;
	shinyArtworkDataUri: string | null;
}

// A Gigantamax form's own images, fetched from its /pokemon/{key} response
// (see PokedexRepository.getGigantamaxForm) — unlike MegaFormDetail, there's
// nothing else to carry: no stat/type/ability change, so this is exactly
// PortraitImageSource with no extra fields.
export type GigantamaxFormDetail = PortraitImageSource;

// Everything that visibly differs on a Mega form vs its base species —
// deliberately NOT extending PokedexEntry: a Mega form has no breeding data,
// no wild held items, no independent movepool/evolution/flavor text of its
// own (it's a battle-only transform of the base species, not a distinct
// dex entry), so there's nothing to inherit. Same four image fields as
// PokedexEntry — see PortraitImageSource — so DetailScreen's portrait/
// shiny-toggle derivation (resolvePortrait) can treat either shape
// interchangeably.
export interface MegaFormDetail extends PortraitImageSource {
	types: string[];
	abilities: { name: string; isHidden: boolean }[];
	stats: StatBlock;
}

export interface PluginSettings {
	enabledGenerations: number[];
	spriteStyle: "official-artwork" | "sprite";
	gridDensity: "compact" | "comfortable";
	defaultSortColumn: "id" | "name";
	visibleColumns: string[];
	useTypeIcons: boolean;
	// Which generation's stats/moves/flavor text to prioritize for display,
	// independent of enabledGenerations (which only controls which dex rows
	// are fetched/visible at all) — see resolveStatsForGen and docs/
	// multi-gen-expansion-plan.md's "Active Gen dropdown" design. Falls back
	// to the latest supported generation's data wherever the active
	// generation has nothing of its own for a given species.
	activeGen: number;
}
