<script lang="ts">
	import Icon from "./Icon.svelte";

	// Gender ratio as a third Capture & Breeding ring: the male share from
	// 12 o'clock clockwise in blue, the female share after it in pink, both
	// percentages beside it (or under it, below a 540px panel). Same shape
	// and breakpoint as Ring.svelte. Null shares are genderless: an empty
	// track and "None".
	let { malePct, femalePct }: { malePct: number | null; femalePct: number | null } = $props();

	const SIZE = 44;
	const STROKE = 5;
	const RADIUS = (SIZE - STROKE) / 2;
	const C = 2 * Math.PI * RADIUS;
	const male = $derived(malePct === null ? 0 : (malePct / 100) * C);
	const female = $derived(femalePct === null ? 0 : (femalePct / 100) * C);
</script>

{#snippet shares()}
	{#if malePct === null || femalePct === null}
		<span>None</span>
	{:else}
		{#if malePct > 0}<span class="male"><Icon name="mars" size={10} strokeWidth={3} />{malePct}%</span>{/if}
		{#if femalePct > 0}<span class="female"><Icon name="venus" size={10} strokeWidth={3} />{femalePct}%</span>{/if}
	{/if}
{/snippet}

<div class="ring">
	<div class="ring-dial" style:width="{SIZE}px" style:height="{SIZE}px">
		<svg width={SIZE} height={SIZE} viewBox="0 0 {SIZE} {SIZE}" aria-hidden="true">
			<circle class="ring-track" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke-width={STROKE} />
			{#if male > 0}
				<circle class="arc-male" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke-width={STROKE}
					stroke-dasharray="{male} {C}" transform="rotate(-90 {SIZE / 2} {SIZE / 2})" />
			{/if}
			{#if female > 0}
				<circle class="arc-female" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke-width={STROKE}
					stroke-dasharray="0 {male} {female} {C}" transform="rotate(-90 {SIZE / 2} {SIZE / 2})" />
			{/if}
		</svg>
	</div>
	<div class="ring-text">
		<span class="ring-label">{malePct === null ? "Genderless" : "Gender"}</span>
		<span class="ring-value">{@render shares()}</span>
	</div>
</div>

<style>
	.ring { display: flex; align-items: center; gap: 10px; }
	.ring-dial { position: relative; flex: none; }
	.ring-dial svg { display: block; }
	.ring-track { fill: none; stroke: var(--lk-border); }
	.arc-male { fill: none; stroke: var(--lk-blue); }
	.arc-female { fill: none; stroke: var(--lk-pink); }
	.ring-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
	.ring-label { font-weight: 600; color: var(--lk-text-muted); font-size: 0.78em; line-height: 1.2; }
	.ring-value {
		display: flex; flex-direction: column;
		font-family: var(--lk-font-code); font-weight: 600; font-size: 0.85em; line-height: 1.25;
	}
	.ring-value > span { display: inline-flex; align-items: center; gap: 2px; }
	.male { color: var(--lk-blue); }
	.female { color: var(--lk-pink); }
	@container capture (width < 540px) {
		.ring { flex-direction: column; gap: 4px; width: 64px; }
		.ring-text { align-items: center; text-align: center; }
		.ring-value { align-items: center; }
	}
</style>
