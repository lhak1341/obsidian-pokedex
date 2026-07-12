<script lang="ts">
	import type { EvolutionNode } from "../../data/types";
	import EvolutionChain from "./EvolutionChain.svelte";
	import TypeBadge from "./TypeBadge.svelte";

	let { node, onSelect, sprites, types, useTypeIcons, evolveLabel }: {
		node: EvolutionNode;
		onSelect: (id: number) => void;
		// Keyed by dex id. Evolution partners are always within the same
		// contiguous fetch range as whatever's currently displayed (see
		// DetailScreen), so these resolve near-instantly from the repository's
		// mem cache — no separate loading state needed here, a node just shows
		// text-only for the brief moment before its sprite lands.
		sprites: Record<number, string | null>;
		// Keyed by dex id, drawn from the already-loaded browse table (see
		// DetailScreen's evoTypes) rather than a per-node fetch.
		types: Record<number, string[]>;
		useTypeIcons: boolean;
		// The level/item/trigger that led INTO this node — computed by the
		// parent (it's the parent that knows which of its evolution_details
		// produced this child) and passed down rather than recursing on the
		// child's own data, since the child has no way to know how it got
		// here. Undefined for the chain's root.
		evolveLabel?: string;
	} = $props();

	function detailLabel(child: EvolutionNode): string {
		if (child.minLevel) return `Lv. ${child.minLevel}`;
		if (child.item) return child.item.replace(/-/g, " ");
		if (child.trigger && child.trigger !== "level-up") return child.trigger.replace(/-/g, " ");
		return "";
	}
</script>

<div class="evo-node">
	<!-- data-evo-id: the connecting lines are drawn by EvolutionTree (the
	wrapper that mounts this component), which measures card centers by this
	attribute rather than this component tracking its own position — it has
	no way to know where its parent or siblings ended up. -->
	<button class="evo-card" data-evo-id={node.id} onclick={() => onSelect(node.id)}>
		{#if sprites[node.id]}
			<img src={sprites[node.id]} alt={node.name} class="evo-sprite" />
		{/if}
		<!-- Always rendered (even for the root, which has no evolveLabel) so
		every card reserves the same slot height — otherwise the root's
		shorter card (no method line) throws its "No. Name" off the row all
		the other stages line up on. A plain " " collapses to 0 height here
		(whitespace-only inline content gets trimmed away), which silently
		defeated that — a non-breaking space renders like real text instead. -->
		<span class="evo-method">{evolveLabel || " "}</span>
		<span class="evo-label">#{String(node.id).padStart(3, "0")} {node.name}</span>
		<span class="evo-types">
			{#each types[node.id] ?? [] as type (type)}
				<TypeBadge {type} useIcon={useTypeIcons} compact />
			{/each}
		</span>
	</button>

	{#if node.children.length > 0}
		<div class="evo-children">
			{#each node.children as child (child.id)}
				<div class="evo-branch">
					<EvolutionChain
						node={child}
						{onSelect}
						{sprites}
						{types}
						{useTypeIcons}
						evolveLabel={detailLabel(child)}
					/>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.evo-node {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 28px;
	}
	.evo-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
		padding: 4px;
		/* Obsidian's own `button { height: var(--input-height) }` otherwise
		clips this to ~30px regardless of the 92px sprite inside — height,
		unlike most of its base button rule, isn't something our higher-
		specificity selector overrides just by existing; only an explicit
		declaration for the same property does. */
		height: auto;
		background: none;
		border: none;
		border-radius: var(--radius-m, 8px);
		cursor: pointer;
		flex-shrink: 0;
		/* Above the SVG connector lines EvolutionTree draws behind this whole
		layout, and above its own background on hover. */
		position: relative;
		z-index: 1;
		transition: background-color 100ms ease-out;
	}
	.evo-card:hover {
		background: var(--background-modifier-hover);
	}
	.evo-sprite {
		width: 92px;
		height: 92px;
		image-rendering: pixelated;
	}
	.evo-method {
		font-size: 0.84em;
		font-weight: 700;
		line-height: 1.15;
		color: var(--text-muted);
		text-transform: capitalize;
		white-space: nowrap;
	}
	.evo-label {
		font-size: 0.78em;
		line-height: 1.15;
		text-transform: capitalize;
		text-align: center;
		white-space: nowrap;
	}
	.evo-types {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 3px;
		margin-top: 1px;
	}
	.evo-children {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.evo-branch {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
	}
</style>
