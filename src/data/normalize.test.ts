import { describe, expect, it } from "vitest";
import {
	extractFlavorText,
	normalizeEvolutionChain,
	normalizeEvYield,
	normalizeMoves,
	normalizeStats,
	toEntry,
	toTableRow,
	trimMovesToVersionGroups,
} from "./normalize";
import type { RawEvolutionChain, RawPokemon, RawSpecies } from "./types";
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
		expect(levelUpMoves.map((m) => m.name)).toEqual(["tackle", "vine-whip"]);
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

describe("extractFlavorText", () => {
	it("prefers the first matching version in priority order", () => {
		expect(extractFlavorText(species)).toContain("without eating");
	});

	it("strips newline/formfeed characters", () => {
		expect(extractFlavorText(species)).not.toMatch(/[\n\f\r]/);
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
		const entry = toEntry(pokemon, species, node, { sprite: null, artwork: null, shiny: null });
		expect(entry.eggGroups).toEqual(["monster", "plant"]);
		expect(entry.hatchCounter).toBe(20);
		expect(entry.catchRate).toBe(45);
		expect(entry.evolutionChain?.children[0].name).toBe("ivysaur");
		expect(entry.moves.some((m) => m.name === "vine-whip")).toBe(true);
	});
});
