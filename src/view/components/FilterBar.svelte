<script lang="ts">
	import { GENERATIONS, RARITIES, STAT_COLORS, STAT_COLUMNS, TYPE_NAMES } from "../../data/constants";
	import { QUIRKS, TRAITS } from "../../utils/quirksAndTraits";
	import { filterAndOrderAbilityOptions } from "../../utils/abilityOptions";
	import { EMPTY_FILTERS, type PokedexFilters } from "../../utils/filterPokemon";
	import type { PokedexTableRow, StatBlock } from "../../data/types";
	import { createQuickJumpDropdown } from "../quickJumpDropdown.svelte";
	import QuickJumpDropdown from "./QuickJumpDropdown.svelte";
	import TypeBadge from "./TypeBadge.svelte";
	import Icon from "./Icon.svelte";
	import FilterGroup from "./FilterGroup.svelte";
	import { activeFilterGroups, FILTER_GROUP_KEYS, filterGroupCount, FULL_STAT_RANGE, type FilterGroupKey } from "../../utils/filterGroups";
	import type { Snippet } from "svelte";

	// `narrow` (a Narrow pane, PokedexApp's width class) folds the bar into two
	// rows: search and the favourites toggle, then Filters (n) with the caller's
	// `controls` (TableScreen's Fields menu and layout toggle) at the right. Its
	// Filters button opens an inline panel of collapsible sections instead of
	// the rail's anchored flyouts. Wide panes draw today's rail and ignore
	// `controls` (TableScreen draws them in its own toolbar there).
	let { filters = $bindable(), abilityOptions, useTypeIcons, rows, narrow = false, controls, onQuickSelect }: {
		filters: PokedexFilters;
		abilityOptions: string[];
		useTypeIcons: boolean;
		rows: PokedexTableRow[];
		narrow?: boolean;
		controls?: Snippet;
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
		return filters.statRanges[key] ?? FULL_STAT_RANGE;
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
	let filterRailEl = $state<HTMLDivElement | undefined>();
	function onDetailsToggle(e: Event) {
		const target = e.currentTarget as HTMLDetailsElement;
		if (!target.open) return;
		filterRailEl?.querySelectorAll("details.filter-group").forEach((d) => {
			if (d !== target) (d as HTMLDetailsElement).open = false;
		});
	}

	const activeGroups = $derived(activeFilterGroups(filters));

	// Each group's rail segment / panel section chrome and content snippet.
	// The order and the counts come from FILTER_GROUP_KEYS and
	// filterGroupCount (utils/filterGroups.ts), the same source as Filters (n).
	const GROUP_CHROME: Record<FilterGroupKey, { icon: string; label: string; content: Snippet }> = {
		type: { icon: "swatch-book", label: "Type", content: typeContent },
		gen: { icon: "layers", label: "Gen", content: genContent },
		ability: { icon: "sparkles", label: "Ability", content: abilityContent },
		stats: { icon: "bar-chart-3", label: "Stats", content: statsContent },
		rarity: { icon: "crown", label: "Rarity", content: rarityContent },
		ev: { icon: "dumbbell", label: "EV", content: evContent },
		traits: { icon: "star", label: "Traits", content: traitsContent },
		quirks: { icon: "glasses", label: "Quirks", content: quirksContent },
	};
	const groups = $derived(
		FILTER_GROUP_KEYS.map((key) => ({ key, ...GROUP_CHROME[key], count: filterGroupCount(filters, key) })),
	);

	// The panel's sections mount each time it opens, and only the active
	// groups start open (FilterGroup reads `open` once, at mount).
	let panelOpen = $state(false);

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

{#snippet typeContent()}
	<div class="filter-chips type-chips">
		{#each TYPE_NAMES as type (type)}
			<button
				type="button"
				class="type-chip"
				aria-pressed={filters.types.includes(type)}
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
{/snippet}

{#snippet genContent()}
	<div class="filter-chips">
		{#each GENERATIONS as gen (gen.id)}
			<button
				type="button"
				class="lk-chip lk-chip--toggle filter-chip"
				aria-pressed={filters.generations.includes(gen.id)}
				onclick={() => toggleGeneration(gen.id)}
			>
				{gen.name}
			</button>
		{/each}
	</div>
{/snippet}

{#snippet abilityContent()}
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
					type="button"
					class="lk-chip lk-chip--toggle filter-chip"
					aria-pressed={filters.abilities.includes(ability)}
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
{/snippet}

{#snippet statsContent()}
	<div class="stat-filters">
		{#each STAT_COLUMNS as col (col.key)}
			<div class="stat-filter-row">
				<span class="stat-filter-label">{col.label}</span>
				<input
					type="number"
					min={FULL_STAT_RANGE.min}
					max={FULL_STAT_RANGE.max}
					value={statRange(col.key).min}
					oninput={(e) => setStatMin(col.key, Number((e.target as HTMLInputElement).value))}
				/>
				<span>to</span>
				<input
					type="number"
					min={FULL_STAT_RANGE.min}
					max={FULL_STAT_RANGE.max}
					value={statRange(col.key).max}
					oninput={(e) => setStatMax(col.key, Number((e.target as HTMLInputElement).value))}
				/>
			</div>
		{/each}
	</div>
{/snippet}

{#snippet rarityContent()}
	<div class="filter-chips">
		{#each RARITIES as rarity (rarity.key)}
			<button
				type="button"
				class="lk-chip lk-chip--toggle filter-chip"
				aria-pressed={filters.rarities.includes(rarity.key)}
				onclick={() => (filters.rarities = toggle(filters.rarities, rarity.key))}
			>
				{rarity.label}
			</button>
		{/each}
	</div>
{/snippet}

{#snippet evContent()}
	<div class="filter-chips">
		{#each STAT_COLUMNS as col (col.key)}
			<button
				type="button"
				class="lk-chip lk-chip--toggle filter-chip"
				aria-pressed={filters.evStats.includes(col.key)}
				style:--pkdx-ev-colour={STAT_COLORS[col.key]}
				onclick={() => (filters.evStats = toggle(filters.evStats, col.key))}
			>
				<span class="lk-chip__dot"></span>
				{col.label}
			</button>
		{/each}
	</div>
{/snippet}

{#snippet traitsContent()}
	<div class="filter-chips">
		{#each TRAITS as trait (trait.key)}
			<button
				type="button"
				class="lk-chip lk-chip--toggle filter-chip quirk-chip"
				aria-pressed={filters.traits.includes(trait.key)}
				onclick={() => (filters.traits = toggle(filters.traits, trait.key))}
			>
				<Icon name={trait.icon} size={13} strokeWidth={2} />
				{trait.label}
			</button>
		{/each}
	</div>
{/snippet}

{#snippet quirksContent()}
	<div class="filter-chips">
		{#each QUIRKS as quirk (quirk.key)}
			<button
				type="button"
				class="lk-chip lk-chip--toggle filter-chip quirk-chip"
				aria-pressed={filters.quirks.includes(quirk.key)}
				onclick={() => (filters.quirks = toggle(filters.quirks, quirk.key))}
			>
				<Icon name={quirk.icon} size={13} strokeWidth={2} />
				{quirk.label}
			</button>
		{/each}
	</div>
{/snippet}

<div class="filter-bar" class:narrow>
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

	{#if narrow}
		<div class="filter-toolbar-row">
			<button
				type="button"
				class="filters-toggle"
				aria-expanded={panelOpen}
				onclick={() => (panelOpen = !panelOpen)}
			>
				<Icon name="filter" size={14} strokeWidth={2} />
				<span>Filters</span>
				{#if activeGroups.length > 0}<span class="filters-count">{activeGroups.length}</span>{/if}
			</button>
			<div class="filter-toolbar-end">
				{@render controls?.()}
			</div>
		</div>
		{#if panelOpen}
			<div class="filter-panel">
				{#each groups as group (group.key)}
					<FilterGroup
						variant="section"
						icon={group.icon}
						label={group.label}
						count={group.count}
						open={activeGroups.includes(group.key)}
					>
						{@render group.content()}
					</FilterGroup>
				{/each}
				<button class="filter-reset panel-reset" onclick={reset}>
					<Icon name="filter-x" size={14} strokeWidth={2} />
					<span>Clear filters</span>
				</button>
			</div>
		{/if}
	{:else}
		<div class="filter-rail" bind:this={filterRailEl}>
			{#each groups as group (group.key)}
				<FilterGroup icon={group.icon} label={group.label} count={group.count} ontoggle={onDetailsToggle}>
					{@render group.content()}
				</FilterGroup>
			{/each}
		</div>

		<button class="filter-reset" onclick={reset}>
			<Icon name="filter-x" size={14} strokeWidth={2} />
			<span>Clear filters</span>
		</button>
	{/if}
</div>

<style>
	.filter-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 8px;
		margin-bottom: var(--lk-space-3);
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
		color: var(--lk-text-faint);
		cursor: pointer;
		transition: color var(--lk-duration-fast) ease-out;
	}
	.favorites-filter-toggle:hover {
		color: var(--lk-text);
		background: transparent;
		box-shadow: none;
	}
	.favorites-filter-toggle.active {
		color: var(--lk-accent);
	}
	.filter-rail {
		display: inline-flex;
		align-items: stretch;
		border: 1px solid var(--lk-border);
		border-radius: 6px;
		background: var(--lk-surface);
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
		background: var(--lk-surface);
		border: 1px solid var(--lk-border);
		border-radius: 4px;
		box-shadow: var(--lk-shadow-s);
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
		color: var(--lk-text-faint);
		font-size: 0.85em;
		padding: 4px 0;
	}
	/* Filter chips are the @lhak/style chip pattern (lk-chip lk-chip--toggle,
	pressed = filter on); styles.src.css sizes them and restates what Obsidian's
	global button rules would otherwise set. Only the per-chip additions stay here. */
	.filter-chip {
		text-transform: capitalize;
	}
	/* Each quirk gets its own Lucide icon (per the user's request, "for the
	sake of organization") ahead of its label. */
	.quirk-chip {
		text-transform: none;
	}
	/* EV chips: the pattern's category dot, in the stat's domain colour (the
	same STAT_COLORS hue per stat as EvChips.svelte's .ev-chip and StatBars). */
	.filter-chip .lk-chip__dot {
		background: var(--pkdx-ev-colour);
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
		background: var(--lk-surface);
		border: 1px solid var(--lk-border);
		border-radius: 4px;
		box-shadow: var(--lk-shadow-s);
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
		color: var(--lk-text-faint);
		font-size: 0.85em;
		cursor: pointer;
		transition: color var(--lk-duration-fast) ease-out;
	}
	.filter-reset:hover {
		color: var(--lk-text);
		background: transparent;
		box-shadow: none;
	}

	/* Narrow pane: two rows, then the inline panel. Row 1 is the search box
	alone at full width; row 2 holds Filters (n) at the left and TableScreen's
	controls at the right. */
	.filter-bar.narrow {
		flex-direction: column;
		align-items: stretch;
		flex-wrap: nowrap;
	}
	.narrow .filter-search-wrapper {
		flex: none;
		min-width: 0;
	}
	/* Positioned: TableScreen's Fields list spans this row (see .fields-menu.end). */
	.filter-toolbar-row {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--lk-space-2);
	}
	.filter-toolbar-end {
		display: flex;
		align-items: center;
		gap: var(--lk-space-2);
		margin-left: auto;
	}
	/* Drawn like the Fields menu's summary beside it (TableScreen), so row 2
	reads as one set of controls. button.filters-toggle restates what
	Obsidian's button rules set (root CLAUDE.md, Styles). */
	button.filters-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: auto;
		padding: 5px 10px;
		border: 1px solid var(--lk-border);
		border-radius: 6px;
		background: transparent;
		box-shadow: none;
		font-size: inherit;
		color: var(--lk-text-muted);
		cursor: pointer;
		transition: background-color var(--lk-duration-fast) ease-out, color var(--lk-duration-fast) ease-out;
	}
	button.filters-toggle:hover {
		background: var(--lk-surface-hover);
		color: var(--lk-text);
	}
	button.filters-toggle[aria-expanded="true"] {
		background: color-mix(in srgb, var(--lk-accent) 12%, transparent);
		color: var(--lk-accent);
		border-color: color-mix(in srgb, var(--lk-accent) 40%, var(--lk-border));
	}
	/* The count of active groups: the same accent pill as a rail segment's
	count (FilterGroup's .filter-count), absent at zero. */
	.filters-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 15px;
		height: 15px;
		padding: 0 4px;
		border-radius: 999px;
		background: var(--lk-accent);
		color: var(--lk-text-on-accent);
		font-size: 0.7em;
		font-weight: 600;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	/* Under Obsidian --lk-surface is the view's own colour, so the panel is
	separated by its border, not a fill (root CLAUDE.md, Styles). */
	.filter-panel {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--lk-border-strong);
		border-radius: 6px;
	}
	/* Inside the panel each group's content sits in flow under its section's
	summary, not as an anchored flyout. */
	.filter-panel .filter-chips,
	.filter-panel .stat-filters {
		position: static;
		width: auto;
		max-width: none;
		padding: 2px 10px 10px;
		background: none;
		border: none;
		border-radius: 0;
		box-shadow: none;
	}
	/* At full panel width the grid's auto column would push the max input to
	the far edge; keep the row its flyout width. */
	.filter-panel .stat-filter-row {
		justify-content: start;
	}
	.filter-panel .ability-chip-list {
		max-height: 200px;
	}
	.panel-reset {
		align-self: stretch;
		justify-content: center;
		padding: 8px;
		border-top: 1px solid var(--lk-border);
		border-radius: 0 0 6px 6px;
	}
</style>
