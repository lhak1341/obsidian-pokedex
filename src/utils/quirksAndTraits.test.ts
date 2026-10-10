import { describe, expect, it } from "vitest";
import type { PokedexTableRow } from "../data/types";
import { type FlagDef, QUIRKS, TRAITS } from "./quirksAndTraits";
import { makeRow } from "../data/__fixtures__/rows";

const GEN_3_ITEM = [{ name: "silver-powder", rarities: [{ value: 50, generationId: 3 }] }];

// One row that must match, and one that must not, per flag key. A key added to
// QUIRKS/TRAITS without an entry here fails the coverage test below, so a
// filter option can't ship with no test at all.
const FIXTURES: Record<string, { hit: PokedexTableRow; miss: PokedexTableRow }> = {
	"held-item": { hit: makeRow({ heldItemsAllGens: GEN_3_ITEM }), miss: makeRow({ heldItemsAllGens: [] }) },
	"compound-eyes": { hit: makeRow({ abilityNames: ["compound-eyes"] }), miss: makeRow({ abilityNames: ["overgrow"] }) },
	pickup: { hit: makeRow({ abilityNames: ["pickup"] }), miss: makeRow({ abilityNames: ["overgrow"] }) },
	thief: { hit: makeRow({ levelUpMoveNames: ["thief"] }), miss: makeRow({ levelUpMoveNames: ["covet"] }) },
	trick: { hit: makeRow({ levelUpMoveNames: ["trick"] }), miss: makeRow({ levelUpMoveNames: ["thief"] }) },
	covet: { hit: makeRow({ levelUpMoveNames: ["covet"] }), miss: makeRow({ levelUpMoveNames: ["trick"] }) },
	baby: { hit: makeRow({ isBaby: true }), miss: makeRow({ isBaby: false }) },
	fossil: { hit: makeRow({ id: 138, dexNumber: 138 }), miss: makeRow({ id: 1, dexNumber: 1 }) },
	mega: { hit: makeRow({ canMegaEvolve: true }), miss: makeRow({ canMegaEvolve: false }) },
	gigantamax: { hit: makeRow({ canGigantamax: true }), miss: makeRow({ canGigantamax: false }) },
	"no-evolution": { hit: makeRow({ evolutionStages: 0 }), miss: makeRow({ evolutionStages: 1 }) },
	"one-evolution": { hit: makeRow({ evolutionStages: 1 }), miss: makeRow({ evolutionStages: 2 }) },
	"two-plus-evolutions": { hit: makeRow({ evolutionStages: 2 }), miss: makeRow({ evolutionStages: 1 }) },
	"last-stage": { hit: makeRow({ isFinalStage: true }), miss: makeRow({ isFinalStage: false }) },
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
		const row3 = makeRow({ heldItemsAllGens: GEN_3_ITEM });
		expect(held?.matches(row3, { activeGen: 3 })).toBe(true);
		expect(held?.matches(row3, { activeGen: 4 })).toBe(false);
	});
});
