import { describe, expect, it } from "vitest";
import {
	collectChainIds,
	deriveMegaForms,
	deriveRegionalForms,
	describeEvolutionRequirement,
	extractFlavorTexts,
	nextEvolutionLevels,
	normalizeEvolutionChain,
	normalizeEvYield,
	normalizeHeldItemDetails,
	normalizeHeldItems,
	normalizeMoveDetail,
	normalizeMoves,
	normalizeStats,
	resolveRegionalFormSuffix,
	toEntry,
	toTableRow,
	trimMovesToVersionGroups,
} from "./normalize";
import type { EvolutionNode, RawEvolutionChain, RawEvolutionChainLink, RawMove, RawPokemon, RawSpecies } from "./types";
import bulbasaurChain from "./__fixtures__/bulbasaur-evolution-chain.json";
import bulbasaurSpecies from "./__fixtures__/bulbasaur-species.json";
import bulbasaur from "./__fixtures__/bulbasaur.json";

const pokemon = bulbasaur as unknown as RawPokemon;
const species: RawSpecies = bulbasaurSpecies;
const chain = bulbasaurChain as unknown as RawEvolutionChain;

describe("normalizeHeldItems", () => {
	it("returns an empty list for a species with no wild held items", () => {
		expect(normalizeHeldItems(pokemon.held_items)).toEqual([]);
	});

	it("extracts item names, ignoring per-version rarity", () => {
		const heldItems = [
			{ item: { name: "oran-berry", url: "" }, version_details: [{ rarity: 50, version: { name: "ruby", url: "" } }] },
			{ item: { name: "leftovers", url: "" }, version_details: [{ rarity: 5, version: { name: "emerald", url: "" } }] },
		];
		expect(normalizeHeldItems(heldItems)).toEqual(["oran-berry", "leftovers"]);
	});

	it("drops an item that only exists in an out-of-scope generation (e.g. Parasect's Balm Mushroom, Gen 5 only)", () => {
		const heldItems = [
			{ item: { name: "tiny-mushroom", url: "" }, version_details: [{ rarity: 50, version: { name: "platinum", url: "" } }] },
			{ item: { name: "balm-mushroom", url: "" }, version_details: [{ rarity: 1, version: { name: "black", url: "" } }] },
		];
		expect(normalizeHeldItems(heldItems, ["platinum"])).toEqual(["tiny-mushroom"]);
	});
});

describe("normalizeHeldItemDetails", () => {
	it("keeps only distinct rarities from in-scope versions, dropping items with none left", () => {
		const heldItems = [
			{
				item: { name: "tiny-mushroom", url: "" },
				version_details: [
					{ rarity: 50, version: { name: "ruby", url: "" } },
					{ rarity: 50, version: { name: "emerald", url: "" } },
					{ rarity: 100, version: { name: "black", url: "" } }, // out of scope, ignored
				],
			},
			{
				item: { name: "balm-mushroom", url: "" },
				version_details: [{ rarity: 1, version: { name: "black", url: "" } }], // entirely out of scope
			},
		];
		expect(normalizeHeldItemDetails(heldItems, ["ruby", "emerald"])).toEqual([
			{ name: "tiny-mushroom", rarities: [50] },
		]);
	});
});

describe("normalizeStats", () => {
	it("maps PokeAPI stat names to camelCase keys", () => {
		expect(normalizeStats(pokemon.stats)).toEqual({
			hp: 45,
			attack: 49,
			defense: 49,
			specialAttack: 65,
			specialDefense: 65,
			speed: 45,
		});
	});
});

describe("normalizeMoves", () => {
	it("keeps only moves in the requested version groups", () => {
		const moves = normalizeMoves(pokemon.moves, ["firered-leafgreen", "emerald"]);
		const names = moves.map((m) => m.name);
		expect(names).toContain("tackle");
		expect(names).toContain("vine-whip");
		expect(names).toContain("razor-wind"); // emerald-only egg move
		expect(names).not.toContain("solar-beam"); // black-white only
	});

	it("sorts level-up moves by level before other methods", () => {
		const moves = normalizeMoves(pokemon.moves, ["firered-leafgreen", "emerald"]);
		const levelUpMoves = moves.filter((m) => m.learnMethod === "level-up");
		expect(levelUpMoves.map((m) => m.name)).toEqual(["tackle", "vine-whip", "vine-whip"]);
	});

	it("keeps a move's entry for each version group separately, even at the same level", () => {
		const moves = normalizeMoves(pokemon.moves, ["firered-leafgreen", "emerald"]);
		const vineWhips = moves.filter((m) => m.name === "vine-whip");
		expect(vineWhips.map((m) => m.versionGroup).sort()).toEqual(["emerald", "firered-leafgreen"]);
	});

	it("returns an empty list when no version group matches", () => {
		expect(normalizeMoves(pokemon.moves, ["scarlet-violet"])).toEqual([]);
	});
});

