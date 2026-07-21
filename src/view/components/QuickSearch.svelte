<script lang="ts">
	import type { PokedexTableRow } from "../../data/types";
	import { createQuickJumpDropdown } from "../quickJumpDropdown.svelte";
	import QuickJumpDropdown from "./QuickJumpDropdown.svelte";

	let { rows, onSelect }: {
		rows: PokedexTableRow[];
		onSelect: (id: number) => void;
	} = $props();

	let query = $state("");
	let inputEl: HTMLInputElement | undefined;

	const quickJump = createQuickJumpDropdown({
		rows: () => rows,
		query: () => query,
		inputRef: () => inputEl,
		// Both the mousedown and Enter paths land here — without the blur,
		// focus stays in the input after jumping to a result, so
		// isEditableTarget blocks PokedexApp's global "["/"]" view-history
		// hotkey right after the exact navigation it's meant to step back
		// through. QuickSearch stays mounted on the same detail screen after
		// selecting (unlike FilterBar's onQuickSelect, which navigates away
		// to the detail screen entirely), so this blur is load-bearing here.
		onSelect: (id) => {
			onSelect(id);
			query = "";
			inputEl?.blur();
		},
		// The hook itself handles the unconditional blur; this is the one
		// caller-specific extra — clearing the ephemeral query text.
		onEscape: () => {
			query = "";
		},
	});
</script>

<div class="quick-search">
	<input
		bind:this={inputEl}
		type="text"
		class="quick-search-input"
		placeholder="Quick check a Pokemon..."
		bind:value={query}
		onfocus={quickJump.onFocus}
		oninput={quickJump.onInput}
		onblur={quickJump.onBlur}
		onkeydown={quickJump.onKeydown}
	/>
	{#if quickJump.open && quickJump.matches.length > 0}
		<QuickJumpDropdown
			matches={quickJump.matches}
			activeIndex={quickJump.activeIndex}
			onSelect={quickJump.select}
			onHover={(i) => (quickJump.activeIndex = i)}
		/>
	{/if}
</div>

<style>
	.quick-search {
		position: relative;
		flex: 1 1 160px;
		max-width: 260px;
		min-width: 0;
	}
	.quick-search-input {
		width: 100%;
	}
</style>
