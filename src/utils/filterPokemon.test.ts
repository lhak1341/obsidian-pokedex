import { describe, expect, it } from "vitest";
import { resolveGenerationId } from "../data/constants";
import type { PokedexTableRow } from "../data/types";
import { EMPTY_FILTERS, filterPokemon } from "./filterPokemon";

// dexNumber/generationId default to matching `id` (overridable, but derived
// from it when not explicit) since every row here models a plain
// default-variety Pokemon, where those three are always equal/consistent —
// no fixture here exercises a regional-form row's id !== dexNumber split.
function row(overrides: Partial<PokedexTableRow>): PokedexTableRow {
	const id = overrides.id ?? 1;
	return {
		id,
		dexNumber: id,
		formLabel: null,
		generationId: resolveGenerationId(id),
		name: "bulbasaur",
		types: ["grass", "poison"],
		stats: { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 },
		evYield: [],
		abilityNames: ["overgrow", "chlorophyll"],
		levelUpMoveNames: [],
		heldItemNames: [],
		spriteDataUri: null,
		height: 7,
		weight: 69,
		catchRate: 45,
		hatchCounter: 20,
		rarity: "normal",
		isBaby: false,
		canMegaEvolve: false,
		canGigantamax: false,
		evolutionStages: 0,
		...overrides,
	};
}

const rows: PokedexTableRow[] = [
	row({ id: 1, name: "bulbasaur", types: ["grass", "poison"], abilityNames: ["overgrow"] }),
	row({ id: 4, name: "charmander", types: ["fire"], abilityNames: ["blaze"], stats: { hp: 39, attack: 52, defense: 43, specialAttack: 60, specialDefense: 50, speed: 65 } }),
	row({ id: 6, name: "charizard", types: ["fire", "flying"], abilityNames: ["blaze"], stats: { hp: 78, attack: 84, defense: 78, specialAttack: 109, specialDefense: 85, speed: 100 } }),
	row({ id: 152, name: "chikorita", types: ["grass"], abilityNames: ["overgrow"] }),
	row({ id: 144, name: "articuno", types: ["ice", "flying"], abilityNames: ["pressure"], rarity: "legendary" }),
	row({ id: 151, name: "mew", types: ["psychic"], abilityNames: ["synchronize"], rarity: "mythical" }),
];

