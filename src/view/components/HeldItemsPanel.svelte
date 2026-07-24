<script lang="ts">
	import { createHoverDescription } from "../hoverDescription.svelte";
	import { formatItemName } from "../../utils/tableColumns";

	let { heldItems, getDescription }: {
		heldItems: { name: string; rarities: number[] }[];
		getDescription: (name: string) => Promise<string | null>;
	} = $props();

	// Keyed by item name, same not-reset-on-id-change reasoning as
	// AbilitiesPanel's cache — common held items (e.g. "oran-berry") repeat
	// across species within a session.
	const popover = createHoverDescription(".detail-screen", (name) => getDescription(name));
</script>

{#each heldItems as item (item.name)}
	<span
		class="held-item-name"
		role="note"
		onmouseenter={(e) => popover.show(item.name, e.currentTarget)}
		onmouseleave={popover.hide}
	>{formatItemName(item.name)} ({item.rarities.join("/")}%)</span>
{/each}

{#if popover.hovered && popover.pos}
	<div
		class="held-item-popover"
		class:popover-above={popover.pos.placement === "above"}
		style="top: {popover.pos.top}px; left: {popover.pos.left}px;"
	>
		{#if !popover.status}
			Loading…
		{:else if popover.status === "error"}
			Couldn't load description.
		{:else}
			{popover.status.text ?? "No description available."}
		{/if}
	</div>
{/if}

<style>
	.held-item-name {
		cursor: help;
	}
	.held-item-name:not(:last-child)::after {
		content: ", ";
		cursor: default;
	}
	.held-item-popover {
		position: absolute;
		z-index: 50;
		max-width: 260px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m, 8px);
		box-shadow: var(--shadow-s);
		padding: 8px 10px;
		font-size: 0.85em;
		color: var(--text-normal);
		pointer-events: none;
	}
	.held-item-popover.popover-above {
		transform: translateY(-100%);
	}
</style>
