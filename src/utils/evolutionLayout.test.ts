import { describe, expect, it } from "vitest";
import type { EvolutionNode } from "../data/types";
import captured from "./__fixtures__/evolutionReadings.json";
import {
	canPairBranches,
	type CardReading,
	createEvolutionLayoutState,
	type EvolutionLayout,
	type EvolutionLayoutState,
	type EvolutionReading,
	INITIAL_EVOLUTION_LAYOUT,
	settleEvolutionLayout,
} from "./evolutionLayout";

const node = (id: number, children: EvolutionNode[] = []): EvolutionNode =>
	({ id, children }) as unknown as EvolutionNode;
const leaves = (n: number, from = 100) => Array.from({ length: n }, (_, i) => node(from + i));

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

// A layout's identity for looking a reading up: key order can differ between
// a layout built by the module and one parsed from JSON.
const layoutKey = (layout: EvolutionLayout) =>
	JSON.stringify(Object.entries(layout).sort(([a], [b]) => a.localeCompare(b)));

// The DOM stand-in EvolutionTree passes in: `read` answers with the reading
// taken under whatever `apply` last applied, as the real cards would. A layout
// that flips back and forth never settles, and the loop would spin until the
// heap runs out (it did, 69 s, with the full-size width re-read while
// compact), so the fake fails it after a few passes instead.
const MAX_APPLIES = 20;
function fakeTree(readingFor: (layout: EvolutionLayout) => EvolutionReading | null) {
	let shown = INITIAL_EVOLUTION_LAYOUT;
	const applied: EvolutionLayout[] = [];
	return {
		applied,
		read: () => readingFor(shown),
		apply: (layout: EvolutionLayout) => {
			if (applied.length >= MAX_APPLIES) return Promise.reject(new Error("layout never settled"));
			shown = layout;
			applied.push(layout);
			return Promise.resolve();
		},
	};
}

// Real readings, captured once in pokedex-test-vault (desktop window, leaf
// width set inline): the module's own settle loop ran in the live window with
// a reader identical to EvolutionTree's readCards and an apply that set the
// same classes and custom properties EvolutionChain/EvolutionTree render, and
// recorded every reading against the layout it was taken under. Each case's
// `settled` layout matched what the real component drew at that width.
interface CapturedCase {
	compactProp: boolean;
	chain: EvolutionNode;
	settled: EvolutionLayout;
	readings: { layout: EvolutionLayout; reading: EvolutionReading }[];
}
const cases = captured as unknown as Record<string, CapturedCase>;

function capturedTree(name: string) {
	const c = cases[name];
	if (!c) throw new Error(`no captured case ${name}`);
	return fakeTree((layout) => {
		const found = c.readings.find((r) => layoutKey(r.layout) === layoutKey(layout));
		if (!found) throw new Error(`${name}: no reading under ${layoutKey(layout)}`);
		return found.reading;
	});
}

async function settleCaptured(name: string, state = createEvolutionLayoutState()) {
	const c = cases[name];
	const tree = capturedTree(name);
	const settled = await settleEvolutionLayout(state, c.chain, c.compactProp, tree.read, tree.apply);
	return { settled, state, tree, layout: state.memory.layout };
}