describe("trimMovesToVersionGroups", () => {
	it("drops version_group_details outside the requested groups", () => {
		const trimmed = trimMovesToVersionGroups(pokemon.moves, ["firered-leafgreen", "emerald"]);
		for (const entry of trimmed) {
			for (const detail of entry.version_group_details) {
				expect(["firered-leafgreen", "emerald"]).toContain(detail.version_group.name);
			}
		}
	});

	it("drops a move entirely once it has no remaining version_group_details", () => {
		const trimmed = trimMovesToVersionGroups(pokemon.moves, ["firered-leafgreen", "emerald"]);
		expect(trimmed.some((m) => m.move.name === "solar-beam")).toBe(false); // black-white only
	});

	it("produces output normalizeMoves still resolves the same way", () => {
		const trimmed = trimMovesToVersionGroups(pokemon.moves, ["firered-leafgreen", "emerald"]);
		const before = normalizeMoves(pokemon.moves, ["firered-leafgreen", "emerald"]).map((m) => m.name).sort();
		const after = normalizeMoves(trimmed, ["firered-leafgreen", "emerald"]).map((m) => m.name).sort();
		expect(after).toEqual(before);
	});
});

describe("extractFlavorTexts", () => {
	it("keys results by tab, using the first matching version per tab", () => {
		expect(extractFlavorTexts(species).firered).toContain("without eating");
	});

	it("strips newline/formfeed characters", () => {
		const texts = extractFlavorTexts(species);
		expect(Object.values(texts).join("")).not.toMatch(/[\n\f\r]/);
	});

	it("omits a tab when the species has no matching version for it", () => {
		// Fixture only carries "red" and "firered" entries — "red" isn't any
		// tab's version, so only the firered tab should be populated.
		// (Not `toEqual({ firered: expect.any(String) })` — vitest types
		// expect.any's return as `any`, which trips
		// @typescript-eslint/no-unsafe-assignment, and this repo's eslint
		// config blocks disabling any rule via inline comment.)
		const texts = extractFlavorTexts(species);
		expect(Object.keys(texts)).toEqual(["firered"]);
		expect(typeof texts.firered).toBe("string");
	});
});

describe("normalizeEvolutionChain", () => {
	it("walks the full branch and extracts evolution triggers", () => {
		const node = normalizeEvolutionChain(chain.chain);
		expect(node.name).toBe("bulbasaur");
		expect(node.children[0].name).toBe("ivysaur");
		expect(node.children[0].minLevel).toBe(16);
		expect(node.children[0].children[0].name).toBe("venusaur");
		expect(node.children[0].children[0].minLevel).toBe(32);
	});

	// Meowth-shaped: two evolution_details entries on the same evolves_to
	// node, one for the regular line (Lv. 28), one form-divergent (Alolan,
	// friendship) — verified live against the real Meowth evolution-chain
	// response (see docs/multi-gen-expansion-plan.md Phase 4 log).
	function evolutionDetail(overrides: Partial<RawEvolutionChainLink["evolution_details"][number]>) {
		return {
			min_level: null, trigger: null, item: null, min_happiness: null, time_of_day: "",
			held_item: null, min_beauty: null, relative_physical_stats: null, location: null,
			known_move: null, party_species: null, gender: null, trade_species: null,
			needs_overworld_rain: false, turn_upside_down: false, base_form: null, evolved_form: null,
			...overrides,
		};
	}
	const meowthChain: RawEvolutionChainLink = {
		species: { name: "meowth", url: "https://pokeapi.co/api/v2/pokemon-species/52/" },
		evolution_details: [],
		evolves_to: [
			{
				species: { name: "persian", url: "https://pokeapi.co/api/v2/pokemon-species/53/" },
				evolution_details: [
					evolutionDetail({ min_level: 28, trigger: { name: "level-up", url: "" } }),
					evolutionDetail({
						min_happiness: 160,
						trigger: { name: "level-up", url: "" },
						base_form: { name: "meowth-alola", url: "https://pokeapi.co/api/v2/pokemon/10107/" },
						evolved_form: { name: "persian-alola", url: "https://pokeapi.co/api/v2/pokemon/10108/" },
					}),
				],
				evolves_to: [],
			},
		],
	};

	it("picks the base (null base_form) entry when no context is given", () => {
		const node = normalizeEvolutionChain(meowthChain);
		expect(node.id).toBe(52);
		expect(node.children[0].minLevel).toBe(28);
		expect(node.children[0].minHappiness).toBeNull();
		expect(node.children[0].id).toBe(53);
	});

	it("picks the form-matching entry and resolves the variety's own id when a context is given", () => {
		const node = normalizeEvolutionChain(meowthChain, { formSuffix: "alola", rootId: 10107 });
		expect(node.id).toBe(10107);
		expect(node.children[0].minLevel).toBeNull();
		expect(node.children[0].minHappiness).toBe(160);
		expect(node.children[0].id).toBe(10108);
	});
});

