<script lang="ts">
	import type { ActiveGenRow, HeldItemForGen } from "../../utils/activeGenScope";
	import { formatEvYield, unhandledCustomCell } from "../../utils/fields";
	import { formatDexNumber, formatItemName, formatPokemonDisplayName } from "../../utils/pokemonDisplay";
	import type { SortColumn, SortState } from "../../utils/sortPokemon";
	import {
		TABLE_COLUMNS, columnWidth, rememberedRowTextWidths, tableFrame, tableWidestRows, type TableMemory,
	} from "../../utils/tableColumns";
	import { untrack } from "svelte";
	import { tableEntries, tableRowMetrics, tableWindow } from "../../utils/tableWindow";
	import { computeSideAnchoredPreviewPosition } from "../domPosition";
	import { getScroller, isShown, watchViewport } from "../viewportWatch";
	import type { FavoriteMenu } from "../favoriteMenu";
	import { createInfoPopover, type InfoTargetProps } from "../infoPopover.svelte";
	import EvChips from "./EvChips.svelte";
	import FavoriteMark from "./FavoriteMark.svelte";
	import InfoPopoverBox from "./InfoPopoverBox.svelte";
	import Icon from "./Icon.svelte";
	import TypeBadge from "./TypeBadge.svelte";

	// The table (CONTEXT.md, "Table window"): the browse screen's rows drawn as
	// a table, Card view's sibling layout. It owns its drawing, nothing else:
	// rows (already filtered, sorted and Active Gen scoped), the table's Fields
	// selection, the sort and favourites all come from TableScreen, the browse
	// screen's owner, so a switch to or from Card view keeps them. Headers sort
	// through onSort; a row opens the detail screen (onSelect) and favourites
	// through TableScreen's favourites menu.
	//
	// The sprite preview and the type popover position against .table-screen,
	// TableScreen's root (position: relative), found with closest() from the
	// hovered element. So this component draws no wrapper of its own around
	// them, and nothing it draws above them may be positioned: that element
	// would become their containing block, and .table-wrap's overflow: auto
	// clips a preview that pokes out of a short table (see .sprite-preview).
	let {
		rows, fields, density, useTypeIcons, narrow, favoriteIds, sort, onSort, onSelect, favoriteMenu, heldItemTarget,
		memory,
	}: {
		rows: ActiveGenRow[];
		// The table's own Fields selection (ADR-0020): which columns it draws.
		fields: ReadonlySet<string>;
		density: "compact" | "comfortable";
		useTypeIcons: boolean;
		// A Narrow pane: No., sprite and Name pinned, the rest scrolls sideways.
		narrow: boolean;
		favoriteIds: ReadonlySet<number>;
		sort: SortState;
		onSort: (column: SortColumn) => void;
		onSelect: (id: number) => void;
		favoriteMenu: FavoriteMenu;
		// TableScreen's held-item Info popover, shared with Card view's tap
		// panel so both show the same box (rarity included).
		heldItemTarget: (item: HeldItemForGen) => InfoTargetProps;
		// What this table measured before a switch to Card view unmounted it
		// (TableMemory): the row height, the first and last rows' extras, the
		// font and the text widths start from it and are written back.
		memory: TableMemory;
	} = $props();

	// TypeBadge's icon mode already carries a native `title` for the type
	// name, but a native title tooltip is unverifiable through this repo's
	// live-debug tooling (see obsidian-plugin-dev's debugging.md — it never
	// shows up in a screenshot, and reading `.title` alone passes even on an
	// invisible/clipped element) and was reported not actually appearing on
	// hover in the table. This custom popover is a guaranteed-visible
	// fallback, same mechanism as TableScreen's held-item tooltip — only wired
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

	const activeColumns = $derived(
		TABLE_COLUMNS.filter((col) => fields.has(col.key)),
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
	let measuredRowHeight = $state<number | null>(untrack(() => memory.rowHeight));
	const rowHeight = $derived(measuredRowHeight ?? ESTIMATED_ROW_HEIGHT);
	// What the first and last rows add to that: under border-collapse, row 0
	// holds half of the header's 2px border (45.5px) and the last row has no
	// border below it (44.5px). The spacer that replaces either adds the same,
	// or every row moves half a pixel as row 0 leaves the window, and the
	// list's height changes as the last row enters it.
	let leadExtra = $state(untrack(() => memory.leadExtra));
	let tailExtra = $state(untrack(() => memory.tailExtra));

	// The canvas half of widest's text widths: measureText in the table's font
	// (readFont). The cache per row object (createRowTextWidths) keeps a row's
	// widths across streamed updates, sorts, filters and layout switches
	// (memory), and a font change starts a new one with its own canvas.
	let measureFont = $state(untrack(() => memory.font));
	const rowTextWidths = $derived.by(() => {
		const font = measureFont || "14px sans-serif";
		return rememberedRowTextWidths(memory, font, () => {
			const ctx = document.createElement("canvas").getContext("2d");
			if (!ctx) return () => 0;
			ctx.font = font;
			return (text) => ctx.measureText(text).width;
		});
	});
	// Each content-sized column's widest rows, drawn whatever the window
	// (ADR-0019). Which columns get a score, and from what text, is
	// tableWidestRows' (utils/tableColumns.ts).
	const widest = $derived(
		tableWidestRows(rows, { frame, columns: activeColumns, narrow, widths: rowTextWidths }),
	);
	const win = $derived(tableWindow({ count: rows.length, rowHeight, scrollTop, viewportHeight }));
	// Primitives, so a scroll that keeps the same slice re-renders nothing.
	const winStart = $derived(win.start);
	const winEnd = $derived(win.end);
	const entries = $derived(
		tableEntries({ count: rows.length, start: winStart, end: winEnd, extra: widest, rowHeight, leadExtra, tailExtra }),
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
		const metrics = tableRowMetrics(readings, rows.length);
		if (!metrics) return;
		if (metrics.rowHeight !== measuredRowHeight) memory.rowHeight = measuredRowHeight = metrics.rowHeight;
		if (metrics.leadExtra !== undefined && metrics.leadExtra !== leadExtra) memory.leadExtra = leadExtra = metrics.leadExtra;
		if (metrics.tailExtra !== undefined && metrics.tailExtra !== tailExtra) memory.tailExtra = tailExtra = metrics.tailExtra;
	}

	// The table's font, for widest's text widths (rowTextWidths).
	function readFont() {
		if (!tableEl || !isShown(tableEl)) return;
		const font = getComputedStyle(tableEl).font;
		if (font !== measureFont) memory.font = measureFont = font;
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

	function sortIndicator(column: SortColumn): string {
		if (sort.column !== column) return "";
		return sort.direction === "asc" ? " ^" : " v";
	}
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
				<th class="pin pin-number" style:min-width={frame.number.min} onclick={() => onSort("id")}>No.{sortIndicator("id")}</th>
				<!-- "Sprite" does not fit the Narrow pane's 36px column. -->
				<th class="center pin pin-sprite" style:min-width={frame.sprite.min} aria-label="Sprite">{narrow ? "" : "Sprite"}</th>
				<th class="pin pin-name" style:min-width={frame.name.min} onclick={() => onSort("name")}>Name{sortIndicator("name")}</th>
				<th style:min-width={frame.type.min}>Type</th>
				{#each activeColumns as col (col.key)}
					<th
						class:center={!!col.icon}
						class:right={col.align === "right"}
						style:min-width={col.minWidth}
						onclick={() => col.sortKey && onSort(col.sortKey)}
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
			{#each entries as entry (entry.kind === "row" ? rows[entry.index].id : `gap-${entry.key}`)}
				{#if entry.kind === "gap"}
					<!-- Undrawn rows (the Table window): one spacer of their exact
					height, so the scroll offset keeps its meaning. -->
					<tr class="gap" aria-hidden="true"><td colspan={columnCount} style:height="{entry.height}px"></td></tr>
				{:else}
				{@const row = rows[entry.index]}
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

{#if hoveredSpriteId !== null && previewPos}
	{@const hoveredRow = rows.find((r) => r.id === hoveredSpriteId)}
	{#if hoveredRow?.spriteDataUri}
		<img
			src={hoveredRow.spriteDataUri}
			alt=""
			class="sprite-preview"
			style="top: {previewPos.top}px; left: {previewPos.left}px;"
		/>
	{/if}
{/if}

<InfoPopoverBox popover={typePopover}>
	<span class="type-tooltip-text">{typePopover.open}</span>
</InfoPopoverBox>

<style>
	.table-wrap {
		overflow: auto;
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
