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
	egg_groups: NamedApiResource[];
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
	id: number;
	name: string;
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
	id: number;
	name: string;
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
