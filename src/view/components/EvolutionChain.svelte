<script lang="ts">
	import type { EvolutionNode } from "../../data/types";
	import EvolutionChain from "./EvolutionChain.svelte";

	let { node, onSelect }: { node: EvolutionNode; onSelect: (id: number) => void } = $props();

	function detailLabel(child: EvolutionNode): string {
		if (child.minLevel) return `Lv. ${child.minLevel}`;
		if (child.item) return child.item.replace(/-/g, " ");
		if (child.trigger && child.trigger !== "level-up") return child.trigger.replace(/-/g, " ");
		return "";
	}
</script>

<div class="evo-node">
	<button class="evo-species" onclick={() => onSelect(node.id)}>
		#{String(node.id).padStart(3, "0")} {node.name}
	</button>
	{#if node.children.length > 0}
		<div class="evo-children">
			{#each node.children as child (child.id)}
				<div class="evo-branch">
					<span class="evo-arrow">&rarr; {detailLabel(child)}</span>
					<EvolutionChain node={child} {onSelect} />
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.evo-node {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.evo-species {
		text-transform: capitalize;
		cursor: pointer;
	}
	.evo-children {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-left: 16px;
	}
	.evo-branch {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.evo-arrow {
		font-size: 0.8em;
		color: var(--text-muted);
		text-transform: capitalize;
	}
</style>
