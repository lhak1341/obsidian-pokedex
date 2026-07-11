<script lang="ts">
	import { STAT_COLUMNS } from "../../data/constants";
	import type { StatBlock } from "../../data/types";

	let { stats }: { stats: StatBlock } = $props();

	const MAX_STAT = 255; // ceiling used by the games for the base-stat bar scale
</script>

<div class="stat-bars">
	{#each STAT_COLUMNS as col (col.key)}
		<div class="stat-row">
			<span class="stat-label">{col.label}</span>
			<span class="stat-value">{stats[col.key]}</span>
			<div class="stat-track">
				<div class="stat-fill" style:width="{(stats[col.key] / MAX_STAT) * 100}%"></div>
			</div>
		</div>
	{/each}
</div>

<style>
	.stat-bars {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-width: 320px;
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
	}
	.stat-track {
		background: var(--background-modifier-border);
		border-radius: 4px;
		height: 8px;
		overflow: hidden;
	}
	.stat-fill {
		background: var(--interactive-accent);
		height: 100%;
	}
</style>
