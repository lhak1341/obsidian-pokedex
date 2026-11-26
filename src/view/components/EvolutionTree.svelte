<script lang="ts">
	import { onMount, tick } from "svelte";
	import type { ChainMember, EvolutionNode } from "../../data/types";
	import {
		type CardReading,
		createEvolutionLayoutState,
		type EvolutionLayout,
		type EvolutionReading,
		INITIAL_EVOLUTION_LAYOUT,
		settleEvolutionLayout,
	} from "../../utils/evolutionLayout";
	import EvolutionChain from "./EvolutionChain.svelte";

	let { chain, onSelect, chainMembers, useTypeIcons, compact: compactProp = false }: {
		chain: EvolutionNode;
		onSelect: (id: number) => void;
		chainMembers: Record<number, ChainMember>;
		useTypeIcons: boolean;
		compact?: boolean;
	} = $props();

	let containerEl: HTMLDivElement | undefined;
	// The Evolution layout (CONTEXT.md): compact cards, paired branches, split
	// labels and the sizes every card reserves, decided by settleEvolutionLayout
	// (utils/evolutionLayout.ts) from what readCards() measures. This component
	// only reads the DOM, applies the result and draws the connector lines.
	let layout = $state.raw<EvolutionLayout>(INITIAL_EVOLUTION_LAYOUT);
	const layoutState = createEvolutionLayoutState();
	let layoutChain: EvolutionNode | undefined;
	const compact = $derived(compactProp || layout.autoCompact);
	let lines = $state<{ x1: number; y1: number; x2: number; y2: number }[]>([]);

	const px = (v: string) => parseFloat(v) || 0;

	// Every card's parts, by node id (see CardReading for why parts, not cards).
	function readCards(): EvolutionReading | null {
		if (!containerEl) return null;
		const cards: Record<number, CardReading> = {};
		for (const card of containerEl.querySelectorAll<HTMLElement>(".evo-card[data-evo-id]")) {
			const width = (sel: string) => card.querySelector<HTMLElement>(sel)?.getBoundingClientRect().width ?? 0;
			const label = card.querySelector<HTMLElement>(".evo-label");
			const methodText = card.querySelector<HTMLElement>(".evo-method-text");
			const typesRow = card.querySelector<HTMLElement>(".evo-types");
			const badges = typesRow ? [...typesRow.children] : [];
			const style = getComputedStyle(card);
			cards[Number(card.dataset.evoId)] = {
				sprite: width(".evo-sprite"),
				label: width(".evo-label"),
				num: width(".evo-num"),
				name: width(".evo-name"),
				labelGap: label ? px(getComputedStyle(label).columnGap) : 0,
				method: width(".evo-method-text"),
				types: width(".evo-types"),
				methodHeight: methodText?.getBoundingClientRect().height ?? 0,
				typesHeight:
					typesRow && badges.length > 0
						? Math.max(...badges.map((b) => b.getBoundingClientRect().bottom)) - typesRow.getBoundingClientRect().top
						: 0,
				padding: px(style.paddingLeft) + px(style.paddingRight),
				floor: px(style.getPropertyValue("--pkdx-evo-card-floor")),
				nodeGap: card.parentElement ? px(getComputedStyle(card.parentElement).columnGap) : 0,
			};
		}
		return { containerWidth: containerEl.clientWidth, cards };
	}

	// Re-measure once the cards have re-laid out: every field moves the sprite
	// centres the lines join.
	async function applyLayout(next: EvolutionLayout): Promise<void> {
		layout = next;
		await tick();
	}

	async function measure() {
		// Another chain starts from no full-size reading (EvolutionLayoutMemory).
		if (chain !== layoutChain) {
			layoutChain = chain;
			layoutState.memory = { ...layoutState.memory, fullSizeWidth: undefined };
		}
		if (await settleEvolutionLayout(layoutState, chain, compactProp, readCards, applyLayout)) drawLines();
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

	function drawLines() {
		if (!containerEl) return;
		const containerRect = containerEl.getBoundingClientRect();
		const centerOf = (id: number) => {
			const cardEl = containerEl?.querySelector<HTMLElement>(`[data-evo-id="${id}"]`);
			if (!cardEl) return null;
			// Anchor to the sprite, not the whole card — the card also carries
			// the method label above and name/types below, so its own center
			// drifts away from the sprite (and looks visibly off) whenever
			// those grow or shrink (e.g. the types row toggling on/off).
			// Falls back to the card itself for the brief pre-sprite-load
			// window (see EvolutionChain's chainMembers prop).
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

	// Re-measure whenever the chain changes (a different Pokemon), its Chain
	// members arrive (a sprite and the type badges both change a card's
	// height), or the container itself
	// resizes (a pane width change within a band,
	// or a branch wraps to a new line) — all of these move card centers
	// without necessarily remounting this component. The newest of these runs
	// wins (settleEvolutionLayout).
	$effect(() => {
		void chain;
		void chainMembers;
		void tick().then(measure);
	});

	onMount(() => {
		if (!containerEl) return;
		const observer = new ResizeObserver(() => void measure());
		observer.observe(containerEl);
		return () => observer.disconnect();
	});
</script>

<div
	class="evo-tree"
	bind:this={containerEl}
	style:--pkdx-evo-method-height={(compact || layout.pairBranches) && layout.methodHeight > 0 ? `${layout.methodHeight}px` : null}
	style:--pkdx-evo-types-height={compact && layout.typesHeight > 0 ? `${layout.typesHeight}px` : null}
>
	<svg class="evo-lines">
		{#each lines as line, i (i)}
			<line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
		{/each}
	</svg>
	<EvolutionChain node={chain} {onSelect} {chainMembers} {useTypeIcons} {compact} splitLabels={layout.splitLabels} pairBranches={layout.pairBranches} stageWidths={layout.stageWidths} />
</div>

<style>
	.evo-tree {
		position: relative;
		/* EvolutionChain's smallest compact cards answer this width. */
		container: evo / inline-size;
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
