import { describe, expect, it } from "vitest";
import type { PokedexTableRow } from "../data/types";
import { makeRow } from "../data/__fixtures__/rows";
import { filterPokemon, EMPTY_FILTERS } from "./filterPokemon";
import { sortPokemon } from "./sortPokemon";
import { TOGGLEABLE_COLUMNS } from "./tableColumns";
import { resolveStatsForGen, scopeRowsToGen, totalStat } from "./stats";

describe("totalStat", () => {
	it("sums all six base stats", () => {
		expect(totalStat({ hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 })).toBe(318);
	});
});

describe("resolveStatsForGen", () => {
	// Butterfree (#12): current specialAttack 90, pre-Gen 6 was 80.
	const butterfreeCurrent = { hp: 60, attack: 45, defense: 50, specialAttack: 90, specialDefense: 80, speed: 70 };

	it("overlays the pre-buff value when the active gen predates the buff", () => {
		expect(resolveStatsForGen(butterfreeCurrent, 12, 3)).toEqual({ ...butterfreeCurrent, specialAttack: 80 });
	});

	it("returns current stats unchanged once the active gen reaches the buff generation", () => {
		expect(resolveStatsForGen(butterfreeCurrent, 12, 6)).toEqual(butterfreeCurrent);
	});

	it("returns current stats unchanged for a species with no override entry", () => {
		const bulbasaurCurrent = { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 };
		expect(resolveStatsForGen(bulbasaurCurrent, 1, 3)).toEqual(bulbasaurCurrent);
	});
});

describe("scopeRowsToGen", () => {
	// Pikachu (#25): current defense 40 / specialDefense 50, pre-Gen 6 was 30 / 40.
	const pikachu = makeRow({
		id: 25,
		name: "pikachu",
		stats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
	});
	const bulbasaur = makeRow({
		id: 1,
		name: "bulbasaur",
		stats: { hp: 45, attack: 49, defense: 35, specialAttack: 65, specialDefense: 65, speed: 45 },
	});
	const rows = [pikachu, bulbasaur];

	it("overlays pre-buff stats on affected rows when the active gen predates the buff", () => {
		const [scoped] = scopeRowsToGen(rows, 3);
		expect(scoped.stats.defense).toBe(30);
		expect(scoped.stats.specialDefense).toBe(40);
	});

	it("leaves every row untouched once the active gen reaches the buff generation", () => {
		const scoped = scopeRowsToGen(rows, 6);
		expect(scoped[0]).toBe(pikachu);
		expect(scoped[1]).toBe(bulbasaur);
	});

	it("returns the same row object for a species with no override", () => {
		expect(scopeRowsToGen(rows, 3)[1]).toBe(bulbasaur);
	});

	it("does not mutate the input row", () => {
		scopeRowsToGen(rows, 3);
		expect(pikachu.stats.defense).toBe(40);
	});

	it("feeds the table's columns, Total, sort and stat-range filter the same scoped stats", () => {
		const scoped = scopeRowsToGen(rows, 3);
		const renderOf = (key: string, row: PokedexTableRow): string => {
			const column = TOGGLEABLE_COLUMNS.find((c) => c.key === key);
			if (!column || column.custom) throw new Error(`no text column "${key}"`);
			return column.render(row);
		};
		expect(renderOf("defense", scoped[0])).toBe("30");
		expect(renderOf("total", scoped[0])).toBe("300");

		// Pikachu Def 30 < Bulbasaur 35 when scoped; unscoped (40) it would sort after.
		expect(sortPokemon(scoped, "defense", "asc").map((r) => r.name)).toEqual(["pikachu", "bulbasaur"]);
		expect(sortPokemon(rows, "defense", "asc").map((r) => r.name)).toEqual(["bulbasaur", "pikachu"]);

		const filters = { ...EMPTY_FILTERS, statRanges: { defense: { min: 35, max: 255 } } };
		expect(filterPokemon(rows, filters, { activeGen: 3 }).map((r) => r.name)).toEqual(["pikachu", "bulbasaur"]);
		expect(filterPokemon(scoped, filters, { activeGen: 3 }).map((r) => r.name)).toEqual(["bulbasaur"]);
	});
});