describe("settleEvolutionLayout on captured readings", () => {
	it.each(Object.keys(cases))("%s settles where the live tree did", async (name) => {
		const { settled, layout } = await settleCaptured(name);
		expect(settled).toBe(true);
		expect(layoutKey(layout)).toBe(layoutKey(cases[name].settled));
	});

	it("Venusaur goes compact in a 337px column (1100px leaf) rather than wrap into a triangle", async () => {
		const { layout, state } = await settleCaptured("venusaur-1100");
		expect(layout.autoCompact).toBe(true);
		expect(state.memory.fullSizeWidth).toBeGreaterThan(337);
	});

	it("Venusaur stays compact when it measures again at the same width (never flips back)", async () => {
		const { state } = await settleCaptured("venusaur-1100");
		const again = capturedTree("venusaur-1100");
		const c = cases["venusaur-1100"];
		// The reader starts from the settled, compact layout.
		await again.apply(state.memory.layout);
		again.applied.length = 0;
		expect(await settleEvolutionLayout(state, c.chain, c.compactProp, again.read, again.apply)).toBe(true);
		expect(again.applied).toEqual([]);
	});

	it("Eevee pairs its eight full-size cards at 402px, and pairs compact ones at 337px", async () => {
		expect((await settleCaptured("eevee-1400")).layout).toMatchObject({ autoCompact: false, pairBranches: true });
		expect((await settleCaptured("eevee-1100")).layout).toMatchObject({ autoCompact: true, pairBranches: true });
	});

	it("gives Alolan Raichu's stage its sibling's width, so both sprites centre on one line", async () => {
		expect((await settleCaptured("alolan-raichu-1400")).layout.stageWidths).toEqual([100, 100, 144]);
	});

	it("splits every label in a 223px phone tree (320px leaf)", async () => {
		expect((await settleCaptured("venusaur-320")).layout).toMatchObject({ splitLabels: true, stageWidths: [60, 60, 60] });
		expect((await settleCaptured("wurmple-320")).layout.splitLabels).toBe(true);
	});
});

// Hand-picked numbers for the edges the captured chains don't sit on.
const fullCard = (over: Partial<CardReading> = {}): CardReading => ({
	sprite: 92,
	label: 60,
	num: 30,
	name: 40,
	labelGap: 0,
	method: 40,
	types: 50,
	methodHeight: 13,
	typesHeight: 15,
	padding: 8,
	floor: 0,
	nodeGap: 28,
	...over,
});
const compactCard = (over: Partial<CardReading> = {}): CardReading =>
	fullCard({ sprite: 64, labelGap: 4, padding: 4, floor: 72, nodeGap: 10, ...over });
const readingOf = (chain: EvolutionNode, containerWidth: number, card: (id: number) => CardReading): EvolutionReading => {
	const cards: Record<number, CardReading> = {};
	const walk = (n: EvolutionNode) => {
		cards[n.id] = card(n.id);
		n.children.forEach(walk);
	};
	walk(chain);
	return { containerWidth, cards };
};
// Full-size cards are 100px (92 + 8), compact ones 78px (num + gap + name + 4).
// `compactProp` must match what settle is given: the phone layout shows compact
// cards without autoCompact.
const sizedTree = (chain: EvolutionNode, width: () => number, compactProp = false) =>
	fakeTree((layout) =>
		readingOf(chain, width(), () => (compactProp || layout.autoCompact ? compactCard() : fullCard())),
	);
const settle = (state: EvolutionLayoutState, chain: EvolutionNode, tree: ReturnType<typeof fakeTree>, compactProp = false) =>
	settleEvolutionLayout(state, chain, compactProp, tree.read, tree.apply);

const linear = node(1, [node(2, [node(3)])]);

