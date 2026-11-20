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
	// Phone layout only: the tallest method text in the chain ("Trade
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

	const px = (v: string) => parseFloat(v) || 0;

	// The width `nodeEl`'s subtree takes with every label on one line: its
	// card, then the gap, then its widest child branch (siblings stack).
	// Built from the number/name spans' own widths, which are max-content in
	// both modes (EvolutionChain's .compact .evo-label), so the answer is the
	// same whichever mode is showing and the decision never flips back.
	function inlineWidth(nodeEl: HTMLElement): number {
		const card = nodeEl.querySelector<HTMLElement>(":scope > .evo-card");
		const label = card?.querySelector<HTMLElement>(".evo-label");
		const num = label?.querySelector<HTMLElement>(".evo-num");
		const name = label?.querySelector<HTMLElement>(".evo-name");
		if (!card || !label || !num || !name) return 0;
		const cardStyle = getComputedStyle(card);
		const labelWidth =
			num.getBoundingClientRect().width + px(getComputedStyle(label).columnGap) + name.getBoundingClientRect().width;
		const cardWidth = Math.max(
			px(cardStyle.minWidth),
			labelWidth + px(cardStyle.paddingLeft) + px(cardStyle.paddingRight),
		);
		const children = [...nodeEl.querySelectorAll<HTMLElement>(":scope > .evo-children > .evo-branch > .evo-node")];
		if (children.length === 0) return cardWidth;
		return cardWidth + px(getComputedStyle(nodeEl).columnGap) + Math.max(...children.map(inlineWidth));
	}

	function labelsNeedSplit(): boolean {
		if (!containerEl || !compact) return false;
		const root = containerEl.querySelector<HTMLElement>(":scope > .evo-node");
		return root !== null && inlineWidth(root) > containerEl.clientWidth;
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
	function tallestMethod(): number {
		if (!containerEl || !compact) return 0;
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

	function measure() {
		if (!containerEl) return;
		const split = labelsNeedSplit();
		const tallest = tallestMethod();
		const types = tallestTypes();
		if (split !== splitLabels || tallest !== methodHeight || types !== typesHeight) {
			// Re-measure once the cards have re-laid out: all three change
			// their height, so the sprite centres the lines join move.
			splitLabels = split;
			methodHeight = tallest;
			typesHeight = types;
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
	style:--pkdx-evo-method-height={compact && methodHeight > 0 ? `${methodHeight}px` : null}
	style:--pkdx-evo-types-height={compact && typesHeight > 0 ? `${typesHeight}px` : null}
>
	<svg class="evo-lines">
		{#each lines as line, i (i)}
			<line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
		{/each}
	</svg>
	<EvolutionChain node={chain} {onSelect} {sprites} {types} {useTypeIcons} {compact} {splitLabels} />
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
