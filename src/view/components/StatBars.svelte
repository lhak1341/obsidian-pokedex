<script lang="ts">
	import { STAT_COLORS, STAT_COLUMNS } from "../../data/constants";
	import type { StatBlock } from "../../data/types";
	import { totalStat } from "../../utils/stats";
	import BarRow from "./BarRow.svelte";

	let { stats }: { stats: StatBlock } = $props();

	// 255 is the games' true ceiling, but scaling against it makes every
	// ordinary stat (most sit well under half that) look barely filled.
	// 200 comfortably covers all but a handful of real outliers (e.g.
	// Chansey/Blissey's 250/255 HP) — those just cap at a full bar instead
	// of overflowing it.
	const MAX_STAT = 200;
</script>

<div class="stat-bars">
	{#each STAT_COLUMNS as col (col.key)}
		<BarRow label={col.label} value={stats[col.key]} max={MAX_STAT} color={STAT_COLORS[col.key]} />
	{/each}
	<div class="stat-total">
		<span class="stat-total-label">Total</span>
		<span class="stat-total-value">{totalStat(stats)}</span>
	</div>
</div>

<style>
	.stat-bars {
		display: grid;
		/* Label and number columns fit their content: fixed 36px and 32px
		columns left "HP" ~44px from its "80" while "SpA" touched "100". */
		grid-template-columns: max-content max-content 1fr;
		align-items: center;
		row-gap: 4px;
		column-gap: 10px;
	}
	/* The total's number sits in the number column, under the stats', with
	its label spanning both columns before it. */
	.stat-total {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: subgrid;
		align-items: baseline;
		margin-top: 4px;
		padding-top: 6px;
		border-top: 1px solid var(--lk-border);
		font-weight: 700;
	}
	.stat-total-label {
		grid-column: 1 / 3;
		grid-row: 1;
		color: var(--lk-text);
		font-size: 0.85em;
		white-space: nowrap;
	}
	.stat-total-value {
		grid-column: 1 / 3;
		grid-row: 1;
		justify-self: end;
		font-family: var(--lk-font-code);
		font-size: 0.85em;
	}
</style>