describe("collectChainIds", () => {
	it("flattens a linear chain into id order root-first", () => {
		const node = normalizeEvolutionChain(chain.chain);
		expect(collectChainIds(node)).toEqual([node.id, node.children[0].id, node.children[0].children[0].id]);
	});

	it("walks every branch of a forked chain (e.g. Eevee-shaped)", () => {
		const forked = {
			id: 1,
			dexNumber: 1,
			formLabel: null,
			name: "root",
			minLevel: null,
			trigger: null,
			item: null,
			minHappiness: null,
			timeOfDay: null,
			heldItem: null,
			minBeauty: null,
			relativePhysicalStats: null,
			location: null,
			knownMove: null,
			partySpecies: null,
			gender: null,
			tradeSpecies: null,
			needsOverworldRain: false,
			turnUpsideDown: false,
			children: [
				{ id: 2, dexNumber: 2, formLabel: null, name: "branch-a", minLevel: null, trigger: null, item: null, minHappiness: null, timeOfDay: null, heldItem: null, minBeauty: null, relativePhysicalStats: null, location: null, knownMove: null, partySpecies: null, gender: null, tradeSpecies: null, needsOverworldRain: false, turnUpsideDown: false, children: [] },
				{ id: 3, dexNumber: 3, formLabel: null, name: "branch-b", minLevel: null, trigger: null, item: null, minHappiness: null, timeOfDay: null, heldItem: null, minBeauty: null, relativePhysicalStats: null, location: null, knownMove: null, partySpecies: null, gender: null, tradeSpecies: null, needsOverworldRain: false, turnUpsideDown: false, children: [] },
			],
		};
		expect(collectChainIds(forked)).toEqual([1, 2, 3]);
	});
});

