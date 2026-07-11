<script lang="ts">
	import { GENERATIONS, RARITIES, STAT_COLUMNS, TYPE_NAMES } from "../../data/constants";
	import { EMPTY_FILTERS, type PokedexFilters } from "../../utils/filterPokemon";
	import type { StatBlock } from "../../data/types";
	import TypeBadge from "./TypeBadge.svelte";
	import Icon from "./Icon.svelte";

	let { filters = $bindable(), abilityOptions, useTypeIcons }: {
		filters: PokedexFilters;
		abilityOptions: string[];
		useTypeIcons: boolean;
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

	let abilitySearch = $state("");
	const filteredAbilityOptions = $derived.by(() => {
		const matches = abilityOptions.filter((a) =>
			a.toLowerCase().includes(abilitySearch.toLowerCase()),
		);
		const selected = matches.filter((a) => filters.abilities.includes(a));
		const rest = matches.filter((a) => !filters.abilities.includes(a));
		return [...selected, ...rest];
	});
</script>

<div class="filter-bar">
	<input
		type="text"
		placeholder="Search by name or #..."
		bind:value={filters.search}
		class="filter-search"
	/>

	<div class="filter-rail">
		<details class="filter-group">
			<summary>
				<Icon name="swatch-book" size={14} strokeWidth={2} />
				<span>Type</span>
				{#if filters.types.length}<span class="filter-count">{filters.types.length}</span>{/if}
			</summary>
			<div class="filter-chips type-chips">
				{#each TYPE_NAMES as type (type)}
					<button
						class="type-chip"
						onclick={() => (filters.types = toggle(filters.types, type))}
					>
						<TypeBadge
							{type}
							useIcon={useTypeIcons}
							selected={filters.types.includes(type)}
						/>
					</button>
				{/each}
			</div>
		</details>

		<details class="filter-group">
			<summary>
				<Icon name="layers" size={14} strokeWidth={2} />
				<span>Generation</span>
				{#if filters.generations.length}<span class="filter-count">{filters.generations.length}</span>{/if}
			</summary>
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
			<summary>
				<Icon name="sparkles" size={14} strokeWidth={2} />
				<span>Ability</span>
				{#if filters.abilities.length}<span class="filter-count">{filters.abilities.length}</span>{/if}
			</summary>
			<div class="filter-chips ability-panel">
				<input
					type="text"
					placeholder="Search abilities..."
					bind:value={abilitySearch}
					class="ability-search"
				/>
				<div class="ability-chip-list">
					{#each filteredAbilityOptions as ability (ability)}
						<button
							class="chip"
							class:active={filters.abilities.includes(ability)}
							onclick={() => (filters.abilities = toggle(filters.abilities, ability))}
						>
							{ability}
						</button>
					{/each}
					{#if filteredAbilityOptions.length === 0}
						<span class="ability-empty">No matches</span>
					{/if}
				</div>
			</div>
		</details>

		<details class="filter-group">
			<summary>
				<Icon name="bar-chart-3" size={14} strokeWidth={2} />
				<span>Stats</span>
			</summary>
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

		<details class="filter-group">
			<summary>
				<Icon name="crown" size={14} strokeWidth={2} />
				<span>Rarity</span>
				{#if filters.rarities.length}<span class="filter-count">{filters.rarities.length}</span>{/if}
			</summary>
			<div class="filter-chips">
				{#each RARITIES as rarity (rarity.key)}
					<button
						class="chip"
						class:active={filters.rarities.includes(rarity.key)}
						onclick={() => (filters.rarities = toggle(filters.rarities, rarity.key))}
					>
						{rarity.label}
					</button>
				{/each}
			</div>
		</details>
	</div>

	<button class="filter-reset" onclick={reset}>
		<Icon name="filter-x" size={14} strokeWidth={2} />
		<span>Clear filters</span>
	</button>
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
	.filter-rail {
		display: inline-flex;
		align-items: stretch;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--background-primary);
		overflow: visible;
	}
	.filter-group {
		position: relative;
	}
	.filter-group:not(:last-child) summary {
		border-right: 1px solid var(--background-modifier-border);
	}
	.filter-group:first-child summary {
		border-radius: 6px 0 0 6px;
	}
	.filter-group:last-child summary {
		border-radius: 0 6px 6px 0;
	}
	.filter-group summary {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		padding: 5px 10px;
		list-style: none;
		user-select: none;
		color: var(--text-muted);
		transition: background-color 100ms ease-out, color 100ms ease-out;
	}
	.filter-group summary::-webkit-details-marker {
		display: none;
	}
	.filter-group summary:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}
	.filter-group summary::after {
		content: "";
		width: 12px;
		height: 12px;
		margin-left: 2px;
		background-color: var(--text-faint);
		-webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") center / contain no-repeat;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") center / contain no-repeat;
		transition: transform 100ms ease-out;
	}
	.filter-group[open] summary::after {
		transform: rotate(180deg);
	}
	.filter-group[open] summary {
		background: color-mix(in srgb, var(--interactive-accent) 12%, transparent);
		color: var(--interactive-accent);
	}
	.filter-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 15px;
		height: 15px;
		padding: 0 4px;
		border-radius: 999px;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		font-size: 0.7em;
		font-weight: 600;
		line-height: 1;
	}
	.filter-chips {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 10;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 6px;
		width: 320px;
		max-width: 80vw;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		box-shadow: var(--shadow-s);
	}
	.type-chips {
		width: 260px;
		row-gap: 4px;
		column-gap: 10px;
	}
	.type-chip {
		display: inline-flex;
		align-items: center;
		background: transparent;
		border: none;
		box-shadow: none;
		font-size: inherit;
		padding: 0;
		margin: 0;
		cursor: pointer;
	}
	.ability-panel {
		flex-direction: column;
		align-items: stretch;
		width: 260px;
	}
	.ability-search {
		box-sizing: border-box;
		width: 100%;
		margin-bottom: 6px;
	}
	.ability-chip-list {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		max-height: 240px;
		overflow-y: auto;
		padding: 2px;
	}
	.ability-empty {
		color: var(--text-faint);
		font-size: 0.85em;
		padding: 4px 0;
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
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 6px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		box-shadow: var(--shadow-s);
	}
	.stat-filter-row {
		display: grid;
		grid-template-columns: 36px 60px auto 60px;
		align-items: center;
		gap: 6px;
		font-size: 0.85em;
	}
	.filter-reset {
		display: flex;
		align-items: center;
		gap: 5px;
		align-self: center;
		background: transparent;
		border: none;
		box-shadow: none;
		padding: 5px 8px;
		color: var(--text-faint);
		font-size: 0.85em;
		cursor: pointer;
		transition: color 100ms ease-out;
	}
	.filter-reset:hover {
		color: var(--text-normal);
		background: transparent;
		box-shadow: none;
	}
</style>
