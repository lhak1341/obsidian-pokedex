import { describe, expect, it } from "vitest";
import { type LeafHotkeyInput, resolveLeafHotkey } from "./leafHotkeys";

const base: LeafHotkeyInput = { key: "", mod: false, shift: false, editable: false, screen: "detail", active: true };
const press = (overrides: Partial<LeafHotkeyInput>) => resolveLeafHotkey({ ...base, ...overrides });
const chordL = { key: "L", mod: true, shift: true };

describe("resolveLeafHotkey", () => {
	it("maps each key on the active leaf", () => {
		expect(press({ key: "[" })).toEqual({ command: { kind: "history", dir: "back" }, stopPropagation: false });
		expect(press({ key: "]" })).toEqual({ command: { kind: "history", dir: "forward" }, stopPropagation: false });
		expect(press({ key: "ArrowLeft" })).toEqual({ command: { kind: "adjacent", dir: "prev" }, stopPropagation: false });
		expect(press({ key: "ArrowRight" })).toEqual({ command: { kind: "adjacent", dir: "next" }, stopPropagation: false });
		expect(press(chordL)).toEqual({ command: { kind: "focusSearch" }, stopPropagation: true });
	});

	it("accepts either case for the L chord", () => {
		expect(press({ ...chordL, key: "l" })?.command).toEqual({ kind: "focusSearch" });
	});

	// Probed live before this module: ArrowRight stepped a background tab, and
	// "[" was preventDefault-ed on a note while any Pokedex leaf was open.
	it("leaves every key alone when the leaf is not the active one", () => {
		for (const screen of ["table", "detail"] as const) {
			for (const editable of [false, true]) {
				for (const keys of [{ key: "[" }, { key: "]" }, { key: "ArrowLeft" }, { key: "ArrowRight" }, chordL]) {
					expect(press({ ...keys, screen, editable, active: false })).toBeNull();
				}
			}
		}
	});

	it("ignores the plain keys while typing, but not the L chord", () => {
		for (const key of ["[", "]", "ArrowLeft", "ArrowRight"]) {
			expect(press({ key, editable: true })).toBeNull();
		}
		expect(press({ ...chordL, editable: true })?.command).toEqual({ kind: "focusSearch" });
	});

	it("steps adjacent Pokemon only on the detail screen", () => {
		expect(press({ key: "ArrowLeft", screen: "table" })).toBeNull();
		expect(press({ key: "ArrowRight", screen: "table" })).toBeNull();
		expect(press({ key: "[", screen: "table" })?.command).toEqual({ kind: "history", dir: "back" });
		expect(press({ ...chordL, screen: "table" })?.command).toEqual({ kind: "focusSearch" });
	});

	// Mod+[ / Mod+] are Obsidian's own back/forward.
	it("leaves the plain keys to Obsidian when Cmd/Ctrl is held", () => {
		for (const key of ["[", "]", "ArrowLeft", "ArrowRight"]) {
			expect(press({ key, mod: true })).toBeNull();
		}
	});

	it("needs both Mod and Shift for the L chord", () => {
		expect(press({ key: "l", mod: true })).toBeNull();
		expect(press({ key: "L", shift: true })).toBeNull();
		expect(press({ key: "l" })).toBeNull();
	});
});
