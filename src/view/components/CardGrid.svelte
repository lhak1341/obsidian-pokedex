<script lang="ts">
	import { tick } from "svelte";
	import { SvelteMap } from "svelte/reactivity";
	import { STAT_COLORS, TYPE_COLORS } from "../../data/constants";
	import type { PokedexRepository } from "../../data/PokedexRepository";
	import type { PokedexTableRow } from "../../data/types";
	import {
		CARD_GRID_GAP, cardGrid, cardWindow, type ContentBounds, fitSprite, isTallCardRow, panelChips, panelPlacement,
		panelStats, sortChips, type SpritePlacement, statStrip, tileCorners,
	} from "../../utils/cardView";
	import { formatEvYield, STAT_LABEL_BY_KEY } from "../../utils/fields";
	import { formatDexNumber, formatPokemonDisplayName } from "../../utils/pokemonDisplay";
	import type { SortColumn, SortState } from "../../utils/sortPokemon";
	import { totalStat } from "../../utils/stats";
	import type { HeldItemForGen } from "../../utils/heldItemGen";
	import { contentBounds } from "../imageBounds";
	import type { FavoriteMenu } from "../favoriteMenu";
	import type { InfoTargetProps } from "../infoPopover.svelte";
	import CardPanel from "./CardPanel.svelte";

	// Card view (CONTEXT.md): the browse screen's rows drawn as a grid of tiles.
	// It owns its drawing and which tap panel is open, nothing else: rows (already filtered, sorted and Active
	// Gen scoped), the Fields selection, the sort and favourites all come from
	// TableScreen, the browse screen's owner, so a switch to or from the table
	// keeps them. A favourite's tile is outlined in the accent, a marker only
	// (no accidental toggles while scrolling): a tile favourites through TableScreen's favourites menu
	// (right-click or press and hold, as a table row does), and the tap panel
	// keeps its asterisk toggle. A tile tap opens the tap panel; the panel's
	// "Open ›" opens the detail screen (onSelect).
	let {
		rows, visibleFields, favoriteIds, sort, repository, activeGen, onSort, onSelect, onToggleFavorite, favoriteMenu,
		heldItemTarget,
	}: {
		rows: PokedexTableRow[];
		visibleFields: ReadonlySet<string>;
		favoriteIds: ReadonlySet<number>;
		sort: SortState;
		repository: PokedexRepository;
		activeGen: number;
		onSort: (column: SortColumn) => void;
		onSelect: (id: number) => void;
		onToggleFavorite: (id: number) => void;
		favoriteMenu: FavoriteMenu;
		// TableScreen's held-item Info popover, so its box (rarity included)
		// is the table's own and draws over the panel.
		heldItemTarget: (item: HeldItemForGen) => InfoTargetProps;
	} = $props();

	let gridEl = $state<HTMLDivElement | undefined>();
	let gridWidth = $state(0);
	const grid = $derived(cardGrid(gridWidth));
	const corners = $derived(tileCorners(visibleFields));
	const strip = $derived(statStrip(rows, visibleFields));
	const chips = $derived(sortChips(visibleFields));
	const panelStatCols = $derived(panelStats(visibleFields));
	const panelFieldChips = $derived(panelChips(visibleFields));

	// The tap panel is an accordion: one open at a time, under its tile's grid
	// row. Held by id, so a re-sort or filter moves it with its tile; a filter
	// that drops the tile hides it.
	let openId = $state<number | null>(null);
	// Unique per grid: two Pokedex leaves can each have a panel open.
	const gridUid = $props.id();
	const panelId = `pkdx-card-panel-${gridUid}`;
	const openIndex = $derived(openId === null ? -1 : rows.findIndex((r) => r.id === openId));
	const panelAfter = $derived(
		openIndex < 0 ? -1 : panelPlacement(openIndex, grid.columns, rows.length).afterIndex,
	);

	// Opening another tile closes the open panel at once (no closing motion:
	// a collapse running while the new one grows would move the tapped tile
	// twice). When the closed panel sat above the tapped tile, everything
	// below it moves up by its height; this scrolls by the same amount so the
	// tapped tile stays under the finger. Done by hand, not by the browser's
	// CSS scroll anchoring (overflow-anchor), which picks its own anchor and
	// is missing on older iOS WebKit; the grid opts out of it so the two never
	// both correct.
	async function toggle(id: number, tile: HTMLElement) {
		const scroller = tile.closest<HTMLElement>(".pokedex-view");
		const before = tile.getBoundingClientRect().top;
		openId = openId === id ? null : id;
		// A tap grows the panel; a remount (its row scrolled back into the
		// Card window) shows it at full height.
		grown.id = null;
		panelHeight = 0;
		await tick();
		grown.id = openId;
		const shift = tile.getBoundingClientRect().top - before;
		if (scroller && shift !== 0) scroller.scrollTop += shift;
	}

	// The Card window (CONTEXT.md, cardWindow): only the tiles near the
	// viewport are drawn; the grid's padding stands in for the rest. Its
	// inputs are read from the scroller (.pokedex-view, which scrolls the whole
	// browse screen) and from drawn tiles, and frozen while the table screen
	// is hidden (the detail screen owns the scroller then, and the grid
	// measures 0): the window keeps its last slice until the table shows
	// again and back-to-list restores the scroll offset.
	let scrollTop = $state(0);
	let viewportHeight = $state(0);
	// Measured grid row heights, null until a row of that kind is drawn. The
	// estimates only serve the first draw of a fresh mount, which starts at
	// the top, so the switch to measured heights moves nothing on screen.
	let plainHeight = $state<number | null>(null);
	let tallHeight = $state<number | null>(null);
	// The room the open panel adds under its grid row, kept while the panel's
	// row is outside the window so the spacer below it doesn't jump.
	let panelHeight = $state(0);
	// The id whose panel has already grown: a plain note, not state, read
	// once by each mounted panel (CardPanel snapshots its `grow`).
	const grown: { id: number | null } = { id: null };
	// Two lines of tile text at the kit's sizes, the stat strip and the gaps:
	// only for the first draw (above).
	const ESTIMATED_TILE_TEXT = 40;
	const ESTIMATED_FORM_LINE = 13;
	const rowHeight = $derived.by(() => {
		const plain = plainHeight ?? grid.tileWidth + ESTIMATED_TILE_TEXT;
		return { plain, tall: tallHeight ?? plain + ESTIMATED_FORM_LINE };
	});
	const win = $derived(
		cardWindow({
			rows,
			columns: grid.columns,
			rowHeight,
			rowGap: CARD_GRID_GAP * 2,
			panel: panelAfter < 0 ? null : { gridRow: Math.floor(panelAfter / grid.columns), height: panelHeight },
			scrollTop,
			viewportHeight,
		}),
	);
	// Primitives, so a scroll that keeps the same slice re-renders nothing.
	const winStart = $derived(win.start);
	const winEnd = $derived(win.end);
	const drawn = $derived(rows.slice(winStart, winEnd));

	function isShown(el: HTMLElement): boolean {
		return el.getClientRects().length > 0;
	}

	// Reads the scroll offset and viewport, relative to the grid's top edge.
	function readScroll() {
		const el = gridEl;
		const scroller = el?.closest<HTMLElement>(".pokedex-view");
		if (!el || !scroller || !isShown(el)) return;
		scrollTop = scroller.getBoundingClientRect().top - el.getBoundingClientRect().top;
		viewportHeight = scroller.clientHeight;
	}

	// Reads the drawn rows' heights (a tile is stretched to its grid row's
	// height) and the open panel's room.
	function measure() {
		const el = gridEl;
		if (!el || !isShown(el)) return;
		const columns = grid.columns;
		const start = winStart;
		const tiles = el.querySelectorAll<HTMLElement>(":scope > .card-tile");
		for (let k = 0; k < tiles.length; k += columns) {
			const h = tiles[k].getBoundingClientRect().height;
			if (h <= 0) continue;
			const tall = isTallCardRow(rows, columns, Math.floor((start + k) / columns));
			if (tall && tallHeight !== h) tallHeight = h;
			if (!tall && plainHeight !== h) plainHeight = h;
		}
		const panel = el.querySelector<HTMLElement>(":scope > .card-panel");
		if (panel) {
			const h = panel.getBoundingClientRect().height + CARD_GRID_GAP;
			if (h !== panelHeight) panelHeight = h;
		}
	}

	// The grid's width, ignoring the 0 it reports while hidden, so a trip to
	// the detail screen re-lays nothing out.
	$effect(() => {
		const el = gridEl;
		if (!el) return;
		const ro = new ResizeObserver(() => {
			if (el.clientWidth > 0) gridWidth = el.clientWidth;
		});
		ro.observe(el);
		return () => ro.disconnect();
	});

	// Scroll and viewport. Coalesced to a frame. The browse screen above the
	// grid (FilterBar's inline Filters panel) can move the grid without a
	// scroll, so the screen's own size changes re-read too.
	$effect(() => {
		const el = gridEl;
		const scroller = el?.closest<HTMLElement>(".pokedex-view");
		if (!el || !scroller) return;
		let frame = 0;
		const schedule = () => {
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				readScroll();
			});
		};
		scroller.addEventListener("scroll", schedule, { passive: true });
		const ro = new ResizeObserver(schedule);
		ro.observe(scroller);
		if (el.parentElement) ro.observe(el.parentElement);
		readScroll();
		return () => {
			scroller.removeEventListener("scroll", schedule);
			ro.disconnect();
			cancelAnimationFrame(frame);
		};
	});

	// Drawn rows and the panel are watched for size, so a font, Fields or
	// width change re-measures them wherever it comes from. Measured a frame
	// later: a write from inside the observer re-lays the grid out in the same
	// frame, which Chromium reports as an undelivered ResizeObserver loop.
	$effect(() => {
		const el = gridEl;
		void drawn;
		void openIndex;
		if (!el) return;
		let frame = 0;
		const ro = new ResizeObserver(() => {
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				measure();
			});
		});
		for (const child of el.children) ro.observe(child);
		return () => {
			ro.disconnect();
			cancelAnimationFrame(frame);
		};
	});

	// Each sprite's opaque box, by URL, so the tile can centre the content
	// rather than the canvas. Decoded once per cache path (contentBounds'
	// memo); null is "nothing opaque", a missing key is "not measured yet".
	const bounds = new SvelteMap<string, ContentBounds | null>();
	$effect(() => {
		for (const row of rows) {
			const uri = row.spriteDataUri;
			if (!uri || bounds.has(uri)) continue;
			contentBounds(repository.imagePathOf(uri) ?? uri, uri).then(
				(b) => bounds.set(uri, b),
				() => bounds.set(uri, null),
			);
		}
	});

	// The canvas centred at native size, for a sprite whose box is unknown.
	const NATIVE_SPRITE = 96;
	function placement(uri: string, well: number): SpritePlacement {
		const b = bounds.get(uri);
		if (b) return fitSprite(b, well);
		const offset = (well - NATIVE_SPRITE) / 2;
		return { scale: 1, left: offset, top: offset, width: NATIVE_SPRITE, height: NATIVE_SPRITE };
	}

	function onTileKeydown(e: KeyboardEvent, id: number) {
		if (e.key !== "Enter" && e.key !== " ") return;
		e.preventDefault();
		void toggle(id, e.currentTarget as HTMLElement);
	}

	// One dot per EV point, in its stat's colour.
	function evDots(row: PokedexTableRow): string[] {
		return row.evYield.flatMap((y) => Array<string>(y.amount).fill(STAT_COLORS[y.stat]));
	}
