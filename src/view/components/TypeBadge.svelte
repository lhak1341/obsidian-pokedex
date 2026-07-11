<script lang="ts">
	import { TYPE_COLORS, TYPE_ICONS } from "../../data/constants";
	import Icon from "./Icon.svelte";

	let { type, useIcon = false, selected = false }: {
		type: string;
		useIcon?: boolean;
		selected?: boolean;
	} = $props();

	const color = $derived(TYPE_COLORS[type] ?? "#777");
</script>

{#if useIcon}
	<span class="type-badge-icon" class:selected style:background-color={color} title={type}>
		<Icon name={TYPE_ICONS[type] ?? "circle"} size={17} strokeWidth={2.25} />
	</span>
{:else}
	<span class="type-badge" class:selected style:background-color={color}>
		{type}
	</span>
{/if}

<style>
	.type-badge {
		display: inline-flex;
		align-items: center;
		padding: 3px 11px;
		margin-right: 4px;
		border-radius: 999px;
		font-size: 0.8em;
		font-weight: 600;
		color: white;
		text-transform: capitalize;
		text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
		opacity: 0.85;
		transition: opacity 100ms ease-out, box-shadow 100ms ease-out;
	}
	.type-badge.selected {
		opacity: 1;
		box-shadow: 0 0 0 2px var(--interactive-accent);
	}
	.type-badge-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 27px;
		height: 27px;
		margin-right: 4px;
		border-radius: 50%;
		color: white;
		opacity: 0.85;
		transition: opacity 100ms ease-out, box-shadow 100ms ease-out;
	}
	.type-badge-icon.selected {
		opacity: 1;
		box-shadow: 0 0 0 2px var(--interactive-accent);
	}
</style>
