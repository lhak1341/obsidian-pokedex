<script lang="ts">
	import { STAT_COLORS, STAT_COLUMNS } from "../../data/constants";
	import type { StatBlock } from "../../data/types";
	import { totalStat } from "../../utils/stats";

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
		<div class="stat-row">
			<span class="stat-label">{col.label}</span>
			<span class="stat-value">{stats[col.key]}</span>
			<div class="stat-track">
				<div
					class="stat-fill"
					style:width="{Math.min((stats[col.key] / MAX_STAT) * 100, 100)}%"
					style:background={STAT_COLORS[col.key]}
				></div>
			</div>
		</div>
	{/each}
	<div class="stat-row stat-total">
		<span class="stat-label">Total</span>
		<span class="stat-value">{totalStat(stats)}</span>
	</div>
</div>

<style>
	.stat-bars {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.stat-row {
		display: grid;
		grid-template-columns: 36px 32px 1fr;
		align-items: center;
		gap: 6px;
		font-size: 0.85em;
	}
	.stat-label {
		font-weight: 600;
		color: var(--text-muted);
	}
	.stat-value {
		text-align: right;
		font-family: var(--font-monospace);
	}
	.stat-track {
		background: var(--background-modifier-border);
		border-radius: 4px;
		height: 8px;
		overflow: hidden;
	}
	.stat-fill {
		height: 100%;
	}
	.stat-total {
		margin-top: 4px;
		padding-top: 6px;
		border-top: 1px solid var(--background-modifier-border);
		font-weight: 700;
	}
	.stat-total .stat-label {
		color: var(--text-normal);
	}
</style>