describe("filterPokemon", () => {
	it("returns all rows when filters are empty", () => {
		expect(filterPokemon(rows, EMPTY_FILTERS)).toHaveLength(6);
	});

	it("matches search by name substring", () => {
		const result = filterPokemon(rows, { ...EMPTY_FILTERS, search: "char" });
		expect(result.map((r) => r.name)).toEqual(["charmander", "charizard"]);
	});

	it("matches search by exact dex number", () => {
		const result = filterPokemon(rows, { ...EMPTY_FILTERS, search: "6" });
		expect(result.map((r) => r.name)).toEqual(["charizard"]);
	});

	it("requires ALL selected types to be present (dual-type search)", () => {
		const result = filterPokemon(rows, { ...EMPTY_FILTERS, types: ["fire", "flying"] });
		expect(result.map((r) => r.name)).toEqual(["charizard"]);
	});

	it("filters by generation range", () => {
		const result = filterPokemon(rows, { ...EMPTY_FILTERS, generations: [2] });
		expect(result.map((r) => r.name)).toEqual(["chikorita"]);
	});

	it("filters by inclusive stat range", () => {
		const result = filterPokemon(rows, {
			...EMPTY_FILTERS,
			statRanges: { speed: { min: 90, max: 255 } },
		});
		expect(result.map((r) => r.name)).toEqual(["charizard"]);
	});

	it("matches ANY selected ability", () => {
		const result = filterPokemon(rows, { ...EMPTY_FILTERS, abilities: ["blaze"] });
		expect(result.map((r) => r.name)).toEqual(["charmander", "charizard"]);
	});

	it("matches ANY selected rarity", () => {
		const result = filterPokemon(rows, { ...EMPTY_FILTERS, rarities: ["legendary", "mythical"] });
		expect(result.map((r) => r.name)).toEqual(["articuno", "mew"]);
	});

	it("matches ANY selected EV yield stat, regardless of amount or co-yielded stats", () => {
		const evRows: PokedexTableRow[] = [
			row({ id: 1, name: "bulbasaur", evYield: [{ stat: "specialAttack", amount: 1 }] }),
			row({ id: 2, name: "ivysaur", evYield: [{ stat: "specialAttack", amount: 1 }, { stat: "specialDefense", amount: 1 }] }),
			row({ id: 4, name: "charmander", evYield: [{ stat: "speed", amount: 1 }] }),
			row({ id: 7, name: "squirtle", evYield: [] }),
		];

		const result = filterPokemon(evRows, { ...EMPTY_FILTERS, evStats: ["specialAttack"] });

		expect(result.map((r) => r.name)).toEqual(["bulbasaur", "ivysaur"]);
	});

	it("matches ANY selected quirk, across held-item/ability/move-based checks alike", () => {
		const quirkRows: PokedexTableRow[] = [
			row({ id: 1, name: "bulbasaur", abilityNames: ["overgrow"] }),
			row({ id: 190, name: "aipom", abilityNames: ["pickup"] }),
			row({ id: 302, name: "sableye", levelUpMoveNames: ["covet"] }),
			row({ id: 12, name: "butterfree", heldItemNames: ["silver-powder"] }),
			row({ id: 7, name: "squirtle", abilityNames: ["torrent"], levelUpMoveNames: [] }),
		];

		const result = filterPokemon(quirkRows, { ...EMPTY_FILTERS, quirks: ["pickup", "covet", "held-item"] });

		expect(result.map((r) => r.name)).toEqual(["aipom", "sableye", "butterfree"]);
	});

	it("matches ALL selected traits (AND semantics), across id/boolean checks alike", () => {
		const traitRows: PokedexTableRow[] = [
			row({ id: 138, name: "omanyte" }), // fossil only
			row({ id: 1, name: "bulbasaur", isBaby: true, canMegaEvolve: true }), // baby + mega
			row({ id: 4, name: "charmander", isBaby: true }), // baby only (no mega)
			row({ id: 6, name: "charizard", canMegaEvolve: true, canGigantamax: true }),
		];

		expect(
			filterPokemon(traitRows, { ...EMPTY_FILTERS, traits: ["fossil"] }).map((r) => r.name),
		).toEqual(["omanyte"]);
		expect(
			filterPokemon(traitRows, { ...EMPTY_FILTERS, traits: ["baby", "mega"] }).map((r) => r.name),
		).toEqual(["bulbasaur"]);
		expect(
			filterPokemon(traitRows, { ...EMPTY_FILTERS, traits: ["mega", "gigantamax"] }).map((r) => r.name),
		).toEqual(["charizard"]);
	});

	it("buckets the no-evolution/one-evolution/two-plus-evolutions traits off evolutionStages, ANDed like any other trait", () => {
		const stageRows: PokedexTableRow[] = [
			row({ id: 128, name: "tauros", evolutionStages: 0 }),
			row({ id: 172, name: "pichu", evolutionStages: 1, isBaby: true }),
			row({ id: 25, name: "pikachu", evolutionStages: 1 }),
			row({ id: 1, name: "bulbasaur", evolutionStages: 2 }),
		];

		expect(
			filterPokemon(stageRows, { ...EMPTY_FILTERS, traits: ["no-evolution"] }).map((r) => r.name),
		).toEqual(["tauros"]);
		expect(
			filterPokemon(stageRows, { ...EMPTY_FILTERS, traits: ["two-plus-evolutions"] }).map((r) => r.name),
		).toEqual(["bulbasaur"]);
		// AND semantics composes meaningfully with an unrelated trait...
		expect(
			filterPokemon(stageRows, { ...EMPTY_FILTERS, traits: ["one-evolution", "baby"] }).map((r) => r.name),
		).toEqual(["pichu"]);
		// ...but two evolution-stage buckets together are mutually exclusive per
		// row, same as any other non-overlapping Traits combo — not a bug, just
		// an always-empty query.
		expect(
			filterPokemon(stageRows, { ...EMPTY_FILTERS, traits: ["no-evolution", "one-evolution"] }).map((r) => r.name),
		).toEqual([]);
	});

	it("combines multiple filter axes with AND", () => {
		const result = filterPokemon(rows, {
			...EMPTY_FILTERS,
			types: ["fire"],
			statRanges: { hp: { min: 50, max: 255 } },
		});
		expect(result.map((r) => r.name)).toEqual(["charizard"]);
	});

	describe("regional-form rows", () => {
		const regionalRows: PokedexTableRow[] = [
			row({ id: 19, dexNumber: 19, formLabel: null, generationId: 1, name: "rattata" }),
			row({ id: 10091, dexNumber: 19, formLabel: "Alolan", generationId: 7, name: "rattata", types: ["dark", "normal"] }),
		];

		it("search by exact dex number matches every form sharing it", () => {
			const result = filterPokemon(regionalRows, { ...EMPTY_FILTERS, search: "19" });
			expect(result.map((r) => r.id)).toEqual([19, 10091]);
		});

		it("search by form label matches only the regional-form row", () => {
			const result = filterPokemon(regionalRows, { ...EMPTY_FILTERS, search: "alolan" });
			expect(result.map((r) => r.id)).toEqual([10091]);
		});

		it("generation filter hides a regional-form row by its OWN generation, not its dex number's", () => {
			// Gen 1 enabled, Gen 7 not — base Rattata (dex #019, a Gen 1 number)
			// stays visible; Alolan Rattata (also dex #019, but a Gen 7 form)
			// does not, since its generationId (7) isn't in the enabled list.
			const result = filterPokemon(regionalRows, { ...EMPTY_FILTERS, generations: [1] });
			expect(result.map((r) => r.id)).toEqual([19]);
		});

		it("generation filter shows the regional-form row once its own generation is enabled", () => {
			const result = filterPokemon(regionalRows, { ...EMPTY_FILTERS, generations: [7] });
			expect(result.map((r) => r.id)).toEqual([10091]);
		});
	});
});
