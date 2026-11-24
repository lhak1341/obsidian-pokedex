<script lang="ts">
	import type { PokedexRepository } from "../../data/PokedexRepository";
	import type { PokedexTableRow } from "../../data/types";
	import { EMPTY_FILTERS, filterPokemon } from "../../utils/filterPokemon";
	import { type HeldItemForGen, scopeRowsToActiveGen } from "../../utils/activeGenScope";
	import { formatDexNumber, formatItemName, formatPokemonDisplayName } from "../../utils/pokemonDisplay";
	import type { BrowseLayout } from "../../utils/browseLayout";
	import { nextSort, sortPokemon, type SortColumn, type SortState } from "../../utils/sortPokemon";
	import {
		FIELDS, fieldsShown, formatEvYield, isStatField, isTileField, sortAfterFieldsChange, unhandledCustomCell,
	} from "../../utils/fields";
	import {
		TABLE_COLUMNS, columnWidth, createRowTextWidths, tableFrame, tableWidestRows,
	} from "../../utils/tableColumns";
	import { tableEntries, tableRowMetrics, tableWindow } from "../../utils/tableWindow";
	import { onDestroy, untrack } from "svelte";
	import { computeSideAnchoredPreviewPosition } from "../domPosition";
	import { getScroller, isShown, watchViewport } from "../viewportWatch";
	import { createInfoDescription } from "../infoDescription.svelte";
	import { createInfoPopover } from "../infoPopover.svelte";
	import { createFavoriteMenu } from "../favoriteMenu";
	import CardGrid from "./CardGrid.svelte";
	import { CARD_SIZE_LABELS, CARD_SIZES, type CardSize } from "../../utils/cardView";
	import EvChips from "./EvChips.svelte";
	import FavoriteMark from "./FavoriteMark.svelte";
	import FilterBar from "./FilterBar.svelte";
	import InfoPopoverBox from "./InfoPopoverBox.svelte";
	import Icon from "./Icon.svelte";
	import TypeBadge from "./TypeBadge.svelte";

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
	const activeColumns = $derived(
		TABLE_COLUMNS.filter((col) => visibleFieldKeys.has(col.key)),
	);
	// The No./sprite/Name/Type widths (tableFrame) swing with density, the
	// icon-vs-text type display and the Narrow pane; everything else has one
	// fixed min regardless of row content (see each Field's TABLE_GEOMETRY
	// `widthPercent`/`minWidth` in tableColumns.ts). The table
	// deliberately stays table-layout: auto (not fixed) — fixed's column
	// sizing pass ignores min-width/max-width entirely by design (that's the
	// point of "fixed"), which silently broke every column's floor. Under
	// auto, `min` is a real min-width on each <th> (a designed buffer, e.g.
	// EV's 3-chip case, or ch for Name's ~20-letter one) and `width` is the
	// <col>'s width (px on a Narrow pane: see columnWidth) — Name's larger
	// share means it still absorbs most of any extra space on a wide pane,
	// just no longer *all* of it. Cells must NOT
	// get overflow/text-overflow: ellipsis (see td/th CSS) — that collapses
	// a cell's intrinsic min-content width down to ~1 char, which defeats
	// auto layout's real safety net: never shrinking below actual content.
	const frame = $derived(tableFrame({ narrow, density, useTypeIcons }));
	const columnCount = $derived(4 + activeColumns.length);

	// The Table window (CONTEXT.md, utils/tableWindow.ts, ADR-0019): only the
	// rows near the viewport are drawn, plus each content-sized column's widest
	// rows, so the auto table sizes its columns as it would from every row.
	// Spacer rows stand in for the rest. As Card view's window, its inputs are
	// read from the scroller (getScroller) and from drawn rows, and frozen
	// while the detail screen hides the table (every read is 0 then), so
	// back-to-list's restored scroll offset finds the same rows drawn.
	let tableEl = $state<HTMLTableElement | undefined>();
	let bodyEl = $state<HTMLTableSectionElement | undefined>();
	let scrollTop = $state(0);
	let viewportHeight = $state(0);
	// Every row is one height (the sprite's; no cell wraps, so EV chips stay
	// on one line). Measured from two adjacent drawn rows; the estimate
	// serves only a fresh mount's first draw.
	const ESTIMATED_ROW_HEIGHT = 45;
	let measuredRowHeight = $state<number | null>(null);
	const rowHeight = $derived(measuredRowHeight ?? ESTIMATED_ROW_HEIGHT);
	// What the first and last rows add to that: under border-collapse, row 0
	// holds half of the header's 2px border (45.5px) and the last row has no
	// border below it (44.5px). The spacer that replaces either adds the same,
	// or every row moves half a pixel as row 0 leaves the window, and the
	// list's height changes as the last row enters it.
	let leadExtra = $state(0);
	let tailExtra = $state(0);

	// The canvas half of widest's text widths: measureText in the table's font
	// (readFont). The cache per row object (createRowTextWidths) keeps a row's
	// widths across streamed updates, sorts and filters, and a font change
	// starts a new one.
	let measureFont = $state("");
	const measureCtx = document.createElement("canvas").getContext("2d");
	const rowTextWidths = $derived.by(() => {
		const ctx = measureCtx;
		if (!ctx) return createRowTextWidths(() => 0);
		// Set once per font: only the newest measure is ever called.
		ctx.font = measureFont || "14px sans-serif";
		return createRowTextWidths((text) => ctx.measureText(text).width);
	});
	// Each content-sized column's widest rows, drawn whatever the window
	// (ADR-0019). Which columns get a score, and from what text, is
	// tableWidestRows' (utils/tableColumns.ts).
	const widest = $derived(
		tableWidestRows(visibleRows, { frame, columns: activeColumns, narrow, widths: rowTextWidths }),
	);
	const win = $derived(tableWindow({ count: visibleRows.length, rowHeight, scrollTop, viewportHeight }));
	// Primitives, so a scroll that keeps the same slice re-renders nothing.
	const winStart = $derived(win.start);
	const winEnd = $derived(win.end);
	const entries = $derived(
		tableEntries({ count: visibleRows.length, start: winStart, end: winEnd, extra: widest, rowHeight, leadExtra, tailExtra }),
	);

	// The row height and the first and last rows' extras (leadExtra above),
	// from the drawn rows: tableRowMetrics holds the rules.
	function measureRows() {
		const el = bodyEl;
		if (!el || !isShown(el)) return;
		const readings = [...el.querySelectorAll<HTMLElement>(":scope > tr[data-index]")].map((row) => {
			const rect = row.getBoundingClientRect();
			return { index: Number(row.dataset.index), top: rect.top, height: rect.height };
		});
		const metrics = tableRowMetrics(readings, visibleRows.length);
		if (!metrics) return;
		if (metrics.rowHeight !== measuredRowHeight) measuredRowHeight = metrics.rowHeight;
		if (metrics.leadExtra !== undefined && metrics.leadExtra !== leadExtra) leadExtra = metrics.leadExtra;
		if (metrics.tailExtra !== undefined && metrics.tailExtra !== tailExtra) tailExtra = metrics.tailExtra;
	}

	// The table's font, for widest's text widths (rowTextWidths).
	function readFont() {
		if (!tableEl || !isShown(tableEl)) return;
		const font = getComputedStyle(tableEl).font;
		if (font !== measureFont) measureFont = font;
	}

	// Scroll and viewport, relative to the table body's top edge. FilterBar
	// above the table (its inline Filters panel) can move the body without a
	// scroll, so the screen's own size changes re-read too.
	const scrollerOf = getScroller();
	$effect(() => {
		const el = bodyEl;
		const scroller = scrollerOf();
		if (!el || !scroller) return;
		return watchViewport(el, scroller, el.closest(".table-screen"), (r) => {
			scrollTop = r.scrollTop;
			viewportHeight = r.viewportHeight;
		});
	});

	// Drawn rows are measured a frame after they change, or after the body
	// resizes (a font, density or width change), as CardGrid does: a write
	// from inside the observer would re-lay the table out in the same frame.
	$effect(() => {
		const el = bodyEl;
		void entries;
		if (!el) return;
		let raf = 0;
		const schedule = () => {
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = 0;
				readFont();
				measureRows();
			});
		};
		const ro = new ResizeObserver(schedule);
		ro.observe(el);
		schedule();
		return () => {
			ro.disconnect();
			cancelAnimationFrame(raf);
		};
	});

	function setSort(column: SortColumn) {
		sort = nextSort(sort, column);
	}

	function sortIndicator(column: SortColumn): string {
		if (sort.column !== column) return "";
		return sort.direction === "asc" ? " ^" : " v";
	}

	// Favouriting from a list is a menu (right-click or press and hold), on
	// table rows and Card view tiles alike: their favourite dot is a marker only
	// (#35). Reads favoriteIds when it opens, so it never shows a stale title.
	const favoriteMenu = createFavoriteMenu({
		isFavorite: (id) => favoriteIds.has(id),
		onToggle: (id) => onToggleFavorite(id),
	});
	onDestroy(() => favoriteMenu.destroy());
