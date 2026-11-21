import type { EvolutionNode } from "../data/types";

// Eevee's eight evolutions in one column made the chain eight cards tall.
// A node whose evolutions are many and all final can lay them out two to a
// row instead (EvolutionChain's .paired), when the pane is wide enough
// (the Evolution layout below decides that). Only final evolutions: a branch
// that evolves again (Wurmple's Silcoon and Cascoon) needs its row for its
// own next stage. Four or more, so Burmy's four pair up and Tyrogue's three
// stay a column.
export const PAIRED_BRANCHES_MIN = 4;

export function canPairBranches(node: EvolutionNode): boolean {
	return node.children.length >= PAIRED_BRANCHES_MIN && node.children.every((child) => child.children.length === 0);
}

// The Evolution layout (CONTEXT.md): how EvolutionTree draws one chain in the
// width it has. EvolutionTree applies it, lets the cards lay out, reads them
// back (an EvolutionReading) and asks stepEvolutionLayout again, until a
// reading changes nothing; settleEvolutionLayout runs that loop with the DOM
// passed in, so a test drives it with a fake reader.
export interface EvolutionLayout {
	// Full-size cards fall back to the compact (phone) cards when the chain
	// doesn't fit one row of its container. Wrapping instead put the later
	// stages on a second line, and the centre-to-centre connector then drew a
	// linear chain as a triangle (Venusaur's in a 337px column at a 1100px
	// leaf). A chain that can pair its branches (Eevee) counts as fitting only
	// paired: unpaired, its eight full-size cards stacked ~2400px tall in that
	// column, where compact ones pair as on the phone. Never set while the
	// tree is compact anyway (EvolutionTree's `compact` prop, the phone layout).
	autoCompact: boolean;
	// Both layouts: whether nodes with many final evolutions (Eevee; see
	// canPairBranches) lay them out two to a row. Only when the chain fits the
	// pane that way, with the labels on one line; otherwise one column, and
	// the phone layout's split decision is made for that.
	pairBranches: boolean;
	// Compact cards only: whether every card shows "#032" and the name on
	// separate lines. One decision for the whole chain, so the numbers and
	// names stay on shared rows: all on one line when the whole chain fits
	// the pane that way (compact cards grow past 72px to fit their label),
	// all split when it doesn't.
	splitLabels: boolean;
	// Compact cards, and paired branches: the tallest method text in the chain
	// ("Trade holding Metal Coat" wraps to three lines in a 72px card, "Lv. 16"
	// takes one). Every card reserves this much above its label, so the labels
	// share rows however differently the methods wrap. 0 until measured.
	methodHeight: number;
	// Same for the type badges (compact cards): two badges wrap to a second
	// row in a narrow card, one doesn't. With both reserved, every card in the
	// chain is the same height, so the cards can be centred like the desktop
	// layout (Oddish and Gloom level with the middle of Vileplume/Bellossom)
	// without a one-type card's sprite dropping out of line.
	typesHeight: number;
	// Both layouts: the widest card's natural width at each stage (index =
	// depth from the root), given to every card at that stage as a minimum.
	// Siblings stack in one column left-aligned, and a card centres its
	// sprite, so a wider sibling ("Thunder Stone (In Alola)" under Alolan
	// Raichu, the name "Galarian Mr-Mime") put its sprite up to 13px right of
	// the others'. [] until measured.
	stageWidths: number[];
}

export const INITIAL_EVOLUTION_LAYOUT: EvolutionLayout = {
	autoCompact: false,
	pairBranches: false,
	splitLabels: false,
	methodHeight: 0,
	typesHeight: 0,
	stageWidths: [],
};

