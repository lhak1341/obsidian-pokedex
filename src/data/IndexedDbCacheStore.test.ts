import { describe, expect, it } from "vitest";
import { directoryKeyBounds, isDirectChildKey } from "./IndexedDbCacheStore";

// Only the store's pure key logic: the store itself needs IndexedDB, which
// vitest lacks, so it is checked live (ADR-0011).
describe("directoryKeyBounds()", () => {
	// IndexedDB compares string keys the way JS `<` does, so this is the
	// range IDBKeyRange.bound(lower, upper, false, true) selects.
	const inRange = (key: string, dir: string): boolean => {
		const [lower, upper] = directoryKeyBounds(dir);
		return key >= lower && key < upper;
	};

	it("covers every key under the directory, nested ones included", () => {
		expect(inRange("species/1.json", "species")).toBe(true);
		expect(inRange("species/~.json", "species")).toBe(true);
		expect(inRange("species/a/b.json", "species")).toBe(true);
	});

	it("excludes sibling directories that share the name as a prefix", () => {
		expect(inRange("species-extra/1.json", "species")).toBe(false);
		expect(inRange("speciesx/1.json", "species")).toBe(false);
		expect(inRange("species", "species")).toBe(false);
		expect(inRange("pokemon/1.json", "species")).toBe(false);
	});
});

describe("isDirectChildKey()", () => {
	it("keeps direct children and drops nested keys and other directories", () => {
		expect(isDirectChildKey("species/1.json", "species")).toBe(true);
		expect(isDirectChildKey("species/a/b.json", "species")).toBe(false);
		expect(isDirectChildKey("pokemon/1.json", "species")).toBe(false);
	});
});
