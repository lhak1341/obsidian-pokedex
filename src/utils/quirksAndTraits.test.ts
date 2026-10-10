import { describe, expect, it } from "vitest";
import type { PokedexTableRow } from "../data/types";
import { type FlagDef, QUIRKS, TRAITS } from "./quirksAndTraits";

function row(overrides: Partial<PokedexTableRow>): PokedexTableRow {
	const id = overrides.id ?? 1;
	return {
		id,
		dexNumber: id,
		formLabel: null,
		generationId: 1,
		name: "bulbasaur",
		types: ["grass", "poison"],
		stats: { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 },
		evYield: [],
		abilityNames: ["overgrow"],
		levelUpMoveNames: [],
		heldItemsAllGens: [],
		encounterLocationsAllGens: [],
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
		isFinalStage: false,
		...overrides,
	};
}

const GEN_3_ITEM = [{ name: "silver-powder", rarities: [{ value: 50, generationId: 3 }] }];

// One row that must match, and one that must not, per flag key. A key added to
// QUIRKS/TRAITS without an entry here fails the coverage test below, so a
// filter option can't ship with no test at all.
const FIXTURES: Record<string, { hit: PokedexTableRow; miss: PokedexTableRow }> = {
	"held-item": { hit: row({ heldItemsAllGens: GEN_3_ITEM }), miss: row({ heldItemsAllGens: [] }) },
	"compound-eyes": { hit: row({ abilityNames: ["compound-eyes"] }), miss: row({ abilityNames: ["overgrow"] }) },
	pickup: { hit: row({ abilityNames: ["pickup"] }), miss: row({ abilityNames: ["overgrow"] }) },
	thief: { hit: row({ levelUpMoveNames: ["thief"] }), miss: row({ levelUpMoveNames: ["covet"] }) },
	trick: { hit: row({ levelUpMoveNames: ["trick"] }), miss: row({ levelUpMoveNames: ["thief"] }) },
	covet: { hit: row({ levelUpMoveNames: ["covet"] }), miss: row({ levelUpMoveNames: ["trick"] }) },
	baby: { hit: row({ isBaby: true }), miss: row({ isBaby: false }) },
	fossil: { hit: row({ id: 138, dexNumber: 138 }), miss: row({ id: 1, dexNumber: 1 }) },
	mega: { hit: row({ canMegaEvolve: true }), miss: row({ canMegaEvolve: false }) },
	gigantamax: { hit: row({ canGigantamax: true }), miss: row({ canGigantamax: false }) },
	"no-evolution": { hit: row({ evolutionStages: 0 }), miss: row({ evolutionStages: 1 }) },
	"one-evolution": { hit: row({ evolutionStages: 1 }), miss: row({ evolutionStages: 2 }) },
	"two-plus-evolutions": { hit: row({ evolutionStages: 2 }), miss: row({ evolutionStages: 1 }) },
	"last-stage": { hit: row({ isFinalStage: true }), miss: row({ isFinalStage: false }) },
};

const ALL: readonly FlagDef[] = [...QUIRKS, ...TRAITS];

describe("QUIRKS and TRAITS", () => {
	it("has unique keys and a label and icon on every entry", () => {
		const keys = ALL.map((d) => d.key);
		expect(new Set(keys).size).toBe(keys.length);
		for (const def of ALL) {
			expect(def.label, def.key).not.toBe("");
			expect(def.icon, def.key).not.toBe("");
		}
	});

	it("has a fixture for every entry and no fixture for a removed one", () => {
		expect(Object.keys(FIXTURES).sort()).toEqual(ALL.map((d) => d.key).sort());
	});

	for (const def of ALL) {
		it(`${def.key}: matches its hit row and not its miss row`, () => {
			const fixture = FIXTURES[def.key];
			expect(def.matches(fixture.hit, { activeGen: 3 })).toBe(true);
			expect(def.matches(fixture.miss, { activeGen: 3 })).toBe(false);
		});
	}

	it("held-item only counts items from the Active Gen", () => {
		const held = QUIRKS.find((q) => q.key === "held-item");
		const row3 = row({ heldItemsAllGens: GEN_3_ITEM });
		expect(held?.matches(row3, { activeGen: 3 })).toBe(true);
		expect(held?.matches(row3, { activeGen: 4 })).toBe(false);
	});
});
