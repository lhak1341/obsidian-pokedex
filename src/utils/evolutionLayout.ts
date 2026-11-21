import type { EvolutionNode } from "../data/types";

// Eevee's eight evolutions in one column made the chain eight cards tall.
// A node whose evolutions are many and all final can lay them out two to a
// row instead (EvolutionChain's .paired), when the pane is wide enough
// (EvolutionTree decides that). Only final evolutions: a branch that evolves
// again (Wurmple's Silcoon and Cascoon) needs its row for its own next stage.
// Four or more, so Burmy's four pair up and Tyrogue's three stay a column.
export const PAIRED_BRANCHES_MIN = 4;

export function canPairBranches(node: EvolutionNode): boolean {
	return node.children.length >= PAIRED_BRANCHES_MIN && node.children.every((child) => child.children.length === 0);
}