describe("settleEvolutionLayout's fit rules", () => {
	it("keeps full-size cards when the chain fits exactly, and goes compact a pixel narrower", async () => {
		// 100 + 28 + 100 + 28 + 100
		const fits = createEvolutionLayoutState();
		await settle(fits, linear, sizedTree(linear, () => 356));
		expect(fits.memory.layout.autoCompact).toBe(false);
		const tight = createEvolutionLayoutState();
		await settle(tight, linear, sizedTree(linear, () => 355));
		expect(tight.memory.layout.autoCompact).toBe(true);
	});

	it("goes back to full-size cards once the pane is as wide as the full-size reading", async () => {
		let width = 300;
		const state = createEvolutionLayoutState();
		const tree = sizedTree(linear, () => width);
		await settle(state, linear, tree);
		expect(state.memory.layout.autoCompact).toBe(true);
		width = 340; // compact cards would read as fitting here; the kept full-size reading doesn't
		await settle(state, linear, tree);
		expect(state.memory.layout.autoCompact).toBe(true);
		width = 356;
		await settle(state, linear, tree);
		expect(state.memory.layout.autoCompact).toBe(false);
	});

	it("reads full-size cards again for a chain with no full-size reading, even while compact", async () => {
		const state = createEvolutionLayoutState();
		const tree = sizedTree(linear, () => 400);
		state.memory = { layout: { ...INITIAL_EVOLUTION_LAYOUT, autoCompact: true }, fullSizeWidth: undefined };
		await settle(state, linear, tree);
		expect(tree.applied[0]?.autoCompact).toBe(false);
		expect(state.memory.layout.autoCompact).toBe(false);
	});

	it("pairs four final evolutions only where two columns fit, and never three", async () => {
		const burmy = node(412, leaves(4));
		// card + gap + two columns: 100 + 28 + 100 + 28 + 100
		const wide = createEvolutionLayoutState();
		await settle(wide, burmy, sizedTree(burmy, () => 356));
		expect(wide.memory.layout.pairBranches).toBe(true);
		const narrow = createEvolutionLayoutState();
		await settle(narrow, burmy, sizedTree(burmy, () => 355));
		expect(narrow.memory.layout).toMatchObject({ autoCompact: true, pairBranches: true });
		const tyrogue = node(236, leaves(3));
		const three = createEvolutionLayoutState();
		await settle(three, tyrogue, sizedTree(tyrogue, () => 1000));
		expect(three.memory.layout.pairBranches).toBe(false);
	});

	it("counts a paired card's method out of its width, since it wraps under the sprite", async () => {
		const eevee = node(133, leaves(8));
		const longMethods = readingOf(eevee, 356, (id) => (id === 133 ? fullCard() : fullCard({ method: 180 })));
		const state = createEvolutionLayoutState();
		const tree = fakeTree((layout) => (layout.autoCompact ? readingOf(eevee, 356, () => compactCard()) : longMethods));
		await settle(state, eevee, tree);
		expect(state.memory.layout).toMatchObject({ autoCompact: false, pairBranches: true, methodHeight: 13 });
	});

	it("splits compact labels only when the one-line labels don't fit", async () => {
		// compact cards: 78 + 10 + 78 + 10 + 78
		const fits = createEvolutionLayoutState();
		await settle(fits, linear, sizedTree(linear, () => 254, true), true);
		expect(fits.memory.layout.splitLabels).toBe(false);
		const tight = createEvolutionLayoutState();
		await settle(tight, linear, sizedTree(linear, () => 253, true), true);
		expect(tight.memory.layout.splitLabels).toBe(true);
	});

	it("never takes a compact card below its floor", async () => {
		const state = createEvolutionLayoutState();
		const tree = fakeTree(() => readingOf(linear, 500, () => compactCard({ num: 10, name: 20 })));
		await settle(state, linear, tree, true);
		expect(state.memory.layout.stageWidths).toEqual([72, 72, 72]);
	});
});

describe("settleEvolutionLayout's runs", () => {
	it("stops an older run once a newer one starts, so only the newest applies", async () => {
		const state = createEvolutionLayoutState();
		let width = 300;
		const tree = sizedTree(linear, () => width);
		const log: string[] = [];
		let newer: Promise<boolean> | undefined;
		const older = settleEvolutionLayout(state, linear, false, tree.read, (layout) => {
			log.push(`older ${layout.autoCompact}`);
			const shown = tree.apply(layout);
			// A resize lands while the older run waits for the cards.
			width = 400;
			newer ??= settleEvolutionLayout(state, linear, false, tree.read, (l) => {
				log.push(`newer ${l.autoCompact}`);
				return tree.apply(l);
			});
			return shown;
		});
		expect(await older).toBe(false);
		expect(await newer).toBe(true);
		expect(log[0]).toBe("older true");
		expect(log.slice(1).every((entry) => entry.startsWith("newer"))).toBe(true);
		expect(state.memory.layout.autoCompact).toBe(false);
	});

	it("stops when there is nothing to read", async () => {
		const tree = fakeTree(() => null);
		expect(await settle(createEvolutionLayoutState(), linear, tree)).toBe(false);
		expect(tree.applied).toEqual([]);
	});
});
