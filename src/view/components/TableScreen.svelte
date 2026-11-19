<script lang="ts">
	import { Menu } from "obsidian";
	import type { PokedexRepository } from "../../data/PokedexRepository";
	import type { PokedexTableRow } from "../../data/types";
	import { EMPTY_FILTERS, filterPokemon } from "../../utils/filterPokemon";
	import { describeEncounters } from "../../utils/encounters";
	import { filterHeldItemsForGen, type HeldItemForGen } from "../../utils/heldItemGen";
	import { formatDexNumber, formatItemName, formatPokemonDisplayName } from "../../utils/pokemonDisplay";
	import type { BrowseLayout } from "../../utils/browseLayout";
	import { nextSort, sortPokemon, type SortColumn, type SortState } from "../../utils/sortPokemon";
	import { scopeRowsToGen } from "../../utils/stats";
	import { FIELDS, formatEvYield, isStatField, sortAfterFieldsChange } from "../../utils/fields";
	import { TABLE_COLUMNS } from "../../utils/tableColumns";
	import { untrack } from "svelte";
	import { computeSideAnchoredPreviewPosition } from "../domPosition";
	import { createInfoDescription } from "../infoDescription.svelte";
	import { createInfoPopover } from "../infoPopover.svelte";
	import CardGrid from "./CardGrid.svelte";
	import EvChips from "./EvChips.svelte";
	import FavoriteToggle from "./FavoriteToggle.svelte";
	import FilterBar from "./FilterBar.svelte";
	import InfoPopoverBox from "./InfoPopoverBox.svelte";
	import Icon from "./Icon.svelte";
	import TypeBadge from "./TypeBadge.svelte";

	let {
		rows, density, defaultSortColumn, visibleFields, useTypeIcons, repository, activeGen,
		favoriteIds, layout, onLayoutChange, onToggleField, onToggleFavorite, onSelect,
	}: {
		rows: PokedexTableRow[];
		density: "compact" | "comfortable";
		defaultSortColumn: "id" | "name";
		// The chosen Fields, live from the plugin's LocalPreferences: a change in
		// another Pokedex leaf arrives here too.
		visibleFields: string[];
		useTypeIcons: boolean;
		repository: PokedexRepository;
		activeGen: number;
		favoriteIds: ReadonlySet<number>;
		// Table or Card view for this pane's width class (PokedexApp owns the
		// choice per width class; the toggle below only asks for a change).
		layout: BrowseLayout;
		onLayoutChange: (layout: BrowseLayout) => void;
		onToggleField: (key: string) => void;
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

	// TypeBadge's icon mode already carries a native `title` for the type
	// name, but a native title tooltip is unverifiable through this repo's
	// live-debug tooling (see obsidian-plugin-dev's debugging.md — it never
	// shows up in a screenshot, and reading `.title` alone passes even on an
	// invisible/clipped element) and was reported not actually appearing on
	// hover in the table. This custom popover is a guaranteed-visible
	// fallback, same mechanism as the held-item tooltip above — only wired
	// up in icon mode, since text mode already shows the type name directly.
	const typePopover = createInfoPopover(".table-screen");

	let hoveredSpriteId = $state<number | null>(null);
	let previewPos = $state<{ top: number; left: number } | null>(null);

	// Half of .sprite-preview's fixed 192px height (see its CSS comment) —
	// the preview is vertically centered via translateY(-50%), so this is how
	// far it can extend above/below its anchor point before clipping.
	const PREVIEW_HALF_HEIGHT = 96;

	function showPreview(id: number, target: EventTarget | null) {
		hoveredSpriteId = id;
		const targetEl = target as HTMLElement;
		// Positioned relative to .table-screen (position: absolute, not
		// fixed — see its CSS comment for why), not the raw viewport rect.
		// A row near the top or bottom edge of the visible viewport would
		// otherwise center the preview off-screen (same class of bug
		// infoPopover.svelte.ts's MIN_SPACE_BELOW flip already prevents for
		// AbilitiesPanel/MoveBrowser/HeldItemsPanel — this is a different
		// placement shape though, a side-anchored vertical center rather
		// than a below/above corner flip, so it gets its own clamp instead
		// of reusing that hook). See domPosition.ts's
		// computeSideAnchoredPreviewPosition/utils/previewPosition.ts for the
		// shared clamp math (also used by DetailScreen's portrait preview).
		previewPos = computeSideAnchoredPreviewPosition(targetEl, ".table-screen", PREVIEW_HALF_HEIGHT);
	}

	function hidePreview() {
		hoveredSpriteId = null;
		previewPos = null;
	}

	// This component is the browse screen's owner: filters (search included)
	// and the sort live here, and both layouts read them with the Fields
	// selection, so switching between the table and Card view never re-sorts or
	// clears a filter (#22's review). It is one list drawn two ways. The Fields
	// selection itself is the plugin's (ADR-0012), shared by every leaf.
	let filters = $state({ ...EMPTY_FILTERS, statRanges: {} });
	const visibleFieldKeys = $derived<ReadonlySet<string>>(new Set(visibleFields));
	// Only the initial value of defaultSortColumn seeds local sort state —
	// the user's in-table sort choice shouldn't get clobbered if it changes.
	// Table headers and Card view's sort chips both go through nextSort.
	let sort = $state<SortState>({ column: untrack(() => defaultSortColumn), direction: "asc" });
	// Never leave the list sorted by a Field that is no longer shown, in either
	// layout, whichever leaf unchose it. sortAfterFieldsChange hands back the
	// same object when nothing changes, so this writes only on a reset.
	$effect.pre(() => {
		const current = untrack(() => sort);
		const next = sortAfterFieldsChange(current, visibleFieldKeys);
		if (next !== current) sort = next;
	});

	const abilityOptions = $derived(
		[...new Set(rows.flatMap((r) => r.abilityNames))].sort(),
	);
	// Stats are scoped to the Active Gen once, here, so the stat columns,
	// Total, stat sort and stat-range filter below all read the same numbers
	// the detail page shows — see scopeRowsToGen.
	const scopedRows = $derived(scopeRowsToGen(rows, activeGen));
	const visibleRows = $derived(
		sortPokemon(filterPokemon(scopedRows, filters, { favoriteIds, activeGen }), sort.column, sort.direction),
	);
	const activeColumns = $derived(
		TABLE_COLUMNS.filter((col) => visibleFieldKeys.has(col.key)),
	);
	// No. is a dex number (up to 4 digits) vs a stat's 3; sprite/type widths
	// swing with density and the icon-vs-text type display respectively —
	// everything else has one fixed min regardless of row content (see each
	// Field's TABLE_GEOMETRY `widthPercent`/`minWidth` in tableColumns.ts). The table
	// deliberately stays table-layout: auto (not fixed) — fixed's column
	// sizing pass ignores min-width/max-width entirely by design (that's the
	// point of "fixed"), which silently broke every column's floor. Under
	// auto, `min` is a real min-width on each <th> (a designed buffer, e.g.
	// EV's 3-chip case, or ch for Name's ~20-letter one) and `pct` is the
	// <col>'s width — Name's larger share means it still absorbs most of any
	// extra space on a wide pane, just no longer *all* of it. Cells must NOT
	// get overflow/text-overflow: ellipsis (see td/th CSS) — that collapses
	// a cell's intrinsic min-content width down to ~1 char, which defeats
	// auto layout's real safety net: never shrinking below actual content.
	const spriteColWidth = $derived(density === "compact" ? { pct: "3%", min: "40px" } : { pct: "4%", min: "48px" });
	const typeColWidth = $derived(useTypeIcons ? { pct: "6%", min: "76px" } : { pct: "10%", min: "168px" });

	function setSort(column: SortColumn) {
		sort = nextSort(sort, column);
	}

	function sortIndicator(column: SortColumn): string {
		if (sort.column !== column) return "";
		return sort.direction === "asc" ? " ^" : " v";
	}

	function showRowMenu(e: MouseEvent, row: PokedexTableRow) {
		e.preventDefault();
		const isFavorite = favoriteIds.has(row.id);
		const menu = new Menu();
		menu.addItem((item) =>
			item
				.setTitle(isFavorite ? "Remove from favorites" : "Add to favorites")
				.setIcon("asterisk")
				.onClick(() => onToggleFavorite(row.id))
		);
		menu.showAtMouseEvent(e);
	}
</script>

<div class="table-screen">
	<FilterBar bind:filters {abilityOptions} {useTypeIcons} {rows} onQuickSelect={onSelect} />

	<div class="browse-toolbar">
		<details class="fields-menu">
			<summary>
				<Icon name="list-checks" size={14} strokeWidth={2} />
				<span>Fields</span>
			</summary>
			<div class="fields-list">
				<div class="fields-section">
					<div class="fields-section-label">Stats</div>
					<div class="fields-grid fields-grid-stats">
						{#each FIELDS.filter(isStatField) as field (field.key)}
							<label class="fields-checkbox">
								<input
									type="checkbox"
									checked={visibleFieldKeys.has(field.key)}
									onchange={() => onToggleField(field.key)}
								/>
								{field.label}
							</label>
						{/each}
					</div>
				</div>
				<div class="fields-section">
					<div class="fields-section-label">Other</div>
					<div class="fields-grid fields-grid-other">
						{#each FIELDS.filter((f) => !isStatField(f)) as field (field.key)}
							<label class="fields-checkbox">
								<input
									type="checkbox"
									checked={visibleFieldKeys.has(field.key)}
									onchange={() => onToggleField(field.key)}
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
	</div>

	<p class="result-count">{visibleRows.length} of {rows.length} Pokemon</p>

	{#if layout === "card"}
		<CardGrid
			rows={visibleRows}
			visibleFields={visibleFieldKeys}
			{favoriteIds}
			{sort}
			{repository}
			{activeGen}
			onSort={setSort}
			{onSelect}
			{onToggleFavorite}
			{heldItemTarget}
		/>
	{:else}
		<div class="table-wrap">
			<table class:compact={density === "compact"}>
				<colgroup>
					<col style:width="4%" />
					<col style:width={spriteColWidth.pct} />
					<col style:width="25%" />
					<col style:width={typeColWidth.pct} />
					{#each activeColumns as col (col.key)}
						<col style:width={col.widthPercent} />
					{/each}
				</colgroup>
				<thead>
					<tr>
						<th style:min-width="60px" onclick={() => setSort("id")}>No.{sortIndicator("id")}</th>
						<th class="center" style:min-width={spriteColWidth.min}>Sprite</th>
						<th style:min-width="20ch" onclick={() => setSort("name")}>Name{sortIndicator("name")}</th>
						<th style:min-width={typeColWidth.min}>Type</th>
						{#each activeColumns as col (col.key)}
							<th
								class:center={!!col.icon}
								class:right={col.align === "right"}
								style:min-width={col.minWidth}
								onclick={() => col.sortKey && setSort(col.sortKey)}
								title={col.label}
							>
								{#if col.icon}
									<Icon name={col.icon} />
								{:else}
									{col.label}
								{/if}
								{col.sortKey ? sortIndicator(col.sortKey) : ""}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each visibleRows as row (row.id)}
						<tr onclick={() => onSelect(row.id)} oncontextmenu={(e) => showRowMenu(e, row)}>
							<td>{formatDexNumber(row.dexNumber)}</td>
							<td
								class="center sprite-cell"
								onpointerenter={(e) => {
									// The Art preview is a mouse-hover affordance; a tap on the
									// sprite opens the detail screen and nothing else.
									if (e.pointerType === "mouse") showPreview(row.id, e.currentTarget);
								}}
								onpointerleave={hidePreview}
							>
								{#if row.spriteDataUri}
									<img src={row.spriteDataUri} alt={formatPokemonDisplayName(row)} class="sprite-thumb" />
								{/if}
							</td>
							<td class="name-cell">
								{formatPokemonDisplayName(row)}<FavoriteToggle
									active={favoriteIds.has(row.id)}
									onToggle={() => onToggleFavorite(row.id)}
								/>
							</td>
							<td class="info-target-cell">
								{#each row.types as type (type)}
									{#if useTypeIcons}
										<span class="type-icon-target pkdx-info-target" {...typePopover.target(type)}>
											<TypeBadge {type} useIcon />
										</span>
									{:else}
										<TypeBadge {type} />
									{/if}
								{/each}
							</td>
							{#each activeColumns as col (col.key)}
								{#if col.custom}
									{#if col.custom === "heldItems"}
										{@const genItems = filterHeldItemsForGen(row.heldItemsAllGens, activeGen)}
										<td class="info-target-cell">
											{#if genItems.length === 0}
												-
											{:else}
												{#each genItems as item (item.name)}
													<span
														class="held-item-name pkdx-info-target"
														{...heldItemTarget(item)}
													>{formatItemName(item.name)}</span>
												{/each}
											{/if}
										</td>
									{:else if col.custom === "encounters"}
										{@const encounters = describeEncounters(row.encounterLocationsAllGens, activeGen)}
										<td title={encounters.tooltip}>{encounters.isEmpty ? "-" : encounters.summary}</td>
									{:else if col.custom === "ev"}
										<td title={formatEvYield(row)}>
											<EvChips evYield={row.evYield} />
										</td>
									{:else}
										<!-- A CustomCell with no branch above: keep the row aligned (tsc skips .svelte). -->
										<td></td>
									{/if}
								{:else}
									<td class:right={col.align === "right"}>{col.render(row)}</td>
								{/if}
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if hoveredSpriteId !== null && previewPos}
		{@const hoveredRow = visibleRows.find((r) => r.id === hoveredSpriteId)}
		{#if hoveredRow?.spriteDataUri}
			<img
				src={hoveredRow.spriteDataUri}
				alt=""
				class="sprite-preview"
				style="top: {previewPos.top}px; left: {previewPos.left}px;"
			/>
		{/if}
	{/if}

	<InfoPopoverBox popover={itemPopover}>
		<span class="held-item-rarity">({openItemRarities.join("/")}%)</span>
		{itemPopover.body}
	</InfoPopoverBox>

	<InfoPopoverBox popover={typePopover}>
		<span class="type-tooltip-text">{typePopover.open}</span>
	</InfoPopoverBox>
</div>

<style>
	.result-count {
		color: var(--lk-text-muted);
		font-size: 0.85em;
		margin: 6px 0;
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
	.table-wrap {
		overflow: auto;
	}
	.table-screen {
		/* Positioning root for .sprite-preview (position: absolute, computed
		relative to this element — see its CSS comment for why). */
		position: relative;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th {
		position: sticky;
		top: 0;
		background: var(--lk-surface);
		cursor: pointer;
		text-align: left;
		padding: 6px 8px;
		white-space: nowrap;
		border-bottom: 2px solid var(--lk-border);
	}
	th:hover {
		color: var(--lk-accent);
	}
	td {
		padding: 4px 8px;
		white-space: nowrap;
		border-top: 1px solid var(--lk-border);
	}
	.center {
		text-align: center;
	}
	.right {
		text-align: right;
	}
	tbody tr:nth-child(even) {
		background: var(--lk-surface-chrome);
	}
	tbody tr {
		cursor: pointer;
	}
	tbody tr:hover {
		background: var(--lk-surface-hover);
	}
	.name-cell {
		text-transform: capitalize;
		font-weight: 600;
	}
	/* inline-block so the target's dotted underline doesn't run under the
	comma (decorations don't propagate into an atomic inline); pre keeps
	its trailing space. */
	.held-item-name:not(:last-child)::after {
		content: ", ";
		display: inline-block;
		white-space: pre;
		cursor: default;
	}
	/* An Info popover target's tap area (styles.src.css, .pkdx-info-target::before)
	spans the row's full height: it reaches well past the cell, and the cell clips
	it, so it ends at the row's edges whatever sets the row's height (the sprite)
	and stays at the target's own width. */
	td.info-target-cell {
		--pkdx-tap-pad-y: 64px;
		overflow: hidden;
	}
	.held-item-rarity {
		font-weight: 600;
	}
	/* The icon is a target without the text targets' underline. */
	.type-icon-target {
		display: inline-flex;
		text-decoration: none;
	}
	.type-tooltip-text {
		text-transform: capitalize;
	}
	.sprite-thumb {
		width: 32px;
		height: 32px;
		image-rendering: pixelated;
	}
	.sprite-preview {
		/* 2x the sprite's native 96x96 resolution, not 200% of the 32px thumb.
		!important: Obsidian's own `body:not(.zoom-off) .view-content img {
		max-width: 100% }` (its click-to-zoom feature) outranks a plain
		two-class selector on specificity (0,2,2 vs 0,2,0).
		position: absolute, relative to .table-screen (not the immediate
		.sprite-cell, and NOT position: fixed) — two separate bugs ruled
		that out: (1) .table-wrap has `overflow: auto`, which clips any
		descendant that pokes outside its box whenever the box is short
		(e.g. a single filtered row) — rules out anchoring to .sprite-cell.
		(2) Obsidian's .workspace-leaf has `contain: strict`, which (like a
		transform) makes it the containing block for `position: fixed`
		descendants instead of the viewport — so a fixed popover positioned
		from a viewport-relative getBoundingClientRect() lands visibly off
		(by however tall the tab bar is). Absolute positioning against a
		container we control (.table-screen, computed at hover time —
		see showPreview) sidesteps both. */
		width: 192px;
		height: 192px;
		max-width: none !important;
		max-height: none !important;
		position: absolute;
		z-index: 50;
		transform: translateY(-50%);
		image-rendering: pixelated;
		background: var(--lk-surface);
		border: 1px solid var(--lk-border);
		border-radius: var(--lk-radius-m);
		box-shadow: var(--lk-shadow-s);
		padding: 6px;
		pointer-events: none;
	}
	table.compact td, table.compact th {
		padding: 2px 6px;
	}
	table.compact .sprite-thumb {
		width: 24px;
		height: 24px;
	}
</style>
