<script lang="ts">
	import type { GigantamaxFormSummary } from "../../data/types";

	// Mirrors MegaFormToggle's shape exactly (fetch/cache state lives in
	// DetailScreen, this is purely presentational) — but there's never more
	// than one Gigantamax variety per browsable row (see deriveGigantamaxForms:
	// it matches the viewed variety's own name, not the bare species name, so
	// Toxtricity/Urshifu's non-default personality/strike variants never
	// contribute a second entry here), so there's no badge-count branch to
	// speak of, unlike Mega's single-vs-X/Y-split case.
	let { gigantamaxForms, activeKey, onSelect }: {
		gigantamaxForms: GigantamaxFormSummary[];
		activeKey: string | null;
		onSelect: (key: string | null) => void;
	} = $props();

	function toggle(key: string) {
		onSelect(activeKey === key ? null : key);
	}
</script>

{#if gigantamaxForms.length > 0}
	<div class="gmax-form-toggle">
		{#each gigantamaxForms as form (form.key)}
			<button
				type="button"
				class="gmax-badge"
				class:active={activeKey === form.key}
				onclick={() => toggle(form.key)}
				aria-label={activeKey === form.key ? "Show base form" : "Show Gigantamax form"}
				title={activeKey === form.key ? "Show base form" : form.label}
			>
				G
			</button>
		{/each}
	</div>
{/if}

<style>
	/* Same footprint family as MegaFormToggle's .mega-badge (bottom-left) and
	DetailScreen's .shiny-toggle (top-right) — this one takes the remaining
	corner, bottom-right, so a species with both Mega and Gigantamax (e.g.
	Venusaur/Charizard/Blastoise) can show both toggles without overlap. */
	.gmax-form-toggle {
		position: absolute;
		bottom: 8px;
		right: 8px;
		display: flex;
		gap: 4px;
	}
	.gmax-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s, 6px);
		color: var(--text-muted);
		cursor: pointer;
		box-shadow: var(--shadow-s);
		font-size: 0.8em;
		font-weight: 700;
	}
	.gmax-badge:hover {
		color: var(--text-normal);
		background: var(--background-modifier-hover);
	}
	.gmax-badge.active {
		color: var(--interactive-accent);
		border-color: var(--interactive-accent);
	}
</style>
