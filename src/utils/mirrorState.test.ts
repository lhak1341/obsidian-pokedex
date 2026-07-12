import { describe, expect, it } from "vitest";
import { mirrorInto } from "./mirrorState";

describe("mirrorInto", () => {
	it("copies listed fields from source onto target", () => {
		const target = { a: 0, b: "" };
		mirrorInto(target, { a: 1, b: "x" }, ["a", "b"]);
		expect(target).toEqual({ a: 1, b: "x" });
	});

	it("leaves target fields untouched when not in the key list", () => {
		const target = { a: 0, b: "unchanged" };
		mirrorInto(target, { a: 1, b: "x" }, ["a"]);
		expect(target).toEqual({ a: 1, b: "unchanged" });
	});

	it("never copies a source field absent from the key list, even if target has room for it", () => {
		class Source {
			a = 1;
			constructor(private hidden: string) {}
		}
		const source = new Source("secret-ref");
		const target: { a: number; hidden?: string } = { a: 0 };

		mirrorInto(target, source, ["a"]);

		expect(target).toEqual({ a: 1 });
		expect(target.hidden).toBeUndefined();
	});

	it("mutates the same target object rather than returning a new one", () => {
		const target = { a: 0 };
		const returned = mirrorInto(target, { a: 5 }, ["a"]);
		expect(returned).toBeUndefined();
		expect(target.a).toBe(5);
	});
});
