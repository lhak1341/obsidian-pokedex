<script lang="ts">
	import { GENERATIONS, STAT_COLUMNS, TYPE_NAMES } from "../../data/constants";
	import { EMPTY_FILTERS, type PokedexFilters } from "../../utils/filterPokemon";
	import type { StatBlock } from "../../data/types";
	import TypeBadge from "./TypeBadge.svelte";

	let { filters = $bindable(), abilityOptions }: {
		filters: PokedexFilters;
		abilityOptions: string[];
	} = $props();

	function toggle(list: string[], value: string): string[] {
		return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
	}

	function toggleGeneration(id: number) {
		filters.generations = filters.generations.includes(id)
			? filters.generations.filter((g) => g !== id)
			: [...filters.generations, id];
	}

	function statRange(key: keyof StatBlock) {
		return filters.statRanges[key] ?? { min: 0, max: 255 };
	}

	function setStatMin(key: keyof StatBlock, value: number) {
		filters.statRanges = { ...filters.statRanges, [key]: { ...statRange(key), min: value } };
	}

	function setStatMax(key: keyof StatBlock, value: number) {
		filters.statRanges = { ...filters.statRanges, [key]: { ...statRange(key), max: value } };
	}

	function reset() {
		filters = { ...EMPTY_FILTERS, statRanges: {} };
	}
</script>

<div class="filter-bar">
	<input
		type="text"
		placeholder="Search by name or #..."
		bind:value={filters.search}
		class="filter-search"
	/>

	<details class="filter-group">
		<summary>Type {filters.types.length ? `(${filters.types.length})` : ""}</summary>
		<div class="filter-chips">
			{#each TYPE_NAMES as type (type)}
				<button
					class="chip"
					class:active={filters.types.includes(type)}
					onclick={() => (filters.types = toggle(filters.types, type))}
				>
					<TypeBadge {type} />
				</button>
			{/each}
		</div>
	</details>

	<details class="filter-group">
		<summary>Generation {filters.generations.length ? `(${filters.generations.length})` : ""}</summary>
		<div class="filter-chips">
			{#each GENERATIONS as gen (gen.id)}
				<button
					class="chip"
					class:active={filters.generations.includes(gen.id)}
					onclick={() => toggleGeneration(gen.id)}
				>
					{gen.name}
				</button>
			{/each}
		</div>
	</details>

	<details class="filter-group">
		<summary>Ability {filters.abilities.length ? `(${filters.abilities.length})` : ""}</summary>
		<div class="filter-chips">
			{#each abilityOptions as ability (ability)}
				<button
					class="chip"
					class:active={filters.abilities.includes(ability)}
					onclick={() => (filters.abilities = toggle(filters.abilities, ability))}
				>
					{ability}
				</button>
			{/each}
		</div>
	</details>

	<details class="filter-group">
		<summary>Stats</summary>
		<div class="stat-filters">
			{#each STAT_COLUMNS as col (col.key)}
				<div class="stat-filter-row">
					<span class="stat-filter-label">{col.label}</span>
					<input
						type="number"
						min="0"
						max="255"
						value={statRange(col.key).min}
						oninput={(e) => setStatMin(col.key, Number((e.target as HTMLInputElement).value))}
					/>
					<span>to</span>
					<input
						type="number"
						min="0"
						max="255"
						value={statRange(col.key).max}
						oninput={(e) => setStatMax(col.key, Number((e.target as HTMLInputElement).value))}
					/>
				</div>
			{/each}
		</div>
	</details>

	<button class="filter-reset" onclick={reset}>Clear filters</button>
</div>

<style>
	.filter-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 8px;
		margin-bottom: var(--size-4-3);
	}
	.filter-search {
		flex: 1 1 220px;
		min-width: 180px;
	}
	.filter-group summary {
		cursor: pointer;
		padding: 4px 10px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		list-style: none;
		user-select: none;
	}
	.filter-group summary::-webkit-details-marker {
		display: none;
	}
	.filter-group summary::after {
		content: "▸";
		float: right;
		margin-left: 8px;
		color: var(--text-faint);
		transition: transform 100ms ease-out;
	}
	.filter-group[open] summary::after {
		transform: rotate(90deg);
	}
	.filter-group[open] summary {
		border-color: var(--interactive-accent);
	}
	.filter-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 6px;
		max-width: 320px;
	}
	.chip {
		background: transparent;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		padding: 2px 6px;
		cursor: pointer;
		text-transform: capitalize;
		font-size: 0.85em;
		opacity: 0.6;
		transition: opacity 100ms ease-out, border-color 100ms ease-out;
	}
	.chip:hover {
		opacity: 0.85;
	}
	.chip.active {
		opacity: 1;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 1px var(--interactive-accent);
	}
	.stat-filters {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 6px;
	}
	.stat-filter-row {
		display: grid;
		grid-template-columns: 36px 60px auto 60px;
		align-items: center;
		gap: 6px;
		font-size: 0.85em;
	}
	.filter-reset {
		align-self: center;
	}
</style>