describe("nextEvolutionLevels", () => {
	it("returns the level of the id's own next evolution, not the root's", () => {
		const node = normalizeEvolutionChain(chain.chain);
		// bulbasaur (root) -> ivysaur (Lv.16) -> venusaur (Lv.32)
		expect(nextEvolutionLevels(node, node.id)).toEqual([16]);
		expect(nextEvolutionLevels(node, node.children[0].id)).toEqual([32]);
	});

	it("returns empty for a final-stage member", () => {
		const node = normalizeEvolutionChain(chain.chain);
		expect(nextEvolutionLevels(node, node.children[0].children[0].id)).toEqual([]);
	});

	it("returns empty for an id not in the chain", () => {
		const node = normalizeEvolutionChain(chain.chain);
		expect(nextEvolutionLevels(node, 999)).toEqual([]);
	});

	it("returns empty when the next evolution has no level threshold (item/trade)", () => {
		const itemEvolution = {
			id: 1,
			dexNumber: 1,
			formLabel: null,
			name: "root",
			minLevel: null,
			trigger: null,
			item: null,
			minHappiness: null,
			timeOfDay: null,
			heldItem: null,
			minBeauty: null,
			relativePhysicalStats: null,
			location: null,
			knownMove: null,
			partySpecies: null,
			gender: null,
			tradeSpecies: null,
			needsOverworldRain: false,
			turnUpsideDown: false,
			children: [{ id: 2, dexNumber: 2, formLabel: null, name: "evolved", minLevel: null, trigger: "trade", item: null, minHappiness: null, timeOfDay: null, heldItem: null, minBeauty: null, relativePhysicalStats: null, location: null, knownMove: null, partySpecies: null, gender: null, tradeSpecies: null, needsOverworldRain: false, turnUpsideDown: false, children: [] }],
		};
		expect(nextEvolutionLevels(itemEvolution, 1)).toEqual([]);
	});

	it("dedupes and sorts levels across multiple branches (e.g. Tyrogue-shaped)", () => {
		const forked = {
			id: 1,
			dexNumber: 1,
			formLabel: null,
			name: "root",
			minLevel: null,
			trigger: null,
			item: null,
			minHappiness: null,
			timeOfDay: null,
			heldItem: null,
			minBeauty: null,
			relativePhysicalStats: null,
			location: null,
			knownMove: null,
			partySpecies: null,
			gender: null,
			tradeSpecies: null,
			needsOverworldRain: false,
			turnUpsideDown: false,
			children: [
				{ id: 2, dexNumber: 2, formLabel: null, name: "branch-a", minLevel: 20, trigger: "level-up", item: null, minHappiness: null, timeOfDay: null, heldItem: null, minBeauty: null, relativePhysicalStats: null, location: null, knownMove: null, partySpecies: null, gender: null, tradeSpecies: null, needsOverworldRain: false, turnUpsideDown: false, children: [] },
				{ id: 3, dexNumber: 3, formLabel: null, name: "branch-b", minLevel: 10, trigger: "level-up", item: null, minHappiness: null, timeOfDay: null, heldItem: null, minBeauty: null, relativePhysicalStats: null, location: null, knownMove: null, partySpecies: null, gender: null, tradeSpecies: null, needsOverworldRain: false, turnUpsideDown: false, children: [] },
				{ id: 4, dexNumber: 4, formLabel: null, name: "branch-c", minLevel: 20, trigger: "level-up", item: null, minHappiness: null, timeOfDay: null, heldItem: null, minBeauty: null, relativePhysicalStats: null, location: null, knownMove: null, partySpecies: null, gender: null, tradeSpecies: null, needsOverworldRain: false, turnUpsideDown: false, children: [] },
			],
		};
		expect(nextEvolutionLevels(forked, 1)).toEqual([10, 20]);
	});
});

