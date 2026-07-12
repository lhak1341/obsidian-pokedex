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
		grid-template-columns: 36px 32px 1fr;
		align-items: center;
		row-gap: 4px;
		column-gap: 6px;
	}
	.stat-total {
		grid-column: 1 / -1;
		display: flex;
		justify-content: space-between;
		margin-top: 4px;
		padding-top: 6px;
		border-top: 1px solid var(--background-modifier-border);
		font-weight: 700;
	}
	.stat-total-label {
		color: var(--text-normal);
	}
	.stat-total-value {
		font-family: var(--font-monospace);
	}
</style>
