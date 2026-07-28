<script lang="ts">
	import { createHoverDescription } from "../hoverDescription.svelte";
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
		class="held-item-name"
		role="note"
		onmouseenter={(e) => popover.show(item.name, e.currentTarget)}
		onmouseleave={popover.hide}
	>{formatItemName(item.name)} ({item.rarities.join("/")}%)</span>
{/each}

<HoverPopoverBox hoverState={popover}>
	{#if !popover.status}
		Loading…
	{:else if popover.status === "error"}
		Couldn't load description.
	{:else}
		{popover.status.text ?? "No description available."}
	{/if}
</HoverPopoverBox>

<style>
	.held-item-name {
		cursor: help;
	}
	.held-item-name:not(:last-child)::after {
		content: ", ";
		cursor: default;
	}
</style>
