<script lang="ts">
	import { GENERATIONS, QUIRKS, RARITIES, STAT_COLORS, STAT_COLUMNS, TRAITS, TYPE_NAMES } from "../../data/constants";
	import { filterAndOrderAbilityOptions } from "../../utils/abilityOptions";
	import { EMPTY_FILTERS, type PokedexFilters } from "../../utils/filterPokemon";
	import type { PokedexTableRow, StatBlock } from "../../data/types";
	import { createQuickJumpDropdown } from "../quickJumpDropdown.svelte";
	import QuickJumpDropdown from "./QuickJumpDropdown.svelte";
	import TypeBadge from "./TypeBadge.svelte";
	import Icon from "./Icon.svelte";
	import FilterGroup from "./FilterGroup.svelte";

	let { filters = $bindable(), abilityOptions, useTypeIcons, rows, onQuickSelect }: {
		filters: PokedexFilters;
		abilityOptions: string[];
		useTypeIcons: boolean;
		rows: PokedexTableRow[];
		onQuickSelect: (id: number) => void;
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

	// Each filter-group is a native <details>, which don't coordinate with
	// each other on their own — without this, opening a second/third dropdown
	// while the first stays open clutters the whole rail. `toggle` is a real
	// DOM event fired on both open AND close, so this only acts when the just-
	// interacted-with one is the one now open, closing every sibling
	// (scoped to filterRailEl, not the whole document, so nothing outside
	// this bar is affected).
	let filterRailEl: HTMLDivElement | undefined;
	function onDetailsToggle(e: Event) {
		const target = e.currentTarget as HTMLDetailsElement;
		if (!target.open) return;
		filterRailEl?.querySelectorAll("details.filter-group").forEach((d) => {
			if (d !== target) (d as HTMLDetailsElement).open = false;
		});
	}

	let abilitySearch = $state("");
	const filteredAbilityOptions = $derived(filterAndOrderAbilityOptions(abilityOptions, abilitySearch, filters.abilities));

	// Quick-jump dropdown on the main search box, sharing createQuickJumpDropdown
	// with QuickSearch.svelte on the detail screen (same matchesSearch
	// predicate, same Up/Down/Enter nav, same hotkey). Kept separate from
	// filters.search's own live-filtering of the table below rather than
	// replacing it — typing still filters the table as before, this dropdown
	// just offers a faster way to jump straight into a result's detail page
	// instead of scrolling to its row.
	let searchInputEl: HTMLInputElement | undefined;

	const quickJump = createQuickJumpDropdown({
		rows: () => rows,
		query: () => filters.search,
		inputRef: () => searchInputEl,
		// onQuickSelect navigates away to the detail screen entirely, so
		// unlike QuickSearch's onSelect this doesn't need to blur — the
		// search input (and this whole screen) leaves the DOM on select.
		onSelect: (id) => onQuickSelect(id),
		// Unlike QuickSearch's own Escape, this doesn't clear filters.search
		// — that's the table's real live filter, not an ephemeral query, so
		// Escape here only dismisses the dropdown (handled by the hook).
		onEscape: () => {},
	});
</script>

<div class="filter-bar">
	<div class="filter-search-wrapper">
		<input
			bind:this={searchInputEl}
			type="text"
			placeholder="Search by name or #..."
			bind:value={filters.search}
			class="filter-search"
			onfocus={quickJump.onFocus}
			oninput={quickJump.onInput}
			onblur={quickJump.onBlur}
			onkeydown={quickJump.onKeydown}
		/>
		<button
			type="button"
			class="favorites-filter-toggle"
			class:active={filters.favoritesOnly}
			aria-label={filters.favoritesOnly ? "Show all Pokemon" : "Show only favorites"}
			aria-pressed={filters.favoritesOnly}
			onclick={() => (filters.favoritesOnly = !filters.favoritesOnly)}
		>
			<Icon name="asterisk" size={15} strokeWidth={2.25} />
		</button>
		{#if quickJump.open && quickJump.matches.length > 0}
			<QuickJumpDropdown
				matches={quickJump.matches}
				activeIndex={quickJump.activeIndex}
				onSelect={quickJump.select}
				onHover={(i) => (quickJump.activeIndex = i)}
			/>
		{/if}
	</div>

	<div class="filter-rail" bind:this={filterRailEl}>
		<FilterGroup icon="swatch-book" label="Type" count={filters.types.length} ontoggle={onDetailsToggle}>
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
		</FilterGroup>

		<FilterGroup icon="layers" label="Gen" count={filters.generations.length} ontoggle={onDetailsToggle}>
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
		</FilterGroup>

		<FilterGroup icon="sparkles" label="Ability" count={filters.abilities.length} ontoggle={onDetailsToggle}>
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
		</FilterGroup>

		<FilterGroup icon="bar-chart-3" label="Stats" ontoggle={onDetailsToggle}>
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
		</FilterGroup>

		<FilterGroup icon="crown" label="Rarity" count={filters.rarities.length} ontoggle={onDetailsToggle}>
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
		</FilterGroup>

		<FilterGroup icon="dumbbell" label="EV" count={filters.evStats.length} ontoggle={onDetailsToggle}>
			<div class="filter-chips">
				{#each STAT_COLUMNS as col (col.key)}
					<button
						class="stat-chip"
						class:active={filters.evStats.includes(col.key)}
						style:--ev-color={STAT_COLORS[col.key]}
						onclick={() => (filters.evStats = toggle(filters.evStats, col.key))}
					>
						{col.label}
					</button>
				{/each}
			</div>
		</FilterGroup>

		<FilterGroup icon="star" label="Traits" count={filters.traits.length} ontoggle={onDetailsToggle}>
			<div class="filter-chips">
				{#each TRAITS as trait (trait.key)}
					<button
						class="chip quirk-chip"
						class:active={filters.traits.includes(trait.key)}
						onclick={() => (filters.traits = toggle(filters.traits, trait.key))}
					>
						<Icon name={trait.icon} size={13} strokeWidth={2} />
						{trait.label}
					</button>
				{/each}
			</div>
		</FilterGroup>

		<FilterGroup icon="glasses" label="Quirks" count={filters.quirks.length} ontoggle={onDetailsToggle}>
			<div class="filter-chips">
				{#each QUIRKS as quirk (quirk.key)}
					<button
						class="chip quirk-chip"
						class:active={filters.quirks.includes(quirk.key)}
						onclick={() => (filters.quirks = toggle(filters.quirks, quirk.key))}
					>
						<Icon name={quirk.icon} size={13} strokeWidth={2} />
						{quirk.label}
					</button>
				{/each}
			</div>
		</FilterGroup>
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
	/* Named "filter-search-wrapper", not the more obvious "search-wrapper" —
	that name collides with an unscoped global class Obsidian's own core
	search UI already defines (display:flex + padding: 8px 14px). Svelte's
	scoping only strengthens *our* rules with a hash suffix; it can't stop an
	external, unscoped ".search-wrapper" selector from also matching this
	div. That collision was inflating this element's height and breaking
	.filter-bar's flex-start row alignment against .filter-rail/.filter-reset
	until it was renamed. */
	.filter-search-wrapper {
		position: relative;
		flex: 1 1 220px;
		min-width: 180px;
	}
	.filter-search {
		width: 100%;
		/* Room for .favorites-filter-toggle sitting inside the same wrapper,
		on top of the input's own right edge — see its own comment. */
		padding-right: 28px;
	}
	/* Sits inside .filter-search-wrapper on top of the input's own right
	edge (position: relative on the wrapper, absolute here) rather than
	beside it, so it reads as part of the search box itself ("seamless")
	instead of a separate control — same idiom as a browser's inline
	clear-search button. Toggles filters.favoritesOnly directly; no
	separate FilterGroup entry since this is a single always-visible
	on/off, not a set of chips needing a flyout. */
	.favorites-filter-toggle {
		position: absolute;
		top: 50%;
		right: 4px;
		transform: translateY(-50%);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		padding: 0;
		background: transparent;
		border: none;
		box-shadow: none;
		color: var(--text-faint);
		cursor: pointer;
		transition: color 100ms ease-out;
	}
	.favorites-filter-toggle:hover {
		color: var(--text-normal);
		background: transparent;
		box-shadow: none;
	}
	.favorites-filter-toggle.active {
		color: var(--interactive-accent);
	}
	.filter-rail {
		display: inline-flex;
		align-items: stretch;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--background-primary);
		overflow: visible;
	}
	/* .filter-group's own shell (details/summary/count-badge chrome) now
	lives in FilterGroup.svelte — this file only styles the flyout content
	each group supplies as children, which is why .filter-chips/.stat-filters
	stay here instead of moving too (see their own comments below). */
	/* Every other filter-group's dropdown opens flush against its own left
	edge, which is fine as long as there's 320px of room to its right — the
	last group in the rail doesn't have that, so it opens flush against its
	own right edge instead. :last-child self-adjusts to whichever group is
	actually last, rather than a manually-placed marker class that silently
	stops matching if the groups above get reordered. */
	/* :global() on the ancestor half is load-bearing, not decorative — .filter-group
	is rendered by the FilterGroup child component now, not by this component's own
	template, so Svelte's scoped-CSS analysis can't see it and silently drops the
	whole selector as "unused" without :global() (confirmed live: the Quirks flyout
	overflowed past the rail's right edge instead of aligning flush). .filter-chips
	stays scoped normally — that class is on FilterBar's own snippet content. */
	:global(.filter-group:last-child) .filter-chips {
		left: auto;
		right: 0;
	}
	/* .filter-chips and .stat-filters duplicate the same flyout-panel chrome
	(position/border/background/box-shadow below), differing only in
	width/flex-direction — a real, smaller finding, deliberately left as two
	blocks rather than folded into a shared base class in this pass (see
	architecture review candidate 4's own follow-up note). */
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
	/* Each quirk gets its own Lucide icon (per the user's request, "for the
	sake of organization") ahead of its label — plain .chip is text-only, so
	this just adds the icon+label flex layout on top of that shared look. */
	.quirk-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		text-transform: none;
	}
	/* Same --ev-color idiom as TableScreen's .ev-chip (dot + tint, not the
	raw hue as text fill — see that file's comment on why some of these
	stat colors read poorly as small text). Toggled/active state borrows
	.chip.active's accent-outline treatment instead of inventing a new one. */
	.stat-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 8px 2px 6px;
		border-radius: 999px;
		font-size: 0.85em;
		font-weight: 600;
		cursor: pointer;
		color: var(--text-normal);
		background: color-mix(in srgb, var(--ev-color) 14%, var(--background-primary));
		border: 1px solid color-mix(in srgb, var(--ev-color) 45%, var(--background-modifier-border));
		opacity: 0.75;
		transition: opacity 100ms ease-out, box-shadow 100ms ease-out;
	}
	.stat-chip::before {
		content: "";
		width: 7px;
		height: 7px;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--ev-color);
	}
	.stat-chip:hover {
		opacity: 0.9;
	}
	.stat-chip.active {
		opacity: 1;
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
