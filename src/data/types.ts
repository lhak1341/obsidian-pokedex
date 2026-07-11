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
	cries: { latest: string | null; legacy: string | null };
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
	}[];
	evolves_to: RawEvolutionChainLink[];
}

export interface RawEvolutionChain {
	id: number;
	chain: RawEvolutionChainLink;
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
	children: EvolutionNode[];
}

export interface MoveEntry {
	name: string;
	levelLearnedAt: number;
	learnMethod: string;
	versionGroup: string;
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
	flavorText: string | null;
	eggGroups: string[];
	genderRate: number;
	moves: MoveEntry[];
	evolutionChain: EvolutionNode | null;
	criesUrl: string | null;
}

export interface PluginSettings {
	enabledGenerations: number[];
	spriteStyle: "official-artwork" | "sprite";
	gridDensity: "compact" | "comfortable";
	defaultSortColumn: "id" | "name";
	visibleColumns: string[];
	useTypeIcons: boolean;
}
