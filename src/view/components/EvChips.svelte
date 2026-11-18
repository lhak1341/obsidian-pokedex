<script lang="ts">
	import { STAT_COLORS } from "../../data/constants";
	import type { EvYieldEntry } from "../../data/types";
	import { STAT_LABEL_BY_KEY } from "../../utils/fields";

	// EV yield as stat-coloured chips, shared by the table's EV cell and the
	// detail screen. "-" when the Pokemon yields nothing.
	let { evYield }: { evYield: EvYieldEntry[] } = $props();
</script>

<div class="ev-chips">
	{#each evYield as y (y.stat)}
		<span class="ev-chip" style:--pkdx-ev-colour={STAT_COLORS[y.stat]}>
			{y.amount} {STAT_LABEL_BY_KEY.get(y.stat) ?? y.stat}
		</span>
	{:else}
		<span class="ev-empty">-</span>
	{/each}
</div>

<style>
	.ev-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	/* Same STAT_COLORS hue per stat as the detail screen's StatBars/BarRow —
	but, like BarRow, that color stays an accent (dot + tinted background/
	border via color-mix) rather than the text fill: several of these hues
	(hp's lime, attack's yellow) read poorly as small text on a light theme's
	near-white background, so the label itself stays var(--lk-text). */
	.ev-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 8px 2px 6px;
		border-radius: 999px;
		font-size: 0.78em;
		font-weight: 600;
		white-space: nowrap;
		color: var(--lk-text);
		background: color-mix(in srgb, var(--pkdx-ev-colour) 14%, var(--lk-surface));
		border: 1px solid color-mix(in srgb, var(--pkdx-ev-colour) 45%, var(--lk-border));
	}
	.ev-chip::before {
		content: "";
		width: 7px;
		height: 7px;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--pkdx-ev-colour);
	}
	.ev-empty {
		color: var(--lk-text-faint);
	}
</style>