describe("describeEvolutionRequirement", () => {
	function node(overrides: Partial<EvolutionNode>): EvolutionNode {
		return {
			id: 2,
			dexNumber: 2,
			formLabel: null,
			name: "evolved",
			minLevel: null,
			trigger: null,
			item: null,
			minHappiness: null,
			timeOfDay: null,
			heldItem: null,
			minBeauty: null,
			relativePhysicalStats: null,
			location: null,
			knownMove: null,
			partySpecies: null,
			gender: null,
			tradeSpecies: null,
			needsOverworldRain: false,
			turnUpsideDown: false,
			children: [],
			...overrides,
		};
	}

	it("labels a level-up evolution", () => {
		expect(describeEvolutionRequirement(node({ minLevel: 16, trigger: "level-up" }))).toBe("Lv. 16");
	});

	it("labels an item evolution", () => {
		expect(describeEvolutionRequirement(node({ item: "thunder-stone", trigger: "use-item" }))).toBe(
			"thunder stone",
		);
	});

	it("labels a friendship evolution", () => {
		expect(describeEvolutionRequirement(node({ minHappiness: 220, trigger: "level-up" }))).toBe("Friendship");
	});

	it("labels a beauty evolution", () => {
		expect(describeEvolutionRequirement(node({ minBeauty: 170, trigger: "level-up" }))).toBe("Beauty");
	});

	it("labels a known-move evolution", () => {
		expect(describeEvolutionRequirement(node({ knownMove: "mimic", trigger: "level-up" }))).toBe("Knows mimic");
	});

	it("labels a party-species evolution", () => {
		expect(describeEvolutionRequirement(node({ partySpecies: "remoraid", trigger: "level-up" }))).toBe(
			"remoraid in party",
		);
	});

	it("labels a location evolution", () => {
		expect(describeEvolutionRequirement(node({ location: "mount-coronet", trigger: "level-up" }))).toBe(
			"mount coronet",
		);
	});

	it("labels a non-level-up trigger with no other requirement (e.g. shed)", () => {
		expect(describeEvolutionRequirement(node({ trigger: "shed" }))).toBe("shed");
	});

	it("returns an empty string for a plain level-up with no threshold (root node)", () => {
		expect(describeEvolutionRequirement(node({ trigger: "level-up" }))).toBe("");
	});

	it("appends a relative-physical-stats suffix to a base label", () => {
		expect(
			describeEvolutionRequirement(node({ minLevel: 20, trigger: "level-up", relativePhysicalStats: 1 })),
		).toBe("Lv. 20 (Atk > Def)");
		expect(
			describeEvolutionRequirement(node({ minLevel: 20, trigger: "level-up", relativePhysicalStats: -1 })),
		).toBe("Lv. 20 (Def > Atk)");
		expect(
			describeEvolutionRequirement(node({ minLevel: 20, trigger: "level-up", relativePhysicalStats: 0 })),
		).toBe("Lv. 20 (Atk = Def)");
	});

	it("overrides an already-matched base label when trigger is trade with a held item", () => {
		expect(
			describeEvolutionRequirement(node({ minLevel: 1, trigger: "trade", heldItem: "metal-coat" })),
		).toBe("Trade (metal coat)");
	});

	it("labels a trade-for-species evolution (e.g. Karrablast <-> Shelmet)", () => {
		expect(
			describeEvolutionRequirement(node({ trigger: "trade", tradeSpecies: "shelmet" })),
		).toBe("Trade (for shelmet)");
	});

	it("appends a rain suffix to a base label (e.g. Sliggoo -> Goodra)", () => {
		expect(
			describeEvolutionRequirement(node({ minLevel: 50, trigger: "level-up", needsOverworldRain: true })),
		).toBe("Lv. 50 (Rain)");
	});

	it("appends an upside-down suffix to a base label (e.g. Inkay -> Malamar)", () => {
		expect(
			describeEvolutionRequirement(node({ minLevel: 30, trigger: "level-up", turnUpsideDown: true })),
		).toBe("Lv. 30 (Upside-down)");
	});

	it("appends a gender suffix to a base label", () => {
		expect(describeEvolutionRequirement(node({ minLevel: 30, trigger: "level-up", gender: 1 }))).toBe(
			"Lv. 30 (Female)",
		);
		expect(describeEvolutionRequirement(node({ minLevel: 30, trigger: "level-up", gender: 2 }))).toBe(
			"Lv. 30 (Male)",
		);
	});

	it("appends a time-of-day suffix to a base label, last in the chain", () => {
		expect(
			describeEvolutionRequirement(node({ minLevel: 30, trigger: "level-up", timeOfDay: "day" })),
		).toBe("Lv. 30 (Day)");
		expect(
			describeEvolutionRequirement(node({ minLevel: 30, trigger: "level-up", timeOfDay: "night" })),
		).toBe("Lv. 30 (Night)");
	});

	it("returns a bare time-of-day label when no base label matched", () => {
		expect(describeEvolutionRequirement(node({ trigger: "level-up", timeOfDay: "day" }))).toBe("Day");
	});
});

describe("normalizeEvYield", () => {
	it("only includes stats with non-zero effort", () => {
		expect(normalizeEvYield(pokemon.stats)).toEqual([{ stat: "specialAttack", amount: 1 }]);
	});
});

