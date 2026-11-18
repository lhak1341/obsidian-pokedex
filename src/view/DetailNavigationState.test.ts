import { describe, expect, it } from "vitest";
import { DetailNavigationState, parseNavRecord } from "./DetailNavigationState";

describe("DetailNavigationState", () => {
	it("starts on the table", () => {
		expect(new DetailNavigationState().getState()).toEqual({ screen: "table", pokemonId: null });
	});

	it("a Pokemon record opens it at the top, saving the table's scroll", () => {
		const nav = new DetailNavigationState();
		expect(nav.setState({ screen: "detail", pokemonId: 4 }, 42)).toEqual({ kind: "reset" });
		expect(nav.screen).toBe("detail");
		expect(nav.selectedId).toBe(4);
		expect(nav.getState()).toEqual({ screen: "detail", pokemonId: 4 });
	});

	it("a table record restores the scroll saved on leaving the table", () => {
		const nav = new DetailNavigationState();
		nav.setState({ screen: "detail", pokemonId: 4 }, 42);
		expect(nav.setState({ screen: "table", pokemonId: null }, 900)).toEqual({ kind: "restore", top: 42 });
		expect(nav.getState()).toEqual({ screen: "table", pokemonId: null });
	});

	it("moving between Pokemon does not overwrite the saved table scroll with detail's own", () => {
		const nav = new DetailNavigationState();
		nav.setState({ screen: "detail", pokemonId: 4 }, 42);
		expect(nav.setState({ screen: "detail", pokemonId: 5 }, 999)).toEqual({ kind: "reset" });
		expect(nav.setState({ screen: "table", pokemonId: null }, 0)).toEqual({ kind: "restore", top: 42 });
	});

	it("the record already showing is no change, so it adds no history entry", () => {
		const nav = new DetailNavigationState();
		expect(nav.setState({ screen: "table", pokemonId: null }, 10)).toEqual({ kind: "none" });
		nav.setState({ screen: "detail", pokemonId: 4 }, 10);
		expect(nav.setState({ screen: "detail", pokemonId: 4 }, 0)).toEqual({ kind: "none" });
	});

	it('"Back to list" produces a table record', () => {
		const nav = new DetailNavigationState();
		nav.setState({ screen: "detail", pokemonId: 4 }, 0);
		expect(nav.backToTable()).toEqual({ screen: "table", pokemonId: null });
	});
});

describe("parseNavRecord", () => {
	it("accepts the records getState writes", () => {
		expect(parseNavRecord({ screen: "table", pokemonId: null })).toEqual({ screen: "table", pokemonId: null });
		expect(parseNavRecord({ screen: "detail", pokemonId: 25 })).toEqual({ screen: "detail", pokemonId: 25 });
	});

	it("reads a table record whatever its pokemonId", () => {
		expect(parseNavRecord({ screen: "table" })).toEqual({ screen: "table", pokemonId: null });
	});

	it("rejects state that is not a record (an empty restore, a Pokemon record without a valid id)", () => {
		expect(parseNavRecord({})).toBeNull();
		expect(parseNavRecord(undefined)).toBeNull();
		expect(parseNavRecord({ screen: "detail", pokemonId: null })).toBeNull();
		expect(parseNavRecord({ screen: "detail", pokemonId: "25" })).toBeNull();
		expect(parseNavRecord({ screen: "detail", pokemonId: 2.5 })).toBeNull();
		expect(parseNavRecord({ screen: "detail", pokemonId: 0 })).toBeNull();
	});
});
