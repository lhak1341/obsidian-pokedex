import { describe, expect, it } from "vitest";
import {
	collectChainIds,
	extractFlavorTexts,
	normalizeEvolutionChain,
	normalizeEvYield,
	normalizeMoveDetail,
	normalizeMoves,
	normalizeStats,
	toEntry,
	toTableRow,
	trimMovesToVersionGroups,
} from "./normalize";
import type { RawEvolutionChain, RawMove, RawPokemon, RawSpecies } from "./types";
import bulbasaurChain from "./__fixtures__/bulbasaur-evolution-chain.json";
import bulbasaurSpecies from "./__fixtures__/bulbasaur-species.json";
import bulbasaur from "./__fixtures__/bulbasaur.json";

const pokemon = bulbasaur as unknown as RawPokemon;
const species: RawSpecies = bulbasaurSpecies;
const chain = bulbasaurChain as unknown as RawEvolutionChain;

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
		expect(names).not.toContain("solar-beam"); // diamond-pearl only
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
		expect(trimmed.some((m) => m.move.name === "solar-beam")).toBe(false); // diamond-pearl only
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
		expect(extractFlavorTexts(species)).toEqual({ firered: expect.any(String) });
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
});

describe("collectChainIds", () => {
	it("flattens a linear chain into id order root-first", () => {
		const node = normalizeEvolutionChain(chain.chain);
		expect(collectChainIds(node)).toEqual([node.id, node.children[0].id, node.children[0].children[0].id]);
	});

	it("walks every branch of a forked chain (e.g. Eevee-shaped)", () => {
		const forked = {
			id: 1,
			name: "root",
			minLevel: null,
			trigger: null,
			item: null,
			children: [
				{ id: 2, name: "branch-a", minLevel: null, trigger: null, item: null, children: [] },
				{ id: 3, name: "branch-b", minLevel: null, trigger: null, item: null, children: [] },
			],
		};
		expect(collectChainIds(forked)).toEqual([1, 2, 3]);
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
		expect(row.types).toEqual(["grass", "poison"]);
		expect(row.abilityNames).toEqual(["overgrow", "chlorophyll"]);
		expect(row.height).toBe(7);
		expect(row.weight).toBe(69);
		expect(row.catchRate).toBe(45);
		expect(row.hatchCounter).toBe(20);
		expect(row.evYield).toEqual([{ stat: "specialAttack", amount: 1 }]);
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
		};
		expect(normalizeMoveDetail(raw)).toEqual({ type: "fire", power: 90, accuracy: 100, pp: 15 });
	});

	it("passes through null power/accuracy for status moves", () => {
		const raw: RawMove = {
			name: "swords-dance",
			power: null,
			accuracy: null,
			pp: 20,
			type: { name: "normal", url: "" },
		};
		expect(normalizeMoveDetail(raw)).toEqual({ type: "normal", power: null, accuracy: null, pp: 20 });
	});
});
