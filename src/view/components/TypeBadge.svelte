<script lang="ts">
	import { TYPE_COLORS, TYPE_ICONS } from "../../data/constants";
	import Icon from "./Icon.svelte";

	let { type, useIcon = false, selected = false, compact = false, small = false }: {
		type: string;
		useIcon?: boolean;
		selected?: boolean;
		// ~60% scale for contexts too small for the normal badge size (e.g.
		// evolution chain cards, which need per-stage types but have nowhere
		// near a table cell's or the header's width to spend on them).
		compact?: boolean;
		// A 22px icon with a ~14px glyph: the Narrow pane table's Type column,
		// where two of them and a 3px gap fit 58px.
		small?: boolean;
	} = $props();

	const glyphSize = $derived(compact ? 10 : small ? 14 : 17);

	const color = $derived(TYPE_COLORS[type] ?? "var(--lk-text-faint)");
</script>

{#if useIcon}
	<span class="type-badge-icon" class:selected class:compact class:small style:background-color={color} title={type}>
		<Icon name={TYPE_ICONS[type] ?? "circle"} size={glyphSize} strokeWidth={2.25} />
	</span>
{:else}
	<span class="type-badge" class:selected class:compact style:background-color={color}>
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
		color: var(--pkdx-type-text);
		text-transform: capitalize;
		text-shadow: var(--pkdx-type-text-shadow);
		opacity: 0.85;
		transition: opacity var(--lk-duration-fast) ease-out, box-shadow var(--lk-duration-fast) ease-out;
	}
	.type-badge.selected {
		opacity: 1;
		box-shadow: 0 0 0 2px var(--lk-accent);
	}
	.type-badge.compact {
		padding: 2px 7px;
		margin-right: 0;
		/* Evolution cards only. 0.5em drew 6.5px text. */
		font-size: 0.72em;
	}
	.type-badge-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 27px;
		height: 27px;
		margin-right: 4px;
		border-radius: 50%;
		color: var(--pkdx-type-text);
		opacity: 0.85;
		transition: opacity var(--lk-duration-fast) ease-out, box-shadow var(--lk-duration-fast) ease-out;
	}
	.type-badge-icon.selected {
		opacity: 1;
		box-shadow: 0 0 0 2px var(--lk-accent);
	}
	.type-badge-icon.small {
		width: 22px;
		height: 22px;
		margin-right: 0;
	}
	.type-badge-icon.compact {
		width: 16px;
		height: 16px;
		margin-right: 0;
	}
</style>
