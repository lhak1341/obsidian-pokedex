<script lang="ts">
	let { label, value, max, color = "var(--interactive-accent)" }: {
		label: string;
		value: number;
		max: number;
		color?: string;
	} = $props();
</script>

<!-- No wrapping element: this component contributes 3 bare grid cells, not
its own grid. The parent (.stat-bars / .breeding-bars) owns a single shared
grid so the label/value/track columns line up across every row — if each
row sized its own columns independently, "Hatch counter" and "Catch rate"
(different label widths) would misalign their bars. -->
<span class="bar-label">{label}</span>
<span class="bar-value">{value}</span>
<div class="bar-track">
	<div class="bar-fill" style:width="{Math.min((value / max) * 100, 100)}%" style:background={color}></div>
</div>

<style>
	.bar-label {
		font-weight: 600;
		color: var(--text-muted);
		font-size: 0.85em;
	}
	.bar-value {
		text-align: right;
		font-family: var(--font-monospace);
		font-size: 0.85em;
	}
	.bar-track {
		background: var(--background-modifier-border);
		border-radius: 4px;
		height: 8px;
		overflow: hidden;
	}
	.bar-fill {
		height: 100%;
	}
</style>
