<script lang="ts">
	import type { PokedexRepository } from "../../data/PokedexRepository";
	import type { PokedexTableRow } from "../../data/types";
	import { EMPTY_FILTERS, filterPokemon } from "../../utils/filterPokemon";
	import { type HeldItemForGen, scopeRowsToActiveGen } from "../../utils/activeGenScope";
	import type { BrowseLayout } from "../../utils/browseLayout";
	import { nextSort, sortPokemon, type SortColumn, type SortState } from "../../utils/sortPokemon";
	import { FIELDS, fieldsShown, isStatField, isTileField, sortAfterFieldsChange } from "../../utils/fields";
	import { onDestroy, untrack } from "svelte";
	import { createInfoDescription } from "../infoDescription.svelte";
	import { createFavoriteMenu } from "../favoriteMenu";
	import CardGrid from "./CardGrid.svelte";
	import { CARD_SIZE_LABELS, CARD_SIZES, type CardSize } from "../../utils/cardView";
	import FilterBar from "./FilterBar.svelte";
	import InfoPopoverBox from "./InfoPopoverBox.svelte";
	import Icon from "./Icon.svelte";
	import TableGrid from "./TableGrid.svelte";
	import { createTableMemory } from "../../utils/tableColumns";

	let {
		rows, density, defaultSortColumn, visibleFields, cardFields, useTypeIcons, repository, activeGen,
		favoriteIds, layout, narrow, onLayoutChange, cardSize, onCardSizeChange, onToggleField, onToggleCardField,
		onToggleFavorite, onSelect,
	}: {
		rows: PokedexTableRow[];
		density: "compact" | "comfortable";
		defaultSortColumn: "id" | "name";
		// The chosen Fields, live from the plugin's LocalPreferences: a change in
		// another Pokedex leaf arrives here too.
		visibleFields: string[];
		// Card view's own selection, the Tile Fields (ADR-0020), live the same way.
		cardFields: string[];
		useTypeIcons: boolean;
		repository: PokedexRepository;
		activeGen: number;
		favoriteIds: ReadonlySet<number>;
		// Table or Card view for this pane's width class (PokedexApp owns the
		// choice per width class; the toggle below only asks for a change).
		layout: BrowseLayout;
		// A Narrow pane: FilterBar folds into two rows and takes the Fields menu
		// and layout toggle into its second row (see viewControls below).
		narrow: boolean;
		onLayoutChange: (layout: BrowseLayout) => void;
		// Card view's tile size for this pane's width class, PokedexApp's like
		// the layout; the toggle below only asks for a change.
		cardSize: CardSize;
		onCardSizeChange: (size: CardSize) => void;
		onToggleField: (key: string) => void;
		onToggleCardField: (key: string) => void;
		onToggleFavorite: (id: number) => void;
		onSelect: (id: number) => void;
	} = $props();

	// Same fetch-once-and-cache-per-name hook as DetailScreen's HeldItemsPanel
	// (see infoDescription.svelte.ts) — shared across every row/cell instead
	// of a per-cell instance, so hovering "oran-berry" on row 4 doesn't
	// re-fetch it after already hovering it on row 1.
	const itemPopover = createInfoDescription(".table-screen", (name) => repository.getItemDescription(name));
	// Unlike HeldItemsPanel (which prints "Name (X%)" inline and keeps the
	// tooltip to description-only), the table cell shows bare names to save
	// column width — rarity moves into the tooltip instead. Rarity isn't
	// keyed by item name like the description cache: the same item name can
	// carry a different % on a different row, so this tracks whichever
	// row/item's popover is open, set by that target's onOpen.
	let openItemRarities = $state<number[]>([]);
	// One held item's popover target, for the table cell and Card view's tap
	// panel alike, so both show the same box (rarity included).
	function heldItemTarget(item: HeldItemForGen) {
		return itemPopover.target(item.name, () => (openItemRarities = item.rarities));
	}

	// This component is the browse screen's owner: filters (search included)
	// and the sort live here, and both layouts read them with the Fields
	// selection, so switching between the table and Card view never re-sorts or
	// clears a filter (#22's review). It is one list drawn two ways. Each
	// layout has its own Fields selection (ADR-0020), both the plugin's
	// (ADR-0012), shared by every leaf.
	let filters = $state({ ...EMPTY_FILTERS, statRanges: {} });
	const visibleFieldKeys = $derived<ReadonlySet<string>>(new Set(visibleFields));
	const cardFieldKeys = $derived<ReadonlySet<string>>(new Set(cardFields));
	// The Fields menu edits the shown layout's selection. Card view offers only
	// the Tile Fields: its tap panel shows every Field anyway.
	const menu = $derived(
		layout === "card"
			? { fields: FIELDS.filter(isTileField), chosen: cardFieldKeys, toggle: onToggleCardField }
			: { fields: FIELDS, chosen: visibleFieldKeys, toggle: onToggleField },
	);
	// defaultSortColumn seeds the sort, and changing the setting re-sorts by
	// it (ascending), as the remount that used to follow every settings change
	// did. Any other settings change leaves the user's sort alone.
	// Table headers and Card view's sort chips both go through nextSort.
	// The seed is only ever No. or Name, which no Field owns, so the reset
	// below never undoes it and their order does not matter (ADR-0022).
	let sort = $state<SortState>({ column: untrack(() => defaultSortColumn), direction: "asc" });
	let seededSortColumn = untrack(() => defaultSortColumn);
	$effect.pre(() => {
		if (defaultSortColumn === seededSortColumn) return;
		seededSortColumn = defaultSortColumn;
		sort = { column: defaultSortColumn, direction: "asc" };
	});
	// Never leave the list sorted by a Field that is no longer shown, whichever
	// leaf unchose it. Card view shows every Field (fieldsShown), so this
	// resets only in the table, or on a switch to it from a sort the table's
	// selection lacks. sortAfterFieldsChange hands back the same object when
	// nothing changes, so this writes only on a reset.
	$effect.pre(() => {
		const current = untrack(() => sort);
		const next = sortAfterFieldsChange(current, fieldsShown(layout, visibleFieldKeys));
		if (next !== current) sort = next;
	});

	const abilityOptions = $derived(
		[...new Set(rows.flatMap((r) => r.abilityNames))].sort(),
	);
	// Rows are scoped to the Active Gen once, here (activeGenScope.ts), so every
	// column, the Card view, sort and filters below read the Active Gen's stats,
	// held items and capture locations — the same ones the detail page shows.
	const scopedRows = $derived(scopeRowsToActiveGen(rows, activeGen));
	const visibleRows = $derived(
		sortPokemon(filterPokemon(scopedRows, filters, { favoriteIds }), sort.column, sort.direction),
	);
	function setSort(column: SortColumn) {
		sort = nextSort(sort, column);
	}

	// Favouriting from a list is a menu (right-click or press and hold), on
	// table rows and Card view tiles alike: their favourite dot is a marker only
	// (#35). Reads favoriteIds when it opens, so it never shows a stale title.
	const favoriteMenu = createFavoriteMenu({
		isFavorite: (id) => favoriteIds.has(id),
		onToggle: (id) => onToggleFavorite(id),
	});
	onDestroy(() => favoriteMenu.destroy());

	// The table's measurements outlive TableGrid, which mounts afresh on each
	// switch from Card view (TableMemory, utils/tableColumns.ts).
	const tableMemory = createTableMemory();
