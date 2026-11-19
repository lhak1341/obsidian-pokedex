<script lang="ts">
	import { ringFill } from "../../utils/ring";

	// Catch rate and hatch counter on the phone layout's Capture & Breeding
	// (#32): a 56px ring in the bar's colour, value in the centre, label
	// below. BarRow stays the bars' grid cells; this is its own component.
	let { label, value, max }: { label: string; value: number; max: number } = $props();

	const SIZE = 56;
	const STROKE = 5;
	const RADIUS = (SIZE - STROKE) / 2;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
	const filled = $derived(ringFill(value, max) * CIRCUMFERENCE);
</script>

<div class="ring" style:width="{SIZE}px">
	<div class="ring-dial" style:width="{SIZE}px" style:height="{SIZE}px">
		<svg width={SIZE} height={SIZE} viewBox="0 0 {SIZE} {SIZE}" aria-hidden="true">
			<circle class="ring-track" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke-width={STROKE} />
			<!-- Starts at 12 o'clock and runs clockwise. A round cap on an empty
			arc would still draw a dot, so a zero fill draws nothing. -->
			{#if filled > 0}
				<circle
					class="ring-fill"
					cx={SIZE / 2}
					cy={SIZE / 2}
					r={RADIUS}
					stroke-width={STROKE}
					stroke-dasharray="{filled} {CIRCUMFERENCE}"
					transform="rotate(-90 {SIZE / 2} {SIZE / 2})"
				/>
			{/if}
		</svg>
		<span class="ring-value">{value}</span>
	</div>
	<span class="ring-label">{label}</span>
</div>

<style>
	.ring {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		/* Its width (inline, SIZE) is the dial's own, so two rings sit side by
		side in a 360px pane's Stats column (115px inside); each label wraps
		under its ring ("Hatch / counter"). */
	}
	.ring-dial {
		position: relative;
	}
	.ring-dial svg {
		display: block;
	}
	.ring-track {
		fill: none;
		stroke: var(--lk-border);
	}
	/* The bars' colour: BarRow's default, which Capture & Breeding uses. */
	.ring-fill {
		fill: none;
		stroke: var(--lk-accent);
		stroke-linecap: round;
	}
	.ring-value {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--lk-font-code);
		font-size: 0.85em;
		font-weight: 600;
		color: var(--lk-text);
	}
	.ring-label {
		font-weight: 600;
		color: var(--lk-text-muted);
		font-size: 0.78em;
		line-height: 1.2;
		text-align: center;
	}
</style>
