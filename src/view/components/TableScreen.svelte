<script lang="ts">
	import { Menu } from "obsidian";
	import { STAT_COLORS } from "../../data/constants";
	import type { PokedexRepository } from "../../data/PokedexRepository";
	import type { PokedexTableRow } from "../../data/types";
	import { EMPTY_FILTERS, filterPokemon } from "../../utils/filterPokemon";
	import { filterEncounterLocationsForGen } from "../../utils/encounterGen";
	import { filterHeldItemsForGen } from "../../utils/heldItemGen";
	import { formatPokedollarSigns } from "../../utils/pokedollar";
	import { formatPokemonDisplayName } from "../../utils/pokemonDisplay";
	import { sortPokemon, type SortColumn, type SortDirection } from "../../utils/sortPokemon";
	import {
		formatEncounterLocationsPlain, formatItemName, groupEncounterLocations, STAT_LABEL_BY_KEY,
		summarizeAcquisitionMethods, TOGGLEABLE_COLUMNS,
	} from "../../utils/tableColumns";
	import { untrack } from "svelte";
	import { computeSideAnchoredPreviewPosition } from "../domPosition";
	import { createHoverDescription } from "../hoverDescription.svelte";
	import { createHoverPopover } from "../hoverPopover.svelte";
	import FilterBar from "./FilterBar.svelte";
	import HoverPopoverBox from "./HoverPopoverBox.svelte";
	import Icon from "./Icon.svelte";
	import TypeBadge from "./TypeBadge.svelte";

	let {
		rows, density, defaultSortColumn, initialVisibleColumns, useTypeIcons, repository, activeGen,
		initialFavoriteIds, onColumnsChange, onFavoritesChange, onSelect,
	}: {
		rows: PokedexTableRow[];
		density: "compact" | "comfortable";
		defaultSortColumn: "id" | "name";
		initialVisibleColumns: string[];
		useTypeIcons: boolean;
		repository: PokedexRepository;
		activeGen: number;
		initialFavoriteIds: number[];
		onColumnsChange: (columns: string[]) => void;
		onFavoritesChange: (ids: number[]) => void;
		onSelect: (id: number) => void;
	} = $props();

	// Same fetch-once-and-cache-per-name hook as DetailScreen's HeldItemsPanel
	// (see hoverDescription.svelte.ts) — shared across every row/cell instead
	// of a per-cell instance, so hovering "oran-berry" on row 4 doesn't
	// re-fetch it after already hovering it on row 1.
	const itemPopover = createHoverDescription(".table-screen", (name) => repository.getItemDescription(name));
	// Unlike HeldItemsPanel (which prints "Name (X%)" inline and keeps the
	// tooltip to description-only), the table cell shows bare names to save
	// column width — rarity moves into the tooltip instead. Rarity isn't
	// keyed by item name like the description cache: the same item name can
	// carry a different % on a different row, so this tracks whichever
	// row/item is currently hovered directly, set alongside itemPopover.show.
	let hoveredItemRarities = $state<number[]>([]);

	// TypeBadge's icon mode already carries a native `title` for the type
	// name, but a native title tooltip is unverifiable through this repo's
	// live-debug tooling (see obsidian-plugin-dev's debugging.md — it never
	// shows up in a screenshot, and reading `.title` alone passes even on an
	// invisible/clipped element) and was reported not actually appearing on
	// hover in the table. This custom popover is a guaranteed-visible
	// fallback, same mechanism as the held-item tooltip above — only wired
	// up in icon mode, since text mode already shows the type name directly.
	const typePopover = createHoverPopover(".table-screen");

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
		// hoverPopover.svelte.ts's MIN_SPACE_BELOW flip already prevents for
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

	let filters = $state({ ...EMPTY_FILTERS, statRanges: {} });
	// Only the initial value seeds local state — same reasoning as
	// defaultSortColumn below, this shouldn't get clobbered by prop identity
	// changes once the user starts toggling columns.
	let visibleColumnKeys = $state(new Set(untrack(() => initialVisibleColumns)));
	// Only the initial value of defaultSortColumn seeds local sort state —
	// the user's in-table sort choice shouldn't get clobbered if it changes.
	let sortColumn = $state<SortColumn>(untrack(() => defaultSortColumn));
	let sortDirection = $state<SortDirection>("asc");
	// Same "seed once, own it locally, push changes up via callback" shape as
	// visibleColumnKeys/toggleColumn below.
	let favoriteIds = $state(new Set(untrack(() => initialFavoriteIds)));

	const abilityOptions = $derived(
		[...new Set(rows.flatMap((r) => r.abilityNames))].sort(),
	);
	const visibleRows = $derived(
		sortPokemon(filterPokemon(rows, filters, { favoriteIds, activeGen }), sortColumn, sortDirection),
	);
	const activeColumns = $derived(
		TOGGLEABLE_COLUMNS.filter((col) => visibleColumnKeys.has(col.key)),
	);
	// No. is a dex number (up to 4 digits) vs a stat's 3; sprite/type widths
	// swing with density and the icon-vs-text type display respectively —
	// everything else has one fixed min regardless of row content (see each
	// ColumnDef's own `widthPercent`/`minWidth` in tableColumns.ts). The table
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
		if (sortColumn === column) {
			sortDirection = sortDirection === "asc" ? "desc" : "asc";
		} else {
			sortColumn = column;
			sortDirection = "asc";
		}
	}

	function sortIndicator(column: SortColumn): string {
		if (sortColumn !== column) return "";
		return sortDirection === "asc" ? " ^" : " v";
	}

	function toggleColumn(key: string) {
		const next = new Set(visibleColumnKeys);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		visibleColumnKeys = next;
		onColumnsChange([...next]);
	}

	function toggleFavorite(id: number) {
		const next = new Set(favoriteIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		favoriteIds = next;
		onFavoritesChange([...next]);
	}

	function showRowMenu(e: MouseEvent, row: PokedexTableRow) {
		e.preventDefault();
		const isFavorite = favoriteIds.has(row.id);
		const menu = new Menu();
		menu.addItem((item) =>
			item
				.setTitle(isFavorite ? "Remove from favorites" : "Add to favorites")
				.setIcon("asterisk")
				.onClick(() => toggleFavorite(row.id))
		);
		menu.showAtMouseEvent(e);
	}
</script>

<div class="table-screen">
	<FilterBar bind:filters {abilityOptions} {useTypeIcons} {rows} onQuickSelect={onSelect} />

	<details class="column-toggle">
		<summary>
			<Icon name="columns-3" size={14} strokeWidth={2} />
			<span>Columns</span>
		</summary>
		<div class="column-checkbox-list">
			<div class="column-section">
				<div class="column-section-label">Stats</div>
				<div class="column-grid column-grid-stats">
					{#each TOGGLEABLE_COLUMNS.filter((c) => !c.headerIcon) as col (col.key)}
						<label class="column-checkbox">
							<input
								type="checkbox"
								checked={visibleColumnKeys.has(col.key)}
								onchange={() => toggleColumn(col.key)}
							/>
							{col.label}
						</label>
					{/each}
				</div>
			</div>
			<div class="column-section">
				<div class="column-section-label">Other</div>
				<div class="column-grid column-grid-other">
					{#each TOGGLEABLE_COLUMNS.filter((c) => c.headerIcon) as col (col.key)}
						<label class="column-checkbox">
							<input
								type="checkbox"
								checked={visibleColumnKeys.has(col.key)}
								onchange={() => toggleColumn(col.key)}
							/>
							<Icon name={col.headerIcon ?? "circle"} size={13} strokeWidth={2} />
							{col.label}
						</label>
					{/each}
				</div>
			</div>
		</div>
	</details>

	<p class="result-count">{visibleRows.length} of {rows.length} Pokemon</p>

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
							class:center={!!col.headerIcon}
							class:right={col.align === "right"}
							style:min-width={col.minWidth}
							onclick={() => col.sortKey && setSort(col.sortKey)}
							title={col.label}
						>
							{#if col.headerIcon}
								<Icon name={col.headerIcon} />
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
						<td>{String(row.dexNumber).padStart(3, "0")}</td>
						<td
							class="center sprite-cell"
							onmouseenter={(e) => showPreview(row.id, e.currentTarget)}
							onmouseleave={hidePreview}
						>
							{#if row.spriteDataUri}
								<img src={row.spriteDataUri} alt={formatPokemonDisplayName(row)} class="sprite-thumb" />
							{/if}
						</td>
						<td class="name-cell">
						{formatPokemonDisplayName(row)}
						{#if favoriteIds.has(row.id)}
							<span class="favorite-mark" title="Favorited">
								<Icon name="asterisk" size={13} strokeWidth={2.5} />
							</span>
						{/if}
					</td>
						<td>
							{#each row.types as type (type)}
								{#if useTypeIcons}
									<span
										class="type-icon-hover-target"
										role="note"
										onmouseenter={(e) => typePopover.show(type, e.currentTarget)}
										onmouseleave={typePopover.hide}
									>
										<TypeBadge {type} useIcon />
									</span>
								{:else}
									<TypeBadge {type} />
								{/if}
							{/each}
						</td>
						{#each activeColumns as col (col.key)}
							{#if col.key === "ev"}
								<td title={col.render(row)}>
									<div class="ev-cell">
										{#each row.evYield as y (y.stat)}
											<span class="ev-chip" style:--ev-color={STAT_COLORS[y.stat]}>
												{y.amount} {STAT_LABEL_BY_KEY.get(y.stat) ?? y.stat}
											</span>
										{:else}
											<span class="ev-empty">-</span>
										{/each}
									</div>
								</td>
							{:else if col.key === "heldItems"}
								{@const genItems = filterHeldItemsForGen(row.heldItems, activeGen)}
								<td>
									{#if genItems.length === 0}
										-
									{:else}
										{#each genItems as item (item.name)}
											<span
												class="held-item-name"
												role="note"
												onmouseenter={(e) => {
													itemPopover.show(item.name, e.currentTarget);
													hoveredItemRarities = item.rarities;
												}}
												onmouseleave={itemPopover.hide}
											>{formatItemName(item.name)}</span>
										{/each}
									{/if}
								</td>
							{:else if col.key === "encounterLocation"}
								{@const activeLocations = filterEncounterLocationsForGen(row.encounterLocations, activeGen)}
								<td title={formatEncounterLocationsPlain(groupEncounterLocations(activeLocations))}>
									{activeLocations.length === 0 ? "-" : summarizeAcquisitionMethods(activeLocations)}
								</td>
							{:else}
								<td class:right={col.align === "right"}>{col.render(row)}</td>
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

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

	<HoverPopoverBox hoverState={itemPopover}>
		<span class="held-item-rarity">({hoveredItemRarities.join("/")}%)</span>
		{#if !itemPopover.status}
			Loading…
		{:else if itemPopover.status === "error"}
			Couldn't load description.
		{:else}
			{itemPopover.status.text ? formatPokedollarSigns(itemPopover.status.text) : "No description available."}
		{/if}
	</HoverPopoverBox>

	<HoverPopoverBox hoverState={typePopover}>
		<span class="type-tooltip-text">{typePopover.hovered}</span>
	</HoverPopoverBox>
</div>

<style>
	.result-count {
		color: var(--text-muted);
		font-size: 0.85em;
		margin: 6px 0;
	}
	.column-toggle {
		position: relative;
		margin-bottom: var(--size-4-3);
	}
	.column-toggle summary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		padding: 5px 10px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		list-style: none;
		user-select: none;
		color: var(--text-muted);
		transition: background-color 100ms ease-out, color 100ms ease-out;
	}
	.column-toggle summary::-webkit-details-marker {
		display: none;
	}
	.column-toggle summary:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}
	.column-toggle summary::after {
		content: "";
		width: 12px;
		height: 12px;
		margin-left: 2px;
		background-color: var(--text-faint);
		-webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") center / contain no-repeat;
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") center / contain no-repeat;
		transition: transform 100ms ease-out;
	}
	.column-toggle[open] summary::after {
		transform: rotate(180deg);
	}
	.column-toggle[open] summary {
		background: color-mix(in srgb, var(--interactive-accent) 12%, transparent);
		color: var(--interactive-accent);
		border-color: color-mix(in srgb, var(--interactive-accent) 40%, var(--background-modifier-border));
	}
	.column-checkbox-list {
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
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		box-shadow: var(--shadow-s);
	}
	.column-section + .column-section {
		padding-top: 10px;
		border-top: 1px solid var(--background-modifier-border);
	}
	.column-section-label {
		margin-bottom: 4px;
		font-size: 0.7em;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-faint);
	}
	.column-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2px 8px;
	}
	.column-grid-other {
		grid-template-columns: repeat(2, 1fr);
	}
	.column-checkbox {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 6px;
		border-radius: 4px;
		font-size: 0.85em;
		cursor: pointer;
		color: var(--text-muted);
		transition: background-color 100ms ease-out, color 100ms ease-out;
	}
	.column-checkbox:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
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
		background: var(--background-primary);
		cursor: pointer;
		text-align: left;
		padding: 6px 8px;
		white-space: nowrap;
		border-bottom: 2px solid var(--background-modifier-border);
	}
	th:hover {
		color: var(--interactive-accent);
	}
	td {
		padding: 4px 8px;
		white-space: nowrap;
		border-top: 1px solid var(--background-modifier-border);
	}
	.center {
		text-align: center;
	}
	.right {
		text-align: right;
	}
	tbody tr:nth-child(even) {
		background: var(--background-secondary);
	}
	tbody tr {
		cursor: pointer;
	}
	tbody tr:hover {
		background: var(--background-modifier-hover);
	}
	.name-cell {
		text-transform: capitalize;
		font-weight: 600;
	}
	.favorite-mark {
		display: inline-flex;
		vertical-align: middle;
		margin-left: 4px;
		color: var(--interactive-accent);
	}
	.ev-cell {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	/* Same STAT_COLORS hue per stat as the detail screen's StatBars/BarRow —
	but, like BarRow, that color stays an accent (dot + tinted background/
	border via color-mix) rather than the text fill: several of these hues
	(hp's lime, attack's yellow) read poorly as small text on a light theme's
	near-white background, so the label itself stays var(--text-normal). */
	.ev-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 8px 2px 6px;
		border-radius: 999px;
		font-size: 0.78em;
		font-weight: 600;
		white-space: nowrap;
		color: var(--text-normal);
		background: color-mix(in srgb, var(--ev-color) 14%, var(--background-primary));
		border: 1px solid color-mix(in srgb, var(--ev-color) 45%, var(--background-modifier-border));
	}
	.ev-chip::before {
		content: "";
		width: 7px;
		height: 7px;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--ev-color);
	}
	.ev-empty {
		color: var(--text-faint);
	}
	.held-item-name {
		cursor: help;
	}
	.held-item-name:not(:last-child)::after {
		content: ", ";
		cursor: default;
	}
	.held-item-rarity {
		font-weight: 600;
	}
	.type-icon-hover-target {
		display: inline-flex;
		cursor: help;
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
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m, 8px);
		box-shadow: var(--shadow-s);
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
