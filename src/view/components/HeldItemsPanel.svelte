<script lang="ts">
	import { createHoverDescription } from "../hoverDescription.svelte";
	import { formatPokedollarSigns } from "../../utils/pokedollar";
	import { formatItemName } from "../../utils/tableColumns";
	import HoverPopoverBox from "./HoverPopoverBox.svelte";

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
		class="held-item-entry"
		role="note"
		onmouseenter={(e) => popover.show(item.name, e.currentTarget)}
		onmouseleave={popover.hide}
	><span class="held-item-name">{formatItemName(item.name)}</span> ({item.rarities.join("/")}%)</span>
{/each}

<HoverPopoverBox hoverState={popover}>
	{#if !popover.status}
		Loading…
	{:else if popover.status === "error"}
		Couldn't load description.
	{:else}
		{popover.status.text ? formatPokedollarSigns(popover.status.text) : "No description available."}
	{/if}
</HoverPopoverBox>

<style>
	.held-item-entry {
		cursor: help;
	}
	.held-item-entry:not(:last-child)::after {
		content: ", ";
		cursor: default;
	}
	.held-item-name {
		text-decoration: underline dotted;
	}
</style>
