<script lang="ts">
	import { onMount } from "svelte";
	import type { PokedexTableRow } from "../../data/types";
	import { formatPokemonDisplayName } from "../../utils/pokemonDisplay";
	import { quickJumpMatches, stepQuickJumpNav } from "../../utils/quickJump";
	import { registerGlobalHotkey } from "../globalHotkey";

	let { rows, onSelect }: {
		rows: PokedexTableRow[];
		onSelect: (id: number) => void;
	} = $props();

	let query = $state("");
	let open = $state(false);
	let inputEl: HTMLInputElement | undefined;
	// Which result Up/Down/Enter act on. Reset to 0 (not -1) whenever the
	// match list changes, so Enter alone — no arrow keys needed — still
	// selects the top match, same as before arrow navigation existed.
	let activeIndex = $state(0);

	const matches = $derived.by(() => quickJumpMatches(rows, query));

	$effect(() => {
		void matches;
		activeIndex = 0;
	});

	function select(id: number) {
		onSelect(id);
		query = "";
		open = false;
		// Both the mousedown and Enter paths land here — without this, focus
		// stays in the input after jumping to a result, so isEditableTarget
		// blocks PokedexApp's global "["/"]" view-history hotkey right after
		// the exact navigation it's meant to step back through.
		inputEl?.blur();
	}

	function onKeydown(e: KeyboardEvent) {
		const result = stepQuickJumpNav(e.key, activeIndex, matches.length);
		if (result.action === "move") {
			e.preventDefault();
			activeIndex = result.index;
		} else if (result.action === "select") {
			select(matches[result.index].id);
		} else if (e.key === "Escape") {
			query = "";
			open = false;
			(e.currentTarget as HTMLInputElement).blur();
		}
	}

	// Cmd/Ctrl+Shift+L jumps straight to this box from anywhere else in the
	// detail screen (evolution cards, move tabs, ability list, ...) — a
	// window listener rather than one scoped to this component's own DOM is
	// what makes that work when focus currently isn't inside quick-search at
	// all. Only live while this component is mounted (QuickSearch only
	// renders on the detail screen), so it can't steal focus from the browse
	// table. See registerGlobalHotkey for why this needs Shift and
	// capture-phase.
	onMount(() => registerGlobalHotkey("l", () => { inputEl?.focus(); inputEl?.select(); }));
</script>

<div class="quick-search">
	<input
		bind:this={inputEl}
		type="text"
		class="quick-search-input"
		placeholder="Quick check a Pokemon..."
		bind:value={query}
		onfocus={() => (open = true)}
		oninput={() => (open = true)}
		onblur={() => (open = false)}
		onkeydown={onKeydown}
	/>
	{#if open && matches.length > 0}
		<ul class="quick-search-results">
			{#each matches as row, i (row.id)}
				<li>
					<!-- preventDefault keeps focus on the input instead of moving it
					to this button, which would fire the input's onblur (closing this
					list) before the click/select below ever runs. -->
					<button
						type="button"
						class:active={i === activeIndex}
						onmousedown={(e) => { e.preventDefault(); select(row.id); }}
						onmouseenter={() => (activeIndex = i)}
					>
						<span class="quick-search-id">#{String(row.dexNumber).padStart(3, "0")}</span>
						<span class="quick-search-name">{formatPokemonDisplayName(row)}</span>
					</button>
				</li>
			{/each}
		</ul>
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
	.quick-search-results {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		z-index: 50;
		margin: 0;
		padding: 4px;
		list-style: none;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m, 8px);
		box-shadow: var(--shadow-s);
		max-height: 260px;
		overflow-y: auto;
	}
	.quick-search-results li {
		display: block;
	}
	.quick-search-results button {
		display: flex;
		align-items: baseline;
		/* Obsidian's own button CSS sets justify-content: center — harmless
		to override since we declare it ourselves rather than relying on the
		flex default, same class of issue as the button height/img max-width
		overrides noted elsewhere in this codebase. */
		justify-content: flex-start;
		gap: 8px;
		width: 100%;
		height: auto;
		padding: 6px 8px;
		background: transparent;
		border: none;
		border-radius: var(--radius-s, 4px);
		box-shadow: none;
		text-align: left;
		cursor: pointer;
	}
	.quick-search-results button:hover, .quick-search-results button.active {
		background: var(--background-modifier-hover);
	}
	.quick-search-id {
		font-family: var(--font-monospace);
		font-size: 0.8em;
		color: var(--text-muted);
	}
	.quick-search-name {
		text-transform: capitalize;
	}
</style>
