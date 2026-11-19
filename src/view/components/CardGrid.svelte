<script lang="ts">
	import { SvelteMap } from "svelte/reactivity";
	import { STAT_COLORS, TYPE_COLORS } from "../../data/constants";
	import type { PokedexRepository } from "../../data/PokedexRepository";
	import type { PokedexTableRow } from "../../data/types";
	import {
		CARD_GRID_GAP, cardGrid, type ContentBounds, fitSprite, sortChips, type SpritePlacement, statStrip, tileCorners,
	} from "../../utils/cardView";
	import { formatEvYield, STAT_LABEL_BY_KEY } from "../../utils/fields";
	import { formatDexNumber, formatPokemonDisplayName } from "../../utils/pokemonDisplay";
	import type { SortColumn, SortState } from "../../utils/sortPokemon";
	import { totalStat } from "../../utils/stats";
	import { contentBounds } from "../imageBounds";

	// Card view (CONTEXT.md): the browse screen's rows drawn as a grid of tiles.
	// It owns nothing but its drawing: rows (already filtered, sorted and Active
	// Gen scoped), the Fields selection, the sort and favourites all come from
	// TableScreen, the browse screen's owner, so a switch to or from the table
	// keeps them. The tile's ★ is display-only (no accidental toggles while
	// scrolling); favouriting stays on the table's asterisk, the detail screen
	// and, in #28, the tap panel.
	let { rows, visibleFields, favoriteIds, sort, repository, onSort, onSelect }: {
		rows: PokedexTableRow[];
		visibleFields: ReadonlySet<string>;
		favoriteIds: ReadonlySet<number>;
		sort: SortState;
		repository: PokedexRepository;
		onSort: (column: SortColumn) => void;
		onSelect: (id: number) => void;
	} = $props();

	let gridWidth = $state(0);
	const grid = $derived(cardGrid(gridWidth));
	const corners = $derived(tileCorners(visibleFields));
	const strip = $derived(statStrip(rows, visibleFields));
	const chips = $derived(sortChips(visibleFields));

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
		onSelect(id);
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
	bind:clientWidth={gridWidth}
	style:grid-template-columns="repeat({grid.columns}, minmax(0, 1fr))"
	style:gap="{CARD_GRID_GAP * 2}px {CARD_GRID_GAP}px"
>
	{#each rows as row (row.id)}
		{@const [typeA, typeB = typeA] = row.types}
		<div
			class="card-tile"
			role="button"
			tabindex="0"
			aria-label={formatPokemonDisplayName(row)}
			onclick={() => onSelect(row.id)}
			onkeydown={(e) => onTileKeydown(e, row.id)}
		>
			<div
				class="sprite-well"
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
				{#if favoriteIds.has(row.id)}
					<span class="corner corner-tr favorite-mark" title="Favorite">★</span>
				{/if}
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
	.corner-tr {
		top: 3px;
		right: 5px;
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
	.favorite-mark {
		color: var(--lk-accent);
		font-size: 0.75rem;
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
