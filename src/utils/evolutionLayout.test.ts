import { describe, expect, it } from "vitest";
import type { EvolutionNode } from "../data/types";
import { canPairBranches } from "./evolutionLayout";

const node = (id: number, children: EvolutionNode[] = []): EvolutionNode =>
	({ id, children }) as unknown as EvolutionNode;
const leaves = (n: number) => Array.from({ length: n }, (_, i) => node(100 + i));

describe("canPairBranches", () => {
	it("pairs four or more final evolutions (Eevee, Burmy)", () => {
		expect(canPairBranches(node(133, leaves(8)))).toBe(true);
		expect(canPairBranches(node(412, leaves(4)))).toBe(true);
	});

	it("keeps three a column (Tyrogue)", () => {
		expect(canPairBranches(node(236, leaves(3)))).toBe(false);
	});

	it("keeps a column when any branch evolves again", () => {
		const branches = [...leaves(3), node(200, [node(201)])];
		expect(canPairBranches(node(1, branches))).toBe(false);
	});
});