// One card's parts as laid out under the applied layout, in px. Widths are
// each part's own box (shrink-to-fit in the card's centred column), never the
// card's, so applying a result doesn't change the next reading. Heights are
// the method text's own lines and the badges' extent, not the rows that carry
// the reserved min-height, for the same reason.
export interface CardReading {
	sprite: number;
	// The label as shown: one line on desktop, either shape on compact cards.
	label: number;
	// The number and name spans, which are max-content in both compact shapes,
	// and the label's column-gap between them: the label's one-line width
	// whichever shape is showing.
	num: number;
	name: number;
	labelGap: number;
	method: number;
	types: number;
	methodHeight: number;
	// 0 for a card with no badges.
	typesHeight: number;
	// Left plus right.
	padding: number;
	// --pkdx-evo-card-floor: the compact cards' minimum width (0 on desktop).
	floor: number;
	// The card's node's column-gap: between the card and its evolutions, and
	// between paired columns.
	nodeGap: number;
}

// Keyed by EvolutionNode id. A card with no reading (not rendered yet) counts
// as 0 wide, its evolutions with it.
export interface EvolutionReading {
	containerWidth: number;
	cards: Record<number, CardReading>;
}

// The layout applied now, and the full-size width read while full-size cards
// last showed: read only then and kept while compact ones do, so switching
// never changes the reading and autoCompact can't flip back and forth.
// undefined until full-size cards have been read for this chain.
export interface EvolutionLayoutMemory {
	layout: EvolutionLayout;
	fullSizeWidth: number | undefined;
}

// A card's width without its stage minimum: the widest of its own parts plus
// padding, never below the floor. Each part sets it except a method that
// wraps under the sprite (compact cards', and a paired card's: see
// EvolutionChain) and the compact cards' badge row, which stretch to the card
// (contain: inline-size). `inlineLabel` takes a compact card's number and name
// as if on one line, so the split decision reads the same whichever shape is
// showing and never flips back; desktop never splits, and takes the label's
// own box.
function cardWidth(card: CardReading, compact: boolean, methodWraps: boolean, inlineLabel: boolean): number {
	const label = inlineLabel && compact ? card.num + card.labelGap + card.name : card.label;
	const parts = [card.sprite, label];
	if (!methodWraps) parts.push(card.method);
	if (!compact) parts.push(card.types);
	return Math.max(card.floor, Math.ceil(Math.max(...parts) + card.padding));
}

// Whether the cards under `node` wrap their method: always on compact cards,
// and under a node that pairs its branches.
const methodsWrapUnder = (node: EvolutionNode, compact: boolean, paired: boolean) =>
	compact || (paired && canPairBranches(node));

// The width `node`'s subtree takes with every label on one line: its card,
// then the gap, then its widest child branch (siblings stack), or two of them
// side by side when `paired` and the node can pair them.
function inlineWidth(
	node: EvolutionNode,
	reading: EvolutionReading,
	compact: boolean,
	paired: boolean,
	methodWraps = compact,
): number {
	const card = reading.cards[node.id];
	if (!card) return 0;
	const own = cardWidth(card, compact, methodWraps, true);
	if (node.children.length === 0) return own;
	const wraps = methodsWrapUnder(node, compact, paired);
	const widest = Math.max(...node.children.map((child) => inlineWidth(child, reading, compact, paired, wraps)));
	const branches = paired && canPairBranches(node) ? 2 * widest + card.nodeGap : widest;
	return own + card.nodeGap + branches;
}

function anyCanPair(node: EvolutionNode): boolean {
	return canPairBranches(node) || node.children.some(anyCanPair);
}

function widestPerStage(chain: EvolutionNode, reading: EvolutionReading, compact: boolean, paired: boolean): number[] {
	const widths: number[] = [];
	const walk = (node: EvolutionNode, depth: number, methodWraps: boolean) => {
		const card = reading.cards[node.id];
		if (card) widths[depth] = Math.max(widths[depth] ?? 0, cardWidth(card, compact, methodWraps, false));
		for (const child of node.children) walk(child, depth + 1, methodsWrapUnder(node, compact, paired));
	};
	walk(chain, 0, compact);
	return widths;
}

