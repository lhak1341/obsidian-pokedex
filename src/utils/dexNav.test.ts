import { describe, expect, it } from "vitest";
import type { PokedexTableRow } from "../data/types";
import { getAdjacentDexEntries } from "./dexNav";
import { makeRow } from "../data/__fixtures__/rows";

describe("getAdjacentDexEntries", () => {
	const rows: PokedexTableRow[] = [
		makeRow({ id: 4, name: "charmander" }),
		makeRow({ id: 5, name: "charmeleon" }),
		makeRow({ id: 6, name: "charizard" }),
		// Alolan Rattata: shares dexNumber 19 with the default row but has its
		// own id and a formLabel — must never surface as a prev/next target.
		makeRow({ id: 19, dexNumber: 19, name: "rattata" }),
		makeRow({ id: 10091, dexNumber: 19, name: "rattata", formLabel: "Alolan" }),
	];

	it("returns both neighbors for a middle entry", () => {
		expect(getAdjacentDexEntries(rows, 5)).toEqual({
			prev: { id: 4, dexNumber: 4, name: "charmander", formLabel: null, spriteDataUri: null },
			next: { id: 6, dexNumber: 6, name: "charizard", formLabel: null, spriteDataUri: null },
		});
	});

	it("returns null prev at the start of the loaded range", () => {
		expect(getAdjacentDexEntries(rows, 4).prev).toBeNull();
	});

	it("returns null next at the end of the loaded range", () => {
		expect(getAdjacentDexEntries(rows, 19).next).toBeNull();
	});

	it("skips regional-form rows and never returns one as a neighbor when viewing a default row", () => {
		expect(getAdjacentDexEntries(rows, 6).next).toEqual({
			id: 19,
			dexNumber: 19,
			name: "rattata",
			formLabel: null,
			spriteDataUri: null,
		});
	});

	it("returns nulls when the current dex number isn't in rows at all", () => {
		expect(getAdjacentDexEntries(rows, 999)).toEqual({ prev: null, next: null });
	});

	// Growlithe/Arcanine-shaped: both species have a Hisuian form.
	const hisuiRows: PokedexTableRow[] = [
		makeRow({ id: 58, dexNumber: 58, name: "growlithe" }),
		makeRow({ id: 10229, dexNumber: 58, name: "growlithe", formLabel: "Hisuian" }),
		makeRow({ id: 59, dexNumber: 59, name: "arcanine" }),
		makeRow({ id: 10230, dexNumber: 59, name: "arcanine", formLabel: "Hisuian" }),
		// Rowlet/Dartrix/Decidueye-shaped: only Decidueye (not its pre-evos)
		// has a Hisuian form, so stepping past it has nothing to land on.
		makeRow({ id: 724, dexNumber: 724, name: "decidueye" }),
		makeRow({ id: 10244, dexNumber: 724, name: "decidueye", formLabel: "Hisuian" }),
		makeRow({ id: 725, dexNumber: 725, name: "rowlet" }),
	];

	it("stays on the same regional-form line when the neighbor has a matching variant", () => {
		expect(getAdjacentDexEntries(hisuiRows, 58, "Hisuian").next).toEqual({
			id: 10230,
			dexNumber: 59,
			name: "arcanine",
			formLabel: "Hisuian",
			spriteDataUri: null,
		});
	});

	it("falls back to the neighbor's default row when it has no matching variant", () => {
		expect(getAdjacentDexEntries(hisuiRows, 724, "Hisuian").next).toEqual({
			id: 725,
			dexNumber: 725,
			name: "rowlet",
			formLabel: null,
			spriteDataUri: null,
		});
	});

	it("still lands on the default row when the currently viewed row isn't a variant", () => {
		expect(getAdjacentDexEntries(hisuiRows, 58, null).next).toEqual({
			id: 59,
			dexNumber: 59,
			name: "arcanine",
			formLabel: null,
			spriteDataUri: null,
		});
	});
});
