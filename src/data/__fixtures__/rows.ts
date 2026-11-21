import { resolveGenerationId } from "../constants";
import type { PokedexTableRow } from "../types";
import { type ActiveGenRow, scopeToActiveGen } from "../../utils/activeGenScope";

// The one place a PokedexTableRow literal is spelled out for tests, so a new
// required field is a single edit here (tsc fails the return type until it is
// added). A plain row models a default-variety Pokemon: id, dexNumber and
// generationId are always consistent. Use makeRegionalFormRow for the
// id !== dexNumber shape — never derive its generationId, the dex number's
// range is the wrong generation for every regional form.
export function makeRow(overrides: Partial<PokedexTableRow> = {}): PokedexTableRow {
	const id = overrides.id ?? 1;
	const dexNumber = overrides.dexNumber ?? id;
	return {
		id,
		dexNumber,
		formLabel: null,
		generationId: resolveGenerationId(dexNumber),
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

// A regional-form row (e.g. Alolan Rattata: id 10091, dexNumber 19, generationId
// 7): shares the base's dexNumber, but carries its own id, generation and label.
export function makeRegionalFormRow(
	base: PokedexTableRow,
	form: { id: number; generationId: number; formLabel: string; name?: string },
): PokedexTableRow {
	return { ...base, ...form, name: form.name ?? `${form.formLabel.toLowerCase()} ${base.name}` };
}

// A row as every layout, Field, filter and sort receives it: scoped to an
// Active Gen (activeGenScope.ts). Overrides are the unscoped row's, so a test
// states a row's every-generation data and the generation it is viewed at.
// The default, 9, overlays no stats and suits a test that ignores Active Gen.
export function makeActiveGenRow(overrides: Partial<PokedexTableRow> = {}, activeGen = 9): ActiveGenRow {
	return scopeToActiveGen(makeRow(overrides), activeGen);
}