describe("toTableRow", () => {
	it("produces a lightweight row with ability names for filtering and species-level fields", () => {
		const row = toTableRow(pokemon, species, null);
		expect(row.id).toBe(1);
		expect(row.dexNumber).toBe(1);
		expect(row.formLabel).toBeNull();
		expect(row.generationId).toBe(1);
		expect(row.name).toBe("bulbasaur");
		expect(row.types).toEqual(["grass", "poison"]);
		expect(row.abilityNames).toEqual(["overgrow", "chlorophyll"]);
		expect(row.height).toBe(7);
		expect(row.weight).toBe(69);
		expect(row.catchRate).toBe(45);
		expect(row.hatchCounter).toBe(20);
		expect(row.evYield).toEqual([{ stat: "specialAttack", amount: 1 }]);
		expect(row.heldItemNames).toEqual([]);
	});

	it("dedupes level-up move names across version groups", () => {
		const row = toTableRow(pokemon, species, null);
		expect(row.levelUpMoveNames).toEqual(["tackle", "vine-whip"]);
	});

	it("derives dexNumber/formLabel/generationId/name from the base species for a regional-form pokemon", () => {
		const alolanRattataSpecies = {
			...species,
			id: 19,
			dexNumber: 19,
			formLabel: null,
			name: "rattata",
			varieties: [
				{ is_default: true, pokemon: { name: "rattata", url: "" } },
				{ is_default: false, pokemon: { name: "rattata-alola", url: "" } },
			],
		} as unknown as RawSpecies;
		const alolanRattataPokemon = { ...pokemon, id: 10091, name: "rattata-alola" };
		const row = toTableRow(alolanRattataPokemon, alolanRattataSpecies, null);
		expect(row.id).toBe(10091);
		expect(row.dexNumber).toBe(19);
		expect(row.formLabel).toBe("Alolan");
		expect(row.generationId).toBe(7);
		expect(row.name).toBe("rattata");
	});
});

describe("toEntry", () => {
	it("merges pokemon, species, and evolution chain into one record", () => {
		const node = normalizeEvolutionChain(chain.chain);
		const entry = toEntry(pokemon, species, node, {
			sprite: null,
			artwork: null,
			shiny: null,
			shinyArtwork: null,
		});
		expect(entry.eggGroups).toEqual(["monster", "plant"]);
		expect(entry.hatchCounter).toBe(20);
		expect(entry.catchRate).toBe(45);
		expect(entry.evolutionChain?.children[0].name).toBe("ivysaur");
		expect(entry.moves.some((m) => m.name === "vine-whip")).toBe(true);
	});
});

describe("normalizeMoveDetail", () => {
	it("flattens the raw move response to type/power/accuracy/pp", () => {
		const raw: RawMove = {
			name: "flamethrower",
			power: 90,
			accuracy: 100,
			pp: 15,
			type: { name: "fire", url: "" },
			flavor_text_entries: [],
		};
		expect(normalizeMoveDetail(raw)).toEqual({
			type: "fire",
			power: 90,
			accuracy: 100,
			pp: 15,
			description: null,
		});
	});

	it("passes through null power/accuracy for status moves", () => {
		const raw: RawMove = {
			name: "swords-dance",
			power: null,
			accuracy: null,
			pp: 20,
			type: { name: "normal", url: "" },
			flavor_text_entries: [],
		};
		expect(normalizeMoveDetail(raw)).toEqual({
			type: "normal",
			power: null,
			accuracy: null,
			pp: 20,
			description: null,
		});
	});

	it("picks the English FireRed/LeafGreen flavor text, ignoring other languages/version groups", () => {
		const raw: RawMove = {
			name: "tackle",
			power: 40,
			accuracy: 100,
			pp: 35,
			type: { name: "normal", url: "" },
			flavor_text_entries: [
				{ flavor_text: "Attaque physique.", language: { name: "fr", url: "" }, version_group: { name: "firered-leafgreen", url: "" } },
				{ flavor_text: "A physical attack\nin Emerald.", language: { name: "en", url: "" }, version_group: { name: "emerald", url: "" } },
				{ flavor_text: "A physical attack\nin FRLG.", language: { name: "en", url: "" }, version_group: { name: "firered-leafgreen", url: "" } },
			],
		};
		expect(normalizeMoveDetail(raw).description).toBe("A physical attack in FRLG.");
	});

	it("falls through to the next known version group when there's no FRLG entry (e.g. a Gen 4+ signature move)", () => {
		const raw: RawMove = {
			name: "tackle",
			power: 40,
			accuracy: 100,
			pp: 35,
			type: { name: "normal", url: "" },
			flavor_text_entries: [
				{ flavor_text: "A physical attack in Emerald.", language: { name: "en", url: "" }, version_group: { name: "emerald", url: "" } },
			],
		};
		expect(normalizeMoveDetail(raw).description).toBe("A physical attack in Emerald.");
	});

	it("falls back to null when no English entry exists in any known version group", () => {
		const raw: RawMove = {
			name: "tackle",
			power: 40,
			accuracy: 100,
			pp: 35,
			type: { name: "normal", url: "" },
			flavor_text_entries: [
				{ flavor_text: "Attaque physique.", language: { name: "fr", url: "" }, version_group: { name: "firered-leafgreen", url: "" } },
				{ flavor_text: "A physical attack.", language: { name: "en", url: "" }, version_group: { name: "sword-shield", url: "" } },
			],
		};
		expect(normalizeMoveDetail(raw).description).toBeNull();
	});
});

