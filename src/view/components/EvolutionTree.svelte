<script lang="ts">
	import { onMount, tick } from "svelte";
	import type { EvolutionNode } from "../../data/types";
	import EvolutionChain from "./EvolutionChain.svelte";

	let { chain, onSelect, sprites, types, useTypeIcons, compact = false }: {
		chain: EvolutionNode;
		onSelect: (id: number) => void;
		sprites: Record<number, string | null>;
		types: Record<number, string[]>;
		useTypeIcons: boolean;
		compact?: boolean;
	} = $props();

	let containerEl: HTMLDivElement | undefined;
	let lines = $state<{ x1: number; y1: number; x2: number; y2: number }[]>([]);
	// Phone layout only: whether every card shows "#032" and the name on
	// separate lines. One decision for the whole chain, so the numbers and
	// names stay on shared rows: all on one line when the whole chain fits
	// the pane that way (compact cards grow past 72px to fit their label),
	// all split when it doesn't.
	let splitLabels = $state(false);
	// Phone layout, and paired branches: the tallest method text in the chain ("Trade
	// holding Metal Coat" wraps to three lines in a 72px card, "Lv. 16" takes
	// one). Every card reserves this much above its label, so the labels
	// share rows however differently the methods wrap. 0 until measured.
	let methodHeight = $state(0);
	// Same for the type badges: two badges wrap to a second row in a narrow
	// card, one doesn't. With both reserved, every card in the chain is the
	// same height, so the cards can be centred like the desktop layout
	// (Oddish and Gloom level with the middle of Vileplume/Bellossom)
	// without a one-type card's sprite dropping out of line.
	let typesHeight = $state(0);
	// Both layouts: the widest card's natural width at each stage (index =
	// depth from the root), given to every card at that stage as a minimum.
	// Siblings stack in one column left-aligned, and a card centres its
	// sprite, so a wider sibling ("Thunder Stone (In Alola)" under Alolan
	// Raichu, the name "Galarian Mr-Mime") put its sprite up to 13px right of
	// the others'. [] until measured.
	let stageWidths = $state<number[]>([]);
	// Both layouts: whether nodes with many final evolutions (Eevee; see
	// canPairBranches) lay them out two to a row. Only when the chain fits the
	// pane that way, with the labels on one line; otherwise one column, as
	// before, and the phone layout's split decision is made for that.
	let pairBranches = $state(false);

	const px = (v: string) => parseFloat(v) || 0;

	const childNodes = (nodeEl: HTMLElement) => [
		...nodeEl.querySelectorAll<HTMLElement>(":scope > .evo-children > .evo-branch > .evo-node"),
	];

	// A card's width without its stage minimum: the widest of its own parts
	// plus padding, never below the phone layout's floor
	// (--pkdx-evo-card-floor). Read from the parts, never the card, so
	// applying the result doesn't change the next reading. Each part is
	// shrink-to-fit in the card's centred column, except a method that wraps
	// under the sprite (the phone layout's, and a paired card's: see
	// EvolutionChain) and the phone layout's badge row, which stretch to the
	// card (contain: inline-size) and so never set its width.
	// `inlineLabel` (phone) takes the number and name as if on one line, from the
	// spans' own widths, which are max-content in both modes (EvolutionChain's
	// .compact .evo-label), so the split decision reads the same whichever
	// mode is showing and never flips back. Otherwise the label as shown.
	function cardWidth(card: HTMLElement, methodWraps: boolean, inlineLabel: boolean): number {
		const width = (sel: string) => card.querySelector<HTMLElement>(sel)?.getBoundingClientRect().width ?? 0;
		const label = card.querySelector<HTMLElement>(".evo-label");
		// Desktop never splits, and its label is inline text whose space has no
		// column-gap to read, so it takes the label's own box.
		const labelWidth =
			inlineLabel && compact && label
				? width(".evo-num") + px(getComputedStyle(label).columnGap) + width(".evo-name")
				: width(".evo-label");
		const parts = [width(".evo-sprite"), labelWidth];
		if (!methodWraps) parts.push(width(".evo-method-text"));
		if (!compact) parts.push(width(".evo-types"));
		const style = getComputedStyle(card);
		return Math.max(
			px(style.getPropertyValue("--pkdx-evo-card-floor")),
			Math.ceil(Math.max(...parts) + px(style.paddingLeft) + px(style.paddingRight)),
		);
	}

	// Whether the cards under `nodeEl` wrap their method: always on the
	// phone, and under a node that pairs its branches.
	const methodsWrapUnder = (nodeEl: HTMLElement, paired: boolean) =>
		compact || (paired && nodeEl.classList.contains("can-pair"));

	// The width `nodeEl`'s subtree takes with every label on one line: its
	// card, then the gap, then its widest child branch (siblings stack), or
	// two of them side by side when `paired` and the node can pair them.
	function inlineWidth(nodeEl: HTMLElement, paired: boolean, methodWraps = compact): number {
		const card = nodeEl.querySelector<HTMLElement>(":scope > .evo-card");
		if (!card) return 0;
		const own = cardWidth(card, methodWraps, true);
		const children = childNodes(nodeEl);
		if (children.length === 0) return own;
		const wraps = methodsWrapUnder(nodeEl, paired);
		const gap = px(getComputedStyle(nodeEl).columnGap);
		const widest = Math.max(...children.map((child) => inlineWidth(child, paired, wraps)));
		const branches = paired && nodeEl.classList.contains("can-pair") ? 2 * widest + gap : widest;
		return own + gap + branches;
	}

	function rootNode(): HTMLElement | null {
		return containerEl?.querySelector<HTMLElement>(":scope > .evo-node") ?? null;
	}

	function branchesFitPaired(): boolean {
		const root = rootNode();
		if (!containerEl || !root || !containerEl.querySelector(".can-pair")) return false;
		return inlineWidth(root, true) <= containerEl.clientWidth;
	}

	function labelsNeedSplit(paired: boolean): boolean {
		const root = rootNode();
		if (!containerEl || !compact || !root) return false;
		return inlineWidth(root, paired) > containerEl.clientWidth;
	}

	// A straight line from center to center is the only shape that's both
	// "full length" for a plain linear chain AND correctly angled for a
	// branching one (Gloom -> Vileplume/Bellossom) — it's the same operation
	// either way, just between points that happen to differ in y as well as
	// x, rather than two special cases to build separately.
	function collectEdges(node: EvolutionNode, edges: [number, number][] = []): [number, number][] {
		for (const child of node.children) {
			edges.push([node.id, child.id]);
			collectEdges(child, edges);
		}
		return edges;
	}

	// Read off the inner text span, whose box is its lines' own height
	// whatever min-height the outer .evo-method has been given, so applying
	// the result never changes the next reading.
	function tallestMethod(paired: boolean): number {
		if (!containerEl || !(compact || paired)) return 0;
		const heights = [...containerEl.querySelectorAll<HTMLElement>(".evo-method-text")].map(
			(el) => el.getBoundingClientRect().height,
		);
		return Math.ceil(Math.max(0, ...heights));
	}

	// From the badges' own boxes, not the row's, which carries the reserved
	// min-height: the reading doesn't change once the result is applied.
	function tallestTypes(): number {
		if (!containerEl || !compact) return 0;
		const heights = [...containerEl.querySelectorAll<HTMLElement>(".evo-types")].map((row) => {
			const badges = [...row.children];
			if (badges.length === 0) return 0;
			const top = row.getBoundingClientRect().top;
			return Math.max(...badges.map((b) => b.getBoundingClientRect().bottom)) - top;
		});
		return Math.ceil(Math.max(0, ...heights));
	}

	function widestPerStage(paired: boolean): number[] {
		const widths: number[] = [];
		const walk = (nodeEl: HTMLElement, depth: number, methodWraps: boolean) => {
			const card = nodeEl.querySelector<HTMLElement>(":scope > .evo-card");
			if (card) widths[depth] = Math.max(widths[depth] ?? 0, cardWidth(card, methodWraps, false));
			for (const child of childNodes(nodeEl)) walk(child, depth + 1, methodsWrapUnder(nodeEl, paired));
		};
		const root = rootNode();
		if (root) walk(root, 0, compact);
		return widths;
	}

	function measure() {
		if (!containerEl) return;
		const paired = branchesFitPaired();
		const split = labelsNeedSplit(paired);
		const tallest = tallestMethod(paired);
		const types = tallestTypes();
		const stages = widestPerStage(paired);
		const stagesChanged = stages.length !== stageWidths.length || stages.some((w, i) => w !== stageWidths[i]);
		if (
			paired !== pairBranches ||
			split !== splitLabels ||
			tallest !== methodHeight ||
			types !== typesHeight ||
			stagesChanged
		) {
			// Re-measure once the cards have re-laid out: all five move the
			// sprite centres the lines join (the split also changes the
			// labels' widths, so the stage widths follow it).
			pairBranches = paired;
			splitLabels = split;
			methodHeight = tallest;
			typesHeight = types;
			if (stagesChanged) stageWidths = stages;
			void tick().then(measure);
			return;
		}
		const containerRect = containerEl.getBoundingClientRect();
		const centerOf = (id: number) => {
			const cardEl = containerEl?.querySelector<HTMLElement>(`[data-evo-id="${id}"]`);
			if (!cardEl) return null;
			// Anchor to the sprite, not the whole card — the card also carries
			// the method label above and name/types below, so its own center
			// drifts away from the sprite (and looks visibly off) whenever
			// those grow or shrink (e.g. the types row toggling on/off).
			// Falls back to the card itself for the brief pre-sprite-load
			// window (see EvolutionChain's sprites prop).
			const anchorEl = cardEl.querySelector<HTMLElement>(".evo-sprite") ?? cardEl;
			const r = anchorEl.getBoundingClientRect();
			return { x: r.left + r.width / 2 - containerRect.left, y: r.top + r.height / 2 - containerRect.top };
		};
		const next: typeof lines = [];
		for (const [parentId, childId] of collectEdges(chain)) {
			const p1 = centerOf(parentId);
			const p2 = centerOf(childId);
			if (p1 && p2) next.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
		}
		lines = next;
	}

	// Re-measure whenever the chain changes (a different Pokemon), sprites
	// arrive (cards grow once their image loads in), or the container itself
	// resizes (a pane width change within a band,
	// or a branch wraps to a new line) — all of these move card centers
	// without necessarily remounting this component.
	$effect(() => {
		void chain;
		void sprites;
		tick().then(measure);
	});

	onMount(() => {
		if (!containerEl) return;
		const observer = new ResizeObserver(() => measure());
		observer.observe(containerEl);
		return () => observer.disconnect();
	});
</script>

<div
	class="evo-tree"
	bind:this={containerEl}
	style:--pkdx-evo-method-height={(compact || pairBranches) && methodHeight > 0 ? `${methodHeight}px` : null}
	style:--pkdx-evo-types-height={compact && typesHeight > 0 ? `${typesHeight}px` : null}
>
	<svg class="evo-lines">
		{#each lines as line, i (i)}
			<line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
		{/each}
	</svg>
	<EvolutionChain node={chain} {onSelect} {sprites} {types} {useTypeIcons} {compact} {splitLabels} {pairBranches} {stageWidths} />
</div>

<style>
	.evo-tree {
		position: relative;
	}
	.evo-lines {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}
	.evo-lines line {
		stroke: var(--lk-text-muted);
		stroke-width: 3;
		stroke-dasharray: 2 6;
		stroke-linecap: round;
		opacity: 0.3;
	}
</style>