</script>

<div class="sort-chips" role="group" aria-label="Sort">
	{#each chips as chip (chip.column)}
		{@const active = sort.column === chip.column}
		<button
			type="button"
			class="lk-chip lk-chip--toggle filter-chip sort-chip"
			aria-pressed={active}
			onclick={() => onSort(chip.column)}
		>
			{chip.label}{#if active}<span class="sort-arrow">{sort.direction === "asc" ? "↑" : "↓"}</span>{/if}
		</button>
	{/each}
</div>

<div
	class="card-grid"
	bind:this={gridEl}
	style:padding-top="{win.padTop}px"
	style:padding-bottom="{win.padBottom}px"
	style:grid-template-columns="repeat({grid.columns}, minmax(0, 1fr))"
	style:gap="{CARD_GRID_GAP * 2}px {CARD_GRID_GAP}px"
	style:--pkdx-row-gap="{CARD_GRID_GAP * 2}px"
	style:--pkdx-panel-gap="{CARD_GRID_GAP}px"
>
	{#each drawn as row, k (row.id)}
		{@const i = winStart + k}
		{@const [typeA, typeB = typeA] = row.types}
		<div
			class="card-tile"
			role="button"
			tabindex="0"
			aria-label="{formatPokemonDisplayName(row)}{favoriteIds.has(row.id) ? ', favorite' : ''}"
			aria-expanded={openId === row.id}
			aria-controls={openId === row.id ? panelId : undefined}
			onclick={(e) => void toggle(row.id, e.currentTarget)}
			onkeydown={(e) => onTileKeydown(e, row.id)}
			{...favoriteMenu.target(row.id)}
		>
			<div
				class="sprite-well"
				class:favorite={favoriteIds.has(row.id)}
				style:height="{grid.tileWidth}px"
				style:--pkdx-wash-a={TYPE_COLORS[typeA]}
				style:--pkdx-wash-b={TYPE_COLORS[typeB]}
			>
				{#if row.spriteDataUri && grid.tileWidth > 0}
					{@const fit = placement(row.spriteDataUri, grid.tileWidth)}
					<img
						src={row.spriteDataUri}
						alt=""
						class="tile-sprite"
						class:smooth={fit.scale < 1}
						class:measured={bounds.has(row.spriteDataUri)}
						style:left="{fit.left}px"
						style:top="{fit.top}px"
						style:width="{fit.width}px"
						style:height="{fit.height}px"
					/>
				{/if}
				<span class="corner corner-tl tile-chip">{formatDexNumber(row.dexNumber)}</span>
				{#if corners.ev && row.evYield.length > 0}
					<span class="corner corner-bl ev-dots" title={formatEvYield(row)}>
						{#each evDots(row) as colour, i (i)}
							<i style:--pkdx-dot={colour}></i>
						{/each}
					</span>
				{/if}
				{#if corners.total}
					<span class="corner corner-br tile-chip total-chip">Σ {totalStat(row.stats)}</span>
				{/if}
			</div>
			<div class="tile-name">
				<span class="base-name">{row.name}</span>
				{#if row.formLabel}<span class="form-line">{row.formLabel}</span>{/if}
			</div>
			{#if strip.stats.length > 0}
				<div class="stat-strip" class:with-values={strip.showValues}>
					{#each strip.stats as stat (stat)}
						<span class="strip-col" title="{STAT_LABEL_BY_KEY.get(stat)} {row.stats[stat]}">
							<i style:--pkdx-bar={STAT_COLORS[stat]} style:--pkdx-bar-height={strip.height(row, stat)}></i>
							{#if strip.showValues}<b>{row.stats[stat]}</b>{/if}
						</span>
					{/each}
				</div>
			{/if}
		</div>
		{#if i === panelAfter && openIndex >= 0}
			{@const open = rows[openIndex]}
			<!-- Keyed by id: switching tiles mounts a fresh panel, so it grows again. -->
			{#key open.id}
				<CardPanel
					id={panelId}
					grow={grown.id !== open.id}
					row={open}
					stats={panelStatCols}
					chips={panelFieldChips}
					barHeight={strip.height}
					{activeGen}
					favorite={favoriteIds.has(open.id)}
					onToggleFavorite={() => onToggleFavorite(open.id)}
					onOpen={() => onSelect(open.id)}
					{heldItemTarget}
				/>
			{/key}
		{/if}
	{/each}
</div>

<style>
	.sort-chips {
		display: flex;
		gap: var(--lk-space-1);
		overflow-x: auto;
		scrollbar-width: none;
		margin-bottom: var(--lk-space-3);
		padding-bottom: 2px;
	}
	.sort-chips::-webkit-scrollbar {
		display: none;
	}
	.sort-chip {
		flex: none;
	}
	.sort-arrow {
		margin-left: 2px;
	}
	.card-grid {
		display: grid;
		overflow-anchor: none;
	}
	.card-tile {
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		cursor: pointer;
		border-radius: 10px;
		outline: none;
		/* A press and hold opens the favourites menu: iOS's own selection and
		callout must not answer it first. */
		-webkit-touch-callout: none;
		user-select: none;
	}
	.card-tile:focus-visible .sprite-well {
		outline: 2px solid var(--lk-focus-ring);
		outline-offset: 1px;
	}
	/* The tile's one bold element: a diagonal wash of its type colours, split
	for a dual type (a single type passes its colour twice). */
	.sprite-well {
		position: relative;
		overflow: hidden;
		border-radius: 10px;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--pkdx-wash-a) 26%, transparent) 50%,
			color-mix(in srgb, var(--pkdx-wash-b) 26%, transparent) 50%
		);
		transition: filter var(--lk-duration-fast) ease-out;
	}
	/* A favourite: a 1px accent outline round the well (#35; a corner dot read
	as one of the EV dots). An overlay rather than the well's own inset shadow,
	so a sprite that reaches the well's edge (Venusaur) can't cover it. The
	keyboard focus ring stays distinct: grey, and outside the well. */
	.sprite-well.favorite::after {
		content: "";
		position: absolute;
		inset: 0;
		z-index: 2;
		border-radius: inherit;
		box-shadow: inset 0 0 0 1px var(--lk-accent);
		pointer-events: none;
	}
	.card-tile:hover .sprite-well {
		filter: brightness(0.97);
	}
	/* !important: Obsidian's `.view-content img { max-width: 100% }` outranks a
	scoped class (see TableScreen's .sprite-preview). Native pixels stay crisp;
	a sprite scaled down to fit is smoothed. Hidden until its box is measured,
	so it never jumps from canvas-centred to box-centred. */
	.tile-sprite {
		position: absolute;
		max-width: none !important;
		max-height: none !important;
		image-rendering: pixelated;
		opacity: 0;
		pointer-events: none;
	}
	.tile-sprite.smooth {
		image-rendering: auto;
	}
	.tile-sprite.measured {
		opacity: 1;
	}
	.corner {
		position: absolute;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		line-height: 1;
	}
	.corner-tl {
		top: 4px;
		left: 4px;
	}
	.corner-bl {
		bottom: 5px;
		left: 5px;
	}
	.corner-br {
		bottom: 4px;
		right: 4px;
	}
	.tile-chip {
		padding: 1px 4px;
		border-radius: 4px;
		background: var(--lk-surface);
		color: var(--lk-text-muted);
		font-size: 0.66rem;
		font-variant-numeric: tabular-nums;
	}
	.total-chip {
		color: var(--lk-text);
		font-weight: 600;
	}
	.ev-dots {
		gap: 2px;
	}
	.ev-dots i {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--pkdx-dot);
		box-shadow: 0 0 0 1px var(--lk-surface);
	}
	.tile-name {
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding: 0 1px;
		text-transform: capitalize;
	}
	.base-name {
		overflow: hidden;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--lk-text);
	}
	.form-line {
		overflow: hidden;
		font-size: 0.69rem;
		line-height: 1.2;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--lk-text-muted);
	}
	/* Pinned to the tile's bottom, so strips line up across a grid row even
	when a regional form's name takes a second line. */
	.stat-strip {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 18px;
		margin-top: auto;
		padding: 0 1px;
	}
	.stat-strip.with-values {
		height: 30px;
	}
	.strip-col {
		display: flex;
		flex: 1;
		flex-direction: column;
		justify-content: flex-end;
		min-width: 0;
		height: 100%;
	}
	.strip-col i {
		display: block;
		min-height: 2px;
		height: calc(var(--pkdx-bar-height) * 100%);
		border-radius: 2px 2px 0 0;
		background: var(--pkdx-bar);
	}
	.with-values .strip-col i {
		height: calc(var(--pkdx-bar-height) * 16px);
	}
	/* Four three-digit values (12 digits, 0.64em each in every font here) must
	stay apart in a ~75px tile (a 390px pane on desktop, scrollbar included):
	at 0.63rem, Charizard's "109 100" ran together. So the size follows the
	tile's width (container-type on .card-tile), capped at 0.63rem. */
	.strip-col b {
		margin-top: 2px;
		font-size: min(0.63rem, 11.5cqi);
		font-weight: 500;
		line-height: 1;
		letter-spacing: -0.05em;
		text-align: center;
		font-variant-numeric: tabular-nums;
		color: var(--lk-text-muted);
	}
</style>
