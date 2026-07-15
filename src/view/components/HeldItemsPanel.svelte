<script lang="ts">
	import { createHoverPopover } from "../hoverPopover.svelte";
	import { formatItemName } from "../../utils/tableColumns";

	let { heldItems, getDescription }: {
		heldItems: { name: string; rarities: number[] }[];
		getDescription: (name: string) => Promise<string | null>;
	} = $props();

	// Keyed by item name, same not-reset-on-id-change reasoning as
	// AbilitiesPanel's abilityDescriptions — common held items (e.g.
	// "oran-berry") repeat across species within a session.
	let itemDescriptions = $state<Record<string, { text: string | null } | { error: true }>>({});
	const popover = createHoverPopover(".detail-screen");

	function showItemPopover(name: string, target: EventTarget | null) {
		popover.show(name, target);
		if (!(name in itemDescriptions)) {
			getDescription(name)
				.then((text) => {
					itemDescriptions = { ...itemDescriptions, [name]: { text } };
				})
				.catch(() => {
					itemDescriptions = { ...itemDescriptions, [name]: { error: true } };
				});
		}
	}
</script>

{#each heldItems as item (item.name)}
	<span
		class="held-item-name"
		role="note"
		onmouseenter={(e) => showItemPopover(item.name, e.currentTarget)}
		onmouseleave={popover.hide}
	>{formatItemName(item.name)} ({item.rarities.join("/")}%)</span>
{/each}

{#if popover.hovered && popover.pos}
	{@const state = itemDescriptions[popover.hovered]}
	<div class="held-item-popover" style="top: {popover.pos.top}px; left: {popover.pos.left}px;">
		{#if !state}
			Loading…
		{:else if "error" in state}
			Couldn't load description.
		{:else}
			{state.text ?? "No description available."}
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
</style>
