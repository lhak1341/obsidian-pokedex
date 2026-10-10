import { describe, expect, it } from "vitest";
import {
	ENCOUNTER_LOCATIONS,
	EVOLUTION_STAGES,
	FLAVOR_TEXT_TABS_BY_GEN,
	FOSSIL_IDS,
	GENERATIONS,
	IS_FINAL_EVOLUTION_STAGE,
	MOVE_VERSION_TABS_BY_GEN,
	REGIONAL_FORMS,
	STAT_OVERRIDES,
	VERSION_TO_GENERATION,
} from "./constants";

// Offline consistency between the hand-maintained generation-keyed tables in
// constants.ts (see the "Recipe: adding the next generation" in
// docs/multi-gen-expansion-plan.md). Checks the tables agree with GENERATIONS,
// not that the generated JSON is fresh against live PokeAPI — CI can't
// regenerate it. Several consumers fall back silently (`?? 0`, `?? false`,
// empty tab list), so a generation shipped without its tables would otherwise
// show wrong data instead of failing.

const GENERATION_IDS = new Set<number>(GENERATIONS.map((g) => g.id));
const lastDex = GENERATIONS[GENERATIONS.length - 1].end;

describe("GENERATIONS", () => {
	it("has contiguous, non-overlapping dex ranges starting at 1", () => {
		let expectedStart = 1;
		for (const gen of GENERATIONS) {
			expect(gen.start).toBe(expectedStart);
			expect(gen.end).toBeGreaterThanOrEqual(gen.start);
			expectedStart = gen.end + 1;
		}
	});
});

describe("per-generation move and flavor tabs", () => {
	// Gens 1-2 are absent on purpose: held-item/flavor/move data for them isn't
	// tracked by this app (see VERSION_TO_GENERATION in constants.ts).
	const tabbedGenerations = GENERATIONS.filter((g) => g.id >= 3);

	it("gives every generation >= 3 a non-empty move tab set", () => {
		for (const gen of tabbedGenerations) {
			expect(MOVE_VERSION_TABS_BY_GEN[gen.id]?.length ?? 0, `move tabs for gen ${gen.id}`).toBeGreaterThan(0);
		}
	});

	it("gives every generation >= 3 a non-empty flavor tab set", () => {
		for (const gen of tabbedGenerations) {
			expect(FLAVOR_TEXT_TABS_BY_GEN[gen.id]?.length ?? 0, `flavor tabs for gen ${gen.id}`).toBeGreaterThan(0);
		}
	});

	it("keys both tab tables only by real generations", () => {
		for (const key of [...Object.keys(MOVE_VERSION_TABS_BY_GEN), ...Object.keys(FLAVOR_TEXT_TABS_BY_GEN)]) {
			expect(GENERATION_IDS.has(Number(key)), `tab table key ${key}`).toBe(true);
		}
	});
});

describe("generated per-species arrays", () => {
	it("covers every dex number through the last generation", () => {
		expect(EVOLUTION_STAGES.length).toBe(lastDex + 1);
		expect(IS_FINAL_EVOLUTION_STAGE.length).toBe(lastDex + 1);
	});
});

describe("curated tables reference real generations", () => {
	it("keeps every FOSSIL_IDS id inside some generation's dex range", () => {
		for (const id of FOSSIL_IDS) {
			const inRange = GENERATIONS.some((g) => id >= g.start && id <= g.end);
			expect(inRange, `fossil id ${id}`).toBe(true);
		}
	});

	it("points every REGIONAL_FORMS entry at a real generation", () => {
		for (const [suffix, form] of Object.entries(REGIONAL_FORMS)) {
			expect(GENERATION_IDS.has(form.generationId), `regional form ${suffix}`).toBe(true);
		}
	});

	it("points every STAT_OVERRIDES entry at a real generation", () => {
		for (const [pokemonId, override] of Object.entries(STAT_OVERRIDES)) {
			expect(GENERATION_IDS.has(override.validThroughGen), `stat override for #${pokemonId}`).toBe(true);
		}
	});

	it("points every ENCOUNTER_LOCATIONS entry at a real generation", () => {
		for (const [name, locations] of Object.entries(ENCOUNTER_LOCATIONS)) {
			for (const location of locations) {
				expect(GENERATION_IDS.has(location.generationId), `encounter ${name}/${location.name}`).toBe(true);
			}
		}
	});

	it("points every VERSION_TO_GENERATION entry at a real generation", () => {
		for (const [version, generationId] of Object.entries(VERSION_TO_GENERATION)) {
			expect(GENERATION_IDS.has(generationId), `version ${version}`).toBe(true);
		}
	});
});
