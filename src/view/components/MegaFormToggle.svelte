<script lang="ts">
	import type { MegaFormSummary } from "../../data/types";

	// Purely presentational — fetch/cache state for the selected form lives
	// in DetailScreen (unlike AbilitiesPanel/HeldItemsPanel's self-contained
	// hover popovers), since a Mega selection needs to drive sibling panels
	// (StatBars, AbilitiesPanel, the portrait itself) outside this
	// component's own tree, not just itself.
	let { megaForms, activeKey, onSelect }: {
		megaForms: MegaFormSummary[];
		activeKey: string | null;
		onSelect: (key: string | null) => void;
	} = $props();

	// "M" for a single-mega species, "X"/"Y" for the two species with a
	// split pair (Charizard, Mewtwo) — short enough to fit the same
	// icon-button footprint as the shiny-toggle badge this mirrors.
	function badgeText(label: string): string {
		return label === "Mega" ? "M" : label.slice(-1);
	}

	// No separate "Base" button — clicking the already-active one toggles
	// back to base, clicking a different one switches to it directly
	// (deactivating whichever was active), same interaction model as the
	// existing shiny-toggle single button, just one instance per form.
	function toggle(key: string) {
		onSelect(activeKey === key ? null : key);
	}
</script>

{#if megaForms.length > 0}
	<div class="mega-form-toggle">
		{#each megaForms as form (form.key)}
			<button
				type="button"
				class="mega-badge"
				class:active={activeKey === form.key}
				onclick={() => toggle(form.key)}
				aria-label={activeKey === form.key ? `Show base ${form.label} form` : `Show ${form.label} form`}
				title={activeKey === form.key ? "Show base form" : form.label}
			>
				{badgeText(form.label)}
			</button>
		{/each}
	</div>
{/if}

<style>
	/* Same footprint/position family as DetailScreen's .shiny-toggle (top-
	right on the portrait), anchored bottom-left instead — see that class for
	the shared sizing rationale. Multiple forms (Charizard/Mewtwo's X/Y pair)
	lay out left-to-right from the corner. */
	.mega-form-toggle {
		position: absolute;
		bottom: 8px;
		left: 8px;
		display: flex;
		gap: 4px;
	}
	.mega-badge {
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
	.mega-badge:hover {
		color: var(--text-normal);
		background: var(--background-modifier-hover);
	}
	.mega-badge.active {
		color: var(--interactive-accent);
		border-color: var(--interactive-accent);
	}
</style>
