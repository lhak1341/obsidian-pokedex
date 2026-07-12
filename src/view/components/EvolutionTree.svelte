<script lang="ts">
	import { onMount, tick } from "svelte";
	import type { EvolutionNode } from "../../data/types";
	import EvolutionChain from "./EvolutionChain.svelte";

	let { chain, onSelect, sprites }: {
		chain: EvolutionNode;
		onSelect: (id: number) => void;
		sprites: Record<number, string | null>;
	} = $props();

	let containerEl: HTMLDivElement | undefined;
	let lines = $state<{ x1: number; y1: number; x2: number; y2: number }[]>([]);

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

	function measure() {
		if (!containerEl) return;
		const containerRect = containerEl.getBoundingClientRect();
		const centerOf = (id: number) => {
			const cardEl = containerEl?.querySelector<HTMLElement>(`[data-evo-id="${id}"]`);
			if (!cardEl) return null;
			const r = cardEl.getBoundingClientRect();
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
	// resizes (pane width change flips the 920px container-query breakpoint,
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

<div class="evo-tree" bind:this={containerEl}>
	<svg class="evo-lines">
		{#each lines as line, i (i)}
			<line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
		{/each}
	</svg>
	<EvolutionChain node={chain} {onSelect} {sprites} />
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
		stroke: var(--text-muted);
		stroke-width: 3;
		stroke-dasharray: 2 6;
		stroke-linecap: round;
		opacity: 0.3;
	}
</style>
