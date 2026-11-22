<script lang="ts">
	import { arcDasharray, RING_RADIUS as RADIUS, RING_SIZE as SIZE, RING_STROKE as STROKE, ringFill } from "../../utils/ring";

	// Catch rate and hatch counter in Capture & Breeding: a 44px ring in the
	// bars' colour. From a 540px panel (DetailScreen's `capture` container)
	// the label and "value / max" sit beside the ring; below that the value
	// moves into the dial and the label under it, so four items still fit
	// one line. GenderRing.svelte draws the same shape with two arcs.
	let { label, value, max }: { label: string; value: number; max: number } = $props();

	const fill = $derived(arcDasharray(0, ringFill(value, max)));
</script>

<div class="ring">
	<div class="ring-dial" style:width="{SIZE}px" style:height="{SIZE}px">
		<svg width={SIZE} height={SIZE} viewBox="0 0 {SIZE} {SIZE}" aria-hidden="true">
			<circle class="ring-track" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke-width={STROKE} />
			{#if fill}
				<circle class="ring-fill" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke-width={STROKE}
					stroke-dasharray={fill} transform="rotate(-90 {SIZE / 2} {SIZE / 2})" />
			{/if}
		</svg>
		<span class="ring-value in-dial">{value}</span>
	</div>
	<div class="ring-text">
		<span class="ring-label">{label}</span>
		<span class="ring-value beside">{value}<span class="ring-max">&thinsp;/&thinsp;{max}</span></span>
	</div>
</div>

<style>
	.ring { display: flex; align-items: center; gap: 10px; }
	.ring-dial { position: relative; flex: none; }
	.ring-dial svg { display: block; }
	.ring-track { fill: none; stroke: var(--lk-border); }
	.ring-fill { fill: none; stroke: var(--lk-accent); stroke-linecap: round; }
	.ring-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
	.ring-label { font-weight: 600; color: var(--lk-text-muted); font-size: 0.78em; line-height: 1.2; }
	.ring-value { font-family: var(--lk-font-code); font-weight: 600; color: var(--lk-text); }
	.ring-value.beside { font-size: 0.95em; }
	.ring-max { color: var(--lk-text-muted); font-weight: 400; font-size: 0.85em; }
	.ring-value.in-dial {
		display: none; position: absolute; inset: 0;
		align-items: center; justify-content: center; font-size: 0.8em;
	}
	@container capture (width < 540px) {
		.ring { flex-direction: column; gap: 4px; width: 64px; }
		.ring-text { align-items: center; text-align: center; }
		.ring-value.in-dial { display: flex; }
		.ring-value.beside { display: none; }
	}
</style>