</script>

<!-- Card size (S/M/L): next to the layout toggle on a wide pane, beside the
result count on a Narrow pane. -->
{#snippet cardSizeToggle()}
	<div class="layout-toggle" role="group" aria-label="Card size">
		{#each CARD_SIZES as size (size)}
			<button
				type="button"
				class="layout-toggle-item size-item"
				aria-label="{CARD_SIZE_LABELS[size]} cards"
				aria-pressed={cardSize === size}
				onclick={() => onCardSizeChange(size)}
			>
				{CARD_SIZE_LABELS[size][0]}
			</button>
		{/each}
	</div>
{/snippet}

<!-- The Fields menu and the layout toggle, with Card size after it on a wide
pane: in this screen's own toolbar on a wide pane, at the right of FilterBar's
second row on a Narrow pane. -->
{#snippet viewControls()}
	<details class="fields-menu" class:end={narrow}>
		<summary>
			<Icon name="list-checks" size={14} strokeWidth={2} />
			<span>Fields</span>
		</summary>
		<div class="fields-list">
			<div class="fields-section">
				<div class="fields-section-label">Stats</div>
				<div class="fields-grid fields-grid-stats">
					{#each menu.fields.filter(isStatField) as field (field.key)}
						<label class="fields-checkbox">
							<input
								type="checkbox"
								checked={menu.chosen.has(field.key)}
								onchange={() => menu.toggle(field.key)}
							/>
							{field.label}
						</label>
					{/each}
				</div>
			</div>
			<div class="fields-section">
				<div class="fields-section-label">Other</div>
				<div class="fields-grid fields-grid-other">
					{#each menu.fields.filter((f) => !isStatField(f)) as field (field.key)}
						<label class="fields-checkbox">
							<input
								type="checkbox"
								checked={menu.chosen.has(field.key)}
								onchange={() => menu.toggle(field.key)}
							/>
							<Icon name={field.icon ?? "circle"} size={13} strokeWidth={2} />
							{field.label}
						</label>
					{/each}
				</div>
			</div>
		</div>
	</details>
	<div class="layout-toggle" role="group" aria-label="Layout">
		<button
			type="button"
			class="layout-toggle-item"
			aria-label="Table"
			aria-pressed={layout === "table"}
			onclick={() => onLayoutChange("table")}
		>
			<Icon name="table-2" size={14} strokeWidth={2} />
		</button>
		<button
			type="button"
			class="layout-toggle-item"
			aria-label="Card view"
			aria-pressed={layout === "card"}
			onclick={() => onLayoutChange("card")}
		>
			<Icon name="layout-grid" size={14} strokeWidth={2} />
		</button>
	</div>
	{#if layout === "card" && !narrow}
		{@render cardSizeToggle()}
	{/if}
{/snippet}

<div class="table-screen">
	<FilterBar bind:filters {abilityOptions} {useTypeIcons} {rows} {narrow} controls={viewControls} onQuickSelect={onSelect} />

	{#if !narrow}
		<div class="browse-toolbar">
			{@render viewControls()}
		</div>
	{/if}

	<!-- On a Narrow pane Card size sits at the right of the count, above the
	grid it sizes: that pane's toolbar row has no room left for it. -->
	<div class="result-row">
		<p class="result-count">{visibleRows.length} of {rows.length} Pokemon</p>
		{#if layout === "card" && narrow}
			{@render cardSizeToggle()}
		{/if}
	</div>

	{#if layout === "card"}
		<CardGrid
			rows={visibleRows}
			tileFields={cardFieldKeys}
			size={cardSize}
			{favoriteIds}
			{sort}
			{repository}
			onSort={setSort}
			{onSelect}
			{onToggleFavorite}
			{favoriteMenu}
			{heldItemTarget}
		/>
	{:else}
		<TableGrid
			rows={visibleRows}
			fields={visibleFieldKeys}
			{density}
			{useTypeIcons}
			{narrow}
			{favoriteIds}
			{sort}
			onSort={setSort}
			{onSelect}
			{favoriteMenu}
			{heldItemTarget}
			memory={tableMemory}
		/>
	{/if}

	<InfoPopoverBox popover={itemPopover}>
		<span class="held-item-rarity">({openItemRarities.join("/")}%)</span>
		{itemPopover.body}
	</InfoPopoverBox>
</div>

<style>
	.result-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--lk-space-2);
		margin: 6px 0;
	}
	.result-count {
		margin: 0;
		color: var(--lk-text-muted);
		font-size: 0.85em;
	}
	.browse-toolbar {
		display: flex;
		align-items: center;
		gap: var(--lk-space-2);
		margin-bottom: var(--lk-space-3);
	}
	.fields-menu {
		position: relative;
	}
	/* Two icons, one pressed: the kit's segmented-control look (kit.css is not
	in this bundle). button.layout-toggle-item restates what Obsidian's
	button rules set, as button.filter-chip does (root CLAUDE.md, Styles). The
	pressed segment takes a tint of the text, not --lk-surface-raised, which is
	the view's own colour under Obsidian. */
	.layout-toggle {
		display: inline-flex;
		gap: 2px;
		padding: 2px;
		border: 1px solid var(--lk-border);
		border-radius: 6px;
	}
	button.layout-toggle-item {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: auto;
		padding: 4px 8px;
		border: none;
		border-radius: 4px;
		background: transparent;
		box-shadow: none;
		color: var(--lk-text-muted);
		cursor: pointer;
		transition: background-color var(--lk-duration-fast) ease-out, color var(--lk-duration-fast) ease-out;
	}
	button.layout-toggle-item:hover {
		background: var(--lk-surface-hover);
		color: var(--lk-text);
	}
	/* The Card size segments are letters, at the icon segments' height (a 14px
	icon plus 4px padding above and below: 22px), so the two groups line up
	side by side on a wide pane. */
	button.size-item {
		min-width: 26px;
		padding: 4px 6px;
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 14px;
	}
	button.layout-toggle-item[aria-pressed="true"] {
		background: color-mix(in srgb, var(--lk-text) 10%, transparent);
		color: var(--lk-text);
	}
	.fields-menu summary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		padding: 5px 10px;
		border: 1px solid var(--lk-border);
		border-radius: 6px;
		list-style: none;
		user-select: none;
		color: var(--lk-text-muted);
		transition: background-color var(--lk-duration-fast) ease-out, color var(--lk-duration-fast) ease-out;
	}
	.fields-menu summary::-webkit-details-marker {
		display: none;
	}
	.fields-menu summary:hover {
		background: var(--lk-surface-hover);
		color: var(--lk-text);
	}
	.fields-menu summary::after {
		content: "";
		width: 12px;
		height: 12px;
		margin-left: 2px;
		background-color: var(--lk-text-faint);
		-webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") center / contain no-repeat;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") center / contain no-repeat;
		transition: transform var(--lk-duration-fast) ease-out;
	}
	.fields-menu[open] summary::after {
		transform: rotate(180deg);
	}
	.fields-menu[open] summary {
		background: color-mix(in srgb, var(--lk-accent) 12%, transparent);
		color: var(--lk-accent);
		border-color: color-mix(in srgb, var(--lk-accent) 40%, var(--lk-border));
	}
	.fields-list {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 320px;
		max-width: 80vw;
		padding: 10px;
		background: var(--lk-surface);
		border: 1px solid var(--lk-border);
		border-radius: 4px;
		box-shadow: var(--lk-shadow-s);
	}
	/* On a Narrow pane the menu sits at the right of FilterBar's second row,
	too far right for a 320px list to open from it either way. The menu stops
	being the containing block, so the list spans that row
	(.filter-toolbar-row is position: relative) instead. */
	.fields-menu.end {
		position: static;
	}
	.fields-menu.end .fields-list {
		right: 0;
		width: auto;
		max-width: none;
	}
	.fields-section + .fields-section {
		padding-top: 10px;
		border-top: 1px solid var(--lk-border);
	}
	.fields-section-label {
		margin-bottom: 4px;
		font-size: 0.7em;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--lk-text-faint);
	}
	.fields-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2px 8px;
	}
	.fields-grid-other {
		grid-template-columns: repeat(2, 1fr);
	}
	.fields-checkbox {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 6px;
		border-radius: 4px;
		font-size: 0.85em;
		cursor: pointer;
		color: var(--lk-text-muted);
		transition: background-color var(--lk-duration-fast) ease-out, color var(--lk-duration-fast) ease-out;
	}
	.fields-checkbox:hover {
		background: var(--lk-surface-hover);
		color: var(--lk-text);
	}
	.table-screen {
		/* Positioning root for TableGrid's .sprite-preview (position: absolute,
		computed relative to this element — see its CSS comment for why) and
		for every Info popover box here and in TableGrid. */
		position: relative;
	}
	.held-item-rarity {
		font-weight: 600;
	}
</style>
