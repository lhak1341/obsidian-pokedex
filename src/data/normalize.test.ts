import { describe, expect, it } from "vitest";
import {
	collectChainIds,
	deriveGigantamaxForms,
	deriveMegaForms,
	deriveRegionalForms,
	describeEvolutionRequirement,
	evolutionFamilyDepth,
	extractFlavorTexts,
	inferAncestorFormSuffix,
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
		expect(normalizeMoves(pokemon.moves, ["the-teal-mask"])).toEqual([]);
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
			needs_overworld_rain: false, turn_upside_down: false, base_form: null, evolved_form: null, region: null, min_damage_taken: null,
			used_move: null, min_move_count: null, min_steps: null, needs_multiplayer: false,
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
		const node = normalizeEvolutionChain(meowthChain, {
			formSuffix: "alola",
			ownFormSuffix: "alola",
			rootId: 10107,
			speciesName: "meowth",
		});
		expect(node.id).toBe(10107);
		expect(node.children[0].minLevel).toBeNull();
		expect(node.children[0].minHappiness).toBe(160);
		expect(node.children[0].id).toBe(10108);
	});

	// Muk-shaped: the viewed regional variety is the *evolved* stage, not the
	// chain's structural root (unlike Meowth/Vulpix/Rattata) — Grimer only
	// turns out to be "Alolan" by seeing which entry leads to "muk-alola".
	const grimerChain: RawEvolutionChainLink = {
		species: { name: "grimer", url: "https://pokeapi.co/api/v2/pokemon-species/88/" },
		evolution_details: [],
		evolves_to: [
			{
				species: { name: "muk", url: "https://pokeapi.co/api/v2/pokemon-species/89/" },
				evolution_details: [
					evolutionDetail({ min_level: 38, trigger: { name: "level-up", url: "" } }),
					evolutionDetail({
						min_level: 38,
						trigger: { name: "level-up", url: "" },
						base_form: { name: "grimer-alola", url: "https://pokeapi.co/api/v2/pokemon/10123/" },
						evolved_form: { name: "muk-alola", url: "https://pokeapi.co/api/v2/pokemon/10124/" },
					}),
				],
				evolves_to: [],
			},
		],
	};

	it("resolves the ancestor's own variety when the viewed species is the evolved stage", () => {
		const node = normalizeEvolutionChain(grimerChain, {
			formSuffix: "alola",
			ownFormSuffix: "alola",
			rootId: 10124,
			speciesName: "muk",
		});
		expect(node.name).toBe("grimer");
		expect(node.id).toBe(10123);
		expect(node.formLabel).toBe("Alolan");
		expect(node.children[0].name).toBe("muk");
		expect(node.children[0].id).toBe(10124);
		expect(node.children[0].formLabel).toBe("Alolan");
	});

	// Exeggutor/Marowak-shaped: PokeAPI's evolution_details carry no
	// base_form/evolved_form distinction at all for these two, so the
	// ancestor's own variety can't be recovered — but the viewed (evolved)
	// node itself must still resolve correctly rather than defaulting.
	const exeggcuteChain: RawEvolutionChainLink = {
		species: { name: "exeggcute", url: "https://pokeapi.co/api/v2/pokemon-species/102/" },
		evolution_details: [],
		evolves_to: [
			{
				species: { name: "exeggutor", url: "https://pokeapi.co/api/v2/pokemon-species/103/" },
				evolution_details: [evolutionDetail({ item: { name: "leaf-stone", url: "" } })],
				evolves_to: [],
			},
		],
	};

	it("still resolves the viewed evolved node when PokeAPI can't disambiguate the ancestor", () => {
		const node = normalizeEvolutionChain(exeggcuteChain, {
			formSuffix: "alola",
			ownFormSuffix: "alola",
			rootId: 10121,
			speciesName: "exeggutor",
		});
		expect(node.name).toBe("exeggcute");
		expect(node.id).toBe(102);
		expect(node.formLabel).toBeNull();
		expect(node.children[0].name).toBe("exeggutor");
		expect(node.children[0].id).toBe(10121);
		expect(node.children[0].formLabel).toBe("Alolan");
	});

	// Yamask-shaped (Gen 8): TWO sibling children, not one node with two
	// entries — Cofagrigus (plain, no base_form entry at all) and Runerigus
	// (base_form "yamask-galar" only, plus min_damage_taken/take-damage) —
	// verified live against the real Yamask evolution-chain response.
	// Regular Yamask can only reach Cofagrigus; Galarian Yamask can only
	// reach Runerigus, never both, and never the wrong one via fallback.
	const yamaskChain: RawEvolutionChainLink = {
		species: { name: "yamask", url: "https://pokeapi.co/api/v2/pokemon-species/562/" },
		evolution_details: [],
		evolves_to: [
			{
				species: { name: "cofagrigus", url: "https://pokeapi.co/api/v2/pokemon-species/563/" },
				evolution_details: [evolutionDetail({ min_level: 34, trigger: { name: "level-up", url: "" } })],
				evolves_to: [],
			},
			{
				species: { name: "runerigus", url: "https://pokeapi.co/api/v2/pokemon-species/867/" },
				evolution_details: [
					evolutionDetail({
						min_damage_taken: 49,
						trigger: { name: "take-damage", url: "" },
						base_form: { name: "yamask-galar", url: "https://pokeapi.co/api/v2/pokemon/10179/" },
					}),
				],
				evolves_to: [],
			},
		],
	};

	// Qwilfish-hisui-shaped (Hisuian forms): a single child (Overqwil) whose
	// entries are ALL base_form "qwilfish-hisui" (no plain Qwilfish evolution
	// exists at all) with a use-move trigger carrying used_move/min_move_count
	// instead of any level/item condition — verified live against the real
	// /evolution-chain/106 response (three entries share the same base_form,
	// differing only by version_group; .find() picks the first, which happens
	// to be the legends-arceus/strong-style-move one — exactly the game this
	// Hisuian row represents).
	const qwilfishChain: RawEvolutionChainLink = {
		species: { name: "qwilfish", url: "https://pokeapi.co/api/v2/pokemon-species/211/" },
		evolution_details: [],
		evolves_to: [
			{
				species: { name: "overqwil", url: "https://pokeapi.co/api/v2/pokemon-species/904/" },
				evolution_details: [
					evolutionDetail({
						trigger: { name: "strong-style-move", url: "" },
						used_move: { name: "barb-barrage", url: "" },
						min_move_count: 20,
						base_form: { name: "qwilfish-hisui", url: "https://pokeapi.co/api/v2/pokemon/10234/" },
					}),
				],
				evolves_to: [],
			},
		],
	};

	it("normalizes a use-move evolution's used_move/min_move_count (Hisuian Qwilfish -> Overqwil)", () => {
		const node = normalizeEvolutionChain(qwilfishChain, {
			formSuffix: "hisui",
			ownFormSuffix: "hisui",
			rootId: 10234,
			speciesName: "qwilfish",
		});
		expect(node.children.map((c) => c.name)).toEqual(["overqwil"]);
		expect(node.children[0].usedMove).toBe("barb-barrage");
		expect(node.children[0].minMoveCount).toBe(20);
		expect(node.children[0].trigger).toBe("strong-style-move");
	});

	it("drops the sibling branch a dedicated regional entry doesn't own (Yamask viewed as base)", () => {
		const node = normalizeEvolutionChain(yamaskChain);
		expect(node.children.map((c) => c.name)).toEqual(["cofagrigus"]);
	});

	it("drops the sibling branch a dedicated regional entry doesn't own (Yamask viewed as Galarian)", () => {
		const node = normalizeEvolutionChain(yamaskChain, {
			formSuffix: "galar",
			ownFormSuffix: "galar",
			rootId: 10179,
			speciesName: "yamask",
		});
		expect(node.children.map((c) => c.name)).toEqual(["runerigus"]);
		expect(node.children[0].minDamageTaken).toBe(49);
		expect(node.children[0].trigger).toBe("take-damage");
	});

	// Corsola-shaped (Gen 8): a single child whose only entry is form-
	// exclusive (base_form "corsola-galar", no unconditional fallback entry
	// at all) — base Corsola never evolves in-game; the old details[0]
	// last-resort fallback used to incorrectly show Cursola here regardless.
	const corsolaChain: RawEvolutionChainLink = {
		species: { name: "corsola", url: "https://pokeapi.co/api/v2/pokemon-species/222/" },
		evolution_details: [],
		evolves_to: [
			{
				species: { name: "cursola", url: "https://pokeapi.co/api/v2/pokemon-species/864/" },
				evolution_details: [
					evolutionDetail({
						min_level: 38,
						trigger: { name: "level-up", url: "" },
						base_form: { name: "corsola-galar", url: "https://pokeapi.co/api/v2/pokemon/10173/" },
					}),
				],
				evolves_to: [],
			},
		],
	};

	it("drops a child whose only entry requires a form we're not viewing, instead of falling back to it", () => {
		const node = normalizeEvolutionChain(corsolaChain);
		expect(node.children).toEqual([]);
	});

	it("keeps the child when viewing the exact form its entry requires", () => {
		const node = normalizeEvolutionChain(corsolaChain, {
			formSuffix: "galar",
			ownFormSuffix: "galar",
			rootId: 10173,
			speciesName: "corsola",
		});
		expect(node.children.map((c) => c.name)).toEqual(["cursola"]);
	});

	// Mime-Jr-shaped (Gen 8): Mime Jr. itself has no Galarian variety, so
	// neither entry has a base_form — the two entries are disambiguated only
	// by `region` (verified live: both require known_move Mimic, only the
	// Galarian one also carries region: "galar"). The ancestor (Mime Jr.)
	// can't infer its own regional-ness from this (there isn't one), but the
	// viewed child must still resolve to the correct variety.
	const mimeJrChain: RawEvolutionChainLink = {
		species: { name: "mime-jr", url: "https://pokeapi.co/api/v2/pokemon-species/439/" },
		evolution_details: [],
		evolves_to: [
			{
				species: { name: "mr-mime", url: "https://pokeapi.co/api/v2/pokemon-species/122/" },
				evolution_details: [
					evolutionDetail({ known_move: { name: "mimic", url: "" }, trigger: { name: "level-up", url: "" } }),
					evolutionDetail({
						known_move: { name: "mimic", url: "" },
						trigger: { name: "level-up", url: "" },
						region: { name: "galar", url: "" },
						evolved_form: { name: "mr-mime-galar", url: "https://pokeapi.co/api/v2/pokemon/10168/" },
					}),
				],
				// Only reachable from Galarian Mr. Mime (base_form-gated) —
				// verified live: Kanto Mr. Mime never evolves further.
				evolves_to: [
					{
						species: { name: "mr-rime", url: "https://pokeapi.co/api/v2/pokemon-species/866/" },
						evolution_details: [
							evolutionDetail({
								min_level: 42,
								trigger: { name: "level-up", url: "" },
								base_form: { name: "mr-mime-galar", url: "https://pokeapi.co/api/v2/pokemon/10168/" },
							}),
						],
						evolves_to: [],
					},
				],
			},
		],
	};

	it("disambiguates a region-only (no base_form) entry by its region field", () => {
		const node = normalizeEvolutionChain(mimeJrChain, {
			formSuffix: "galar",
			ownFormSuffix: "galar",
			rootId: 10168,
			speciesName: "mr-mime",
		});
		expect(node.name).toBe("mime-jr");
		expect(node.formLabel).toBeNull(); // Mime Jr. has no Galarian variety of its own
		expect(node.children[0].name).toBe("mr-mime");
		expect(node.children[0].id).toBe(10168);
		expect(node.children[0].formLabel).toBe("Galarian");
		expect(node.children[0].children[0].name).toBe("mr-rime");
		expect(node.children[0].children[0].id).toBe(866);
	});

	// A true default view (no context at all) of a Mime-Jr-shaped bucket used
	// to pick only the unconditional (Kanto) entry and silently drop the
	// region-gated one — hiding that Mime Jr. can ever reach Mr. Rime at all,
	// since the Kanto path is a dead end. Unlike Zigzagoon/Corsola/Yamask
	// (where the PARENT itself has a variety to scope the default view by),
	// Mime Jr. has no variety of its own on either entry, so there's nothing
	// to scope by — both outcomes are shown as sibling branches instead.
	it("shows every region-gated outcome as a sibling when the parent itself has no variety to scope by", () => {
		const node = normalizeEvolutionChain(mimeJrChain);
		expect(node.name).toBe("mime-jr");
		expect(node.children.map((c) => c.name)).toEqual(["mr-mime", "mr-mime"]);
		expect(node.children.map((c) => c.id)).toEqual([122, 10168]);
		expect(node.children[0].formLabel).toBeNull(); // Kanto: dead end, no further children
		expect(node.children[0].children).toEqual([]);
		expect(node.children[1].formLabel).toBe("Galarian");
		expect(node.children[1].children[0].name).toBe("mr-rime"); // reachable via Galar branch
		expect(node.children[1].children[0].id).toBe(866);
	});

	// Obstagoon-shaped (Gen 8, verified live): Obstagoon (#862) has no
	// suffixed name of its own (pokemon.name === species.name, so
	// resolveRegionalFormSuffix returns undefined for it) but is only
	// reachable via Linoone-Galar, never plain Linoone — two evolution steps
	// deep, both requiring the same "galar" base_form. Viewing Obstagoon's
	// own page passes no ownFormSuffix (it isn't a variety), only a
	// formSuffix inferred by inferAncestorFormSuffix from the raw chain.
	const zigzagoonChain: RawEvolutionChainLink = {
		species: { name: "zigzagoon", url: "https://pokeapi.co/api/v2/pokemon-species/263/" },
		evolution_details: [],
		evolves_to: [
			{
				species: { name: "linoone", url: "https://pokeapi.co/api/v2/pokemon-species/264/" },
				evolution_details: [
					evolutionDetail({ min_level: 20, trigger: { name: "level-up", url: "" } }),
					evolutionDetail({
						min_level: 20,
						trigger: { name: "level-up", url: "" },
						base_form: { name: "zigzagoon-galar", url: "https://pokeapi.co/api/v2/pokemon/10174/" },
						evolved_form: { name: "linoone-galar", url: "https://pokeapi.co/api/v2/pokemon/10175/" },
					}),
				],
				evolves_to: [
					{
						species: { name: "obstagoon", url: "https://pokeapi.co/api/v2/pokemon-species/862/" },
						evolution_details: [
							evolutionDetail({
								min_level: 35,
								time_of_day: "night",
								trigger: { name: "level-up", url: "" },
								base_form: { name: "linoone-galar", url: "https://pokeapi.co/api/v2/pokemon/10175/" },
							}),
						],
						evolves_to: [],
					},
				],
			},
		],
	};

	it("infers the ancestor suffix required to reach a non-suffixed, variant-exclusive species", () => {
		expect(inferAncestorFormSuffix(zigzagoonChain, "obstagoon")).toBe("galar");
		expect(inferAncestorFormSuffix(zigzagoonChain, "linoone")).toBeUndefined(); // reachable unconditionally
		expect(inferAncestorFormSuffix(zigzagoonChain, "nonexistent")).toBeUndefined();
	});

	it("walks the Galar branch to reach Obstagoon even though Obstagoon itself carries no suffix", () => {
		const pathSuffix = inferAncestorFormSuffix(zigzagoonChain, "obstagoon");
		const node = normalizeEvolutionChain(zigzagoonChain, {
			formSuffix: pathSuffix!,
			rootId: 862,
			speciesName: "obstagoon",
		});
		expect(node.name).toBe("zigzagoon");
		expect(node.id).toBe(10174); // Zigzagoon-Galar, not plain Zigzagoon (263)
		expect(node.formLabel).toBe("Galarian");
		expect(node.children[0].name).toBe("linoone");
		expect(node.children[0].id).toBe(10175); // Linoone-Galar, not plain Linoone (264)
		expect(node.children[0].formLabel).toBe("Galarian");
		expect(node.children[0].children[0].name).toBe("obstagoon");
		expect(node.children[0].children[0].id).toBe(862);
		expect(node.children[0].children[0].formLabel).toBeNull(); // Obstagoon isn't itself a variety
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
			region: null,
			minDamageTaken: null, usedMove: null, minMoveCount: null, minSteps: null, needsMultiplayer: false,
			children: [
				{ id: 2, dexNumber: 2, formLabel: null, name: "branch-a", minLevel: null, trigger: null, item: null, minHappiness: null, timeOfDay: null, heldItem: null, minBeauty: null, relativePhysicalStats: null, location: null, knownMove: null, partySpecies: null, gender: null, tradeSpecies: null, needsOverworldRain: false, turnUpsideDown: false, region: null, minDamageTaken: null, usedMove: null, minMoveCount: null, minSteps: null, needsMultiplayer: false, children: [] },
				{ id: 3, dexNumber: 3, formLabel: null, name: "branch-b", minLevel: null, trigger: null, item: null, minHappiness: null, timeOfDay: null, heldItem: null, minBeauty: null, relativePhysicalStats: null, location: null, knownMove: null, partySpecies: null, gender: null, tradeSpecies: null, needsOverworldRain: false, turnUpsideDown: false, region: null, minDamageTaken: null, usedMove: null, minMoveCount: null, minSteps: null, needsMultiplayer: false, children: [] },
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
			region: null,
			minDamageTaken: null, usedMove: null, minMoveCount: null, minSteps: null, needsMultiplayer: false,
			children: [{ id: 2, dexNumber: 2, formLabel: null, name: "evolved", minLevel: null, trigger: "trade", item: null, minHappiness: null, timeOfDay: null, heldItem: null, minBeauty: null, relativePhysicalStats: null, location: null, knownMove: null, partySpecies: null, gender: null, tradeSpecies: null, needsOverworldRain: false, turnUpsideDown: false, region: null, minDamageTaken: null, usedMove: null, minMoveCount: null, minSteps: null, needsMultiplayer: false, children: [] }],
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
			region: null,
			minDamageTaken: null, usedMove: null, minMoveCount: null, minSteps: null, needsMultiplayer: false,
			children: [
				{ id: 2, dexNumber: 2, formLabel: null, name: "branch-a", minLevel: 20, trigger: "level-up", item: null, minHappiness: null, timeOfDay: null, heldItem: null, minBeauty: null, relativePhysicalStats: null, location: null, knownMove: null, partySpecies: null, gender: null, tradeSpecies: null, needsOverworldRain: false, turnUpsideDown: false, region: null, minDamageTaken: null, usedMove: null, minMoveCount: null, minSteps: null, needsMultiplayer: false, children: [] },
				{ id: 3, dexNumber: 3, formLabel: null, name: "branch-b", minLevel: 10, trigger: "level-up", item: null, minHappiness: null, timeOfDay: null, heldItem: null, minBeauty: null, relativePhysicalStats: null, location: null, knownMove: null, partySpecies: null, gender: null, tradeSpecies: null, needsOverworldRain: false, turnUpsideDown: false, region: null, minDamageTaken: null, usedMove: null, minMoveCount: null, minSteps: null, needsMultiplayer: false, children: [] },
				{ id: 4, dexNumber: 4, formLabel: null, name: "branch-c", minLevel: 20, trigger: "level-up", item: null, minHappiness: null, timeOfDay: null, heldItem: null, minBeauty: null, relativePhysicalStats: null, location: null, knownMove: null, partySpecies: null, gender: null, tradeSpecies: null, needsOverworldRain: false, turnUpsideDown: false, region: null, minDamageTaken: null, usedMove: null, minMoveCount: null, minSteps: null, needsMultiplayer: false, children: [] },
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
			region: null,
			minDamageTaken: null, usedMove: null, minMoveCount: null, minSteps: null, needsMultiplayer: false,
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

	it("labels a take-damage evolution with its threshold (e.g. Runerigus)", () => {
		expect(
			describeEvolutionRequirement(node({ minDamageTaken: 49, usedMove: null, minMoveCount: null, trigger: "take-damage" })),
		).toBe("Take 49+ dmg");
	});

	it("labels a use-move evolution with the move and count (e.g. Hisuian Qwilfish -> Overqwil)", () => {
		expect(
			describeEvolutionRequirement(
				node({ usedMove: "barb-barrage", minMoveCount: 20, trigger: "strong-style-move" }),
			),
		).toBe("barb barrage x20");
	});

	it("appends a region suffix to a base label (e.g. Mime Jr. -> Galarian Mr. Mime)", () => {
		expect(
			describeEvolutionRequirement(node({ knownMove: "mimic", trigger: "level-up", region: "galar" })),
		).toBe("Knows mimic (in Galar)");
	});

	it("returns a bare region label when no base label matched", () => {
		expect(describeEvolutionRequirement(node({ trigger: "level-up", region: "galar" }))).toBe("In Galar");
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
		expect(row.isBaby).toBe(false);
		expect(row.canMegaEvolve).toBe(false);
		expect(row.canGigantamax).toBe(false);
	});

	it("reads isBaby straight off species.is_baby", () => {
		const babySpecies: RawSpecies = { ...species, is_baby: true };
		expect(toTableRow(pokemon, babySpecies, null).isBaby).toBe(true);
	});

	it("derives canMegaEvolve/canGigantamax from species.varieties", () => {
		// "venusaur", not the bulbasaur fixture's own name — canMegaEvolve is
		// checked against the curated real-Mega allowlist (see
		// MEGA_VARIETY_KEYS), and Bulbasaur itself never Mega Evolves in any
		// game, only its final evolution does.
		const megaGmaxSpecies: RawSpecies = {
			...species,
			name: "venusaur",
			varieties: [
				{ is_default: true, pokemon: { name: "venusaur", url: "" } },
				{ is_default: false, pokemon: { name: "venusaur-mega", url: "" } },
				{ is_default: false, pokemon: { name: "venusaur-gmax", url: "" } },
			],
		};
		const megaGmaxPokemon: RawPokemon = { ...pokemon, name: "venusaur" };
		const row = toTableRow(megaGmaxPokemon, megaGmaxSpecies, null);
		expect(row.canMegaEvolve).toBe(true);
		expect(row.canGigantamax).toBe(true);
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
		// From the static EVOLUTION_STAGES lookup (species.id 1 = bulbasaur),
		// not derived from the `node` passed in above.
		expect(entry.evolutionStages).toBe(2);
	});
});

describe("evolutionFamilyDepth", () => {
	// Operates on the RAW chain link (RawEvolutionChainLink), not a
	// normalized EvolutionNode — see the function's own comment for why.
	it("returns 0 for a species that never evolves", () => {
		const solo = chain.chain.evolves_to[0].evolves_to[0]; // venusaur, final stage
		expect(evolutionFamilyDepth(solo)).toBe(0);
	});

	it("returns the longest path in edges, not the species count", () => {
		// bulbasaur -> ivysaur -> venusaur: 2 evolution events.
		expect(evolutionFamilyDepth(chain.chain)).toBe(2);
	});

	it("ignores branching width — depth comes from the deepest branch, not the branch count", () => {
		const forked: RawEvolutionChainLink = {
			...chain.chain,
			// Give bulbasaur (the root) 3 same-depth children instead of 1 —
			// depth should still read 2 (bulbasaur -> child -> venusaur's own
			// child), not 4 just because there are more branches at the same
			// level.
			evolves_to: [chain.chain.evolves_to[0], chain.chain.evolves_to[0], chain.chain.evolves_to[0]],
		};
		expect(evolutionFamilyDepth(forked)).toBe(2);
	});

	it("counts a branch gated entirely on a specific regional form, unlike buildEvolutionNode's default view", () => {
		// Farfetch'd-shaped: the only evolves_to child requires a base_form the
		// default (no-context) EvolutionNode view would drop entirely (see
		// buildEvolutionNode's own comment on dropping form-exclusive
		// branches) — evolutionFamilyDepth must still count it, since it reads
		// evolves_to directly rather than going through that view-selection
		// logic at all.
		const gatedOnly: RawEvolutionChainLink = {
			species: { name: "farfetchd", url: "" },
			evolution_details: [],
			evolves_to: [
				{
					species: { name: "sirfetchd", url: "" },
					evolution_details: [
						{
							min_level: null, trigger: { name: "three-critical-hits", url: "" }, item: null,
							min_happiness: null, time_of_day: "", held_item: null, min_beauty: null,
							relative_physical_stats: null, location: null, known_move: null, party_species: null,
							gender: null, trade_species: null, needs_overworld_rain: false, turn_upside_down: false,
							base_form: { name: "farfetchd-galar", url: "" }, evolved_form: null, region: null,
							min_damage_taken: null, used_move: null, min_move_count: null, min_steps: null,
							needs_multiplayer: false,
						},
					],
					evolves_to: [],
				},
			],
		};
		expect(evolutionFamilyDepth(gatedOnly)).toBe(1);
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
				{ flavor_text: "A physical attack.", language: { name: "en", url: "" }, version_group: { name: "legends-za", url: "" } },
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
	function pokemonNamed(name: string): RawPokemon {
		return { name } as unknown as RawPokemon;
	}

	it("returns empty for a species with no Mega variety", () => {
		expect(deriveMegaForms(pokemonNamed("bulbasaur"), speciesWithVarieties("bulbasaur", []))).toEqual([]);
	});

	it("labels a single Mega variety as just 'Mega'", () => {
		const species = speciesWithVarieties("gengar", ["gengar-mega", "gengar-gmax"]);
		expect(deriveMegaForms(pokemonNamed("gengar"), species)).toEqual([{ key: "gengar-mega", label: "Mega" }]);
	});

	it("labels an X/Y-split Mega pair and excludes Gigantamax", () => {
		const species = speciesWithVarieties("charizard", ["charizard-mega-x", "charizard-mega-y", "charizard-gmax"]);
		expect(deriveMegaForms(pokemonNamed("charizard"), species)).toEqual([
			{ key: "charizard-mega-x", label: "Mega X" },
			{ key: "charizard-mega-y", label: "Mega Y" },
		]);
	});

	// PokeAPI hosts non-canon/fan "-mega" varieties alongside the 48 real
	// Gen 6-7 ones (verified live: "raichu-mega-x" is a real, resolvable
	// PokeAPI resource, but Raichu never had an official Mega Evolution in
	// any game) — a naming-pattern-only match would wrongly surface these.
	it("excludes a naming-pattern match that isn't a real, curated Mega Evolution", () => {
		const species = speciesWithVarieties("raichu", ["raichu-alola", "raichu-mega-x", "raichu-mega-y"]);
		expect(deriveMegaForms(pokemonNamed("raichu"), species)).toEqual([]);
	});

	// Slowbro-shaped (real bug, caught live): Slowbro and Galarian Slowbro
	// share one `species` record, but only Kantonian Slowbro can actually
	// Mega Evolve in-game — viewing the regional-form row must not inherit
	// the base row's Mega Evolution just because they share `species`.
	it("returns empty when the viewed variety isn't the species' own default/base one", () => {
		const species = speciesWithVarieties("slowbro", ["slowbro-mega", "slowbro-galar"]);
		expect(deriveMegaForms(pokemonNamed("slowbro-galar"), species)).toEqual([]);
	});
});

describe("deriveGigantamaxForms", () => {
	function speciesWithVarieties(name: string, varietyNames: string[]): RawSpecies {
		return {
			name,
			varieties: [
				{ is_default: true, pokemon: { name, url: "" } },
				...varietyNames.map((n) => ({ is_default: false, pokemon: { name: n, url: "" } })),
			],
		} as unknown as RawSpecies;
	}
	function pokemonNamed(name: string): RawPokemon {
		return { name } as unknown as RawPokemon;
	}

	it("returns empty for a species with no Gigantamax variety", () => {
		expect(deriveGigantamaxForms(pokemonNamed("bulbasaur"), speciesWithVarieties("bulbasaur", []))).toEqual([]);
	});

	it("labels a species' own Gigantamax variety and excludes Mega", () => {
		expect(
			deriveGigantamaxForms(
				pokemonNamed("gengar"),
				speciesWithVarieties("gengar", ["gengar-mega", "gengar-gmax"]),
			),
		).toEqual([{ key: "gengar-gmax", label: "Gigantamax" }]);
	});

	// Toxtricity-shaped: the Gigantamax variety name is prefixed by the
	// VIEWED variety's own name ("toxtricity-amped-gmax"), not the bare
	// species name ("toxtricity-gmax", which doesn't exist) — verified live.
	// Only the variety actually being viewed should ever match.
	it("matches against the viewed variety's own name, not the bare species name", () => {
		const species = speciesWithVarieties("toxtricity", [
			"toxtricity-low-key",
			"toxtricity-amped-gmax",
			"toxtricity-low-key-gmax",
		]);
		expect(deriveGigantamaxForms(pokemonNamed("toxtricity-amped"), species)).toEqual([
			{ key: "toxtricity-amped-gmax", label: "Gigantamax" },
		]);
		expect(deriveGigantamaxForms(pokemonNamed("toxtricity-low-key"), species)).toEqual([
			{ key: "toxtricity-low-key-gmax", label: "Gigantamax" },
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
