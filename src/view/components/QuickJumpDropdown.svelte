<script lang="ts">
	import type { PokedexTableRow } from "../../data/types";
	import { formatPokemonDisplayName } from "../../utils/pokemonDisplay";

	let { matches, activeIndex, onSelect, onHover }: {
		matches: PokedexTableRow[];
		activeIndex: number;
		onSelect: (id: number) => void;
		onHover: (index: number) => void;
	} = $props();
</script>

<ul class="quick-jump-dropdown-results">
	{#each matches as row, i (row.id)}
		<li>
			<!-- preventDefault keeps focus on the input instead of moving it to
			this button, which would fire the input's onblur (closing this list)
			before the click/select below ever runs. -->
			<button
				type="button"
				class:active={i === activeIndex}
				onmousedown={(e) => { e.preventDefault(); onSelect(row.id); }}
				onmouseenter={() => onHover(i)}
			>
				<span class="quick-jump-dropdown-id">#{String(row.dexNumber).padStart(3, "0")}</span>
				<span class="quick-jump-dropdown-name">{formatPokemonDisplayName(row)}</span>
			</button>
		</li>
	{/each}
</ul>

<style>
	.quick-jump-dropdown-results {
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
	.quick-jump-dropdown-results li {
		display: block;
	}
	.quick-jump-dropdown-results button {
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
	.quick-jump-dropdown-results button:hover, .quick-jump-dropdown-results button.active {
		background: var(--background-modifier-hover);
	}
	.quick-jump-dropdown-id {
		font-family: var(--font-monospace);
		font-size: 0.8em;
		color: var(--text-muted);
	}
	.quick-jump-dropdown-name {
		text-transform: capitalize;
	}
</style>
