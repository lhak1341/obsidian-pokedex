<script lang="ts">
	import { STAT_COLORS, TYPE_COLORS } from "../../data/constants";
	import type { PokedexTableRow, StatBlock } from "../../data/types";
	import type { PanelStats } from "../../utils/cardView";
	import { type Field, formatEvYield, STAT_LABEL_BY_KEY } from "../../utils/fields";
	import { filterHeldItemsForGen, type HeldItemForGen } from "../../utils/heldItemGen";
	import { formatItemName, formatPokemonDisplayName } from "../../utils/pokemonDisplay";
	import { totalStat } from "../../utils/stats";
	import EvChips from "./EvChips.svelte";
	import FavoriteToggle from "./FavoriteToggle.svelte";
	import type { InfoTargetProps } from "../infoPopover.svelte";
	import Icon from "./Icon.svelte";

	// Card view's tap panel (CONTEXT.md, "Card view"): every chosen Field of
	// one Pokemon with its exact value, drawn under the tapped tile's grid row.
	// What goes where is cardView.ts (panelStats, panelChips); this draws it.
	// Favourites are PokedexApp's (ADR-0012), so the asterisk only asks. The
	// held item's Info popover is TableScreen's, so its box (with the rarity)
	// is the table's own and draws over this panel.
	let { id, row, stats, chips, barHeight, activeGen, favorite, onToggleFavorite, onOpen, heldItemTarget }: {
		id: string;
		row: PokedexTableRow;
		stats: PanelStats;
		chips: Field[];
		// 0..1, relative per stat among the shown rows, as on the tile.
		barHeight: (row: PokedexTableRow, stat: keyof StatBlock) => number;
		activeGen: number;
		favorite: boolean;
		onToggleFavorite: () => void;
		onOpen: () => void;
		heldItemTarget: (item: HeldItemForGen) => InfoTargetProps;
	} = $props();

	const typeA = $derived(row.types[0]);
	const typeB = $derived(row.types[1] ?? row.types[0]);
</script>