</script>

<!-- A name with a favourite's dot just past its end (#35): placed absolutely,
so the dot never widens Name or moves the name. Every row draws the dot and a
favourite only shows it: adding or removing it lays the whole table-layout:
auto table out again (86-406 ms at 4x, narrow), a visibility change does not
(ADR-0017). visibility: hidden also keeps its "Favorite" label out of the
accessibility tree. -->
{#snippet markedName(name: string, favorite: boolean)}
	<span class="marked-name">{name}<span class="name-dot" class:shown={favorite}><FavoriteMark /></span></span>
{/snippet}

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
		<div class="table-wrap">
			<!-- A Narrow pane's table scrolls sideways under the pinned No.,
			sprite and Name (.pin, CSS below). Each pinned column's left offset
			is the widths before it, taken from the frame so the CSS never
			restates them (only read on a Narrow pane, where they are px). -->
			<table
				bind:this={tableEl}
				class:compact={frame.compact}
				class:narrow
				style:--pkdx-pin-sprite-left={frame.number.width}
				style:--pkdx-pin-name-left="calc({frame.number.width} + {frame.sprite.width})"
			>
				<colgroup>
					<col style:width={frame.number.width} />
					<col style:width={frame.sprite.width} />
					<col style:width={frame.name.width} />
					<col style:width={frame.type.width} />
					{#each activeColumns as col (col.key)}
						<col style:width={columnWidth(col, narrow)} />
					{/each}
				</colgroup>
				<thead>
					<tr>
						<th class="pin pin-number" style:min-width={frame.number.min} onclick={() => setSort("id")}>No.{sortIndicator("id")}</th>
						<!-- "Sprite" does not fit the Narrow pane's 36px column. -->
						<th class="center pin pin-sprite" style:min-width={frame.sprite.min} aria-label="Sprite">{narrow ? "" : "Sprite"}</th>
						<th class="pin pin-name" style:min-width={frame.name.min} onclick={() => setSort("name")}>Name{sortIndicator("name")}</th>
						<th style:min-width={frame.type.min}>Type</th>
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
				<tbody bind:this={bodyEl}>
					{#each entries as entry (entry.kind === "row" ? visibleRows[entry.index].id : `gap-${entry.key}`)}
						{#if entry.kind === "gap"}
							<!-- Undrawn rows (the Table window): one spacer of their exact
							height, so the scroll offset keeps its meaning. -->
							<tr class="gap" aria-hidden="true"><td colspan={columnCount} style:height="{entry.height}px"></td></tr>
						{:else}
						{@const row = visibleRows[entry.index]}
						<!-- Striped by list position, not nth-child: spacer rows and
						the window's start would shift the parity. -->
						<tr
							data-index={entry.index}
							class:stripe={entry.index % 2 === 1}
							onclick={() => onSelect(row.id)}
							{...favoriteMenu.target(row.id)}
						>
							<td class="pin pin-number">{formatDexNumber(row.dexNumber)}</td>
							<td
								class="center sprite-cell pin pin-sprite"
								onpointerenter={(e) => {
									// The Art preview is a mouse-hover affordance; a tap on the
									// sprite opens the detail screen and nothing else.
									if (e.pointerType === "mouse") showPreview(row.id, e.currentTarget);
								}}
								onpointerleave={hidePreview}
							>
								<!-- A row without a sprite keeps the sprite's box, so every row
								is one height (the Table window's spacers count on it). -->
								{#if row.spriteDataUri}
									<img src={row.spriteDataUri} alt={formatPokemonDisplayName(row)} class="sprite-thumb" />
								{:else}
									<span class="sprite-thumb"></span>
								{/if}
							</td>
							<td class="name-cell pin pin-name">
								{#if narrow}
									<!-- The base name over an 11px regional-form line, so the
									112px column keeps the base name whole (Sandy Shocks is 98px)
									with room for a favourite's dot after it. -->
									<span class="base-name">{@render markedName(row.name, favoriteIds.has(row.id))}</span>
									{#if row.formLabel}<span class="form-line">{row.formLabel}</span>{/if}
								{:else}
									{@render markedName(formatPokemonDisplayName(row), favoriteIds.has(row.id))}
								{/if}
							</td>
							<td class="info-target-cell type-cell">
								{#each row.types as type (type)}
									{#if frame.typeIcons}
										<span class="type-icon-target pkdx-info-target" {...typePopover.target(type)}>
											<TypeBadge {type} useIcon small={narrow} />
										</span>
									{:else}
										<TypeBadge {type} />
									{/if}
								{/each}
							</td>
							{#each activeColumns as col (col.key)}
								{#if col.custom}
									{#if col.custom === "heldItems"}
										{@const genItems = row.heldItems}
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
									{:else if col.custom === "ev"}
										<td class="ev-cell" title={formatEvYield(row)}>
											<EvChips evYield={row.evYield} />
										</td>
									{:else}
										<td>{unhandledCustomCell(col.custom)}</td>
									{/if}
								{:else}
									<td class:right={col.align === "right"} title={col.title?.(row)}>{col.render(row)}</td>
								{/if}
							{/each}
						</tr>
						{/if}
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
	/* The row's stripe or hover colour is set once as --pkdx-row-bg, read by
	the row and again by a Narrow pane's pinned cells (below), which must
	paint it themselves to stay opaque. */
	/* A press and hold opens the favourites menu (favoriteMenu.ts): iOS's
	own selection and callout must not answer it first. */
	tbody tr {
		--pkdx-row-bg: transparent;
		background: var(--pkdx-row-bg);
		cursor: pointer;
		-webkit-touch-callout: none;
		user-select: none;
	}
	tbody tr.stripe {
		--pkdx-row-bg: var(--lk-surface-chrome);
	}
	tbody tr:not(.gap):hover {
		--pkdx-row-bg: var(--lk-surface-hover);
	}
	tbody tr.gap {
		cursor: default;
	}
	/* A spacer keeps the rows' top border: under border-collapse, the row
	after a borderless spacer came out 0.5px short, so each spacer moved
	everything below it up by half a pixel. */
	tbody tr.gap td {
		padding: 0;
	}
	/* One line of chips: a wrapped EV cell (three chips in the Narrow pane's
	204px) made its row taller than the rest, and the Table window needs every
	row one height. The column widens to the chips instead. */
	td.ev-cell :global(.ev-chips) {
		flex-wrap: nowrap;
	}
	.name-cell {
		text-transform: capitalize;
		font-weight: 600;
	}
	/* A favourite's dot: 1px past the name, a little below the top of its
	line (0.125em is 1.75px at the narrow table's 14px). Past the last letter,
	not over it, so no letter's height can touch it. */
	.marked-name {
		position: relative;
		display: inline-block;
	}
	.name-dot {
		position: absolute;
		top: 0.125em;
		left: calc(100% + 1px);
		visibility: hidden;
	}
	.name-dot.shown {
		visibility: visible;
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
		display: inline-block;
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
	/* Narrow pane: the table scrolls sideways inside .table-wrap with No.,
	sprite and Name pinned. Their left offsets (--pkdx-pin-*-left, set on the
	table from tableFrame) add up the columns before them, so those columns'
	content must fit their px widths exactly. A pinned cell is opaque (the
	view's surface under the row's --pkdx-row-bg), or the stats would show
	through it as they scroll under. The divider is an inset shadow: under
	border-collapse a border belongs to the table, not the cell, and stays
	behind when the cell sticks. */
	/* 6px a side: at 8px a sorted stat header (icon and arrow) measured 53px,
	past the 52px a stat column keeps. */
	table.narrow th {
		padding-inline: 6px;
	}
	table.narrow .pin {
		position: sticky;
		z-index: 1;
		background: linear-gradient(var(--pkdx-row-bg), var(--pkdx-row-bg)), var(--lk-surface);
	}
	table.narrow th.pin {
		z-index: 2;
		background: var(--lk-surface);
	}
	/* No horizontal padding: a 4-digit dex number at 12px tabular figures is
	30.2px, and 2px a side made the column 34.2px, so the sprite (pinned at
	32px) slid 2px over it once scrolled. Centred, a 3-digit one sits in the middle. */
	table.narrow .pin-number {
		left: 0;
		padding-inline: 0;
		text-align: center;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		color: var(--lk-text-muted);
	}
	/* "No." and its sort arrow wrap onto two lines rather than widen 32px. */
	table.narrow th.pin-number {
		white-space: normal;
	}
	table.narrow .pin-sprite {
		left: var(--pkdx-pin-sprite-left);
		padding-inline: 2px;
	}
	/* 5px a side: the longest base name (Sandy Shocks) is 98px, and 112px
	leaves it room for a favourite's dot (6px) 2px clear of the divider. */
	table.narrow .pin-name {
		left: var(--pkdx-pin-name-left);
		padding-inline: 5px;
		box-shadow: inset -1px 0 var(--lk-border-strong);
	}
	/* The name never breaks, so Name's min-content is the name alone. */
	table.narrow .base-name {
		display: block;
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.25;
		white-space: nowrap;
	}
	/* width: 0 + min-width: 100% keeps the form line out of the cell's
	min-content width, so the base name alone sizes Name and a long label
	(Paldean (Combat Breed)) ellipsizes instead of widening the column. */
	table.narrow .form-line {
		display: block;
		width: 0;
		min-width: 100%;
		overflow: hidden;
		font-size: 0.69rem;
		font-weight: 400;
		line-height: 1.2;
		text-overflow: ellipsis;
		color: var(--lk-text-muted);
	}
	/* Two 22px icons and a 3px gap in 58px. font-size: 0 drops the
	whitespace between the targets, which would add to the gap. */
	table.narrow td.type-cell {
		padding-inline: 5px;
		font-size: 0;
	}
	table.narrow .type-icon-target + .type-icon-target {
		margin-left: 3px;
	}
	table.compact .sprite-thumb {
		width: 24px;
		height: 24px;
	}
</style>