const tallest = (heights: number[]) => Math.ceil(Math.max(0, ...heights));

const sameWidths = (a: number[], b: number[]) => a.length === b.length && a.every((w, i) => w === b[i]);

export interface EvolutionLayoutStep {
	memory: EvolutionLayoutMemory;
	// Nothing to apply: the reading was taken under the layout it asks for.
	settled: boolean;
}

// One pass: what the chain should look like given a reading taken under
// `memory.layout`. `compactProp` is EvolutionTree's own `compact` (the phone
// layout), which forces compact cards without autoCompact.
export function stepEvolutionLayout(
	chain: EvolutionNode,
	compactProp: boolean,
	memory: EvolutionLayoutMemory,
	reading: EvolutionReading,
): EvolutionLayoutStep {
	const applied = memory.layout;
	let { fullSizeWidth } = memory;
	if (!compactProp) {
		if (!applied.autoCompact) fullSizeWidth = inlineWidth(chain, reading, false, anyCanPair(chain));
		// No full-size reading yet (another chain, while compact) counts as
		// fitting: full-size cards show, and the next pass reads them.
		const fits = (fullSizeWidth ?? 0) <= reading.containerWidth;
		if (applied.autoCompact === fits) {
			// Switch first and read again: every reading below depends on the card size.
			return { memory: { layout: { ...applied, autoCompact: !fits }, fullSizeWidth }, settled: false };
		}
	}
	const compact = compactProp || applied.autoCompact;
	const cards = Object.values(reading.cards);
	const paired = anyCanPair(chain) && inlineWidth(chain, reading, compact, true) <= reading.containerWidth;
	const split = compact && inlineWidth(chain, reading, compact, paired) > reading.containerWidth;
	const methodHeight = compact || paired ? tallest(cards.map((card) => card.methodHeight)) : 0;
	const typesHeight = compact ? tallest(cards.map((card) => card.typesHeight)) : 0;
	const stages = widestPerStage(chain, reading, compact, paired);
	const stageWidths = sameWidths(stages, applied.stageWidths) ? applied.stageWidths : stages;
	const settled =
		paired === applied.pairBranches &&
		split === applied.splitLabels &&
		methodHeight === applied.methodHeight &&
		typesHeight === applied.typesHeight &&
		stageWidths === applied.stageWidths;
	const layout = settled
		? applied
		: { autoCompact: applied.autoCompact, pairBranches: paired, splitLabels: split, methodHeight, typesHeight, stageWidths };
	return { memory: { layout, fullSizeWidth }, settled };
}

// What a settle run is handed: the memory it continues from, and a run counter
// shared by every run for one tree, so a newer run (another chain, sprites
// arriving, a resize) stops an older one at its next apply instead of the two
// interleaving their writes.
export interface EvolutionLayoutState {
	memory: EvolutionLayoutMemory;
	run: number;
}

export function createEvolutionLayoutState(): EvolutionLayoutState {
	return { memory: { layout: INITIAL_EVOLUTION_LAYOUT, fullSizeWidth: undefined }, run: 0 };
}

// Read, step, apply and wait for the cards to lay out, until a reading
// changes nothing. `read` returns null when there is nothing to read (the tree
// unmounted). Resolves true when this run settled the layout (the caller then
// draws what depends on final positions), false when it stopped: nothing to
// read, or a newer run started.
export async function settleEvolutionLayout(
	state: EvolutionLayoutState,
	chain: EvolutionNode,
	compactProp: boolean,
	read: () => EvolutionReading | null,
	apply: (layout: EvolutionLayout) => Promise<void>,
): Promise<boolean> {
	const run = ++state.run;
	for (;;) {
		const reading = read();
		if (!reading) return false;
		const step = stepEvolutionLayout(chain, compactProp, state.memory, reading);
		state.memory = step.memory;
		if (step.settled) return true;
		await apply(step.memory.layout);
		if (run !== state.run) return false;
	}
}
