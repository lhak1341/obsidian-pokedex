<script lang="ts">
	import { createInfoDescription } from "../infoDescription.svelte";
	import { formatItemName } from "../../utils/pokemonDisplay";
	import InfoPopoverBox from "./InfoPopoverBox.svelte";

	let { heldItems, getDescription }: {
		heldItems: { name: string; rarities: number[] }[];
		getDescription: (name: string) => Promise<string | null>;
	} = $props();

	// Keyed by item name, same not-reset-on-id-change reasoning as
	// AbilitiesPanel's cache — common held items (e.g. "oran-berry") repeat
	// across species within a session.
	const popover = createInfoDescription(".detail-screen", (name) => getDescription(name));
</script>

{#each heldItems as item (item.name)}
	<span class="held-item-entry pkdx-info-target" {...popover.target(item.name)}><span class="held-item-name">{formatItemName(item.name)}</span> ({item.rarities.join("/")}%)</span>
{/each}

<InfoPopoverBox popover={popover}>
	{popover.body}
</InfoPopoverBox>

<style>
	/* Only the name is underlined (below), not the rarity after it. */
	.held-item-entry {
		text-decoration: none;
	}
	.held-item-entry:not(:last-child)::after {
		content: ", ";
		cursor: default;
	}
	.held-item-name {
		text-decoration-line: underline;
		text-decoration-style: dotted;
	}
</style>