<div class="card-panel" {id} role="region" aria-label="{formatPokemonDisplayName(row)} details">
	<div class="panel-clip">
		<div class="panel-body" style:--pkdx-wash-a={TYPE_COLORS[typeA]} style:--pkdx-wash-b={TYPE_COLORS[typeB]}>
			<div class="panel-contents">
				<div class="panel-header">
					<span class="panel-name">
						{formatPokemonDisplayName(row)}<FavoriteToggle active={favorite} onToggle={onToggleFavorite} size={14} />
					</span>
					<button type="button" class="panel-open" onclick={onOpen}>Open ›</button>
				</div>

				{#if stats.stats.length > 0 || stats.total}
					<div class="panel-stats" class:stretched={stats.mode === "stretched"}>
						{#each stats.stats as stat (stat)}
							<span class="stat-col">
								<i style:--pkdx-bar={STAT_COLORS[stat]} style:--pkdx-bar-height={barHeight(row, stat)}></i>
								<b>{row.stats[stat]}</b>
								<small>{STAT_LABEL_BY_KEY.get(stat)}</small>
							</span>
						{/each}
						{#if stats.total}
							<span class="stat-col total-col">
								<b>{totalStat(row.stats)}</b>
								<small>Total</small>
							</span>
						{/if}
					</div>
				{/if}

				{#if chips.length > 0}
					<div class="panel-chips">
						{#each chips as field (field.key)}
							<!-- No chip title over the held item: its Info popover explains it. -->
							<span class="field-chip" title={field.custom === "heldItems" ? undefined : field.label}>
								{#if field.icon}<span class="field-icon"><Icon name={field.icon} size={12} strokeWidth={2} /></span>{/if}
								{#if field.custom === "ev"}
									<span title={formatEvYield(row)}><EvChips evYield={row.evYield} /></span>
								{:else if field.custom === "heldItems"}
									{@const items = filterHeldItemsForGen(row.heldItemsAllGens, activeGen)}
									{#each items as item, i (item.name)}
										{#if i > 0}<span class="chip-sep">,</span>{/if}
										<span class="held-item-name pkdx-info-target" {...heldItemTarget(item)}>{formatItemName(item.name)}</span>
									{:else}
										<span class="chip-empty">None</span>
									{/each}
								{:else if field.custom === undefined}
									<span class="chip-value" title={field.title?.(row, activeGen)}>{field.render(row, activeGen)}</span>
								{/if}
							</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	/* The accordion's motion: the row grows from 0 (grid-template-rows 0fr to
	1fr; panel-clip's overflow hides the contents meanwhile) over ~240ms,
	ease-out, and the contents fade in over the second half. The margin starts
	at minus the grid's row gap, so the extra grid row this panel adds takes no
	room until it grows: nothing below jumps by a gap's height first. Durations
	read the kit token, so Reduce motion (setting or OS) makes it instant. */
	.card-panel {
		--pkdx-panel-duration: calc(var(--lk-duration-base) * 1.2);
		grid-column: 1 / -1;
		display: grid;
		grid-template-rows: 1fr;
		margin-top: calc(var(--pkdx-panel-gap) - var(--pkdx-row-gap));
		animation: pkdx-panel-grow var(--pkdx-panel-duration) ease-out;
	}
	@keyframes pkdx-panel-grow {
		from {
			grid-template-rows: 0fr;
			margin-top: calc(-1 * var(--pkdx-row-gap));
		}
	}
	.panel-clip {
		min-height: 0;
		overflow: hidden;
	}
	/* The tapped Pokemon's type wash, softer than the tile's split: a diagonal
	blend. Its colour is the only link to the tile (no mark on the tile). Tints
	over the view's own background, so it holds in either theme. */
	.panel-body {
		border-radius: 12px;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--pkdx-wash-a) 22%, transparent),
			color-mix(in srgb, var(--pkdx-wash-b) 14%, transparent)
		);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pkdx-wash-a) 24%, transparent);
	}
	.panel-contents {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 10px 12px 12px;
		animation: pkdx-panel-fade calc(var(--pkdx-panel-duration) / 2) ease-out calc(var(--pkdx-panel-duration) / 2) both;
	}
	@keyframes pkdx-panel-fade {
		from {
			opacity: 0;
		}
	}
	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--lk-space-2);
	}
	.panel-name {
		min-width: 0;
		font-size: 0.95rem;
		font-weight: 600;
		text-transform: capitalize;
		color: var(--lk-text);
	}
	/* button.panel-open: Obsidian's own `button` rules otherwise win the rest
	state (root CLAUDE.md, Styles). */
	button.panel-open {
		flex: none;
		height: auto;
		padding: 2px 4px;
		background: transparent;
		border: none;
		box-shadow: none;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--lk-accent);
		cursor: pointer;
	}
	button.panel-open:hover {
		background: transparent;
		text-decoration: underline;
	}
	.panel-stats {
		display: flex;
		align-items: flex-end;
		gap: 8px;
	}
	.stat-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		width: 30px;
		min-width: 0;
	}
	.stretched .stat-col {
		flex: 1;
		width: auto;
	}
	.stat-col i {
		display: block;
		align-self: stretch;
		min-height: 2px;
		height: calc(var(--pkdx-bar-height) * 40px);
		border-radius: 3px 3px 0 0;
		background: var(--pkdx-bar);
	}
	.stat-col b {
		margin-top: 3px;
		font-size: 0.8125rem; /* 13px */
		font-weight: 700;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
		color: var(--lk-text);
	}
	.stat-col small {
		font-size: 0.66rem;
		line-height: 1.2;
		color: var(--lk-text-muted);
	}
	/* Total: muted, after a hairline at the right. */
	.total-col {
		width: auto;
		margin-left: auto;
		padding-left: 10px;
		border-left: 1px solid color-mix(in srgb, var(--lk-text) 18%, transparent);
	}
	.stretched .total-col {
		flex: none;
	}
	.total-col b {
		color: var(--lk-text-muted);
	}
	.panel-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.field-chip {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		min-width: 0;
		padding: 3px 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--lk-surface) 72%, transparent);
		font-size: 0.78rem;
		color: var(--lk-text);
		/* A held item's tap area (styles.src.css, .pkdx-info-target::before)
		spans the chip's height. */
		--pkdx-tap-pad-y: 3px;
	}
	.field-icon {
		display: inline-flex;
		color: var(--lk-text-muted);
	}
	.chip-value,
	.chip-empty {
		font-variant-numeric: tabular-nums;
	}
	.chip-empty,
	.chip-sep {
		color: var(--lk-text-muted);
	}
	.chip-sep {
		margin-left: -4px;
	}
</style>