describe("deriveMegaForms", () => {
	function speciesWithVarieties(name: string, varietyNames: string[]): RawSpecies {
		return {
			name,
			varieties: [
				{ is_default: true, pokemon: { name, url: "" } },
				...varietyNames.map((n) => ({ is_default: false, pokemon: { name: n, url: "" } })),
			],
		} as unknown as RawSpecies;
	}

	it("returns empty for a species with no Mega variety", () => {
		expect(deriveMegaForms(speciesWithVarieties("bulbasaur", []))).toEqual([]);
	});

	it("labels a single Mega variety as just 'Mega'", () => {
		expect(deriveMegaForms(speciesWithVarieties("gengar", ["gengar-mega", "gengar-gmax"]))).toEqual([
			{ key: "gengar-mega", label: "Mega" },
		]);
	});

	it("labels an X/Y-split Mega pair and excludes Gigantamax", () => {
		expect(
			deriveMegaForms(speciesWithVarieties("charizard", ["charizard-mega-x", "charizard-mega-y", "charizard-gmax"])),
		).toEqual([
			{ key: "charizard-mega-x", label: "Mega X" },
			{ key: "charizard-mega-y", label: "Mega Y" },
		]);
	});
});

describe("deriveRegionalForms", () => {
	function speciesWithVarieties(name: string, varietyNames: string[]): RawSpecies {
		return {
			name,
			varieties: [
				{ is_default: true, pokemon: { name, url: "" } },
				...varietyNames.map((n) => ({ is_default: false, pokemon: { name: n, url: "" } })),
			],
		} as unknown as RawSpecies;
	}

	it("returns empty for a species with no regional form", () => {
		expect(deriveRegionalForms(speciesWithVarieties("bulbasaur", []))).toEqual([]);
	});

	it("labels an Alolan variety", () => {
		expect(deriveRegionalForms(speciesWithVarieties("rattata", ["rattata-alola"]))).toEqual([
			{ key: "rattata-alola", suffix: "alola", label: "Alolan" },
		]);
	});

	// "raticate-totem-alola" ends with "-alola" but its real suffix (the
	// part after "raticate-") is "totem-alola", not "alola" — an
	// endsWith-based filter would wrongly include this SM trial-battle-only,
	// unplayable variant.
	it("excludes a Totem variant despite it ending in the same suffix string", () => {
		expect(deriveRegionalForms(speciesWithVarieties("raticate", ["raticate-alola", "raticate-totem-alola"]))).toEqual([
			{ key: "raticate-alola", suffix: "alola", label: "Alolan" },
		]);
	});
});

describe("resolveRegionalFormSuffix", () => {
	function pokemonNamed(name: string): RawPokemon {
		return { name } as unknown as RawPokemon;
	}
	function speciesNamed(name: string): RawSpecies {
		return { name } as unknown as RawSpecies;
	}

	it("returns undefined for a species' own default variety", () => {
		expect(resolveRegionalFormSuffix(pokemonNamed("rattata"), speciesNamed("rattata"))).toBeUndefined();
	});

	it("returns the suffix for a known regional variety", () => {
		expect(resolveRegionalFormSuffix(pokemonNamed("rattata-alola"), speciesNamed("rattata"))).toBe("alola");
	});

	it("returns undefined for a Mega variety (not a regional form)", () => {
		expect(resolveRegionalFormSuffix(pokemonNamed("charizard-mega-x"), speciesNamed("charizard"))).toBeUndefined();
	});
});
